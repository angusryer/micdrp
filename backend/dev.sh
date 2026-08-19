#!/usr/bin/env bash
# Boot the local PocketBase backend.
#
# Downloads the pinned binary on first run, applies backend/migrations/, and
# serves on 127.0.0.1:8090. The binary and its data are gitignored; the
# migrations are the schema's source of truth and ARE committed.
#
#   backend/dev.sh              serve
#   backend/dev.sh --superuser  also create/update the dev superuser
set -euo pipefail

VERSION="0.39.11"
HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="${HERE}/.bin/pocketbase"
DATA="${HERE}/.data"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) ASSET="pocketbase_${VERSION}_darwin_arm64.zip" ;;
  Darwin-x86_64) ASSET="pocketbase_${VERSION}_darwin_amd64.zip" ;;
  Linux-x86_64) ASSET="pocketbase_${VERSION}_linux_amd64.zip" ;;
  Linux-aarch64) ASSET="pocketbase_${VERSION}_linux_arm64.zip" ;;
  *) echo "unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

if [ ! -x "$BIN" ]; then
  echo "Fetching PocketBase ${VERSION}..."
  mkdir -p "${HERE}/.bin"
  curl -sL -o "${HERE}/.bin/pb.zip" \
    "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/${ASSET}"
  unzip -oq "${HERE}/.bin/pb.zip" -d "${HERE}/.bin"
  rm -f "${HERE}/.bin/pb.zip"
fi

if [ "${1:-}" = "--superuser" ]; then
  "$BIN" superuser upsert "${PB_ADMIN_EMAIL:-dev@micdrp.local}" \
    "${PB_ADMIN_PASSWORD:-devpassword123}" --dir "$DATA"
  shift
fi

exec "$BIN" serve \
  --http="${PB_HTTP:-127.0.0.1:8090}" \
  --dir="$DATA" \
  --migrationsDir="${HERE}/migrations" "$@"
