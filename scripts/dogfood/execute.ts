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
import { changedPaths, restoreTree, treeIsClean } from './tree.ts';
import { WORKTREE } from './worktree.ts';

const run = promisify(execFile);


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
    const e = error as {
      stdout?: string;
      stderr?: string;
      killed?: boolean;
      signal?: string;
    };
    // A killed run has no output to read, so the kill itself is the reason.
    if (e.killed || e.signal) {
      return { passed: false, output: `the harness was killed (${e.signal ?? 'timeout'})` };
    }
    return { passed: false, output: failingLines(`${e.stdout ?? ''}\n${e.stderr ?? ''}`) };
  }
}

/**
 * The lines a human would look for first in a failed harness run.
 *
 * Falls back to the tail when nothing matches. A guess at which lines matter
 * must never be the reason a failure goes unexplained — that is the same
 * mistake as reporting a bare false, one level further in.
 */
function failingLines(output: string): string {
  const lines = output.split('\n').filter((line) => line.trim().length > 0);
  const matched = lines.filter((line) => /✕|✗|FAIL|error TS|Error:|✖|error:/i.test(line));
  const chosen = matched.length > 0 ? matched.slice(0, 6) : lines.slice(-8);
  return chosen.join('; ').slice(0, 500) || 'the harness produced no output at all';
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
