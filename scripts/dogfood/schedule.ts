/**
 * Running the loop unattended, on a schedule.
 *
 * launchd rather than a polling terminal: the point is that a remark spoken
 * on the way out of the door is acted on without anyone having left a shell
 * open. A launchd agent survives logout, reboot, and closing the laptop lid.
 *
 * A launchd job inherits almost no environment — not PATH, not the shell
 * profile — so a command that works in a terminal fails to find node,
 * whisper-cli or op when launchd runs it, silently and forever. PATH is
 * therefore named explicitly here.
 *
 * Naming it is not enough: it must resolve to the same tools the maintainer's
 * shell finds (INV-DOG-021). An earlier PATH found a python3, just not the
 * one carrying the YAML module, so spec validation tried to install it and
 * failed on a pip that was not there either. Every change the loop made was
 * discarded for a reason that never appeared when anyone ran it by hand.
 *
 * Credentials are NOT. The plist is a world-readable file in
 * ~/Library/LaunchAgents, and writing tokens into it copies every secret out
 * of the places built to hold them into one that is not. The run reads them
 * from the login profile at startup instead — see `loadProfileSecrets`.
 *
 * Spec: dogfood.schedule_loop.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

import { cacheCredentials } from './credentials.ts';
import { LABEL, LOG_DIR, PLIST, SCHEDULED_PATH, plist } from './plist.ts';
export const LOG = join(LOG_DIR, 'dogfood.log');


export async function uninstall(): Promise<void> {
  if (!existsSync(PLIST)) {
    console.log('dogfood: no schedule installed.');
    return;
  }
  await run('launchctl', ['unload', PLIST]).catch(() => undefined);
  unlinkSync(PLIST);
  console.log('dogfood: schedule removed. Uploaded clips are untouched.');
}

export function isScheduled(): boolean {
  return existsSync(PLIST);
}

/**
 * Prove the scheduled environment can run the harness, before trusting it to.
 *
 * A launchd job inherits almost nothing, so the harness can pass by hand and
 * fail on the schedule — which is exactly what happened, invisibly, for a
 * day: python3 resolved to an interpreter without PyYAML and every change
 * was discarded. Checking at install time is the one moment a human is
 * present to hear about it (INV-DOG-021).
 */
async function checkScheduledEnvironment(): Promise<void> {
  try {
    await run('python3', ['-c', 'import yaml'], {
      env: { PATH: SCHEDULED_PATH, HOME: homedir() }
    });
  } catch {
    throw new Error(
      'the scheduled PATH has no python3 with PyYAML, so spec validation ' +
        'would fail on every run. Fix SCHEDULED_PATH in scripts/dogfood/plist.ts.'
    );
  }
}

export async function install(intervalSeconds: number): Promise<void> {
  await checkScheduledEnvironment();
  mkdirSync(LOG_DIR, { recursive: true });
  // Done now, while someone is present to answer any prompt it raises.
  await cacheCredentials();
  // Unload first so installing twice replaces rather than stacks.
  await run('launchctl', ['unload', PLIST]).catch(() => undefined);
  writeFileSync(PLIST, plist(intervalSeconds));
  await run('launchctl', ['load', PLIST]);
  console.log(
    `dogfood: running every ${intervalSeconds}s. Log: ${LOG}\n` +
      'Stop it with `yarn dogfood uninstall`.'
  );
}
