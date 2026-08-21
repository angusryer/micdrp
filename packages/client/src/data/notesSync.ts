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
 * Project a cloud {@link NoteDto} onto the local {@link NoteMeta} cache shape.
 *
 * The audio's durable path is stored rather than a signed URL: a file token
 * expires in about two minutes, so a URL cached here would be dead long before
 * the singer opened the note (INV-NOTES-014). The melody is stored so analysis
 * never needs the network.
 */
export function dtoToMeta(dto: NoteDto): NoteMeta {
  return {
    id: dto.id,
    title: dto.title,
    createdAtMs: dto.createdAtMs,
    durationMs: dto.durationMs,
    sampleRateHz: dto.sampleRateHz,
    audioPath: dto.audioPath,
    melody: dto.melody,
    interpretations: dto.interpretations,
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

  // No per-note token request: the path is already on the DTO, and minting a
  // URL here is what used to make playback fail later.
  const metas = dtos.map(dtoToMeta);

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
