# Phase 3: Canonical Infinite-Game Anchors - Context

**Gathered:** 2026-08-18 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Create one canonical root `VISION.md` and one renewable root `MISSION.md`, define their lifecycle and authority relationship, distinguish repository Mission from bounded `FabricMission` records, and make the anchors discoverable through references. This phase does not build the intent graph, generated manifest, corpus inventory, destructive reorganization, runtime mutation, or connected-repository overlays.
</domain>

<decisions>
## Implementation Decisions

### Anchor Semantics and Cadence
- **D-01:** Root `VISION.md` is Cambium's enduring Just Cause and near-invariant infinite-game direction. It changes only through an explicit doctrine review, not from ordinary task or milestone evidence.
- **D-02:** Root `MISSION.md` is the renewable current pursuit. It must state a finite horizon, progress evidence, renewal triggers, and explicit retirement or replacement conditions.

### Doctrine and Planning Authority
- **D-03:** `VISION.md` and `MISSION.md` are normative doctrine anchors, not goal-setting or planning engines. ISA owns acceptance and approved goals; GSD owns finite planning state.
- **D-04:** Generated, operational, and inherited surfaces reference the anchors by path and digest. They must not copy doctrine or claim independent authority.

### Mission Terminology Boundary
- **D-05:** “Repository Mission” names the singular renewable doctrine horizon in root `MISSION.md`.
- **D-06:** `FabricMission` remains a bounded, outcome-oriented child record inside one `WorkObject`; D1 Goal Graph owns its operational state and Mission Fabric only projects it.

### Non-Destructive Discoverability
- **D-07:** Phase 3 adds the two anchors to existing root and documentation indexes while leaving older doctrine files in place.
- **D-08:** Overlapping claims in older doctrine are supporting context until Phase 6 inventories and classifies them; they do not compete with the root anchors.

### the agent's Discretion
- Choose concise anchor templates, cross-link wording, and deterministic reference formatting consistent with existing repository Markdown conventions.
- Prefer additive edits to existing indexes and authority tables; avoid speculative schema or runtime work.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` — Phase 3 boundary and success criteria.
- `.planning/REQUIREMENTS.md` — ANCHOR-01 through ANCHOR-04 acceptance contract.
- `.planning/PROJECT.md` — milestone scope, authority decisions, and exclusions.
- `ISA.md` — approved goal and acceptance source of record.
- `PROJECT.md` — repository operating contract and current doctrine map.
- `INFINITE-GAME.md` — source framing for slow vision, renewable mission, finite goals, and learning cadence.
- `ARCHITECTURE.md` — current system authority and integration boundaries.
- `docs/doctrine/README.md` — existing additive doctrine index.
- `docs/README.md` — documentation discovery index.
- `docs/LIFECYCLE.md` — current, derived, evidentiary, and historical document lifecycle rules.
- `docs/architecture/cambium-operating-fabric.md` — Mission Fabric authority and D1 mutation boundary.
- `docs/architecture/contracts/mission-fabric-v1.md` — read-only projection contract.
- `workers/quests/src/mission-fabric.ts` — implemented `FabricMission` record and projection guards.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `INFINITE-GAME.md` already defines the conceptual hierarchy and slow/fast cadence; the anchors should extract and point back to that doctrine rather than duplicate the full treatise.
- `docs/doctrine/README.md` and `docs/README.md` already provide additive discovery surfaces suitable for new anchor links.
- `docs/LIFECYCLE.md` already distinguishes current instructions from evidence and historical plans.

### Established Patterns
- Root Markdown files own durable doctrine; `docs/` provides indexes, contracts, runbooks, and evidence.
- Operational projections are read-only and reject authority-shaped input.
- Historical documents remain recoverable and labeled rather than moved opportunistically.

### Integration Points
- Add root `VISION.md` and `MISSION.md`.
- Update `PROJECT.md`, `docs/doctrine/README.md`, and `docs/README.md` with reference-only discovery links.
- Update the Mission Fabric documentation boundary only where needed to prevent terminology ambiguity; do not change runtime behavior in Phase 3.
</code_context>

<specifics>
## Specific Ideas

- Use the approved root-anchor plus inherited-overlay model.
- Frame Cambium as a fractal tapestry of coordinated finite games serving an enduring Just Cause, not as a single finished product.
- Make mission renewal evidence-driven and explicit, without allowing evidence to rewrite vision automatically.
</specifics>

<deferred>
## Deferred Ideas

- Deterministic intent graph implementation belongs to Phase 4.
- Ralph, GSD next-action, skill-cluster, OmniRoute, and manifest projection belong to Phase 5.
- Full doctrine corpus inventory and disposition mapping belong to Phase 6.
- Duplication, authority, freshness, sensitive-data, and handoff enforcement belong to Phase 7.
- Connected-repository overlays remain a future requirement after Cambium's canonical contract ships.
</deferred>
