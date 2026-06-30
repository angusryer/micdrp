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
 *   smoothPitch → segmentNotes → { melody, range }
 *                              → detectKey / estimateTempo / scorePitch(self)
 */
import {
  detectKey,
  estimateTempo,
  scorePitch,
  segmentNotes,
  smoothPitch,
  type NoteEvent,
  type TargetNote
} from 'logic';
import type { CreateNoteInput, NoteEventDto } from 'shared';

import type { RecordingHandle } from '../audio/contract';

/** detectKey confidence below which the key is too weak to assert. */
const MIN_KEY_CONFIDENCE = 0.04;
/** estimateTempo confidence below which the tempo is too weak to assert. */
const MIN_TEMPO_CONFIDENCE = 0.4;

export interface CaptureAnalysis {
  /** Discrete sung notes — the symbolic melody (`NoteEvent` ≡ `NoteEventDto`). */
  melody: NoteEvent[];
  /** The fields needed to persist this capture as a note. */
  noteInput: Omit<CreateNoteInput, 'title'>;
}

/** Self-referential target grid: each note is the target for its own span. */
function selfTargets(notes: readonly NoteEvent[]): TargetNote[] {
  return notes.map((n) => ({ midi: n.midi, startMs: n.startMs, endMs: n.endMs }));
}

/**
 * Analyse a finished capture into a note's symbolic melody + descriptive
 * metrics. Pure (depends only on the handle).
 */
export function analyzeCapture(handle: RecordingHandle): CaptureAnalysis {
  const smoothed = smoothPitch(handle.samples);
  const notes = segmentNotes(smoothed);
  const hasNotes = notes.length > 0;

  // Intonation steadiness: how cleanly each sustained pitch was held (no grade).
  const score = scorePitch(smoothed, selfTargets(notes));

  const key = detectKey(notes);
  const keyLabel =
    hasNotes && key.confidence >= MIN_KEY_CONFIDENCE
      ? `${key.tonicName} ${key.mode}`
      : null;

  const tempo = estimateTempo(notes);
  const tempoBpm =
    tempo.bpm > 0 && tempo.confidence >= MIN_TEMPO_CONFIDENCE ? tempo.bpm : null;

  let low: number | null = null;
  let high: number | null = null;
  for (const n of notes) {
    low = low == null ? n.midi : Math.min(low, n.midi);
    high = high == null ? n.midi : Math.max(high, n.midi);
  }

  return {
    melody: notes,
    noteInput: {
      durationMs: handle.durationMs,
      sampleRateHz: handle.sampleRateHz,
      // NoteEvent is structurally identical to NoteEventDto.
      melody: notes as NoteEventDto[],
      key: keyLabel,
      tempoBpm,
      inTuneRatio: hasNotes ? score.inTuneRatio : null,
      meanCentsError: hasNotes ? score.meanCentsError : null,
      noteCount: notes.length,
      rangeLowMidi: low,
      rangeHighMidi: high
    }
  };
}

export default analyzeCapture;
