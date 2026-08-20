#!/usr/bin/env bash
# Everything that must be true before a release, in one place.
#
# CI and a human run the same checks by running this script, so the two cannot
# drift. It is also the body of the pre-push hook. Skip a run with
# `git push --no-verify` or PREFLIGHT_SKIP=1.
#
#   scripts/preflight.sh            checks only
#   scripts/preflight.sh --build    also compile the iOS app (slow, thorough)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -n "${PREFLIGHT_SKIP:-}" ]; then
  echo "preflight: skipped (PREFLIGHT_SKIP set)"
  exit 0
fi

WITH_BUILD=""
[ "${1:-}" = "--build" ] && WITH_BUILD=1

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

step "lint"
yarn lint

step "test (all packages)"
yarn test

if [ -n "$WITH_BUILD" ]; then
  step "pods"
  (cd packages/client/ios && bundle exec pod install 2>/dev/null || pod install)

  step "ios release build"
  (cd packages/client/ios && xcodebuild \
    -workspace micdrp.xcworkspace -scheme micdrp -configuration Release \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    CODE_SIGNING_ALLOWED=NO -quiet build) \
    || fail "the iOS build failed"
fi

printf '\n\033[32m✓ preflight passed\033[0m\n'
