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
 * The name comes from the platform, not from the filesystem. That is the
 * correction that mattered: `Bundle.main.appStoreReceiptURL` reports the
 * receipt's name from first launch, but StoreKit does not necessarily write
 * the file until it refreshes. Builds 6 and 7 both asked the filesystem
 * whether the receipt existed — a different question, whose answer was no, so
 * both resolved to `unknown` and never asked for an update at all.
 *
 * The filesystem probe is kept as a fallback for the case where the native
 * module is unavailable, and whatever decided the verdict is reported so a
 * wrong answer is visible on the device rather than inferred from outside.
 */
import { Platform } from 'react-native';
import {
  DocumentDirectoryPath,
  exists,
  MainBundlePath
} from '@dr.pogodin/react-native-fs';

import NativeInstallInfo from '../specs/NativeInstallInfo';
import type { Eligibility, EligibilityReason } from './types';

/** What iOS calls the receipt, when it will say. */
function receiptName(): string | null {
  try {
    return NativeInstallInfo?.getReceiptName() || null;
  } catch {
    // Older binary without the module, or Android. Fall through to the probe.
    return null;
  }
}

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

  // The platform's own answer, which does not depend on the file existing.
  const name = receiptName();
  if (name === 'sandboxReceipt') {
    return verdict('testflight', name);
  }
  if (name === 'receipt') {
    return verdict('app_store', name);
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
