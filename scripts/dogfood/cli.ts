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
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { guardedRun, isHalted } from './loop.ts';

const REPO = new URL('../..', import.meta.url).pathname;
const HALT_FILE = join(REPO, '.dogfood-halt');

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
const valueOf = (flag: string, fallback: number): number => {
  const at = argv.indexOf(flag);
  return at >= 0 ? Number(argv[at + 1]) || fallback : fallback;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
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
    return;
  }

  if (command === 'status') {
    const reason = isHalted();
    console.log(reason ? `halted: ${reason}` : 'running');
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
