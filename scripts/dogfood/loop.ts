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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gateRequest, type ChangeRequestDto } from 'shared';

import { audioUrl, claimOldest, connect, markDelivered, signIn, storeRequests, storeTranscript } from './clips';
import { deliverBatch } from './deliver';
import { executeRequest } from './execute';
import { interpret } from './interpret';
import { transcribe } from './transcribe';

const REPO = new URL('../..', import.meta.url).pathname;
const HALT_FILE = join(REPO, '.dogfood-halt');

/** How many failed runs in a row before the loop stops itself. */
const HALT_AFTER = 3;

let consecutiveFailures = 0;

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
    return false;
  }

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

  const built: ChangeRequestDto[] = [];
  for (const request of requests) {
    const verdict = gateRequest(request);
    if (!verdict.mayBuild) {
      request.state = 'filed';
      console.log(`  filed: ${request.summary} (${verdict.reason})`);
      continue;
    }
    if (options.dryRun) {
      console.log(`  would build: ${request.summary}`);
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
      `delivered${outcome.published ? ' and published' : ''}`
  );
  return true;
}

/** Run a pass, counting failures towards the halt. */
export async function guardedRun(options: Options): Promise<void> {
  try {
    await runOnce(options);
    consecutiveFailures = 0;
  } catch (error) {
    consecutiveFailures += 1;
    console.error(`dogfood: run failed — ${String(error)}`);
    if (consecutiveFailures >= HALT_AFTER) {
      halt(`${HALT_AFTER} consecutive runs failed; last: ${String(error)}`);
    }
  }
}
