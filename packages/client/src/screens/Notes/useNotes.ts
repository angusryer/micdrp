/**
 * useNotes — data hook for the Notes list.
 *
 * Sources notes from the cloud (Supabase) with a local MMKV cache in front: on
 * mount it paints the cached list instantly, then calls `syncNotes()` to pull
 * the authoritative list from `notesRepo` and overwrite the cache (server wins).
 * Deletion goes cloud-first through `notesRepo.remove`, then re-syncs.
 *
 * A note kept on this device and not yet uploaded survives every sync
 * (INV-NOTES-139), and the queue is drained whenever the list is loaded — the
 * moment somebody looks at their notes is a good moment to try again.
 *
 * A failed sync is reported rather than swallowed. An empty list used to mean
 * either "nothing kept" or "could not ask", and it said the first while
 * meaning the second.
 */
import { useCallback, useEffect, useState } from 'react';

import { notesRepo } from '../../data/notesRepo';
import { cachedNotes, syncNotes } from '../../data/notesSync';
import { flushPending, pendingCount } from '../../data/notesQueue';
import { dropNote, isLocalId } from '../../data/notesLocal';
import type { NoteMeta } from '../../data/notesCache';

export interface UseNotesValue {
  /** All notes, newest first. Seeded from cache, then cloud-synced. */
  notes: NoteMeta[];
  /** True while a cloud sync is in flight. */
  loading: boolean;
  /**
   * True when the last sync could not reach the server.
   *
   * Separate from the list being empty. What is shown is still whatever the
   * device holds — this only says that it may not be all of it.
   */
  offline: boolean;
  /** How many notes are still waiting to be uploaded. */
  pending: number;
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
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(() => pendingCount());

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    // Anything waiting goes first, so a note that has just made it up is
    // reconciled by the sync that follows rather than the next one.
    try {
      await flushPending();
    } catch {
      // Nothing to do: the notes are on the device either way.
    }
    try {
      setNotes(await syncNotes());
      setOffline(false);
    } catch {
      // Could not ask. What the device holds is still shown, and the screen
      // is told that this is not the whole story.
      setOffline(true);
      try {
        setNotes(cachedNotes());
      } catch {
        setNotes([]);
      }
    } finally {
      setPending(pendingCount());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback((): Promise<void> => load(), [load]);

  const remove = useCallback(
    async (id: string): Promise<void> => {
      // A note the server has never heard of is deleted here and nowhere
      // else; asking the server to remove it would be asking about something
      // that does not exist (INV-NOTES-139).
      if (isLocalId(id)) {
        dropNote(id);
      } else {
        await notesRepo.remove(id);
      }
      await load();
    },
    [load]
  );

  return { notes, loading, offline, pending, refresh, remove };
}

export default useNotes;
