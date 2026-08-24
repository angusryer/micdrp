/**
 * How the applied metre is drawn behind the melody.
 *
 * Its own file because the values are a relationship rather than a taste. A
 * bar's rule marks a downbeat, which is a thing that can be picked up and
 * moved; a beat's rule marks the pulse between them, which cannot. The bar has
 * to read more strongly than the beat and both have to stay under the line
 * drawn for the downbeat actually in hand (INV-NOTES-102).
 *
 * Dotted because a solid rule reads as a thing that was placed, and a dotted
 * one reads as a ruling.
 */

/** The opacity the downbeat in hand is drawn at, which the metre stays under. */
export const DOWNBEAT_OPACITY = 1;

export interface MetreLineStyle {
  opacity: number;
  /** Dash on, dash off, in pixels. */
  intervals: readonly [number, number];
}

/**
 * A bar's rule carries a downbeat, so it is drawn plainly enough to be found
 * and followed. A beat's rule is pulse underneath it and stays quiet.
 */
export function metreLineStyle(isBar: boolean): MetreLineStyle {
  return isBar
    ? { opacity: 0.5, intervals: [4, 4] }
    : { opacity: 0.25, intervals: [2, 6] };
}
