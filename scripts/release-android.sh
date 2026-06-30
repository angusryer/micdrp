#!/bin/sh
# release-android.sh — wrapper around the fastlane android_beta / android_release lanes.
#
# Usage:
#   scripts/release-android.sh [beta|release]  (default: beta)
#
# Prerequisites (all must be set as environment variables / CI secrets):
#   See packages/client/fastlane/README.md for the full list.
#
# This script:
#   1. Validates required environment variables are present.
#   2. Decodes the base64-encoded keystore into a temp file.
#   3. Calls bump-version.sh if VERSION_NUMBER / BUILD_NUMBER are provided.
#   4. Invokes fastlane from packages/client/ with the appropriate lane.
#   5. Cleans up the temp keystore on exit.
#
# POSIX sh, shellcheck-clean.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="${REPO_ROOT}/packages/client"
LANE="${1:-beta}"

# ---------------------------------------------------------------------------
# Validate lane argument
# ---------------------------------------------------------------------------
case "${LANE}" in
  beta|release) ;;
  *)
    echo "Error: unknown lane '${LANE}'. Expected 'beta' or 'release'." >&2
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Validate required environment variables
# ---------------------------------------------------------------------------
require_env() {
  eval "val=\"\${${1}:-}\""
  if [ -z "${val}" ]; then
    echo "Error: required environment variable '${1}' is not set." >&2
    exit 1
  fi
}

require_env "ANDROID_PACKAGE_NAME"
require_env "ANDROID_KEYSTORE_BASE64"
require_env "ANDROID_KEYSTORE_PASSWORD"
require_env "ANDROID_KEY_ALIAS"
require_env "ANDROID_KEY_PASSWORD"
require_env "SUPPLY_JSON_KEY_DATA"

# ---------------------------------------------------------------------------
# Decode the keystore from base64 into a temp file
# ---------------------------------------------------------------------------
KEYSTORE_TMPFILE="$(mktemp /tmp/micdrp_release_XXXXXX.keystore)"
trap 'rm -f "${KEYSTORE_TMPFILE}"' EXIT INT TERM

printf '%s' "${ANDROID_KEYSTORE_BASE64}" | base64 --decode > "${KEYSTORE_TMPFILE}"
export ANDROID_KEYSTORE_PATH="${KEYSTORE_TMPFILE}"

echo "Keystore decoded to: ${KEYSTORE_TMPFILE}"

# ---------------------------------------------------------------------------
# Optional version bump
# ---------------------------------------------------------------------------
if [ -n "${VERSION_NUMBER:-}" ] || [ -n "${BUILD_NUMBER:-}" ]; then
  BUMP_ARGS=""
  [ -n "${VERSION_NUMBER:-}" ] && BUMP_ARGS="${BUMP_ARGS} --version ${VERSION_NUMBER}"
  [ -n "${BUILD_NUMBER:-}" ]   && BUMP_ARGS="${BUMP_ARGS} --build ${BUILD_NUMBER}"
  # shellcheck disable=SC2086
  sh "${REPO_ROOT}/scripts/bump-version.sh" ${BUMP_ARGS}
fi

# ---------------------------------------------------------------------------
# Set ENVFILE for fastlane lane helpers
# ---------------------------------------------------------------------------
export ENVFILE="${ENVFILE:-${CLIENT_DIR}/.env.production}"

# ---------------------------------------------------------------------------
# Run fastlane
# ---------------------------------------------------------------------------
echo ""
echo "Running: bundle exec fastlane android android_${LANE}"
echo "Working directory: ${CLIENT_DIR}"
echo ""

cd "${CLIENT_DIR}"
bundle exec fastlane android "android_${LANE}"
