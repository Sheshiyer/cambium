# Capability Alignment Variable Contracts Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Implementation status (2026-06-18):** The documentation + render + reference artifact portions of Tasks 1, 4, 8, 9, and 10 have been completed as part of the Cambium docs upgrade for agent viability (CONTRACTS vocabulary already present; pipeline/registry/adapters already declare groups; added handoff matrix, prompt-ref schema, enriched sample contract, agent sections via meta+render, cross-links, and render test guard). Task 3 is also complete in Cambium: `validateStageContract` fails closed on missing seeded variable groups, the pipeline tracks accumulated contract state, and `compose plan` now surfaces requires/produces/blocking/downstream metadata. Task 5 merged via Skill-clusters PR #112 (`77303439`): taste emits the canonical groups, resolve-task preserves task-level contract hints, and ship-battery can fail closed on a supplied contract pack. Task 6 merged via Brandmint PR #180 (`80d7aa54`): genesis hydration emits a downstream seed pack and Design Memory uses those fields as retrieval anchors. Task 7 merged into the Snow Gloves dispatcher branch via PR #5 (`6f1fce39`): Hermes, Paperclip bridge, and GTM flows preserve and consume the richer contract. Remaining execution work is the end-to-end variable-contract handoff rehearsal after the stacked Cambium branch lands on its target integration branch and Snow Gloves' dispatcher branch is promoted as intended. See the PRD in ~/.claude/MEMORY/WORK/ for the 35 ISC and verification.

**Goal:** Upgrade Cambium and the connected organs so every stage emits and consumes a tracked variable contract that reflects the real downstream design/output capacity, especially for Brandmint, Taste, Paperclip, and whole-site prompt generation.

**Architecture:** Treat Cambium as the canonical contract layer and make it the source of truth for stage handoffs, required variables, and downstream implications. Then update each organ/skill to consume the richer contract instead of flattening outputs into legacy summaries, so upstream strategy, copy, asset planning, prompt assembly, and retrieval all stay aligned to the real implementation and aesthetic pipeline.

**Tech Stack:** Markdown docs, JSON composition contracts, Node-based conductor (`bin/compose.mjs`), Brandmint Python services, `skill-clusters` Node scripts, Snow Gloves Python orchestration, 1024-dim NIM cortex.

---

### Task 1: Define the canonical variable-contract vocabulary in Cambium

**Files:**
- Modify: `composition/CONTRACTS.md`
- Modify: `INTEGRATION.md`
- Modify: `ARCHITECTURE.md`
- Test: `bin/render-docs.test.mjs`

**Step 1: Write the failing test**

Add a doc-level assertion to `bin/render-docs.test.mjs` that checks the contracts doc contains a new “variable contract” section with the required named groups:

```js
test('contracts doc defines the variable contract vocabulary', async () => {
  const text = await fs.readFile('composition/CONTRACTS.md', 'utf8');
  assert.match(text, /Variable contract/i);
  assert.match(text, /brand_system/i);
  assert.match(text, /copy_slots/i);
  assert.match(text, /asset_plan/i);
  assert.match(text, /interaction_plan/i);
  assert.match(text, /acceptance_checks/i);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the docs do not yet define the canonical variable groups.

**Step 3: Write minimal implementation**

Update `composition/CONTRACTS.md` to add a new contract layer below the existing stage I/O tokens:
- `brand_system`
- `copy_system`
- `visual_system`
- `asset_plan`
- `section_plan`
- `interaction_plan`
- `acceptance_checks`

For each group, document:
- what variables belong there
- which stage owns them
- which downstream stages consume them
- which fields are required vs optional
- what happens if required fields are missing

Then update:
- `ARCHITECTURE.md` to state that the composition layer governs not only stage order but also **seeded variables with downstream consequences**
- `INTEGRATION.md` to state that I2/I3/I4 must pass variable contracts, not prose-only outputs

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add composition/CONTRACTS.md INTEGRATION.md ARCHITECTURE.md bin/render-docs.test.mjs
git commit -m "docs: define canonical variable contract vocabulary"
```

### Task 2: Extend the machine-readable pipeline to declare variable handoffs

**Files:**
- Modify: `composition/pipeline.json`
- Modify: `registry.json`
- Modify: `adapters.json`
- Test: `bin/compose.test.mjs`

**Step 1: Write the failing test**

Add a test in `bin/compose.test.mjs` asserting each stage declares a `produces` and `requires` block:

