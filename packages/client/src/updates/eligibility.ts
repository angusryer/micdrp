/**
 * Whether this install may take over-the-air updates (INV-UPD-001).
 *
 * The verdict cannot come from a build-time flag. The binary Apple promotes to
 * the App Store is byte-for-byte the one TestFlight ran, carrying the same
 * react-native-config values, so anything baked in says the same thing in both
 * places — and the failure mode of getting that wrong is a beta bundle landing
 * on a paying customer.
 *
 * What does differ is the receipt Apple installs beside the app: TestFlight
 * writes `sandboxReceipt`, the App Store writes `receipt`. Reading which one is
 * present is a filesystem check, so this needs no native module.
 */
import { Platform } from 'react-native';
import { exists, MainBundlePath } from '@dr.pogodin/react-native-fs';

import type { Eligibility, EligibilityReason } from './types';

/** Where StoreKit puts the receipt, relative to the app bundle. */
const SANDBOX_RECEIPT = 'StoreKit/sandboxReceipt';
const STORE_RECEIPT = 'StoreKit/receipt';

const verdict = (reason: EligibilityReason): Eligibility => ({
  reason,
  isEligible: reason === 'testflight'
});

/**
 * Decide what kind of install this is.
 *
 * Only `testflight` is eligible. Everything else — including `unknown` —
 * resolves to ineligible, so a receipt this cannot read fails closed rather
 * than guessing its way into shipping a bundle.
 *
 * Android always resolves to `unknown`: the receipt trick is iOS-only and the
 * Play internal track has no equivalent, so Android is deliberately out of
 * scope until it gets a decision of its own.
 */
export async function resolveEligibility(): Promise<Eligibility> {
  if (__DEV__) {
    return verdict('development');
  }
  if (Platform.OS !== 'ios' || !MainBundlePath) {
    return verdict('unknown');
  }

  try {
    if (await exists(`${MainBundlePath}/${SANDBOX_RECEIPT}`)) {
      return verdict('testflight');
    }
    if (await exists(`${MainBundlePath}/${STORE_RECEIPT}`)) {
      return verdict('app_store');
    }
  } catch {
    // An unreadable bundle directory is not something the singer can act on,
    // and the safe reading of "I cannot tell" is "do not update".
    return verdict('unknown');
  }

  return verdict('unknown');
}
