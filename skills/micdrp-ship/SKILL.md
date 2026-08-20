---
name: micdrp-ship
description: Ship micdrp — preflight gates, App Store / TestFlight releases, and the PocketBase backend. Load before running any release, deploy, build, or backend command in this repo, and before touching signing credentials.
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
uploads. Supply it as either:

```sh
export ASC_API_KEY_PATH=/path/to/asc_key.json     # fastlane's JSON form
# or the three parts
export ASC_KEY_ID=XXXXXXXXXX
export ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export ASC_KEY_CONTENT="$(cat AuthKey_XXXXXXXXXX.p8)"
```

There is deliberately **no Apple ID, no `match` repo, no match passphrase, no
keychain password, and no 2FA prompt**. `cert` and `sigh` create and fetch the
certificate and profile on demand using the same key. If you find yourself
reaching for `match`, the credential set just grew from one secret to five —
prefer fixing the key.

Get a key at App Store Connect → Users and Access → Integrations → App Store
Connect API, role **App Manager**. The `.p8` downloads once and cannot be
re-downloaded.

`BUILD_NUMBER` must increase on every upload; App Store Connect rejects a
repeat. `scripts/bump-version.sh` handles it.

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
