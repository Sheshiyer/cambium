# Cambium Operator Policy Contract

Status: v1.4 active
Owner: Cambium operator / Telegram mini app
Runtime source: `bin/operator/quests/operator-policy.ts`

## Purpose

The operator policy is the only source allowed to turn visual engine signals into a next-action recommendation for the Telegram mini app. UI code may render the result, but it must not derive recommendations on its own.

## Required Signals

- Active quest frontier from the pure quest ledger.
- Tenant-scoped stance sample from current-tenant lane history.
- Skill registry tier from real forge telemetry.

## v1 Rule

The policy returns `blocked` until all required signals are present:

- `ledger.current` exists.
- `stance.status` is `ready`.
- At least one skill tier is `reliable` or `production`.

When all are true, the policy may return one conservative action:

`Advance <arc> · <quest title> through <stance label> using <skill id>`

## v1.1 Gate Priority

An evidence-complete gate item outranks the generic frontier action. A gate item is complete only when it carries:

- Evidence.
- Approve and reroll consequences.
- Reversibility.
- Idempotency hint.

When all are present, the policy may return one review-only action:

`Review gate item <id>: <title>`

This is not an approval or reroll instruction. The founder still chooses approve or reroll inside the signed Gate flow.

## v1.2 Gate Queue Scoring

When multiple evidence-complete gate items are present, the policy ranks them deterministically:

- Status urgency: `blocked`/`stuck`/`needs review` before `pending`/`waiting` before `open`/`active`.
- Older `updatedAt` or timestamp evidence before newer items within the same status band.
- Stable id as the final tie-breaker.

Malformed gate items still block the policy instead of being skipped, because skipping them would hide an unsafe handoff.

## v1.3 Gate Risk And Dependency

Gate review recommendations require served `paperclip-priority@v1` fields:

- Risk: `low`, `medium`, `high`, or `critical`.
- Dependency: `none`, `blocked-by-external`, or `blocks-delivery`.
- Optional score and reasons for human audit.

The policy ranks status first, then served dependency/risk, then timestamp and id. Missing risk or dependency blocks the policy instead of falling back to generic frontier work.

## v1.4 Priority Signals

Advanced decision context may influence policy only through `operator-priority-signals@v1`. Visual `decisionContext` rows are not policy authority.

The priority signal contract is complete only when it serves all fields below:

- Founder preference target id, numeric weight, and proof.
- Owner load owner, open item count, capacity, and proof.
- Economic amount, currency, risk, and proof.
- Team availability available count, required count, and proof.
- Member revocation boolean state and proof.
- Cross-tenant urgency score, tenant count, and proof.

If the priority signal object is present but incomplete, the policy blocks. If member revocation is active, the policy blocks. If the signal object is complete and safe, it may add priority ranking and cautions to an already evidence-complete gate review.

## v1.4 Priority Producer

The operator-owned producer is `quine write quests priority-signals`. It reads `.operator/<tenant>.priority-source.json` and may write:

- `.operator/<tenant>.priority-signals.json` when policy-facing priority state is ready or explicitly blocked.
- `.operator/<tenant>.priority-signals.readiness.json` for audit/readiness without policy authority.

The source contract is `operator-priority-source@v1`. It must provide founder preference, owner capacity proof, economic amount/currency/risk, team availability, member revocation, and cross-tenant urgency proof. Owner open-item count and cross-tenant urgency score are derived during the refresh from Paperclip open items and the tenant registry.

The operator capture command is `quine write quests priority-source`. It records a complete `operator-priority-source@v1` document only when every proof-bearing field is present. A partial capture is rejected and does not create a source document. If stale `.priority-signals.json` authority already exists, a rejected capture overwrites it with a blocked packet.

The read-only inspection command is `quine write quests priority-audit`. It reports source existence, signal existence, readiness existence, missing fields, current signal status, and whether a refresh would write or block `.priority-signals.json`. It must not write source, signal, or readiness files.

The scaffold command is `quine write quests priority-template`. By default it prints a non-authoritative `operator-priority-source-template@v1` wrapper. With `--write-template`, it writes `.operator/<tenant>.priority-source.template.json`. This file is never consumed by policy. The inner `sourceDocument` must be copied/reviewed into `.priority-source.json` only after every placeholder is replaced with real proof.

If no source document exists and no prior policy file exists, the producer skips policy authority and writes readiness only. If a prior policy file exists or the source document is incomplete, the producer overwrites `.priority-signals.json` with a blocked `operator-priority-signals@v1` packet so stale complete signals cannot keep ranking policy.

## Guardrails

- No recommendation may be shown from sparse stance samples.
- No recommendation may be shown from missing skill registry data.
- `unproven`, `learning`, and `declining` skills are not routable.
- Reliable skills may be used in a recommendation, but production promotion remains a separate founder-approval policy.
- Malformed gate items block policy instead of being ignored.
- Incomplete `operator-priority-signals@v1` blocks policy instead of falling back to visual context.
- Missing `operator-priority-source@v1` must not fabricate a priority signal file.
- Partial `priority-source` capture must not create or preserve policy authority.
- `priority-audit` must remain read-only and must not create readiness or signal files.
- `priority-template` may write only `.priority-source.template.json`; templates must never be consumed as authority.
- The producer may overwrite stale priority authority with a blocked packet when source evidence becomes incomplete.
- Active member revocation blocks policy until access state is reviewed.
- Telegram UI must show `POLICY GAP` or equivalent blocked state when policy status is not `ready`.

## Open Edge Cases

- Priority-signal v1 currently influences gate review ranking only; it does not create standalone recommendations.
- Multiple reliable skills use a deterministic rank: `production` before `reliable`, then larger sample size, then id.
- Social/team availability must arrive through `operator-priority-signals@v1`; generic social rows are still not policy authority.
- The producer and explicit capture command exist, but the repo still needs real source facts or upstream system wiring for founder preference, capacity, economic amount, availability, and revocation.
- Mira relationship state is not part of v1.4.
- Live Telegram WebView proof still requires real `initData` and device access.
