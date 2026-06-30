/**
 * sync — local-first reconcile of the MMKV recordings cache with the cloud
 * (WP-CLIENT-DATA).
 *
 * Supabase is the source of truth. The MMKV index (`recordings.ts`) is a *cache*
 * that lets the Library render instantly offline; this module pulls the
 * authoritative {@link RecordingDto} list from {@link recordingsRepo}, signs the
 * private Storage blobs, and rewrites the local cache to match (server wins on
 * every conflict — no dual store, no merge ambiguity).
 *
 * Mapping is one-directional here: cloud {@link RecordingDto} → local
 * {@link RecordingMeta}. Writes still go cloud-first via `recordingsRepo`; the
 * cache is only ever derived from a successful cloud read.
 *
 * See docs/PROJECT_COMPLETION_PLAN.md §3 (WP-CLIENT-DATA).
 */
import type { RecordingDto } from 'shared';

import { recordingsRepo } from './recordingsRepo';
import {
  RECORDINGS_INDEX_KEY,
  listRecordings,
  type RecordingMeta
} from './recordings';
import { setJSON } from './store';

/**
 * Project a cloud {@link RecordingDto} (+ signed blob URLs) onto the local
 * {@link RecordingMeta} cache shape the Library renders. Signed URLs are stored
 * so playback/export work directly off the cache between syncs.
 */
export function dtoToMeta(
  dto: RecordingDto,
  urls: { audioUrl: string | null; midiUrl: string | null }
): RecordingMeta {
  return {
    id: dto.id,
    title: dto.title,
    createdAtMs: dto.createdAtMs,
    durationMs: dto.durationMs,
    sampleRateHz: dto.sampleRateHz,
    audioUri: urls.audioUrl ?? '',
    midiUri: urls.midiUrl ?? undefined,
    score: dto.score ?? undefined,
    noteCount: dto.noteCount
  };
}

/**
 * Pull the authoritative recordings list from Supabase, sign each take's blobs,
 * and overwrite the local cache so it mirrors the cloud exactly (server wins).
 * Returns the freshly-synced cache, newest first.
 */
export async function syncRecordings(): Promise<RecordingMeta[]> {
  const dtos = await recordingsRepo.list();

  const metas = await Promise.all(
    dtos.map(async (dto) => {
      const urls = await recordingsRepo.signedUrls(dto);
      return dtoToMeta(dto, urls);
    })
  );

  const index: Record<string, RecordingMeta> = {};
  for (const meta of metas) {
    index[meta.id] = meta;
  }
  // Server-authoritative: replace the whole index in one write.
  setJSON(RECORDINGS_INDEX_KEY, index);

  return metas.sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/**
 * The locally-cached recordings, newest first, with no network round-trip.
 * Used to paint the Library instantly before {@link syncRecordings} resolves.
 */
export function cachedRecordings(): RecordingMeta[] {
  return listRecordings();
}
