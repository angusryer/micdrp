/**
 * Getting off a bundle that should not be running (INV-UPD-003).
 *
 * Two things can put an install here, and they are not the same event.
 *
 * A bundle that fails to boot is handled entirely by the native layer, before
 * any of this code runs: it never confirmed itself ready, so the next launch
 * loads the previous good bundle and records the failed id. There is nothing
 * for JavaScript to do — by the time JavaScript is running, the rollback has
 * already happened, which is precisely why it works when the bundle is broken.
 *
 * A bundle withdrawn by a maintainer is different: the install is running
 * happily and the server tells it to go back. That one needs an explicit
 * reload, and it is what this file is for.
 */
import { HotUpdater } from '@hot-updater/react-native';

import type { UpdateCheckResult } from './types';

/**
 * The bundles this install has seen crash.
 *
 * hot-updater keeps this natively and refuses to install a bundle already on
 * it, which is what stops a broken push being re-downloaded on a loop for the
 * rest of the binary's life.
 */
export function crashedBundleIds(): string[] {
  try {
    return HotUpdater.getCrashHistory();
  } catch {
    return [];
  }
}

/**
 * Act on a rollback decision from the server.
 *
 * Reloading is what applies it: the native layer has already decided which
 * bundle to fall back to — the previous good one, or the binary's own if there
 * is no other. Returns whether a reload was actually triggered.
 */
export async function rollBack(result: UpdateCheckResult): Promise<boolean> {
  if (result.decision !== 'rollback') {
    return false;
  }

  try {
    await HotUpdater.reload();
    return true;
  } catch {
    // A reload that will not start leaves the install on a withdrawn bundle,
    // which is bad but survivable: the next launch checks again.
    return false;
  }
}
