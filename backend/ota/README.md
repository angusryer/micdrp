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

## Credentials

Every command reads **`MICDRP_CLOUDFLARE_API_TOKEN`**, never the ambient
`CLOUDFLARE_API_TOKEN`. That is deliberate: the ambient variable belongs to
whichever project was last worked on — on this machine, TallieUp's account —
and a deploy that silently fell back to it would create micdrp's database
somewhere it does not belong. A missing variable is an error, not a fallback.

```sh
export MICDRP_CLOUDFLARE_API_TOKEN=...     # D1 Edit, R2 Edit, Workers Scripts Edit
export MICDRP_CLOUDFLARE_ACCOUNT_ID=...    # optional; pins the account
yarn ota whoami                            # confirm the account before anything else
```

Neither belongs in `packages/client/.env*`. react-native-config compiles those
into the IPA, where `env.xcconfig` sits in the Resources build phase and
anything in it is readable from the app bundle.

## First-time provisioning

Not yet run.

```sh
yarn ota whoami                            # confirm the account FIRST
npx wrangler d1 create micdrp-ota
npx wrangler r2 bucket create micdrp-ota-bundles
# write the returned database_id into wrangler.jsonc
npx wrangler d1 execute micdrp-ota --remote \
  --file node_modules/@hot-updater/cloudflare/sql/bundles.sql
yarn ota:deploy
```

Then set `OTA_UPDATE_URL` in `.env.production` to the deployed Worker and
`git secret hide`. There is nothing else to configure: archives are served
back through the Worker's own `/bundle/<key>` route, so the bucket stays
private and there is no r2.dev origin or custom domain in the picture.

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

## Routes

| | |
|---|---|
| `POST /check` | What should this install do next: update, rollback, or nothing. |
| `GET /bundle/<key>` | Streams an archive out of the private bucket. |

`/bundle` is unauthenticated by design. The archive is the same JavaScript
already inside the app, its integrity is established by the hash the client
verifies natively, and any credential guarding it would have to ship in the
binary — where it could be read straight back out.

## Scope

iOS only. The client decides eligibility from the App Store receipt
(`sandboxReceipt` means TestFlight), and Android has no equivalent signal, so
the Worker refuses to serve it rather than serving bundles that could not be
gated. Android needs its own decision before `android_beta` ships bundles.
