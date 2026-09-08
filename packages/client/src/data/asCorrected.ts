/**
 * A kept take, as the person has corrected it (INV-NOTES-228).
 *
 * The detector's reading is what the app heard; the corrections are what the
 * singer says was actually sung. Everywhere a take is described from the
 * outside — the card in the list, the analysis of the open note — it is the
 * second that is being asked about.
 *
 * One derivation rather than one per screen, so the card and the open note
 * can never disagree about the same take. The open note replays the same
 * edits against its own live copy while they are being made; this is the
 * kept answer, which is all a list has.
 */
import { replayNoteEdits, type NoteEvent } from 'logic';
import { activeInterpretation } from 'shared';

import { notesSummary, type NotesSummary } from '../analysis/summary';
import type { NoteMeta } from './notesCache';

/** What is described, of a cached note. */
export interface CorrectableTake {
  melody: NoteMeta['melody'];
  interpretations?: NoteMeta['interpretations'];
}

/** The melody with the corrections kept for it replayed over the top. */
export function correctedMelody(note: CorrectableTake): NoteEvent[] {
  const kept = activeInterpretation(note.interpretations ?? [])?.notes ?? [];
  return replayNoteEdits(note.melody, kept);
}

/**
 * What the take measures out to once the corrections are in.
 *
 * Only what the notes themselves say. Steadiness and the mean error are
 * measured against the recording, and a correction does not change the
 * recording — it says the detector misheard it, which is put right by
 * reading the take again (INV-NOTES-195).
 */
export function correctedSummary(note: CorrectableTake): NotesSummary {
  return notesSummary(correctedMelody(note));
}
