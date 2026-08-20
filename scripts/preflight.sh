#!/usr/bin/env bash
# Everything that must be true before a release, in one place.
#
# CI and a human run the same checks by running this script, so the two cannot
# drift. It is also the body of the pre-push hook. Skip a run with
# `git push --no-verify` or PREFLIGHT_SKIP=1.
#
#   scripts/preflight.sh            checks only
#   scripts/preflight.sh --pods     checks, then install pods (what a release needs)
#   scripts/preflight.sh --build    checks, pods, and compile the app (slow)
#
# A release uses --pods, not --build. The release archives the app itself, so a
# preceding simulator build only repeats work the archive already does and
# fails on: two full compiles for one shipped artifact.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -n "${PREFLIGHT_SKIP:-}" ]; then
  echo "preflight: skipped (PREFLIGHT_SKIP set)"
  exit 0
fi

WITH_BUILD=""
WITH_PODS=""
case "${1:-}" in
  --build) WITH_BUILD=1; WITH_PODS=1 ;;
  --pods)  WITH_PODS=1 ;;
esac

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

step "specs validate (axiom 1 — the specs are the contract)"
./.harnex/framework/verification/run.sh --validate 2>&1 \
  | grep -vE "memory.local-config" \
  | tail -4
./.harnex/framework/verification/run.sh --validate 2>&1 | grep -q "No errors" \
  || fail "spec validation reported errors"

step "typecheck"
(cd packages/client && npx tsc --noEmit)
# The dogfood loop and the update Worker run outside the client's tsconfig.
# Both are unattended machinery — the loop commits to main and publishes to a
# phone — so they are checked here rather than trusted.
npx tsc --noEmit -p scripts/dogfood/tsconfig.json
npx tsc --noEmit -p backend/ota/tsconfig.json

step "lint"
yarn lint

step "test (all packages)"
yarn test

if [ -n "$WITH_PODS" ]; then
  step "pods"
  (cd packages/client/ios && bundle exec pod install 2>/dev/null || pod install)
fi

if [ -n "$WITH_BUILD" ]; then
  step "ios release build"
  (cd packages/client/ios && xcodebuild \
    -workspace micdrp.xcworkspace -scheme micdrp -configuration Release \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    CODE_SIGNING_ALLOWED=NO -quiet build) \
    || fail "the iOS build failed"
fi

printf '\n\033[32m✓ preflight passed\033[0m\n'
