/**
 * Withdrawing a remark that a run is already holding.
 *
 * Split from clips.ts, which owns claiming and storing. The distinction that
 * matters here is between an instruction and an accident: a cancelled clip is
 * the maintainer saying stop, and a backend briefly away is neither a
 * withdrawal nor a fault.
 */
import type PocketBase from 'pocketbase';

// Imported by file rather than through the barrel: Node's ESM loader needs
// explicit extensions.
import { CANCELLED } from '../../packages/shared/src/dto/clipProgress.ts';
import { isGone } from '../../packages/shared/src/transient.ts';

const COLLECTION = 'dogfood_clips';

/**
 * Whether the maintainer still wants this clip built.
 *
 * They say so plainly: a withdrawn clip is marked cancelled, which is an
 * instruction rather than something for a run to deduce. A record that has
 * simply gone is honoured too, as a backstop.
 *
 * A backend briefly away is neither, and must never be read as a withdrawal
 * (INV-DOG-025) — the answer then is "carry on".
 */
export async function isStillWanted(
  pb: PocketBase,
  clipId: string
): Promise<boolean> {
  try {
    const clip = await pb
      .collection(COLLECTION)
      .getOne<{ state: string }>(clipId, { fields: 'id,state' });
    return clip.state !== CANCELLED;
  } catch (error) {
    return !isGone(error);
  }
}

/** Let go of a clip the maintainer withdrew, taking its audio with it. */
export async function discardCancelled(
  pb: PocketBase,
  clipId: string
): Promise<void> {
  try {
    await pb.collection(COLLECTION).delete(clipId);
  } catch {
    // Already gone, or the backend is away. Either way the run is done with
    // it, and the next one will not pick up a cancelled clip.
  }
}
