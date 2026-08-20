/**
 * Asking whether there is a newer bundle.
 *
 * This is deliberately quiet. The singer did not ask for an update, so a
 * server that is unreachable or returning nonsense produces the same visible
 * outcome as no update existing at all (INV-UPD-008). Fetching what this finds
 * is `download.ts`.
 */
import { HotUpdater } from '@hot-updater/react-native';

import type { Decision, UpdateCheckResult } from './types';

/** hot-updater's status vocabulary, in the spec's words. */
const toDecision = (status: string): Decision => {
  if (status === 'UPDATE') {
    return 'update';
  }
  if (status === 'ROLLBACK') {
    return 'rollback';
  }
  return 'none';
};

const NOTHING_TO_DO: UpdateCheckResult = {
  decision: 'none',
  bundleId: null,
  fileUrl: null,
  fileHash: null
};

/**
 * Ask the update server what this install should do next.
 *
 * Eligibility and the network call both live in the resolver, so an install
 * that must not update never reaches the wire — this function only translates
 * the answer.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  try {
    const result = await HotUpdater.checkForUpdate({
      updateStrategy: 'appVersion'
    });
    if (!result) {
      return NOTHING_TO_DO;
    }
    return {
      decision: toDecision(result.status),
      bundleId: result.id,
      fileUrl: result.fileUrl,
      fileHash: result.fileHash
    };
  } catch {
    return NOTHING_TO_DO;
  }
}
