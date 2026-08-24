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

/**
 * Where the singing starts, against the pickup before it (INV-NOTES-080).
 *
 * Content rather than a ruling — it marks a boundary in the recording, not a
 * beat in the music — so it reads above the rules. It used to sit at exactly a
 * bar rule's strength, which made a thing the app is telling you look like a
 * thing the app is measuring by.
 */
export const BOUNDARY_OPACITY = 0.7;

export interface MetreLineStyle {
  opacity: number;
  /** Dash on, dash off, in pixels. */
  intervals: number[];
}

/**
 * A bar's rule carries a downbeat, so it is drawn plainly enough to be found
 * and followed.
 *
 * Frozen and taken once rather than built per line: these are read for every
 * rule on the graph, on every frame of a zoom.
 */
export const BAR_RULE: MetreLineStyle = Object.freeze({
  opacity: 0.5,
  intervals: [4, 4]
});

/** A beat's rule is the pulse underneath the bars, and stays quiet. */
export const BEAT_RULE: MetreLineStyle = Object.freeze({
  opacity: 0.25,
  intervals: [2, 6]
});

/** The rule for a line, by whether it carries a downbeat. */
export function metreLineStyle(isBar: boolean): MetreLineStyle {
  return isBar ? BAR_RULE : BEAT_RULE;
}
