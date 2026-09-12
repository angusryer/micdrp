/**
 * Deriving a take: one pure function from a reading and the statements kept
 * with it to every layer above (INV-NOTES-259).
 *
 *   performance ─► transcription ─► rhythm ─► harmony
 *
 * No screen, no store, no device. The screen calls this to draw; the corpus
 * tool calls it to re-analyse every take at once with a newer reader.
 * Re-analysing a take is calling it again with the newer reading and the
 * same statements — every statement is anchored by a moment in the layer
 * beneath, so re-inference finds it (INV-NOTES-256).
 *
 * Each layer's derivation takes only its own slice of the statements
 * (INV-NOTES-260), so the transcription cannot see a beat and the rhythm
 * cannot see a chord edit. The type of each function is the proof.
 */
import type { NoteEvent } from '../segmentation';
import type { VoicedHit } from '../voicedBeats';
import { deriveHarmony, type Harmony, type HarmonyInputs } from './harmony';
import { deriveRhythm, type Rhythm } from './rhythm';
import {
  harmonySlice,
  rhythmSlice,
  transcriptionSlice,
  type Statements
} from './slices';
import { deriveTranscription, type Transcription } from './transcription';

export type {
  HarmonySlice,
  RhythmSlice,
  Statements,
  TranscriptionSlice
} from './slices';
export { harmonySlice, rhythmSlice, transcriptionSlice } from './slices';
export { deriveTranscription, type Transcription } from './transcription';
export { deriveRhythm, stepsAcross, type Rhythm, type RhythmInputs } from './rhythm';
export { deriveHarmony, type Harmony, type HarmonyInputs } from './harmony';

/** What a reading of a performance carries, as far as derivation needs. */
export interface ReadingForDerive {
  notes: readonly NoteEvent[];
  hits?: readonly VoicedHit[];
}

export interface DeriveInputs extends HarmonyInputs {
  durationMs: number;
  /** A bass layer sung against the take, read the same way. */
  bass?: readonly NoteEvent[];
}

export interface Derived {
  transcription: Transcription;
  rhythm: Rhythm;
  harmony: Harmony;
}

export function derive(
  reading: ReadingForDerive,
  statements: Statements,
  inputs: DeriveInputs
): Derived {
  const transcription = deriveTranscription(reading.notes, transcriptionSlice(statements));
  const rhythm = deriveRhythm(transcription, rhythmSlice(statements), {
    durationMs: inputs.durationMs,
    hits: reading.hits ?? [],
    bass: inputs.bass
  });
  const harmony = deriveHarmony(transcription, rhythm, harmonySlice(statements), {
    bass: inputs.bass,
    floorMidi: inputs.floorMidi
  });
  return { transcription, rhythm, harmony };
}
