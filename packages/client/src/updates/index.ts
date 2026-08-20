/**
 * Barrel for the `updates` domain — over-the-air JavaScript delivery to
 * TestFlight builds.
 *
 * The app touches three things: `initUpdates` at startup, `UpdateGate` mounted
 * in the tree, and `markBusy` from whatever must not be interrupted. Everything
 * else here is exported for tests and for reading.
 *
 * Spec: `.harnex/project/specs/domains/updates/`.
 */
export { default as UpdateGate } from './UpdateGate';
export { initUpdates, lastLaunchReport } from './boot';
export { markBusy, isBusy, subscribeToBusy } from './busy';
export { checkForUpdate } from './check';
export { downloadBundle } from './download';
export { applyUpdate, deferUpdate, isDeferred } from './apply';
export { crashedBundleIds, rollBack } from './rollback';
export { resolveEligibility } from './eligibility';
export { readUpdatesConfig, BETA_CHANNEL } from './config';
export type {
  BusyActivity,
  Decision,
  Eligibility,
  EligibilityReason,
  InstallState,
  LaunchReport,
  PendingBundle,
  UpdateCheckResult,
  UpdatesConfig
} from './types';
