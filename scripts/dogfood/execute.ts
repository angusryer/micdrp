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
import { AGENT_ARGS, agentPrompt, lastWords } from './agent.ts';
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

/**
 * Run the harness, and keep what it said when it refuses.
 *
 * A bare true/false here repeats the mistake that hid the permission bug for
 * a day: an outcome with the reason thrown away. "preflight failed" tells the
 * maintainer a change was discarded and nothing about whether the agent broke
 * a test, missed a snapshot, or wrote something that does not compile.
 */
export async function preflight(): Promise<{ passed: boolean; output: string }> {
  try {
    await run('yarn', ['preflight'], {
      cwd: WORKTREE,
      timeout: 10 * 60 * 1000,
      maxBuffer: 32 * 1024 * 1024
    });
    return { passed: true, output: '' };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return { passed: false, output: failingLines(`${e.stdout ?? ''}\n${e.stderr ?? ''}`) };
  }
}

/** The lines a human would look for first in a failed harness run. */
function failingLines(output: string): string {
  const interesting = output
    .split('\n')
    .filter((line) => /✕|✗|FAIL|error TS|Error:|✖/.test(line))
    .slice(0, 6)
    .join('; ');
  return interesting.slice(0, 400) || 'no failing line found in the output';
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

  let said = '';
  try {
    const { stdout } = await run('claude', [...AGENT_ARGS, '-p', agentPrompt(request)], {
      cwd: WORKTREE,
      timeout: 20 * 60 * 1000,
      maxBuffer: 32 * 1024 * 1024
    });
    said = lastWords(stdout);
  } catch (error) {
    await restoreTree();
    return { built: false, reason: `the agent could not make the change: ${String(error).slice(0, 200)}` };
  }

  // Report what it said, not what an empty diff seems to mean (INV-DOG-018).
  if ((await changedPaths()).length === 0) {
    return { built: false, reason: `nothing changed — the agent said: ${said}` };
  }

  const harness = await preflight();
  if (!harness.passed) {
    await restoreTree();
    return { built: false, reason: `preflight failed: ${harness.output}` };
  }

  return { built: true, reason: null };
}
