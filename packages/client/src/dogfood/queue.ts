/**
 * What the loop is doing with the feedback already sent.
 *
 * The loop runs on a machine elsewhere, so a clip that has been picked up
 * looks exactly like one that is stuck. This reads back what it says about
 * itself (INV-DOG-024).
 */
import { backend } from '../lib/backend';
import { looksStalled, type ClipProgressDto } from 'shared';

const COLLECTION = 'dogfood_clips';

export interface QueuedClip {
  id: string;
  recordedAtMs: number;
  durationMs: number;
  state: string;
  /** The first words of the transcript, once there are any. */
  label: string | null;
  progress: ClipProgressDto | null;
  isStalled: boolean;
}

/** Enough of a transcript to recognise which remark this was. */
function labelOf(transcript: unknown): string | null {
  if (typeof transcript !== 'string' || transcript.trim().length === 0) {
    return null;
  }
  const trimmed = transcript.trim();
  return trimmed.length > 70 ? `${trimmed.slice(0, 70)}…` : trimmed;
}

function progressOf(row: Record<string, unknown>): ClipProgressDto | null {
  const percent = row.progress_percent;
  if (typeof percent !== 'number') {
    return null;
  }
  return {
    percent,
    note: typeof row.progress_note === 'string' ? row.progress_note : '',
    atMs: typeof row.progress_at_ms === 'number' ? row.progress_at_ms : 0
  };
}

/**
 * The feedback queue, newest first.
 *
 * The access rule already scopes this to the caller, so there is nothing to
 * filter by here.
 */
export async function feedbackQueue(nowMs = Date.now()): Promise<QueuedClip[]> {
  const rows = await backend
    .collection(COLLECTION)
    .getFullList<Record<string, unknown>>({ sort: '-recorded_at_ms' });

  return rows.map((row) => {
    const progress = progressOf(row);
    return {
      id: String(row.id),
      recordedAtMs: typeof row.recorded_at_ms === 'number' ? row.recorded_at_ms : 0,
      durationMs: typeof row.duration_ms === 'number' ? row.duration_ms : 0,
      state: typeof row.state === 'string' ? row.state : 'unknown',
      label: labelOf(row.transcript),
      progress,
      isStalled: looksStalled(progress, nowMs)
    };
  });
}
