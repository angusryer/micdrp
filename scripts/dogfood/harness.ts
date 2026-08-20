/**
 * Giving the loop's checkout the harness it needs to verify anything.
 *
 * The verification framework is planted per machine by `harnex install` and
 * deliberately untracked — collaborators each install their own. A fresh
 * checkout therefore has the specs but not the thing that reads them, and
 * preflight dies on its first step. Every change the loop made, however good,
 * was discarded as having failed the harness (INV-DOG-019).
 *
 * Linked rather than copied so an upgrade on the maintainer's machine is
 * picked up without anything here needing to know.
 */
import { existsSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Machine-local paths the harness needs, relative to the repository root.
 *
 * Kept to what verification actually reads. Memory and discovery are left
 * out: memory lives outside the project, and discovery is regenerated.
 */
const LOCAL_PATHS = [
  '.harnex/framework',
  '.harnex/config.yml',
  '.harnex/version',
  '.harnex/local',
  'harnex'
] as const;

/** Point the checkout at the maintainer's installed harness. */
export async function linkLocalHarness(
  repo: string,
  checkout: string
): Promise<void> {
  for (const path of LOCAL_PATHS) {
    const source = join(repo, path);
    if (!existsSync(source)) {
      continue;
    }
    const target = join(checkout, path);
    // Replace rather than skip: a previous run may have linked a path that
    // has since moved, and a dangling link is worse than none.
    rmSync(target, { force: true, recursive: false });
    symlinkSync(source, target);
  }
}
