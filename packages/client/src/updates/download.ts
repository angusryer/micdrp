/**
 * Fetching an offered bundle and staging it for the next reload.
 *
 * Quiet for the same reason `check.ts` is: a download that fails, or an
 * archive whose signature does not verify, leaves the install exactly where it
 * was and tells the singer nothing (INV-UPD-008).
 */
import { HotUpdater } from '@hot-updater/react-native';

import type { PendingBundle, UpdateCheckResult } from './types';

/**
 * Fetch and verify an offered bundle, leaving it staged for the next reload.
 *
 * Verification is the native layer's: it checks the downloaded archive against
 * the hash published with it, and refuses a mismatch (INV-UPD-006). A refusal
 * arrives here as a thrown error or a false, and both mean the same thing —
 * the install stays exactly where it was.
 */
export async function downloadBundle(
  result: UpdateCheckResult
): Promise<PendingBundle | null> {
  if (result.decision !== 'update' || !result.bundleId) {
    return null;
  }

  try {
    const staged = await HotUpdater.updateBundle({
      bundleId: result.bundleId,
      fileUrl: result.fileUrl,
      // The native layer verifies the archive against this before it is
      // allowed to become what the app loads (INV-UPD-006). Passing it is
      // what makes the check happen — it is not advisory.
      fileHash: result.fileHash,
      // Native branches on this: UPDATE installs the archive, ROLLBACK
      // restores the previous bundle. We only ever reach here for an offer.
      status: 'UPDATE'
    });
    return staged ? { bundleId: result.bundleId } : null;
  } catch {
    return null;
  }
}
