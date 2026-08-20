/**
 * Making the change a request asks for, and proving it.
 *
 * Two rules govern this file and neither is negotiable. Preflight decides
 * whether a change is real (INV-DOG-008), and a failure leaves the working
 * tree exactly as it was found (INV-DOG-009) — an unattended run that leaves
 * half an edit behind poisons every run after it.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
// Imported by file rather than through the `shared` barrel: Node's ESM
// loader needs explicit extensions, and the barrel's own imports are
// extensionless for Metro's benefit. This is the only file the loop needs.
import type { ChangeRequestDto } from '../../packages/shared/src/dto/dogfood.ts';
import { WORKTREE } from './worktree.ts';

const run = promisify(execFile);

// Everything happens in the worktree, never the maintainer's checkout
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

export async function preflightPasses(): Promise<boolean> {
  try {
    await run('yarn', ['preflight'], { cwd: WORKTREE, timeout: 10 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

/** Repo-relative paths currently modified. */
export async function changedPaths(): Promise<string[]> {
  const { stdout } = await git(['status', '--porcelain']);
  return stdout
    .split('\n')
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

export interface ExecuteOutcome {
  built: boolean;
  reason: string | null;
}

/**
 * Hand one request to a coding agent and keep whatever survives preflight.
 *
 * The agent is invoked as a subprocess rather than through the SDK because it
 * needs to read and write the repository, which is what the Claude Code CLI
 * already does safely. What matters here is what happens around it: a clean
 * tree before, preflight after, and a full restore on any failure.
 */
export async function executeRequest(
  request: ChangeRequestDto
): Promise<ExecuteOutcome> {
  if (!(await treeIsClean())) {
    return { built: false, reason: 'working tree was not clean' };
  }

  const prompt =
    `A spoken change request from the maintainer of this repository.\n\n` +
    `What they asked for: ${request.summary}\n` +
    `Their exact words: "${request.quote}"\n` +
    (request.route ? `The screen they were looking at: ${request.route}\n` : '') +
    `\nMake this change. Follow the repository's axioms: update the spec ` +
    `before the code, keep files under 150 lines, and run the harness. ` +
    `Do not touch signing material, secrets, CI, or the release scripts — ` +
    `if the change would need any of those, make no change at all and say ` +
    `why. Native code is fine to change; it simply ships as a build rather ` +
    `than over the air.`;

  try {
    await run('claude', ['-p', prompt], {
      cwd: WORKTREE,
      timeout: 20 * 60 * 1000
    });
  } catch {
    await restoreTree();
    return { built: false, reason: 'the agent could not make the change' };
  }

  if ((await changedPaths()).length === 0) {
    return { built: false, reason: 'the agent decided no change was warranted' };
  }

  if (!(await preflightPasses())) {
    await restoreTree();
    return { built: false, reason: 'preflight failed' };
  }

  return { built: true, reason: null };
}
