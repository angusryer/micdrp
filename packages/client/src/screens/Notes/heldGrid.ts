/**
 * The grid, after everything a person has said about it (INV-NOTES-221).
 *
 * Three sources, in order of who has the last word: a tempo set by hand
 * beats one read from taps, which beats the one read from the notes
 * (INV-NOTES-123).
 *
 * The bar length is the exception, and the reason this is its own function.
 * It reached the grid only through the tempo read from the taps, and that
 * reading needs at least two of them — so a take nobody tapped could not be
 * told it was in six-eight by any route at all. Two facts wear one control:
 * how fast the pulse runs is a reading of the taps and needs them; how long
 * a bar is, is a fact about the music, and the person who sang it knows it
 * whether or not their hand was moving at the time.
 *
 * Pure, so the ordering is tested without a screen — it was written inside a
 * hook, where nothing could reach it.
 */
import type { TapPattern } from 'logic';

/** As much of a grid as this rule touches. */
export interface HeldGrid {
  bpm: number;
  offsetMs: number;
  beatsPerBar: number;
}

/** What the taps say through the pattern, or null where they say nothing. */
export interface PatternedGrid {
  bpm: number;
  offsetMs: number;
  beatsPerBar: number;
}

export function heldGrid<T extends HeldGrid>(
  read: T,
  byHandBpm: number | undefined,
  pattern: TapPattern | undefined,
  patterned: PatternedGrid | null
): T {
  // The bar length applies whatever else does, because it is not a claim
  // about the taps.
  const barred =
    pattern == null ? read : { ...read, beatsPerBar: pattern.beatsPerBar };
  if (byHandBpm != null && byHandBpm > 0) {
    return { ...barred, bpm: byHandBpm };
  }
  if (patterned != null) {
    return {
      ...barred,
      bpm: patterned.bpm,
      offsetMs: patterned.offsetMs,
      beatsPerBar: patterned.beatsPerBar
    };
  }
  return barred;
}
