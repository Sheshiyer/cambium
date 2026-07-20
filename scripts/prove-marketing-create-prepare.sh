#!/usr/bin/env bash

set +x
set -Eeuo pipefail
IFS=$'\n\t'

# An inherited bearer is copied into this shell, then immediately removed from
# the environment inherited by every child process. Curl receives it only over
# its stdin configuration stream.
BRIDGE_TOKEN="${BRIDGE_TOKEN-}"
export -n BRIDGE_TOKEN 2>/dev/null || true

readonly SCRIPT_PATH="${BASH_SOURCE[0]}"
readonly SCRIPT_DIR="$(cd -P -- "$(dirname -- "$SCRIPT_PATH")" && pwd)"
readonly REPO_ROOT="$(cd -P -- "$SCRIPT_DIR/.." && pwd)"
readonly WRANGLER_CONFIG="$REPO_ROOT/workers/quests/wrangler.jsonc"
readonly WORKER_NAME='cambium-quests'
readonly D1_NAME='cambium-bridge'
readonly D1_UUID='f6b950ac-2480-4a7d-9dac-1ff7e951d936'
readonly PREPARE_ROUTE='/v1/bridge/marketing-renders/prepare'
readonly EXPECTED_ADAPTER_ID='founder-article-nvidia@1.0.0'
readonly EXPECTED_NEXT_ACTION_ROUTE='/api/gate/thoughtseed'
readonly EXPECTED_NEXT_ACTION_KIND='approve-marketing-render'
readonly REQUIRED_WRANGLER_VERSION='4.95.0'
readonly REVIEWED_BASE_ORIGIN_SHA256='553d2960c075af3180b71289101c55fa356e07e9f83cead88ea989d34d4430c5'
readonly ACTIVATION_VERSION_NUMBER=62
readonly ACTIVATION_BINDING_COUNT=21
readonly PROVIDER_SECRET_NAME='NVIDIA_MARKETING_CREATE_API_KEY'
readonly ACTIVATION_SECRET_NAME='MARKETING_CREATE_ACTIVATION'
readonly CANDIDATE_VERSION_ID='9e6885ce-ea25-4158-ba71-69b8bdfc256b'
readonly CANDIDATE_SCRIPT_ETAG='d24335443e95d0755168cc685db4b023947625f867180f6923dc56bd1517a546'
readonly CANDIDATE_FULL_BINDINGS_SHA256='75471627720f10533316bd56c436293f16750d82cde1096afdc035072475363e'
readonly UUID_PATTERN='^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
readonly STATE_RECEIPT="${XDG_STATE_HOME:-${HOME:?HOME must be set}/.local/state}/cambium/marketing-create-secret-staging.json"

fail() {
  builtin printf 'status=failed error=%s\n' "$1" >&2
  exit 1
}

run_wrangler() {
  WRANGLER_WRITE_LOGS=false \
  WRANGLER_LOG_SANITIZE=true \
  npm_config_offline=true \
    npx --no-install wrangler "$@"
}

resolve_wrangler() {
  local observed_version
  command -v npx >/dev/null 2>&1 || fail 'missing_npx'
  observed_version="$(run_wrangler --version 2>/dev/null)" || fail 'missing_wrangler'
  test "$observed_version" = "$REQUIRED_WRANGLER_VERSION" || fail 'unexpected_wrangler_version'
}

