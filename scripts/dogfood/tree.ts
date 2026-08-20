/**
 * The state of the checkout the loop works in.
 *
 * Split from execute.ts, which owns handing a request to the agent. Every
 * function here is about what git says the tree looks like, or making it
 * look like something else.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { WORKTREE } from './worktree.ts';

const run = promisify(execFile);

// Everything happens in the checkout, never the maintainer's own
// (INV-DOG-015). The two are different directories on the same repository.
const git = (args: string[]) => run('git', args, { cwd: WORKTREE });

/** The worktree is reset before each run, so anything here is this run's. */
export async function treeIsClean(): Promise<boolean> {
  const { stdout } = await git(['status', '--porcelain']);
  return stdout.trim().length === 0;
}

/** Put the tree back exactly as it was, including anything newly created. */
export async function restoreTree(): Promise<void> {
  await git(['reset', '--hard', 'HEAD']);
  await git(['clean', '-fd']);
}

/** Repo-relative paths currently modified. */
export async function changedPaths(): Promise<string[]> {
  const { stdout } = await git(['status', '--porcelain']);
  return stdout
    .split('\n')
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

/** Repo-relative paths this run has changed, committed or not. */
export async function changedSince(ref: string): Promise<string[]> {
  const { stdout } = await git(['diff', '--name-only', `${ref}...HEAD`]);
  const committed = stdout.split('\n').filter(Boolean);
  return [...new Set([...committed, ...(await changedPaths())])];
}

/**
 * Keep what a request built, so a later failure cannot take it away.
 *
 * Restoring the tree is how an abandoned request leaves nothing behind
 * (INV-DOG-009), but a reset discards everything uncommitted — including
 * requests that already succeeded. A checkpoint per request makes the two
 * compatible: the reset lands on the last good state rather than on the
 * start of the run. It also leaves a clean tree, which is what the next
 * request's precondition asks for.
 *
 * These commits are local to the checkout and squashed at delivery; the
 * maintainer sees one commit per batch, not one per request.
 */
export async function checkpoint(summary: string): Promise<void> {
  await git(['add', '-A']);
  await git(['commit', '-m', `checkpoint: ${summary}`, '--no-verify']);
}
