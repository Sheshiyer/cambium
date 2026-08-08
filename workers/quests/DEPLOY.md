# Quest Worker Deployment

## Telegram Signed Gate

The signed Mini App gate is available only when both Cloudflare Worker bindings exist:

- `GATE_BOT_ID`: numeric Telegram bot id used for third-party `initData` validation.
- `GATE_FOUNDER_IDS`: comma-separated Telegram user ids allowed to sign founder actions.

Keep their values out of the repository. `GATE_TG_PUBKEY` is optional; the Worker otherwise uses Telegram's production public key.

Confirm the binding names after deployment without reading their values:

```bash
npx wrangler secret list --config workers/quests/wrangler.jsonc
```

Then run the fail-closed capability probe:

```bash
curl -fsS "$CAMBIUM_QUESTS_BASE_URL/healthz/gate"
```

The probe must return HTTP 200 with `"gateConfigured":true`. HTTP 503 means the Mini App can render but every signed action will be refused before Telegram authentication.

An optional non-mutating auth-boundary probe can verify that the route advances past configuration and fails at missing Telegram authentication:

```bash
curl -sS -H 'content-type: application/json' \
  --data '{"kind":"confirm-action-request","subject":"deploy-probe","initData":""}' \
  "$CAMBIUM_QUESTS_BASE_URL/api/gate/cambium"
```

The expected response is HTTP 401 with `missing initData`. Never put real `initData`, tokens, founder ids, or bot ids in deployment logs or proof artifacts.

## Marketing Create: Fail-Closed Installation

This installation adds the fixed-tenant renderer code and its additive D1
schema while keeping the renderer disabled. It does not provision either
marketing secret and it must not make a provider call. Run every command from
an isolated clean checkout of the exact reviewed commit on a trusted operator
machine. Do not run this procedure on EC2 or an MCP host.

### Pin and verify remote identities

Set the public identities, derive the candidate Git SHA, and first prove that
the checked-in configuration still names the expected Worker and D1 UUID:

```bash
WORKER_NAME=cambium-quests
D1_NAME=cambium-bridge
D1_UUID=f6b950ac-2480-4a7d-9dac-1ff7e951d936
WRANGLER_CONFIG=workers/quests/wrangler.jsonc
GIT_SHA="$(git rev-parse --verify HEAD)"
PUBLIC_MARKETING_ACTIVATION='founder-article-nvidia@1.0.0:ae1d60e951f6d6c18041581ddb018b53b162ebfb49bf9370f3185c38e03fc12f'

test -z "$(git status --porcelain=v1)"
test "$(jq -r '.name' "$WRANGLER_CONFIG")" = "$WORKER_NAME"
test "$(jq -r '.d1_databases[] | select(.binding == "BRIDGE_DB") | .database_name' "$WRANGLER_CONFIG")" = "$D1_NAME"
test "$(jq -r '.d1_databases[] | select(.binding == "BRIDGE_DB") | .database_id' "$WRANGLER_CONFIG")" = "$D1_UUID"
```

`PUBLIC_MARKETING_ACTIVATION` is the committed catalog identity, not a
credential. Its value is already public in source. The production binding is
still stored as a Worker secret to preserve change control and prevent
accidental activation; only the isolated local proof below may supply the
public identity through `--var`.

Run the complete deterministic release gate, the composition and product
packet validators, a whitespace check, and Wrangler's strict local bundle
preflight before any remote upload. `--dry-run` makes the final command
non-mutating; `--strict` turns even minor deployment risks into failures.

```bash
npm run validate
npm run validate:product-branches
npm run verify:release
git diff --check

umask 077
WRANGLER_DRY_RUN_DIR="$(mktemp -d)"
npx --no-install wrangler deploy \
  --config "$WRANGLER_CONFIG" \
  --outdir "$WRANGLER_DRY_RUN_DIR" \
  --dry-run --strict
test -n "$(find "$WRANGLER_DRY_RUN_DIR" -type f -print -quit)"
rm -rf "$WRANGLER_DRY_RUN_DIR"
```

### Prove authenticated missing-key refusal locally

Before contacting the remote Worker, prove the positive authenticated branch
with isolated local Wrangler state. The bridge token below is synthetic and
the activation is the public catalog identity. Deliberately omit
`NVIDIA_MARKETING_CREATE_API_KEY`. Never add `--remote`, never point this proof
at production D1, and never deploy this dev session.

