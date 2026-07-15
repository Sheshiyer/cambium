# Weekly Client Report R2 Key Contract

Date: 2026-07-15

Issue: `#246`

Status: source contract implemented; production key inventory still required

## Boundary

`weekly-client-report` may read only object keys supplied in
`CONTEXT_ROUTINE_ALLOWLIST_JSON`. The request path never lists the bucket, scans
a prefix, follows a caller-provided key, or returns a raw object body.

Production key names are intentionally not guessed or committed here. A
metadata-only runtime inventory must identify the exact keys before the Worker
configuration is changed.

## Runtime configuration contract

The allowlist is a JSON object keyed by routine id. Each routine contains at
most eight sections and each section contains at most eight exact keys.

```text
{
  "weekly-client-report": [{
    "id": "stable-section-id",
    "title": "Founder-facing section title",
    "keys": ["<exact key from the approved runtime inventory>"],
    "maxAgeSeconds": <reviewed freshness threshold from 60 through 7776000>
  }]
}
```

The example is a schema illustration, not deployable configuration. Replace
both placeholders only with reviewed runtime facts. Unsafe keys are discarded:
prefixes ending in `/`, wildcards, traversal, whitespace, query fragments, and
absolute paths never reach R2.

A weekly-only override does not remove the existing
`daily-standup-digest` defaults. Invalid or absent configuration remains
fail-closed with bounded `blocked-no-signal` sections.

## Response semantics

The existing `thoughtseed.routine-context.v1` response gains additive bounded
freshness fields.

- Section `signalState`: `current`, `stale`, `freshness-unknown`, `no-signal`,
  `blocked-no-signal`, or `mixed`.
- Section counts: `exactKeyCount`, `resolvedKeyCount`, `staleKeyCount`, and
  `missingKeyCount`, each capped at eight.
- Optional section `staleAfterSeconds`: the reviewed freshness threshold.
- Item `signalState`: `current`, `stale`, `freshness-unknown`, `missing`, or
  `blocked-no-signal`.
- Resolved items may include only the exact `sourceKey`, R2 `observedAt`
  upload time, derived `ageSeconds`, title, and bounded plain-text summary.
- Missing keys produce one bounded no-signal item and aggregate counts; the
  missing key names are not echoed.
- If either the R2 upload time or freshness threshold is absent, the signal is
  `freshness-unknown`, never implicitly current.

The response continues to declare `omitted.rawObjects=true` and
`omitted.fullVault=true`.

## Safe production inventory and configuration

1. Back up the current Worker version and record whether the
   `CONTEXT_ROUTINE_ALLOWLIST_JSON` binding exists. Do not print its value.
2. From an authorized Cloudflare admin surface, identify the narrowest known
   client-report namespace, then perform a read-only metadata inventory. Record
   only exact key names and uploaded timestamps; do not download object bodies.
3. Review each candidate against its source owner and exclude credentials,
   client PII, raw transcripts, and unconstrained collections.
4. Choose a freshness threshold that matches the source production cadence.
   Do not treat an arbitrary threshold as a runtime fact.
5. Build the JSON locally and configure it without placing the value in shell
   history:

   ```bash
   npx wrangler secret put CONTEXT_ROUTINE_ALLOWLIST_JSON \
     --config workers/quests/wrangler.jsonc
   ```

6. Deploy only the reviewed merged commit. If the exact-key probe fails, restore
   the prior binding state and Worker version before changing any consumer.

## Redacted live probes

Unauthenticated access must stop before R2 and return `401`:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  "$CAMBIUM_QUESTS_BASE_URL/v1/context/routine-snapshot?tenant=cambium&routine=weekly-client-report"
```

The authenticated proof should project metadata only and never write the raw
response to an artifact:

```bash
curl -fsS \
  -H "Authorization: Bearer $CONTEXT_ROUTE_TOKEN" \
  "$CAMBIUM_QUESTS_BASE_URL/v1/context/routine-snapshot?tenant=cambium&routine=weekly-client-report" \
  | jq '{schema,tenant,routine,source,sections:[.sections[]|{id,signalState,exactKeyCount,resolvedKeyCount,staleKeyCount,missingKeyCount,staleAfterSeconds,items:[.items[]|{signalState,observedAt,ageSeconds,sourceKey}]}],omitted}'
```

Acceptance requires the projected source, key counts, and freshness states to
match the reviewed inventory. Missing objects must be `no-signal`; old objects
must be `stale`; neither state is a production failure if it accurately reports
the source.

Repeat the authenticated `daily-standup-digest` probe and a bounded semantic
recall probe after deployment. Their schemas and status codes must remain
unchanged.
