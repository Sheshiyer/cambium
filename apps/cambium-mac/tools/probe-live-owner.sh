#!/bin/sh
# Read-only owner activation preflight for the Cambium Native surface.
#
# This script performs only bounded GET requests. It never supplies a native
# bearer, Access token, TeamForge token, cookie, or request body, and it never
# mutates Cloudflare, D1, TeamForge, or the Mac app. A 401/404/501 is recorded
# as observed runtime state rather than converted into a success claim.
set -eu

owner_url=${CAMBIUM_OWNER_URL:-https://curious.thoughtseed.space}
teamforge_url=${CAMBIUM_TEAMFORGE_IDENTITY_URL:-https://teamforge-api.thoughtseedlabs.workers.dev/v1/native/identity/pid_admin_thoughtseed_labs?tenant_id=cambium}

case "$owner_url" in
  https://*\?*|https://*\#*|http://*|https://) echo 'CAMBIUM_OWNER_URL must be an HTTPS origin without query or fragment' >&2; exit 2 ;;
esac

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/cambium-live-owner.XXXXXX")
trap 'rm -rf -- "$tmp_dir"' EXIT HUP INT TERM

probe() {
  name=$1
  url=$2
  body="$tmp_dir/$name.body"
  headers="$tmp_dir/$name.headers"
  status=$(curl -sS --max-time 20 -X GET -D "$headers" -o "$body" -w '%{http_code}' "$url" 2>"$tmp_dir/$name.error" || printf '000')
  error_code=$(jq -r 'if type == "object" and (.error|type) == "object" then .error.code elif type == "object" and (.error|type) == "string" then .error else empty end' "$body" 2>/dev/null || true)
  error_message=$(jq -r 'if type == "object" and (.error|type) == "object" then .error.message elif type == "object" and (.message|type) == "string" then .message else empty end' "$body" 2>/dev/null || true)
  jq -n --arg name "$name" --arg url "$url" --arg status "$status" --arg code "$error_code" --arg message "$error_message" \
    '{name:$name,url:$url,status:($status|tonumber),errorCode:(if $code == "" then null else $code end),message:(if $message == "" then null else $message end)}' \
    > "$tmp_dir/$name.json"
}

probe health "$owner_url/healthz"
probe nativeSession "$owner_url/v1/native/session"
probe missionFabric "$owner_url/v1/mission-fabric/cambium"
probe questProjection "$owner_url/api/quests/cambium"
probe teamforgeIdentity "$teamforge_url"

jq -s --arg owner "$owner_url" --arg tenant cambium --arg client space.thoughtseed.cambium.native.dev \
  '{schema:"cambium.live-owner-preflight.v1",readOnly:true,ownerOrigin:$owner,tenant:$tenant,clientId:$client,probes:sort_by(.name),routeSurfaceReady:(all(.[]; (.name == "health" and .status == 200) or (.name != "health" and .status != 404 and .status != 501)))}' \
  "$tmp_dir"/*.json
