---
phase: 04-provenance-preserving-intent-graph
verified: 2026-08-18T05:49:05Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Evidence and learning transitions remain read-only and cannot enter or mutate the D1 Goal Graph authority lane."
    status: failed
    reason: "The Phase 4 compiler rejects projection foldback into itself, but the actual D1 authoritative-input guard accepts both valid and malformed cambium.intent-graph-projection.v1 objects. The documented D1 rejection boundary is therefore not implemented or wired."
    artifacts:
      - path: "workers/quests/src/goal-graph/projection-contract.ts"
        issue: "isGoalGraphProjection recognizes Goal Graph markers only; validateAuthoritativeInput returns accepted:true for intent-graph projections."
      - path: "scripts/intent-graph.test.mjs"
        issue: "The foldback test invokes compileIntentGraph, not the D1 validateAuthoritativeInput boundary named by the documentation."
      - path: "docs/architecture/contracts/intent-graph-v1.md"
        issue: "Lines 74-78 claim both projection identities are rejected as fresh authority, contradicting executable D1 behavior."
      - path: "docs/architecture/goal-graph-operating-model.md"
        issue: "Lines 48-52 claim valid and malformed intent projections cannot enter D1's command lane, but the D1 validator accepts them."
    missing:
      - "Teach the actual D1 authoritative-input guard to classify cambium.intent-graph-projection.v1 and malformed intent-projection-shaped values as derived projections."
      - "Add D1-side tests proving valid and malformed intent projections are rejected while unrelated commands remain accepted."
      - "Wire the shared authoritative-input assertion at the D1 command/CAS ingestion boundary, or narrow the documentation and phase contract to the boundary that is actually enforced."
---

# Phase 4: Provenance-Preserving Intent Graph Verification Report

**Phase Goal:** Operators can inspect a deterministic intent graph whose references preserve authority from enduring purpose through verified learning.
**Verified:** 2026-08-18T05:49:05Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

The five Roadmap success criteria were merged with all three PLAN frontmatter contracts. PLAN detail adds required implementation and authority-boundary behavior; it does not reduce the Roadmap contract.

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Stable node/edge semantics map Vision → renewable Mission → finite goals → tasks → evidence → learning. | ✓ VERIFIED | `scripts/intent-graph.mjs:5-55,378-410,499-568` defines closed vocabularies, content-addressed IDs, sorted output, and canonical digests. Independent focused execution passed 22/22; `--json` produced schema `cambium.intent-graph-projection.v1`, 19 nodes, 25 edges, all 8 node kinds, and all 10 edge kinds. |
| 2 | Every graph node exposes safe source path, source authority, lifecycle, selector, and canonical content digest; committed readbacks derive from one current source model. | ✓ VERIFIED | `scripts/intent-graph.mjs:143-305,434-461,571-600` enforces contained repository paths, exact selectors, closed authority/lifecycle pairs, SHA-256 digests, sorted IDs, and digest parity. Double `--check` passed. JSON equals fresh `--json`; Markdown contains schema, both digests, all 19 node IDs, and all 25 edge IDs. |
| 3 | Overlays reference canonical root anchors and cannot become independent Vision or Repository Mission authorities. | ✓ VERIFIED | `scripts/intent-graph.mjs:413-460,491-496` limits overlay anchors to digest-current `VISION.md`/`MISSION.md`, requires `derived_reference`, and binds reference edges. Generated overlays for `PROJECT.md` and `.planning/PROJECT.md` carry both whole-anchor digests and no copied body. Focused adversarial tests pass. |
| 4 | Evidence and learning close/renew finite goals without anchor mutation, projection foldback, or D1 authority-lane admission. | ✗ FAILED | Anchor bytes are unchanged and compiler-local foldback tests pass, but D1's executable guard does not recognize the intent schema. `validateAuthoritativeInput({schema:'cambium.intent-graph-projection.v1', ...})` returned `accepted:true` for both valid-shaped and malformed intent projections. The docs' stronger D1 claim is false and the key link is not wired. |
| 5 | Approval, freshness, stop, blocked, and completion states are explicit; blocked work is never represented complete. | ✓ VERIFIED | `scripts/intent-graph.mjs:308-368` validates every state and rejects blocked/satisfied, required/satisfied, stale/satisfied, and denied/satisfied contradictions. Generated gate is `blocked`, approval `required`, freshness `fresh`, approval stop unsatisfied, with a non-empty reason. Direct parity found zero blocked-as-satisfied nodes. |

