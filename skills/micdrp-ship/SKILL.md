---
name: micdrp-ship
description: Ship micdrp — preflight gates, App Store / TestFlight releases, over-the-air JavaScript updates, and the PocketBase backend. Load before running any release, deploy, build, OTA publish, or backend command in this repo, and before touching signing or Cloudflare credentials.
---

# Shipping micdrp

Every command below is aliased in `package.json`, so prefer the alias over
retyping the underlying invocation — the alias is the single source and the
long form drifts.

## The short version

```sh
yarn release:check          # can I ship right now?
yarn preflight              # the gate: specs, types, lint, tests
yarn release 1.2.0          # gate, build, upload to TestFlight
yarn ota publish beta       # ship a JS-only fix to an installed build
```

## Preflight

`scripts/preflight.sh` is the gate. CI, the pre-push hook and a release all run
this same script, so those paths cannot drift.

```sh
yarn preflight              # specs, typecheck, lint, all tests   (~1 min)
yarn preflight:build        # the above plus a full iOS build     (slower)
```

It runs on `git push` via lefthook. Skip a push with `git push --no-verify` or
`PREFLIGHT_SKIP=1` — but a release always runs it, including the build.

## Releasing

```sh
yarn release 1.2.0                    # iOS -> TestFlight
yarn release 1.2.0 --platform android # Play internal track
yarn release 1.2.0 --platform both
yarn release 1.2.0 --dry-run          # everything except the upload
```

`scripts/release.sh` is the only entry point: preflight (with build) → version
bump → build → submit. `--dry-run` is the safe rehearsal; it proves the whole
chain up to the store call.

### iOS credentials: one key, not five

iOS authenticates with an **App Store Connect API key**, which both signs and
uploads.

**Already exported in `~/.zshrc` (lines 85-87).** Normally there is nothing to
set up — but see the shell warning below, because that file is not always
read.

The key id and issuer id are **always required**. What varies is only how the
private key itself is supplied:

```sh
export ASC_KEY_ID=XXXXXXXXXX
export ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# then EITHER a path to the .p8 on disk...
export ASC_API_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8
# ...OR its contents inline
export ASC_KEY_CONTENT="$(cat AuthKey_XXXXXXXXXX.p8)"
```

`ASC_API_KEY_PATH` is the **`.p8`**, not `asc_api_key.json`. `Fastfile`'s
`asc_api_key` helper hands it to fastlane as `key_filepath`, which wants the
raw key file. This is easy to get wrong because a JSON export of the same key
exists and carries the ids inside it — but nothing here reads that JSON, so
pointing this variable at it fails.

It is **not** an either/or against the ids: both branches of the helper call
`ENV.fetch("ASC_KEY_ID")` and `ENV.fetch("ASC_ISSUER_ID")`. Supplying only
`ASC_API_KEY_PATH` dies with `KeyError: key not found: "ASC_KEY_ID"` — and it
dies *after* preflight has already spent a full build, because
`yarn release:check` reports the key present on the path alone.

> **A non-interactive shell does not source `.zshrc`.** zsh reads `.zshenv`
> for every shell but `.zshrc` only for interactive ones, and `.zshenv` sets
> none of these. So an agent tool shell, a cron job, or a `sh -c` sees all
> three as unset even though they are plainly there in a terminal. Do not
> assume they are inherited — check, or source the profile first:
>
> ```sh
> source ~/.zshrc && yarn release 1.0.0
> ```

There is deliberately **no Apple ID, no `match` repo, no match passphrase, no
keychain password, and no 2FA prompt**. `cert` and `sigh` create and fetch the
certificate and profile on demand using the same key. If you find yourself
reaching for `match`, the credential set just grew from one secret to five —
prefer fixing the key.

Get a key at App Store Connect → Users and Access → Integrations → App Store
Connect API, role **App Manager**. The `.p8` downloads once and cannot be
re-downloaded.

