/**
 * The transport, tested without a renderer, a device or a sound.
 *
 * That is the point of it being a store: every fault this domain was
 * built after was invisible to reading and only showed on hardware.
 * A model with no React in it can at least be argued with here.
 */
import { createTransport, type TransportEngine } from '../transportStore';

function fakeEngine(): TransportEngine & {
  starts: number[];
  silences: number;
  reached: number;
  refuse: string | null;
} {
  const engine = {
    starts: [] as number[],
    silences: 0,
    reached: 0,
    refuse: null as string | null,
    start(fromMs: number) {
      if (engine.refuse != null) {
        return Promise.reject(new Error(engine.refuse));
      }
      engine.starts.push(fromMs);
      return Promise.resolve(25000);
    },
    silence() {
      engine.silences += 1;
    },
    reachedMs: () => engine.reached
  };
  return engine;
}

describe('playing', () => {
  it('ACC-TPORT-001: reaches the engine and says so', async () => {
    const engine = fakeEngine();
    const t = createTransport(engine);
    await t.play();
    expect(engine.starts).toEqual([0]);
    expect(t.snapshot().state).toBe('playing');
  });

  it('ACC-TPORT-002: fails loudly when the engine refuses', async () => {
    const engine = fakeEngine();
    engine.refuse = 'no audio URL could be resolved';
    const t = createTransport(engine);
    await t.play();
    expect(t.snapshot().state).toBe('failed');
    expect(t.snapshot().problem).toMatch(/no audio/);
  });

  it('ACC-TPORT-007: refuses a second press while loading', async () => {
    // A second press during a decode is the slow path run twice.
    const engine = fakeEngine();
    const t = createTransport(engine);
    const first = t.play();
    await t.play();
    await first;
    expect(engine.starts).toHaveLength(1);
  });
});

describe('pausing', () => {
  it('ACC-TPORT-003: silences everything', async () => {
    const engine = fakeEngine();
    const t = createTransport(engine);
    await t.play();
    await t.pause();
    expect(engine.silences).toBe(1);
    expect(t.snapshot().state).toBe('paused');
  });

  it('ACC-TPORT-004: holds the moment for the next press', async () => {
    const engine = fakeEngine();
    const t = createTransport(engine);
    await t.play();
    engine.reached = 11950;
    await t.pause();
    await t.play();
    expect(engine.starts).toEqual([0, 11950]);
  });

  it('pausing what is already silent is a no-op, not an error', async () => {
    const engine = fakeEngine();
    const t = createTransport(engine);
    await t.pause();
    expect(t.snapshot().problem).toBeNull();
  });
});

describe('seeking', () => {
  it('ACC-TPORT-005: moves the head of a silent take and sounds nothing', async () => {
    const engine = fakeEngine();
    const t = createTransport(engine);
    await t.stop();
    await t.seek(7000);
    expect(t.snapshot().cueMs).toBe(7000);
    expect(engine.starts).toHaveLength(0);
  });

  it('restarts a sounding take from the new moment', async () => {
    // This engine begins at a moment rather than jumping to one.
    const engine = fakeEngine();
    const t = createTransport(engine);
    await t.play();
    await t.seek(7000);
    expect(engine.starts).toEqual([0, 7000]);
  });
});

describe('what a subscriber hears', () => {
  it('ACC-TPORT-009: a state change, and nothing per tick', async () => {
    const engine = fakeEngine();
    const t = createTransport(engine);
    await t.play();
    let told = 0;
    const stop = t.subscribe(() => (told += 1));
    // Four readings of the engine's clock, as half a take would bring.
    for (const ms of [200, 400, 600, 800]) {
      engine.reached = ms;
    }
    expect(told).toBe(0);
    await t.pause();
    expect(told).toBe(1);
    stop();
  });

  it('ACC-TPORT-006: publishes nothing that changes while playing', async () => {
    const engine = fakeEngine();
    const t = createTransport(engine);
    await t.play();
    const before = t.snapshot();
    for (const ms of [200, 400, 600, 800]) {
      engine.reached = ms;
    }
    expect(t.snapshot()).toBe(before);
  });

  it('stops telling a listener that has gone', async () => {
    const engine = fakeEngine();
    const t = createTransport(engine);
    let told = 0;
    t.subscribe(() => (told += 1))();
    await t.play();
    expect(told).toBe(0);
  });
});

