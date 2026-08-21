/**
 * Landing a batch on main when main has moved underneath it.
 *
 * A run takes the better part of an hour, and the maintainer pushes while it
 * works. A rejected push cost a full run's work once, which was then redone
 * from the start (INV-DOG-027).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { preflight } from './execute.ts';
import { WORKTREE } from './worktree.ts';

const run = promisify(execFile);

export /**
 * Put the batch on top of whatever main is now, and check it still holds.
 *
 * Rebasing is not enough on its own: two changes that each passed alone can
 * fail together, which is the same reason the batch is verified as a whole
 * before it is committed (INV-DOG-008). A conflict is not something to
 * resolve unattended — the run gives the work back rather than guessing.
 */
async function rebaseOntoMain(): Promise<{ ok: boolean; reason: string }> {
  await run('git', ['fetch', 'origin', 'main'], { cwd: WORKTREE });
  try {
    await run('git', ['rebase', 'origin/main'], { cwd: WORKTREE });
  } catch {
    await run('git', ['rebase', '--abort'], { cwd: WORKTREE }).catch(() => undefined);
    return { ok: false, reason: 'main moved and these changes conflict with it' };
  }

  const after = await preflight();
  if (!after.passed) {
    return { ok: false, reason: `main moved and the batch no longer passes: ${after.output}` };
  }
  return { ok: true, reason: '' };
}
