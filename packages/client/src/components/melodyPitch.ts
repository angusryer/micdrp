/**
 * melodyPitch — how a pitch becomes a y coordinate.
 *
 * The counterpart to melodyScale, and split out for the same reason: one
 * module answers where a note sits vertically, so that anything drawn over
 * the melody — chord tones especially — reads against the same ruler.
 *
 * One axis is the point. Two vertical scales stacked on one screen would mean
 * the same gap between two notes measured two different distances, in a graph
 * whose whole claim is that vertical distance is pitch distance.
 */

/** The vertical mapping: `y = pad + (1 - (midi - midiLow) / range) * innerH`. */
export interface PitchAxis {
  midiLow: number;
  midiHigh: number;
  pad: number;
  innerH: number;
  /** Height of one semitone lane, in px. */
  lane: number;
}

/**
 * Pitch bounds for a melody, padded by a semitone on each side so notes never
 * sit flush against the top/bottom edge. A single-pitch (or empty) melody gets
 * a symmetric ±2-semitone window so it still renders as a centred bar.
 *
 * `alsoShow` widens the window to take in anything else being drawn on the
 * same axis — the chord tones under the line — so they cannot fall off the
 * bottom of a view scaled only to what was sung.
 */
export function pitchBounds(
  notes: readonly { midi: number }[],
  alsoShow: readonly number[] = []
): { low: number; high: number } {
  if (notes.length === 0 && alsoShow.length === 0) {
    return { low: -2, high: 2 };
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of notes) {
    if (n.midi < lo) lo = n.midi;
    if (n.midi > hi) hi = n.midi;
  }
  for (const midi of alsoShow) {
    if (midi < lo) lo = midi;
    if (midi > hi) hi = midi;
  }
  if (hi - lo < 2) {
    // Near-monotone: widen so the melody has vertical room.
    const mid = (hi + lo) / 2;
    return { low: Math.floor(mid - 2), high: Math.ceil(mid + 2) };
  }
  return { low: lo - 1, high: hi + 1 };
}

/** Where a pitch sits vertically, as the centre of its lane. */
export function yForMidi(axis: PitchAxis, midi: number): number {
  const range = Math.max(1, axis.midiHigh - axis.midiLow);
  const norm = (midi - axis.midiLow) / range;
  return axis.pad + (1 - norm) * axis.innerH;
}

/** The pitch a y coordinate falls on, rounded to the nearest semitone. */
export function midiForY(axis: PitchAxis, y: number): number {
  const range = Math.max(1, axis.midiHigh - axis.midiLow);
  const norm = 1 - (y - axis.pad) / axis.innerH;
  return Math.round(axis.midiLow + norm * range);
}
