/**
 * The binary's own answer to "what am I, and where do I ask?".
 *
 * Every value here is compiled in by react-native-config at build time and is
 * unreachable from an over-the-air bundle (INV-UPD-005) — which is the point.
 * A bundle that needs a different backend, version or channel is a bundle that
 * needs a new build, and reading these through one function keeps that true by
 * construction rather than by everyone remembering.
 */
import Config from 'react-native-config';

import type { UpdatesConfig } from './types';

/**
 * The only channel that exists. Declared here rather than inlined at the call
 * sites so that adding a production track later is one edit, and so nothing
 * can quietly ask for a track the server does not serve.
 */
export const BETA_CHANNEL = 'beta';

/**
 * Read the update configuration out of the binary.
 *
 * An absent OTA_UPDATE_URL is not an error: it is how a build opts out. Every
 * caller treats an unconfigured install exactly like an ineligible one, so a
 * development build with no server to talk to behaves the same as an App Store
 * install that is forbidden from talking to one.
 */
export function readUpdatesConfig(): UpdatesConfig {
  return {
    updateUrl: (Config.OTA_UPDATE_URL ?? '').trim(),
    channel: (Config.OTA_CHANNEL ?? BETA_CHANNEL).trim(),
    appVersion: (Config.VERSION_NUMBER ?? '').trim(),
    buildNumber: Number.parseInt(Config.BUILD_NUMBER ?? '0', 10) || 0
  };
}
