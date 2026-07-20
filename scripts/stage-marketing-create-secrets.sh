#!/usr/bin/env bash
set -euo pipefail

IFS=$'\n\t'
umask 077

readonly WORKER_NAME='cambium-quests'
readonly CANDIDATE_VERSION_ID='9e6885ce-ea25-4158-ba71-69b8bdfc256b'
readonly CANDIDATE_VERSION_NUMBER=60
readonly CANDIDATE_SCRIPT_ETAG='d24335443e95d0755168cc685db4b023947625f867180f6923dc56bd1517a546'
readonly CANDIDATE_BINDING_COUNT=19
readonly CANDIDATE_NAME_TYPE_SHA256='45442b5b6aafee3e88f22823d5caa5ef931a0c01eb9dc0c83ab2d0adbe20f8fd'
readonly CANDIDATE_FULL_BINDINGS_SHA256='75471627720f10533316bd56c436293f16750d82cde1096afdc035072475363e'
readonly PROVIDER_SECRET_NAME='NVIDIA_MARKETING_CREATE_API_KEY'
readonly PROVIDER_VERSION_NUMBER=61
readonly ACTIVATION_SECRET_NAME='MARKETING_CREATE_ACTIVATION'
readonly REVIEWED_ACTIVATION_IDENTITY='founder-article-nvidia@1.0.0:ae1d60e951f6d6c18041581ddb018b53b162ebfb49bf9370f3185c38e03fc12f'
readonly ACTIVATION_VERSION_NUMBER=62
readonly REQUIRED_WRANGLER_VERSION='4.95.0'
readonly UUID_PATTERN='^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SCRIPT_DIR
REPOSITORY_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
readonly REPOSITORY_ROOT
readonly WRANGLER_CONFIG="$REPOSITORY_ROOT/workers/quests/wrangler.jsonc"
readonly STATE_DIRECTORY="${XDG_STATE_HOME:-${HOME:?HOME must be set}/.local/state}/cambium"
readonly STATE_RECEIPT="$STATE_DIRECTORY/marketing-create-secret-staging.json"
readonly -a WRANGLER=(npx --no-install wrangler)

CHECK_ONLY=false
RUN_DIRECTORY=''
LATEST_VERSION_NUMBER=''
LATEST_VERSION_ID=''
VERSION_COUNT=''
STAGED_VERSION_ID=''
PROVIDER_VERSION_ID=''
ACTIVATION_VERSION_ID=''

usage() {
  cat <<'USAGE'
Usage: scripts/stage-marketing-create-secrets.sh [--check-only]

Stages the two reviewed Marketing Create Worker secrets from Wrangler's hidden
interactive prompts. Secret values are never accepted by this script through
arguments, files, shell variables, or piped stdin.

  --check-only  Verify the current Version lineage without staging a secret.
  --help        Show this help.
USAGE
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [[ -n "$RUN_DIRECTORY" && -d "$RUN_DIRECTORY" ]]; then
    case "$RUN_DIRECTORY" in
      "${TMPDIR:-/tmp}"/cambium-marketing-create.*)
        rm -rf -- "$RUN_DIRECTORY"
        ;;
      *)
        printf 'WARNING: refusing to remove unexpected temporary path: %s\n' "$RUN_DIRECTORY" >&2
        ;;
    esac
  fi
}

parse_arguments() {
  case "$#" in
    0)
      ;;
    1)
      case "$1" in
        --check-only)
          CHECK_ONLY=true
          ;;
        --help|-h)
          usage
          exit 0
          ;;
        *)
          usage >&2
          die 'the only accepted argument is --check-only'
          ;;
      esac
      ;;
    *)
      usage >&2
      die 'secret values must never be supplied as arguments'
      ;;
  esac
}

