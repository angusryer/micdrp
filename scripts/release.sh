#!/usr/bin/env bash
# One release, end to end. The single entry point a human or CI uses, so the
# two paths cannot drift.
#
#   scripts/release.sh 1.2.0                 preflight, build, ship to TestFlight
#   scripts/release.sh 1.2.0 --platform ios  one platform only (default: ios)
#   scripts/release.sh 1.2.0 --dry-run       everything except the upload
#   scripts/release.sh --check               just tell me if I could release
#
# Credentials (iOS): an App Store Connect API key, as either
#   ASC_API_KEY_PATH   path to fastlane's JSON, or
#   ASC_KEY_ID + ASC_ISSUER_ID + ASC_KEY_CONTENT
# Nothing else — no Apple ID, no match repo, no 2FA.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION=""
PLATFORM="ios"
DRY_RUN=""
CHECK_ONLY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --platform) PLATFORM="$2"; shift 2 ;;
    --dry-run)  DRY_RUN=1; shift ;;
    --check)    CHECK_ONLY=1; shift ;;
    -h|--help)  sed -n '2,14p' "$0"; exit 0 ;;
    -*)         echo "unknown option: $1" >&2; exit 1 ;;
    *)          VERSION="$1"; shift ;;
  esac
done

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
ok()   { printf '\033[32m  ✓ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m  ! %s\033[0m\n' "$1"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# --- what is and is not in place -------------------------------------------
have_ios_key() {
  [ -n "${ASC_API_KEY_PATH:-}" ] || [ -n "${ASC_API_KEY_JSON:-}" ] || \
  { [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ] && [ -n "${ASC_KEY_CONTENT:-}" ]; }
}

if [ -n "$CHECK_ONLY" ]; then
  step "release readiness"
  command -v fastlane >/dev/null && ok "fastlane $(fastlane --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)" || warn "fastlane not installed"
  command -v xcodebuild >/dev/null && ok "xcode $(xcodebuild -version | head -1 | awk '{print $2}')" || warn "xcode not installed"
  [ -f packages/client/.env.production ] && ok ".env.production present" \
    || warn ".env.production missing — run: git secret reveal"
  have_ios_key && ok "App Store Connect API key present" \
    || warn "no App Store Connect API key (ASC_API_KEY_PATH, or ASC_KEY_ID + ASC_ISSUER_ID + ASC_KEY_CONTENT)"
  exit 0
fi

[ -n "$VERSION" ] || fail "a version is required, e.g. scripts/release.sh 1.2.0"
echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' \
  || fail "version must be X.Y.Z, got '$VERSION'"

# --- gate -------------------------------------------------------------------
step "preflight"
scripts/preflight.sh --build

# --- version ----------------------------------------------------------------
step "version"
if [ -x scripts/bump-version.sh ]; then
  scripts/bump-version.sh --version "$VERSION" ${BUILD_NUMBER:+--build "$BUILD_NUMBER"}
fi
ok "releasing $VERSION"

# --- ship -------------------------------------------------------------------
if [ -n "$DRY_RUN" ]; then
  step "dry run — stopping before the upload"
  ok "everything up to the store submission passed"
  exit 0
fi

case "$PLATFORM" in
  ios)
    have_ios_key || fail "no App Store Connect API key; see --check"
    step "build + upload to TestFlight"
    VERSION_NUMBER="$VERSION" scripts/release-ios.sh beta
    ;;
  android)
    step "build + upload to Play internal"
    VERSION_NUMBER="$VERSION" scripts/release-android.sh beta
    ;;
  both)
    "$0" "$VERSION" --platform ios
    "$0" "$VERSION" --platform android
    ;;
  *) fail "unknown platform: $PLATFORM" ;;
esac

printf '\n\033[32m✓ %s shipped\033[0m\n' "$VERSION"
