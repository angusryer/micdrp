/**
 * Saying how far a clip has got.
 *
 * The loop runs on a machine nobody is looking at, often while the maintainer
 * is elsewhere. Without this a claimed clip is indistinguishable from a stuck
 * one, and the only way to tell is to go and read a log.
 *
 * Every failure here is swallowed. Progress is a convenience; a loop that
 * abandoned real work because it could not describe itself would be worse than
 * one that says nothing at all (INV-DOG-024).
 */
import type PocketBase from 'pocketbase';
// Imported by file rather than through the `shared` barrel: Node's ESM loader
// needs explicit extensions.
import {
  progressPercent,
  type ClipPhase
} from '../../packages/shared/src/dto/clipProgress.ts';

const COLLECTION = 'dogfood_clips';

/** Reports for one clip, refusing to let a percentage go backwards. */
export function progressReporter(pb: PocketBase, clipId: string) {
  let highest = 0;

  return async function report(
    phase: ClipPhase,
    note: string,
    done = 0,
    total = 0
  ): Promise<void> {
    const percent = Math.max(highest, progressPercent(phase, done, total));
    highest = percent;
    try {
      await pb.collection(COLLECTION).update(clipId, {
        progress_percent: percent,
        progress_note: note.slice(0, 120),
        progress_at_ms: Date.now()
      });
    } catch {
      // Said above: describing the work must never cost it.
    }
  };
}

export type Report = ReturnType<typeof progressReporter>;
