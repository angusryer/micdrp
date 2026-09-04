/**
 * Capture analysis for the Notes module.
 *
 * Turns a finished {@link RecordingHandle} into the descriptive fields a note
 * persists — the symbolic melody (source of truth for all corpus analysis) plus
 * the reframed self-analysis (key, tempo, range, intonation steadiness). This is
 * NOT a grade: there is no headline score. The heavy DSP already ran natively at
 * capture; this is a single cheap symbolic pass over `handle.samples`, off the
 * live audio path.
 *
 *   readMelody → { melody, hits } → takeSummary → { key, tempo, range, … }
 *
 * The reading itself is `readMelody`, which every path in the app shares
 * (INV-PITCH-028); what is left here is what a *note* needs on top of it.
 */
import { smoothPitch, ANALYSIS_VERSION, type Hit, type NoteEvent } from 'logic';
import type { CreateNoteInput } from 'shared';

import type { RecordingHandle } from '../audio/contract';
import { readMelody } from './readMelody';
import { readingOptions } from './readingValues';
import { takeSummary } from './summary';

export interface CaptureAnalysis {
  /** Discrete sung notes — the symbolic melody (`NoteEvent` ≡ `NoteEventDto`). */
  melody: NoteEvent[];
  /** The struck sounds — mouth drums rather than notes (INV-PITCH-025). */
  hits: Hit[];
  /** The fields needed to persist this capture as a note. */
  noteInput: Omit<CreateNoteInput, 'title'>;
}

/**
 * Analyse a finished capture into a note's symbolic melody + descriptive
 * metrics. Pure (depends only on the handle).
 */
export function analyzeCapture(handle: RecordingHandle): CaptureAnalysis {
  // One reader, whatever is reading (INV-PITCH-028). A first take is a
  // person switching between humming and drumming without announcing it,
  // so the mixed role reads it both ways (INV-NOTES-115).
  const { notes, hits } = readMelody(handle.samples, 'mixed');
  // Intonation is a question about the trace rather than about the notes,
  // so the summary needs the smoothed frames the notes came from.
  const smoothed = smoothPitch([...handle.samples], readingOptions().smooth);
  // Every measured field, from the same helper a re-read uses — so a take
  // read again cannot end up with a melody from one reading and a range
  // from another (INV-NOTES-195).
  const summary = takeSummary(notes, smoothed);

  return {
    melody: notes,
    hits,
    noteInput: {
      durationMs: handle.durationMs,
      sampleRateHz: handle.sampleRateHz,
      // NoteEvent is structurally identical to NoteEventDto.
      melody: notes,
      ...summary,
      hits,
      // Stamped with the reading that produced all of the above, so a later
      // engine can tell this take apart from one it has already read
      // (INV-NOTES-116).
      analysisVersion: ANALYSIS_VERSION
    }
  };
}
