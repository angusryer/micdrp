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
import {
  readingFingerprint,
  TAKE_SAMPLES_COLLECTION,
  type TakeReadingDto
} from 'shared';

import { backend } from '../lib/backend';
import {
  dropPending,
  forgetShared,
  replaceShared,
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
  // Every reading of this take, not only the last. One control says
  // whether the take is shared, so it cannot leave earlier readings of it
  // on the server after saying it is not (INV-DOG-035).
  for (const sampleId of shared.sampleIds) {
    try {
      await backend.collection(TAKE_SAMPLES_COLLECTION).delete(sampleId);
    } catch (error) {
      if (!isGone(error)) {
        return error instanceof Error ? error.message : String(error);
      }
      // Already gone is the outcome that was asked for.
    }
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
  type Row = { id: string; shared_at_ms: number; reading: TakeReadingDto };
  let rows;
  try {
    rows = await backend
      .collection(TAKE_SAMPLES_COLLECTION)
      .getFullList<Row>({ filter: `note_id = "${noteId}"`, sort: 'shared_at_ms' });
  } catch {
    // Offline, or the server is unhappy. The index stands as it is: being
    // wrong about this offline costs a duplicate at worst, and refusing to
    // show the control until the network answers costs every visit.
    return sharedTake(noteId);
  }
  if (rows.length === 0) {
    // The server is sure there is none. Only then is forgetting right: a
    // record removed elsewhere should stop being claimed here.
    forgetShared(noteId);
    return null;
  }
  const newest = rows[rows.length - 1];
  const shared: SharedTake = {
    sampleIds: rows.map((row) => row.id),
    sharedAtMs: newest.shared_at_ms,
    // Recomputed from what the server holds rather than stored in a column:
    // the fingerprint is a pure function of the reading, so the server
    // already has everything needed to work it out.
    readingHash: readingFingerprint(newest.reading)
  };
  replaceShared(noteId, shared);
  return shared;
}