```bash
umask 077
LOCAL_PROOF_ROOT="$(mktemp -d)"
LOCAL_PROOF_PORT=8791
SYNTHETIC_BRIDGE_TOKEN='synthetic-marketing-create-install-proof'
LOCAL_DEV_LOG="$LOCAL_PROOF_ROOT/wrangler-dev.log"
LOCAL_RESPONSE="$LOCAL_PROOF_ROOT/missing-key-response.json"
LOCAL_DEV_PID=
cleanup_local_marketing_proof() {
  if test -n "${LOCAL_DEV_PID:-}"; then
    kill "$LOCAL_DEV_PID" 2>/dev/null || true
    wait "$LOCAL_DEV_PID" 2>/dev/null || true
  fi
  test -n "${LOCAL_PROOF_ROOT:-}" && test "$LOCAL_PROOF_ROOT" != / \
    && rm -rf "$LOCAL_PROOF_ROOT"
}
trap cleanup_local_marketing_proof EXIT INT TERM

npx --no-install wrangler d1 migrations apply "$D1_NAME" \
  --local --persist-to "$LOCAL_PROOF_ROOT/state" \
  --config "$WRANGLER_CONFIG"
npx --no-install wrangler dev \
  --local --ip 127.0.0.1 --port "$LOCAL_PROOF_PORT" \
  --persist-to "$LOCAL_PROOF_ROOT/state" \
  --config "$WRANGLER_CONFIG" \
  --var "BRIDGE_TOKEN:$SYNTHETIC_BRIDGE_TOKEN" \
  --var "MARKETING_CREATE_ACTIVATION:$PUBLIC_MARKETING_ACTIVATION" \
  > "$LOCAL_DEV_LOG" 2>&1 &
LOCAL_DEV_PID=$!

for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -fsS --connect-timeout 1 --max-time 2 --max-filesize 65536 \
    "http://127.0.0.1:$LOCAL_PROOF_PORT/healthz" >/dev/null && break
  sleep 1
done
curl -fsS --connect-timeout 1 --max-time 2 --max-filesize 65536 \
  "http://127.0.0.1:$LOCAL_PROOF_PORT/healthz" \
  | jq -e '.ok == true and .worker == "cambium-quests"'

LOCAL_STATUS="$(curl -sS --connect-timeout 2 --max-time 5 --max-filesize 65536 \
  -o "$LOCAL_RESPONSE" -w '%{http_code}' \
  -H "authorization: Bearer $SYNTHETIC_BRIDGE_TOKEN" \
  -H 'content-type: application/json' \
  --data '{}' \
  "http://127.0.0.1:$LOCAL_PROOF_PORT/v1/bridge/marketing-renders/prepare")"
test "$LOCAL_STATUS" = 503
jq -e '.error == "renderer_secret_missing"' "$LOCAL_RESPONSE"

npx --no-install wrangler d1 execute "$D1_NAME" \
  --local --persist-to "$LOCAL_PROOF_ROOT/state" \
  --config "$WRANGLER_CONFIG" --json \
  --command "SELECT (SELECT COUNT(*) FROM marketing_render_runs) AS run_rows, (SELECT COUNT(*) FROM marketing_render_approvals) AS approval_rows;" \
  | jq -e '[.. | objects | select(has("run_rows") and has("approval_rows"))][0]
      | .run_rows == 0 and .approval_rows == 0'

kill "$LOCAL_DEV_PID"
wait "$LOCAL_DEV_PID" 2>/dev/null || true
LOCAL_DEV_PID=
cleanup_local_marketing_proof
trap - EXIT INT TERM
unset SYNTHETIC_BRIDGE_TOKEN LOCAL_DEV_PID
```

HTTP 503 with exactly `renderer_secret_missing`, followed by zero local D1
rows, proves the provider-key check occurs before D1 lookup or mutation. This
proof has no provider credential and therefore cannot call NVIDIA.

Verify the remote D1 identity independently. The recursive equality check is
deliberate: it tolerates Wrangler's outer JSON envelope but accepts only the
exact UUID.

```bash
npx --no-install wrangler d1 info "$D1_NAME" \
  --config "$WRANGLER_CONFIG" --json \
  | jq -e --arg expected "$D1_UUID" \
      '[.. | strings | select(. == $expected)] | length == 1'
```

Capture the single version currently receiving 100 percent of production
traffic. A split deployment is not a safe rollback baseline; stop if this
command does not yield exactly one version UUID.

```bash
umask 077
PRODUCTION_STATUS="$(mktemp)"
npx --no-install wrangler deployments status \
  --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
  > "$PRODUCTION_STATUS"
PRIOR_VERSION_ID="$(jq -er \
  '.versions | select(length == 1) | .[0] | select(.percentage == 100) | .version_id' \
  "$PRODUCTION_STATUS")"
case "$PRIOR_VERSION_ID" in
  ????????-????-????-????-????????????) ;;
  *) echo 'production version is not one exact UUID' >&2; exit 1 ;;
esac
npx --no-install wrangler versions view "$PRIOR_VERSION_ID" \
  --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
  | jq -e --arg expected "$PRIOR_VERSION_ID" \
      '[.. | strings | select(. == $expected)] | length >= 1'
```

The successful remote `versions view` scoped with `--name cambium-quests`
proves that the rollback UUID belongs to this Worker. Preserve
`PRIOR_VERSION_ID` and `PRODUCTION_STATUS` in the private deployment record.

List binding names only, never values, and require both marketing names to be
absent from the active Version's complete binding set as well as the deployed
secret list. The Version check also catches either name misconfigured as a
plaintext var, which `secret list` alone would miss.

```bash
assert_marketing_bindings_absent() {
  local version_id="$1" version_json secret_names binding_names forbidden
  version_json="$(mktemp)"
  npx --no-install wrangler versions view "$version_id" \
    --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
    > "$version_json"
  test "$(jq -r '.id' "$version_json")" = "$version_id"

  secret_names="$(npx --no-install wrangler secret list \
    --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --format json \
    | jq -r '.[].name')"
  binding_names="$(jq -r '.resources.bindings[]?.name' "$version_json")"
  printf '%s\n' "$secret_names" "$binding_names" | sed '/^$/d' | sort -u

  for forbidden in NVIDIA_MARKETING_CREATE_API_KEY MARKETING_CREATE_ACTIVATION; do
    ! grep -Fxq "$forbidden" <<<"$secret_names"
    ! grep -Fxq "$forbidden" <<<"$binding_names"
  done
  rm -f "$version_json"
}

assert_marketing_bindings_absent "$PRIOR_VERSION_ID"
```

