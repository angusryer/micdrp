/**
 * The shapes the `updates` domain reasons in.
 *
 * These mirror the entities in
 * `.harnex/project/specs/domains/updates/entities.yml` and
 * `entities-install.yml`. Where a name here differs from hot-updater's own
 * vocabulary the adapter in `resolver.ts` translates, so the rest of the app
 * only ever sees the spec's words.
 */

/** What the update server tells one install to do. UpdateCheckResult.decision. */
export type Decision = 'update' | 'rollback' | 'none';

/** Why an install was judged eligible or not. UpdateEligibility.reason. */
export type EligibilityReason =
  | 'testflight'
  | 'app_store'
  | 'development'
  | 'unknown';

/** Whether this install may take over-the-air updates at all. */
export type Eligibility = {
  isEligible: boolean;
  reason: EligibilityReason;
  /**
   * The receipt that decided it, or null when none was found.
   *
   * Reported so a wrong guess about where iOS puts the receipt is visible on
   * the device rather than inferred from outside — which is how build 6's
   * silent failure went unnoticed until it could not be fixed over the air.
   */
  receiptPath: string | null;
};

/** What this install is, for the About section (INV-UPD-009). */
export type InstallDescription = {
  appVersion: string;
  buildNumber: number;
  /** The over-the-air bundle in use, or null for the binary's own. */
  bundleId: string | null;
  eligibility: Eligibility;
  /** Feedback clips recorded but not yet accepted by the server. */
  queuedClips: number;
  /** Why the last clip upload failed, if it did. */
  lastUploadError: string | null;
  /** Why the last attempt to start recording failed, if it did. */
  lastRecordingError: string | null;
};

/** Where a downloaded bundle sits in the install lifecycle. */
export type InstallState =
  | 'embedded'
  | 'pending'
  | 'active'
  | 'rolled_back';

/** What the server said, in the spec's vocabulary. */
export type UpdateCheckResult = {
  decision: Decision;
  bundleId: string | null;
  fileUrl: string | null;
  fileHash: string | null;
};

/**
 * A bundle downloaded, verified and waiting for the singer to accept it.
 *
 * `fileUrl` is deliberately absent: by the time a bundle is pending the
 * download has already happened, and nothing downstream of the prompt needs
 * to know where it came from.
 */
export type PendingBundle = {
  bundleId: string;
};

/** The result of a launch, as the native layer reports it. */
export type LaunchReport = {
  /** True when the previous bundle failed to boot and was replaced. */
  recovered: boolean;
  /** The bundle that failed, present only when recovered is true. */
  crashedBundleId: string | null;
};

/** Everything the domain reads out of the binary's baked-in configuration. */
export type UpdatesConfig = {
  /** Empty disables over-the-air updates outright. */
  updateUrl: string;
  channel: string;
  appVersion: string;
  buildNumber: number;
};

/** An eligible install that has somewhere to ask. */
export const isConfigured = (config: UpdatesConfig): boolean =>
  config.updateUrl.length > 0;
