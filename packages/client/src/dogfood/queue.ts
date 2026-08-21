/**
 * What the loop is doing with the feedback already sent.
 *
 * The loop runs on a machine elsewhere, so a clip that has been picked up
 * looks exactly like one that is stuck. This reads back what it says about
 * itself (INV-DOG-024).
 */
import { backend } from '../lib/backend';
import { CANCELLED, isInFlight, looksStalled, type ClipProgressDto } from 'shared';

const COLLECTION = 'dogfood_clips';

export interface QueuedClip {
  id: string;
  recordedAtMs: number;
  durationMs: number;
  state: string;
  /** Withdrawn, and waiting for the run holding it to let go. */
  isCancelling: boolean;
  /**
   * What to call this remark in a list.
   *
   * The name the loop gave it when it read it, or failing that the opening
   * words of the transcript. A list of titles reads as a list of things; a
   * list of transcripts reads as a wall of speech.
   */
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
      isCancelling: row.state === CANCELLED,
      label:
        typeof row.title === 'string' && row.title.trim().length > 0
          ? row.title.trim()
          : labelOf(row.transcript),
      progress,
      isStalled: looksStalled(progress, nowMs)
    };
  });
}

/**
 * Withdraw a remark.
 *
 * If nobody is working on it, it goes outright — there is no one to tell, and
 * the record takes its audio with it.
 *
 * If a run holds it, it is marked cancelled instead. Taking something away
 * from the agent mid-task and leaving it to work out what happened is the
 * wrong shape: a missing record could as easily be a fault as a decision, and
 * those want opposite responses. The run reads the state as an instruction,
 * stops, and removes the clip itself (INV-DOG-026).
 */
export async function discardClip(clip: {
  id: string;
  state: string;
}): Promise<void> {
  if (isInFlight(clip.state)) {
    await backend.collection(COLLECTION).update(clip.id, { state: CANCELLED });
    return;
  }
  await backend.collection(COLLECTION).delete(clip.id);
}
