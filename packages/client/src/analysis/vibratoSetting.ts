/**
 * How wide a wobble counts as one note, as a thing a person can set.
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
import { getJSON, setJSON } from '../data/store';

const KEY = 'analysis.vibratoSemitones';

/** What the segmenter uses when nobody has said otherwise. */
export const DEFAULT_VIBRATO_SEMITONES = 0.6;

/** Narrow enough to hear a quarter-tone step; wide enough for a full one. */
export const MIN_VIBRATO_SEMITONES = 0.15;
export const MAX_VIBRATO_SEMITONES = 1.2;

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_VIBRATO_SEMITONES;
  }
  return Math.min(Math.max(value, MIN_VIBRATO_SEMITONES), MAX_VIBRATO_SEMITONES);
}

/** The width to segment with. */
export function vibratoSemitones(): number {
  const stored = getJSON<number>(KEY);
  return typeof stored === 'number' ? clamp(stored) : DEFAULT_VIBRATO_SEMITONES;
}

/** Set the width. Out-of-range values are brought into range, not refused. */
export function setVibratoSemitones(value: number): number {
  const next = clamp(value);
  setJSON(KEY, next);
  return next;
}

/** Options every caller of segmentNotes should pass, so they all agree. */
export function segmentOptions(): { vibratoSemitones: number } {
  return { vibratoSemitones: vibratoSemitones() };
}