Any failed absence check stops this installation. Do not delete or rotate an
unexpected binding as part of this procedure; investigate it separately.

### Upload an inert remote preview

Upload one tagged Version without deploying it. `wrangler versions upload`
creates a remote Version and preview alias but does not change production
traffic. Do not substitute `wrangler deploy` here.

```bash
PREVIEW_ALIAS="marketing-create-${GIT_SHA%${GIT_SHA#????????????}}"
npx --no-install wrangler versions upload \
  --name "$WORKER_NAME" \
  --config "$WRANGLER_CONFIG" \
  --tag "git-$GIT_SHA" \
  --message "git:$GIT_SHA marketing-create fail-closed install" \
  --preview-alias "$PREVIEW_ALIAS" \
  --keep-vars
```

Record the Version UUID and preview URL printed by Wrangler as
`CANDIDATE_VERSION_ID` and `CANDIDATE_PREVIEW_URL`. Validate the UUID remotely
and require the returned Version details to show the exact `git-$GIT_SHA` tag:

```bash
: "${CANDIDATE_VERSION_ID:?copy the Version UUID printed by Wrangler}"
: "${CANDIDATE_PREVIEW_URL:?copy the preview URL printed by Wrangler}"
case "$CANDIDATE_VERSION_ID" in
  ????????-????-????-????-????????????) ;;
  *) echo 'candidate version is not one exact UUID' >&2; exit 1 ;;
esac
umask 077
CANDIDATE_VERSION_JSON="$(mktemp)"
npx --no-install wrangler versions view "$CANDIDATE_VERSION_ID" \
  --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
  > "$CANDIDATE_VERSION_JSON"
jq -e --arg id "$CANDIDATE_VERSION_ID" --arg tag "git-$GIT_SHA" \
  '.id == $id and .annotations["workers/tag"] == $tag
   and (.resources.script.etag | type == "string" and length > 0)' \
  "$CANDIDATE_VERSION_JSON"
CANDIDATE_SCRIPT_ETAG="$(jq -er '.resources.script.etag' "$CANDIDATE_VERSION_JSON")"
CANDIDATE_BINDING_SIGNATURE="$(jq -c \
  '[.resources.bindings[]? | {name, type}] | sort_by(.name, .type)' \
  "$CANDIDATE_VERSION_JSON")"
rm -f "$CANDIDATE_VERSION_JSON"
assert_marketing_bindings_absent "$CANDIDATE_VERSION_ID"
curl -fsS --connect-timeout 5 --max-time 15 --max-filesize 65536 \
  "$CANDIDATE_PREVIEW_URL/healthz" \
  | jq -e '.ok == true and .worker == "cambium-quests"'
```

Because both marketing secrets are absent, this Version remains incapable of
calling the provider. Do not send an authenticated prepare, approval, or
execute request during installation.

### Export and prove non-content restore

Set the restrictive umask before creating any backup, receipt, temporary
response, or restore probe. The restore proof imports the private SQL into a
temporary local SQLite database and checks integrity; it never prints table
contents or row data.

```bash
umask 077
: "${CAMBIUM_PRIVATE_BACKUP_ROOT:?set a private directory outside the repository}"
case "$CAMBIUM_PRIVATE_BACKUP_ROOT" in
  /*) ;;
  *) echo 'backup root must be absolute' >&2; exit 1 ;;
esac
test -d "$CAMBIUM_PRIVATE_BACKUP_ROOT"
REPO_ROOT="$(realpath "$(git rev-parse --show-toplevel)")"
HOME_ROOT="$(realpath "$HOME")"
PRIVATE_BACKUP_ROOT="$(realpath "$CAMBIUM_PRIVATE_BACKUP_ROOT")"
test "$PRIVATE_BACKUP_ROOT" != /
test "$PRIVATE_BACKUP_ROOT" != "$HOME_ROOT"
test "$PRIVATE_BACKUP_ROOT" != "$REPO_ROOT"
case "$PRIVATE_BACKUP_ROOT/" in
  "$REPO_ROOT"/*) echo 'backup root must remain outside the repository' >&2; exit 1 ;;
esac

BACKUP_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
D1_BACKUP="$PRIVATE_BACKUP_ROOT/$D1_NAME-$BACKUP_STAMP.sql"
D1_RECEIPT="$D1_BACKUP.sha256"
RESTORE_PROBE_DIR="$(mktemp -d "$PRIVATE_BACKUP_ROOT/restore-probe.XXXXXX")"
trap 'rm -rf "$RESTORE_PROBE_DIR"' EXIT

npx --no-install wrangler d1 export "$D1_NAME" \
  --remote --config "$WRANGLER_CONFIG" --output "$D1_BACKUP"
test -s "$D1_BACKUP"
shasum -a 256 "$D1_BACKUP" > "$D1_RECEIPT"
chmod 600 "$D1_BACKUP" "$D1_RECEIPT"
test -s "$D1_RECEIPT"
shasum -c "$D1_RECEIPT"

sqlite3 "$RESTORE_PROBE_DIR/restore.sqlite3" < "$D1_BACKUP"
test "$(sqlite3 "$RESTORE_PROBE_DIR/restore.sqlite3" 'PRAGMA integrity_check;')" = ok
test "$(sqlite3 "$RESTORE_PROBE_DIR/restore.sqlite3" \
  "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")" -gt 0
```

Keep the non-empty export and SHA receipt outside source control. The final
table-count assertion is metadata-only; it proves that the export can be
restored without disclosing any content.

### Apply additive migration 0005

