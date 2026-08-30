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

  /**
   * One directory is left out of the fingerprint, and it has to be.
   *
   * `react-native-config` writes the whole of the active `.env` into
   * `GeneratedDotEnv.m` in there at build time — BUILD_NUMBER included. That
   * number climbs on every upload, so the fingerprint moved on every build and
   * could never match again afterwards: the first attempt to publish a
   * JavaScript-only bundle after build 48 was refused for a native change that
   * was only the build number written back into itself.
   *
   * A fingerprint that changes when nothing native changed is not a
   * fingerprint. Leaving this out makes it stable across a build, which is the
   * whole point of matching on one.
   *
   * The directory rather than the one generated file, because a path naming a
   * single file is silently ignored — these are matched against whole sources,
   * and a package inside node_modules is one source. Measured, not assumed:
   * every file-level spelling left the hash moving.
   *
   * Relative to this package, not to the repo, and it has to be spelled with
   * `../../` — node_modules is hoisted to the root and a leading `**\/` does
   * not climb out of the project.
   *
   * The cost: an upgrade of react-native-config, or a real change to an env
   * value like BACKEND_URL, no longer moves the fingerprint by itself. Both
   * are covered by raising `--min-build` on the publish, which is the
   * deliberate half of the same guard (INV-UPD-002).
   */
  fingerprint: {
    ignorePaths: ['../../node_modules/react-native-config/ios/ReactNativeConfig/**']
  },

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
