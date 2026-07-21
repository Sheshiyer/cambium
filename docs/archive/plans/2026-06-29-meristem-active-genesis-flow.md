# Meristem Active Genesis Flow Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Promote the proven Meristem Genesis sidecar from disabled candidate metadata into the active Cambium `genesis` flow.

**Architecture:** Keep Cambium as the stable orchestration wrapper and keep `scripts/meristem-genesis-contract.mjs` as the contract boundary. The active `adapters.genesis` entry runs the Cambium shim from the Cambium checkout, points it at a Meristem checkout through `{input}`, emits `json:brand-dna`, and preserves the old Brandmint command as disabled rollback metadata.

**Tech Stack:** Node ESM, `node:test`, JSON adapter/registry files, `jq`, Cambium `compose run`, Meristem `.brandmint` outputs.

---

## Current State

- `adapters.json` routes active `adapters.genesis` to `brandmint launch --waves 1-8 --brand {tenant}`.
- `candidate_adapters.genesis_meristem_candidate` exists and is disabled.
- `bin/compose.mjs` intentionally loads only `.adapters`, so disabled candidates cannot run through normal `compose run`.
- `scripts/meristem-genesis-contract.mjs` already maps Meristem output into Cambium `brand_system`, `copy_system`, and `visual_system`.
- `bin/meristem-genesis-contract.test.mjs` and `bin/meristem-genesis-adapter.test.mjs` are the focused promotion test surface.

## Target State

- `adapters.genesis` is the Meristem shim command.
- `adapters.genesis.spend` is `none` because the shim maps existing Meristem output and does not run paid generation.
- `adapters.genesis.output` is `json:brand-dna` so `verifyOutput` checks the produced groups.
- `candidate_adapters.genesis_meristem_candidate` is removed.
- Old Brandmint active wiring is preserved as `candidate_adapters.genesis_brandmint_legacy.disabled === true`.
- `registry.json` and docs identify Meristem as the active Genesis implementation.
- `compose run thoughtseed --stage genesis --execute --input /path/to/meristem` spawns the Meristem shim without `--approve genesis`.

## Implementation Notes

- Run this in a dedicated worktree if possible. Current branch work may already contain Meristem hardening changes; do not revert them.
- The active shim should run from the Cambium checkout because the executable file lives in Cambium. Use `local_dir: "cambium"` on `adapters.genesis`.
- The Meristem checkout path should be the Genesis stage input. Default it to `../meristem`; pass `--input /tmp/meristem-sidecar-proof` for proof runs.
- Do not change `composition/pipeline.json` in this promotion unless a test proves the stage contract itself must change.
- Do not make `compose.mjs` load `candidate_adapters`; promotion is explicit JSON movement into `adapters.genesis`.

### Task 1: Baseline and Worktree Guard

**Files:**
- Read: `adapters.json`
- Read: `registry.json`
- Read: `composition/pipeline.json`
- Read: `bin/compose.mjs`
- Read: `bin/lib/invoke.mjs`
- Read: `scripts/meristem-genesis-contract.mjs`
- Test: `bin/meristem-genesis-contract.test.mjs`
- Test: `bin/meristem-genesis-adapter.test.mjs`

**Step 1: Inspect branch cleanliness**

Run:

```bash
git status --short --branch
```

Expected: note any existing modified files. If `scripts/meristem-genesis-contract.mjs` or `bin/meristem-genesis-contract.test.mjs` are already modified, preserve those edits.

**Step 2: Run focused baseline tests**

Run:

```bash
node --test bin/meristem-genesis-contract.test.mjs
node --test bin/meristem-genesis-adapter.test.mjs
```

Expected: both pass before promotion work starts.

**Step 3: Capture the current active adapter invariant**

Run:

```bash
jq -e '.adapters.genesis.cmd == "brandmint" and .candidate_adapters.genesis_meristem_candidate.disabled == true' adapters.json
```

