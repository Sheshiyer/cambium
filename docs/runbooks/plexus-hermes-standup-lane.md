# Plexus → Cambium → Hermes standup lane

Status: production-proven on 2026-07-27. Tracking issue: `cambium#270`.

## Intent and authority

This lane turns authenticated Plexus work evidence into founder-visible daily
standups without giving Plexus Telegram credentials or unattended publication
authority.

1. Plexus suggests `app.generateStandup` when current work lacks evidence.
2. After evidence exists, Plexus suggests the confirm-required
   `daily.sendEvent` transition.
3. Founder confirmation persists a deterministic member/date outbox row before
   bridge I/O. Explicit retry reuses the same event ID.
4. Cambium validates the signed bridge envelope and projects the allowlisted
   `daily_agent_event` fields into KV.
5. Hermes reads the member-scoped projection, writes a signed managed vault
   file, and delivers its two routine views to Telegram.

Offline generation is supported. Offline publication remains queued or failed
until an explicit founder retry succeeds; startup and timers do not publish.

## Cambium projection contract

- Schema: `cambium.member-standup.v1`
- Key: `standup:{tenant}:{memberId}:{date}`
- Exact-date route:
  `GET /v1/bridge/standups/{tenant}/{memberId}?date=YYYY-MM-DD`
- Recent route: `GET /v1/bridge/standups/{tenant}/{memberId}`
- Recent result bound: 14 dates; project and blocker arrays are bounded.
- Project summaries are normalized, zero-work rows are filtered, active rows
  are ranked, and only then is the eight-project limit applied.
- Anonymous access is `401`. Member credentials are self-only; assignment and
  admin credentials remain tenant-scoped.
- Stored and returned fields exclude credentials and Telegram identifiers.

Re-ingesting the same member/date replaces the projection in place. This is the
recovery mechanism for transient bridge failures and projection fixes.

## Hermes file and delivery contract

Managed files live at:

`standups/standup-<member>-<date>.md`

Real files carry `thoughtseed-standup-state: real`, the source event ID, and a
Hermes owner digest bound to member and date. No-data placeholders are marked
`no-data`.

- `/ts-standup [member] [YYYY-MM-DD]` creates or upgrades a no-data placeholder.
- `/ts-standup [member] [YYYY-MM-DD] --refresh` replaces only an intact,
  Hermes-signed real file.
- Founder-edited, unknown, mismatched, and unsigned legacy real files are
  preserved.
- Auth, transport, route, schema, and identity failures write nothing.
- Writes serialize per path and commit through same-directory atomic replace.

Hosted deliveries:

| Routine | Hermes job | Telegram topic |
| --- | --- | --- |
| `daily-standup-digest` | `thoughtseed-daily-standup-digest` | Digests `798` |
| `plexus-kpi-standup` | `thoughtseed-plexus-kpi-standup` | Agent Ops `802` |

The KPI job is bound to the repo-owned
`thoughtseed-plexus-kpi-standup.sh` wrapper so the shared Python routine cannot
fall back to the daily-digest context.

## Operator verification

Use a real authenticated Plexus session and real work:

1. Generate the daily standup from Plexus and confirm `daily.sendEvent`.
2. Verify the Plexus outbox row is `sent`; an explicit retry must keep the same
   event ID.
3. Read the exact date through the authenticated Cambium route and match
   tenant, member, date, event ID, work seconds, entries, projects, and blockers.
4. In Telegram, run
   `/ts-standup <member> <YYYY-MM-DD> --refresh`.
5. Run `/ts-vault standups/standup-<member>-<YYYY-MM-DD>.md` and verify the
   signed real marker and matching event tuple.
6. Trigger both hosted Hermes jobs and confirm topics `798` and `802` show the
   same latest date and project/blocker facts. Topic `802` must identify
   `Routine snapshot (plexus-kpi-standup)`.

Do not treat a generated local standup, a queued outbox row, a `count:0` route,
or a pre-event scheduled digest as end-to-end proof.

## 2026-07-27 production receipt

- Plexus event: `assistant_daily_20260727_b64_c2hlc2g`, member `shesh`,
  date `2026-07-27`, 7,200 seconds, one entry, evidence pending.
- Cambium Worker version:
  `778e78ec-2e41-424d-b0fe-b47a81429a83`.
- Hermes release: `0b32a368c13bc940aac66c253750a63ccc3935ce`.
- Telegram Digests and Agent Ops both rendered Plexus at 2h with one missing
  proof blocker; Agent Ops used the explicit KPI routine context.