require_operator_custody() {
  [[ -t 0 ]] || die 'stdin must be a trusted interactive TTY; piped input is forbidden'
  [[ -z "${NVIDIA_MARKETING_CREATE_API_KEY+x}" ]] || die "$PROVIDER_SECRET_NAME must be unset in the environment"
  [[ -z "${MARKETING_CREATE_ACTIVATION+x}" ]] || die "$ACTIVATION_SECRET_NAME must be unset in the environment"
  [[ -f "$WRANGLER_CONFIG" ]] || die "missing Wrangler config: $WRANGLER_CONFIG"

  local command_name
  for command_name in npx jq shasum awk sed script cmp mktemp; do
    command -v "$command_name" >/dev/null 2>&1 || die "required command not found: $command_name"
  done

  local wrangler_version
  wrangler_version="$("${WRANGLER[@]}" --version)"
  [[ "$wrangler_version" == "$REQUIRED_WRANGLER_VERSION" ]] || \
    die "Wrangler $REQUIRED_WRANGLER_VERSION is required; found $wrangler_version"
}

prepare_private_runtime() {
  RUN_DIRECTORY="$(mktemp -d "${TMPDIR:-/tmp}/cambium-marketing-create.XXXXXX")"
  chmod 700 "$RUN_DIRECTORY"
  trap cleanup EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  # Wrangler's console output contains only names and Version IDs, but disk
  # logging is disabled so its request machinery cannot create another log.
  export WRANGLER_WRITE_LOGS=false
  export WRANGLER_LOG_SANITIZE=true
  unset WRANGLER_LOG_PATH WRANGLER_OUTPUT_FILE_PATH WRANGLER_OUTPUT_FILE_DIRECTORY
}

fetch_versions_index() {
  local output_path="$RUN_DIRECTORY/versions-index.json"
  "${WRANGLER[@]}" versions list \
    --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
    | jq -e '
        if type != "array" or length == 0 then
          error("Worker has no Versions")
        else
          [ .[] | {id, number} ]
        end
      ' > "$output_path"

  local latest_record
  latest_record="$(jq -er '
      sort_by(.number)
      | last
      | select((.number | type) == "number")
      | select((.id | type) == "string")
      | "\(.number)\t\(.id)"
    ' "$output_path")" || die 'could not determine the latest Version by number'

  LATEST_VERSION_NUMBER="${latest_record%%$'\t'*}"
  LATEST_VERSION_ID="${latest_record#*$'\t'}"
  VERSION_COUNT="$(jq -er 'length' "$output_path")"
  [[ "$LATEST_VERSION_ID" =~ $UUID_PATTERN ]] || die 'latest Version ID is not a valid UUID'
  [[ "$VERSION_COUNT" =~ ^[0-9]+$ ]] || die 'Version count is not numeric'
}

assert_latest_version() {
  local expected_number="$1"
  local expected_id="$2"
  fetch_versions_index
  [[ "$LATEST_VERSION_NUMBER" == "$expected_number" ]] || \
    die "Version race: expected latest number $expected_number, found $LATEST_VERSION_NUMBER"
  [[ "$VERSION_COUNT" == "$expected_number" ]] || \
    die "Version race: expected exactly $expected_number total Versions, found $VERSION_COUNT"
  [[ "$LATEST_VERSION_ID" == "$expected_id" ]] || \
    die "Version race: latest number $expected_number has an unexpected UUID"
}

fetch_version_view() {
  local version_id="$1"
  local output_path="$2"
  "${WRANGLER[@]}" versions view "$version_id" \
    --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
    | jq -e '
        .resources.bindings |= map(
          if (.type == "secret_text" or .type == "secret_key") then
            {name, type}
          else
            .
          end
        )
      ' > "$output_path"
}

sha256_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

