/**
 * How wide a wobble counts as one note, as a thing a person can set.
 *
 * One entry of SEGMENT_KNOBS, kept behind its own name because the settings
 * screen and its tests have bound to it since before the table existed. The
 * value lives in the table; nothing is stored twice (Axiom 2).
 *
 * Voices differ more than any one default covers: an operatic vibrato is
 * several times the width of a folk singer's, and a deliberately flat
 * delivery wants the window narrow so real steps are not swallowed
 * (INV-PITCH-015).
 *
 * Kept beside the analysis rather than in the settings screen so every caller
 * reads the same value — there are three places that segment notes, and they
 * must agree about what a note is.
 */
import {
  SEGMENT_KNOBS,
  segmentValue,
  setSegmentValue,
  type SegmentKnob
} from './segmentSettings';

const KNOB = SEGMENT_KNOBS.find(
  (k) => k.key === 'vibratoSemitones'
) as SegmentKnob;

/** What the segmenter uses when nobody has said otherwise. */
export const DEFAULT_VIBRATO_SEMITONES = KNOB.fallback;

/** Narrow enough to hear a quarter-tone step; wide enough for a full one. */
export const MIN_VIBRATO_SEMITONES = KNOB.min;
export const MAX_VIBRATO_SEMITONES = KNOB.max;

/** The width to segment with. */
export function vibratoSemitones(): number {
  return segmentValue(KNOB);
}

/** Set the width. Out-of-range values are brought into range, not refused. */
export function setVibratoSemitones(value: number): number {
  return setSegmentValue(KNOB, value);
}

export { segmentOptions } from './segmentSettings';
