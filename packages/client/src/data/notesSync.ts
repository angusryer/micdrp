/**
 * notesSync — server-authoritative reconcile of the MMKV notes cache with the
 * cloud.
 *
 * Supabase is the source of truth. The MMKV index (`notesCache.ts`) is a *cache*
 * that lets the Notes list and Dashboard render instantly offline; this module
 * pulls the authoritative {@link NoteDto} list from {@link notesRepo}, signs the
 * private audio blobs, and rewrites the local cache to match (server wins on
 * every conflict — no dual store, no merge ambiguity).
 *
 * Writes still go cloud-first via `notesRepo`; the cache is only ever derived
 * from a successful cloud read.
 */
import type { NoteDto } from 'shared';

import { notesRepo } from './notesRepo';
import { NOTES_INDEX_KEY, listNotes, type NoteMeta } from './notesCache';
import { setJSON } from './store';

/**
 * Project a cloud {@link NoteDto} (+ signed audio URL) onto the local
 * {@link NoteMeta} cache shape. The signed URL is stored so playback works
 * directly off the cache between syncs; the melody is stored so analysis never
 * needs the network.
 */
export function dtoToMeta(dto: NoteDto, audioUrl: string | null): NoteMeta {
  return {
    id: dto.id,
    title: dto.title,
    createdAtMs: dto.createdAtMs,
    durationMs: dto.durationMs,
    sampleRateHz: dto.sampleRateHz,
    audioUri: audioUrl ?? '',
    melody: dto.melody,
    key: dto.key ?? undefined,
    tempoBpm: dto.tempoBpm ?? undefined,
    inTuneRatio: dto.inTuneRatio ?? undefined,
    meanCentsError: dto.meanCentsError ?? undefined,
    noteCount: dto.noteCount,
    rangeLowMidi: dto.rangeLowMidi ?? undefined,
    rangeHighMidi: dto.rangeHighMidi ?? undefined
  };
}

/**
 * Pull the authoritative notes list from Supabase, sign each note's audio, and
 * overwrite the local cache so it mirrors the cloud exactly (server wins).
 * Returns the freshly-synced cache, newest first.
 */
export async function syncNotes(): Promise<NoteMeta[]> {
  const dtos = await notesRepo.list();

  const metas = await Promise.all(
    dtos.map(async (dto) => {
      const audioUrl = await notesRepo.signedAudioUrl(dto);
      return dtoToMeta(dto, audioUrl);
    })
  );

  const index: Record<string, NoteMeta> = {};
  for (const meta of metas) {
    index[meta.id] = meta;
  }
  // Server-authoritative: replace the whole index in one write.
  setJSON(NOTES_INDEX_KEY, index);

  return metas.sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/**
 * The locally-cached notes, newest first, with no network round-trip. Used to
 * paint the Notes list and Dashboard instantly before {@link syncNotes} resolves.
 */
export function cachedNotes(): NoteMeta[] {
  return listNotes();
}
