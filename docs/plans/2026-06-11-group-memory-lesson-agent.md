# The Group as Memory + the daily Lesson-Miner agent

> Status: SPEC + local lesson mint primitive (founder chose spec-first, 2026-06-11;
> `quine write lessons mint` added 2026-06-18). Companion to the curios.self
> miniapp wing ([2026-06-10-thalia-wing-quest-miniapp.md](./2026-06-10-thalia-wing-quest-miniapp.md))
> and the skill forge (M4) / quest arc XVII "The Garden" (lessons minted · project archived).

## Why

The founders run two Telegram surfaces with different jobs:

- **Private DM with the bot** (`@thoughtseed_bot`, "curious.self", id `1571615655`):
  each founder, 1:1 — has the **Quest Log miniapp** menu button (shipped), runs
  `/ts-*` commands, approves gates. This is the *control* surface.
- **The founder group**: shared, ambient, conversational — where ideas, decisions,
  blockers, links, and "we keep doing X by hand" complaints land. This is **memory**:
  raw operating signal that today evaporates.

Nothing currently *harvests* the group. The vision: keep both wired, let founders
`@`-mention the bot in the group to deliberately **pick up content**, and run **one
agent, once a day**, that reads the group, finds the **repeatable processes** and
**self-healing opportunities** hiding in the chatter, and mints them as **lessons**
into the forge — closing the arc XVII loop with real operating experience, not just
shipped-code evidence.

## Topology (keep BOTH wired)

```
Founder ──DM──▶ @thoughtseed_bot ──▶ miniapp menu (Quest Log) + /ts-* + gate    [control]
Founders ──▶ GROUP (shared memory) ──@bot──▶ pickup queue                        [memory, deliberate]
                       │
                       └── (passive daily read) ──▶ Lesson-Miner ──▶ forge lessons + repeatable-process candidates
```

- **Two ingestion modes into memory:**
  1. **Deliberate (`@bot`):** a founder `@thoughtseed_bot <content>` (or replies to a
     message with `@bot save`) → that message is captured to the **pickup queue** with
     attribution + timestamp + thread link. High-signal, founder-curated.
  2. **Ambient (daily read):** the Lesson-Miner reads the last 24h of group messages
     (whole conversation) to find patterns no one explicitly flagged.
- **Hermes stays the sole external channel** (vault CLAUDE.md, Bridge D). The miniapp
  and this agent attach to the existing bot; no new bot identity, no new command path
  beyond one namespaced `/ts-*` verb if a manual trigger is wanted.

## The Lesson-Miner agent

**Cadence:** once daily (launchd `ai.hermes.lesson-miner`, e.g. 23:30 local), plus an
on-demand `/ts-lessons` trigger in the DM for ad-hoc runs.

**Inputs:**
- The day's group messages (Telegram `getUpdates`/history via the bot, or the Hermes
  poller's message log — Hermes already long-polls the group).
