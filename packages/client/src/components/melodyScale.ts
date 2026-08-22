/**
 * melodyScale — how a moment becomes an x coordinate.
 *
 * Split from melodyLayout because it is a separate question from where each
 * note sits: this decides the scale, that places things at it. Everything
 * that converts between time and pixels goes through the `TimeAxis` produced
 * here, so a gesture cannot drift from the drawing (INV-NOTES-034).
 */
import type { MelodyGrid } from './melodyGrid';

/** Beat width when nothing else is asked for: a bar of 4 is a comfortable grab. */
export const DEFAULT_BEAT_WIDTH = 48;

/**
 * Below this a beat is not a unit any more, it is a hairline.
 *
 * Deliberately under `MIN_LEGIBLE_BEAT_PX`, so that zooming all the way out
 * passes the point where beat rules stop being readable and leaves bar lines
 * alone on the screen. That bar-only view is the one worth having over a long
 * take, and a floor above the thinning threshold would make it unreachable.
 */
export const MIN_BEAT_WIDTH = 6;

/**
 * How time maps onto the x axis, so a caller can turn a touch back into a
 * moment. Exposed rather than recomputed: a drag that used a slightly
 * different mapping from the one that drew the notes would land beside them
 * rather than on them (INV-NOTES-034).
 */
export interface TimeAxis {
  /** Time of the leftmost edge of the drawing, in ms. */
  t0: number;
  /** Musical duration drawn, in ms. */
  span: number;
  pad: number;
  /** Inner width of the viewport (not of the drawing). */
  innerW: number;
  /** The mapping itself: `x = pad + (t - t0) * pxPerMs`. */
  pxPerMs: number;
}

/** What the scale needs to know about the caller's request. */
export interface ScaleRequest {
  /** The viewport, not the drawing: content may be wider. */
  width: number;
  grid?: MelodyGrid;
  /** Pixels per beat. Given (with a usable grid), the scale is fixed. */
  beatWidth?: number;
}

/**
 * A bar must never grow so wide that none of it fits, or zooming in would
 * leave the singer somewhere with no landmarks (INV-NOTES-033). One bar
 * filling the viewport is the limit.
 */
export function clampBeatWidth(
  desired: number,
  viewportWidth: number,
  beatsPerBar: number
): number {
  const bars = beatsPerBar > 0 ? beatsPerBar : 4;
  const maxWidth = Math.max(MIN_BEAT_WIDTH, viewportWidth / bars);
  return Math.min(maxWidth, Math.max(MIN_BEAT_WIDTH, desired));
}

/** The sung span, or a unit span when nothing was sung. */
export function timeBounds(
  notes: readonly { startMs: number; endMs: number }[]
): { t0: number; span: number } {
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const n of notes) {
    if (n.startMs < t0) t0 = n.startMs;
    if (n.endMs > t1) t1 = n.endMs;
  }
  return {
    t0: notes.length > 0 ? t0 : 0,
    span: notes.length > 0 ? Math.max(1, t1 - t0) : 1
  };
}

/**
 * Pixels per millisecond, and the resulting drawing width.
 *
 * Fixed scale needs a tempo to know what a beat is worth, so a `beatWidth`
 * without a usable grid falls back to fitting rather than guessing one.
 */
export function resolveScale(
  request: ScaleRequest,
  span: number,
  innerW: number,
  pad: number
): { pxPerMs: number; contentWidth: number } {
  const beatMs = request.grid ? 60000 / request.grid.bpm : NaN;
  const fixed =
    request.beatWidth !== undefined &&
    request.beatWidth > 0 &&
    Number.isFinite(beatMs) &&
    beatMs > 0;

  if (!fixed) {
    return { pxPerMs: innerW / span, contentWidth: request.width };
  }
  const pxPerMs = (request.beatWidth as number) / beatMs;
  // Never narrower than the viewport, so a short take still fills the space
  // it was given rather than huddling at the left edge.
  return {
    pxPerMs,
    contentWidth: Math.max(request.width, span * pxPerMs + 2 * pad)
  };
}
