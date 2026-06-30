/**
 * practiceProgressSync — server-authoritative cache of the practice trajectory.
 *
 * Practice-progress rows are tiny (metrics only, no blobs), so the whole list is
 * cached as one MMKV record for instant Dashboard paint. Supabase remains the
 * source of truth: {@link syncPracticeProgress} pulls the authoritative list and
 * overwrites the cache; {@link cachedPracticeProgress} reads it with no network.
 */
import type { PracticeProgressDto } from 'shared';

import { practiceProgressRepo } from './practiceProgressRepo';
import { getJSON, setJSON } from './store';

/** MMKV key under which the whole practice-progress list is cached. */
export const PRACTICE_PROGRESS_KEY = 'practiceProgress.list';

/** Pull the authoritative practice trajectory and overwrite the cache. */
export async function syncPracticeProgress(): Promise<PracticeProgressDto[]> {
  const rows = await practiceProgressRepo.list();
  setJSON(PRACTICE_PROGRESS_KEY, rows);
  return rows;
}

/** The locally-cached practice trajectory (oldest first), with no network. */
export function cachedPracticeProgress(): PracticeProgressDto[] {
  return getJSON<PracticeProgressDto[]>(PRACTICE_PROGRESS_KEY) ?? [];
}
