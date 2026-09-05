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
      ended: typeof raw.ended === 'number' ? raw.ended : 0
    };
  } catch {
    // A binary that has the name but not the behaviour. Treated as one
    // that cannot say, rather than as a fault to report: the fallback is
    // exactly as correct as it was before this existed.
    return null;
  }
}

/** Tell the engine a run has begun. A no-op where it cannot be told. */
export function beginEngineRun(
  fromMs: number,
  startMs: number,
  endMs: number
): void {
  NativeSynth?.startTransport?.(fromMs, startMs, endMs);
}

/** Tell the engine the run has ended. */
export function endEngineRun(): void {
  NativeSynth?.stopTransport?.();
}
