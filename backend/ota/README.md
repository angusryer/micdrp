# Update server

Over-the-air JavaScript delivery for TestFlight builds. A Cloudflare Worker
over D1 (the bundle table) and R2 (the archives).

Spec: `.harnex/project/specs/domains/updates/`.

## What is whose

hot-updater's CLI builds the bundle archive, uploads it to R2, and inserts the
row. Its native layer downloads, verifies the hash, swaps the bundle, and rolls
back one that fails to boot. None of that is reimplemented here — it is the
genuinely fiddly part, and it is what the dependency is for.

What this directory owns is the **decision**: given a binary and the bundle it
is running, what should it do next. That lives in
`packages/shared/src/dto/updateBundle.ts` so it is covered by the ordinary test
suite; `worker.ts` only fetches rows and translates.

The schema is hot-updater's (`@hot-updater/cloudflare/sql/bundles.sql`). It has
no column for `min_build_number`, so `yarn ota publish` stamps that into the
row's `metadata` after the deploy — see `scripts/ota.sh` for why that guard
exists at all.

## First-time provisioning

Not yet run. These create resources in whichever Cloudflare account
`CLOUDFLARE_API_TOKEN` belongs to, so check `npx wrangler whoami` first.

```sh
npx wrangler d1 create micdrp-ota
npx wrangler r2 bucket create micdrp-ota-bundles
# write the returned database_id into wrangler.jsonc
npx wrangler d1 execute micdrp-ota --remote \
  --file node_modules/@hot-updater/cloudflare/sql/bundles.sql
yarn ota:deploy
```

`BUNDLE_BASE_URL` must then be set to the bucket's public origin, and
`OTA_UPDATE_URL` in `.env.production` to the deployed Worker.

## Day to day

```sh
yarn ota publish beta                      # version and min-build from .env.production
yarn ota publish beta --min-build 5        # needs a native change shipped in build 5
yarn ota publish beta --dry-run            # everything up to the upload
yarn ota list beta                         # what is published, newest first
yarn ota disable <bundleId>                # withdraw; installs roll back on next check
```

`--min-build` is the one that matters. It defaults to the current
`BUILD_NUMBER`, which is right for a pure JavaScript fix. Raise it whenever the
bundle calls something that only exists in a newer binary — a bundle handed to
a binary without the native module it calls crashes rather than degrading.

## Scope

iOS only. The client decides eligibility from the App Store receipt
(`sandboxReceipt` means TestFlight), and Android has no equivalent signal, so
the Worker refuses to serve it rather than serving bundles that could not be
gated. Android needs its own decision before `android_beta` ships bundles.
