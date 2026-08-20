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
 * A worktree removes the question. It is created once and reused, because a
 * fresh one has no node_modules and installing them every run would cost more
 * than the work itself. Each run resets it to origin/main, so nothing carries
 * over from a run that failed.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

/** Kept outside the repository so it is never mistaken for working state. */
export const WORKTREE = join(homedir(), '.micdrp-dogfood-worktree');

/** The branch the worktree sits on. Reset every run; never merged from. */
const BRANCH = 'dogfood/work';

const git = (args: string[], cwd = REPO) => run('git', args, { cwd });

/**
 * Make the worktree ready: existing or created, and reset to origin/main.
 *
 * Returns the path to work in. Throws if the worktree cannot be prepared,
 * which the caller treats as a failed run rather than as a reason to fall
 * back to the maintainer's checkout.
 */
export async function prepareWorktree(): Promise<string> {
  await git(['fetch', 'origin', 'main']);

  if (!existsSync(join(WORKTREE, '.git'))) {
    // A stale registration from a deleted directory blocks `worktree add`.
    await git(['worktree', 'prune']);
    await git(['worktree', 'add', '-B', BRANCH, WORKTREE, 'origin/main']);
    return WORKTREE;
  }

  // Reused: throw away whatever the last run left, including its commits.
  await git(['reset', '--hard', 'origin/main'], WORKTREE);
  await git(['clean', '-fd'], WORKTREE);
  await git(['checkout', '-B', BRANCH, 'origin/main'], WORKTREE);
  return WORKTREE;
}

/**
 * Install dependencies in the worktree when they are missing or stale.
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
