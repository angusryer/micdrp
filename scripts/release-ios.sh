#!/bin/sh
# release-ios.sh — wrapper around the fastlane ios_beta / ios_release lanes.
#
# Usage:
#   scripts/release-ios.sh [beta|release]  (default: beta)
#
# Prerequisites (all must be set as environment variables / CI secrets):
#   See packages/client/fastlane/README.md for the full list.
#
# This script:
#   1. Validates required environment variables are present.
#   2. Writes the App Store Connect API key JSON to a temp file.
#   3. Calls bump-version.sh if VERSION_NUMBER / BUILD_NUMBER are provided.
#   4. Invokes fastlane from packages/client/ with the appropriate lane.
#   5. Cleans up the temp API key file on exit.
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
  # POSIX-compatible indirect variable check via eval
  eval "val=\"\${${1}:-}\""
  if [ -z "${val}" ]; then
    echo "Error: required environment variable '${1}' is not set." >&2
    exit 1
  fi
}

require_env "APPLE_ID"
require_env "APPLE_TEAM_ID"
require_env "ITC_TEAM_ID"
require_env "IOS_BUNDLE_ID"
require_env "MATCH_GIT_URL"
require_env "MATCH_PASSWORD"
require_env "MATCH_KEYCHAIN_PASSWORD"
require_env "ASC_API_KEY_JSON"

# ---------------------------------------------------------------------------
# Write App Store Connect API key to a temp file
# ---------------------------------------------------------------------------
ASC_KEY_TMPFILE="$(mktemp /tmp/asc_api_key_XXXXXX.json)"
trap 'rm -f "${ASC_KEY_TMPFILE}"' EXIT INT TERM

printf '%s' "${ASC_API_KEY_JSON}" > "${ASC_KEY_TMPFILE}"
export ASC_API_KEY_PATH="${ASC_KEY_TMPFILE}"

echo "ASC API key written to: ${ASC_KEY_TMPFILE}"

# ---------------------------------------------------------------------------
# Optional version bump (only when both vars are supplied)
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
echo "Running: bundle exec fastlane ios ios_${LANE}"
echo "Working directory: ${CLIENT_DIR}"
echo ""

cd "${CLIENT_DIR}"
bundle exec fastlane ios "ios_${LANE}"