Expected: `true`. This proves the starting state is candidate-only.

**Step 4: Commit only if you created a prep-only worktree artifact**

Run:

```bash
git status --short
```

Expected: no new files from this baseline task. Do not commit unless a separate setup artifact was intentionally created.

### Task 2: Write the Active-Adapter Promotion Test

**Files:**
- Modify: `bin/meristem-genesis-adapter.test.mjs`
- Read: `adapters.json`

**Step 1: Replace the candidate-only test with an active-flow test**

Replace the current test in `bin/meristem-genesis-adapter.test.mjs` with:

```js
test('meristem Genesis adapter is active and brandmint is rollback-only', () => {
  const config = JSON.parse(readFileSync(adaptersFile, 'utf8'));

  const genesis = config.adapters.genesis;
  assert.equal(genesis.root_id, 'genesis');
  assert.equal(genesis.local_dir, 'cambium');
  assert.equal(genesis.cmd, 'node');
  assert.deepEqual(genesis.args, [
    'scripts/meristem-genesis-contract.mjs',
    '--meristem-root',
    '{input}',
    '--brand-dir',
    'brands/thoughtseed',
    '--out',
    '-',
  ]);
  assert.equal(genesis.spend, 'none');
  assert.equal(genesis.input_default, '../meristem');
  assert.equal(genesis.output, 'json:brand-dna');
  assert.deepEqual(genesis.contract_requires, ['idea']);
  assert.deepEqual(genesis.contract_produces, ['brand_system', 'copy_system', 'visual_system']);

  assert.equal(config.candidate_adapters?.genesis_meristem_candidate, undefined);

  const legacy = config.candidate_adapters?.genesis_brandmint_legacy;
  assert.ok(legacy, 'legacy brandmint rollback adapter missing');
  assert.equal(legacy.disabled, true);
  assert.equal(legacy.cmd, 'brandmint');
  assert.deepEqual(legacy.args, ['launch', '--waves', '1-8', '--brand', '{tenant}']);
});
```

**Step 2: Run the test and verify it fails**

Run:

```bash
node --test bin/meristem-genesis-adapter.test.mjs
```

Expected: FAIL because `adapters.genesis.cmd` is still `brandmint` and `genesis_brandmint_legacy` does not exist yet.

**Step 3: Commit the failing test**

Run:

```bash
git add bin/meristem-genesis-adapter.test.mjs
git commit -m "test: expect meristem as active genesis adapter"
```

Expected: commit succeeds with only the test change.

### Task 3: Promote Meristem in `adapters.json`

**Files:**
- Modify: `adapters.json`
- Test: `bin/meristem-genesis-adapter.test.mjs`

**Step 1: Replace active `adapters.genesis` with Meristem**

Set the active `genesis` adapter to:

```json
"genesis": {
  "root_id": "genesis",
  "local_dir": "cambium",
  "cmd": "node",
  "args": [
    "scripts/meristem-genesis-contract.mjs",
    "--meristem-root",
    "{input}",
    "--brand-dir",
    "brands/thoughtseed",
    "--out",
    "-"
  ],
  "spend": "none",
  "spend_reason": "maps existing Meristem brand outputs into the Cambium Genesis contract; does not run paid generation",
  "input_default": "../meristem",
  "output": "json:brand-dna",
  "contract_requires": [
    "idea"
  ],
  "contract_produces": [
    "brand_system",
    "copy_system",
    "visual_system"
  ],
  "contract_version": "1.0.0",
  "note": "Active Genesis flow: runs the Cambium Meristem contract shim from the Cambium checkout. The Meristem checkout path is the stage input and defaults to ../meristem."
}
```

**Step 2: Replace the Meristem candidate with Brandmint rollback metadata**

Remove `candidate_adapters.genesis_meristem_candidate`.

Add:

