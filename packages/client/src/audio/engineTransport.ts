/**
 * What the engine says it is doing (INV-TPORT-010).
 *
 * Read, never pushed. The audio thread publishes a snapshot as it renders
 * and never waits for a reader; whatever wants it asks, at whatever rate
 * suits it. That is how professional audio draws a playhead sixty times a
 * second without troubling the engine sixty times, and it is the opposite
 * of what this app did before — which was remember a start moment in
 * JavaScript and compute elapsed time against a wall clock.
 *
 * That inference was right until the engine was late, suspended or short
 * of a block, and every way it could be wrong reads as the app lying
 * about what is happening.
 *
 * Absent on a binary older than this bundle, so everything here asks
 * first and falls back to what it can compute (INV-TPORT-014). A bundle
 * arriving before its binary is the normal case here, not the odd one.
 */
import NativeSynth from '../specs/NativeSynth';

export interface EngineRun {
  /** Where the run has reached, in ms of the material being played. */
  positionMs: number;
  /** Whether time is passing. False once a run has reached its end. */
  running: boolean;
  /** Which run this is. Rises on every start, so two can be told apart. */
  generation: number;
  /** Runs that ended on their own rather than being stopped. */
  ended: number;
  /**
   * Frames a streamed take could not supply in time (INV-TPORT-028).
   *
   * Rendered as silence. Counted because an underrun nobody counts is a
   * glitch nobody can reproduce.
   */
  underruns: number;
}

/** Whether this binary can be asked at all. */
export function engineReportsTransport(): boolean {
  return typeof NativeSynth?.transportReport === 'function';
}

/**
 * The run, or null where the engine cannot say.
 *
 * Null is a real answer and callers act on it: it means "compute it the
 * old way", not "nothing is playing".
 */
export function engineRun(): EngineRun | null {
  if (!engineReportsTransport()) {
    return null;
  }
  try {
    const raw = NativeSynth?.transportReport?.();
    if (raw == null) {
      return null;
    }
    return {
      positionMs: typeof raw.positionMs === 'number' ? raw.positionMs : 0,
      running: raw.running === true,
      generation: typeof raw.generation === 'number' ? raw.generation : 0,
      ended: typeof raw.ended === 'number' ? raw.ended : 0,
      underruns: typeof raw.underruns === 'number' ? raw.underruns : 0
    };
  } catch {
    // A binary that has the name but not the behaviour. Treated as one
    // that cannot say, rather than as a fault to report: the fallback is
    // exactly as correct as it was before this existed.
    return null;
  }
}

/**
 * Whether the engine says THIS run is over, or undefined where it cannot
 * say yet (INV-TPORT-038).
 *
 * `startedAfter` is the generation the engine was on when the start was
 * posted. While the report still carries it, the start is in the mailbox
 * and the report describes the run before ours — which is finished, so its
 * `running` is false about the wrong run. "Has not started" and "is over"
 * are the same word; the generation is what tells them apart.
 *
 * Here rather than in the hook, so the rule and the test of it read the
 * same function.
 */
export function hasRunEnded(
  run: EngineRun | null,
  startedAfter: number
): boolean | undefined {
  if (run == null || run.generation === startedAfter) {
    return undefined;
  }
  return !run.running;
}

/**
 * Tell the engine a run has begun, and say which run the engine was on
 * before it was told (INV-TPORT-038).
 *
 * Every command reaches the audio thread through a mailbox, so this start
 * is posted and applied later. The run's generation rises when it is
 * APPLIED. Until it does, the report still describes the previous run —
 * which is finished — and `running` is false because that one ended.
 *
 * Returning the generation as it was is what lets a caller tell the two
 * apart: while the report still carries it, this run has not begun, and
 * the engine cannot yet be asked whether it is over.
 */
export function beginEngineRun(
  fromMs: number,
  startMs: number,
  endMs: number
): number {
  const before = engineRun()?.generation ?? 0;
  NativeSynth?.startTransport?.(fromMs, startMs, endMs);
  return before;
}

/** Tell the engine the run has ended. */
export function endEngineRun(): void {
  NativeSynth?.stopTransport?.();
}