The current key (`F73BPX6QH9`) is in 1Password, `micdrp` vault, item "App
Store Connect keys". A working copy sits on disk because `.zshrc` points
`ASC_API_KEY_PATH` straight at it — **move that copy and you break releases
until line 85 is repointed**. The `micdrp` vault is also not reachable from a
default session: the ambient `OP_SERVICE_ACCOUNT_TOKEN` belongs to TallieUp's
service account, the same cross-project trap as `CLOUDFLARE_API_TOKEN` below.
Reaching it needs that variable set to the `AI_MICDRP_RW` token.

`BUILD_NUMBER` must increase on every upload; App Store Connect rejects a
repeat. `scripts/bump-version.sh` handles it.

## Over-the-air updates

A JavaScript-only fix can reach an installed TestFlight build without another
archive and review cycle. Native code cannot — the C++ pitch engine, every
native module, and everything `react-native-config` baked into the binary all
need a real build.

```sh
yarn ota whoami                       # which Cloudflare account is in scope — check first
yarn ota publish beta                 # version and min-build from .env.production
yarn ota publish beta --min-build 7   # the bundle needs a native change from build 7
yarn ota publish beta --dry-run       # everything up to the upload
yarn ota list beta                    # what is published, newest first
yarn ota disable <bundleId>           # withdraw; installs roll back on their next check
```

**Raise `--min-build` whenever the bundle needs a newer binary.** It defaults to
the current `BUILD_NUMBER`, which is correct for a pure JavaScript fix. A bundle
calling a native module the installed binary lacks crashes rather than
degrading, and that guard is the only thing standing between the two.

### Credentials: a different variable on purpose

Every OTA command reads **`MICDRP_CLOUDFLARE_API_TOKEN`**, never the ambient
`CLOUDFLARE_API_TOKEN`. There is more than one Cloudflare account on this
machine and the ambient token belongs to TallieUp; a command that silently fell
back to it would create micdrp's resources in the wrong account. A missing
variable is an error, not a fallback — do not "fix" that by adding a fallback.

The token needs **D1 Edit**, **Workers R2 Storage Edit** and **Workers Scripts
Edit**. Both it and `MICDRP_CLOUDFLARE_ACCOUNT_ID` are in 1Password
(vault `micdrp`, item "micdrp — Cloudflare API token (OTA)"), reachable through
the `AI_MICDRP_RW` service account token.

### What lives where

| Piece | Where |
|---|---|
| Update server | `backend/ota/` → https://micdrp-ota.angusryer.workers.dev |
| Who-gets-what rules | `packages/shared/src/dto/updateBundle.ts` (tested) |
| Client policy | `packages/client/src/updates/` |
| Publish pipeline | `scripts/ota.sh` + `packages/client/hot-updater.config.ts` |
| Spec | `.harnex/project/specs/domains/updates/` |

hot-updater owns bundling, upload, hash verification and the native bundle
swap. This repo owns the policy: who is eligible, which binary may take which
bundle, when the singer is asked, and what happens when a bundle will not boot.

iOS only. The receipt check that gates eligibility has no Android equivalent,
so the Worker refuses to serve Android rather than serving bundles it could not
gate.

## Backend

Self-hosted PocketBase. See `backend/README.md` for the schema and rules.

```sh
yarn backend                # serve locally on 127.0.0.1:8090
yarn backend --superuser    # first run: also create the dev superuser
yarn backend:verify         # 6 ownership checks against a running instance
yarn backend:deploy         # deploy to fly.io
yarn backend:logs
```

Deployed at <https://micdrp-backend.fly.dev>.

**One machine, never more.** PocketBase is SQLite-backed, so a second machine
would silently serve a second, different database. `--ha=false` and
`min_machines_running = 0` keep it single — do not scale it out, and do not
remove `--ha=false` from the deploy alias.

The app on fly.io is `micdrp-backend`. `relay-lucid-glow-8367` in the same
account belongs to a different project; leave it alone.