```js
test('pipeline stages declare required and produced variable groups', async () => {
  const pipeline = JSON.parse(await fs.readFile('composition/pipeline.json', 'utf8'));
  for (const stage of pipeline.stages) {
    assert.ok(Array.isArray(stage.requires), `${stage.id} missing requires`);
    assert.ok(Array.isArray(stage.produces), `${stage.id} missing produces`);
  }
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the pipeline currently only declares simple input/output tokens.

**Step 3: Write minimal implementation**

Update `composition/pipeline.json` so each stage declares:
- `requires`
- `produces`
- `blocking`
- `downstream_effects`

Example:
- `genesis` produces `brand_system`, `copy_system`, `brand_docs_seed`
- `taste` requires `brand_system`; produces `visual_system`, `taste_brief`, `aesthetic_constraints`
- `build` requires `brand_system`, `copy_system`, `visual_system`, `asset_plan`, `section_plan`
- `ops` requires `artifact`, `brand_docs`, `proof_strategy`, `distribution_constraints`

Update `registry.json` to add a `capabilities` array per organ, documenting what each organ is expected to understand and output.

Update `adapters.json` so each adapter declares its expected contract surface, e.g.:
- `contract_requires`
- `contract_produces`
- `contract_version`

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add composition/pipeline.json registry.json adapters.json bin/compose.test.mjs
git commit -m "feat: add machine-readable variable handoffs to pipeline"
```

### Task 3: Add fail-closed validation for missing seeded variables

**Files:**
- Modify: `bin/compose.mjs`
- Modify: `bin/lib/invoke.mjs`
- Modify: `bin/invoke.test.mjs`
- Test: `bin/invoke.test.mjs`

**Step 1: Write the failing test**

Add a test to `bin/invoke.test.mjs` that fails when a stage is executed without required variable groups:

```js
test('runStage fails closed when required variable groups are missing', async () => {
  const stage = {
    id: 'build',
    requires: ['brand_system', 'asset_plan'],
    produces: ['artifact']
  };
  await assert.rejects(
    () => runStage({ stage, input: { brand_system: {} } }),
    /missing required variable groups: asset_plan/i
  );
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because no variable-group validation exists yet.

**Step 3: Write minimal implementation**

Implement a pure validation helper in `bin/lib/invoke.mjs`:
- `validateStageContract(stage, payload)`

It should:
- inspect `stage.requires`
- verify each required group exists
- return or throw a clear fail-closed error when groups are missing
- print which upstream stage should have produced the missing group

Thread this validation into `compose run` before adapter execution.

Update `bin/compose.mjs` to surface a human-readable error in dry-run and execute mode.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add bin/compose.mjs bin/lib/invoke.mjs bin/invoke.test.mjs
git commit -m "feat: fail closed on missing seeded variable groups"
```

### Task 4: Define the brand-to-asset and brand-to-section mapping contract for downstream design

**Files:**
- Modify: `composition/CONTRACTS.md`
- Modify: `HOMEOSTASIS.md`
- Create: `examples/sample-variable-contract.json`
- Test: `bin/compose.test.mjs`

**Step 1: Write the failing test**

Add a test asserting the sample contract includes the downstream-sensitive groups:

```js
test('sample variable contract includes brand, copy, asset, and section groups', async () => {
  const sample = JSON.parse(await fs.readFile('examples/sample-variable-contract.json', 'utf8'));
  assert.ok(sample.brand_system);
  assert.ok(sample.copy_system);
  assert.ok(sample.asset_plan);
  assert.ok(sample.section_plan);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the sample file does not exist yet.

**Step 3: Write minimal implementation**

Create `examples/sample-variable-contract.json` showing:
- `brand_system` with archetype, voice, audience, positioning
- `copy_system` with headline, CTA, proof, FAQ tone
- `visual_system` with fonts, palette, motion style, surface treatment
- `asset_plan` with required hero media, section media, logo, UI shots, avatars, posters
- `section_plan` with ordered sections and per-section copy slots and asset dependencies

Update `composition/CONTRACTS.md` to point to this file as the canonical example.

Update `HOMEOSTASIS.md` so the “contract violation” examples explicitly include missing downstream variables like:
- no `hero_media_type`
- no `proof_strategy`
- no `form_validation_rules`

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add composition/CONTRACTS.md HOMEOSTASIS.md examples/sample-variable-contract.json bin/compose.test.mjs
git commit -m "docs: add sample variable contract for downstream design planning"
```

### Task 5: Map the real downstream design/output capacity in skill-clusters

**Files:**
- Modify: `../Skill-clusters/taste/scripts/taste-resolve.mjs`
- Modify: `../Skill-clusters/scripts/resolve-task.mjs`
- Modify: `../Skill-clusters/scripts/ship-battery.mjs`
- Modify: `../Skill-clusters/docs/` (add or update a capability doc near taste/noesis docs)
- Test: `../Skill-clusters/package.json` test target(s)

**Step 1: Write the failing test**

