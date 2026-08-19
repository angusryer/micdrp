/**
 * practiceProgressRepo — cloud CRUD for practice trajectory rows.
 *
 * Each finished practice session appends one lightweight metrics row to
 * `public.practice_progress` (no audio is retained). This module is the only
 * seam that talks to Supabase for practice progress; it maps the snake_case
 * rows to/from the camelCase {@link PracticeProgressDto} contract from `shared`.
 */
import { AppErrorCode, appError } from 'shared';
import type {
  CreatePracticeProgressInput,
  PracticeProgressDto
} from 'shared';

import { backend, COLLECTIONS } from '../lib/backend';
import type { PracticeProgressRecord } from '../lib/backend';
import { requireUserId } from './currentUser';

type ProgressRow = PracticeProgressRecord;

function rowToDto(row: ProgressRow): PracticeProgressDto {
  return {
    id: row.id,
    userId: row.user,
    createdAtMs: Date.parse(row.created),
    melodyId: row.melody_id,
    rootMidi: row.root_midi,
    noteDurationMs: row.note_duration_ms,
    score: row.score,
    inTuneRatio: row.in_tune_ratio,
    meanCentsError: row.mean_cents_error,
    evaluatedFrames: row.evaluated_frames
  };
}

export const practiceProgressRepo = {
  /** Append one finished practice session's metrics. */
  async create(
    input: CreatePracticeProgressInput
  ): Promise<PracticeProgressDto> {
    const userId = await requireUserId();
    try {
      const record = await backend
        .collection(COLLECTIONS.practiceProgress)
        .create<ProgressRow>({
          user: userId,
          melody_id: input.melodyId,
          root_midi: input.rootMidi,
          note_duration_ms: input.noteDurationMs,
          score: input.score ?? null,
          in_tune_ratio: input.inTuneRatio ?? null,
          mean_cents_error: input.meanCentsError ?? null,
          evaluated_frames: input.evaluatedFrames
        });
      return rowToDto(record);
    } catch (error) {
      throw appError(
        AppErrorCode.Storage,
        'Failed to insert practice progress',
        error
      );
    }
  },

  /** All practice-progress rows for the current user, oldest first (trend order). */
  async list(): Promise<PracticeProgressDto[]> {
    await requireUserId();
    try {
      // The access rule already scopes this to the caller; sorting oldest
      // first is what the trend chart consumes.
      const records = await backend
        .collection(COLLECTIONS.practiceProgress)
        .getFullList<ProgressRow>({ sort: 'created' });
      return records.map(rowToDto);
    } catch (error) {
      throw appError(
        AppErrorCode.Network,
        'Failed to list practice progress',
        error
      );
    }
  }
};

export type PracticeProgressRepo = typeof practiceProgressRepo;

export default practiceProgressRepo;