check_static_contract() {
  local approval_assertion_count approval_call_pattern curl_config_call curl_config_count
  local forbidden_execute forbidden_provider prepare_count
  approval_call_pattern='(curl|url[[:space:]]*=).*api/ga''te'
  forbidden_execute='/exec''ute'
  forbidden_provider='integrate.api.''nvidia.com'
  curl_config_call='curl -q --con''fig -'

  bash -n "$SCRIPT_PATH" || fail 'bash_syntax_check_failed'
  for dependency in awk bash chmod curl date dirname grep jq mktemp node npx rm shasum; do
    command -v "$dependency" >/dev/null 2>&1 || fail "missing_dependency_$dependency"
  done
  resolve_wrangler

  test -f "$WRANGLER_CONFIG" || fail 'missing_wrangler_config'
  test "$(jq -er '.name' "$WRANGLER_CONFIG")" = "$WORKER_NAME" || fail 'unexpected_worker_name'
  test "$(jq -er '.d1_databases[] | select(.binding == "BRIDGE_DB") | .database_name' "$WRANGLER_CONFIG")" = "$D1_NAME" \
    || fail 'unexpected_d1_name'
  test "$(jq -er '.d1_databases[] | select(.binding == "BRIDGE_DB") | .database_id' "$WRANGLER_CONFIG")" = "$D1_UUID" \
    || fail 'unexpected_d1_uuid'

  prepare_count="$(grep -Foc -- "$PREPARE_ROUTE" "$SCRIPT_PATH" || true)"
  approval_assertion_count="$(grep -Foc -- "$EXPECTED_NEXT_ACTION_ROUTE" "$SCRIPT_PATH" || true)"
  curl_config_count="$(grep -Foc -- "$curl_config_call" "$SCRIPT_PATH" || true)"
  test "$prepare_count" = 1 || fail 'prepare_route_must_appear_once'
  test "$approval_assertion_count" = 1 || fail 'approval_route_must_be_assertion_only'
  test "$curl_config_count" = 1 || fail 'curl_config_call_must_appear_once'
  ! grep -Eq -- "$approval_call_pattern" "$SCRIPT_PATH" || fail 'forbidden_approval_route_call'
  ! grep -Fq -- "$forbidden_execute" "$SCRIPT_PATH" || fail 'forbidden_execute_route_call'
  ! grep -Fq -- "$forbidden_provider" "$SCRIPT_PATH" || fail 'forbidden_provider_route_call'
}

if (( $# > 1 )); then
  fail 'usage'
fi

if (( $# == 1 )); then
  test "$1" = '--check-only' || fail 'usage'
  check_static_contract
  jq -cn --arg wrangler "$REQUIRED_WRANGLER_VERSION" \
    '{checkOnly:true,status:"passed",wranglerStatus:("pinned_" + $wrangler),counts:{dependencies:13,forbiddenRouteCalls:0}}'
  exit 0
fi

check_static_contract

base_url_input="${CAMBIUM_QUESTS_BASE_URL-}"
test -n "$base_url_input" || fail 'base_url_required'
if ! normalized_base_url="$(node -e '
  const raw = process.argv[1];
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    process.exit(1);
  }
  const canonicalInputs = new Set([parsed.origin, `${parsed.origin}/`]);
  if (
    parsed.protocol !== "https:"
    || parsed.origin === "null"
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.pathname !== "/"
    || parsed.search !== ""
    || parsed.hash !== ""
    || !canonicalInputs.has(raw)
  ) process.exit(1);
  process.stdout.write(parsed.origin);
' "$base_url_input")"; then
  fail 'base_url_must_be_canonical_https_origin'
fi
readonly BASE_URL="$normalized_base_url"
observed_base_origin_sha256="$(builtin printf '%s' "$BASE_URL" | shasum -a 256 | awk '{print $1}')"
test "$observed_base_origin_sha256" = "$REVIEWED_BASE_ORIGIN_SHA256" \
  || fail 'base_url_not_reviewed_worker_origin'
unset observed_base_origin_sha256

umask 077
temp_parent="${TMPDIR:-/tmp}"
temp_parent="${temp_parent%/}"
proof_tmp="$(mktemp -d "$temp_parent/cambium-marketing-prepare.XXXXXX")"
chmod 700 "$proof_tmp"

cleanup() {
  local exit_code=$?
  trap - EXIT HUP INT TERM
  unset BRIDGE_TOKEN
  if test -n "${proof_tmp:-}" && test -d "$proof_tmp"; then
    case "$proof_tmp" in
      "$temp_parent"/cambium-marketing-prepare.*) rm -rf -- "$proof_tmp" ;;
      *) builtin printf 'status=failed error=unsafe_temp_path\n' >&2 ;;
    esac
  fi
  exit "$exit_code"
}
trap cleanup EXIT HUP INT TERM

request_body="$proof_tmp/request.json"
first_response="$proof_tmp/first-response.json"
replay_response="$proof_tmp/replay-response.json"
deployment_response="$proof_tmp/deployment.json"
version_response="$proof_tmp/version.json"
normalized_version="$proof_tmp/version-normalized.json"
binding_remainder="$proof_tmp/binding-remainder.json"
d1_response="$proof_tmp/d1-response.json"
d1_row="$proof_tmp/d1-row.json"
for private_file in \
  "$request_body" "$first_response" "$replay_response" \
  "$deployment_response" "$version_response" "$normalized_version" \
  "$binding_remainder" "$d1_response" "$d1_row"; do
  : >"$private_file"
  chmod 600 "$private_file"
done

if test -z "$BRIDGE_TOKEN"; then
  if test -t 0 && test -r /dev/tty && test -w /dev/tty; then
    builtin printf 'BRIDGE_TOKEN (hidden): ' >/dev/tty
    IFS= read -r -s BRIDGE_TOKEN </dev/tty
    builtin printf '\n' >/dev/tty
  else
    fail 'bridge_token_must_be_loaded_or_entered_on_tty'
  fi
fi
test -n "$BRIDGE_TOKEN" || fail 'bridge_token_empty'
test "${#BRIDGE_TOKEN}" -le 4096 || fail 'bridge_token_invalid'
case "$BRIDGE_TOKEN" in
  *$'\r'*|*$'\n'*) fail 'bridge_token_invalid' ;;