```json
"candidate_adapters": {
  "genesis_brandmint_legacy": {
    "disabled": true,
    "root_id": "genesis",
    "cmd": "brandmint",
    "args": [
      "launch",
      "--waves",
      "1-8",
      "--brand",
      "{tenant}"
    ],
    "spend": "gated",
    "spend_reason": "legacy Brandmint Genesis path retained only for rollback after Meristem promotion",
    "input_default": "brand-config.yaml",
    "output": "brand-dna",
    "contract_requires": [
      "idea"
    ],
    "contract_produces": [
      "brand_system",
      "copy_system",
      "visual_system"
    ],
    "contract_version": "1.0.0",
    "note": "Disabled rollback-only Genesis adapter. Do not route compose run through this unless a separate rollback plan promotes it."
  }
}
```

**Step 3: Run the adapter test**

Run:

```bash
node --test bin/meristem-genesis-adapter.test.mjs
```

Expected: PASS.

**Step 4: Run JSON validation**

Run:

```bash
node -e "JSON.parse(require('node:fs').readFileSync('adapters.json','utf8')); console.log('adapters.json valid')"
jq -e '.adapters.genesis.cmd == "node" and .adapters.genesis.output == "json:brand-dna" and (.candidate_adapters.genesis_meristem_candidate | not) and .candidate_adapters.genesis_brandmint_legacy.disabled == true' adapters.json
```

Expected: `adapters.json valid`, then `true`.

**Step 5: Commit**

Run:

```bash
git add adapters.json bin/meristem-genesis-adapter.test.mjs
git commit -m "feat: promote meristem to active genesis adapter"
```

Expected: commit succeeds.

### Task 4: Lock Runtime Invocation and Hand-Off Behavior

**Files:**
- Modify: `bin/invoke.test.mjs`
- Read: `bin/lib/invoke.mjs`
- Read: `adapters.json`

**Step 1: Update the test fixture for active Meristem Genesis**

In `bin/invoke.test.mjs`, update the top-level `registry` and `adapters.genesis` fixture to match the active adapter:

```js
const registry = {
  organs: {
    taste: { repo: 'Sheshiyer/skill-clusters' },
    genesis: { repo: 'Sheshiyer/meristem' },
  },
};

const adapters = {
  taste: {
    root_id: 'taste',
    cmd: 'node',
    args: ['taste/scripts/taste-resolve.mjs', '{input}', '--brand', '{tenant}', '--json'],
    spend: 'gated',
    input_default: 'brand system',
  },
  genesis: {
    root_id: 'genesis',
    local_dir: 'cambium',
    cmd: 'node',
    args: [
      'scripts/meristem-genesis-contract.mjs',
      '--meristem-root',
      '{input}',
      '--brand-dir',
      'brands/thoughtseed',
      '--out',
      '-',
    ],
    spend: 'none',
    input_default: '../meristem',
    output: 'json:brand-dna',
    contract_produces: ['brand_system', 'copy_system', 'visual_system'],
  },
};
```

**Step 2: Replace the old Brandmint invocation test**

Replace `buildInvocation builds the genesis waves command` with:

```js
test('buildInvocation builds the active Meristem genesis shim command', () => {
  const inv = buildInvocation(adapters.genesis, {
    tenant: 'thoughtseed',
    input: '/tmp/meristem-sidecar-proof',
    root: '/x/cambium',
  });

  assert.equal(inv.cmd, 'node');
  assert.deepEqual(inv.args, [
    'scripts/meristem-genesis-contract.mjs',
    '--meristem-root',
    '/tmp/meristem-sidecar-proof',
    '--brand-dir',
    'brands/thoughtseed',
    '--out',
    '-',
  ]);
  assert.equal(inv.cwd, '/x/cambium');
  assert.equal(inv.spend, 'none');
});
```

**Step 3: Add root-resolution coverage**

Add near the `resolveRoot` tests:

```js
test('resolveRoot runs active genesis through the Cambium wrapper checkout', () => {
  assert.equal(resolveRoot('genesis', ctx), '/x/cambium');
});
```