Before applying anything, the remote pending list must contain exactly
`0005_marketing_create_renderer.sql`. Stop if another migration is pending.

```bash
PENDING_MIGRATIONS="$(npx --no-install wrangler d1 migrations list "$D1_NAME" \
  --remote --config "$WRANGLER_CONFIG" \
  | grep -Eo '[0-9]{4}_[A-Za-z0-9_.-]+\.sql' | sort -u)"
test "$PENDING_MIGRATIONS" = '0005_marketing_create_renderer.sql'
npx --no-install wrangler d1 migrations apply "$D1_NAME" \
  --remote --config "$WRANGLER_CONFIG"

POST_MIGRATION_LIST="$(npx --no-install wrangler d1 migrations list "$D1_NAME" \
  --remote --config "$WRANGLER_CONFIG")"
grep -Fq 'No migrations to apply!' <<<"$POST_MIGRATION_LIST"
! grep -Eq '[0-9]{4}_[A-Za-z0-9_.-]+\.sql' <<<"$POST_MIGRATION_LIST"
```

Verify exactly the two new tables and require both to contain zero rows before
production deployment:

```bash
SCHEMA_PROBE="$(mktemp)"
ROW_PROBE="$(mktemp)"
npx --no-install wrangler d1 execute "$D1_NAME" \
  --remote --config "$WRANGLER_CONFIG" --json \
  --command "SELECT group_concat(name, ',') AS table_names FROM (SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('marketing_render_approvals','marketing_render_runs') ORDER BY name);" \
  > "$SCHEMA_PROBE"
npx --no-install wrangler d1 execute "$D1_NAME" \
  --remote --config "$WRANGLER_CONFIG" --json \
  --command "SELECT (SELECT COUNT(*) FROM marketing_render_runs) AS run_rows, (SELECT COUNT(*) FROM marketing_render_approvals) AS approval_rows;" \
  > "$ROW_PROBE"
jq -e '[.. | objects | select(has("table_names"))][0].table_names
  == "marketing_render_approvals,marketing_render_runs"' "$SCHEMA_PROBE"
jq -e '[.. | objects | select(has("run_rows") and has("approval_rows"))][0]
  | .run_rows == 0 and .approval_rows == 0' "$ROW_PROBE"
rm -f "$SCHEMA_PROBE" "$ROW_PROBE"
```

The exact expected results are
`marketing_render_approvals,marketing_render_runs` and `run_rows = 0`,
`approval_rows = 0`. Anything else stops the deployment.

### Deploy the exact Git-tagged Version

Re-run the scoped remote Version check, then deploy only the already-previewed
UUID. Immediately recheck the active and candidate binding names, remote D1
identity, exact schema, and zero-row invariant. Do not upload from the working
tree again between preview and deploy.

```bash
assert_production_version() {
  local expected="$1" status_json
  status_json="$(mktemp)"
  npx --no-install wrangler deployments status \
    --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
    > "$status_json"
  jq -e --arg expected "$expected" \
    '.versions | length == 1 and .[0].percentage == 100
     and .[0].version_id == $expected' "$status_json"
  rm -f "$status_json"
}

assert_marketing_d1_state() {
  local maximum_runs="$1" maximum_approvals="$2"
  local info_json schema_json rows_json
  info_json="$(mktemp)"
  schema_json="$(mktemp)"
  rows_json="$(mktemp)"

  npx --no-install wrangler d1 info "$D1_NAME" \
    --config "$WRANGLER_CONFIG" --json > "$info_json"
  jq -e --arg expected "$D1_UUID" \
    '[.. | strings | select(. == $expected)] | length == 1' "$info_json"
  npx --no-install wrangler d1 execute "$D1_NAME" \
    --remote --config "$WRANGLER_CONFIG" --json \
    --command "SELECT group_concat(name, ',') AS table_names FROM (SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('marketing_render_approvals','marketing_render_runs') ORDER BY name);" \
    > "$schema_json"
  npx --no-install wrangler d1 execute "$D1_NAME" \
    --remote --config "$WRANGLER_CONFIG" --json \
    --command "SELECT (SELECT COUNT(*) FROM marketing_render_runs) AS run_rows, (SELECT COUNT(*) FROM marketing_render_approvals) AS approval_rows;" \
    > "$rows_json"
  jq -e '[.. | objects | select(has("table_names"))][0].table_names
    == "marketing_render_approvals,marketing_render_runs"' "$schema_json"
  jq -e --argjson maximum_runs "$maximum_runs" \
    --argjson maximum_approvals "$maximum_approvals" \
    '[.. | objects | select(has("run_rows") and has("approval_rows"))][0]
     | .run_rows <= $maximum_runs and .approval_rows <= $maximum_approvals' \
    "$rows_json"
  rm -f "$info_json" "$schema_json" "$rows_json"
}

PREDEPLOY_VERSION_JSON="$(mktemp)"
npx --no-install wrangler versions view "$CANDIDATE_VERSION_ID" \
  --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
  > "$PREDEPLOY_VERSION_JSON"
jq -e --arg id "$CANDIDATE_VERSION_ID" --arg tag "git-$GIT_SHA" \
  --arg etag "$CANDIDATE_SCRIPT_ETAG" \
  '.id == $id and .annotations["workers/tag"] == $tag
   and .resources.script.etag == $etag' "$PREDEPLOY_VERSION_JSON"
rm -f "$PREDEPLOY_VERSION_JSON"

assert_production_version "$PRIOR_VERSION_ID"
assert_marketing_bindings_absent "$PRIOR_VERSION_ID"
assert_marketing_bindings_absent "$CANDIDATE_VERSION_ID"
assert_marketing_d1_state 0 0

npx --no-install wrangler versions deploy "$CANDIDATE_VERSION_ID@100%" \
  --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" \
  --message "git:$GIT_SHA marketing-create fail-closed install" --yes
```