In the relevant `skill-clusters` test file for taste/build routing, add an assertion that the resolver preserves the richer contract instead of flattening it:

```js
test('taste resolve returns visual and asset constraints alongside taste brief', async () => {
  const result = await resolveTaste({ brand_system: { brand_archetype: 'luxury-editorial' } });
  assert.ok(result.taste_brief);
  assert.ok(result.visual_system);
  assert.ok(result.asset_plan);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL in `skill-clusters` because current outputs likely return only a brief/verdict shape.

**Step 3: Write minimal implementation**

Update `taste/scripts/taste-resolve.mjs` so it emits:
- `taste_brief`
- `visual_system`
- `aesthetic_constraints`
- `asset_plan_hints`
- `section_style_hints`

Update `scripts/resolve-task.mjs` so the dispatch plan keeps:
- `scope`
- `section_type`
- `brand_archetype`
- `asset_requirements`
- `copy_slots`

Update `scripts/ship-battery.mjs` so it validates the artifact against the richer contract, not just a minimal “on-brand” string.

Document the supported output capacity in a `skill-clusters/docs/...` capability note.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS in `skill-clusters`

**Step 5: Commit**

```bash
git add ../Skill-clusters/taste/scripts/taste-resolve.mjs ../Skill-clusters/scripts/resolve-task.mjs ../Skill-clusters/scripts/ship-battery.mjs ../Skill-clusters/docs
git commit -m "feat: preserve rich visual and asset contracts in skill-clusters"
```

### Task 6: Upgrade Brandmint outputs so they seed downstream variables deliberately

**Files:**
- Modify: `../brandmint-oracle-aleph/brandmint/core/design_memory.py`
- Modify: `../brandmint-oracle-aleph/brandmint/...` (brand-spec / docs generation entrypoints discovered during implementation)
- Modify: `../brandmint-oracle-aleph/tests/...`
- Test: the relevant Brandmint test module(s)

**Step 1: Write the failing test**

Add a Brandmint test that asserts genesis output includes downstream-seeding fields:

```python
def test_brandmint_outputs_downstream_seed_variables():
    result = generate_brand_system(sample_brand_config())
    assert "brand_archetype" in result["brand_system"]
    assert "copy_system" in result
    assert "visual_primitives" in result
    assert "asset_requirements" in result
```

**Step 2: Run test to verify it fails**

Run: `pytest -q`
Expected: FAIL because Brandmint currently focuses on brand docs and assets, not a formal downstream variable pack.

**Step 3: Write minimal implementation**

Update Brandmint’s brand-spec generation so it emits a structured downstream seed pack:
- `brand_system`
- `copy_system`
- `visual_primitives`
- `asset_requirements`
- `section_defaults`

Update `brandmint/core/design_memory.py` so the design memory worker understands these fields as retrieval anchors instead of only post-hoc memory.

Ensure this output can be serialized alongside the existing `brand-spec.json` / `brand-docs/`.

**Step 4: Run test to verify it passes**

Run: `pytest -q`
Expected: PASS

**Step 5: Commit**

```bash
git add ../brandmint-oracle-aleph/brandmint/core/design_memory.py ../brandmint-oracle-aleph/tests
git commit -m "feat: seed downstream variable contracts from brandmint genesis"
```

### Task 7: Upgrade Paperclip / Snow Gloves orchestration to consume the richer contract

**Files:**
- Modify: `../snow-gloves-os/agents/dispatcher/`
- Modify: `../snow-gloves-os/scripts/lib/gtm.py`
- Modify: `../snow-gloves-os/scripts/gtm_cli.py`
- Modify: `../snow-gloves-os/tests/...`
- Test: the relevant Snow Gloves test suite

**Step 1: Write the failing test**

Add a test that the orchestration layer preserves design-capability variables instead of reducing them to plain briefs:

```python
def test_dispatcher_preserves_visual_and_asset_contract():
    payload = {
        "brand_system": {"brand_archetype": "saas-ai"},
        "visual_system": {"motion_style": "data-driven"},
        "asset_plan": {"required": ["ui_screenshot", "pricing_table"]},
    }
    routed = route_payload(payload)
    assert routed["brand_system"]["brand_archetype"] == "saas-ai"
    assert routed["asset_plan"]["required"] == ["ui_screenshot", "pricing_table"]
