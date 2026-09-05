/**
 * Where the head is drawn, between readings of the engine's clock.
 *
 * Two rules, and both are days already spent.
 *
 * The reading and the frame that dates it are one value, written once. As
 * two shared values written one after the other they tore: a frame landing
 * between the writes drew the new moment measured against the old stamp —
 * a jump forward of the whole interval and a snap back on the next frame
 * (INV-TPORT-021).
 *
 * And a reading is converged on rather than jumped to (INV-TPORT-029). It
 * is always late: taken on the JS thread, so by the time it reaches the UI
 * thread it is stale by a render block plus whatever that thread was busy
 * with, while frame time has carried the head forward at exactly the right
 * rate. Moving the head to it made the head flick backwards and climb
 * again, five times a second, and made the JS thread's lag visible as a
 * defect in the drawing. No transport draws a playhead this way: a late
 * reading is a correction to apply, not a position to obey.
 *
 * Its own module because the reader is an animated style on the UI thread,
 * and anything it calls has to be a worklet of its own (INV-TPORT-009).
 */

/**
 * How long an error takes to pay off, in ms.
 *
 * The sampling interval. Slower and two corrections overlap; faster and the
 * correction is itself a visible movement.
 */
export const CORRECT_MS = 200;

export interface HeadSample {
  /** Where the engine said the run had reached, in ms of the take. */
  atMs: number;
  /** The frame clock reading this was folded in at. */
  frameMs: number;
  /**
   * How far ahead of `atMs` the head already was when this arrived.
   *
   * Paid off over `CORRECT_MS` rather than in one frame, which is what
   * makes the head continuous across a reading (INV-TPORT-029).
   */
  errorMs: number;
  /** Which reading this was folded from, so a new one is noticed once. */
  seq: number;
}

/** What the JS thread publishes: a reading, and which one it is. */
export interface HeadReading {
  atMs: number;
  /** Rises on every reading, so the UI thread can tell a new one apart. */
  seq: number;
}

/** The state a head starts in, before anything has been read. */
export function firstSample(atMs: number): HeadSample {
  'worklet';
  return { atMs, frameMs: -1, errorMs: 0, seq: 0 };
}

/**
 * Fold a new reading in without moving the head.
 *
 * `drawnMs` is where the head is right now. The difference between that and
 * what the engine says becomes the error, so this frame draws exactly where
 * the last one did and the following ones close the gap.
 */
export function fold(
  reading: HeadReading,
  drawnMs: number,
  frameMs: number
): HeadSample {
  'worklet';
  return {
    atMs: reading.atMs,
    frameMs,
    errorMs: drawnMs - reading.atMs,
    seq: reading.seq
  };
}

/**
 * Where to draw the head this frame.
 *
 * Frame time carries it forward from the reading; the error decays linearly
 * to nothing across `CORRECT_MS`. At the moment a reading is folded in the
 * error is the whole disagreement, so the head does not move; by the next
 * reading it is gone, so the head is where the engine says.
 */
export function drawnAt(sample: HeadSample, frameMs: number): number {
  'worklet';
  if (sample.frameMs < 0) {
    return sample.atMs;
  }
  const elapsed = frameMs - sample.frameMs;
  const left = 1 - elapsed / CORRECT_MS;
  const remaining = left > 0 ? left : 0;
  return sample.atMs + elapsed + sample.errorMs * remaining;
}