**Score:** 4/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/intent-graph.mjs` | Pure compiler, validator, renderer | ✓ VERIFIED | 648 substantive lines; exports `INTENT_GRAPH_SCHEMA`, `compileIntentGraph`, `validateIntentGraphProjection`, and `renderIntentGraphMarkdown`; imported by generator and both focused suites. |
| `scripts/intent-graph.test.mjs` | Adversarial GRAPH-01..05 contract | ✓ VERIFIED | 505 substantive lines; 12 focused compiler tests pass. Its D1 claim is incomplete because it tests compiler input, not the D1 guard. |
| `docs/architecture/contracts/intent-graph-v1.md` | Human read-only projection contract | ⚠ PARTIAL | Substantive and discoverable. Its D1 rejection statement is contradicted by executable D1 behavior. |
| `scripts/intent-graph-sources.mjs` | Single repository source model | ✓ VERIFIED | 274 substantive lines; generator imports `buildIntentGraphSources`; source model yields 19 nodes and 25 edges with one explicit authority registry. |
| `scripts/generate-intent-graph.mjs` | Deterministic `--write`, `--check`, `--json` CLI | ✓ VERIFIED | 164 substantive lines; compiles once, derives JSON and Markdown from the same object, checks bytes without writing, and confines atomic writes to repository root. |
| `scripts/generate-intent-graph.test.mjs` | End-to-end source, stale, privacy, parity checks | ✓ VERIFIED | 253 substantive lines; 10 generator tests pass, including real repository freshness. |
| `docs/architecture/intent-graph.v1.json` | Machine readback | ✓ VERIFIED | Valid 742-line JSON; read-only schema, 19 nodes, 25 edges, matching graph/source-set digests. |
| `docs/architecture/intent-graph.md` | Human readback | ✓ VERIFIED | Generated 76-line Markdown; contains schema, both digests, all node/edge IDs and state facts. |
| `docs/architecture/README.md` | Primary architecture discovery | ✓ VERIFIED | Links JSON, Markdown, contract, source declaration, generator, and exact read-only check. |
| `docs/README.md` | Top-level discovery | ✓ VERIFIED | Labels the graph generated, read-only, and non-authoritative and links all required surfaces. |
| `docs/architecture/loops-to-graphs.md` | Intent/D1 distinction | ✓ VERIFIED | Names distinct read-projection and operational-writer roles without copying generated tables. |
| `docs/architecture/goal-graph-operating-model.md` | D1 sole-writer contract | ⚠ PARTIAL | D1 remains documented as sole writer, but its new claim that intent projections are rejected is not executable truth. |
| `ISA.md` | Phase 4 5/5 acceptance evidence | ✓ VERIFIED | `phase: verify`, `progress: 5/5`; exactly ISC-1277..1281 changed unchecked→checked relative to `origin/main`; 1,153 historical checked criteria remain checked. |
| `.project/HANDOFF.md` | Bounded continuation receipt | ✓ VERIFIED | Records exact digests, write boundary, test evidence, held external state, and `/gsd:verify-work 4`. |

`gsd-sdk query verify.artifacts` passed all 14 plan-declared artifacts (3/3, 5/5, 6/6). Existence was then checked for substance, usage, and data flow rather than accepted alone.

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `scripts/intent-graph.test.mjs` | `scripts/intent-graph.mjs` | Public compiler/validator/renderer imports | ✓ WIRED | Focused suite directly imports and invokes exported behavior. |
| `scripts/intent-graph.mjs` | repository sources | Safe resolution + digest checking | ✓ WIRED | `resolveSelection` reads exact selected content and rejects missing, escaped, ambiguous, or digest-drifted sources. |
| `scripts/intent-graph.mjs` | D1 projection contract | Projection-shaped authoritative-input rejection | ✗ NOT WIRED | No import/call into the D1 guard. Compiler-local rejection is not D1 rejection; D1 accepted both intent probes. |
| `scripts/intent-graph-sources.mjs` | `VISION.md`, `MISSION.md`, Phase 3 verification, ISA, GSD plans | Closed source declarations | ✓ WIRED | Every declaration is compiled and represented in generated JSON. |
| `scripts/generate-intent-graph.mjs` | compiler + source model | One compile, two renderings | ✓ WIRED | Lines 134-137 compile once and derive JSON and Markdown from the same graph object. |
| `docs/architecture/intent-graph.md` | `docs/architecture/intent-graph.v1.json` | Matching schema/digests/IDs/state facts | ✓ WIRED | Manual parity passed. The SDK's single false negative was case-sensitive pattern matching (`graph digest` vs `Graph digest`), not a semantic mismatch. |
| Discovery docs | generated readbacks + contract + generator | Direct repository links | ✓ WIRED | All declared targets exist and links are present. |
| `ISA.md` | focused tests + generator check | Exact verification commands | ✓ WIRED | ISA names both focused test path and `generate-intent-graph.mjs --check`. |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `docs/architecture/intent-graph.v1.json` | Nodes, edges, provenance, state | `buildIntentGraphSources(repositoryRoot)` → `compileIntentGraph` → JSON serialization | Yes — reads 12 exact repository sources and emits 19/25 current graph records | ✓ FLOWING |
| `docs/architecture/intent-graph.md` | Same graph facts | Same compiled object → `renderIntentGraphMarkdown` | Yes — all digests and IDs agree with JSON | ✓ FLOWING |
| D1 authority boundary | Intent projection discriminator | `validateAuthoritativeInput` → `isGoalGraphProjection` | No — intent schema is not classified and is returned as accepted input | ✗ DISCONNECTED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Focused graph/generator contract | `node --test scripts/intent-graph.test.mjs scripts/generate-intent-graph.test.mjs` | 22 tests, 22 pass, 0 fail | ✓ PASS |
| Combined anchor/graph contract | `node --test scripts/infinite-game-anchors.test.mjs scripts/intent-graph.test.mjs scripts/generate-intent-graph.test.mjs` | 27 tests, 27 pass, 0 fail | ✓ PASS |
| Committed source/readback freshness | `node scripts/generate-intent-graph.mjs --check` twice | Both exit 0; no output drift | ✓ PASS |
| JSON CLI | `node scripts/generate-intent-graph.mjs --json` | Parses; read_only, 19 nodes, 25 edges, expected digests | ✓ PASS |
| Public module exports | dynamic import of `scripts/intent-graph.mjs` | compile/validate/render are functions; schema exact | ✓ PASS |
| Full repository suite | `npm test` | 1,808 tests, 1,808 pass, 0 fail | ✓ PASS |
| Drift audit | `npm run drift:audit` | `Drift audit passed.` | ✓ PASS |
| Rendered docs | `npm run render-docs:check` | 6 pages / 91 components in sync | ✓ PASS |
| D1 rejects intent projection | `node --experimental-strip-types -e 'import("./workers/quests/src/goal-graph/projection-contract.ts")…validateAuthoritativeInput…'` | Returned `accepted:true` for valid-shaped and malformed `cambium.intent-graph-projection.v1` objects | ✗ FAIL |
| Existing D1 projection tests | `node --experimental-strip-types --test workers/quests/src/goal-graph/projection-contract.test.ts` | 9/9 pass, but no intent-schema case | ⚠ MISLEADING COVERAGE |

### Probe Execution

No Phase 4 plan or summary declares a `probe-*.sh`, and repository discovery found no applicable conventional probe. Step 7c is **SKIPPED (no declared shell probes)**. The declared executable checks were independently run above.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| GRAPH-01 | 04-01, 04-02, 04-03 | Deterministic graph with stable semantics | ✓ SATISFIED | Closed vocabularies, stable IDs/digests, 19/25 readbacks, focused tests. |
| GRAPH-02 | 04-01, 04-02, 04-03 | Complete source provenance | ✓ SATISFIED | Every node has path/authority/lifecycle/selector/digest; real-source double check and parity pass. |
| GRAPH-03 | 04-01, 04-02, 04-03 | Overlay references only canonical anchors | ✓ SATISFIED | Two overlays, `derived_reference`, exact whole-anchor digests, no copied bodies. |
| GRAPH-04 | 04-01, 04-02, 04-03 | Read-only close/renew without authority mutation | ✗ BLOCKED | Vision/Mission bytes are preserved, but the plan's required D1/foldback authority boundary is not implemented at the D1 guard and the published contract overclaims it. |
| GRAPH-05 | 04-01, 04-02, 04-03 | Explicit gate/freshness/stop/blocked states | ✓ SATISFIED | State vocabulary and contradiction guards pass; generated blocked gate is not complete. |

No Phase 4 requirement is orphaned: all five are declared by all three plans and mapped to Phase 4 in `.planning/REQUIREMENTS.md`.

### ISA and Range Integrity

| Check | Result | Status |
|---|---|---|
| ISA phase/progress | Exact `phase: verify`, `progress: 5/5` | ✓ PASS |
| Checkbox delta | Exactly ISC-1277..1281 changed from unchecked to checked | ✓ PASS |
| Historical checkboxes | Base checked 1,153; head checked 1,158; no other criterion changed | ✓ PASS |
| Root anchors | `git diff --quiet origin/main...HEAD -- VISION.md MISSION.md` | ✓ PASS |
| Allowed range | 20 changed paths, all in bounded Phase 4 allowlist | ✓ PASS |
| Deletes/renames | None | ✓ PASS |
| Diff hygiene | `git diff --check origin/main...HEAD` exit 0 | ✓ PASS |
| Runtime/provider/deploy surfaces | No Worker, D1, package/lock, provider, deployment, Telegram, `.temperance`, or connected-repository path changed | ✓ PASS |
| Added-line privacy | 3,320 added lines; zero machine-local user paths, GitHub/AWS key shapes, private-key markers, or assigned secret/token/password shapes | ✓ PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `workers/quests/src/goal-graph/projection-contract.ts` | 115-155 | Intent projection schema is outside projection classification | 🛑 Blocker | Published D1 rejection boundary is not executable. |
| `scripts/intent-graph.test.mjs` | 471-484 | Test name implies D1 foldback rejection but invokes only the Phase 4 compiler | ⚠ Warning | Full suite stays green while the real D1 guard accepts the input. |
| `.planning/ROADMAP.md` | 83, 94, 106, 118-120 | Existing `TBD` plan counts for later Phases 5-7 | ℹ Deferred | Not introduced by Phase 4 and explicitly belongs to later roadmap phases; not an actionable Phase 4 gap. |

No added `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, placeholder, empty implementation, or hardcoded-empty rendering pattern was found in Phase 4 implementation/generated/documentation additions.

