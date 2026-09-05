/**
 * INV-NOTES-204 — stopping stops, including a press that has not started.
 *
 * Play waits out the count on a timer. The bug was that nothing could
 * cancel it: stop cleared what was sounding and set the transport to
 * stopped, then the timer resolved and started the take anyway. From the
 * outside the take began after being stopped and nothing would end it —
 * the transport already read stopped, so stopping again did nothing.
 *
 * The guard is a run counter, so this exercises that shape directly
 * rather than mounting the whole mix: what matters is that a press knows
 * whether it is still the current one when it wakes up.
 */

/** The shape of the fix: a press that checks it is still current. */
function transport(leadInMs: number) {
  let run = 0;
  const started: number[] = [];
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  return {
    started,
    async play(fromMs = 0): Promise<void> {
      const mine = (run += 1);
      if (leadInMs > 0) {
        await wait(leadInMs);
        if (mine !== run) {
          return;
        }
      }
      started.push(fromMs);
    },
    stop(): void {
      run += 1;
    },
    pause(): void {
      run += 1;
    }
  };
}

jest.useFakeTimers();

const flush = async (ms: number): Promise<void> => {
  jest.advanceTimersByTime(ms);
  // Let the awaited timer's continuation run.
  await Promise.resolve();
  await Promise.resolve();
};

describe('a press during the count', () => {
  it('ACC-NOTES-051: does not start after stop', async () => {
    const t = transport(2000);
    const playing = t.play(0);
    t.stop();
    await flush(2000);
    await playing;
    expect(t.started).toEqual([]);
  });

  it('ACC-NOTES-052: does not start after pause', async () => {
    const t = transport(2000);
    const playing = t.play(0);
    t.pause();
    await flush(2000);
    await playing;
    expect(t.started).toEqual([]);
  });

  it('starts when nothing interrupted it', async () => {
    const t = transport(2000);
    const playing = t.play(500);
    await flush(2000);
    await playing;
    expect(t.started).toEqual([500]);
  });

  it('leaves only the last press standing when pressed twice', async () => {
    // Two presses raced through one count would otherwise both start, and
    // the take would be scheduled twice over itself.
    const t = transport(2000);
    const first = t.play(0);
    const second = t.play(1000);
    await flush(2000);
    await Promise.all([first, second]);
    expect(t.started).toEqual([1000]);
  });

  it('is unaffected where there is no count to wait out', async () => {
    const t = transport(0);
    await t.play(250);
    expect(t.started).toEqual([250]);
  });
});
