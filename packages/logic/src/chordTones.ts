/**
 * chordTones — what notes each chord quality is made of.
 *
 * Extracted from harmony so the voicing layer can index the same tones the
 * voicer uses. Two lists of chord intervals would drift the first time a
 * quality was added, and a voicing indexed against the wrong one would move
 * a note the singer did not touch.
 */
import type { ChordQuality } from './analysis';

/** Semitone offsets from the root for each supported quality. */
export const CHORD_TONES: Record<ChordQuality, readonly number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9]
};

export type { ChordQuality };