assert_candidate_identity() {
  local candidate_json="$RUN_DIRECTORY/candidate.json"
  local canonical_bindings="$RUN_DIRECTORY/candidate-bindings.json"
  local name_type_bindings="$RUN_DIRECTORY/candidate-name-type-bindings.json"
  fetch_version_view "$CANDIDATE_VERSION_ID" "$candidate_json"

  jq -e \
    --arg id "$CANDIDATE_VERSION_ID" \
    --arg etag "$CANDIDATE_SCRIPT_ETAG" \
    --argjson number "$CANDIDATE_VERSION_NUMBER" \
    --argjson count "$CANDIDATE_BINDING_COUNT" \
    --arg provider "$PROVIDER_SECRET_NAME" \
    --arg activation "$ACTIVATION_SECRET_NAME" '
      .id == $id
      and .number == $number
      and .resources.script.etag == $etag
      and (.resources.bindings | type) == "array"
      and (.resources.bindings | length) == $count
      and ([.resources.bindings[] | select(.name == $provider or .name == $activation)] | length) == 0
    ' "$candidate_json" >/dev/null || die 'candidate UUID, number, ETag, binding count, or secret absence did not match'

  jq -cS '.resources.bindings | sort_by(.name, .type)' "$candidate_json" > "$canonical_bindings"
  [[ "$(sha256_file "$canonical_bindings")" == "$CANDIDATE_FULL_BINDINGS_SHA256" ]] || \
    die 'candidate full binding-object digest did not match the audited Version 60 baseline'

  local name_type_signature
  name_type_signature="$(jq -cS '[.resources.bindings[] | {name, type}] | sort_by(.name, .type)' \
    "$candidate_json")"
  printf '%s' "$name_type_signature" > "$name_type_bindings"
  [[ "$(sha256_file "$name_type_bindings")" == "$CANDIDATE_NAME_TYPE_SHA256" ]] || \
    die 'candidate historical 19-binding name/type digest did not match'
}

assert_production_candidate() {
  local deployment_json="$RUN_DIRECTORY/deployment.json"
  "${WRANGLER[@]}" deployments status \
    --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --json \
    | jq -e '{versions: [.versions[] | {version_id, percentage}]}' > "$deployment_json"

  jq -e --arg candidate "$CANDIDATE_VERSION_ID" '
      (.versions | length) == 1
      and .versions[0].version_id == $candidate
      and (.versions[0].percentage | tonumber) == 100
    ' "$deployment_json" >/dev/null || \
    die 'production is not exactly candidate Version 60 at 100 percent'
}

run_literal_rollback_dry_run() {
  assert_production_candidate
  "${WRANGLER[@]}" versions deploy "${CANDIDATE_VERSION_ID}@100%" --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" --message 'rollback dry-run to reviewed secret-absent candidate Version 60' --yes --dry-run
  assert_production_candidate
}

assert_exact_secret_binding() {
  local version_json="$1"
  local secret_name="$2"
  jq -e --arg name "$secret_name" '
      [.resources.bindings[] | select(.name == $name)]
      == [{name: $name, type: "secret_text"}]
    ' "$version_json" >/dev/null || \
    die "Version does not contain exactly the reviewed secret binding $secret_name"
}

assert_provider_version() {
  local version_id="$1"
  local provider_json="$RUN_DIRECTORY/provider-version.json"
  local provider_remainder="$RUN_DIRECTORY/provider-remainder.json"
  fetch_version_view "$version_id" "$provider_json"

  jq -e \
    --arg id "$version_id" \
    --arg etag "$CANDIDATE_SCRIPT_ETAG" \
    --arg activation "$ACTIVATION_SECRET_NAME" \
    --argjson number "$PROVIDER_VERSION_NUMBER" \
    --argjson count "$((CANDIDATE_BINDING_COUNT + 1))" '
      .id == $id
      and .number == $number
      and .resources.script.etag == $etag
      and (.resources.bindings | length) == $count
      and ([.resources.bindings[] | select(.name == $activation)] | length) == 0
    ' "$provider_json" >/dev/null || die 'Version 61 identity, ETag, count, or activation absence did not match'

  assert_exact_secret_binding "$provider_json" "$PROVIDER_SECRET_NAME"
  jq -cS --arg provider "$PROVIDER_SECRET_NAME" '
      .resources.bindings
      | map(select(.name != $provider))
      | sort_by(.name, .type)
    ' "$provider_json" > "$provider_remainder"
  cmp -s "$RUN_DIRECTORY/candidate-bindings.json" "$provider_remainder" || \
    die 'Version 61 changed a complete candidate binding object'
  [[ "$(sha256_file "$provider_remainder")" == "$CANDIDATE_FULL_BINDINGS_SHA256" ]] || \
    die 'Version 61 remainder digest did not match the full candidate baseline'
}

