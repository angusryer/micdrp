/**
 * How the view is led to the head (INV-TPORT-032).
 *
 * The view used to be placed by the moment alone, with no memory of where it
 * had been — so pressing play after dragging the head snapped it, and from a
 * moment inside the opening seconds snapped it back to the top of the take. A
 * jump is the one thing the eye cannot follow, and the singer had just been
 * looking at that exact place.
 *
 * Forwards only, at a bounded speed, is what makes both cases one rule. With
 * the head behind the middle the view holds still and the head walks in to
 * meet it, exactly as it does from the start of a take. With the head past the
 * middle the view runs forward faster than the take until it catches up. One
 * line, two behaviours, neither of them a jump.
 *
 * Its own module because the caller is an animated reaction on the UI thread,
 * and anything it calls has to be a worklet of its own (INV-TPORT-009).
 */

/**
 * The fastest the view may catch up, as a fraction of the window per second.
 *
 * One window a second: quick enough that a drag to the far side of the take
 * does not feel like waiting, slow enough that the eye keeps hold of what is
 * passing. Independent of zoom on purpose — how fast the drawing may move is
 * a fact about watching it, not about how much of the take it shows.
 */
export const CATCH_UP_PER_SECOND = 1;

/**
 * Where the view should sit this frame.
 *
 * `wanted` is where centring the head would put it, `current` is where the
 * view is, and `elapsedMs` is the frame time since the last move. Returns
 * `current` unchanged when the head is behind the middle, because the view
 * waiting is what lets the head walk in.
 */
export function ledTowards(
  current: number,
  wanted: number,
  elapsedMs: number,
  viewportWidth: number
): number {
  'worklet';
  if (wanted <= current) {
    // Behind the middle. Holding still is not doing nothing: as the take
    // runs on, `wanted` rises to meet `current`, and the head reaches the
    // middle at the moment the two agree.
    return current;
  }
  const step = (viewportWidth * CATCH_UP_PER_SECOND * elapsedMs) / 1000;
  const next = current + step;
  return next > wanted ? wanted : next;
}

/**
 * How wide the band at each edge is, in px.
 *
 * About a thumb. Wide enough to reach without aiming, narrow enough that
 * the middle of the window — where the head is usually placed — is still
 * somewhere a finger can rest without the drawing sliding away.
 */
export const EDGE_PX = 56;

/**
 * The fastest an edge drag scrolls, as a fraction of the window per second.
 *
 * At the very edge. It eases in from nothing at the inner boundary of the
 * band, so the drawing starts moving gently rather than leaping the moment
 * a finger crosses a line.
 */
export const EDGE_PER_SECOND = 1.2;

/**
 * How fast the view should scroll for a finger at `x` in the window.
 *
 * Positive to the right, negative to the left, zero away from both edges.
 * In px per millisecond, so a caller multiplies by frame time.
 *
 * Placing the head outside the window used to mean dragging it, letting
 * go, scrolling the drawing, taking hold again, and repeating — several
 * gestures for one intention (INV-TPORT-033).
 */
export function edgeScrollPxPerMs(x: number, viewportWidth: number): number {
  'worklet';
  const third = viewportWidth / 3;
  const band = EDGE_PX < third ? EDGE_PX : third;
  const full = (viewportWidth * EDGE_PER_SECOND) / 1000;
  if (x < band) {
    // Eased by how far into the band the finger is, so crossing the line
    // is not a step change in speed.
    const into = (band - x) / band;
    return -full * (into > 1 ? 1 : into);
  }
  const fromRight = viewportWidth - x;
  if (fromRight < band) {
    const into = (band - fromRight) / band;
    return full * (into > 1 ? 1 : into);
  }
  return 0;
}
