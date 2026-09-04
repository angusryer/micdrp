/**
 * How well a reading matches the recording it came from.
 *
 * Two numbers, because a reading fails in two ways that call for
 * different fixes. Coverage is how much of the audible singing ended up
 * inside any note at all — a detector that stops listening scores badly
 * here. Accuracy is how close the notes it did place are to the pitch
 * that was actually there — a detector that hears the wrong thing scores
 * badly here, and can score perfectly on coverage while doing it.
 */
import type { NoteEvent, PitchFrame } from './logic.ts';

export interface Score {
  notes: number;
  /** Fraction of voiced frames that fall inside some note. */
  coverage: number;
  /** Fraction of placed notes within a quartertone of the frames beneath. */
  accurate: number;
  /** Median signed error in semitones: positive means the note reads flat. */
  medianError: number;
}

const median = (xs: number[]): number => {
  if (xs.length === 0) {
    return 0;
  }
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Score a melody against the frames it was read from.
 *
 * The frames are the reference rather than a second opinion: whatever
 * they say the pitch was at a moment is what a note covering that moment
 * should have said.
 */
export function score(notes: readonly NoteEvent[], frames: readonly PitchFrame[]): Score {
  const voiced = frames.filter((f) => f.midi != null);
  const exact = (f: PitchFrame): number => (f.midi ?? 0) + (f.cents ?? 0) / 100;

  let covered = 0;
  const errors: number[] = [];
  for (const note of notes) {
    const within = voiced.filter(
      (f) => f.timestampMs >= note.startMs && f.timestampMs <= note.endMs
    );
    covered += within.length;
    if (within.length >= 3) {
      errors.push(median(within.map(exact)) - note.midi);
    }
  }

  return {
    notes: notes.length,
    coverage: voiced.length === 0 ? 0 : covered / voiced.length,
    accurate:
      errors.length === 0
        ? 0
        : errors.filter((e) => Math.abs(e) < 0.5).length / errors.length,
    medianError: median(errors)
  };
}