describe('noticing the run end', () => {
  it('INV-TPORT-011: takes the engine word for it', async () => {
    jest.useFakeTimers();
    const engine = fakeEngine();
    let over = false;
    const t = createTransport({ ...engine, hasEnded: () => over });
    await t.play();
    expect(t.snapshot().state).toBe('playing');
    over = true;
    jest.advanceTimersByTime(200);
    expect(t.snapshot().state).toBe('stopped');
    jest.useRealTimers();
  });

  it('INV-TPORT-014: falls back to the decoded length where it cannot say', async () => {
    // A bundle newer than its binary has nothing else to go on. This is
    // what the transport did before an engine could be asked at all.
    jest.useFakeTimers();
    const t = createTransport(fakeEngine());
    await t.play();
    expect(t.snapshot().state).toBe('playing');
    jest.advanceTimersByTime(24999);
    expect(t.snapshot().state).toBe('playing');
    jest.advanceTimersByTime(2);
    expect(t.snapshot().state).toBe('stopped');
    jest.useRealTimers();
  });

  it('does not end a run that was replaced by a newer press', async () => {
    jest.useFakeTimers();
    const t = createTransport(fakeEngine());
    await t.play();
    await t.pause();
    jest.advanceTimersByTime(60000);
    // The old run's end must not reach in and stop what is there now.
    expect(t.snapshot().state).toBe('paused');
    jest.useRealTimers();
  });

  it('counts from where the run began, not from the top', async () => {
    jest.useFakeTimers();
    const t = createTransport(fakeEngine());
    await t.play(20000);
    jest.advanceTimersByTime(4999);
    expect(t.snapshot().state).toBe('playing');
    jest.advanceTimersByTime(2);
    expect(t.snapshot().state).toBe('stopped');
    jest.useRealTimers();
  });
});

describe('a press cancels the press before it', () => {
  it('ACC-TPORT-008: a stop mid-load starts nothing afterwards', async () => {
    // Play once waited out a count-in on a timer nothing could cancel,
    // so a stop silenced everything and the take started anyway.
    const engine = fakeEngine();
    const t = createTransport(engine);
    const playing = t.play();
    await t.stop();
    await playing;
    expect(t.snapshot().state).toBe('stopped');
  });
});

/**
 * A decode held open, so the window a command lands in is a place a test
 * can stand rather than a race on a device.
 *
 * `scheduled` is what the native engine would be sounding: a start that
 * lands puts one there whether or not anyone is still waiting for it,
 * and only a silence takes it away.
 */
function heldEngine(): TransportEngine & {
  starts: number[];
  scheduled: number;
  land: () => void;
} {
  const waiting: Array<() => void> = [];
  const engine = {
    starts: [] as number[],
    scheduled: 0,
    start(fromMs: number) {
      engine.starts.push(fromMs);
      return new Promise<number>((resolve) => {
        waiting.push(() => {
          engine.scheduled += 1;
          resolve(25000);
        });
      });
    },
    silence() {
      engine.scheduled = 0;
    },
    reachedMs: () => 0,
    /** Let the oldest outstanding decode finish. */
    land: () => waiting.shift()?.()
  };
  return engine;
}

/** Enough turns of the microtask queue for a settled chain to unwind. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
};

describe('a cancelled press takes its sound back', () => {
  it('ACC-TPORT-011: silences a start that lands after it was superseded', async () => {
    // The check on the run counter stopped the *state* being wrong and
    // did nothing about the audio the abandoned start had scheduled, so
    // the take went on playing under a transport that called itself
    // stopped (INV-TPORT-015).
    const engine = heldEngine();
    const t = createTransport(engine);
    void t.play();
    await t.stop();
    engine.land();
    await settle();
    expect(t.snapshot().state).toBe('stopped');
    expect(engine.scheduled).toBe(0);
  });

  it('INV-TPORT-015: decodes one at a time, so the older never lands last', async () => {
    const engine = heldEngine();
    const t = createTransport(engine);
    void t.play();
    void t.seek(7000);
    await settle();
    // The second start is not even asked for until the first is answered.
    expect(engine.starts).toEqual([0]);
    engine.land();
    await settle();
    expect(engine.starts).toEqual([0, 7000]);
  });
});

describe('a load nobody is waiting on any more', () => {
  it('ACC-TPORT-010: a seek mid-load starts again from the new moment', async () => {
    // Seek asked only whether the take was *playing*, so a seek arriving
    // mid-load moved the head, silenced the engine and left the state at
    // loading with nothing left to resolve it. The spinner never stopped
    // — not when the seek finished, not when the take ran out
    // (INV-TPORT-016).
    const engine = heldEngine();
    const t = createTransport(engine);
    void t.play();
    engine.land();
    await settle();
    expect(t.snapshot().state).toBe('playing');

    void t.seek(7000);
    await settle();
    void t.seek(9000);
    await settle();
    // Both abandoned decodes land, as they do on a device.
    engine.land();
    await settle();
    engine.land();
    await settle();

    expect(t.snapshot().state).toBe('playing');
    expect(t.snapshot().cueMs).toBe(9000);
    expect(engine.scheduled).toBe(1);
  });

  it('INV-TPORT-016: a pause mid-load stops rather than spinning', async () => {
    const engine = heldEngine();
    const t = createTransport(engine);
    void t.play();
    await t.pause();
    engine.land();
    await settle();
    expect(t.snapshot().state).toBe('stopped');
    expect(engine.scheduled).toBe(0);
  });
});
