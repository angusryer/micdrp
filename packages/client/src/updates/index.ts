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
// The busy registry moved to src/app/activity — it belongs to neither
// domain now that dogfood consults it too. Re-exported so the screens
// that already import it from here keep working.
export { markBusy, isBusy, subscribeToBusy } from '../app/activity';
export { checkForUpdate } from './check';
export { downloadBundle } from './download';
export { applyUpdate, deferUpdate, isDeferred } from './apply';
export { crashedBundleIds, rollBack } from './rollback';
export { resolveEligibility } from './eligibility';
export { describeInstall } from './describe';
export { runningBundle } from './bundle';
export { readUpdatesConfig, BETA_CHANNEL } from './config';
export type { BusyActivity } from '../app/activity';
export type {
  Decision,
  Eligibility,
  EligibilityReason,
  InstallDescription,
  InstallState,
  LaunchReport,
  PendingBundle,
  UpdateCheckResult,
  UpdatesConfig
} from './types';
