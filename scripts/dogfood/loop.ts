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
import { audioUrl, claimOldest, connect, markDelivered, signIn, storeRequests, storeTranscript } from './clips.ts';
import { deliverBatch } from './deliver.ts';
import { describeOutcome } from './report.ts';
import { buildRequests } from './build.ts';
import { installDeps, prepareWorktree } from './worktree.ts';
import { interpret } from './interpret.ts';
import { transcribe } from './transcribe.ts';

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
  await signIn(pb);
  const runId = `run-${Date.now()}`;
  const clip = await claimOldest(pb, runId);
  if (!clip) {
    // One line even when idle. A silent log is indistinguishable from a loop
    // that has stopped, and the whole value of this running unattended is
    // being able to trust that it is.
    console.log(`${new Date().toISOString()} dogfood: nothing waiting`);
    return false;
  }
  console.log(`${new Date().toISOString()} dogfood: working on ${clip.id}`);

  // Transcribe once and keep it: a re-run must not pay again (INV-DOG-013).
  let transcript = clip.transcript;
  if (!transcript) {
    const heard = await transcribe(audioUrl(pb, clip));
    transcript = heard.text;
    await storeTranscript(pb, clip.id, heard.text, heard.confidence);
  }

  // Reading it is paid for once too (INV-DOG-016). A run reclaimed after it
  // died mid-build already has its requests; re-reading the same words would
  // cost again and could land on a different split of them.
  const requests: ChangeRequestDto[] = clip.requests?.length
    ? clip.requests
    : (await interpret(transcript, clip.screen_trail ?? [])).map((r, i) => ({
        ...r,
        id: `${clip.id}-${i}`,
        clipId: clip.id,
        state: 'proposed'
      }));
  await storeRequests(pb, clip.id, requests);

  const buildable = requests.filter((r) => gateRequest(r).mayBuild);

  // Only pay for the worktree when there is something to build in it.
  if (buildable.length > 0 && !options.dryRun) {
    await prepareWorktree();
    await installDeps();
  }

  const built = await buildRequests(requests, options.dryRun);

  await storeRequests(pb, clip.id, requests);

  if (options.dryRun || options.noDeliver || built.length === 0) {
    await markDelivered(pb, clip.id);
    console.log(`dogfood: ${requests.length} request(s), ${built.length} built, nothing delivered`);
    return true;
  }

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
