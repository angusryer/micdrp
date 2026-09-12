/**
 * The transcription: what was sung, read from the performance and corrected
 * by hand (INV-NOTES-255).
 *
 * Carries no rhythm (INV-NOTES-257). Nothing here takes a tempo, a bar, a
 * beat or a count-in, and the type of this function is the proof: it cannot
 * be handed one. The corrections exist only to make this an accurate
 * reflection of the take, and should one day be unnecessary; a
 * transcription that moved with the bars would be one whose accuracy
 * depended on a decision about grouping, which is a claim nobody made about
 * what was sung.
 *
 * Deleted notes are left out before any edit is replayed and written notes
 * merged in before it, so every index-addressed thing above sees one list
 * (INV-NOTES-248, INV-NOTES-246).
 */
import { replayNoteEdits } from '../noteEdits';
import type { NoteEvent } from '../segmentation';
import { splitOffCount } from '../sungCount';
import { withWritten, withoutDeleted } from '../writtenNotes';
import type { TranscriptionSlice } from './slices';

export interface Transcription {
  /**
   * What was heard, with written notes in and deleted notes out, before
   * any correction is replayed. The base every edit is anchored against
   * (INV-NOTES-096), and what the rhythm is read from — so correcting a
   * note cannot move a bar line out from under it (INV-NOTES-174).
   */
  heard: NoteEvent[];
  /** The melody with every correction replayed. What the screen draws. */
  notes: NoteEvent[];
  /** Notes that were a sung count rather than the tune (INV-PITCH-022). */
  counted: NoteEvent[];
  /** The tune: everything that reads harmony reads this (INV-NOTES-113). */
  played: NoteEvent[];
}

export function deriveTranscription(
  sung: readonly NoteEvent[],
  slice: TranscriptionSlice
): Transcription {
  const heard = withoutDeleted(
    withWritten(sung, slice.writtenNotes),
    slice.deletedNotes
  );
  const notes = replayNoteEdits(heard, slice.notes);
  const { counted, played } = splitOffCount(notes);
  return { heard, notes, counted, played };
}
