/**
 * How the applied metre is drawn behind the melody.
 *
 * Its own file because the values are a relationship rather than a taste: the
 * metre is a guess the system made, and the downbeats drawn over it are the
 * claim a person can pick up and move. Whatever the metre is drawn at has to
 * stay quieter than that, or the lines that can be moved look like scenery and
 * the scenery looks like content (INV-NOTES-102).
 *
 * Dotted for the same reason. A solid rule reads as a thing that was placed;
 * a dotted one reads as a ruling, which is what it is.
 */

/** The opacity a downbeat is drawn at — the thing the metre stays under. */
export const DOWNBEAT_OPACITY = 1;

export interface MetreLineStyle {
  opacity: number;
  /** Dash on, dash off, in pixels. */
  intervals: readonly [number, number];
}

/**
 * A bar's rule is drawn a little stronger than a beat's — it is the coarser
 * reading and the one worth following across the take — but both stay well
 * under the downbeats.
 */
export function metreLineStyle(isBar: boolean): MetreLineStyle {
  return isBar
    ? { opacity: 0.4, intervals: [3, 5] }
    : { opacity: 0.3, intervals: [2, 6] };
}
