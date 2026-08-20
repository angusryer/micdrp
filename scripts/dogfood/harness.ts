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
import { lstatSync, symlinkSync, existsSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
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
    // Replace rather than skip: a previous run may have linked a path that
    // has since moved, and a dangling link is worse than none.
    clear(join(checkout, path));
    symlinkSync(source, join(checkout, path));
  }
  ignoreLocalHarness(checkout);
}

/**
 * Remove whatever is at a path, link or directory alike.
 *
 * A symlink to a directory must be unlinked, not removed as a tree: rmSync
 * refuses it without `recursive`, and follows it with.
 */
function clear(target: string): void {
  let stat;
  try {
    stat = lstatSync(target);
  } catch {
    return;
  }
  if (stat.isSymbolicLink()) {
    unlinkSync(target);
    return;
  }
  rmSync(target, { force: true, recursive: true });
}

/**
 * Hide what was just planted from git.
 *
 * The maintainer's checkout excludes these in .git/info/exclude, which git
 * clone does not copy — so without this every link shows as untracked, the
 * tree is never clean, and each request is abandoned before it starts. That
 * is a whole run wasted on files the loop itself put there.
 */
function ignoreLocalHarness(checkout: string): void {
  const rules = LOCAL_PATHS.map((path) => `/${path}`).join('\n');
  writeFileSync(
    join(checkout, '.git', 'info', 'exclude'),
    `# Planted by the dogfood loop; see scripts/dogfood/harness.ts\n${rules}\n`
  );
}
