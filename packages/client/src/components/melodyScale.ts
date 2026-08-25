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

/**
 * Where a moment sits on the drawing.
 *
 * One implementation of the axis's own mapping. It was written out by hand
 * wherever it was needed, and two copies of a mapping put whatever one of
 * them draws beside whatever the other one touches (INV-NOTES-034).
 */
export function xForMs(axis: TimeAxis, timeMs: number): number {
  return axis.pad + (timeMs - axis.t0) * axis.pxPerMs;
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
/**
 * The moment at a pixel — the inverse of {@link xForMs}.
 *
 * Beside it rather than worked out at the call site, so a thing dragged to a
 * position and a thing drawn at one are using one mapping read both ways
 * (INV-NOTES-104).
 */
export function msForX(axis: TimeAxis, x: number): number {
  return axis.pxPerMs > 0
    ? axis.t0 + (x - axis.pad) / axis.pxPerMs
    : axis.t0;
}

export function clampBeatWidth(
  desired: number,
  viewportWidth: number,
  beatsPerBar: number,
  floor: number = MIN_BEAT_WIDTH
): number {
  const bars = beatsPerBar > 0 ? beatsPerBar : 4;
  // Never below what shows the whole take, and never so wide that a bar has
  // left the screen entirely.
  const low = Math.max(MIN_BEAT_WIDTH, floor);
  const high = Math.max(low, viewportWidth / bars);
  return Math.min(high, Math.max(low, desired));
}

/**
 * Where to scroll so that the moment under `focalX` is still under it after
 * the scale changes by `ratio`.
 *
 * The focal point is the midpoint between the two fingers of a pinch
 * (INV-NOTES-043). Anchoring anywhere else means the take slides under the
 * fingers doing the pinching, so the thing being looked at is the thing that
 * moves away. Never negative: there is nothing left of the first note to
 * scroll to.
 */
export function anchorZoom(
  scrollX: number,
  focalX: number,
  pad: number,
  ratio: number
): number {
  const focalFromPad = scrollX + focalX - pad;
  return Math.max(0, pad + focalFromPad * ratio - focalX);
}

/**
 * The widest a beat may be drawn and still leave the whole take on screen.
 *
 * This is the floor for zooming out (INV-NOTES-044): past the whole take
 * there is nothing further to see, only the take getting smaller in the
 * middle of an empty screen. Derived per take rather than fixed, because
 * "everything at once" means something different for eight bars than for two
 * minutes.
 */
export function beatWidthShowingAll(
  span: number,
  innerW: number,
  beatMs: number
): number {
  if (!(span > 0) || !(beatMs > 0)) {
    return MIN_BEAT_WIDTH;
  }
  return (innerW / span) * beatMs;
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
