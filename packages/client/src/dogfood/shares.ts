/**
 * What has been handed over, and what is still waiting to be.
 *
 * Two records, kept apart on purpose. The queue is work outstanding; the
 * index is the answer to "is this take already shared", which the details
 * sheet asks on every visit and must answer without a round trip — a row
 * that takes a second to decide whether it offers to share or to withdraw
 * is a row that gets tapped in the wrong state.
 *
 * Both persist, for the same reason the clip queue does (INV-DOG-033): a
 * tap is the last thing the maintainer should have to do about a share,
 * so nothing may be lost by closing the app on a bad connection.
 */
import type { TakeReadingDto } from 'shared';

import { getJSON, setJSON } from '../data/store';

/** MMKV keys. Namespaced with the clip queue's, which they sit beside. */
const QUEUE_KEY = 'dogfood.shares';
const INDEX_KEY = 'dogfood.shared';

/** A take marked to share, with everything the upload needs. */
export interface PendingShare {
  noteId: string;
  title: string;
  /**
   * A path on this device, always — never a signed URL.
   *
   * A take whose only copy is on the server is fetched down when the share
   * is tapped rather than when the queue drains: a file token lives about
   * two minutes, and a share can sit in the queue for days.
   */
  audioUri: string;
  /** True when audioUri is a copy this queue made and must clean up. */
  isTemp: boolean;
  /** The take's own format, so the corpus gets a file it can open. */
  audioExt: string;
  durationMs: number;
  sampleRateHz: number;
  reading: TakeReadingDto;
  appVersion: string;
  buildNumber: number;
  bundleId: string | null;
  sharedAtMs: number;
}

/** A take that reached the server, and the sample it became. */
export interface SharedTake {
  sampleId: string;
  sharedAtMs: number;
}

type Index = Record<string, SharedTake>;

const readQueue = (): PendingShare[] => getJSON<PendingShare[]>(QUEUE_KEY) ?? [];
const writeQueue = (shares: PendingShare[]): void => setJSON(QUEUE_KEY, shares);
const readIndex = (): Index => getJSON<Index>(INDEX_KEY) ?? {};
const writeIndex = (index: Index): void => setJSON(INDEX_KEY, index);

/** What is marked to share but not yet accepted, oldest first. */
export function pendingShares(): PendingShare[] {
  return readQueue();
}

/** The share waiting for one take, if there is one. */
export function pendingShare(noteId: string): PendingShare | null {
  return readQueue().find((share) => share.noteId === noteId) ?? null;
}

/**
 * Mark a take to share. A take already queued is left alone rather than
 * queued twice: a second copy of minutes of audio answers nothing the
 * first did not (INV-DOG-034).
 */
export function queueShare(share: PendingShare): void {
  if (pendingShare(share.noteId) != null) {
    return;
  }
  writeQueue([...readQueue(), share]);
}

/** Take a share out of the queue. Says whether there was one. */
export function dropPending(noteId: string): PendingShare | null {
  const share = pendingShare(noteId);
  if (share != null) {
    writeQueue(readQueue().filter((queued) => queued.noteId !== noteId));
  }
  return share;
}

/** The sample a take became, or null if it has not been shared. */
export function sharedTake(noteId: string): SharedTake | null {
  return readIndex()[noteId] ?? null;
}

/** Note that a take is now on the server. */
export function markShared(noteId: string, shared: SharedTake): void {
  writeIndex({ ...readIndex(), [noteId]: shared });
}

/** Note that a take is no longer on the server. */
export function forgetShared(noteId: string): void {
  writeIndex(
    Object.fromEntries(
      Object.entries(readIndex()).filter(([id]) => id !== noteId)
    )
  );
}

/** Test seam. Never called by app code. */
export function resetSharesForTests(): void {
  writeQueue([]);
  writeIndex({});
}
