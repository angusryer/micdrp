/**
 * Read access over the persisted notes index (the offline cache).
 *
 * The index is a single MMKV JSON record: a map of `id -> NoteMeta`. A
 * {@link NoteMeta} carries the durable scalar fields of `shared.NoteDto`, a
 * signed audio URL for playback, and — crucially — the full symbolic `melody`.
 * Keeping the melody in the cache is what lets the Dashboard re-aggregate the
 * whole corpus on-device, instantly and offline, without ever re-downloading or
 * re-analysing audio.
 *
 * This module is the single READ path for that cache. The cache is *written*
 * exclusively by `notesSync.ts` (server-authoritative, one whole-index write).
 */
import type {
  HitDto,
  InterpretationDto,
  NoteEventDto,
  NoteLayerDto
} from 'shared';

import { getJSON } from './store';

/** MMKV key under which the whole `id -> NoteMeta` index is stored. */
export const NOTES_INDEX_KEY = 'notes.index';

/**
 * The on-disk index record for one note. Mirrors the durable fields of
 * `shared.NoteDto`, including the symbolic melody used for corpus analysis.
 */
export interface NoteMeta {
  id: string;
  title: string;
  createdAtMs: number;
  durationMs: number;
  sampleRateHz: number;
  /**
   * The captured audio's server-side filename, or null if none.
   *
   * Deliberately NOT a URL. A PocketBase file token lives about two minutes,
   * so a signed URL cached here was expired for all but the first moments
   * after a sync, and every note played later failed (INV-NOTES-014). The
   * durable path keeps, and the URL is minted when playback starts.
   */
  audioPath: string | null;
  /**
   * Where the audio sits on this device, for a note that has not been
   * uploaded yet — and afterwards, until the file is cleaned up.
   *
   * A note is kept locally the moment it is sung, before anything is sent
   * (INV-NOTES-139), so for a while the only copy of a take is this one.
   */
  localAudioUri?: string;
  /**
   * True while this note is still waiting to reach the server.
   *
   * The list shows it either way. What it changes is that a sync must not
   * remove it: the server has not been told about it, so the server's silence
   * about it means nothing (INV-NOTES-139).
   */
  pendingSync?: boolean;
  /**
   * The symbolic melody.
   *
   * A reading of the audio, not a source of truth: the recording and the
   * interpretations are the only parts that cannot be produced again, and
   * this is re-read whenever the engine improves (INV-NOTES-116).
   */
  melody: NoteEventDto[];
  /** The struck sounds. Absent on a take read before they were sought. */
  hits?: HitDto[];
  /** Which reading produced them. Absent means the oldest one. */
  analysisVersion?: number;
  key?: string;
  tempoBpm?: number;
  inTuneRatio?: number;
  meanCentsError?: number;
  noteCount: number;
  rangeLowMidi?: number;
  rangeHighMidi?: number;
  /**
   * What a person has made of this take.
   *
   * Cached alongside the melody for the same reason: the screen that reads it
   * must work without a round trip, and a decision that only appears once the
   * network answers is a decision that looks lost.
   */
  interpretations?: InterpretationDto[];
  /**
   * Second takes sung against this one, as context for reading it. Optional:
   * a note cached before layers existed simply has none, which is not an
   * error (INV-NOTES-073).
   */
  layers?: NoteLayerDto[];
}

type NoteIndex = Record<string, NoteMeta>;

function readIndex(): NoteIndex {
  return getJSON<NoteIndex>(NOTES_INDEX_KEY) ?? {};
}

/**
 * All cached notes, newest first (descending `createdAtMs`). Returns an empty
 * array when the cache is empty or its payload is corrupt.
 */
export function listNotes(): NoteMeta[] {
  return Object.values(readIndex()).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/** The melodies of all cached notes — the corpus passed to `analyzeCorpus`. */
export function corpusMelodies(): NoteEventDto[][] {
  return listNotes().map((n) => n.melody);
}