## Round-trip test

Proves synthesized audio survives the DSP pipeline, a live backend, and the
trip back. Opt-in, so it never reports a pass it did not earn:

```sh
yarn backend &
RUN_INTEGRATION=1 yarn test client roundTrip
# against production:
RUN_INTEGRATION=1 BACKEND_URL=https://micdrp-backend.fly.dev yarn test client roundTrip
```

## Secrets

`.env`, `.env.staging` and `.env.production` are git-secret encrypted.

```sh
git secret reveal           # decrypt (needs your GPG private key)
git secret hide             # re-encrypt after editing
git secret whoknows         # who can decrypt
```

`packages/client/.env.example` documents every key. `BACKEND_URL` must point at
the deployed instance for any build a tester will run — a phone cannot reach
`127.0.0.1`.

`OTA_UPDATE_URL` is set in `.env.production` only. Empty disables over-the-air
updates outright, which is what `.env` and `.env.staging` want.

`git secret hide` re-encrypts **all seven** files, not just the ones that
changed — GPG emits different ciphertext every run, so the keystores and
signing material show as modified even when their plaintext did not move.
Restore the untouched ones before committing rather than carrying the churn:

```sh
git checkout -- packages/client/android/app/*.keystore.secret \
                packages/client/fastlane/signing/*.secret
```

## Version ceiling

React Native is pinned at **0.86** because Reanimated 4 supports `0.83 - 0.86`.
Babel (7), Jest (29), ESLint (9) and TypeScript (5.x) are likewise pinned to
what RN 0.86 supports, not to `latest`. Each was tried at `latest` and each
broke in its own way. Before bumping any of them, check what React Native's own
template pins.

## iOS signing — read this before debugging a signing failure