esac
export -n BRIDGE_TOKEN 2>/dev/null || true

activation_version_id=''
validate_staging_receipt() {
  local provider_version_id
  test -f "$STATE_RECEIPT" || fail 'staging_receipt_missing'
  test ! -L "$STATE_RECEIPT" || fail 'staging_receipt_symlink_refused'
  jq -e \
    --arg candidate "$CANDIDATE_VERSION_ID" \
    --arg etag "$CANDIDATE_SCRIPT_ETAG" \
    --arg baseline "$CANDIDATE_FULL_BINDINGS_SHA256" '
      .stage == "both-secrets-staged-awaiting-explicit-deploy"
      and .candidateVersion == {number: 60, id: $candidate}
      and .providerVersion.number == 61
      and .activationVersion.number == 62
      and .candidateScriptETag == $etag
      and .fullBindingObjectSha256 == $baseline
      and .versionCounts == {preStaging: 60, observed: 62}
      and .production == {number: 60, id: $candidate, percentage: 100}
      and .secretValuesPresentInReceipt == false
    ' "$STATE_RECEIPT" >/dev/null || fail 'staging_receipt_contract_failed'

  provider_version_id="$(jq -er '.providerVersion.id' "$STATE_RECEIPT")"
  activation_version_id="$(jq -er '.activationVersion.id' "$STATE_RECEIPT")"
  [[ "$provider_version_id" =~ $UUID_PATTERN ]] || fail 'provider_version_id_invalid'
  [[ "$activation_version_id" =~ $UUID_PATTERN ]] || fail 'activation_version_id_invalid'
  test "$provider_version_id" != "$activation_version_id" || fail 'staging_version_ids_collide'
}

assert_active_deployment() {
  local expected_id="$1"
  if ! run_wrangler deployments status \
    --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
    >"$deployment_response" 2>/dev/null; then
    fail 'deployment_status_unavailable'
  fi
  jq -e --arg expected "$expected_id" '
    .versions | length == 1
    and .[0].version_id == $expected
    and .[0].percentage == 100
  ' "$deployment_response" >/dev/null || fail 'activation_version_not_exactly_100_percent'
}

