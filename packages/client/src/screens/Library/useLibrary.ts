/**
 * useLibrary — data hook for the Library screen.
 *
 * Sources recordings from the cloud (Supabase) with a local MMKV cache in front:
 * on mount it paints the cached list instantly, then calls `syncRecordings()` to
 * pull the authoritative list from `recordingsRepo` and overwrite the cache
 * (server wins). Deletion goes cloud-first through `recordingsRepo.remove`, then
 * re-syncs. Sharing re-exports a take's `.mid` via react-native-share.
 *
 * State is minimal React state: the list and a loading flag. All async actions
 * are user-triggered and never touch the per-frame audio path.
 *
 * See docs/PROJECT_COMPLETION_PLAN.md §3 (WP-CLIENT-DATA) — cloud repo + cache.
 */
import { useCallback, useEffect, useState } from 'react';
import Share from 'react-native-share';

import { recordingsRepo } from '../../data/recordingsRepo';
import { cachedRecordings, syncRecordings } from '../../data/sync';
import type { RecordingMeta } from '../../data/recordings';

export type ShareStatus = 'idle' | 'sharing' | 'error';

export interface UseLibraryValue {
  /** All recordings, newest first. Seeded from cache, then cloud-synced. */
  recordings: RecordingMeta[];
  /** True while a cloud sync is in flight. */
  loading: boolean;
  /** Re-pull the authoritative list from the cloud (pull-to-refresh). */
  refresh(): Promise<void>;
  /**
   * Delete a recording by id: removes the cloud row + Storage blobs, then
   * re-syncs the local cache to match.
   */
  remove(id: string): Promise<void>;
  /**
   * Open the OS share sheet for a recording's exported `.mid`.
   * Resolves when the sheet is dismissed. Rejects only on hard errors
   * (cancelled share is not an error; `failOnCancel` is false).
   */
  shareMidi(meta: RecordingMeta): Promise<void>;
}

export function useLibrary(): UseLibraryValue {
  // Paint the cache synchronously on first render so the list is never blank.
  const [recordings, setRecordings] = useState<RecordingMeta[]>(() => {
    try {
      return cachedRecordings();
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setRecordings(await syncRecordings());
    } catch {
      // Offline / transient: keep whatever the cache already shows.
      try {
        setRecordings(cachedRecordings());
      } catch {
        setRecordings([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync on mount.
  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback((): Promise<void> => load(), [load]);

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await recordingsRepo.remove(id);
      await load();
    },
    [load]
  );

  const shareMidi = useCallback(async (meta: RecordingMeta): Promise<void> => {
    if (meta.midiUri == null) {
      return;
    }
    try {
      await Share.open({
        title: meta.title,
        subject: meta.title,
        failOnCancel: false,
        type: 'audio/midi',
        filename: `${meta.title}.mid`,
        url: meta.midiUri
      });
    } catch {
      // User-cancel and hard failures both land here. Re-throw so callers can
      // surface an error state if they choose, but never crash the list.
      throw new Error('Share failed');
    }
  }, []);

  return { recordings, loading, refresh, remove, shareMidi };
}

export default useLibrary;
