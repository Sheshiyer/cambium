# Group Memory + Lesson-Miner Agent

Status: sanitized standalone spec. The original pilot note described a concrete
messaging setup; this version keeps the product pattern without private channel
identities or deployment details.

## Why

Founder-led teams often have two operating surfaces:

- A direct control channel for approvals, gates, and quest review.
- A shared group channel where decisions, blockers, repeated tasks, and lessons
  appear naturally during work.

The Lesson-Miner turns that shared operating signal into proposed Cambium
lessons without leaking raw private conversation into product surfaces.

## Topology

```text
founder direct channel -> quest miniapp + gate                 [control]
shared team channel -> curated pickup queue + daily digest     [memory]
                              |
                              v
                      Lesson-Miner -> forge lessons + candidates
```

## Ingestion Modes

1. Deliberate pickup: a founder marks a message for capture. The system stores
   a reference, attribution, and timestamp.
2. Ambient digest: a scheduled miner reviews a bounded recent window to detect
   repeated processes and self-healing opportunities.

## Miner Contract

1. Cluster recent signal into decisions, blockers, fixes, links, and asks.
2. Detect repeated manual processes.
3. Detect failure/workaround pairs.
4. Mint proposed lessons through `quine write lessons mint`.
5. Route self-heal candidates through the founder gate; never auto-execute.

## Privacy Rules

- Store evidence references, not raw private group text.
- Keep lessons founder-gated unless an org explicitly publishes them.
- Deduplicate aggressively and start with strict thresholds.
- Treat model/provider choices as adapters configured outside the repo.

## Implemented Groundwork

Cambium has the local lesson mint surface:

```sh
npm run quine -- write lessons mint \
  --tenant demo-org \
  --title "Archive agent plane before shutdown" \
  --kind repeatable \
  --summary "the archive-and-receipt ceremony repeats before runtime retirement" \
  --proposed "turn the ceremony into a reusable runbook" \
  --evidence "digest://example#agent-plane"
```

This writes a proposed lesson into `.operator/<tenant>.skills.json`, preserves
evidence references, and feeds `project-evidence@v1.lessonsMinted` for arc XVII.

## Remaining Work

1. Define the messaging adapter interface.
2. Add a synthetic pickup queue fixture.
3. Build the scheduled miner around bounded inputs.
4. Add a founder-gated Lessons panel or fold lessons into Story/Gate.
