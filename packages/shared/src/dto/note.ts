/**
 * Note DTOs — the wire/row shape for a sung "note" (a musical-idea memo) and its
 * persisted symbolic melody. Self-contained primitives (shared is the lowest
 * layer; it must not import logic). The client maps `logic`'s structurally
 * identical `NoteEvent` to/from {@link NoteEventDto}.
 */
import type { InterpretationDto } from './interpretation';

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
  /**
   * How loud the note was, in dBFS, or null when nothing measured it.
   *
   * Null rather than a floor value: "nobody looked" and "it was silent" are
   * different claims and only one of them is about the singing. Notes stored
   * before this existed are read as null by {@link readMelody}, which is the
   * one place that knows they can lack it (INV-PITCH-020).
   */
  loudnessDb: number | null;
}

/**
 * A stored melody as the working shape, which is the same shape.
 *
 * The only difference a stored melody can have is age: a note captured before
 * loudness was measured has no such field, and every reading of it has to say
 * unknown rather than let `undefined` travel as though it were a number.
 */
export function readMelody(raw: unknown): NoteEventDto[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return (raw as NoteEventDto[]).map((note) => ({
    ...note,
    loudnessDb: typeof note.loudnessDb === 'number' ? note.loudnessDb : null
  }));
}

/**
 * What a layer is for, which decides how it is read.
 *
 * `bass` is the one that carries harmony: the root movement the singer heard
 * under the tune (INV-NOTES-071). Others are kept and sounded but not yet
 * read — a layer nobody knows how to interpret is still a performance worth
 * having, and inventing a reading for it would be worse than admitting none.
 */
export type LayerRole = 'bass' | 'other';

/**
 * A second take sung against the first.
 *
 * A recording like any other — captured, detected, stored, drawn and sounded
 * by the same path (INV-NOTES-073) — plus where it sits against the take it
 * was sung over, and what it is for.
 */
export interface NoteLayerDto {
  id: string;
  role: LayerRole;
  /** Storage path of this layer's audio, or null. */
  audioPath: string | null;
  /** What was detected in it, in the take's own timeline. */
  melody: NoteEventDto[];
  /**
   * How far this layer's own clock was shifted to line up with the take.
   *
   * An overdub is heard by the microphone after the output and input
   * latencies, so it lands late by a fixed amount. Recorded here rather than
   * folded silently into the timings: a correction that cannot be inspected
   * cannot be found to be wrong.
   */
  alignedByMs: number;
  /**
   * Silenced for listening. Muting is about the ear — the reason to silence
   * the bass is to hear the melody alone — so it changes what is heard and
   * never what is read (INV-NOTES-073).
   */
  isMuted: boolean;
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
  /**
   * What a person has made of this take. Empty on a note recorded before
   * readings existed, which is not an error (INV-NOTES-022).
   */
  interpretations: InterpretationDto[];
  /**
   * Second takes sung against this one, as context for reading it. Empty on
   * a note recorded before layers existed, which is not an error.
   */
  layers: NoteLayerDto[];
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

/**
 * Read layers off a stored row, keeping only what is whole.
 *
 * Tolerant on purpose: a note recorded before layers existed has nothing
 * here, which is not an error, and a half-written layer is worth dropping
 * rather than crashing the note it belongs to.
 */
export function parseLayers(raw: unknown): NoteLayerDto[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: NoteLayerDto[] = [];
  for (const entry of raw) {
    const v = entry as NoteLayerDto | null;
    if (v == null || typeof v.id !== 'string' || !Array.isArray(v.melody)) {
      continue;
    }
    out.push({
      id: v.id,
      // Anything unrecognised is kept and sounded but not read: inventing a
      // reading for a role we do not know would be worse than admitting none.
      role: v.role === 'bass' ? 'bass' : 'other',
      audioPath: typeof v.audioPath === 'string' ? v.audioPath : null,
      melody: readMelody(v.melody),
      alignedByMs: typeof v.alignedByMs === 'number' ? v.alignedByMs : 0,
      isMuted: v.isMuted === true
    });
  }
  return out;
}
