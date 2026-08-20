/**
 * What this install is, so the question can be answered from the device.
 *
 * Build 6 shipped unable to receive any bundle, and there was no way to tell
 * that from the phone: the version on screen came from package.json rather
 * than from what the build was stamped with, and neither the build number nor
 * the running bundle appeared anywhere (INV-UPD-009). Diagnosing it meant
 * unzipping the IPA on a laptop.
 *
 * Nothing here touches the network. It reports what is already known.
 */
import { readUpdatesConfig } from './config';
import { resolveEligibility } from './eligibility';
import { runningBundle } from './bundle';
import type { InstallDescription } from './types';

export async function describeInstall(): Promise<InstallDescription> {
  const config = readUpdatesConfig();
  return {
    appVersion: config.appVersion,
    buildNumber: config.buildNumber,
    bundleId: runningBundle(),
    eligibility: await resolveEligibility()
  };
}
