/**
 * When a run begins, when its audio joins it, and when it ends
 * (INV-TPORT-039).
 *
 * A run may start before the recording's first sample — inside the
 * count-in — and while it is there the head moves and the sound waits.
 * So the run's material offset may be negative, the take's voice is
 * scheduled to begin that much later on the clock, and the run ends when
 * the voice does. Pure, so the arithmetic can be pinned without an engine.
 */
export interface RunTiming {
  /** Where in the material the voice starts: never before zero. */
  offsetMs: number;
  /** How long the run waits before the audio joins it. */
  waitMs: number;
  /** When the voice begins, on the engine's clock. */
  voiceStartMs: number;
  /** When the voice ends, which is when the run ends. */
  endMs: number;
  /**
   * The moment the fallback clock counts from: position = now − anchor,
   * so at the run's first instant the position is `fromMs` itself.
   */
  anchorMs: number;
}

export function runTiming(fromMs: number, takeMs: number, beginsAtMs: number): RunTiming {
  const offsetMs = Math.min(Math.max(fromMs, 0), Math.max(0, takeMs - 1));
  const waitMs = Math.max(0, -fromMs);
  const voiceStartMs = beginsAtMs + waitMs;
  return {
    offsetMs,
    waitMs,
    voiceStartMs,
    endMs: voiceStartMs + (takeMs - offsetMs),
    anchorMs: beginsAtMs - Math.max(fromMs, -waitMs)
  };
}
