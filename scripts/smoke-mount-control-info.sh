#!/usr/bin/env bash
# Smoke-test the six M1.E read endpoints on stellar-mount-control.
# Usage:
#   ./smoke-mount-control-info.sh                 # uses env vars or defaults
#   PI_HOST=192.168.86.25 PI_PORT=8082 TOKEN=... ./smoke-mount-control-info.sh
set -euo pipefail

# Ensure Homebrew bin is in PATH so jq is found even when .tool-versions
# doesn't set a jq version for this project (asdf shim would error otherwise).
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

PI_HOST="${PI_HOST:-192.168.86.25}"
PI_PORT="${PI_PORT:-8082}"
TOKEN="${TOKEN:-${STELLAR_MOUNT_TOKEN:-}}"

if [ -z "$TOKEN" ]; then
  echo "FATAL: TOKEN env var (or STELLAR_MOUNT_TOKEN) required" >&2
  exit 2
fi

BASE="http://${PI_HOST}:${PI_PORT}"
EXIT=0

probe() {
  local path="$1" expect_keys="$2"
  local body
  body=$(curl -fsS -m 3 -H "X-Auth-Token: ${TOKEN}" "${BASE}${path}") || {
    echo "FAIL ${path}: curl failed"
    EXIT=1
    return
  }
  for key in $expect_keys; do
    echo "$body" | jq -e ". | has(\"${key}\")" >/dev/null || {
      echo "FAIL ${path}: missing key '${key}' in response"
      echo "  body: $(echo "$body" | head -c 200)"
      EXIT=1
      return
    }
  done
  echo "OK   ${path}"
}

probe /api/system/info         "host name type hardware"
probe /api/system/device       "uuid name"
probe /api/network/status      "type ip interface"
probe /api/audio/bitperfect    "status issues warnings config"
probe /api/audio/dsd           "mode success"
probe /api/audio/mixer         "enabled success"

exit $EXIT
