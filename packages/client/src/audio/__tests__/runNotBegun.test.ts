/**
 * ACC-TPORT-034 / ACC-TPORT-035 — INV-TPORT-038.
 *
 * "It doesn't play, it basically just plays for a quarter-second, the
 * scrolling happens for a quarter second and then it stops." Every take,
 * every press.
 *
 * Every command reaches the audio thread through a mailbox, so a start is
 * posted and applied later — the run's generation rises when it is APPLIED.
 * Between the two, the report still describes the previous run, which is
 * finished, and `running` is false because THAT run ended.
 *
 * Read without checking which run it describes, that false ends the new run
 * at the first watch tick. The two states share a word: "has not started"
 * and "is over" both say running is false, and only the generation tells
 * them apart.
 */
import { hasRunEnded } from '../engineTransport';
import { createRunWatch } from '../runWatch';

/** One watch tick, from runWatch's own constant. */
const TICK_MS = 100;

/** A report, as the seqlock hands one over. */
const report = (generation: number, running: boolean) => ({
  positionMs: 0,
  running,
  generation,
  ended: 0,
  underruns: 0
});

/**
 * The reader as `useTakeEngine` builds it — the real rule, not a copy of
 * it. A test that restates the logic passes whether or not the app shares
 * it, which is the failure this whole session kept meeting.
 */
const askedThrough = (
  startedAfter: number,
  run: ReturnType<typeof report> | null
) => ({
  hasEnded: (): boolean | undefined => hasRunEnded(run, startedAfter)
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('ACC-TPORT-034: a start still in the mailbox', () => {
  it('cannot say whether the run is over', () => {
    // The previous run, generation 7, finished. Ours was posted after it
    // and has not been applied, so the report is still about that one.
    expect(askedThrough(7, report(7, false)).hasEnded()).toBeUndefined();
  });

  it('so the run is watched by its length, not by that answer', () => {
    const ended = jest.fn();
    createRunWatch(askedThrough(7, report(7, false))).watch(5000, 0, ended);

    jest.advanceTimersByTime(TICK_MS * 4);
    expect(ended).not.toHaveBeenCalled();

    jest.advanceTimersByTime(5000);
    expect(ended).toHaveBeenCalled();
  });

  it('is not confused by an engine that has never run', () => {
    // Generation 0 with nothing started yet must not read as "still the
    // run before ours" — there was no run before ours.
    expect(askedThrough(-1, report(0, false)).hasEnded()).toBe(true);
  });
});

describe('ACC-TPORT-035: once the engine has taken the start', () => {
  it('its word counts, and a finished run stops', () => {
    expect(askedThrough(7, report(8, false)).hasEnded()).toBe(true);
  });

  it('and a running one keeps going', () => {
    expect(askedThrough(7, report(8, true)).hasEnded()).toBe(false);
  });

  it('ends the run at a tick rather than at the decoded length', () => {
    const ended = jest.fn();
    createRunWatch(askedThrough(7, report(8, false))).watch(5000, 0, ended);

    jest.advanceTimersByTime(TICK_MS);
    expect(ended).toHaveBeenCalled();
  });

  it('does not end one the engine says is still running', () => {
    const ended = jest.fn();
    createRunWatch(askedThrough(7, report(8, true))).watch(5000, 0, ended);

    jest.advanceTimersByTime(TICK_MS * 10);
    expect(ended).not.toHaveBeenCalled();
  });
});

describe('what the fault looked like', () => {
  it('the run died one tick in, on every press', () => {
    // Without the generation check the report reads as "ended" — this is
    // the behaviour being fixed, written down so it cannot come back.
    const stale = report(7, false);
    const unchecked = { hasEnded: () => !stale.running };

    const ended = jest.fn();
    createRunWatch(unchecked).watch(60_000, 0, ended);
    jest.advanceTimersByTime(TICK_MS);

    expect(ended).toHaveBeenCalled();
  });
});
