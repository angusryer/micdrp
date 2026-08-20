/**
 * Initialising the updater, and the handshake that decides whether the bundle
 * currently running is one worth keeping.
 *
 * The handshake is the whole of automatic rollback (INV-UPD-003). A bundle
 * that reaches first render reports itself ready and is promoted; a bundle
 * that throws on the way there never reports anything, and the next launch
 * finds an unconfirmed bundle and drops back to the last good one. That
 * asymmetry is what makes a broken push recoverable — the alternative is an
 * app whose only route to a fix is the thing that is broken.
 *
 * hot-updater performs the promote and the rollback natively, before JS gets a
 * say. What this file adds is the initialisation, and somewhere for the result
 * to be observed.
 */
import { HotUpdater } from '@hot-updater/react-native';

import { readUpdatesConfig } from './config';
import { updatesResolver } from './resolver';
import { isConfigured, type LaunchReport } from './types';

let lastLaunch: LaunchReport = { recovered: false, crashedBundleId: null };
let started = false;

/**
 * Start the updater.
 *
 * Safe to call on every launch and cheap when the install has no server to
 * talk to: an unconfigured build returns before touching hot-updater at all,
 * so a development build behaves as though the domain did not exist.
 */
export function initUpdates(): void {
  if (started || !isConfigured(readUpdatesConfig())) {
    return;
  }
  started = true;

  HotUpdater.init({
    resolver: updatesResolver,
    onNotifyAppReady: ({ status, crashedBundleId }) => {
      lastLaunch = {
        recovered: status === 'RECOVERED',
        crashedBundleId: crashedBundleId ?? null
      };
    },
    // A failed check is not the singer's problem and not an error worth
    // crashing on; swallowing here keeps INV-UPD-008 true for the paths that
    // run before any of our own try/catch does.
    onError: () => {}
  });
}

/**
 * What the last launch reported.
 *
 * `recovered` true means a bundle failed to boot and was replaced without
 * anyone acting. Nothing surfaces that to the singer — it is here so the
 * failure is observable in a log rather than invisible.
 */
export function lastLaunchReport(): LaunchReport {
  return lastLaunch;
}

/** Test seam. Never called by app code. */
export function resetBootForTests(): void {
  lastLaunch = { recovered: false, crashedBundleId: null };
  started = false;
}
