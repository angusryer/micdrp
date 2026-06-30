/**
 * Read access over the persisted recordings index (the offline cache).
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
 * This module is the single READ path for that cache. The cache is *written*
 * exclusively by `sync.ts` (server-authoritative, one whole-index write under
 * {@link RECORDINGS_INDEX_KEY}); there is no second local store and no
 * per-record mutation API here.
 *
 * See docs/NATIVE_BUILD_PLAN.md §3 (WP-PERSIST).
 */
import type { Recording } from 'models';

import { getJSON } from './store';

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

/**
 * All cached recordings, newest first (descending `createdAtMs`). Returns an
 * empty array when the cache is empty or its payload is corrupt.
 */
export function listRecordings(): RecordingMeta[] {
  return Object.values(readIndex()).sort((a, b) => b.createdAtMs - a.createdAtMs);
}
