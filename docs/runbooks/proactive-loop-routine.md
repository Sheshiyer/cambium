# Proactive loop routine (Fitcheck L4 + quest templates)

Status: implemented locally; production Telegram delivery is **Hermes-owned**.

## What runs

| Step | Owner | Writes D1? | Sends Telegram? |
|---|---|---|---|
| Compile Fitcheck L4 loops + quest templates | Cambium pure pack | No | No |
| Store Mini App projection + pending deliveries | Worker KV (`QUESTS`) | No | No |
| Cloudflare cron `0 */6 * * *` | Worker `scheduled` | No | No |
| Post to Thoughtseed topics | **Hermes** | No | **Yes** |
| Founder Gate / CAS admission | Mini App Gate + D1 | **Yes (only after Gate)** | n/a |

## Topics (Thoughtseed Labs `-1002691202808`)

| Stage class | Topic | Thread |
|---|---|---:|
| identity / systems / planned | Dev | 862 |
| mapping / D1 / pin | Agent Ops | 802 |
| executed | Hermes | 797 |
| learned | Digests | 798 |
| failed probes | Alerts | 803 |

## API

```bash
# Compile + store (cron or Hermes)
POST /v1/bridge/proactive-loop-tick
Authorization: Bearer $BRIDGE_TOKEN|$HERMES_ASSIGNMENT_TOKEN

# Mini App / Workbench
GET /v1/bridge/proactive-loop/projection?tenantId=cambium

# Hermes pull + claim
GET  /v1/bridge/proactive-loop/pending-deliveries
POST /v1/bridge/proactive-loop/claim-deliveries  { "deliveryIds": ["pld_…"] }

# Then for each delivery:
POST /v1/bridge/topic-assignment  # body = deliveries[].topicAssignment
# Hermes posts deliveries[].messageText to the topic thread
```

## Local CLI

```bash
node scripts/proactive-loop-tick.mjs
node scripts/proactive-loop-tick.mjs --json
CAMBIUM_BRIDGE_URL=… BRIDGE_TOKEN=… node scripts/proactive-loop-tick.mjs --post
```

## Hermes consumer (production Telegram)

Lives in `hermes-aws-ts` (not this repo):

```bash
# Dry-run pull
HERMES_CAMBIUM_BRIDGE_URL=https://curious.thoughtseed.space \
HERMES_CAMBIUM_BRIDGE_TOKEN=… \
node scripts/proactive-loop-deliver.mjs --json

# Founder operational clearance (no D1 CAS; quiets held probes)
node scripts/proactive-loop-deliver.mjs --founder-approve --json

# Live: tick → sendMessage → topic-assignment → claim
node scripts/proactive-loop-deliver.mjs --tick --send --json
```

Notify **cooldown** is 18h per `stage:exit:topic` after Hermes claim.
Founder approval is KV-only operational clearance — **not** Goal Graph CAS.

EC2: `ops/ec2/hermes-proactive-loop.timer` (every 6h at :15) +
`docs/runbooks/proactive-loop-deliver.md`.

## Deploy (Worker cron)

```bash
# account must match production (see docs/evidence/*-deploy.json)
export CLOUDFLARE_ACCOUNT_ID=9d9d23b27f32e70ae3afb6a1aa2c0f10
cd workers/quests
wrangler deploy --config wrangler.jsonc --dry-run
wrangler deploy --config wrangler.jsonc
```

Cron trigger: `0 */6 * * *` in `wrangler.jsonc` → `index.ts` `scheduled`.

## Mini App

HTML boot injects `globalThis.__CAMBIUM_PROACTIVE_LOOP__` so the Fitcheck
operational packet strip shows pass/held/fail and next founder action.
Authority line remains: **projection only · not D1 admission**.

## Implementation

- `shared/proactive-loop-routine.ts`
- `shared/fitcheck-loop-pack.ts`
- `shared/quest-graph-templates.ts`
- `workers/quests/src/proactive-loop-runtime.ts`
- routes in `workers/quests/src/handler.ts`
- cron in `workers/quests/wrangler.jsonc` + `index.ts` `scheduled`