**Step 4: Add pipeline proof for no-approval active Genesis**

Add near the hand-off tests:

```js
test('runPipeline executes active Meristem genesis without approval and verifies produced groups', async () => {
  const stages = [
    {
      id: 'genesis',
      organ: 'genesis',
      requires: ['idea'],
      produces: ['brand_system', 'copy_system', 'visual_system'],
    },
  ];

  const runner = () => ({
    status: 0,
    stdout: JSON.stringify({
      brand_system: { brand_name: 'Thoughtseed' },
      copy_system: { copy_slots: { hero_headline: 'Build living systems' } },
      visual_system: { palette: { primary: '#111111' } },
    }),
  });

  const [result] = await runPipeline({
    stages,
    registry,
    adapters,
    cambiumRoot: '/x/cambium',
    tenant: 'thoughtseed',
    execute: true,
    approve: null,
    runner,
    seedInput: '/tmp/meristem-sidecar-proof',
  });

  assert.equal(result.spawned, true);
  assert.equal(result.gate.reason, 'no-spend stage');
  assert.equal(result.contract.ok, true);
  assert.ok(result.invocation.args.includes('/tmp/meristem-sidecar-proof'));
});
```

**Step 5: Run the focused test and verify failures**

Run:

```bash
node --test bin/invoke.test.mjs
```

Expected before implementation alignment: fail if fixture or production adapter assumptions still expect Brandmint.

**Step 6: Make the minimal code change only if tests reveal code drift**

Expected: no production code change in `bin/lib/invoke.mjs` should be required. If `resolveRoot` or `buildInvocation` cannot support this adapter shape, fix only the minimal logic needed and add a test for that exact behavior.

**Step 7: Run the focused test**

Run:

```bash
node --test bin/invoke.test.mjs
```

Expected: PASS.

**Step 8: Commit**

Run:

```bash
git add bin/invoke.test.mjs bin/lib/invoke.mjs
git commit -m "test: prove meristem genesis runtime invocation"
```

Expected: commit includes `bin/lib/invoke.mjs` only if production logic changed.

### Task 5: Update Registry and Contract Documentation

**Files:**
- Modify: `registry.json`
- Modify: `composition/CONTRACTS.md`
- Modify: `INTEGRATION.md`
- Modify: `docs/plans/2026-06-27-meristem-genesis-sidecar-intake.md`
- Test: `bin/compose.test.mjs`

**Step 1: Add a failing registry/docs test**

Add to `bin/compose.test.mjs`:

```js
test('registry identifies Meristem as the active genesis implementation', async () => {
  const registry = JSON.parse(await fs.readFile(join(root, 'registry.json'), 'utf8'));
  const genesis = registry.organs.genesis;

  assert.match(genesis.repo, /meristem/i);
  assert.match(genesis.entrypoint, /meristem-genesis-contract\.mjs/);
  assert.match(genesis.summary, /Meristem/i);
});
```

**Step 2: Run the test and verify it fails**

Run:

```bash
node --test bin/compose.test.mjs
```

Expected: FAIL because `registry.organs.genesis` still references Brandmint.

**Step 3: Update `registry.json`**

Change only `organs.genesis` descriptive fields:

```json
"repo": "Sheshiyer/meristem",
"summary": "Meristem Genesis pipeline mapped into Cambium brand_system, copy_system, and visual_system contracts",
"entrypoint": "node scripts/meristem-genesis-contract.mjs --meristem-root <meristem-root> --brand-dir brands/thoughtseed --out -"
```

Keep `role`, `tier`, `language`, `capabilities`, `contract_requires`, and `contract_produces` aligned with the existing Genesis contract unless a test proves the contract changed.

**Step 4: Update `composition/CONTRACTS.md`**

Change the Genesis section so line meaning becomes:

