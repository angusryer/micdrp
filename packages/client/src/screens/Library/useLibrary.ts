/**
 * useLibrary — data hook for the Library screen (WP-LIBRARY-UI).
 *
 * Loads the persisted recordings index via `data/recordings`, exposes delete,
 * and re-exports a recording's `.mid` via react-native-share when available.
 *
 * State is minimal React state: the list and a loading flag. Deletion and
 * share are async actions triggered by user interaction; they never touch
 * the per-frame audio path.
 *
 * See docs/NATIVE_BUILD_PLAN.md §3 (WP-LIBRARY-UI).
 */
import { useCallback, useEffect, useState } from 'react';
import Share from 'react-native-share';

import {
  deleteRecording,
  listRecordings,
  type RecordingMeta
} from '../../data/recordings';

export type ShareStatus = 'idle' | 'sharing' | 'error';

export interface UseLibraryValue {
  /** All recordings, newest first. Empty while loading. */
  recordings: RecordingMeta[];
  /** True on the initial load and after a pull-to-refresh trigger. */
  loading: boolean;
  /** Reload the list from the index (used for pull-to-refresh). */
  refresh(): void;
  /**
   * Delete a recording by id. Removes it from the index and deletes the
   * on-disk audio/midi files. Refreshes the list on completion.
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
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback((): void => {
    setLoading(true);
    // listRecordings is synchronous (MMKV); wrap in try/catch for safety.
    try {
      setRecordings(listRecordings());
    } catch {
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount.
  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback((): void => {
    load();
  }, [load]);

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await deleteRecording(id);
      load();
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
