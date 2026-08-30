#!/bin/bash
set -euo pipefail

# ota.sh — publish, withdraw, and list over-the-air bundles.
#
# Building the archive and uploading it is hot-updater's CLI; this script adds
# the two things it has no flag for:
#
#   1. `min_build_number`, stamped into the row's metadata after the deploy.
#      It is the guard that stops a bundle depending on a native change being
#      handed to a binary that predates it — a crash, not a downgrade
#      (INV-UPD-002). hot-updater expresses the same idea as `minBundleId`;
#      BUILD_NUMBER is the value this project already reasons in.
#
#   2. Refusing to publish anything the release pipeline would not accept:
#      beta only, a version that exists, a build number that is a number.
#
# Commands are specified in
# .harnex/project/specs/domains/updates/commands.yml.

# Cloudflare credentials are read from a micdrp-specific variable, never from
# the ambient CLOUDFLARE_API_TOKEN. That variable belongs to whichever project
# was last worked on — on this machine it is TallieUp's — and a deploy that
# silently fell back to it would create micdrp's database in someone else's
# account. Missing is an error, not a fallback.
#
# Set MICDRP_CLOUDFLARE_API_TOKEN (and optionally MICDRP_CLOUDFLARE_ACCOUNT_ID)
# in your shell. Do NOT put either in packages/client/.env* — react-native-config
# compiles those into the IPA, where anyone can read them.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="${REPO_ROOT}/packages/client"
OTA_DIR="${REPO_ROOT}/backend/ota"
D1_NAME="micdrp-ota"

die() { printf 'error: %s\n' "$1" >&2; exit 1; }
info() { printf '%s\n' "$1"; }

# Run wrangler with micdrp's credentials and nothing else in scope.
wr() {
  [ -n "${MICDRP_CLOUDFLARE_API_TOKEN:-}" ] ||
    die "MICDRP_CLOUDFLARE_API_TOKEN is not set. Refusing to fall back to
       CLOUDFLARE_API_TOKEN, which on this machine belongs to another project."

  CLOUDFLARE_API_TOKEN="${MICDRP_CLOUDFLARE_API_TOKEN}" \
  CLOUDFLARE_ACCOUNT_ID="${MICDRP_CLOUDFLARE_ACCOUNT_ID:-}" \
    npx --yes wrangler "$@"
}

d1() {
  wr d1 execute "${D1_NAME}" --remote \
    --config "${OTA_DIR}/wrangler.jsonc" --command "$1"
}

cmd_whoami() {
  wr whoami
}

cmd_deploy() {
  wr deploy --config "${OTA_DIR}/wrangler.jsonc"
}

# Read a key out of the active env file. The same values the binary was built
# with, so a publish cannot claim a version no build ever had.
env_value() {
  local key="$1" file="${CLIENT_DIR}/.env.production"
  [ -f "$file" ] || die "no .env.production — run 'git secret reveal' first"
  grep -E "^${key}=" "$file" | head -1 | cut -d= -f2-
}

# Refuse to publish from a tree that is behind the trunk (INV-UPD-014).
#
# Bundles are served newest-first, so a publish from behind does not merely
# omit newer work — it withdraws it from every device that already took it.
# That is how the beta channel moved backwards by 44 commits on 2026-08-22:
# two lines of work published in turn from trees neither of which contained
# the other. One fetch turns that silent regression into a refusal to ship.
#
# A tree merely ahead of the trunk publishes fine. Only missing commits stop it.
require_trunk_contained() {
  git rev-parse --git-dir >/dev/null 2>&1 || return 0
  git fetch origin main --quiet 2>/dev/null || \
    info "Could not reach origin; judging against the trunk as last known."
  git rev-parse --verify --quiet origin/main >/dev/null || return 0

  git merge-base --is-ancestor origin/main HEAD && return 0

  local behind
  behind="$(git rev-list --count HEAD..origin/main)"
  info "This tree is missing ${behind} commit(s) already on origin/main."
  info "Publishing now would withdraw them from every device that has them."
  die "refusing to publish from behind the trunk — merge origin/main first"
}

