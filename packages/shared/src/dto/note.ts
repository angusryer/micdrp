/**
 * Note DTOs — the wire/row shape for a sung "note" (a musical-idea memo) and its
 * persisted symbolic melody. Self-contained primitives (shared is the lowest
 * layer; it must not import logic). The client maps `logic`'s structurally
 * identical `NoteEvent` to/from {@link NoteEventDto}.
 */

/** One segmented note in a melody — mirrors `logic`'s `NoteEvent` field-for-field. */
export interface NoteEventDto {
  midi: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  /** Mean cents deviation across the note. */
  cents: number;
  /** Mean clarity across the note, 0..1. */
  clarity: number;
}

export interface NoteDto {
  id: string;
  userId: string;
  title: string;
  createdAtMs: number;
  durationMs: number;
  sampleRateHz: number;
  /** Storage path of the captured audio, or null. */
  audioPath: string | null;
  /** The symbolic melody — source of truth for all corpus analysis. */
  melody: NoteEventDto[];
  /** Detected key, e.g. "A minor", or null. */
  key: string | null;
  tempoBpm: number | null;
  /** Fraction of frames within tune tolerance, 0..1, or null. */
  inTuneRatio: number | null;
  /** Mean absolute cents error, or null. */
  meanCentsError: number | null;
  noteCount: number;
  /** Lowest sung MIDI note, or null when empty. */
  rangeLowMidi: number | null;
  /** Highest sung MIDI note, or null when empty. */
  rangeHighMidi: number | null;
}

/** Fields supplied by the client when creating a note. */
export interface CreateNoteInput {
  title: string;
  durationMs: number;
  sampleRateHz: number;
  melody: NoteEventDto[];
  key?: string | null;
  tempoBpm?: number | null;
  inTuneRatio?: number | null;
  meanCentsError?: number | null;
  noteCount: number;
  rangeLowMidi?: number | null;
  rangeHighMidi?: number | null;
}