assert_activation_version() {
  local version_id="$1"
  local activation_json="$RUN_DIRECTORY/activation-version.json"
  local activation_remainder="$RUN_DIRECTORY/activation-remainder.json"
  fetch_version_view "$version_id" "$activation_json"

  jq -e \
    --arg id "$version_id" \
    --arg etag "$CANDIDATE_SCRIPT_ETAG" \
    --argjson number "$ACTIVATION_VERSION_NUMBER" \
    --argjson count "$((CANDIDATE_BINDING_COUNT + 2))" '
      .id == $id
      and .number == $number
      and .resources.script.etag == $etag
      and (.resources.bindings | length) == $count
    ' "$activation_json" >/dev/null || die 'Version 62 identity, ETag, or exact 21-binding count did not match'

  assert_exact_secret_binding "$activation_json" "$PROVIDER_SECRET_NAME"
  assert_exact_secret_binding "$activation_json" "$ACTIVATION_SECRET_NAME"
  jq -cS --arg provider "$PROVIDER_SECRET_NAME" --arg activation "$ACTIVATION_SECRET_NAME" '
      .resources.bindings
      | map(select(.name != $provider and .name != $activation))
      | sort_by(.name, .type)
    ' "$activation_json" > "$activation_remainder"
  cmp -s "$RUN_DIRECTORY/candidate-bindings.json" "$activation_remainder" || \
    die 'Version 62 changed a complete candidate binding object'
  [[ "$(sha256_file "$activation_remainder")" == "$CANDIDATE_FULL_BINDINGS_SHA256" ]] || \
    die 'Version 62 remainder digest did not match the full candidate baseline'
}

parse_put_uuid() {
  local put_stdout="$1"
  local secret_name="$2"
  local matches
  local match_count
  matches="$(LC_ALL=C sed -nE \
    "s/^.*Created version ([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}) with secret ${secret_name}\\..*$/\\1/p" \
    "$put_stdout")"
  match_count="$(printf '%s\n' "$matches" | awk 'NF { count += 1 } END { print count + 0 }')"
  [[ "$match_count" == 1 ]] || die "could not parse exactly one Version UUID from Wrangler put stdout for $secret_name"
  [[ "$matches" =~ $UUID_PATTERN ]] || die 'Wrangler put stdout contained an invalid Version UUID'
  printf '%s\n' "$matches"
}

stage_secret_with_wrangler() {
  local secret_name="$1"
  local tag="$2"
  local message="$3"
  local put_stdout="$RUN_DIRECTORY/put-stdout.txt"
  : > "$put_stdout"

  # `script` gives Wrangler a private pseudo-terminal, preserving both stdin
  # and stdout TTY detection. Wrangler alone disables echo and reads the value;
  # this shell captures only terminal output, then immediately truncates it.
  script -q "$put_stdout" "${WRANGLER[@]}" versions secret put "$secret_name" \
    --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" \
    --tag "$tag" --message "$message"
  STAGED_VERSION_ID="$(parse_put_uuid "$put_stdout" "$secret_name")"
  : > "$put_stdout"
}