The resulting production status must name only `CANDIDATE_VERSION_ID` at 100
percent. Probe both the direct `workers.dev` base and the curious custom base.
The direct base must be copied from Wrangler's verified Worker output; the
custom base is assembled below to keep release-facing audit policy intact.
Run the probe once immediately and again after five minutes:

```bash
: "${CAMBIUM_WORKERS_DEV_BASE_URL:?set the exact https://...workers.dev base}"
WORKERS_DEV_BASE_URL="${CAMBIUM_WORKERS_DEV_BASE_URL%/}"
CUSTOM_BASE_URL="https://curious.${THOUGHTSEED_ROOT_DOMAIN:-thoughtseed.space}"
case "$WORKERS_DEV_BASE_URL" in
  https://*.workers.dev) ;;
  *) echo 'invalid workers.dev base' >&2; exit 1 ;;
esac
test "$CUSTOM_BASE_URL" = 'https://curious.''thoughtseed.space'

probe_marketing_create_surface() {
  local expected_version="$1" maximum_runs="$2" maximum_approvals="$3"
  local auth_body auth_status base_url
  auth_body="$(mktemp)"

  assert_production_version "$expected_version"
  assert_marketing_bindings_absent "$expected_version"
  assert_marketing_d1_state "$maximum_runs" "$maximum_approvals"

  for base_url in "$WORKERS_DEV_BASE_URL" "$CUSTOM_BASE_URL"; do
    curl -fsS --connect-timeout 5 --max-time 15 --max-filesize 65536 \
      "$base_url/healthz" \
      | jq -e '.ok == true and .worker == "cambium-quests"'

    auth_status="$(curl -sS --connect-timeout 5 --max-time 15 \
      --max-filesize 65536 -o "$auth_body" -w '%{http_code}' \
      -H 'content-type: application/json' --data '{}' \
      "$base_url/v1/bridge/marketing-renders/prepare")"
    test "$auth_status" = 401
    jq -e '.error == "bad or missing bridge credential"' "$auth_body"
  done

  rm -f "$auth_body"
}

probe_marketing_create_surface "$CANDIDATE_VERSION_ID" 0 0
sleep 300
probe_marketing_create_surface "$CANDIDATE_VERSION_ID" 0 0
```

These are bounded health, unauthenticated boundary, exact Version, complete
binding-name, exact D1 identity/schema, and zero-row probes. They neither carry
a credential nor create a render record.

### Rollback trigger and exact target

Rollback immediately if the production Version UUID differs, either immediate
or delayed probe fails, either forbidden marketing binding name appears in
`secret list` or any active Version binding, either marketing table becomes
non-empty, or the Worker reports elevated errors attributable to this release.
Capture the current row counts as forensic ceilings. Before rollback,
re-prove remotely that the saved UUID belongs to this exact Worker; then deploy
that UUID, not a tag, branch, or newly rebuilt artifact:

```bash
ROLLBACK_ROWS_JSON="$(mktemp)"
npx --no-install wrangler d1 execute "$D1_NAME" \
  --remote --config "$WRANGLER_CONFIG" --json \
  --command "SELECT (SELECT COUNT(*) FROM marketing_render_runs) AS run_rows, (SELECT COUNT(*) FROM marketing_render_approvals) AS approval_rows;" \
  > "$ROLLBACK_ROWS_JSON"
ROLLBACK_MAX_RUNS="$(jq -er '[.. | objects | select(has("run_rows"))][0].run_rows' "$ROLLBACK_ROWS_JSON")"
ROLLBACK_MAX_APPROVALS="$(jq -er '[.. | objects | select(has("approval_rows"))][0].approval_rows' "$ROLLBACK_ROWS_JSON")"
rm -f "$ROLLBACK_ROWS_JSON"

npx --no-install wrangler versions view "$PRIOR_VERSION_ID" \
  --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
  | jq -e --arg expected "$PRIOR_VERSION_ID" \
      '[.. | strings | select(. == $expected)] | length >= 1'
npx --no-install wrangler versions deploy "$PRIOR_VERSION_ID@100%" \
  --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" \
  --message "rollback from git:$GIT_SHA after fail-closed install probe" --yes

probe_marketing_create_surface \
  "$PRIOR_VERSION_ID" "$ROLLBACK_MAX_RUNS" "$ROLLBACK_MAX_APPROVALS"
sleep 300
probe_marketing_create_surface \
  "$PRIOR_VERSION_ID" "$ROLLBACK_MAX_RUNS" "$ROLLBACK_MAX_APPROVALS"
```

The post-rollback row assertions require counts not to increase beyond the
captured forensic ceilings; they do not falsely require zero when a trigger
already observed rows. Migration `0005_marketing_create_renderer.sql` is
additive and remains applied after a code rollback. Do not drop its tables,
delete its migration record, truncate rows, or import the backup merely
because Worker code was rolled back.

### Later, separately approved activation

Activation is a different change window. The confidential provider key and
the live activation binding must be entered interactively from a trusted
operator machine directly into Cloudflare. EC2 instances, Hermes hosts, MCP
servers, MCP login stores, repository files, command arguments, shell
variables, environment files, CI artifacts, and chat are prohibited from
holding the provider key or a remotely effective binding. The committed
activation identity is public, but outside the isolated local proof it must
not be installed as a plaintext remote variable or used to bypass the staged
Worker-secret review.

