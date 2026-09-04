/**
 * The sample as the server holds it: taking one back, and asking whether
 * one is there at all.
 *
 * Asking matters more than it looks. The index of what has been shared
 * lives on the device, so a reinstall — or a second device — starts out
 * believing nothing has been shared, and would offer to share a take that
 * is already up. That is minutes of audio uploaded twice to answer
 * nothing (INV-DOG-034), so the row asks the server once when it opens.
 */
import { TAKE_SAMPLES_COLLECTION } from 'shared';

import { backend } from '../lib/backend';
import {
  dropPending,
  forgetShared,
  markShared,
  sharedTake,
  type SharedTake
} from './shares';
import { releaseSource } from './takeSource';

/** PocketBase says 404 when a record is not there. */
function isGone(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { status?: number }).status === 404
  );
}

/**
 * Unshare. The record goes and the copy of the audio goes with it; the
 * take itself, its audio and its reading are untouched (INV-DOG-035).
 *
 * A share still in the queue is dropped before it can be sent, so
 * withdrawing something that never left works the same way as withdrawing
 * something that did.
 *
 * Returns the reason it could not be withdrawn, or null. A failure keeps
 * the take marked as shared rather than forgetting it locally: forgetting
 * would leave a recording on the server that the control no longer offers
 * any way to remove.
 */
export async function withdrawTake(noteId: string): Promise<string | null> {
  const queued = dropPending(noteId);
  if (queued != null) {
    await releaseSource(queued);
  }
  const shared = sharedTake(noteId);
  if (shared == null) {
    return null;
  }
  try {
    await backend.collection(TAKE_SAMPLES_COLLECTION).delete(shared.sampleId);
  } catch (error) {
    if (!isGone(error)) {
      return error instanceof Error ? error.message : String(error);
    }
    // Already gone is the outcome that was asked for.
  }
  forgetShared(noteId);
  return null;
}

/**
 * Ask the server whether this take is already shared, and make the local
 * index agree with the answer.
 *
 * Best effort by design: offline, the index stands as it is. Being wrong
 * about this offline costs a duplicate at worst, and refusing to show the
 * row until the network answers costs every visit.
 */
export async function refreshShared(noteId: string): Promise<SharedTake | null> {
  let found;
  try {
    found = await backend
      .collection(TAKE_SAMPLES_COLLECTION)
      .getFirstListItem<{ id: string; shared_at_ms: number }>(
        `note_id = "${noteId}"`
      );
  } catch (error) {
    if (!isGone(error)) {
      return sharedTake(noteId);
    }
    // The server is sure there is none. Only then is forgetting right: a
    // record removed elsewhere should stop being claimed here.
    forgetShared(noteId);
    return null;
  }
  const shared = { sampleId: found.id, sharedAtMs: found.shared_at_ms };
  markShared(noteId, shared);
  return shared;
}