Signing runs from a **dedicated keychain**, never the login keychain
(`packages/client/fastlane/keychain.rb`). This is not a preference: signing
from the login keychain stops the build on a GUI dialog ("codesign wants to
sign using key ... in your keychain"), and a build that waits for a click
cannot be triggered from a phone — it hangs until someone clicks, with no
error and no timeout. The fix that matters is `security set-key-partition-list`;
granting `-T /usr/bin/codesign` at import time is *not* sufficient on modern
macOS.

Symptom of a regression: the build stops progressing, `pgrep -x SecurityAgent`
shows a process, and `/usr/bin/codesign` has an `etime` in the minutes.

### Values Apple owns — never hardcode these

Three values are decided by Apple, not by this repo, and every one of them was
wrong at some point because it had been written down by hand:

| Value | Where it really comes from |
|---|---|
| Team ID | `TeamIdentifier` in the `.mobileprovision` |
| Profile name | Apple generates it (`io.greenlyre.micdrp AppStore`) |
| Signing identity | `Apple Distribution` — the pre-Xcode-11 spelling `iPhone Distribution` silently fails |

`fastlane/signing.rb` reads the first two back out of the profile fastlane just
downloaded. A wrong team id surfaces as *"No profile for team X matching Y
found"*, which reads like a missing profile rather than the mismatch it is.

### Never put a build secret in `.env`

`react-native-config` compiles `.env` into `ios/tmp.xcconfig`, and
`env.xcconfig` is in the app's **Resources build phase** — so anything in
`.env` ships inside the IPA and is readable from JS via `Config`. Signing
secrets live in `fastlane/signing/signing.env`, which nothing bundles.

### Where the signing material lives

```
fastlane/signing/micdrp-distribution.p12   cert + private key   (git-secret)
fastlane/signing/signing.env               keychain password    (git-secret)
fastlane/certs/                            scratch, gitignored
```

`cert` writes the private key to `fastlane/certs/<ID>.p12` **unencrypted** —
that file is a PEM key despite the extension. `fastlane/certs/` is gitignored
for that reason. Do not un-ignore it.

## Build numbers are derived, not typed

`ios_beta` asks TestFlight for the latest build number and adds one, then
writes it back to the active `.env` (the only route to `Info.plist`, via
`tmp.xcconfig`). TestFlight rejects a duplicate build number, so nothing needs
to remember to bump — which is what makes repeat remote deploys safe.
Override with `BUILD_NUMBER=<n>` when you need a specific one.

## Identity

Bundle id is `io.greenlyre.micdrp`, written once in the `.env` files and
derived everywhere else through `fastlane/env_config.rb`. The App Store Connect
record already exists ("From the shower to the stage"). The API key must be a
**Team key** — Individual keys cannot call the provisioning endpoints, so
`cert` and `sigh` fail against one.

## Known-broken: `bundle exec`

`Gemfile.lock` pins a bundler from rbenv 3.2.2 while fastlane runs under
Homebrew ruby 4.x, so `bundle exec fastlane` fails. `release-ios.sh` detects
this and falls back to the `fastlane` on PATH. Use plain `fastlane`.

## App Store validation gates (fail *after* a successful build)

These reject at upload, not at build, so a green archive proves nothing about
them. Checked and satisfied as of the first TestFlight submission:

| Requirement | Where |
|---|---|
| `CFBundleIconName` + a real icon in the asset catalog | `ios/micdrp/Images.xcassets/AppIcon.appiconset` |
| `PrivacyInfo.xcprivacy` in the Resources build phase | `ios/micdrp/PrivacyInfo.xcprivacy` |
| `ITSAppUsesNonExemptEncryption` | `Info.plist` — absent means a manual prompt per build |
| `NSMicrophoneUsageDescription` | `Info.plist` |

The icon is a **placeholder** generated with ImageMagick (mic over a drop) —
the repo had no brand assets. One 1024x1024 opaque PNG in the modern
single-slot `Contents.json`; Xcode derives the rest. App Store artwork must
have no alpha channel, so keep `-alpha remove -alpha off` if regenerating.

## "Uploaded successfully" does not mean accepted

Apple accepts the binary, then processes it, then may reject it — by email,
minutes later. A rejected build leaves **zero** trace in the API:

```
0 build(s) — no preReleaseVersions, no builds
```

which looks identical to "still processing". If a build has not appeared
after ~15 minutes, read the email; do not assume it is slow. Rejections seen
here:

- **ITMS-90683** — missing `NSPhotoLibraryUsageDescription`. Required because
  `@dr.pogodin/react-native-fs` and `react-native-share` link photo library
  APIs, whether or not the app calls them.
- **ITMS-90068** — `MinimumOSVersion` too low. The project was pinned at 14.0
  while RN 0.86 itself requires 15.1 (`Helpers::Constants.min_ios_version_supported`).

`fastlane pilot builds` cannot report this — it requests a `buildDeliveries`
relationship Apple removed. Query `api.appstoreconnect.apple.com/v1/builds`
directly instead.

## Two fastlane behaviours that hang an unattended run

1. **`skip_waiting_for_build_processing` is ignored when `changelog` is set**,
   because release notes need the processed build. Passing a changelog
   unconditionally makes the lane poll for up to an hour — and forever if the
   build is rejected. The lane now sets notes only when `RELEASE_NOTES` is
   given.
2. **Build numbers cannot come from TestFlight alone.** Apple registers a
   build minutes after accepting it and reports nothing meanwhile, so
   `latest + 1` returns the same number twice when you deploy in quick
   succession. The lane takes `max(local, remote) + 1`, with the local
   counter in the `.env` always advancing.

## Measured timings (so a regression is visible)

| Step | Time |
|---|---|
| `gym` clean archive | ~226s |
| `gym` with `clean: false` | ~234s — **no gain** |
| upload to App Store Connect | ~75s |

`clean: false` did not help, most likely because `update_code_signing_settings`
rewrites `project.pbxproj` every run and invalidates Xcode's incremental
state. The lane now skips that write when settings already match
(`Signing.settings_current?`), but the speedup is **unverified**.