assert_active_version_contract() {
  local expected_id="$1" observed_remainder_digest
  if ! run_wrangler versions view "$expected_id" \
    --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
    >"$version_response" 2>/dev/null; then
    fail 'activation_version_view_unavailable'
  fi

  jq -e '
    .resources.bindings |= map(
      if (.type == "secret_text" or .type == "secret_key") then {name, type}
      else .
      end
    )
  ' "$version_response" >"$normalized_version" || fail 'activation_version_normalization_failed'

  jq -e \
    --arg id "$expected_id" \
    --arg etag "$CANDIDATE_SCRIPT_ETAG" \
    --arg provider "$PROVIDER_SECRET_NAME" \
    --arg activation "$ACTIVATION_SECRET_NAME" \
    --argjson number "$ACTIVATION_VERSION_NUMBER" \
    --argjson count "$ACTIVATION_BINDING_COUNT" '
      .id == $id
      and .number == $number
      and .resources.script.etag == $etag
      and (.resources.bindings | type) == "array"
      and (.resources.bindings | length) == $count
      and ([.resources.bindings[] | select(.name == $provider)] == [{name: $provider, type: "secret_text"}])
      and ([.resources.bindings[] | select(.name == $activation)] == [{name: $activation, type: "secret_text"}])
    ' "$normalized_version" >/dev/null || fail 'activation_version_contract_failed'

  jq -cS --arg provider "$PROVIDER_SECRET_NAME" --arg activation "$ACTIVATION_SECRET_NAME" '
    .resources.bindings
    | map(select(.name != $provider and .name != $activation))
    | sort_by(.name, .type)
  ' "$normalized_version" >"$binding_remainder"
  observed_remainder_digest="$(shasum -a 256 "$binding_remainder" | awk '{print $1}')"
  test "$observed_remainder_digest" = "$CANDIDATE_FULL_BINDINGS_SHA256" \
    || fail 'activation_baseline_binding_digest_failed'
}

validate_staging_receipt
assert_active_deployment "$activation_version_id"
assert_active_version_contract "$activation_version_id"

stamp="$(date -u +%Y%m%d%H%M%S)"
nonce="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(8).toString("hex"))')"
expires_at="$(node -e 'process.stdout.write(new Date(Date.now() + 60 * 60 * 1000).toISOString())')"
request_id="marketing-prepare-proof-$stamp-$nonce"
idempotency_key="marketing-prepare-replay-$stamp-$nonce"

node -e '
  const expires = Date.parse(process.argv[1]);
  const ttl = expires - Date.now();
  if (!Number.isFinite(expires) || ttl <= 0 || ttl > 24 * 60 * 60 * 1000) process.exit(1);
' "$expires_at" || fail 'prepare_expiry_outside_runtime_window'

jq -cn \
  --arg request_id "$request_id" \
  --arg idempotency_key "$idempotency_key" \
  --arg expires_at "$expires_at" \
  --arg nonce "$nonce" \
  '{
    requestId: $request_id,
    idempotencyKey: $idempotency_key,
    actorId: "synthetic-operator-proof",
    budgetReservationId: ("synthetic-budget-proof-" + $nonce),
    expiresAt: $expires_at,
    brief: {
      briefId: ("synthetic-brief-proof-" + $nonce),
      objective: "Prepare a synthetic review-only idempotency proof without generating content.",
      audience: "Synthetic validation audience",
      callToAction: "Retain this synthetic preparation as bounded audit evidence.",
      productPacketId: "thoughtseed-marketing@1.0.0",
      productPacketDigest: ("1" * 64),
      evidenceSnapshotDigest: ("2" * 64),
      seedDigest: ("3" * 64),
      facts: [{
        claimId: ("synthetic-claim-proof-" + $nonce),
        text: "This is synthetic prepare-only proof data and contains no client content.",
        sourceDigest: ("4" * 64)
      }]
    }
  }' >"$request_body"

curl_prepare() {
  local response_path="$1" http_status authorization_header
  authorization_header="authorization: Bearer $BRIDGE_TOKEN"
  authorization_header="${authorization_header//\\/\\\\}"
  authorization_header="${authorization_header//\"/\\\"}"
  if ! http_status="$({
    builtin printf 'silent\n'
    builtin printf 'show-error\n'
    builtin printf 'request = "POST"\n'
    builtin printf 'proto = "=https"\n'
    builtin printf 'proxy = ""\n'
    builtin printf 'connect-timeout = 5\n'
    builtin printf 'max-time = 20\n'
    builtin printf 'max-filesize = 65536\n'
    builtin printf 'url = "%s%s"\n' "$BASE_URL" "$PREPARE_ROUTE"
    builtin printf 'header = "content-type: application/json"\n'
    builtin printf 'header = "%s"\n' "$authorization_header"
    builtin printf 'write-out = "%%{http_code}"\n'
  } | curl -q --config - \
    --data-binary "@$request_body" --output "$response_path" 2>/dev/null)"; then
    fail 'prepare_transport_failed'
  fi
  [[ "$http_status" =~ ^[0-9]{3}$ ]] || fail 'prepare_status_invalid'
  builtin printf '%s' "$http_status"
}

