# micdrp — Deployment Guide

> See also: [ARCHITECTURE.md](./ARCHITECTURE.md) (system overview),
> [NATIVE_SETUP.md](./NATIVE_SETUP.md) (local build setup),
> [NATIVE_BUILD_PLAN.md](./NATIVE_BUILD_PLAN.md) (authoritative spec).

All deployment automation is owned by **WP-DEPLOY** and lives in:

```
packages/client/fastlane/   — Fastfile, Appfile, Matchfile, README.md
scripts/release-ios.sh      — CI entry point for iOS
scripts/release-android.sh  — CI entry point for Android
scripts/bump-version.sh     — version/build-number updater
.github/workflows/release-ios.yml
.github/workflows/release-android.yml
```

**No secret, credential, keystore, hostname, Apple ID, or API key is committed
anywhere in this repository.** Everything sensitive flows through GitHub Actions
secrets (or local env vars for manual runs) and is injected at runtime.

---

## 1. Signing Setup

### 1a. iOS — fastlane Match (git-based code signing)

micdrp uses [fastlane Match](https://docs.fastlane.tools/actions/match/) to
store encrypted certificates and provisioning profiles in a private git
repository. This keeps signing material out of the main repo and lets CI
runners check out a clean copy on every run.

**One-time setup on a Mac (developer only, not CI):**

```sh
cd packages/client

# 1. Create a private git repo for Match (e.g. on GitHub, GitLab) and record
#    its URL as the MATCH_GIT_URL secret. Never paste the URL here.

# 2. Initialize Match (point it at the private repo):
bundle exec fastlane match init
# When prompted, set the git URL to your private repo.
# The Matchfile reads MATCH_GIT_URL from env — keep it that way.

# 3. Generate and push app-store certificates/profiles:
MATCH_GIT_URL=<your-private-repo-url> \
APPLE_ID=<your-apple-id> \
APPLE_TEAM_ID=<your-team-id> \
IOS_BUNDLE_ID=io.ryer.micdrp \
  bundle exec fastlane match appstore

# After this, CI uses readonly: true and never regenerates.
```

### 1b. Android — keystore

The release keystore is stored **outside** the repo. It is supplied to CI as a
base64-encoded secret (`ANDROID_KEYSTORE_BASE64`). The `release-android.sh`
script decodes it to a temporary file and exports `ANDROID_KEYSTORE_PATH` for
Gradle.

**One-time setup (developer only):**

```sh
# Generate the release keystore (do this once on a secure machine):
keytool -genkeypair -v \
  -keystore micdrp.keystore \
  -alias micdrpAndroidReleaseKey \
  -keyalg RSA -keysize 2048 -validity 10000

# Base64-encode it for the CI secret:
base64 -i micdrp.keystore | pbcopy   # macOS: pastes into clipboard
# Paste as the ANDROID_KEYSTORE_BASE64 GitHub secret.

# Store the keystore file in a secure location outside the repo (e.g. 1Password).
# Never commit micdrp.keystore.
```

---

## 2. Secrets Matrix

Add all secrets below to **Settings → Secrets and variables → Actions** in the
GitHub repository. No default values are provided for any secret — a missing
variable causes the lane to fail immediately with a descriptive error.

### 2a. Common (both platforms)

| Secret name | Description |
|---|---|
| `VERSION_NUMBER` | Semantic version string (e.g. `1.2.0`). Falls back to `.env.production` if unset. |
| `BUILD_NUMBER` | Monotonically increasing integer. Falls back to `.env.production` if unset. |

### 2b. iOS

| Secret name | Description |
|---|---|
| `APPLE_ID` | Apple ID email for App Store Connect / Developer Portal authentication |
| `APPLE_TEAM_ID` | 10-character Apple Developer Portal Team ID |
| `ITC_TEAM_ID` | Numeric App Store Connect Team ID |
| `IOS_BUNDLE_ID` | iOS bundle identifier (e.g. `io.ryer.micdrp`) |
| `MATCH_GIT_URL` | HTTPS or SSH URL of the private git repo storing Match certs/profiles |
| `MATCH_PASSWORD` | Passphrase Match uses to encrypt/decrypt certificates |
| `MATCH_KEYCHAIN_PASSWORD` | macOS keychain password Match uses on CI to install certs |
| `ASC_API_KEY_JSON` | Raw JSON content of the App Store Connect API key (key ID, issuer ID, private key PEM) |
| `RELEASE_NOTES` | Optional changelog text surfaced in TestFlight (defaults to a generic build string) |

`ASC_API_KEY_JSON` is written to a temp file by `release-ios.sh`; the temp
path is exported as `ASC_API_KEY_PATH` for fastlane's `pilot`/`deliver`
actions. The temp file is deleted via `trap ... EXIT`.

### 2c. Android

| Secret name | Description |
|---|---|
| `ANDROID_PACKAGE_NAME` | Android application ID (e.g. `com.micdrp`) |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded release keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | Password protecting the keystore |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | Password for the key alias |
| `SUPPLY_JSON_KEY_DATA` | Full JSON content of the Google Play service-account key |

`ANDROID_KEYSTORE_BASE64` is decoded to a temp file by `release-android.sh`;
the temp path is exported as `ANDROID_KEYSTORE_PATH` for Gradle. The temp
file is deleted via `trap ... EXIT`.

---

## 3. Fastlane Lanes

Fastlane is invoked from `packages/client/`. The wrapper scripts in `scripts/`
are the canonical entry points — they validate env vars and handle secret
material before calling fastlane.

| Platform | Lane | What it does |
|---|---|---|
| iOS | `ios_beta` | Sync certs via Match (`readonly`), build with `gym`, upload to TestFlight (internal, no external distribution) |
| iOS | `ios_release` | Submit an approved TestFlight build to App Store production review via `deliver` |
| Android | `android_beta` | Assemble release AAB with Gradle (signed via env vars), upload to Play Store **internal** track as a draft |
| Android | `android_release` | Promote the latest internal track build to **production** on Google Play |

Direct invocation (from `packages/client/` with secrets exported):

```sh
bundle exec fastlane ios ios_beta
bundle exec fastlane ios ios_release
bundle exec fastlane android android_beta
bundle exec fastlane android android_release
```

---

## 4. TestFlight — iOS Beta Steps

1. Ensure all [secrets](#2b-ios) are set.
2. Dispatch the `Release iOS` workflow (see [section 6](#6-enabling-the-release-workflows)):
   - **lane**: `beta`
   - **version_number**: `1.2.0` (or leave blank to keep the current value in `.env.production`)
   - **build_number**: `42` (must be higher than the last submitted build)
3. The workflow runs `scripts/release-ios.sh beta`, which:
   a. Validates env vars.
   b. Writes `ASC_API_KEY_JSON` to a temp file → `ASC_API_KEY_PATH`.
   c. Optionally runs `scripts/bump-version.sh` if version/build args were provided.
   d. Runs `bundle exec fastlane ios ios_beta`:
      - `match` syncs the App Store provisioning profile (read-only on CI).
      - `gym` builds a Release archive and exports an `.ipa`.
      - `pilot` uploads to TestFlight (internal testers only,
        `distribute_external: false`).
4. The build appears in TestFlight within ~30 minutes (Apple processing time).
5. Invite internal testers from App Store Connect → TestFlight → Internal Testing.

---

## 5. Google Play Internal Track — Android Beta Steps

1. Ensure all [secrets](#2c-android) are set.
2. Dispatch the `Release Android` workflow:
   - **lane**: `beta`
   - **version_number** / **build_number**: as above.
3. The workflow runs `scripts/release-android.sh beta`, which:
   a. Validates env vars.
   b. Decodes `ANDROID_KEYSTORE_BASE64` to a temp keystore file.
   c. Optionally bumps version.
   d. Runs `bundle exec fastlane android android_beta`:
      - `gradle` assembles a signed release AAB.
      - `supply` uploads the AAB to the **internal** track as a draft release.
4. Go to Google Play Console → your app → Testing → Internal testing to
   promote the draft and add testers.

---

## 6. Release Runbook

### 6a. Prepare a release

```sh
# 1. Decide the version: semantic version + monotonically increasing build number.
# 2. (Optional) bump versions locally for review:
sh scripts/bump-version.sh --version 1.2.0 --build 42
git add packages/client/.env.production packages/client/ios/release.xcconfig
git commit -m "chore: bump to 1.2.0 (build 42)"
git push origin main
```

Or pass `version_number` / `build_number` directly as workflow inputs — the
release script will call `bump-version.sh` automatically.

### 6b. iOS beta → production

1. Dispatch **Release iOS** with `lane: beta`. Wait for TestFlight processing.
2. Run internal testing / smoke tests on TestFlight.
3. When approved, dispatch **Release iOS** with `lane: release`. The `deliver`
   action submits the already-uploaded binary for App Store review.
4. After Apple approves (1–3 days), manually release from App Store Connect or
   set `automatic_release: true` in the `ios_release` lane.

### 6c. Android beta → production

1. Dispatch **Release Android** with `lane: beta`. Promote the draft in Play
   Console to make it visible to internal testers.
2. Test on the internal track.
3. Dispatch **Release Android** with `lane: release`. The `supply` action
   promotes the internal track build to production.

---

## 7. Rollback

### iOS

Apple does not support instant rollback of App Store releases. Options:

- **Reject the in-review build**: from App Store Connect, remove the build
  from review before it is approved.
- **Phased rollout**: use phased release in App Store Connect and pause or halt
  the rollout if a critical bug is found.
- **Expedited fix**: submit a hotfix build with an incremented build number.
  Use the `ios_beta` lane, then `ios_release` when cleared.

### Android

Google Play supports immediate rollback to a previous production release:

1. Open Google Play Console → your app → Production.
2. Click **Create new release** or **Manage** the current release.
3. Under **Rollout**, click **Halt rollout**.
4. To roll back: under **Releases**, select a previous release and click
   **Re-release to production**.

Alternatively, submit a hotfix build via `android_beta` → `android_release`.

---

## 8. Version Bumping

`scripts/bump-version.sh` updates `VERSION_NUMBER` and `BUILD_NUMBER` in:

- `packages/client/.env.development`
- `packages/client/.env.staging`
- `packages/client/.env.production`
- `packages/client/ios/release.xcconfig` (generated; Xcode reads at build time)

Android version codes/names flow through `react-native-config` via the `.env`
files; `build.gradle` reads them via `project.env.get()`.

```sh
# Examples:
sh scripts/bump-version.sh --version 1.3.0 --build 43
sh scripts/bump-version.sh --build 44      # keep version, bump build only
```

---

## 9. Enabling the Release Workflows

Both release workflows (`release-ios.yml`, `release-android.yml`) use
`workflow_dispatch` only — automatic push/PR triggers are **disabled** by
design (matching the repo's disabled-by-default CI policy).

To dispatch manually:

1. Go to the GitHub repository → **Actions**.
2. Select **Release iOS** or **Release Android** from the left sidebar.
3. Click **Run workflow**, fill in the inputs, and click **Run workflow**.

To enable automated triggers (e.g. on push to `main`), edit the workflow file
and uncomment / add the desired trigger:

```yaml
on:
  workflow_dispatch:
    ...
  push:
    branches:
      - main
    tags:
      - 'v*'
```

Do this only when the signing setup, secrets, and test suite are fully
validated on hardware.

---

## 10. CI (Lint / Test / Typecheck)

The CI workflow (`.github/workflows/ci.yml`) runs `lint`, `test --coverage`,
and `typecheck` on every `workflow_dispatch` (automatic triggers are currently
commented out — see the file header). No native build or device is involved.

Enable automatic CI by uncommenting the `push` / `pull_request` triggers in
`ci.yml` when ready.
