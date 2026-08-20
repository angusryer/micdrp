/**
 * Reading and writing clips on the backend.
 *
 * Claiming is the interesting part. Two runs must never work the same clip
 * (INV-DOG-012), and a run that dies must not strand its clip forever — so a
 * claim carries the time it was made and becomes reclaimable once stale.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import PocketBase from 'pocketbase';
// Imported by file rather than through the `shared` barrel: Node's ESM
// loader needs explicit extensions, and the barrel's own imports are
// extensionless for Metro's benefit. This is the only file the loop needs.
import type { ScreenVisit } from '../../packages/shared/src/dto/dogfood.ts';

const run = promisify(execFile);

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

/** The 1Password item holding the app login the clips belong to. */
const OP_ITEM = 'op://micdrp/wi5e4xd6dl6zn6wyx7u4e5m3ra';

/**
 * Read one field out of 1Password.
 *
 * Credentials come from the vault rather than the environment so there is no
 * plaintext password sitting in a shell profile. The AI_MICDRP_RW service
 * account is scoped to the micdrp vault and nothing else.
 */
async function fromVault(field: string): Promise<string> {
  const token = process.env.AI_MICDRP_RW ?? process.env.OP_SERVICE_ACCOUNT_TOKEN;
  if (!token) {
    throw new Error('AI_MICDRP_RW is not set — cannot read the app login');
  }
  const { stdout } = await run('op', ['read', `${OP_ITEM}/${field}`], {
    env: { ...process.env, OP_SERVICE_ACCOUNT_TOKEN: token }
  });
  return stdout.trim();
}

/**
 * Sign in as the account the clips belong to.
 *
 * Clips are owner-scoped server-side, so the loop reads them as their owner
 * rather than as an administrator — it sees exactly what the maintainer sees
 * and nothing more.
 */
export async function signIn(pb: PocketBase): Promise<void> {
  const email = process.env.DOGFOOD_EMAIL ?? (await fromVault('username'));
  const password = process.env.DOGFOOD_PASSWORD ?? (await fromVault('password'));
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