# Re-read production immediately before each mutating prepare request. The
# second check also refuses replay if traffic moved after the first response.
assert_active_deployment "$activation_version_id"
first_http_status="$(curl_prepare "$first_response")"
test "$first_http_status" = 200 || fail 'first_prepare_http_status'
jq -e \
  --arg request_id "$request_id" \
  --arg adapter_id "$EXPECTED_ADAPTER_ID" \
  --arg next_route "$EXPECTED_NEXT_ACTION_ROUTE" \
  --arg next_kind "$EXPECTED_NEXT_ACTION_KIND" '
    .ok == true
    and .duplicate == false
    and .requestId == $request_id
    and .adapterId == $adapter_id
    and .status == "awaiting_human_approval"
    and .nextAction.route == $next_route
    and .nextAction.kind == $next_kind
    and (.actionDigest | type == "string" and test("^[a-f0-9]{64}$"))
  ' "$first_response" >/dev/null || fail 'first_prepare_contract_failed'
first_action_digest="$(jq -er '.actionDigest' "$first_response")"

assert_active_deployment "$activation_version_id"
replay_http_status="$(curl_prepare "$replay_response")"
test "$replay_http_status" = 200 || fail 'replay_prepare_http_status'
jq -e \
  --arg request_id "$request_id" \
  --arg adapter_id "$EXPECTED_ADAPTER_ID" \
  --arg action_digest "$first_action_digest" \
  --arg next_route "$EXPECTED_NEXT_ACTION_ROUTE" \
  --arg next_kind "$EXPECTED_NEXT_ACTION_KIND" '
    .ok == true
    and .duplicate == true
    and .requestId == $request_id
    and .adapterId == $adapter_id
    and .status == "awaiting_human_approval"
    and .nextAction.route == $next_route
    and .nextAction.kind == $next_kind
    and .actionDigest == $action_digest
  ' "$replay_response" >/dev/null || fail 'replay_prepare_contract_failed'

first_payload="$(<"$first_response")"
replay_payload="$(<"$replay_response")"
[[ "$first_payload" != *"$BRIDGE_TOKEN"* ]] || fail 'credential_reflected_by_first_response'
[[ "$replay_payload" != *"$BRIDGE_TOKEN"* ]] || fail 'credential_reflected_by_replay_response'
unset first_payload replay_payload BRIDGE_TOKEN

sql="$(builtin printf '%s' "
SELECT
  COUNT(*) AS run_rows,
  COALESCE(SUM(CASE WHEN status = 'prepared' THEN 1 ELSE 0 END), 0) AS prepared_rows,
  COALESCE(SUM(CASE WHEN approval_decision_id IS NULL AND claim_id IS NULL AND claimed_at IS NULL AND lease_expires_at IS NULL THEN 1 ELSE 0 END), 0) AS unclaimed_rows,
  COALESCE(SUM(CASE WHEN invoked_at IS NULL THEN 1 ELSE 0 END), 0) AS null_invocation_rows,
  COALESCE(SUM(CASE WHEN artifact_json IS NULL AND receipt_json IS NULL AND artifact_digest IS NULL THEN 1 ELSE 0 END), 0) AS null_artifact_rows,
  COALESCE(SUM(CASE WHEN provider_usage_tokens IS NULL THEN 1 ELSE 0 END), 0) AS null_provider_rows,
  COALESCE(SUM(CASE WHEN terminal_at IS NULL THEN 1 ELSE 0 END), 0) AS null_terminal_rows,
  COALESCE(SUM(CASE WHEN error_code IS NULL THEN 1 ELSE 0 END), 0) AS null_error_rows,
  MIN(adapter_id) AS adapter_id,
  MIN(request_digest) AS request_digest,
  MIN(action_digest) AS action_digest,
  MIN(expires_at) AS expires_at,
  (SELECT COUNT(*) FROM (
    SELECT 1 FROM marketing_render_approvals
    WHERE tenant_id = 'thoughtseed' AND request_id = '$request_id'
    LIMIT 1
  )) AS approval_rows
