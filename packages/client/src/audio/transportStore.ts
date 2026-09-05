/**
 * The one thing that knows what is sounding (INV-TPORT-001).
 *
 * A store, not a hook. Commands go in, a subscription comes out, and no
 * React appears anywhere in it — which is what lets the whole model be
 * tested without a renderer, a device or a sound. The hooks above are a
 * binding, and a thin one.
 *
 * Three rules shape it, and all three are days already spent.
 *
 * What changes every frame never crosses into React (INV-TPORT-002).
 * The moment lives on the head and is never published; subscribers hear
 * about state, which changes rarely. The position used to tick upward
 * as React state twice a second and re-render a canvas that cost more
 * than the interval, so the JS thread never went idle and a press had
 * nowhere to be handled.
 *
 * A refused command is an error, never silence (INV-TPORT-006). Every
 * fault in this history presented as nothing happening, and outside is
 * where the only person using this stands.
 *
 * A cancelled press takes its sound back with it (INV-TPORT-015), and
 * never leaves the state at loading with no start on its way
 * (INV-TPORT-016). Checking the run counter after the await was enough
 * to stop the state being wrong and did nothing about the audio the
 * abandoned start had already scheduled.
 */
import {
  accepts,
  nextState,
  type CommandKind,
  type TransportState
} from './transportState';
import { createRunWatch, type RunEndEngine } from './runWatch';

/** What a subscriber is told. Never the moment (INV-TPORT-002). */
export interface TransportSnapshot {
  state: TransportState;
  /** Why the last command failed, or null. */
  problem: string | null;
  /** Where a run would start from, in ms. Moves rarely; a seek is an act. */
  cueMs: number;
}

/** What the store needs of an engine. Kept small so a fake is honest. */
export interface TransportEngine extends RunEndEngine {
  /** Resolve, decode and schedule from a moment. Resolves with the length. */
  start(fromMs: number): Promise<number>;
  /** Silence everything. Not one bus (INV-TPORT-005). */
  silence(): void;
  /** Where the engine says the run has reached, in ms. */
  reachedMs(): number;
}

export interface Transport {
  snapshot(): TransportSnapshot;
  subscribe(listener: () => void): () => void;
  play(atMs?: number): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(atMs: number): Promise<void>;
}

export function createTransport(engine: TransportEngine): Transport {
  let snapshot: TransportSnapshot = {
    state: 'idle',
    problem: null,
    cueMs: 0
  };
  const listeners = new Set<() => void>();
  const runEnd = createRunWatch(engine);

  /**
   * Which press is the current one (INV-TPORT-008).
   *
   * Anything resuming after an await checks this and stops if it is no
   * longer current. A play once waited out a count-in on a timer nothing
   * could cancel, so a stop silenced everything, set the state to
   * stopped, and then started the take anyway.
   */
  let run = 0;
  /** The start a run is waiting on, so only ever one is (INV-TPORT-015). */
  let inFlight: Promise<number> | null = null;

  const publish = (next: Partial<TransportSnapshot>): void => {
    snapshot = { ...snapshot, ...next };
    for (const listener of listeners) {
      listener();
    }
  };

  /**
   * Begin a run, and answer for the sound it schedules.
   *
   * A start already on its way still reaches the engine and still
   * schedules audio; cancelling the press it belonged to does nothing
   * about that. So the start silences itself where its press is no
   * longer the current one, which is why the take used to go on playing
   * under a transport that had already called itself stopped
   * (INV-TPORT-015).
   */
  const begin = (mine: number, fromMs: number): Promise<number> => {
    const starting = engine.start(fromMs);
    void starting.then(
      () => {
        if (mine !== run) {
          engine.silence();
        }
      },
      () => undefined
    );
    return starting;
  };

  const play = async (mine: number, atMs?: number): Promise<void> => {
    const from = atMs ?? snapshot.cueMs;
    publish({ state: 'loading', problem: null, cueMs: from });
    // One decode at a time. Two in flight land in either order, and the
    // one that lands second is the one left sounding.
    if (inFlight != null) {
      await inFlight.catch(() => undefined);
      if (mine !== run) {
        return;
      }
    }
    const starting = (inFlight = begin(mine, from));
    let length = 0;
    try {
      length = await starting;
    } catch (error) {
      // Said out loud. A command the engine would not take must never
      // read as a control that did nothing (INV-TPORT-006).
      if (mine === run) {
        publish({
          state: 'failed',
          problem: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    } finally {
      if (inFlight === starting) {
        inFlight = null;
      }
    }
    // Stopped, seeked, or pressed again while the take was being decoded.
    // `begin` has taken the sound back; the state belongs to whoever
    // superseded this press.
    if (mine !== run) {
      return;
    }
    publish({ state: 'playing' });
    runEnd.watch(length, from, () => {
      if (mine === run) {
        publish({ state: 'stopped' });
      }
    });
  };

  const command = async (kind: CommandKind, atMs?: number): Promise<void> => {
    if (!accepts(snapshot.state, kind)) {
      return;
    }
    const mine = (run += 1);
    runEnd.cancel();
    // Loading counts as running: a start is on its way, and the command
    // that cancels it owes the head a run or a stop (INV-TPORT-016).
    const wasRunning =
      snapshot.state === 'playing' || snapshot.state === 'loading';

    if (kind === 'play') {
      await play(mine, atMs);
      return;
    }

    // Everything else silences first and asks questions after. Silence
    // must not be contingent on bookkeeping being right about which bus
    // a voice went to (INV-TPORT-005).
    const reached =
      snapshot.state === 'playing' ? engine.reachedMs() : snapshot.cueMs;
    engine.silence();

    if (kind === 'pause') {
      publish({ state: nextState(snapshot.state, 'pause'), cueMs: reached });
      return;
    }
    if (kind === 'stop') {
      publish({ state: 'stopped' });
      return;
    }
    // Seek. The head moves whether or not anything was sounding, and a
    // take that was running starts again from there — this engine begins
    // at a moment rather than jumping to one (INV-TPORT-007). A take
    // still loading was running: it is cancelled here and started again
    // below, rather than left at loading forever (INV-TPORT-016).
    const to = Math.max(0, atMs ?? 0);
    publish({ state: wasRunning ? 'stopped' : snapshot.state, cueMs: to });
    if (wasRunning) {
      await command('play', to);
    }
  };

  return {
    snapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play: (atMs) => command('play', atMs),
    pause: () => command('pause'),
    stop: () => command('stop'),
    seek: (atMs) => command('seek', atMs)
  };
}
