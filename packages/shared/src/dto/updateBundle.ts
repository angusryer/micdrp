/**
 * Which bundle a given binary is allowed to run, and what it should do next.
 *
 * These rules live here, in a pure package, rather than inside the update
 * Worker for two reasons. They are the whole of INV-UPD-002 — the guard that
 * stops JavaScript being handed to a binary that lacks a native module it
 * calls, which is a crash rather than a degraded experience — so they need
 * tests that run in the ordinary suite. And they are the one place the rule is
 * written, so the Worker cannot drift from what the spec says.
 *
 * Spec: .harnex/project/specs/domains/updates/
 */

/** hot-updater's id for "running the bundle compiled into the binary". */
export const NIL_BUNDLE_ID = '00000000-0000-0000-0000-000000000000';

/**
 * The object key inside the bucket, from a `storage_uri`.
 *
 * hot-updater records `r2://<bucket>/<key>`, and R2 addresses objects by
 * `<key>` alone — the bucket is not part of it. Stripping only the scheme
 * leaves the bucket name glued to the front and every download 404s, which is
 * exactly what happened the first time this shipped. Tested here rather than
 * inlined in the Worker so it cannot happen twice.
 */
export function r2ObjectKey(storageUri: string): string {
  return storageUri.replace(/^r2:\/\/[^/]+\//, '').replace(/^\/+/, '');
}

/** One published bundle, as the update server holds it. */
export interface UpdateBundleDto {
  /** Monotonic: ordering by this orders by publication. */
  bundleId: string;
  channel: string;
  /** The VERSION_NUMBER of the binaries this bundle may run on. */
  targetAppVersion: string;
  /** The lowest BUILD_NUMBER this bundle may run on. */
  minBuildNumber: number;
  fileUrl: string;
  fileHash: string;
  /** False once withdrawn: never offered, and pulled back off installs. */
  isEnabled: boolean;
}

/** The install asking. */
export interface UpdateClientDto {
  channel: string;
  appVersion: string;
  buildNumber: number;
  /** What it is running now; NIL_BUNDLE_ID for the binary's own bundle. */
  bundleId: string;
  /**
   * The bundle compiled into the binary at build time.
   *
   * Without it, a fresh install reports no running bundle and every
   * published bundle looks newer than nothing — including ones published
   * before the binary was built (INV-UPD-010).
   */
  minBundleId?: string;
}

/** What the install must do. */
export interface UpdateDecisionDto {
  decision: 'update' | 'rollback' | 'none';
  bundleId: string | null;
  fileUrl: string | null;
  fileHash: string | null;
}

const NOTHING: UpdateDecisionDto = {
  decision: 'none',
  bundleId: null,
  fileUrl: null,
  fileHash: null
};

/**
 * May this binary run this bundle at all?
 *
 * Both tests are against the binary, never against what the client claims to
 * be running, so a client reporting a bundleId that does not exist can at
 * worst be offered something it already has.
 */
export function isRunnableBy(
  bundle: UpdateBundleDto,
  client: UpdateClientDto
): boolean {
  return (
    bundle.isEnabled &&
    bundle.channel === client.channel &&
    bundle.targetAppVersion === client.appVersion &&
    bundle.minBuildNumber <= client.buildNumber
  );
}

/**
 * Decide what one install should do.
 *
 * Withdrawal is answered first. An install running a bundle a maintainer has
 * pulled must come off it even when something newer exists, because the newer
 * thing may not be runnable by that binary — and staying on a withdrawn bundle
 * is the outcome withdrawing it was meant to prevent.
 */
export function decideUpdate(
  bundles: readonly UpdateBundleDto[],
  client: UpdateClientDto
): UpdateDecisionDto {
  const running = bundles.find((b) => b.bundleId === client.bundleId);
  if (running && !running.isEnabled) {
    return { ...NOTHING, decision: 'rollback' };
  }

  // Newer than what is running, and newer than what the binary shipped
  // with. The second test is what stops a new build being handed
  // JavaScript published before it existed (INV-UPD-010).
  const floor =
    client.minBundleId && client.minBundleId > client.bundleId
      ? client.minBundleId
      : client.bundleId;

  const newest = bundles
    .filter((b) => isRunnableBy(b, client))
    .filter((b) => b.bundleId > floor)
    .sort((a, b) => (a.bundleId < b.bundleId ? 1 : -1))[0];

  if (!newest) {
    return NOTHING;
  }

  return {
    decision: 'update',
    bundleId: newest.bundleId,
    fileUrl: newest.fileUrl,
    fileHash: newest.fileHash
  };
}