FROM (
  SELECT adapter_id, status, approval_decision_id, claim_id, claimed_at,
         lease_expires_at, invoked_at, artifact_json, receipt_json,
         artifact_digest, provider_usage_tokens, terminal_at, error_code,
         request_digest, action_digest, expires_at
  FROM marketing_render_runs
  WHERE tenant_id = 'thoughtseed' AND request_id = '$request_id'
  LIMIT 2
) AS bounded_runs;")"

if ! run_wrangler d1 execute "$D1_NAME" \
  --remote --config "$WRANGLER_CONFIG" --json --command "$sql" \
  >"$d1_response" 2>/dev/null; then
  fail 'remote_d1_probe_failed'
fi

jq -e '[.. | objects | select(
  has("run_rows") and has("prepared_rows") and has("approval_rows")
  and has("unclaimed_rows") and has("null_invocation_rows")
  and has("null_artifact_rows") and has("null_provider_rows")
  and has("null_terminal_rows") and has("null_error_rows")
  and has("adapter_id") and has("request_digest") and has("action_digest")
)] | length == 1' "$d1_response" >/dev/null || fail 'remote_d1_result_shape_failed'
jq -c '[.. | objects | select(
  has("run_rows") and has("prepared_rows") and has("approval_rows")
  and has("unclaimed_rows") and has("null_invocation_rows")
  and has("null_artifact_rows") and has("null_provider_rows")
  and has("null_terminal_rows") and has("null_error_rows")
  and has("adapter_id") and has("request_digest") and has("action_digest")
)][0]' "$d1_response" >"$d1_row"

jq -e \
  --arg adapter_id "$EXPECTED_ADAPTER_ID" \
  --arg action_digest "$first_action_digest" \
  --arg expires_at "$expires_at" '
    .run_rows == 1
    and .prepared_rows == 1
    and .approval_rows == 0
    and .unclaimed_rows == 1
    and .null_invocation_rows == 1
    and .null_artifact_rows == 1
    and .null_provider_rows == 1
    and .null_terminal_rows == 1
    and .null_error_rows == 1
    and .adapter_id == $adapter_id
    and .action_digest == $action_digest
    and .expires_at == $expires_at
    and (.request_digest | type == "string" and test("^[a-f0-9]{64}$"))
  ' "$d1_row" >/dev/null || fail 'remote_d1_invariant_failed'

request_digest="$(jq -er '.request_digest' "$d1_row")"

jq -cn \
  --arg activation_version_id "$activation_version_id" \
  --arg script_etag "$CANDIDATE_SCRIPT_ETAG" \
  --arg baseline_digest "$CANDIDATE_FULL_BINDINGS_SHA256" \
  --arg request_id "$request_id" \
  --arg request_digest "$request_digest" \
  --arg action_digest "$first_action_digest" \
  --arg adapter_id "$EXPECTED_ADAPTER_ID" \
  --arg first_status "$first_http_status" \
  --arg replay_status "$replay_http_status" \
  --arg expires_at "$expires_at" \
  '{
    deployment: {
      status: "version_62_at_100_percent",
      versionId: $activation_version_id,
      scriptETag: $script_etag,
      baselineBindingDigest: $baseline_digest,
      counts: {versionsAt100Percent: 1, versionNumber: 62, trafficPercent: 100, bindings: 21, marketingSecretBindings: 2}
    },
    firstPrepare: {
      requestId: $request_id,
      requestDigest: $request_digest,
      actionDigest: $action_digest,
      adapterId: $adapter_id,
      httpStatus: ($first_status | tonumber),
      status: "awaiting_human_approval",
      duplicate: false,
      nextActionStatus: "validated_not_called"
    },
    replayPrepare: {
      requestId: $request_id,
      requestDigest: $request_digest,
      actionDigest: $action_digest,
      adapterId: $adapter_id,
      httpStatus: ($replay_status | tonumber),
      status: "awaiting_human_approval",
      duplicate: true,
      nextActionStatus: "validated_not_called"
    },
    counts: {
      thoughtseedPreparedRows: 1,
      approvalRows: 0,
      unclaimedRows: 1,
      nullInvocationRows: 1,
      nullArtifactRows: 1,
      nullProviderRows: 1,
      nullTerminalRows: 1,
      nullErrorRows: 1
    },
    retainedRowDisposition: {status: "retained_for_audit", expiresAt: $expires_at}
  }'