- The pickup queue (`@bot`-curated items) since the last run.
- Existing forge registry (so it doesn't re-mint a lesson already known) and the
  current quest ledger (to attach lessons to the active arc).

**Process (the mining):**
1. **Cluster** the day's signal into topics (decisions, blockers, fixes, links, asks).
2. **Detect repeatable processes** — a manual action described/requested **≥2×**
   (across the day or vs. prior lessons): "we exported the feed by hand again",
   "re-ran the deploy because X". Candidate = `{trigger, manual_steps, frequency, cost}`.
3. **Detect self-healing opportunities** — a recurring *failure + workaround* pair:
   "the worker 302'd, used the local one instead" → candidate auto-remediation.
4. **Mint lessons** — each surviving candidate becomes a LESSON record:
   `{id, title, kind: repeatable|self-heal, evidence: [msg links], proposed_automation,
   arc, minted_at, status: proposed}`. Written via the existing forge verb
   (`quine write skills record …` / a new `quine write lessons mint`), so it shows in
   the miniapp's forge/skill panels and feeds arc XVII.
5. **Propose, don't auto-execute** — a self-healing candidate is *proposed* to the
   founder gate (the W4 one-write flow), never run unattended. Approve → it becomes a
   routine/skill; reroll → discarded with reason (which itself is a lesson).

**Outputs:**
- Lessons in the forge (visible in the miniapp).
- A daily digest posted to the DM (not the group): "3 repeatable processes, 1 self-heal
  candidate — review in the gate."
- Approved self-heals become **routines** (paperclip routine / skill-cluster spoke).

## Honest gaps & decisions needed (resolve before build)

| # | Gap | Decision needed |
|---|---|---|
| G1 | **Which group is "the founder group"?** Telegram resolves `-1003698657291` (vault CLAUDE.md) to **"Klear Karma Central"**, and `@thoughtseed_bot` is **not** a member of it. The real Thoughtseed founder group ID + bot membership must be confirmed (`getUpdates` after a message). | Founder confirms the correct group chat_id and adds `@thoughtseed_bot` to it. |
| G2 | **Message access:** bots only receive group messages if **privacy mode is OFF** (BotFather `/setprivacy → Disable`) or they're admin. Today the bot has zero group wiring. | Disable privacy mode (or admin the bot) so the daily read sees all messages. |
| G3 | **Where the miner runs:** a Hermes skill (lives on the event bus, reads the poller log) vs. a cambium operator agent (launchd cron calling an LLM) vs. a paperclip agent. The plan's reuse rule: prefer the Hermes poller's existing message stream over a second reader. | Pick the host; default recommendation: Hermes skill reading the existing poller log + a cambium `quine write lessons` verb for minting. |
| G4 | **LLM for the mining:** clustering + pattern detection wants a model. Per memory, Thoughtseed model calls go through **MultiCA / NVIDIA NIM / Kimi**, not OpenRouter. | Confirm the model + that MultiCA gateway serves it. |
| G5 | **Privacy:** the group may contain sensitive founder talk; lessons (with message links) surface in the miniapp. | Confirm lessons are founder-only (the miniapp is already founder-gated) and that no raw message text leaks beyond the gate. |
| G6 | **Dedup / noise:** day-to-day chatter will produce weak candidates. | Threshold (≥2 occurrences) + a "confidence" score + the gate as the human filter. Start strict, loosen with feedback. |

## Waves

| Wave | Work | Notes |
|---|---|---|
| L0 | Confirm the founder group (G1) + privacy mode (G2); add the bot; one-time `getUpdates` smoke test | governance + BotFather |
| L1 | `@bot` pickup: Hermes handler captures `@thoughtseed_bot`-mentioned / replied messages to a pickup queue (JSON, like the gate queue) | reuse the gate-consumer queue pattern |
| L2 | Daily read: Hermes skill reads the last 24h from the poller log + pickup queue | reuse poller stream (no second reader) |
| L3 | The miner: cluster → detect repeatable/self-heal → mint lessons (`quine write lessons mint`) → daily DM digest | `quine write lessons mint` exists as the local proposed-lesson ledger; MultiCA model (G4) and strict thresholds (G6) still gate the mining agent |
| L4 | Lessons in the miniapp: a "Lessons" panel (or fold into Story/Gate) reading the forge; self-heal candidates flow to the existing gate | extends the shipped miniapp |
| L5 | Approve → routine: an approved self-heal becomes a paperclip routine / skill spoke | reuse routines + skill forge |

## Implemented groundwork - 2026-06-18

Cambium now has the local lesson mint surface that the future Hermes Lesson-Miner can call:

```sh
npm run quine -- write lessons mint \
  --tenant cambium \
  --title "Archive Paperclip before shutdown" \
  --kind repeatable \
  --summary "the archive-and-receipt ceremony repeats before runtime retirement" \
  --proposed "turn the ceremony into a reusable runbook" \
  --evidence "digest://2026-06-18#paperclip"
```

The command writes a proposed lesson into `.operator/<tenant>.skills.json` using the existing skill forge registry shape, preserves evidence references instead of raw private group text, and feeds `project-evidence@v1.lessonsMinted` for arc XVII. This does **not** wire Telegram group pickup or daily reads; L0-L2 still require the founder group, bot membership/privacy, and Hermes poller decisions above.

## Definition of done

A founder `@`s the bot in the group to save a thought; that night the Lesson-Miner reads
the day, posts a DM digest naming 1–3 real repeatable processes and any self-heal
candidate; each is a lesson in the forge visible in the miniapp; approving a self-heal in
the gate stands up a routine — and the group's daily operating experience compounds into
the org's skills instead of scrolling away.

---

*Reuse note:* this builds almost nothing new — it rides the Hermes poller (message
stream), the gate-consumer queue (pickup + approvals), the skill forge (lesson minting),
the miniapp (surfacing), and launchd (cadence). The new parts are the miner logic (L3)
and a `quine write lessons` verb.
