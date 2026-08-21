/**
 * Where a readout sits while a finger is dragging something.
 *
 * Borrowed from the text-selection loupe: it appears above the finger and to
 * one side, never underneath it, because a person cannot judge a placement
 * they are covering with their own hand (INV-NOTES-025).
 *
 * Pure math, so the awkward part — what happens near an edge — is testable
 * without a screen.
 */

export interface LoupePlacement {
  x: number;
  y: number;
  /** Which side of the finger it ended up on, for pointing an arrow at it. */
  side: 'left' | 'right';
}

export interface LoupeBounds {
  /** The area it must stay inside, usually the screen or the graph. */
  width: number;
  height: number;
  /**
   * The highest the readout may rise, in the surface's own coordinates.
   * Negative when the surface is too short to hold the readout clear of
   * the finger and nothing above it clips: the readout overhangs the
   * surface rather than settling level with the thumb (INV-NOTES-025).
   */
  top?: number;
}

export interface LoupeOptions {
  loupeWidth: number;
  loupeHeight: number;
  /** Gap between the finger and the readout, in px. */
  offset?: number;
}

/** Enough that a fingertip does not overlap the readout's lower edge. */
export const LOUPE_OFFSET = 56;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/**
 * Place the readout for a touch.
 *
 * It prefers up and to the right, which suits a right hand. Near the right
 * edge it flips to the left rather than sliding off; near the top it drops
 * below the finger, because a readout half off the screen is no more useful
 * than one under a thumb.
 */
export function placeLoupe(
  touchX: number,
  touchY: number,
  bounds: LoupeBounds,
  options: LoupeOptions
): LoupePlacement {
  const { loupeWidth, loupeHeight } = options;
  const offset = options.offset ?? LOUPE_OFFSET;
  const top = bounds.top ?? 0;

  // Sideways: prefer the right of the finger, flip when that would not fit.
  const wantRight = touchX + offset / 2 + loupeWidth <= bounds.width;
  const side: 'left' | 'right' = wantRight ? 'right' : 'left';
  const rawX = wantRight
    ? touchX + offset / 2
    : touchX - offset / 2 - loupeWidth;

  // Vertically: above by default, below when there is no room above. Either
  // way it clears the finger by the full offset. "Room above" is measured
  // against bounds.top, which a short surface sets negative so the readout
  // can overhang it instead of dropping onto the thumb.
  const above = touchY - offset - loupeHeight;
  const rawY = above >= top ? above : touchY + offset;

  return {
    x: clamp(rawX, 0, Math.max(0, bounds.width - loupeWidth)),
    y: clamp(rawY, top, Math.max(top, bounds.height - loupeHeight)),
    side
  };
}

/**
 * Whether a placement actually clears the finger.
 *
 * The property the whole thing exists for, exposed so a test can assert it
 * rather than eyeball it.
 */
export function coversTouch(
  placement: LoupePlacement,
  touchX: number,
  touchY: number,
  options: LoupeOptions
): boolean {
  return (
    touchX >= placement.x &&
    touchX <= placement.x + options.loupeWidth &&
    touchY >= placement.y &&
    touchY <= placement.y + options.loupeHeight
  );
}
