/**
 * The agent loop: claim a clip, hear it, read it, build what is safe, ship it.
 *
 * The most important thing in this file is the halt (INV-DOG-010). An
 * automated process that keeps going after repeated failure does more damage
 * than one that stops and says so — especially this one, which commits to main
 * and publishes to a phone.
 *
 * Spec: .harnex/project/specs/domains/dogfood/commands.yml
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
// Imported by file rather than through the `shared` barrel: Node's ESM
// loader needs explicit extensions, and the barrel's own imports are
// extensionless for Metro's benefit. This is the only file the loop needs.
import { gateRequest, type ChangeRequestDto } from '../../packages/shared/src/dto/dogfood.ts';

import { audioUrl, claimOldest, connect, markDelivered, signIn, storeRequests, storeTranscript } from './clips.ts';
import { deliverBatch } from './deliver.ts';
import { executeRequest } from './execute.ts';
import { installDeps, prepareWorktree } from './worktree.ts';
import { interpret } from './interpret.ts';
import { transcribe } from './transcribe.ts';

const REPO = new URL('../..', import.meta.url).pathname;
const HALT_FILE = join(REPO, '.dogfood-halt');
const LOCK_FILE = join(REPO, '.dogfood-lock');

/** A run older than this is assumed dead and its lock ignored. */
const STALE_LOCK_MS = 30 * 60 * 1000;

/**
 * Take the run lock, or report that another run holds it.
 *
 * launchd starts a run on its interval whether or not the previous one has
 * finished, and a run can take many minutes — it builds and runs preflight.
 * Two concurrent runs would fight over the working tree, which is the one
 * thing INV-DOG-009 promises will not happen.
 */
function takeLock(): boolean {
  if (existsSync(LOCK_FILE)) {
    const startedAt = Number(readFileSync(LOCK_FILE, 'utf8')) || 0;
    if (Date.now() - startedAt < STALE_LOCK_MS) {
      return false;
    }
    // A run that died leaves its lock behind; do not strand the loop forever.
  }
  writeFileSync(LOCK_FILE, String(Date.now()));
  return true;
}

function releaseLock(): void {
  try {
    unlinkSync(LOCK_FILE);
  } catch {
    // Already gone. Nothing to do.
  }
}

/** How many failed runs in a row before the loop stops itself. */
const HALT_AFTER = 3;

/**
 * The failure count lives on disk, not in memory.
 *
 * Scheduled runs are separate processes: launchd starts a fresh one each
 * interval, so an in-memory counter resets every time and the halt after
 * repeated failure would never fire — the loop would fail forever, quietly,
 * which is precisely what INV-DOG-010 exists to prevent.
 */
const FAILURES_FILE = join(REPO, '.dogfood-failures');

function readFailures(): number {
  try {
    return Number(readFileSync(FAILURES_FILE, 'utf8')) || 0;
  } catch {
    return 0;
  }
}

function writeFailures(count: number): void {
  writeFileSync(FAILURES_FILE, String(count));
}

export function isHalted(): string | null {
  return existsSync(HALT_FILE) ? readFileSync(HALT_FILE, 'utf8').trim() : null;
}

export function halt(reason: string): void {
  writeFileSync(HALT_FILE, reason);
  console.error(`dogfood: halted — ${reason}`);
  console.error('dogfood: run `yarn dogfood resume` once it is understood.');
}

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

  const interpreted = await interpret(transcript, clip.screen_trail ?? []);
  const requests: ChangeRequestDto[] = interpreted.map((r, i) => ({
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

  const built: ChangeRequestDto[] = [];
  for (const request of requests) {
    const verdict = gateRequest(request);
    if (!verdict.mayBuild) {
      request.state = 'filed';
      console.log(`  filed: ${request.summary} (${verdict.reason})`);
      continue;
    }
    if (options.dryRun) {
      console.log(`  would build (${verdict.route}): ${request.summary}`);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop -- one change at a time, by design
    const outcome = await executeRequest(request);
    if (!outcome.built) {
      request.state = 'abandoned';
      console.log(`  abandoned: ${request.summary} (${outcome.reason})`);
      continue;
    }
    request.state = 'built';
    built.push(request);
  }

  await storeRequests(pb, clip.id, requests);

  if (options.dryRun || options.noDeliver || built.length === 0) {
    await markDelivered(pb, clip.id);
    console.log(`dogfood: ${requests.length} request(s), ${built.length} built, nothing delivered`);
    return true;
  }

  const outcome = await deliverBatch(built, clip.build_number);
  if (!outcome.delivered) {
    throw new Error(`delivery failed: ${outcome.reason}`);
  }
  await markDelivered(pb, clip.id);
  console.log(
    `dogfood: ${requests.length} request(s), ${built.length} built, ` +
      (outcome.route === 'testflight'
        ? 'shipped to TestFlight — install it when the email arrives'
        : outcome.published
          ? 'published over the air'
          : 'committed, nothing to publish')
  );
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
