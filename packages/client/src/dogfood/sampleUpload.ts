/**
 * Getting a marked take to the server, and not sending it twice.
 *
 * Split from the deciding next door because they fail differently: this is
 * the part that a bad connection, a signed-out session or a busy
 * microphone can stop, and all three want the same answer — leave it
 * queued and try again later (INV-DOG-033).
 */
import { TAKE_SAMPLES_COLLECTION } from 'shared';

import { isBusy } from '../app/activity';
import { backend } from '../lib/backend';
import { requireUserId } from '../data/currentUser';
import {
  dropPending,
  markShared,
  pendingShares,
  type PendingShare
} from './shares';
import { releaseSource } from './takeSource';

/** Why the last share did not go, if it did not. Read by the row. */
let lastError: string | null = null;

export function lastShareError(): string | null {
  return lastError;
}

/** Say why a share could not even be marked. Only the deciding calls this. */
export function noteShareProblem(problem: string | null): void {
  lastError = problem;
}

async function post(share: PendingShare): Promise<string> {
  const userId = await requireUserId();
  const form = new FormData();
  form.append('user', userId);
  // A file descriptor object, so the audio streams off disk rather than
  // being read into memory first — a take is minutes long.
  form.append('audio', {
    uri: share.audioUri,
    name: `take.${share.audioExt}`,
    type: `audio/${share.audioExt}`
  });
  form.append('note_id', share.noteId);
  form.append('title', share.title);
  form.append('duration_ms', String(share.durationMs));
  form.append('sample_rate_hz', String(share.sampleRateHz));
  form.append('reading', JSON.stringify(share.reading));
  form.append('app_version', share.appVersion);
  form.append('build_number', String(share.buildNumber));
  form.append('bundle_id', share.bundleId ?? '');
  form.append('shared_at_ms', String(share.sharedAtMs));
  form.append('state', 'shared');

  const record = await backend
    .collection(TAKE_SAMPLES_COLLECTION)
    .create<{ id: string }>(form);
  return record.id;
}

/**
 * Nothing runs twice at once; a second call while one is in flight waits.
 *
 * Not defensive tidiness. Sharing kicks off a send of its own, and so do
 * the app launching and a take ending — two of those overlapping both read
 * the same queue, both find the share still in it, and both upload it. The
 * take is shared once (INV-DOG-034), and this is what makes that true when
 * the calls overlap rather than only when they are spaced out.
 */
let inFlight: Promise<number> | null = null;

/**
 * Send everything marked, oldest first.
 *
 * Nothing goes up while the microphone is held: a take is a whole audio
 * file on a phone's uplink, and the take being shared is worth less than
 * the take being sung (INV-DOG-037).
 */
export async function flushShares(): Promise<number> {
  if (isBusy()) {
    return 0;
  }
  if (inFlight != null) {
    return inFlight;
  }
  inFlight = (async () => {
    let sent = 0;
    for (const share of pendingShares()) {
      let sampleId;
      try {
        sampleId = await post(share);
        lastError = null;
      } catch (error) {
        // Offline, signed out, or the server is unhappy. Keep it queued and
        // stop, rather than working through the backlog a little more slowly.
        lastError = error instanceof Error ? error.message : String(error);
        break;
      }
      markShared(share.noteId, {
      sampleId,
      sharedAtMs: share.sharedAtMs,
      readingHash: share.readingHash
    });
      dropPending(share.noteId);
      await releaseSource(share);
      sent += 1;
    }
    return sent;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
