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

import { changedPaths, preflight, restoreTree } from './execute.ts';
import { WORKTREE } from './worktree.ts';

const run = promisify(execFile);

/** The build the changes were made against — the floor for any bundle. */
export function runningBuildNumber(clipBuild: number): number {
  return clipBuild;
}

function commitMessage(batch: ChangeRequestDto[]): string {
  const subject =
    batch.length === 1
      ? batch[0].summary
      : `apply ${batch.length} spoken change requests`;

  const body = batch
    .map((r) => `- ${r.summary}\n  heard as: "${r.quote}"`)
    .join('\n');

  return (
    `feat(dogfood): ${subject.charAt(0).toLowerCase()}${subject.slice(1)}\n\n` +
    `Built from spoken feedback, unattended. The maintainer's own words are\n` +
    `quoted so a misreading is visible as a misreading rather than hidden\n` +
    `behind a paraphrase.\n\n${body}\n\n` +
    `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>\n`
  );
}

export interface DeliveryOutcome {
  delivered: boolean;
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
    return { delivered: false, published: false, route: null, reason: 'nothing built' };
  }

  const paths = await changedPaths();
  if (paths.length === 0) {
    return { delivered: false, published: false, route: null, reason: 'nothing changed' };
  }

  // The whole batch, together, before anything is written to history.
  const harness = await preflight();
  if (!harness.passed) {
    await restoreTree();
    return {
      delivered: false,
      published: false,
      route: null,
      reason: `batch preflight failed: ${harness.output}`
    };
  }

  await run('git', ['add', '-A'], { cwd: WORKTREE });
  await run('git', ['commit', '-m', commitMessage(batch)], { cwd: WORKTREE });
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
    return { delivered: true, published: false, route: 'testflight', reason: null };
  }

  if (!shouldPublishBundle(paths)) {
    return { delivered: true, published: false, route: null, reason: null };
  }

  await run('./scripts/ota.sh', [
    'publish',
    'beta',
    '--min-build',
    String(minBuild),
    '--message',
    batch.map((r) => r.summary).join('; ')
  ], { cwd: WORKTREE, timeout: 15 * 60 * 1000 });

  return { delivered: true, published: true, route: 'bundle', reason: null };
}
