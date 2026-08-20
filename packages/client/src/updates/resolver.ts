/**
 * The bridge between hot-updater's runtime and this domain's policy.
 *
 * hot-updater will happily run its own check against a server; we replace it
 * with a resolver so two rules are enforced on our side of the wire rather
 * than trusted to the server:
 *
 *   1. An ineligible install performs no request at all (INV-UPD-001). Not "a
 *      request whose answer is ignored" — no request. The only way to be sure
 *      a beta bundle never reaches an App Store user is for the App Store
 *      binary never to ask.
 *   2. The binary states its own BUILD_NUMBER, so the server can refuse a
 *      bundle that needs a newer one (INV-UPD-002). hot-updater's own
 *      minBundleId expresses the same idea as a build-time UUID; BUILD_NUMBER
 *      is the value this project already reasons in, and the one the release
 *      lane derives from TestFlight.
 */
import type { AppUpdateInfo } from '@hot-updater/core';
import type {
  HotUpdaterResolver,
  ResolverCheckUpdateParams
} from '@hot-updater/react-native';

import { readUpdatesConfig } from './config';
import { resolveEligibility } from './eligibility';
import { isConfigured } from './types';

/** How long to wait on the update server before giving up silently. */
const REQUEST_TIMEOUT_MS = 5000;

type CheckRequest = {
  platform: string;
  channel: string;
  appVersion: string;
  buildNumber: number;
  bundleId: string;
};

const requestBody = (params: ResolverCheckUpdateParams): CheckRequest => {
  const config = readUpdatesConfig();
  return {
    platform: params.platform,
    channel: config.channel,
    appVersion: config.appVersion,
    buildNumber: config.buildNumber,
    bundleId: params.bundleId
  };
};

async function postCheck(
  url: string,
  body: CheckRequest
): Promise<AppUpdateInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as AppUpdateInfo | null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The resolver handed to `HotUpdater.init`.
 *
 * Every failure path returns null, which hot-updater reads as "up to date".
 * That is the correct outcome for a domain the singer never asked for: a
 * server that is down, slow, or returning nonsense must leave the app exactly
 * as it was and say nothing (INV-UPD-008).
 */
export const updatesResolver: HotUpdaterResolver = {
  checkUpdate: async (params) => {
    const config = readUpdatesConfig();
    if (!isConfigured(config)) {
      return null;
    }

    const eligibility = await resolveEligibility();
    if (!eligibility.isEligible) {
      return null;
    }

    try {
      return await postCheck(config.updateUrl, requestBody(params));
    } catch {
      return null;
    }
  }
};