### Disconfirmation Pass

1. **Partially met requirement:** GRAPH-04 preserves root anchor bytes and compiler-local read-only behavior, but does not enforce its D1 authority claim.
2. **Misleading passing test:** `projection foldback rejects both intent and D1 Goal Graph projection-shaped authority input` passes because it feeds both schemas to `compileIntentGraph`; it never exercises `workers/quests/src/goal-graph/projection-contract.ts`.
3. **Uncovered error path:** D1 has no valid or malformed intent-projection case, and `isGoalGraphProjection` accepts neither as a projection marker.

### Human Verification Required

None. This phase produces repository code, CLI output, generated documentation, and authority contracts; all must-haves are mechanically inspectable. No visual, real-time, or external-service behavior is required for the verdict.

### Later-Phase Deferral Check

Phase 5 covers derived next actions/routes, Phase 6 covers documentation stewardship, and Phase 7 covers deterministic authority/freshness/privacy validation. None explicitly says the D1 authoritative-input guard will reject the Phase 4 intent projection, while Phase 4's own plan and published contract claim that behavior now. The gap is therefore **not deferred**.

### Gaps Summary

Phase 4 delivers a substantive, deterministic, source-current read-only graph and preserves root anchor, ISA, GSD, privacy, and bounded-range integrity. One authority link prevents goal achievement: the actual D1 input validator accepts the intent projection that the Phase 4 contract says it rejects. Because this is a must-have key-link failure, the result is `gaps_found` despite 1,808/1,808 passing tests.

The minimal closure is to add a shared or D1-side intent-projection discriminator, cover valid and malformed markers, and prove the guard is called at the authoritative D1 ingestion seam. If Phase 4 intentionally forbids runtime/D1 changes, the alternative is to narrow the contract and documentation so they claim only compiler-local non-writing behavior; that deviation requires an explicit owner-approved override because it weakens a plan must-have.

---

_Verified: 2026-08-18T05:49:05Z_
_Verifier: gsd-verifier_
