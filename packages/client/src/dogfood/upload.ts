/**
 * Getting a finished clip off the device, and not losing it if that fails.
 *
 * The queue is persisted rather than held in memory (INV-DOG-004). A remark is
 * spoken once; the maintainer will not know it vanished, and will not say it
 * again. So the clip stays on disk and in the queue until the server has
 * actually accepted it, surviving a relaunch, a dead connection, and a crash.
 */
import { unlink } from '@dr.pogodin/react-native-fs';

import { backend } from '../lib/backend';
import { requireUserId } from '../data/currentUser';
import { getJSON, setJSON } from '../data/store';
import type { PendingClip } from './types';

/** MMKV key for the queue. */
const QUEUE_KEY = 'dogfood.pending';

/**
 * Why the last upload failed, if it did.
 *
 * A queue that will not drain is invisible from the outside: the clip is on
 * the device, the server has nothing, and neither end can say why. Settings
 * reads this.
 */
let lastError: string | null = null;

export function lastUploadError(): string | null {
  return lastError;
}

/** The collection clips land in. Keep in step with backend/migrations. */
const CLIPS_COLLECTION = 'dogfood_clips';

const readQueue = (): PendingClip[] => getJSON<PendingClip[]>(QUEUE_KEY) ?? [];
const writeQueue = (clips: PendingClip[]): void => setJSON(QUEUE_KEY, clips);

/** Queue a finished clip. It is on disk; this makes it survive a relaunch. */
export function enqueue(clip: PendingClip): void {
  writeQueue([...readQueue(), clip]);
}

/** What is recorded but not yet accepted, oldest first. */
export function listPending(): PendingClip[] {
  return readQueue();
}

async function post(clip: PendingClip): Promise<void> {
  // The collection's create rule is `user = @request.auth.id`, so a record
  // without an owner is rejected outright. Omitting it meant every clip
  // recorded on a device was refused and stayed queued forever.
  const userId = await requireUserId();

  const form = new FormData();
  form.append('user', userId);
  // React Native's FormData takes a file descriptor object here and streams
  // the file off disk, rather than reading it into memory first.
  form.append('audio', {
    uri: clip.audioPath,
    name: 'clip.m4a',
    type: 'audio/m4a'
  });
  form.append('duration_ms', String(clip.durationMs));
  form.append('screen_trail', JSON.stringify(clip.screenTrail));
  form.append('app_version', clip.appVersion);
  form.append('build_number', String(clip.buildNumber));
  form.append('bundle_id', clip.bundleId ?? '');
  form.append('recorded_at_ms', String(clip.recordedAtMs));
  form.append('state', 'uploaded');

  await backend.collection(CLIPS_COLLECTION).create(form);
}

/**
 * Send one clip.
 *
 * The local audio is deleted only after the server has accepted it, and the
 * clip leaves the queue only then too — the two must not drift apart, or a
 * retry would upload a file that is no longer there.
 */
export async function uploadOne(clip: PendingClip): Promise<boolean> {
  try {
    await post(clip);
    lastError = null;
  } catch (error) {
    // Offline, signed out, or the server is unhappy. Keep it queued; the next
    // flush tries again. Nothing interrupts the maintainer, but the reason is
    // kept so settings can show why a queue is stuck.
    lastError = error instanceof Error ? error.message : String(error);
    return false;
  }

  writeQueue(readQueue().filter((queued) => queued.id !== clip.id));
  try {
    await unlink(clip.audioPath);
  } catch {
    // The record is up, which is what mattered. A stray file is not worth
    // reporting or retrying.
  }
  return true;
}

/**
 * Try everything waiting, oldest first.
 *
 * Stops at the first failure rather than hammering a dead connection with the
 * whole backlog. Returns how many got through.
 */
export async function flushPending(): Promise<number> {
  let sent = 0;
  for (const clip of readQueue()) {
    // Sequential on purpose: ordered oldest-first, and stops at the first
    // failure rather than hammering a dead connection with the whole backlog.
    if (!(await uploadOne(clip))) {
      break;
    }
    sent += 1;
  }
  return sent;
}

/** Test seam. Never called by app code. */
export function resetQueueForTests(): void {
  writeQueue([]);
}
