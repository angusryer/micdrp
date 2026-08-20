/**
 * Reading and writing clips on the backend.
 *
 * Claiming is the interesting part. Two runs must never work the same clip
 * (INV-DOG-012), and a run that dies must not strand its clip forever — so a
 * claim carries the time it was made and becomes reclaimable once stale.
 */
import PocketBase from 'pocketbase';
import type { ScreenVisit } from 'shared';

const COLLECTION = 'dogfood_clips';

/** How long before a claim is assumed abandoned. Longer than any real run. */
export const STALE_CLAIM_MS = 30 * 60 * 1000;

export interface Clip {
  id: string;
  audio: string;
  duration_ms: number;
  screen_trail: ScreenVisit[];
  app_version: string;
  build_number: number;
  bundle_id: string | null;
  transcript: string | null;
  state: string;
}

export function connect(): PocketBase {
  const url = process.env.BACKEND_URL;
  if (!url) {
    throw new Error('BACKEND_URL is not set');
  }
  return new PocketBase(url);
}

export async function signIn(pb: PocketBase): Promise<void> {
  const email = process.env.DOGFOOD_EMAIL;
  const password = process.env.DOGFOOD_PASSWORD;
  if (!email || !password) {
    throw new Error('DOGFOOD_EMAIL and DOGFOOD_PASSWORD must be set');
  }
  await pb.collection('users').authWithPassword(email, password);
}

/**
 * Take the oldest clip nobody is working on.
 *
 * The filter includes stale claims so a run that died releases its clip, and
 * the write is conditional on the state we read — PocketBase rejects nothing
 * here, so the claim carries our run id and a second run that raced us will
 * see a different owner on its next read.
 */
export async function claimOldest(
  pb: PocketBase,
  runId: string
): Promise<Clip | null> {
  const staleBefore = Date.now() - STALE_CLAIM_MS;
  const filter =
    `state = "uploaded" || (state = "claimed" && claimed_at_ms < ${staleBefore})`;

  const found = await pb
    .collection(COLLECTION)
    .getList<Clip>(1, 1, { filter, sort: 'recorded_at_ms' })
    .catch(() => null);

  const clip = found?.items[0];
  if (!clip) {
    return null;
  }

  await pb.collection(COLLECTION).update(clip.id, {
    state: 'claimed',
    claimed_at_ms: Date.now(),
    claimed_by: runId
  });

  const confirmed = await pb.collection(COLLECTION).getOne<Clip & { claimed_by: string }>(clip.id);
  // Someone else won the race between our read and our write.
  return confirmed.claimed_by === runId ? confirmed : null;
}

export async function storeTranscript(
  pb: PocketBase,
  clipId: string,
  transcript: string,
  confidence: number | null
): Promise<void> {
  await pb.collection(COLLECTION).update(clipId, {
    transcript,
    transcript_confidence: confidence,
    state: 'interpreted'
  });
}

export async function storeRequests(
  pb: PocketBase,
  clipId: string,
  requests: unknown[]
): Promise<void> {
  await pb.collection(COLLECTION).update(clipId, { requests });
}

export async function markDelivered(pb: PocketBase, clipId: string): Promise<void> {
  await pb.collection(COLLECTION).update(clipId, { state: 'delivered' });
}

/** A fetchable URL for the clip's audio, minted now rather than stored. */
export function audioUrl(pb: PocketBase, clip: Clip): string {
  return pb.files.getURL({ id: clip.id, collectionName: COLLECTION }, clip.audio);
}