cmd_publish() {
  local channel="${1:-}"; shift || true
  local target_version="" min_build="" message="" dry_run=0

  while [ $# -gt 0 ]; do
    case "$1" in
      --target-version) target_version="$2"; shift 2 ;;
      --min-build)      min_build="$2";      shift 2 ;;
      --message)        message="$2";        shift 2 ;;
      --dry-run)        dry_run=1;           shift ;;
      *) die "unknown flag: $1" ;;
    esac
  done

  [ "$channel" = "beta" ] || die "beta is the only channel that exists"
  [ -n "$target_version" ] || target_version="$(env_value VERSION_NUMBER)"
  [ -n "$min_build" ] || min_build="$(env_value BUILD_NUMBER)"
  [[ "$min_build" =~ ^[0-9]+$ ]] || die "--min-build must be a number"
  # Always the build this machine is on: the source being bundled is that
  # build's source.
  local built_from
  built_from="$(env_value BUILD_NUMBER)"

  require_trunk_contained

  info "Bundle for ${target_version}, runnable on build >=${min_build}"
  if [ "$dry_run" = "1" ]; then
    info "Would publish to ${channel}. Stopping before the upload."
    return 0
  fi

  # Deploy the Worker first, every time.
  #
  # The rules that decide who may take a bundle live in the Worker, and a
  # publish against a stale Worker enforces stale rules. That is exactly what
  # happened once: the recency rule was changed and committed but not
  # deployed, so a build-7 bundle was handed to build 9 and silently reverted
  # it. Deploying is idempotent and takes a second; drifting is not worth the
  # second saved.
  info "Deploying the update server first, so the published rules are current"
  cmd_deploy >/dev/null

  # hot-updater builds, uploads to R2 and inserts the row.
  ( cd "$CLIENT_DIR" && \
    CLOUDFLARE_API_TOKEN="${MICDRP_CLOUDFLARE_API_TOKEN}" \
    CLOUDFLARE_ACCOUNT_ID="${MICDRP_CLOUDFLARE_ACCOUNT_ID:-}" \
    npx hot-updater deploy \
      --platform ios --channel "$channel" \
      --target-app-version "$target_version" \
      ${message:+--message "$message"} )

  # Put the app version back on the row (INV-UPD-021).
  #
  # --target-app-version is passed above and ignored: under the 'fingerprint'
  # strategy their CLI writes null into that column, because their own server
  # would match on the fingerprint instead. Ours matches on the keys an install
  # actually sends — channel, app version, build number — so a null there means
  # the bundle matches nobody and every check is answered with nothing. The
  # publish said "Published"; the release said "shipped"; nothing shipped.
  #
  # The fingerprint still does its own job, which is a different one: refusing
  # a resident bundle belonging to another binary, natively, at launch
  # (INV-UPD-020).
  #
  # Stamped here rather than argued with, because their column is theirs.
  # Two numbers, and they answer different questions. min_build_number is the
  # lowest binary that CAN run this bundle. built_from_build is the binary
  # whose source it was built FROM — which is how recency is judged, because a
  # bundle made from an older build is a downgrade however recently it was
  # published (INV-UPD-010).
  d1 "UPDATE bundles
         SET target_app_version = '${target_version}',
             metadata = json_set(json_set(COALESCE(metadata, '{}'),
                                 '\$.min_build_number', ${min_build}),
                                 '\$.built_from_build', ${built_from})
       WHERE id = (SELECT id FROM bundles
                    WHERE channel = '${channel}' AND platform = 'ios'
                    ORDER BY id DESC LIMIT 1)"

  # Ask the server, as the oldest install this bundle claims to run on,
  # whether it is offered the bundle. A publish that reports success and hands
  # out nothing is the failure this whole file exists to prevent, and it is one
  # request away from being knowable rather than assumed (INV-UPD-021).
  local answer
  answer="$(curl -fsS -X POST "$(env_value OTA_UPDATE_URL)/check" \
    -H 'Content-Type: application/json' \
    -d "{\"channel\":\"${channel}\",\"appVersion\":\"${target_version}\",\"buildNumber\":${min_build},\"bundleId\":\"00000000-0000-0000-0000-000000000000\"}" \
    2>/dev/null || echo null)"
  case "$answer" in
    *'"UPDATE"'*) info "Published to ${channel} for ${target_version} build >=${min_build}." ;;
    *) die "Published, but the server offers build ${min_build} nothing. Answer: ${answer}" ;;
  esac
}

cmd_disable() {
  local bundle_id="${1:-}"
  [ -n "$bundle_id" ] || die "usage: yarn ota disable <bundleId>"

  d1 "UPDATE bundles SET enabled = 0 WHERE id = '${bundle_id}'"
  info "Disabled ${bundle_id}. Installs running it roll back on their next check."
}

cmd_list() {
  local channel="${1:-beta}"
  d1 "SELECT id, target_app_version,
             json_extract(metadata, '\$.min_build_number') AS min_build,
             enabled
        FROM bundles
       WHERE channel = '${channel}' AND platform = 'ios'
       ORDER BY id DESC"
}

case "${1:-}" in
  publish) shift; cmd_publish "$@" ;;
  disable) shift; cmd_disable "$@" ;;
  list)    shift; cmd_list "$@" ;;
  whoami)  shift; cmd_whoami ;;
  deploy)  shift; cmd_deploy ;;
  *) die "usage: yarn ota {publish <channel>|disable <bundleId>|list [channel]|whoami|deploy}" ;;
esac