Wrangler 4.95 copies the latest uploaded Version when `versions secret put`
runs and offers no `--version-id` selector. Use the checked-in
`scripts/stage-marketing-create-secrets.sh` helper; do not issue either put by
hand. The helper accepts secret values only through Wrangler's hidden TTY
prompts, parses each created UUID from that put's stdout, never deploys, and
writes only a private redacted receipt.

The helper is also the binding and Version proof. It numeric-sorts Version
numbers rather than trusting API array order and permits only the exact ladder
Version 60 (`9e6885ce-ea25-4158-ba71-69b8bdfc256b`) to Version 61 after the
provider-key put to Version 62 after the activation put. Immediately before
the first put it requires that literal candidate to be both latest and the
only Version at 100 percent production traffic. An intervening upload or
deployment is a hard stop.

Binding comparison must preserve every field of every non-secret binding,
recursively key-normalize each object, and sort the complete array by binding
name and type. Secret bindings alone are reduced to `{name,type}`. The helper
therefore requires exact 19-object candidate parity, then exactly the provider
secret addition at 20, then exactly the activation secret addition at 21;
name/type-only comparison of the baseline bindings is insufficient.

From a clean checkout of the reviewed activation commit, run the helper in a
TTY. It is resumable only from a fully verified Version 60, 61, or 62 state:

```bash
set -euo pipefail
umask 077
test -z "$(git status --porcelain=v1)"
test -x scripts/stage-marketing-create-secrets.sh
./scripts/stage-marketing-create-secrets.sh
```

Do not copy either secret into a command argument, shell variable, file, log,
or chat. The helper captures and parses both put results internally. A normal
successful run ends at a verified but undeployed Version 62; production must
still be the literal candidate Version 60 at 100 percent.

Run the helper's read-only verification mode once more before deployment. Then
independently re-prove the numeric Version ladder and extract the final UUID
from the verified Version 62 record. The helper has already matched this UUID
to the UUID parsed from the second put's stdout:

```bash
WORKER_NAME=cambium-quests
WRANGLER_CONFIG=workers/quests/wrangler.jsonc
CANDIDATE_VERSION_ID=9e6885ce-ea25-4158-ba71-69b8bdfc256b

./scripts/stage-marketing-create-secrets.sh --check-only

FINAL_VERSIONS_JSON="$(mktemp)"
FINAL_DEPLOYMENT_JSON="$(mktemp)"
trap 'rm -f "$FINAL_VERSIONS_JSON" "$FINAL_DEPLOYMENT_JSON"' EXIT

npx --no-install wrangler versions list \
  --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
  > "$FINAL_VERSIONS_JSON"
jq -e --arg candidate "$CANDIDATE_VERSION_ID" '
  (map(.number |= tonumber) | sort_by(.number)) as $versions
  | ([$versions[] | select(.number >= 60) | .number] == [60,61,62])
    and ([$versions[] | select(.number == 60 and .id == $candidate)] | length == 1)
    and ([$versions[] | select(.number == 61)] | length == 1)
    and ([$versions[] | select(.number == 62)] | length == 1)
' "$FINAL_VERSIONS_JSON"
ACTIVATION_VERSION_ID="$(jq -er '
  (map(.number |= tonumber) | sort_by(.number))
  | last | select(.number == 62) | .id
' "$FINAL_VERSIONS_JSON")"
case "$ACTIVATION_VERSION_ID" in
  ????????-????-????-????-????????????) ;;
  *) echo 'final staged version is not one exact UUID' >&2; exit 1 ;;
esac
```

Explicit deployment is a separate, final operation. Immediately before it,
require production still to be only the literal candidate at 100 percent.
Nothing may run between this guard and the deploy command:

```bash
npx --no-install wrangler deployments status \
  --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
  > "$FINAL_DEPLOYMENT_JSON"
jq -e --arg candidate '9e6885ce-ea25-4158-ba71-69b8bdfc256b' '
  .versions | length == 1 and .[0].percentage == 100
  and .[0].version_id == $candidate
' "$FINAL_DEPLOYMENT_JSON"
npx --no-install wrangler versions deploy "$ACTIVATION_VERSION_ID@100%" \
  --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" \
  --message "activate reviewed marketing create Version" --yes
npx --no-install wrangler deployments status \
  --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
  > "$FINAL_DEPLOYMENT_JSON"
jq -e --arg activated "$ACTIVATION_VERSION_ID" '
  .versions | length == 1 and .[0].percentage == 100
  and .[0].version_id == $activated
' "$FINAL_DEPLOYMENT_JSON"
rm -f "$FINAL_VERSIONS_JSON" "$FINAL_DEPLOYMENT_JSON"
trap - EXIT
```

Do not use `wrangler secret put` for this activation: that legacy command
creates and immediately deploys a new Worker Version. `wrangler versions secret
put` stages the change; only the explicit `wrangler versions deploy` command
above may activate it after all proof succeeds.

After deployment, run only the checked-in prepare proof helper. It may call the
authenticated `/v1/bridge/marketing-renders/prepare` route and perform bounded
D1 reads. It must not call the approval route, the render `/execute` route, or
the provider. Its passing receipt requires one retained `prepared` row, an
idempotent replay, zero approval rows, and null invocation, artifact, terminal,
and provider-usage fields:

