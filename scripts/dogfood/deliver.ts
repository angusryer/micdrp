/**
 * Committing what was built and shipping it.
 *
 * The batch is verified as a whole before anything is committed, because two
 * changes that each pass alone can fail together (INV-DOG-008). And a bundle
 * is published with the running build as its floor, never lower — the machine
 * choosing that number is exactly why INV-DOG-011 exists.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
// Imported by file rather than through the `shared` barrel: Node's ESM
// loader needs explicit extensions, and the barrel's own imports are
// extensionless for Metro's benefit. This is the only file the loop needs.
import { shouldPublishBundle, type ChangeRequestDto } from '../../packages/shared/src/dto/dogfood.ts';

import { preflight } from './execute.ts';
import { rebaseOntoMain } from './rebase.ts';
import { changedSince, restoreTree } from './tree.ts';
import { commitMessage } from './report.ts';
import { WORKTREE } from './worktree.ts';

const run = promisify(execFile);


export interface DeliveryOutcome {
  delivered: boolean;
  /**
   * Whether the commit reached main.
   *
   * Separate from `delivered` because only one of delivery's two outward
   * steps can be taken back. A push is public the moment it happens; a
   * publish is a retry away (INV-DOG-023).
   */
  pushed: boolean;
  published: boolean;
  /** How it went out, when it did. */
  route: 'bundle' | 'testflight' | null;
  reason: string | null;
}

/**
 * Commit the batch and, when it changed JavaScript, publish a bundle.
 *
 * Nothing is published for a batch that only moved specs or documentation —
 * a real change worth committing and nothing worth sending to a phone.
 */
export async function deliverBatch(
  batch: ChangeRequestDto[],
  minBuild: number
): Promise<DeliveryOutcome> {
  if (batch.length === 0) {
    return { delivered: false, pushed: false, published: false, route: null, reason: 'nothing built' };
  }

  // Against origin/main, not the working tree: each built request was
  // checkpointed, so the tree is clean and the work is in commits.
  const paths = await changedSince('origin/main');
  if (paths.length === 0) {
    return { delivered: false, pushed: false, published: false, route: null, reason: 'nothing changed' };
  }

  // The whole batch, together, before anything is written to history.
  const harness = await preflight();
  if (!harness.passed) {
    await restoreTree();
    return {
      delivered: false,
      pushed: false,
      published: false,
      route: null,
      reason: `batch preflight failed: ${harness.output}`
    };
  }

  // Squash the per-request checkpoints: the maintainer sees one commit per
  // batch, which is the unit they were told about.
  await run('git', ['add', '-A'], { cwd: WORKTREE });
  await run('git', ['reset', '--soft', 'origin/main'], { cwd: WORKTREE });
  await run('git', ['commit', '--no-verify', '-m', commitMessage(batch)], { cwd: WORKTREE });
  // Main has usually moved: a run takes the better part of an hour, and the
  // maintainer pushes while it works. Rebasing onto what is there now is the
  // difference between delivering and losing the lot — a rejected push cost a
  // full run's work, which was then redone from the start (INV-DOG-027).
  const landed = await rebaseOntoMain();
  if (!landed.ok) {
    await restoreTree();
    return {
      delivered: false,
      pushed: false,
      published: false,
      route: null,
      reason: landed.reason
    };
  }

  // The worktree sits on its own branch; main is what the maintainer pulls.
  await run('git', ['push', 'origin', 'HEAD:main'], { cwd: WORKTREE });

  // Native changes cannot reach a device over the air, so they go out as a
  // build. TestFlight emails the maintainer; installing is their step
  // (INV-DOG-005).
  if (batch.some((r) => r.blastRadius === 'native')) {
    await run('./scripts/release.sh', ['1.0.0'], {
      cwd: WORKTREE,
      timeout: 30 * 60 * 1000
    });
    return { delivered: true, pushed: true, published: false, route: 'testflight', reason: null };
  }

  if (!shouldPublishBundle(paths)) {
    return { delivered: true, pushed: true, published: false, route: null, reason: null };
  }

  // Past this point the commit is public. A publish that fails is a step
  // to retry, not a reason to treat the pushed work as unbuilt.
  try {
    await run('./scripts/ota.sh', [
      'publish',
      'beta',
      '--min-build',
      String(minBuild),
      '--message',
      batch.map((r) => r.summary).join('; ')
    ], { cwd: WORKTREE, timeout: 15 * 60 * 1000 });
  } catch (error) {
    return {
      delivered: true,
      pushed: true,
      published: false,
      route: 'bundle',
      reason: `pushed to main, but publishing failed: ${String(error).slice(0, 300)}`
    };
  }

  return { delivered: true, pushed: true, published: true, route: 'bundle', reason: null };
}