```md
### 1. `genesis` - Mint the brand · organ: **genesis** (`meristem`) · *free*
- **fulfilled by** Cambium's Meristem contract shim: `node scripts/meristem-genesis-contract.mjs --meristem-root <meristem-root> --brand-dir brands/thoughtseed --out -`.
```

Also add one sentence explaining that the shim currently maps existing Meristem `.brandmint` outputs rather than running paid generation.

**Step 5: Update `INTEGRATION.md`**

Update the I2a row so it says Meristem is active and Brandmint is rollback-only metadata. Preserve the fail-closed spend language for other gated organs.

**Step 6: Update the sidecar intake doc**

In `docs/plans/2026-06-27-meristem-genesis-sidecar-intake.md`, change `Replacement Gate` into `Promotion Follow-up` and record that this plan promotes Meristem through `docs/plans/2026-06-29-meristem-active-genesis-flow.md`.

**Step 7: Run docs/registry tests**

Run:

```bash
node --test bin/compose.test.mjs
npm run validate
```

Expected: `bin/compose.test.mjs` passes and `npm run validate` reports all stages/organs resolve.

**Step 8: Commit**

Run:

```bash
git add registry.json composition/CONTRACTS.md INTEGRATION.md docs/plans/2026-06-27-meristem-genesis-sidecar-intake.md bin/compose.test.mjs
git commit -m "docs: mark meristem as active genesis implementation"
```

Expected: commit succeeds.

### Task 6: Prove the Active `compose run` Flow

**Files:**
- Read: `adapters.json`
- Read: `scripts/meristem-genesis-contract.mjs`
- Create: `/tmp/meristem-active-genesis-output.json`
- Create: `/tmp/meristem-active-genesis-run.txt`

**Step 1: Prepare or refresh the Meristem proof checkout**

Run:

```bash
if [ ! -d /tmp/meristem-sidecar-proof/.git ]; then
  git clone --depth=1 https://github.com/Sheshiyer/meristem.git /tmp/meristem-sidecar-proof
else
  git -C /tmp/meristem-sidecar-proof fetch --depth=1 origin main
  git -C /tmp/meristem-sidecar-proof checkout FETCH_HEAD
fi
git -C /tmp/meristem-sidecar-proof rev-parse HEAD
```

Expected: a Meristem SHA prints. If the SHA differs from `d447fb9c8dd3a5c1c4846f271b20bea6e421ce7f`, record it in the final proof note.

**Step 2: Prove the shim directly**

Run:

```bash
node scripts/meristem-genesis-contract.mjs \
  --meristem-root /tmp/meristem-sidecar-proof \
  --brand-dir brands/thoughtseed \
  --out /tmp/meristem-active-genesis-output.json \
  --evidence-out /tmp/meristem-active-genesis-evidence.json
jq -e '
  (.brand_system.brand_name | strings | length > 0) and
  (.copy_system.copy_slots.hero_headline | strings | length > 0) and
  (.visual_system.palette | type == "object" and length > 0)
' /tmp/meristem-active-genesis-output.json
jq -e '.status == "pass" and .assetManifest.allPathsExist == true' /tmp/meristem-active-genesis-evidence.json
```

Expected: both `jq -e` commands pass.

**Step 3: Prove normal Cambium execution reaches Meristem**

Run:

```bash
node bin/compose.mjs run thoughtseed \
  --stage genesis \
  --execute \
  --input /tmp/meristem-sidecar-proof \
  > /tmp/meristem-active-genesis-run.txt
cat /tmp/meristem-active-genesis-run.txt
```

Expected output includes:

```text
Cambium run - tenant: thoughtseed
genesis
cd <cambium-root> && node scripts/meristem-genesis-contract.mjs --meristem-root /tmp/meristem-sidecar-proof --brand-dir brands/thoughtseed --out -
spawned (exit 0)
1 spawned
```

The exact first line may include mode text; the important facts are the `cd .../cambium`, the `node scripts/meristem-genesis-contract.mjs` command, and `spawned (exit 0)`.

