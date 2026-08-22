/**
 * Saying how far a clip has got.
 *
 * The loop runs on a machine nobody is looking at, often while the maintainer
 * is elsewhere. Without this a claimed clip is indistinguishable from a stuck
 * one, and the only way to tell is to go and read a log.
 *
 * A milestone is a fact and lands immediately. Between milestones the bar is
 * moved by an estimate, because one request is ten to twenty minutes of an
 * agent working and a harness running, and a bar that sits still that long is
 * read as a hang — the exact thing this was added to rule out (INV-DOG-029).
 *
 * The estimate is careful about one thing above all: it never touches the
 * time the clip was last heard from (INV-DOG-030). That timestamp is what the
 * stall warning reads, and it is the only signal that tells slow work from
 * dead work. A guess that refreshed it would keep a hung run looking healthy
 * for exactly as long as it was hung.
 *
 * Every failure here is swallowed. Progress is a convenience; a loop that
 * abandoned real work because it could not describe itself would be worse
 * than one that says nothing at all (INV-DOG-024).
 */
import type PocketBase from 'pocketbase';
// Imported by file rather than through the `shared` barrel: Node's ESM loader
// needs explicit extensions.
import {
  creptPercent,
  nextMilestone,
  progressPatch,
  progressPercent,
  type ClipPhase
} from '../../packages/shared/src/dto/clipProgress.ts';

const COLLECTION = 'dogfood_clips';

/** How often the estimate is refreshed while a step runs. */
const CREEP_EVERY_MS = 20 * 1000;

/** What a step is assumed to take when nothing better is known. */
const TYPICAL_STEP_MS = 6 * 60 * 1000;

/** Reports for one clip, refusing to let a percentage go backwards. */
export function progressReporter(pb: PocketBase, clipId: string) {
  let highest = 0;
  let creeping: NodeJS.Timeout | null = null;

  /**
   * `heardFrom` false is the whole point of the estimate: the bar moves, the
   * clock the stall warning reads does not (INV-DOG-030).
   */
  async function write(
    percent: number,
    note: string,
    heardFrom: boolean
  ): Promise<void> {
    highest = Math.max(highest, percent);
    try {
      await pb
        .collection(COLLECTION)
        .update(clipId, progressPatch(highest, note, heardFrom, Date.now()));
    } catch {
      // Said above: describing the work must never cost it.
    }
  }

  function stopCreeping(): void {
    if (creeping) {
      clearInterval(creeping);
      creeping = null;
    }
  }

  async function report(
    phase: ClipPhase,
    note: string,
    done = 0,
    total = 0,
    typicalMs = TYPICAL_STEP_MS
  ): Promise<void> {
    stopCreeping();
    const percent = Math.max(highest, progressPercent(phase, done, total));
    await write(percent, note, true);

    const ceiling = nextMilestone(phase, done, total);
    if (!(ceiling > percent)) {
      return;
    }
    const startedAt = Date.now();
    creeping = setInterval(() => {
      void write(
        creptPercent(percent, ceiling, Date.now() - startedAt, typicalMs),
        note,
        false
      );
    }, CREEP_EVERY_MS);
    // The estimate must never be the reason the process stays alive.
    creeping.unref?.();
  }

  /** Called when the run is over, however it ended. */
  report.stop = stopCreeping;

  return report;
}

export type Report = ReturnType<typeof progressReporter>;
