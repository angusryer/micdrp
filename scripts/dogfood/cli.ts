/**
 * `yarn dogfood` — the entry point.
 *
 * Defaults to polling, because the whole point is that the maintainer talks
 * and the machine gets on with it. `--dry-run` and `--no-deliver` exist for
 * the first few clips, when what the loop *would* do is more interesting than
 * what it does.
 *
 * Spec: .harnex/project/specs/domains/dogfood/commands.yml
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { guardedRun, isHalted } from './loop.ts';
import {
  install,
  isScheduled,
  loadProfileSecrets,
  uninstall,
  LOG
} from './schedule.ts';

const REPO = new URL('../..', import.meta.url).pathname;
const HALT_FILE = join(REPO, '.dogfood-halt');

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
const valueOf = (flag: string, fallback: number): number => {
  const at = argv.indexOf(flag);
  return at >= 0 ? Number(argv[at + 1]) || fallback : fallback;
};

const run = promisify(execFile);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  // A scheduled run has no shell profile. Credentials are read here rather
  // than written into the plist, which is an unguarded file.
  loadProfileSecrets();

  const [command] = argv;

  if (command === 'resume') {
    const reason = isHalted();
    if (!reason) {
      console.log('dogfood: not halted.');
      return;
    }
    // Print what the halt was for, so restarting is deliberate rather than a
    // reflex — the halt exists because something needed looking at.
    console.log(`dogfood: clearing halt — ${reason}`);
    unlinkSync(HALT_FILE);
    // Clear the count too, or the very next failure halts again immediately.
    try {
      unlinkSync(join(REPO, '.dogfood-failures'));
    } catch {
      // Never counted a failure. Nothing to clear.
    }
    return;
  }

  if (command === 'status') {
    const reason = isHalted();
    console.log(reason ? `halted: ${reason}` : 'running');
    console.log(isScheduled() ? `scheduled — log: ${LOG}` : 'not scheduled');
    return;
  }

  if (command === 'install') {
    await install(valueOf('--interval', 300));
    return;
  }

  if (command === 'uninstall') {
    await uninstall();
    return;
  }

  if (command === 'logs') {
    await run('tail', has('--follow') ? ['-f', LOG] : ['-n', '200', LOG]);
    return;
  }

  const options = { dryRun: has('--dry-run'), noDeliver: has('--no-deliver') };
  if (has('--once')) {
    await guardedRun(options);
    return;
  }

  const intervalMs = valueOf('--interval', 120) * 1000;
  console.log(
    `dogfood: polling every ${intervalMs / 1000}s` +
      (options.dryRun ? ' (dry run)' : options.noDeliver ? ' (no deliver)' : '')
  );
  // An idle loop prints nothing: silence means nothing was waiting.
  for (;;) {
    await guardedRun(options);
    if (existsSync(HALT_FILE)) {
      return;
    }
    await sleep(intervalMs);
  }
}

main().catch((error: unknown) => {
  console.error(`dogfood: ${String(error)}`);
  process.exitCode = 1;
});
