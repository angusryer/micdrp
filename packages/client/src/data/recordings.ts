/**
 * CRUD over the persisted recordings index.
 *
 * The index is a single MMKV JSON record: a map of `id -> RecordingMeta`. A
 * {@link RecordingMeta} is the *on-disk index record* — small, denormalised, and
 * cheap to list — while the heavy `models.Recording` (full `PitchSample[]`) is
 * never stored here; its bytes live on disk (see `files.ts`) addressed by id.
 *
 * `RecordingMeta` is deliberately a superset of the durable scalar fields of
 * `models.Recording` (`id`, `createdAtMs`, `durationMs`, `sampleRateHz`) plus the
 * file URIs and derived summary stats the Library/Results screens render.
 *
 * See docs/NATIVE_BUILD_PLAN.md §3 (WP-PERSIST).
 */
import type { Recording } from 'models';

import { deleteRecordingFiles } from './files';
import { getJSON, setJSON } from './store';

/** MMKV key under which the whole `id -> RecordingMeta` index is stored. */
export const RECORDINGS_INDEX_KEY = 'recordings.index';

/**
 * The on-disk index record for one take. Mirrors the durable scalar fields of
 * `models.Recording` and adds file references + summary stats. The full
 * `PitchSample[]` analysis is NOT kept here — only on disk / recomputed.
 */
export interface RecordingMeta {
  /** Stable id, shared with the on-disk audio/midi filenames. */
  id: string;
  /** User-facing title. */
  title: string;
  /** Wall-clock creation time, ms since epoch (mirrors `Recording.createdAtMs`). */
  createdAtMs: number;
  /** Total duration in ms (mirrors `Recording.durationMs`). */
  durationMs: number;
  /** Capture sample rate in Hz (mirrors `Recording.sampleRateHz`). */
  sampleRateHz: number;
  /** `file://` URI of the captured audio. */
  audioUri: string;
  /** `file://` URI of the exported MIDI, once exported. */
  midiUri?: string;
  /** Pitch-accuracy score in 0..100, once scored. */
  score?: number;
  /** Number of segmented notes, once analysed. */
  noteCount?: number;
}

/**
 * Compile-time assurance that the scalar fields stay aligned with
 * `models.Recording`. Exported (not a bare unused local) so it survives
 * `noUnusedLocals`; it carries no runtime cost.
 */
export type RecordingMetaScalars = Pick<
  Recording,
  'id' | 'createdAtMs' | 'durationMs' | 'sampleRateHz'
> &
  (RecordingMeta extends Pick<Recording, 'id' | 'createdAtMs' | 'durationMs' | 'sampleRateHz'>
    ? unknown
    : never);

type RecordingIndex = Record<string, RecordingMeta>;

function readIndex(): RecordingIndex {
  return getJSON<RecordingIndex>(RECORDINGS_INDEX_KEY) ?? {};
}

function writeIndex(index: RecordingIndex): void {
  setJSON(RECORDINGS_INDEX_KEY, index);
}

/**
 * All recordings, newest first (descending `createdAtMs`). Returns an empty array
 * when nothing has been saved.
 */
export function listRecordings(): RecordingMeta[] {
  return Object.values(readIndex()).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/** A single recording by id, or `null` if not found. */
export function getRecording(id: string): RecordingMeta | null {
  return readIndex()[id] ?? null;
}

/** Insert or replace a recording's index record (keyed by `meta.id`). */
export function saveRecording(meta: RecordingMeta): void {
  const index = readIndex();
  index[meta.id] = meta;
  writeIndex(index);
}

/**
 * Remove a recording from the index and delete its on-disk audio/midi files.
 * No-op (still cleans files) if the id is unknown.
 */
export async function deleteRecording(id: string): Promise<void> {
  const index = readIndex();
  if (id in index) {
    delete index[id];
    writeIndex(index);
  }
  await deleteRecordingFiles(id);
}