write_redacted_state() {
  local stage="$1"
  local provider_id="${2:-}"
  local activation_id="${3:-}"
  mkdir -p "$STATE_DIRECTORY"
  chmod 700 "$STATE_DIRECTORY"
  [[ ! -L "$STATE_RECEIPT" ]] || die 'refusing to replace a symlinked state receipt'

  local receipt_tmp
  receipt_tmp="$(mktemp "$STATE_DIRECTORY/.marketing-create-secret-staging.XXXXXX")"
  jq -n \
    --arg stage "$stage" \
    --arg candidate "$CANDIDATE_VERSION_ID" \
    --arg provider "$provider_id" \
    --arg activation "$activation_id" \
    --arg etag "$CANDIDATE_SCRIPT_ETAG" \
    --argjson observedVersionCount "$VERSION_COUNT" \
    --arg bindingsSha256 "$CANDIDATE_FULL_BINDINGS_SHA256" '
      {
        stage: $stage,
        candidateVersion: {number: 60, id: $candidate},
        providerVersion: (if $provider == "" then null else {number: 61, id: $provider} end),
        activationVersion: (if $activation == "" then null else {number: 62, id: $activation} end),
        candidateScriptETag: $etag,
        fullBindingObjectSha256: $bindingsSha256,
        versionCounts: {preStaging: 60, observed: $observedVersionCount},
        production: {number: 60, id: $candidate, percentage: 100},
        secretValuesPresentInReceipt: false
      }
    ' > "$receipt_tmp"
  chmod 600 "$receipt_tmp"
  mv -f "$receipt_tmp" "$STATE_RECEIPT"
}

print_receipt() {
  local stage="$1"
  printf 'STAGE=%s\n' "$stage"
  printf 'CANDIDATE_VERSION_NUMBER=%s\n' "$CANDIDATE_VERSION_NUMBER"
  printf 'CANDIDATE_VERSION_ID=%s\n' "$CANDIDATE_VERSION_ID"
  printf 'CANDIDATE_FULL_BINDINGS_SHA256=%s\n' "$CANDIDATE_FULL_BINDINGS_SHA256"
  printf 'PRE_STAGING_VERSION_COUNT=%s\n' "$CANDIDATE_VERSION_NUMBER"
  printf 'OBSERVED_VERSION_COUNT=%s\n' "$VERSION_COUNT"
  if [[ -n "$PROVIDER_VERSION_ID" ]]; then
    printf 'PROVIDER_VERSION_NUMBER=%s\n' "$PROVIDER_VERSION_NUMBER"
    printf 'PROVIDER_VERSION_ID=%s\n' "$PROVIDER_VERSION_ID"
  fi
  if [[ -n "$ACTIVATION_VERSION_ID" ]]; then
    printf 'ACTIVATION_VERSION_NUMBER=%s\n' "$ACTIVATION_VERSION_NUMBER"
    printf 'ACTIVATION_VERSION_ID=%s\n' "$ACTIVATION_VERSION_ID"
  fi
  printf 'PRODUCTION_VERSION_NUMBER=%s\n' "$CANDIDATE_VERSION_NUMBER"
  printf 'PRODUCTION_VERSION_ID=%s\n' "$CANDIDATE_VERSION_ID"
  printf 'PRODUCTION_PERCENTAGE=100\n'
  if [[ "$CHECK_ONLY" == false ]]; then
    printf 'STATE_RECEIPT=%s\n' "$STATE_RECEIPT"
  fi
}