```

**Step 2: Run test to verify it fails**

Run: `pytest -q`
Expected: FAIL because routing likely drops these fields today.

**Step 3: Write minimal implementation**

Update the dispatcher/Paperclip-facing orchestration path so it:
- reads the full variable contract
- routes based on `scope`, `section_type`, `brand_archetype`, and `asset_requirements`
- keeps the variable pack attached to task payloads instead of rewriting them into plain-language summaries

Update `scripts/lib/gtm.py` and `scripts/gtm_cli.py` only where necessary so GTM consumes the brand/copy contract without losing the richer brand context.

**Step 4: Run test to verify it passes**

Run: `pytest -q`
Expected: PASS

**Step 5: Commit**

```bash
git add ../snow-gloves-os/agents/dispatcher ../snow-gloves-os/scripts/lib/gtm.py ../snow-gloves-os/scripts/gtm_cli.py ../snow-gloves-os/tests
git commit -m "feat: preserve rich variable contracts in orchestration routing"
```

### Task 8: Add retrieval-ready reference extraction for Taste Cortex / NIM embeddings

**Files:**
- Modify: `examples/sample-variable-contract.json`
- Create: `docs/plans/assets/prompt-reference-schema.json`
- Modify: `composition/CONTRACTS.md`
- Test: `bin/render-docs.test.mjs`

**Step 1: Write the failing test**

Add a test that asserts the docs include retrieval metadata requirements:

```js
test('contracts doc defines retrieval metadata for prompt references', async () => {
  const text = await fs.readFile('composition/CONTRACTS.md', 'utf8');
  assert.match(text, /scope/i);
  assert.match(text, /brand_archetype/i);
  assert.match(text, /motion_style/i);
  assert.match(text, /asset_types/i);
  assert.match(text, /section_types/i);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL if retrieval metadata is still implicit.

**Step 3: Write minimal implementation**

Create `docs/plans/assets/prompt-reference-schema.json` documenting the ingestion shape for prompt references:
- `scope`
- `category`
- `brand_archetype`
- `visual_treatment`
- `motion_style`
- `dependencies`
- `asset_types`
- `section_types`
- `copy_slots`
- `implementation_patterns`

Update `composition/CONTRACTS.md` to declare this as the retrieval surface that Taste Cortex / NIM indexing should use.

Update `examples/sample-variable-contract.json` to include these retrieval fields.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add composition/CONTRACTS.md examples/sample-variable-contract.json docs/plans/assets/prompt-reference-schema.json bin/render-docs.test.mjs
git commit -m "feat: add retrieval schema for taste cortex prompt references"
```

### Task 9: Document the cross-repo handoff matrix explicitly

**Files:**
- Modify: `README.md`
- Modify: `INTEGRATION.md`
- Create: `docs/plans/assets/stage-handoff-matrix.json`
- Test: `bin/render-docs.test.mjs`

**Step 1: Write the failing test**

Add a test asserting the README points readers to a formal handoff matrix:

```js
test('readme links to the stage handoff matrix', async () => {
  const text = await fs.readFile('README.md', 'utf8');
  assert.match(text, /handoff matrix/i);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because there is no formal matrix yet.

**Step 3: Write minimal implementation**

Create `docs/plans/assets/stage-handoff-matrix.json` with rows for:
- stage
- owner organ
- required inputs
- produced outputs
- blocking variables
- downstream consumers
- failure mode if omitted

Update `INTEGRATION.md` to reference it from the I2/I3/I4 work.

Update `README.md` so future readers can find the handoff model quickly.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add README.md INTEGRATION.md docs/plans/assets/stage-handoff-matrix.json bin/render-docs.test.mjs
git commit -m "docs: add cross-repo stage handoff matrix"
```

### Task 10: Validate the plan against the live composition flow

**Files:**
- Modify: `examples/sample-tasks.md`
- Modify: `examples/sample-variable-contract.json`
- Test: `package.json` scripts (`npm test`, `npm run validate`, `npm run plan -- acme`)

**Step 1: Write the failing test**

Add an example-driven test in `bin/compose.test.mjs` that validates the conductor can plan a stage flow using the richer contract metadata:

```js
test('compose plan surfaces variable contract metadata for each stage', async () => {
  const output = await runComposePlan('acme');
  assert.match(output, /brand_system/i);
  assert.match(output, /visual_system/i);
  assert.match(output, /asset_plan/i);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because `compose plan` does not print the richer contract metadata yet.

**Step 3: Write minimal implementation**

Update the compose planning output so each stage prints:
- core contract tokens (`input` / `output`)
- variable groups required/produced
- whether any required groups are still unresolved

Update `examples/sample-tasks.md` and `examples/sample-variable-contract.json` so they can exercise the end-to-end planning view.

**Step 4: Run test to verify it passes**

Run:
- `npm test`
- `npm run validate`
- `npm run plan -- acme`

Expected:
- tests pass
- validate succeeds
- plan output includes variable contract metadata by stage

**Step 5: Commit**

```bash
git add bin/compose.test.mjs examples/sample-tasks.md examples/sample-variable-contract.json
git commit -m "feat: surface variable contracts in compose planning output"
```
