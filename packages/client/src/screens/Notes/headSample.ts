/**
 * One reading of where the run is, and the frame that dates it.
 *
 * Two shared values written one after the other tore: a frame landing
 * between them computed the new moment plus the time since the *old*
 * stamp, which is a jump forward of the whole sample interval and a
 * snap back on the next frame (INV-TPORT-021). One object, written
 * once, cannot be seen half-applied.
 *
 * Its own module because the reader is an animated style on the UI
 * thread, and anything it calls has to be a worklet of its own
 * (INV-TPORT-009).
 */

export interface HeadSample {
  /** Where the run had reached when this was read, in ms of the take. */
  atMs: number;
  /**
   * The frame clock reading this was stamped at, or -1 before any frame
   * has dated it. Cleared rather than set by the reader, because only
   * the UI thread's own clock may date it.
   */
  frameMs: number;
}

/** A fresh reading, waiting for a frame to date it. */
export function readingAt(atMs: number): HeadSample {
  'worklet';
  return { atMs, frameMs: -1 };
}

/**
 * Where to draw the head this frame, given the last reading.
 *
 * Frame time carries it between readings; each reading puts it back
 * where the engine says it is. Free-running on frame time alone would
 * be a wall clock again, dressed differently (INV-TPORT-010).
 */
export function drawnAt(sample: HeadSample, frameMs: number): number {
  'worklet';
  return sample.frameMs < 0 ? sample.atMs : sample.atMs + (frameMs - sample.frameMs);
}
