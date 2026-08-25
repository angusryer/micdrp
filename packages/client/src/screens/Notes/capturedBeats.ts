/**
 * The reading a freshly sung note opens with (INV-NOTES-137).
 *
 * A capture has no interpretation yet — nothing has been corrected, because
 * nothing has been looked at. But the beats tapped while singing are already
 * a decision about the take, and decisions live with the interpretation
 * rather than with the recording, so the note is saved with one that holds
 * them and nothing else.
 *
 * Its own module so the save pipeline does not have to know the shape of a
 * reading, and so the shape is stated once.
 */
import type { InterpretationDto } from 'shared';
import type { TappedBeat } from 'logic';

/** What the first reading of a note is called, before anyone renames it. */
const FIRST_NAME = 'As sung';

export function firstInterpretation(
  beats: readonly TappedBeat[],
  createdAtMs: number
): InterpretationDto {
  return {
    id: `sung-${createdAtMs}`,
    name: FIRST_NAME,
    createdAtMs,
    // Not frozen: this is where corrections will go, not a version kept aside.
    isFrozen: false,
    chords: [],
    beats: beats.map((beat) => ({ ...beat }))
  };
}