```bash
: "${CAMBIUM_QUESTS_BASE_URL:?set the reviewed direct workers.dev canonical HTTPS origin}"
test -x scripts/prove-marketing-create-prepare.sh
./scripts/prove-marketing-create-prepare.sh --check-only
CAMBIUM_QUESTS_BASE_URL="$CAMBIUM_QUESTS_BASE_URL" \
  ./scripts/prove-marketing-create-prepare.sh
```

Any failed Version, binding, deployment, or prepare-only proof stops the wave.
If Version 62 has already received traffic, roll back to this literal inert
candidate target, never to a tag, latest Version, or rebuilt artifact:

```bash
: "${CAMBIUM_QUESTS_DIRECT_HEALTH_URL:?set the exact direct HTTPS /healthz URL}"
: "${CAMBIUM_QUESTS_CUSTOM_HEALTH_URL:?set the exact custom HTTPS /healthz URL}"
CAMBIUM_QUESTS_DIRECT_HEALTH_SHA256='618193599d58486ffa1755971d7edf81bf1b9bb422161db75f472e49e23d4f45'
CAMBIUM_QUESTS_CUSTOM_HEALTH_SHA256='ba9ff22b02359797877fc53501822bbdae51c6b6854fbce49ae08c7cfbd6cc56'
validate_cambium_health_url() {
  node -e '
    const { createHash } = require("node:crypto");
    const raw = process.argv[1];
    const expectedDigest = process.argv[2];
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      process.exit(1);
    }
    if (
      parsed.protocol !== "https:"
      || parsed.origin === "null"
      || parsed.username !== ""
      || parsed.password !== ""
      || parsed.pathname !== "/healthz"
      || parsed.search !== ""
      || parsed.hash !== ""
      || raw !== `${parsed.origin}/healthz`
    ) process.exit(1);
    const observedDigest = createHash("sha256").update(raw).digest("hex");
    if (observedDigest !== expectedDigest) process.exit(1);
  ' "$1" "$2"
}
validate_cambium_health_url \
  "$CAMBIUM_QUESTS_DIRECT_HEALTH_URL" "$CAMBIUM_QUESTS_DIRECT_HEALTH_SHA256" \
  || { echo 'invalid direct HTTPS health URL' >&2; exit 1; }
validate_cambium_health_url \
  "$CAMBIUM_QUESTS_CUSTOM_HEALTH_URL" "$CAMBIUM_QUESTS_CUSTOM_HEALTH_SHA256" \
  || { echo 'invalid custom HTTPS health URL' >&2; exit 1; }

npx --no-install wrangler versions deploy \
  '9e6885ce-ea25-4158-ba71-69b8bdfc256b@100%' \
  --name cambium-quests --config workers/quests/wrangler.jsonc \
  --message 'rollback marketing-create activation to inert Version 60' --yes
ROLLBACK_DEPLOYMENT_JSON="$(mktemp)"
trap 'rm -f "$ROLLBACK_DEPLOYMENT_JSON"' EXIT
npx --no-install wrangler deployments status \
  --name cambium-quests --config workers/quests/wrangler.jsonc --json \
  > "$ROLLBACK_DEPLOYMENT_JSON"
jq -e --arg candidate '9e6885ce-ea25-4158-ba71-69b8bdfc256b' '
  .versions | length == 1 and .[0].percentage == 100
  and .[0].version_id == $candidate
' "$ROLLBACK_DEPLOYMENT_JSON"
test "$(curl -q --proxy '' --proto '=https' \
  --connect-timeout 5 --max-time 15 --max-filesize 65536 \
  -sS -o /dev/null -w '%{http_code}' \
  "$CAMBIUM_QUESTS_DIRECT_HEALTH_URL")" = 200
test "$(curl -q --proxy '' --proto '=https' \
  --connect-timeout 5 --max-time 15 --max-filesize 65536 \
  -sS -o /dev/null -w '%{http_code}' \
  "$CAMBIUM_QUESTS_CUSTOM_HEALTH_URL")" = 200
rm -f "$ROLLBACK_DEPLOYMENT_JSON"
trap - EXIT
```

## Hermes Native Execution Order

Native execution is fail-closed until D1 owns claims and terminal outcomes. Keep
both Hermes flags false while this Worker release is staged:

```dotenv
HERMES_RUNNER_EXECUTE_DIRECTIVES=false
HERMES_RUNNER_LEGACY_ACK_WITHOUT_EXECUTION=false
```

Record the current Worker version and take a private, non-empty export of the
`cambium-bridge` D1 database before applying the additive execution migration.
The restrictive umask must be set before either the export or its SHA receipt
is created:

```bash
umask 077
BACKUP_ROOT="${CAMBIUM_BACKUP_ROOT:-$HOME/.local/state/cambium/d1-backups}"
BACKUP_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
D1_BACKUP="$BACKUP_ROOT/cambium-bridge-$BACKUP_STAMP.sql"
D1_RECEIPT="$D1_BACKUP.sha256"
install -d -m 700 "$BACKUP_ROOT"
npx --no-install wrangler d1 export cambium-bridge \
  --remote \
  --config workers/quests/wrangler.jsonc \
  --output "$D1_BACKUP"
test -s "$D1_BACKUP"
shasum -a 256 "$D1_BACKUP" > "$D1_RECEIPT"
chmod 600 "$D1_BACKUP" "$D1_RECEIPT"
test -s "$D1_RECEIPT"
```

Keep the export and receipt outside the repository and never paste their
contents into CI, PR, or chat logs. Only after both `test -s` probes pass may
the migration and Worker deploy proceed:

