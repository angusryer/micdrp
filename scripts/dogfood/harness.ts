/**
 * Giving the loop's checkout the harness it needs to verify anything.
 *
 * The verification framework is planted per machine by `harnex install` and
 * deliberately untracked — collaborators each install their own. A fresh
 * checkout therefore has the specs but not the thing that reads them, and
 * preflight dies on its first step. Every change the loop made, however good,
 * was discarded as having failed the harness (INV-DOG-019).
 *
 * Copied, not linked. A symlink would be a way out of the isolated checkout:
 * the agent edits with no path restriction, and a write through the link
 * would land in the maintainer's own files while showing up in no diff the
 * gate could inspect. Twenty megabytes a run is a small price for the
 * isolation INV-DOG-015 promises actually being true.
 */
import {
  cpSync,
  existsSync,
  lstatSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';

/**
 * Machine-local paths the checkout needs, relative to the repository root.
 *
 * Kept to what the run actually reads. Memory and discovery are left out:
 * memory lives outside the project, and discovery is regenerated.
 */
const COPIED_PATHS = [
  '.harnex/framework',
  '.harnex/config.yml',
  '.harnex/version',
  '.harnex/local',
  // Delivery reads this, not building — and a change was once built,
  // verified, committed and pushed before failing on its absence, which is
  // the worst moment to find out (INV-DOG-022).
  //
  // Revealed by git-secret in the maintainer's checkout and copied here at
  // the maintainer's explicit direction: revealing it per run needs a GPG
  // passphrase nobody is present to give, and stopping before publish means
  // the loop no longer finishes on its own, which is the point of it. The
  // copy stays on the same machine under the same user, .gitignore covers
  // it so it cannot be committed, and the gate refuses any request that
  // would touch a .env at all.
  'packages/client/.env.production'
] as const;

/** The CLI entry point, a link into the framework beside it. */
const CLI_LINK = 'harnex';
const CLI_TARGET = '.harnex/framework/harness/harnex';

/** Every path this plants, for the exclude rules below. */
const PLANTED = [...COPIED_PATHS, CLI_LINK];

/** Give the checkout its own copy of the maintainer's installed harness. */
export async function linkLocalHarness(
  repo: string,
  checkout: string
): Promise<void> {
  for (const path of COPIED_PATHS) {
    const source = join(repo, path);
    if (!existsSync(source)) {
      continue;
    }
    // Replaced rather than merged: a stale file from an older version left
    // behind is harder to diagnose than a slow copy.
    clear(join(checkout, path));
    cpSync(source, join(checkout, path), { recursive: true, dereference: true });
  }

  // Relative, so it resolves to the copy in this checkout and never escapes.
  clear(join(checkout, CLI_LINK));
  if (existsSync(join(checkout, CLI_TARGET))) {
    symlinkSync(CLI_TARGET, join(checkout, CLI_LINK));
  }

  ignorePlanted(checkout);
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
 * clone does not copy — so without this every planted path shows as
 * untracked, the tree is never clean, and each request is abandoned before
 * it starts. That is a whole run spent refusing to touch files the loop
 * itself had just put there.
 */
function ignorePlanted(checkout: string): void {
  writeFileSync(
    join(checkout, '.git', 'info', 'exclude'),
    `# Planted by the dogfood loop; see scripts/dogfood/harness.ts\n${PLANTED.map((p) => `/${p}`).join('\n')}\n`
  );
}
