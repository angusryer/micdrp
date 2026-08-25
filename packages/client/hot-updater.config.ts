/**
 * How `yarn ota publish` builds and uploads a bundle.
 *
 * This configures hot-updater's CLI only — the publishing side. It is not read
 * by the app, and it is not what decides who receives a bundle: that lives in
 * the update Worker (`backend/ota/`) and the rules it calls in
 * `packages/shared/src/dto/updateBundle.ts`.
 *
 * Credentials come from MICDRP_CLOUDFLARE_API_TOKEN, never the ambient
 * CLOUDFLARE_API_TOKEN — there is more than one Cloudflare account in play on
 * this machine and the ambient one belongs to a different project. Missing is
 * an error rather than a fallback, so a publish cannot quietly upload into
 * someone else's bucket.
 *
 * Spec: .harnex/project/specs/domains/updates/
 */
import { bare } from '@hot-updater/bare';
import { d1Database, r2Storage } from '@hot-updater/cloudflare';
import { defineConfig } from 'hot-updater';

const accountId = process.env.MICDRP_CLOUDFLARE_ACCOUNT_ID;
const cloudflareApiToken = process.env.MICDRP_CLOUDFLARE_API_TOKEN;

if (!accountId || !cloudflareApiToken) {
  throw new Error(
    'MICDRP_CLOUDFLARE_ACCOUNT_ID and MICDRP_CLOUDFLARE_API_TOKEN must be set. ' +
      'Refusing to fall back to CLOUDFLARE_API_TOKEN, which on this machine ' +
      'belongs to another project.'
  );
}

/** Created by `wrangler d1 create micdrp-ota`; also pinned in wrangler.jsonc. */
const D1_DATABASE_ID = 'b4617106-8d65-4a4f-858e-cf2bf92a5ee6';

export default defineConfig({
  /**
   * Match the binary by its native fingerprint, not by its marketing version.
   *
   * `appVersion` was the wrong key for this project. The version is pinned at
   * 1.0.0 and only the build number climbs, so the version never changed —
   * and hot-updater's native invalidation, which watches the version, never
   * fired. A bundle taken at one build went on being applied over every
   * binary that followed, for four builds, silently (INV-UPD-020).
   *
   * A fingerprint changes whenever the native side does, which is the thing
   * that actually matters: a bundle built against different native code must
   * not be applied to it.
   *
   * The other half of the guard — the lowest BUILD_NUMBER a bundle may run
   * on — has no column in hot-updater's schema, so `scripts/ota.sh` stamps it
   * into the row's metadata after the deploy and the Worker reads it back
   * (INV-UPD-002).
   */
  updateStrategy: 'fingerprint',

  build: bare({ enableHermes: true }),

  storage: r2Storage({
    accountId,
    cloudflareApiToken,
    bucketName: 'micdrp-ota-bundles'
  }),

  database: d1Database({
    accountId,
    cloudflareApiToken,
    databaseId: D1_DATABASE_ID
  })
});
