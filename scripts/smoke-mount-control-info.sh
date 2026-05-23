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

# POST probe: sends body, expects HTTP 200 + presence of expect_key in JSON response.
# Uses -m 35 to allow for MPD restart latency within the 30s write timeout.
# Idempotency strategy: callers read the current value via GET first, then POST
# the same value back — the handler detects "already set" and skips MPD restart,
# so playback is never disrupted during smoke runs.
probe_post() {
  local path="$1" body="$2" expect_key="$3"
  local response
  response=$(curl -fsS -m 35 -X POST \
    -H "Content-Type: application/json" \
    -H "X-Auth-Token: ${TOKEN}" \
    -d "$body" \
    "${BASE}${path}") || { echo "FAIL ${path}: curl failed"; EXIT=1; return; }
  echo "$response" | jq -e ". | has(\"${expect_key}\")" >/dev/null || {
    echo "FAIL ${path}: missing key '${expect_key}' in response"
    echo "  body: $(echo "$response" | head -c 300)"
    EXIT=1
    return
  }
  local success
  success=$(echo "$response" | jq -r '.success // "null"')
  if [ "$success" = "false" ]; then
    echo "WARN ${path}: success=false — $(echo "$response" | jq -r '.error // "(no error field)"')"
  else
    echo "OK   ${path}"
  fi
}

probe /api/system/info         "host name type hardware"
probe /api/system/device       "uuid name"
probe /api/network/status      "type ip interface"
probe /api/audio/bitperfect    "status issues warnings config"
probe /api/audio/dsd           "mode success"
probe /api/audio/mixer         "enabled success"

# M1.E.1 write endpoint smoke (idempotent: send current value back so MPD is NOT restarted).
# GET the current value first, then POST the same value back.
# D6 in the handler detects "no change needed" and returns 200+success=true without touching MPD.
CUR_DSD_MODE=$(curl -fsS -m 3 -H "X-Auth-Token: ${TOKEN}" "${BASE}/api/audio/dsd" | jq -r '.mode')
probe_post /api/audio/dsd              "{\"mode\":\"${CUR_DSD_MODE}\"}"  "success"

CUR_MIXER_ENABLED=$(curl -fsS -m 3 -H "X-Auth-Token: ${TOKEN}" "${BASE}/api/audio/mixer" | jq -r '.enabled')
probe_post /api/audio/mixer            "{\"enabled\":${CUR_MIXER_ENABLED}}"  "success"

# bitperfect/apply has no meaningful idempotency parameter — POST once and assert shape.
# Second run (if already optimal) returns success=true with all entries saying "already set to optimal".
probe_post /api/audio/bitperfect/apply '{}'                 "success"

exit $EXIT
