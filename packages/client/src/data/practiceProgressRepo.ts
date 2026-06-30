/**
 * practiceProgressRepo — cloud CRUD for practice trajectory rows.
 *
 * Each finished practice session appends one lightweight metrics row to
 * `public.practice_progress` (no audio is retained). This module is the only
 * seam that talks to Supabase for practice progress; it maps the snake_case
 * rows to/from the camelCase {@link PracticeProgressDto} contract from `shared`.
 */
import { TABLES, AppErrorCode, appError } from 'shared';
import type {
  CreatePracticeProgressInput,
  PracticeProgressDto
} from 'shared';

import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';
import { requireUserId } from './currentUser';

type ProgressRow = Database['public']['Tables']['practice_progress']['Row'];

function rowToDto(row: ProgressRow): PracticeProgressDto {
  return {
    id: row.id,
    userId: row.user_id,
    createdAtMs: Date.parse(row.created_at),
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
    const { data, error } = await supabase
      .from(TABLES.practiceProgress)
      .insert({
        user_id: userId,
        melody_id: input.melodyId,
        root_midi: input.rootMidi,
        note_duration_ms: input.noteDurationMs,
        score: input.score ?? null,
        in_tune_ratio: input.inTuneRatio ?? null,
        mean_cents_error: input.meanCentsError ?? null,
        evaluated_frames: input.evaluatedFrames
      })
      .select()
      .single();

    if (error || !data) {
      throw appError(
        AppErrorCode.Storage,
        'Failed to insert practice progress',
        error ?? undefined
      );
    }
    return rowToDto(data);
  },

  /** All practice-progress rows for the current user, oldest first (trend order). */
  async list(): Promise<PracticeProgressDto[]> {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from(TABLES.practiceProgress)
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw appError(
        AppErrorCode.Network,
        'Failed to list practice progress',
        error
      );
    }
    return (data ?? []).map(rowToDto);
  }
};

export type PracticeProgressRepo = typeof practiceProgressRepo;

export default practiceProgressRepo;
