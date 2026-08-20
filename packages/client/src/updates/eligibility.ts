/**
 * Whether this install may take over-the-air updates (INV-UPD-001).
 *
 * The verdict cannot come from a build-time flag. The binary Apple promotes to
 * the App Store is byte-for-byte the one TestFlight ran, carrying the same
 * react-native-config values, so anything baked in says the same thing in both
 * places — and the failure mode of getting that wrong is a beta bundle landing
 * on a paying customer.
 *
 * What does differ is the receipt StoreKit installs: TestFlight writes
 * `sandboxReceipt`, the App Store writes `receipt`.
 *
 * It lives in the app's DATA container, beside Documents — NOT in the app
 * bundle. The first version looked in the bundle, found nothing, resolved
 * every install to `unknown`, and so never asked for an update at all. That
 * shipped in build 6 and could not be repaired over the air, because an app
 * that never asks cannot be sent the fix. Hence the belt and braces below:
 * every plausible location is tried, and the one that matched is reported so
 * a wrong guess is visible on the device rather than inferred from outside.
 */
import { Platform } from 'react-native';
import {
  DocumentDirectoryPath,
  exists,
  MainBundlePath
} from '@dr.pogodin/react-native-fs';

import type { Eligibility, EligibilityReason } from './types';

/** The data container: Documents' parent, where StoreKit puts the receipt. */
const dataContainer = (): string =>
  DocumentDirectoryPath.replace(/\/Documents\/?$/, '');

/** Every place the receipt is plausibly written, most likely first. */
export function receiptCandidates(): { path: string; sandbox: boolean }[] {
  const roots = [dataContainer(), MainBundlePath].filter(
    (root): root is string => Boolean(root)
  );
  return roots.flatMap((root) => [
    { path: `${root}/StoreKit/sandboxReceipt`, sandbox: true },
    { path: `${root}/StoreKit/receipt`, sandbox: false }
  ]);
}

const verdict = (reason: EligibilityReason, receiptPath?: string): Eligibility => ({
  reason,
  isEligible: reason === 'testflight',
  receiptPath: receiptPath ?? null
});

/**
 * Decide what kind of install this is.
 *
 * Only `testflight` is eligible. Everything else — including `unknown` —
 * resolves to ineligible, so a receipt this cannot read fails closed rather
 * than guessing its way into shipping a bundle.
 *
 * Android always resolves to `unknown`: the receipt has no equivalent there,
 * so Android is deliberately out of scope until it gets a decision of its own.
 */
export async function resolveEligibility(): Promise<Eligibility> {
  if (__DEV__) {
    return verdict('development');
  }
  if (Platform.OS !== 'ios') {
    return verdict('unknown');
  }

  try {
    for (const candidate of receiptCandidates()) {
      // eslint-disable-next-line no-await-in-loop -- ordered, stops on the first hit
      if (await exists(candidate.path)) {
        return verdict(
          candidate.sandbox ? 'testflight' : 'app_store',
          candidate.path
        );
      }
    }
  } catch {
    // An unreadable container is not something the singer can act on, and the
    // safe reading of "I cannot tell" is "do not update".
    return verdict('unknown');
  }

  return verdict('unknown');
}