**Step 4: Prove Brandmint is not active**

Run:

```bash
jq -e '.adapters.genesis.cmd == "node" and .candidate_adapters.genesis_brandmint_legacy.disabled == true' adapters.json
rg -n 'brandmint launch --waves 1-8|genesis_meristem_candidate|proof-only' adapters.json bin/meristem-genesis-adapter.test.mjs composition/CONTRACTS.md INTEGRATION.md
```

Expected: `jq` returns `true`. `rg` may find Brandmint only in rollback/history language, not as active `adapters.genesis`.

**Step 5: Commit proof documentation if added**

If you add a durable proof note, create:

```text
docs/evidence/2026-06-29-meristem-active-genesis-flow.md
```

Then commit:

```bash
git add docs/evidence/2026-06-29-meristem-active-genesis-flow.md
git commit -m "docs: add meristem active genesis proof"
```

Expected: commit succeeds if the evidence doc was created. If no evidence doc is created, include the `/tmp` proof outputs in the final handoff instead.

### Task 7: Full Validation and Final Commit

**Files:**
- Read: all modified files from prior tasks

**Step 1: Run focused tests**

Run:

```bash
node --test bin/meristem-genesis-contract.test.mjs
node --test bin/meristem-genesis-adapter.test.mjs
node --test bin/invoke.test.mjs
node --test bin/compose.test.mjs
```

Expected: all pass.

**Step 2: Run repo validation**

Run:

```bash
npm run validate
```

Expected: registry and pipeline resolve.

**Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected: all tests pass. Record the final pass count.

**Step 4: Inspect final active state**

Run:

```bash
jq '.adapters.genesis, .candidate_adapters' adapters.json
node bin/compose.mjs run thoughtseed --stage genesis
```

Expected: `adapters.genesis` is Meristem; dry-run prints the Meristem shim command; Brandmint appears only under disabled rollback metadata.

**Step 5: Commit any remaining files**

Run:

```bash
git status --short
git add adapters.json registry.json composition/CONTRACTS.md INTEGRATION.md docs/plans/2026-06-27-meristem-genesis-sidecar-intake.md bin/meristem-genesis-adapter.test.mjs bin/invoke.test.mjs bin/compose.test.mjs
git commit -m "feat: make meristem the active cambium genesis flow"
```

Expected: commit succeeds if prior task commits did not already capture every file.

## Final Handoff Checklist

- `adapters.genesis.cmd` is `node`.
- `adapters.genesis.args` call `scripts/meristem-genesis-contract.mjs`.
- `adapters.genesis.output` is `json:brand-dna`.
- `candidate_adapters.genesis_meristem_candidate` is absent.
- `candidate_adapters.genesis_brandmint_legacy.disabled` is `true`.
- `registry.organs.genesis.repo` names Meristem.
- `compose run thoughtseed --stage genesis --execute --input /tmp/meristem-sidecar-proof` spawns Meristem and exits `0`.
- `node --test bin/meristem-genesis-contract.test.mjs` passes.
- `node --test bin/meristem-genesis-adapter.test.mjs` passes.
- `node --test bin/invoke.test.mjs` passes.
- `node --test bin/compose.test.mjs` passes.
- `npm run validate` passes.
- `npm test` passes.

## Rollback Plan

If the active Meristem flow fails after promotion:

1. Move `candidate_adapters.genesis_brandmint_legacy` back to `adapters.genesis`.
2. Move the Meristem adapter back under `candidate_adapters.genesis_meristem_candidate` with `"disabled": true`.
3. Revert registry/docs language from active Meristem to proof-only Meristem candidate.
4. Run:

```bash
node --test bin/meristem-genesis-adapter.test.mjs
node --test bin/invoke.test.mjs
npm run validate
npm test
```

5. Commit with:

```bash
git commit -am "revert: restore brandmint as active genesis adapter"
```
