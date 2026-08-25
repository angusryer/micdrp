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
  /**
   * The BUILD_NUMBER whose source this bundle was built from.
   *
   * How recency is judged. A binary carries JavaScript from its own build, so
   * a bundle made from an older build is older than what the binary already
   * has — offering it is a downgrade (INV-UPD-010). Absent on bundles
   * published before this field existed, which are treated as unknown-age and
   * refused to any binary newer than their floor.
   */
  builtFromBuild?: number;
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
   * The bundle compiled into the binary. Reported for diagnosis only.
   *
   * NOT usable as a recency floor: it is not regenerated per build. Build 7's
   * was stamped a day before build 7 existed, so every published bundle
   * sorted after it. That was the first attempt at INV-UPD-010 and it did not
   * work; `builtFromBuild` on the bundle is what does.
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
 * Is this bundle newer than the JavaScript the binary already carries?
 *
 * A binary ships JavaScript built from its own source, so a bundle made from
 * an earlier build is a downgrade however recently it was published. Build 7
 * shipped the fix that let the app ask for updates at all, and the newest
 * bundle on the channel predated it — accepting that would have undone the
 * fix and left another build as the only way out (INV-UPD-010).
 */
export function isNewerThanBinary(
  bundle: UpdateBundleDto,
  client: UpdateClientDto
): boolean {
  // Unstamped bundles predate the field. Refusing them is the safe reading:
  // an unknown-age bundle cannot be shown to be newer.
  return (bundle.builtFromBuild ?? -1) >= client.buildNumber;
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
  // Two reasons to come off what is running, answered before anything newer
  // is looked for: where the install goes next is a separate question from
  // the fact that it must not be here.
  const running = bundles.find((b) => b.bundleId === client.bundleId);
  if (running && !running.isEnabled) {
    return { ...NOTHING, decision: 'rollback' };
  }
  // A stale resident bundle is NOT answered here. It was, for one deploy, and
  // it put installs into a boot loop: the reload a rollback asks for restarts
  // the same resident bundle, which checks again and is told to roll back
  // again, forever. The server cannot get an install off a bundle the server
  // is not the one loading — that decision has to be made natively, before
  // the bundle is applied, which means it ships in a binary (INV-UPD-020).

  const newest = bundles
    .filter((b) => isRunnableBy(b, client))
    .filter((b) => isNewerThanBinary(b, client))
    .filter((b) => b.bundleId > client.bundleId)
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
