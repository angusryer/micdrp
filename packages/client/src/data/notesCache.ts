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
import type { NoteEventDto } from 'shared';

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
  /** Signed URL of the captured audio (refreshed on each sync), or '' if none. */
  audioUri: string;
  /** The symbolic melody — source of truth for all corpus analysis. */
  melody: NoteEventDto[];
  key?: string;
  tempoBpm?: number;
  inTuneRatio?: number;
  meanCentsError?: number;
  noteCount: number;
  rangeLowMidi?: number;
  rangeHighMidi?: number;
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
