/**
 * Where the loop actually works.
 *
 * Never the maintainer's checkout. Two earlier attempts got this wrong in
 * opposite directions: the first abandoned real requests whenever someone was
 * editing, discarding work that was never given a chance; the second deferred
 * instead, which loses nothing but means the loop only runs when the
 * maintainer happens to have committed — and the entire point is that it runs
 * while they are elsewhere (INV-DOG-015).
 *
 * A clone rather than a git worktree, which is a correctness requirement and
 * not a preference — see prepareWorktree.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { linkLocalHarness } from './harness.ts';

const run = promisify(execFile);

const REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

/** Kept outside the repository so it is never mistaken for working state. */
export const WORKTREE = join(homedir(), '.micdrp-dogfood-worktree');

const git = (args: string[], cwd = REPO) => run('git', args, { cwd });

/**
 * Make the checkout ready: existing or created, and reset to origin/main.
 *
 * A clone, not a git worktree. The verification framework finds the project
 * root by walking up for a .git directory, and a worktree's .git is a file —
 * so it walked straight past and validated the maintainer's specs instead,
 * reporting success for a tree it had never read. A clone has a real .git
 * directory, isolates just as well, and shares objects so it costs little.
 *
 * Reused rather than recreated: a fresh clone has no node_modules, and
 * installing them every run would cost more than the work itself.
 */
export async function prepareWorktree(): Promise<string> {
  await git(['fetch', 'origin', 'main']);

  if (!existsSync(join(WORKTREE, '.git'))) {
    // Cloned from the local repository so it shares objects and costs
    // little, then pointed at the real remote: delivery pushes to origin,
    // and origin must be GitHub rather than the maintainer's checkout.
    await git(['clone', '--shared', '--no-checkout', REPO, WORKTREE]);
    const { stdout } = await git(['remote', 'get-url', 'origin']);
    await git(['remote', 'set-url', 'origin', stdout.trim()], WORKTREE);
  }

  // Throw away whatever the last run left, including any commits it made.
  await git(['fetch', 'origin', 'main'], WORKTREE);
  await git(['checkout', '-f', '-B', 'dogfood/work', 'origin/main'], WORKTREE);
  await git(['clean', '-fd'], WORKTREE);

  // The harness is installed per machine and never committed, so a clone
  // does not have it and cannot verify anything (INV-DOG-019).
  await linkLocalHarness(REPO, WORKTREE);
  return WORKTREE;
}

/**
 * Install dependencies in the checkout when they are missing or stale.
 *
 * Yarn is quick when nothing changed, so this runs every time rather than
 * trying to guess whether the lockfile moved.
 */
export async function installDeps(): Promise<void> {
  await run('yarn', ['install', '--mode=skip-build'], {
    cwd: WORKTREE,
    timeout: 10 * 60 * 1000
  });
}
