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

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="${REPO_ROOT}/packages/client"
OTA_DIR="${REPO_ROOT}/backend/ota"
D1_NAME="micdrp-ota"

die() { printf 'error: %s\n' "$1" >&2; exit 1; }
info() { printf '%s\n' "$1"; }

d1() {
  npx --yes wrangler d1 execute "${D1_NAME}" --remote \
    --config "${OTA_DIR}/wrangler.jsonc" --command "$1"
}

# Read a key out of the active env file. The same values the binary was built
# with, so a publish cannot claim a version no build ever had.
env_value() {
  local key="$1" file="${CLIENT_DIR}/.env.production"
  [ -f "$file" ] || die "no .env.production — run 'git secret reveal' first"
  grep -E "^${key}=" "$file" | head -1 | cut -d= -f2-
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

  info "Bundle for ${target_version}, runnable on build >=${min_build}"
  if [ "$dry_run" = "1" ]; then
    info "Would publish to ${channel}. Stopping before the upload."
    return 0
  fi

  # hot-updater builds, uploads to R2 and inserts the row.
  ( cd "$CLIENT_DIR" && npx hot-updater deploy \
      --platform ios --channel "$channel" \
      --target-app-version "$target_version" \
      ${message:+--message "$message"} )

  # Stamp the one constraint their schema has no column for, onto the row the
  # deploy just created — the newest on the channel.
  d1 "UPDATE bundles
         SET metadata = json_set(COALESCE(metadata, '{}'),
                                 '\$.min_build_number', ${min_build})
       WHERE id = (SELECT id FROM bundles
                    WHERE channel = '${channel}' AND platform = 'ios'
                    ORDER BY id DESC LIMIT 1)"

  info "Published to ${channel} for ${target_version} build >=${min_build}."
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
  *) die "usage: yarn ota {publish <channel>|disable <bundleId>|list [channel]}" ;;
esac