```bash
npx --no-install wrangler d1 migrations apply cambium-bridge \
  --remote \
  --config workers/quests/wrangler.jsonc
npx --no-install wrangler d1 execute cambium-bridge \
  --remote \
  --config workers/quests/wrangler.jsonc \
  --command "SELECT name FROM sqlite_master WHERE name IN ('bridge_executions','bridge_execution_identities','bridge_execution_claims','bridge_execution_events','bridge_execution_identity_guard_insert','bridge_execution_claim_history_insert','bridge_execution_identity_guard_takeover','bridge_execution_claim_history_takeover','bridge_execution_ack_timestamp') ORDER BY name"
npx --no-install wrangler deploy --config workers/quests/wrangler.jsonc
```

The schema probe must return all four tables and all five triggers. Before the
canary, separately confirm that `goal_graph_nodes` exposes all three additive
operational-anchor columns:

```bash
npx --no-install wrangler d1 execute cambium-bridge \
  --remote \
  --config workers/quests/wrangler.jsonc \
  --command "SELECT name FROM pragma_table_info('goal_graph_nodes') WHERE name IN ('work_object_id','work_object_kind','pinned_loadout_id') ORDER BY name"
```

With delivery disabled, use the scoped member credential from the Hermes host
to prove this sequence against a single `native_execution` canary:

```text
poll -> claim -> outcome -> immutable foldback -> ACK
```

The claim must have a future `leaseExpiresAt`; a second live claimant must get
`busy`; an expired takeover must change the fencing token; the stale outcome
must get HTTP 409; foldback must reject non-terminal, mismatched, stale, or
tampered evidence; and ACK must get HTTP 409 until a persisted `executed` or
`failed` outcome and its exact immutable foldback proof exist. Confirm the D1
row has `terminal = 1` and a non-null `acknowledged_at` without selecting
attestation JSON or credentials. The exact held live-canary conditions are in
`docs/project-management/hermes-execution-foldback-preflight.v1.json`.

Only after that delivery-disabled canary passes may Hermes set
`HERMES_RUNNER_EXECUTE_DIRECTIVES=true`. Leave
`HERMES_RUNNER_LEGACY_ACK_WITHOUT_EXECUTION=false`. A Worker-code rollback may
leave migration `0003_bridge_execution_proof.sql` in place because it is
additive; do not drop execution rows during rollback.

## Rollback

Rollback means redeploying the previous known-good release tag from an isolated clean clone. Do not reset, switch, or clean an active worktree, and do not use an untagged local branch as rollback authority. Record the current Worker version before starting.

Before rolling back to any Worker release that predates the native execution
guard, stop the Hermes runner and force both execution flags false on the
Hermes host. This happens before the old Worker code is deployed, so no poller
can ACK through the pre-guard route during the rollback window:

```bash
sudo systemctl stop hermes-runner.timer
sudo systemctl stop hermes-runner.service || true
sudo python3 - <<'PY'
from pathlib import Path

path = Path('/etc/hermes/hermes-runner.env')
updates = {
    'HERMES_RUNNER_EXECUTE_DIRECTIVES': 'false',
    'HERMES_RUNNER_LEGACY_ACK_WITHOUT_EXECUTION': 'false',
}
lines = path.read_text(encoding='utf-8').splitlines()
seen = set()
result = []
for line in lines:
    key = line.split('=', 1)[0] if '=' in line else ''
    if key in updates:
        if key not in seen:
            result.append(f'{key}={updates[key]}')
        seen.add(key)
    else:
        result.append(line)
for key, value in updates.items():
    if key not in seen:
        result.append(f'{key}={value}')
path.write_text('\n'.join(result) + '\n', encoding='utf-8')
PY
sudo grep -E '^HERMES_RUNNER_(EXECUTE_DIRECTIVES|LEGACY_ACK_WITHOUT_EXECUTION)=false$' \
  /etc/hermes/hermes-runner.env
```

The grep must print exactly both false settings. Keep the runner stopped and
leave both flags false if the rollback target lacks native outcome-before-ACK
enforcement.

```bash
ROLLBACK_TAG=v0.2.7
ROLLBACK_DIR="$(mktemp -d)/cambium-rollback"
git clone --shared --no-checkout "$(git rev-parse --show-toplevel)" "$ROLLBACK_DIR"
git -C "$ROLLBACK_DIR" checkout --detach "$ROLLBACK_TAG"
cd "$ROLLBACK_DIR"
npx --no-install wrangler deploy --config workers/quests/wrangler.jsonc
```

Keep the isolated clone until verification completes. A Worker rollback changes deployed code only; it does not reverse KV, D1, R2, Vectorize, or secret state. Migration `0003_bridge_execution_proof.sql` is additive and remains in place; do not drop its execution rows during rollback. If another release includes a non-additive data migration, use that release's separately reviewed data rollback before redeploying older code.

Verify the new Worker version printed by Wrangler, then repeat both production probes:

```bash
curl -fsS "$CAMBIUM_QUESTS_BASE_URL/healthz/gate"
curl -sS -H 'content-type: application/json' \
  --data '{"kind":"confirm-action-request","subject":"rollback-probe","initData":""}' \
  -w '\nHTTP_STATUS:%{http_code}\n' \
  "$CAMBIUM_QUESTS_BASE_URL/api/gate/cambium"
```

Rollback is accepted only when health returns HTTP 200 with `"gateConfigured":true`, the auth-boundary probe returns HTTP 401 with `missing initData`, and the served page digest matches the selected rollback tag's `PAGE` export.