main() {
  parse_arguments "$@"
  require_operator_custody
  prepare_private_runtime
  assert_candidate_identity
  assert_production_candidate
  fetch_versions_index

  case "$LATEST_VERSION_NUMBER" in
    "$CANDIDATE_VERSION_NUMBER")
      [[ "$LATEST_VERSION_ID" == "$CANDIDATE_VERSION_ID" ]] || die 'Version 60 UUID is not the reviewed candidate'
      run_literal_rollback_dry_run
      assert_latest_version "$CANDIDATE_VERSION_NUMBER" "$CANDIDATE_VERSION_ID"
      if [[ "$CHECK_ONLY" == true ]]; then
        print_receipt 'ready-for-provider-secret'
        return
      fi

      stage_secret_with_wrangler \
        "$PROVIDER_SECRET_NAME" \
        'marketing-create-provider-secret-staged' \
        'stage dedicated marketing provider binding'
      PROVIDER_VERSION_ID="$STAGED_VERSION_ID"
      assert_latest_version "$PROVIDER_VERSION_NUMBER" "$PROVIDER_VERSION_ID"
      assert_provider_version "$PROVIDER_VERSION_ID"
      assert_production_candidate
      write_redacted_state 'provider-secret-staged' "$PROVIDER_VERSION_ID"
      ;;
    "$PROVIDER_VERSION_NUMBER")
      PROVIDER_VERSION_ID="$LATEST_VERSION_ID"
      assert_provider_version "$PROVIDER_VERSION_ID"
      assert_production_candidate
      run_literal_rollback_dry_run
      assert_latest_version "$PROVIDER_VERSION_NUMBER" "$PROVIDER_VERSION_ID"
      if [[ "$CHECK_ONLY" == true ]]; then
        print_receipt 'ready-for-activation-secret'
        return
      fi
      write_redacted_state 'provider-secret-staged' "$PROVIDER_VERSION_ID"
      ;;
    "$ACTIVATION_VERSION_NUMBER")
      ACTIVATION_VERSION_ID="$LATEST_VERSION_ID"
      assert_activation_version "$ACTIVATION_VERSION_ID"
      # Version 61 remains in the returned Version index; resolve it by number only
      # after Version 62's complete lineage has passed.
      PROVIDER_VERSION_ID="$(jq -er --argjson number "$PROVIDER_VERSION_NUMBER" '
          [.[] | select(.number == $number)]
          | select(length == 1)
          | .[0].id
        ' "$RUN_DIRECTORY/versions-index.json")"
      [[ "$PROVIDER_VERSION_ID" =~ $UUID_PATTERN ]] || die 'Version 61 UUID is invalid'
      assert_provider_version "$PROVIDER_VERSION_ID"
      assert_production_candidate
      assert_latest_version "$ACTIVATION_VERSION_NUMBER" "$ACTIVATION_VERSION_ID"
      if [[ "$CHECK_ONLY" == false ]]; then
        write_redacted_state 'both-secrets-staged-awaiting-explicit-deploy' "$PROVIDER_VERSION_ID" "$ACTIVATION_VERSION_ID"
      fi
      print_receipt 'both-secrets-staged-awaiting-explicit-deploy'
      return
      ;;
    *)
      die "latest Version number must be exactly 60, 61, or 62; found $LATEST_VERSION_NUMBER"
      ;;
  esac

  # This is the immediate race check before Wrangler receives the second value.
  assert_provider_version "$PROVIDER_VERSION_ID"
  assert_production_candidate
  assert_latest_version "$PROVIDER_VERSION_NUMBER" "$PROVIDER_VERSION_ID"
  printf 'REVIEWED_ACTIVATION_IDENTITY=%s\n' "$REVIEWED_ACTIVATION_IDENTITY"
  printf 'Paste that exact public identity only into Wrangler%s hidden prompt.\n' "'s"
  stage_secret_with_wrangler \
    "$ACTIVATION_SECRET_NAME" \
    'marketing-create-activation-staged' \
    'stage reviewed marketing activation binding'
  ACTIVATION_VERSION_ID="$STAGED_VERSION_ID"
  assert_latest_version "$ACTIVATION_VERSION_NUMBER" "$ACTIVATION_VERSION_ID"
  assert_activation_version "$ACTIVATION_VERSION_ID"
  assert_production_candidate

  # Re-read both mutable remote surfaces immediately before the handoff.
  assert_production_candidate
  assert_latest_version "$ACTIVATION_VERSION_NUMBER" "$ACTIVATION_VERSION_ID"
  write_redacted_state 'both-secrets-staged-awaiting-explicit-deploy' "$PROVIDER_VERSION_ID" "$ACTIVATION_VERSION_ID"
  print_receipt 'both-secrets-staged-awaiting-explicit-deploy'
}

main "$@"
