/**
 * useNotes — data hook for the Notes list.
 *
 * Sources notes from the cloud (Supabase) with a local MMKV cache in front: on
 * mount it paints the cached list instantly, then calls `syncNotes()` to pull
 * the authoritative list from `notesRepo` and overwrite the cache (server wins).
 * Deletion goes cloud-first through `notesRepo.remove`, then re-syncs.
 *
 * State is minimal React state: the list and a loading flag. All async actions
 * are user-triggered and never touch the per-frame audio path.
 */
import { useCallback, useEffect, useState } from 'react';

import { notesRepo } from '../../data/notesRepo';
import { cachedNotes, syncNotes } from '../../data/notesSync';
import type { NoteMeta } from '../../data/notesCache';

export interface UseNotesValue {
  /** All notes, newest first. Seeded from cache, then cloud-synced. */
  notes: NoteMeta[];
  /** True while a cloud sync is in flight. */
  loading: boolean;
  /** Re-pull the authoritative list from the cloud (pull-to-refresh). */
  refresh(): Promise<void>;
  /** Delete a note by id: removes the cloud row + blob, then re-syncs the cache. */
  remove(id: string): Promise<void>;
}

export function useNotes(): UseNotesValue {
  // Paint the cache synchronously on first render so the list is never blank.
  const [notes, setNotes] = useState<NoteMeta[]>(() => {
    try {
      return cachedNotes();
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setNotes(await syncNotes());
    } catch {
      // Offline / transient: keep whatever the cache already shows.
      try {
        setNotes(cachedNotes());
      } catch {
        setNotes([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback((): Promise<void> => load(), [load]);

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await notesRepo.remove(id);
      await load();
    },
    [load]
  );

  return { notes, loading, refresh, remove };
}

export default useNotes;
