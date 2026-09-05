/**
 * What a take measures out to, given the notes read from it.
 *
 * Its own module because two paths need exactly this and only one of them
 * used to have it. A capture computed the range, the key, the tempo and
 * the tuning measures; a re-read wrote back the melody, the hits and the
 * count and left every one of those as the first reading had set them
 * (INV-NOTES-195).
 *
 * That is how a take re-read with a raised pitch ceiling came to hold
 * notes up to MIDI 93 while still reporting a range topping out at 86,
 * and a mean error of 35 cents measured against a reading that no longer
 * existed. A stale summary is worse than an absent one: it reads as a
 * measurement of the take rather than as a leftover, and it was nearly
 * used as evidence about the singer.
 */
import {
  detectKey,
  estimateTempo,
  scorePitch,
  type NoteEvent,
  type PitchFrame,
  type TargetNote
} from 'logic';

/** detectKey confidence below which the key is too weak to assert. */
export const MIN_KEY_CONFIDENCE = 0.04;
/** estimateTempo confidence below which the tempo is too weak to assert. */
export const MIN_TEMPO_CONFIDENCE = 0.4;

/** Everything about a take that is derived from its notes and its frames. */
export interface TakeSummary {
  key: string | null;
  tempoBpm: number | null;
  inTuneRatio: number | null;
  meanCentsError: number | null;
  noteCount: number;
  rangeLowMidi: number | null;
  rangeHighMidi: number | null;
}

/** Self-referential target grid: each note is the target for its own span. */
function selfTargets(notes: readonly NoteEvent[]): TargetNote[] {
  return notes.map((n) => ({ midi: n.midi, startMs: n.startMs, endMs: n.endMs }));
}

/**
 * Measure a reading.
 *
 * `smoothed` is the pitch trace the notes were segmented from, because
 * intonation is a question about the trace rather than about the notes:
 * how cleanly each pitch was held, not how close its rounded value is to
 * itself.
 */
export function takeSummary(
  notes: readonly NoteEvent[],
  smoothed: readonly PitchFrame[]
): TakeSummary {
  const hasNotes = notes.length > 0;
  // Copied because scorePitch takes a mutable array; the caller's frames
  // are not ours to hand on.
  const score = scorePitch([...smoothed], selfTargets(notes));

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
    key: keyLabel,
    tempoBpm,
    inTuneRatio: hasNotes ? score.inTuneRatio : null,
    meanCentsError: hasNotes ? score.meanCentsError : null,
    noteCount: notes.length,
    rangeLowMidi: low,
    rangeHighMidi: high
  };
}
