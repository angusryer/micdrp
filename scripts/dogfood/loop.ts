/**
 * The agent loop: claim a clip, hear it, read it, build what is safe, ship it.
 *
 * What keeps it from doing damage unattended — the lock, the failure count,
 * the halt — lives in guard.ts. This file is the work.
 *
 * Spec: .harnex/project/specs/domains/dogfood/commands.yml
 */
// Imported by file rather than through the `shared` barrel: Node's ESM
// loader needs explicit extensions, and the barrel's own imports are
// extensionless for Metro's benefit. This is the only file the loop needs.
import { gateRequest, type ChangeRequestDto } from '../../packages/shared/src/dto/dogfood.ts';

import { halt, isHalted, readFailures, releaseLock, takeLock, writeFailures, HALT_AFTER } from './guard.ts';
import { claimOldest, connect, markDelivered, signIn, storeRequests } from './clips.ts';
import { discardCancelled, isStillWanted } from './withdraw.ts';
import { deliverBatch } from './deliver.ts';
import { progressReporter } from './progress.ts';
import { understand } from './understand.ts';
import { isGone, isTransient, withRetry } from './transient.ts';
import { describeOutcome } from './report.ts';
import { buildRequests } from './build.ts';
import { installDeps, prepareWorktree } from './worktree.ts';


type Options = { dryRun: boolean; noDeliver: boolean };

/**
 * One pass. Returns whether it did anything worth reporting.
 *
 * A clip with nothing actionable in it is a success, not a failure: the
 * maintainer said something that was not a change request, which is fine.
 */
export async function runOnce(options: Options): Promise<boolean> {
  const halted = isHalted();
  if (halted) {
    console.error(`dogfood: halted — ${halted}`);
    return false;
  }

  const pb = connect();
  await withRetry(() => signIn(pb));
  const runId = `run-${Date.now()}`;
  const clip = await withRetry(() => claimOldest(pb, runId));
  if (!clip) {
    // One line even when idle. A silent log is indistinguishable from a loop
    // that has stopped, and the whole value of this running unattended is
    // being able to trust that it is.
    console.log(`${new Date().toISOString()} dogfood: nothing waiting`);
    return false;
  }
  console.log(`${new Date().toISOString()} dogfood: working on ${clip.id}`);
  const report = progressReporter(pb, clip.id);
  try {
    await report('claimed', 'picked up');
    return await processClip(pb, clip, report, options);
  } finally {
    // However this ended — delivered, withdrawn, or thrown — the estimate
    // stops. A bar still creeping after the run is over is a lie about a
    // process that is not there any more (INV-DOG-029).
    report.stop();
  }
}

/** Everything done with a clip once it is claimed and being reported on. */
async function processClip(
  pb: ReturnType<typeof connect>,
  clip: Awaited<ReturnType<typeof claimOldest>> & object,
  report: ReturnType<typeof progressReporter>,
  options: Options
): Promise<boolean> {
  const requests = await understand(pb, clip, report);
  await storeRequests(pb, clip.id, requests);

  const buildable = requests.filter((r) => gateRequest(r).mayBuild);

  // Only pay for the worktree when there is something to build in it.
  if (buildable.length > 0 && !options.dryRun) {
    await prepareWorktree();
    await installDeps();
  }

  const built = await buildRequests(requests, options.dryRun, report, () =>
    isStillWanted(pb, clip.id)
  );

  // Asked plainly rather than left to a write failing: whether work ships is
  // too consequential to learn from an exception. Anything built for a
  // withdrawn clip is discarded with the checkout on the next run.
  if (!(await isStillWanted(pb, clip.id))) {
    console.log('dogfood: the remark was withdrawn; nothing will be delivered');
    await discardCancelled(pb, clip.id);
    return true;
  }

  await storeRequests(pb, clip.id, requests);

  if (options.dryRun || options.noDeliver || built.length === 0) {
    await markDelivered(pb, clip.id);
    console.log(`dogfood: ${requests.length} request(s), ${built.length} built, nothing delivered`);
    return true;
  }

  await report('delivering', 'shipping it');
  const outcome = await deliverBatch(built, clip.build_number);

  // Recorded on the push, not on the publish. The commit is public the
  // moment it lands; a resume must never set about building it again
  // because a later, retryable step failed (INV-DOG-023).
  if (outcome.pushed) {
    for (const request of built) {
      request.state = 'delivered';
    }
    await storeRequests(pb, clip.id, requests);
    await markDelivered(pb, clip.id);
  }

  if (!outcome.delivered) {
    throw new Error(`delivery failed: ${outcome.reason}`);
  }
  if (!outcome.published && outcome.route === 'bundle') {
    // The changes are on main and reach the device on the next publish.
    console.error(`dogfood: ${outcome.reason}`);
  }
  console.log(describeOutcome(outcome, requests.length, built.length));
  return true;
}

/** Run a pass, counting failures towards the halt. */
export async function guardedRun(options: Options): Promise<void> {
  if (!takeLock()) {
    // Silent: an overlapping tick is routine, not a problem worth logging on
    // every interval.
    return;
  }
  try {
    await runOnce(options);
    writeFailures(0);
  } catch (error) {
    // A backend that is restarting is not a loop that is failing at its job.
    // Nothing was attempted and nothing was damaged, and the next tick will
    // do the same work successfully — so it costs no lives. Counting it spent
    // two of three during one routine deploy (INV-DOG-025).
    if (isTransient(error)) {
      console.error(`dogfood: backend unreachable, will try again — ${String(error)}`);
      return;
    }
    // Someone removed the remark while it was being worked on. That is a
    // decision, not a fault, and must not spend a life (INV-DOG-026).
    if (isGone(error)) {
      console.log('dogfood: the clip was removed; stopping work on it');
      return;
    }
    const failures = readFailures() + 1;
    writeFailures(failures);
    console.error(`dogfood: run failed (${failures}) — ${String(error)}`);
    if (failures >= HALT_AFTER) {
      halt(`${HALT_AFTER} consecutive runs failed; last: ${String(error)}`);
    }
  } finally {
    releaseLock();
  }
}
