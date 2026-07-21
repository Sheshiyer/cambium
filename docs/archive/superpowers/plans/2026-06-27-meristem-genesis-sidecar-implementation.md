# Meristem Genesis Sidecar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a proof-only Cambium sidecar path that reads `Sheshiyer/meristem` Brandmint outputs and emits Cambium's current Genesis contract without replacing active Genesis.

**Architecture:** Meristem remains an external repository. Cambium gets a small contract shim that maps meristem outputs into `brand_system`, `copy_system`, and `visual_system`, plus an evidence packet and optional disabled adapter metadata. The active `genesis` adapter remains unchanged until a separate replacement plan is approved.

**Tech Stack:** Node ESM, `node:test`, `node:assert/strict`, `jq` for manual JSON probes, Cambium `bin/lib/invoke.mjs` contract validation.

## Global Constraints

- Meristem remains a separate repo.
- Do not copy meristem source into Cambium.
- Do not vendor meristem-generated assets into Cambium.
- Do not replace the active Genesis adapter in this implementation.
- Do not mutate `registry.json` or `composition/pipeline.json`.
- Do not route normal `compose run` calls through meristem.
- The shim must emit top-level `brand_system`, `copy_system`, and `visual_system`.
- The shim must fail closed on missing outputs, invalid JSON, incomplete output status, missing asset paths, or missing Cambium groups.
- Missing meristem `plan` and `resume` commands must remain visible in evidence.

---

## File Structure

- Create `scripts/meristem-genesis-contract.mjs`
  - Reads meristem `.brandmint` outputs, validates required files, builds Cambium Genesis JSON, and optionally writes an evidence JSON file.
- Create `bin/meristem-genesis-contract.test.mjs`
  - Fixture-driven tests for the shim. This location is included by the existing `npm test` glob.
- Create `docs/plans/2026-06-27-meristem-genesis-sidecar-intake.md`
  - Human-readable intake packet with source SHA, runner proof, runner blockers, output inventory, mapping, and proof status.
- Modify `adapters.json`
  - Add disabled candidate metadata under `candidate_adapters.genesis_meristem_candidate`. Do not alter `adapters.genesis`.
- Create `bin/meristem-genesis-adapter.test.mjs`
  - Verifies candidate metadata is disabled and the active Genesis adapter is unchanged.

---

### Task 1: Add Failing Contract Shim Tests

**Files:**
- Create: `bin/meristem-genesis-contract.test.mjs`
- Create later: `scripts/meristem-genesis-contract.mjs`

**Interfaces:**
- Consumes: `buildGenesisContract({ meristemRoot: string, brandDir?: string })`
- Produces: test coverage that later tasks satisfy.

- [ ] **Step 1: Write the failing test**

Create `bin/meristem-genesis-contract.test.mjs` with this content:

```js
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { buildGenesisContract } from '../scripts/meristem-genesis-contract.mjs';

const OUTPUTS = {
  'brand-foundation': { brand_essence: 'coherent system' },
  'buyer-persona': { primary_persona: 'system-carrying founder' },
  'competitor-analysis': { wedge: 'handoff-first studio' },
  'value-proposition': { promise: 'one coherent loop' },
  'product-positioning': { position: 'systems studio' },
  'voice-and-tone': { tone_words: ['clear', 'calm'] },
  'brand-story': { arc: 'requirement to handoff' },
  'messaging-framework': { pillars: ['coherence', 'handoff'] },
  'landing-page-copy': { hero: { headline: 'Digital Wilderness' } },
  'welcome-email-sequence': { emails: 5 },
  'prelaunch-email-sequence': { emails: 4 },
  'launch-email-sequence': { emails: 4 },
  'ad-creative-copy': { variants: 12 },
  'press-release': { title: 'Thoughtseed launches' },
  'product-description': { description: 'systems studio package' },
  'color-palette': { colors: ['#1A237E', '#00897B'] },
  'typography': { display: 'Tyros Pro' },
  'logo-concept': { guidance: 'use existing mark' },
  'visual-language': { theme: 'Digital Wilderness' },
  'lifestyle-photography': { shots: 2 },
  'product-photography': { shots: 2 },
  'hero-images': { shots: 3 },
  'brand-illustrations': { images: 2 },
  'icon-system': { sheet: 'icons-01-sheet.png' },
  'pattern-library': { patterns: 2 },
  'social-media-assets': { assets: 3 }
};

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function createMeristemFixture({ missingOutput, statusOverride, manifestValid = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'meristem-contract-'));
  const brandDir = join(root, 'brands', 'thoughtseed');
  const outputsDir = join(brandDir, '.brandmint', 'outputs');

  for (const [skill, data] of Object.entries(OUTPUTS)) {
    if (skill === missingOutput) continue;
    writeJson(join(outputsDir, `${skill}.json`), {
      skill,
      cluster: 'fixture',
      wave: 1,
      timestamp: '2026-06-27T00:00:00Z',
      status: statusOverride?.skill === skill ? statusOverride.status : 'complete',
      version: '1.0.0',
      data
    });
  }

  writeJson(join(brandDir, '.brandmint', 'asset-manifest.json'), {
    user_provided_assets: [{ id: 'logo-primary', path: './assets/logo.png', exists: true }],
    generated_assets: [{ id: 'hero-image-v1', path: './generated/hero-v1.png', exists: true }],
    validation: {
      all_paths_exist: manifestValid,
      missing_paths: manifestValid ? [] : ['./generated/missing.png'],
      user_count: 1,
      generated_count: 1
    }
  });

  return root;
}

test('buildGenesisContract maps meristem outputs into Cambium Genesis groups', () => {
  const root = createMeristemFixture();
  try {
    const { payload, evidence } = buildGenesisContract({ meristemRoot: root });

    assert.deepEqual(Object.keys(payload), ['brand_system', 'copy_system', 'visual_system']);
    assert.equal(payload.brand_system.foundation.data.brand_essence, 'coherent system');
    assert.equal(payload.copy_system.landing_page.data.hero.headline, 'Digital Wilderness');
    assert.equal(payload.visual_system.asset_manifest.validation.all_paths_exist, true);
    assert.equal(evidence.status, 'pass');
    assert.equal(evidence.requiredGroups.join(','), 'brand_system,copy_system,visual_system');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildGenesisContract fails closed when a required output is missing', () => {
  const root = createMeristemFixture({ missingOutput: 'brand-foundation' });
  try {
    assert.throws(
      () => buildGenesisContract({ meristemRoot: root }),
      /missing required meristem output: brand-foundation\.json/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildGenesisContract fails closed when an output status is incomplete', () => {
  const root = createMeristemFixture({
    statusOverride: { skill: 'voice-and-tone', status: 'partial' }
  });
  try {
    assert.throws(
      () => buildGenesisContract({ meristemRoot: root }),
      /voice-and-tone\.json status is "partial"; expected "complete"/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildGenesisContract fails closed when asset manifest paths are missing', () => {
  const root = createMeristemFixture({ manifestValid: false });
  try {
    assert.throws(
      () => buildGenesisContract({ meristemRoot: root }),
      /asset manifest reports missing paths: \.\/generated\/missing\.png/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test bin/meristem-genesis-contract.test.mjs
```

Expected: FAIL with `Cannot find module` for `scripts/meristem-genesis-contract.mjs`.

- [ ] **Step 3: Commit the failing test**

```bash
git add bin/meristem-genesis-contract.test.mjs
git commit -m "test: define meristem genesis contract proof"
```

---

### Task 2: Implement The Meristem Genesis Contract Shim

**Files:**
- Create: `scripts/meristem-genesis-contract.mjs`
- Test: `bin/meristem-genesis-contract.test.mjs`

**Interfaces:**
- Consumes: meristem repo root and optional brand directory.
- Produces: `buildGenesisContract({ meristemRoot, brandDir })` returning `{ payload, evidence }`.
- Produces: CLI output JSON with `brand_system`, `copy_system`, and `visual_system`.

- [ ] **Step 1: Write minimal implementation**

Create `scripts/meristem-genesis-contract.mjs` with this content:

```js
#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BRAND_SYSTEM_OUTPUTS = [
  ['foundation', 'brand-foundation'],
  ['buyer_persona', 'buyer-persona'],
  ['competitor_analysis', 'competitor-analysis'],
  ['value_proposition', 'value-proposition'],
  ['product_positioning', 'product-positioning'],
  ['voice_and_tone', 'voice-and-tone'],
  ['brand_story', 'brand-story']
];

const COPY_SYSTEM_OUTPUTS = [
  ['messaging_framework', 'messaging-framework'],
  ['landing_page', 'landing-page-copy'],
  ['welcome_email_sequence', 'welcome-email-sequence'],
  ['prelaunch_email_sequence', 'prelaunch-email-sequence'],
  ['launch_email_sequence', 'launch-email-sequence'],
  ['ad_creative', 'ad-creative-copy'],
  ['press_release', 'press-release'],
  ['product_description', 'product-description']
];

const VISUAL_SYSTEM_OUTPUTS = [
  ['color_palette', 'color-palette'],
  ['typography', 'typography'],
  ['logo_concept', 'logo-concept'],
  ['visual_language', 'visual-language'],
  ['lifestyle_photography', 'lifestyle-photography'],
  ['product_photography', 'product-photography'],
  ['hero_images', 'hero-images'],
  ['brand_illustrations', 'brand-illustrations'],
  ['icon_system', 'icon-system'],
  ['pattern_library', 'pattern-library'],
  ['social_media_assets', 'social-media-assets']
];

const REQUIRED_GROUPS = ['brand_system', 'copy_system', 'visual_system'];

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`invalid JSON in ${file}: ${error.message}`);
  }
}

function readCompleteOutput(outputsDir, skill) {
  const file = join(outputsDir, `${skill}.json`);
  if (!existsSync(file)) {
    throw new Error(`missing required meristem output: ${skill}.json`);
  }
  const json = readJson(file);
  if (json.status !== 'complete') {
    throw new Error(`${skill}.json status is "${json.status}"; expected "complete"`);
  }
  return json;
}

function readOutputGroup(outputsDir, specs) {
  return Object.fromEntries(specs.map(([key, skill]) => [key, readCompleteOutput(outputsDir, skill)]));
}

function readAssetManifest(brandRoot) {
  const manifestFile = join(brandRoot, '.brandmint', 'asset-manifest.json');
  if (!existsSync(manifestFile)) {
    throw new Error('missing required meristem asset manifest: .brandmint/asset-manifest.json');
  }
  const manifest = readJson(manifestFile);
  const validation = manifest.validation || {};
  if (validation.all_paths_exist !== true) {
    const missing = Array.isArray(validation.missing_paths) ? validation.missing_paths : [];
    throw new Error(`asset manifest reports missing paths: ${missing.join(', ') || 'unknown paths'}`);
  }
  return manifest;
}

function detectGitSha(meristemRoot) {
  try {
    return execFileSync('git', ['-C', meristemRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

function assertCambiumPayload(payload) {
  const missing = REQUIRED_GROUPS.filter((group) => !Object.prototype.hasOwnProperty.call(payload, group));
  if (missing.length) {
    throw new Error(`missing Cambium Genesis groups: ${missing.join(', ')}`);
  }
  const extra = Object.keys(payload).filter((group) => !REQUIRED_GROUPS.includes(group));
  if (extra.length) {
    throw new Error(`unexpected Cambium Genesis groups: ${extra.join(', ')}`);
  }
  for (const group of REQUIRED_GROUPS) {
    if (!payload[group] || typeof payload[group] !== 'object' || Array.isArray(payload[group])) {
      throw new Error(`${group} must be a non-array object`);
    }
  }
}

export function buildGenesisContract({ meristemRoot, brandDir = 'brands/thoughtseed' } = {}) {
  if (!meristemRoot) throw new Error('missing required option: meristemRoot');

  const root = resolve(meristemRoot);
  const brandRoot = join(root, brandDir);
  const outputsDir = join(brandRoot, '.brandmint', 'outputs');
  if (!existsSync(outputsDir)) {
    throw new Error(`missing meristem outputs directory: ${outputsDir}`);
  }

  const assetManifest = readAssetManifest(brandRoot);
  const payload = {
    brand_system: readOutputGroup(outputsDir, BRAND_SYSTEM_OUTPUTS),
    copy_system: readOutputGroup(outputsDir, COPY_SYSTEM_OUTPUTS),
    visual_system: {
      ...readOutputGroup(outputsDir, VISUAL_SYSTEM_OUTPUTS),
      asset_manifest: assetManifest
    }
  };
  assertCambiumPayload(payload);

  const consumedSkills = [
    ...BRAND_SYSTEM_OUTPUTS,
    ...COPY_SYSTEM_OUTPUTS,
    ...VISUAL_SYSTEM_OUTPUTS
  ].map(([, skill]) => skill);

  return {
    payload,
    evidence: {
      status: 'pass',
      meristemRoot: root,
      brandDir,
      meristemSha: detectGitSha(root),
      requiredGroups: REQUIRED_GROUPS,
      consumedSkillCount: consumedSkills.length,
      consumedSkills,
      assetManifest: {
        allPathsExist: true,
        userCount: assetManifest.validation?.user_count ?? assetManifest.user_provided_assets?.length ?? 0,
        generatedCount: assetManifest.validation?.generated_count ?? assetManifest.generated_assets?.length ?? 0
      }
    }
  };
}

function parseArgs(argv) {
  const args = {
    meristemRoot: '',
    brandDir: 'brands/thoughtseed',
    out: '',
    evidenceOut: ''
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--meristem-root') args.meristemRoot = argv[++i] || '';
    else if (arg === '--brand-dir') args.brandDir = argv[++i] || '';
    else if (arg === '--out') args.out = argv[++i] || '';
    else if (arg === '--evidence-out') args.evidenceOut = argv[++i] || '';
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'usage: node scripts/meristem-genesis-contract.mjs --meristem-root /path/to/meristem [--brand-dir brands/thoughtseed] [--out /tmp/brand-dna.json] [--evidence-out /tmp/evidence.json]',
    '',
    'Emits Cambium Genesis JSON with top-level brand_system, copy_system, and visual_system.'
  ].join('\n');
}

function writeJsonFile(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  const { payload, evidence } = buildGenesisContract(args);
  if (args.out && args.out !== '-') writeJsonFile(args.out, payload);
  else console.log(JSON.stringify(payload, null, 2));
  if (args.evidenceOut) writeJsonFile(args.evidenceOut, evidence);
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`fail-closed: ${error.message}`);
      process.exit(1);
    }
  );
}
```

- [ ] **Step 2: Make the script executable**

```bash
chmod +x scripts/meristem-genesis-contract.mjs
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
node --test bin/meristem-genesis-contract.test.mjs
```

Expected: PASS, with four passing subtests.

- [ ] **Step 4: Run full current Cambium tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/meristem-genesis-contract.mjs bin/meristem-genesis-contract.test.mjs
git commit -m "feat: prove meristem genesis contract mapping"
```

---

### Task 3: Capture The Meristem Intake Evidence Packet

**Files:**
- Create: `docs/plans/2026-06-27-meristem-genesis-sidecar-intake.md`
- Uses: `scripts/meristem-genesis-contract.mjs`

**Interfaces:**
- Consumes: proof output from Task 2.
- Produces: durable Cambium intake evidence for review before any active Genesis replacement.

- [ ] **Step 1: Prepare a local meristem proof checkout**

Run:

```bash
MERISTEM_ROOT="${MERISTEM_ROOT:-/tmp/meristem-sidecar-proof}"
if [ ! -d "$MERISTEM_ROOT/.git" ]; then
  rm -rf "$MERISTEM_ROOT"
  git clone --depth=1 https://github.com/Sheshiyer/meristem.git "$MERISTEM_ROOT"
fi
git -C "$MERISTEM_ROOT" rev-parse HEAD
```

Expected: prints a full commit SHA. The observed SHA during design was `d447fb9c8dd3a5c1c4846f271b20bea6e421ce7f`.

- [ ] **Step 2: Reproduce runner pass and runner blockers**

Run:

```bash
MERISTEM_ROOT="${MERISTEM_ROOT:-/tmp/meristem-sidecar-proof}"
(
  cd "$MERISTEM_ROOT"
  ./runner/bm.sh launch --config examples/brand-config.yaml --waves 1-2 --dry-run
)
```

Expected: PASS and output lists Wave 1 foundation spokes plus Wave 2 strategy spokes.

Run:

```bash
MERISTEM_ROOT="${MERISTEM_ROOT:-/tmp/meristem-sidecar-proof}"
(
  cd "$MERISTEM_ROOT"
  ./runner/bm.sh plan --config examples/brand-config.yaml --waves 1-2 --dry-run
)
```

Expected: FAIL with a missing `orchestrator/plan.sh` target.

Run:

```bash
MERISTEM_ROOT="${MERISTEM_ROOT:-/tmp/meristem-sidecar-proof}"
(
  cd "$MERISTEM_ROOT"
  ./runner/bm.sh resume --config examples/brand-config.yaml
)
```

Expected: FAIL with a missing `runner/resume.sh` target.

- [ ] **Step 3: Run the Cambium contract proof against meristem**

Run:

```bash
MERISTEM_ROOT="${MERISTEM_ROOT:-/tmp/meristem-sidecar-proof}"
node scripts/meristem-genesis-contract.mjs \
  --meristem-root "$MERISTEM_ROOT" \
  --brand-dir brands/thoughtseed \
  --out /tmp/meristem-brand-dna.json \
  --evidence-out /tmp/meristem-genesis-evidence.json
jq 'keys' /tmp/meristem-brand-dna.json
jq '.status, .requiredGroups, .consumedSkillCount, .assetManifest' /tmp/meristem-genesis-evidence.json
```

Expected:

```text
[
  "brand_system",
  "copy_system",
  "visual_system"
]
"pass"
[
  "brand_system",
  "copy_system",
  "visual_system"
]
26
{
  "allPathsExist": true,
  "userCount": 4,
  "generatedCount": 16
}
```

- [ ] **Step 4: Create the evidence packet**

Create `docs/plans/2026-06-27-meristem-genesis-sidecar-intake.md` with this content, updating only the SHA line if Step 1 prints a newer meristem SHA:

```markdown
# Meristem Genesis Sidecar Intake

Date: 2026-06-27
Status: proof packet for sidecar implementation

## Source

- Repository: `https://github.com/Sheshiyer/meristem.git`
- Role: external Genesis candidate for Cambium
- Approved design: `docs/superpowers/specs/2026-06-27-meristem-genesis-sidecar-design.md`
- Meristem SHA observed during design: `d447fb9c8dd3a5c1c4846f271b20bea6e421ce7f`

## Intake Decision

Meristem is ingested as a sidecar contract source, not as vendored Cambium source. Cambium keeps its active Genesis adapter unchanged until the sidecar proof and review pass.

## Runner Evidence

- `./runner/bm.sh launch --config examples/brand-config.yaml --waves 1-2 --dry-run`: pass; lists foundation and strategy spokes.
- `./runner/bm.sh plan --config examples/brand-config.yaml --waves 1-2 --dry-run`: blocked; missing `orchestrator/plan.sh`.
- `./runner/bm.sh resume --config examples/brand-config.yaml`: blocked; missing `runner/resume.sh`.

## Contract Proof

The Cambium shim command emits exactly these top-level groups:

```json
[
  "brand_system",
  "copy_system",
  "visual_system"
]
```

Proof evidence reports:

```json
{
  "status": "pass",
  "requiredGroups": ["brand_system", "copy_system", "visual_system"],
  "consumedSkillCount": 26,
  "assetManifest": {
    "allPathsExist": true,
    "userCount": 4,
    "generatedCount": 16
  }
}
```

## Mapping Summary

| Cambium group | Meristem source family |
| --- | --- |
| `brand_system` | foundation, persona, competitors, value proposition, positioning, voice, story |
| `copy_system` | messaging, landing page, email sequences, ad copy, press release, product description |
| `visual_system` | palette, typography, logo, visual language, photography, illustration, social assets, asset manifest |

## Replacement Gate

Do not replace the active Genesis adapter yet. Replacement requires a separate approved plan that proves the disabled candidate adapter is safe under `compose validate`, stage-contract validation, and normal Cambium tests.
```

- [ ] **Step 5: Commit**

```bash
git add docs/plans/2026-06-27-meristem-genesis-sidecar-intake.md
git commit -m "docs: capture meristem genesis sidecar intake"
```

---

### Task 4: Add Disabled Candidate Adapter Metadata

**Files:**
- Modify: `adapters.json`
- Create: `bin/meristem-genesis-adapter.test.mjs`

**Interfaces:**
- Consumes: `scripts/meristem-genesis-contract.mjs`.
- Produces: disabled `candidate_adapters.genesis_meristem_candidate` metadata.

- [ ] **Step 1: Write the failing adapter metadata test**

Create `bin/meristem-genesis-adapter.test.mjs` with this content:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adaptersFile = new URL('../adapters.json', import.meta.url);

test('meristem Genesis candidate is recorded but not active', () => {
  const config = JSON.parse(readFileSync(adaptersFile, 'utf8'));

  assert.equal(config.adapters.genesis.cmd, 'brandmint');
  assert.equal(config.adapters.genesis.args[0], 'launch');
  assert.equal(config.adapters.genesis_meristem_candidate, undefined);

  const candidate = config.candidate_adapters?.genesis_meristem_candidate;
  assert.ok(candidate, 'candidate adapter missing');
  assert.equal(candidate.disabled, true);
  assert.equal(candidate.cmd, 'node');
  assert.deepEqual(candidate.contract_produces, ['brand_system', 'copy_system', 'visual_system']);
  assert.match(candidate.note, /proof-only/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test bin/meristem-genesis-adapter.test.mjs
```

Expected: FAIL with `candidate adapter missing`.

- [ ] **Step 3: Add disabled metadata to adapters.json**

Modify `adapters.json` by adding this top-level object after the existing `adapters` object. Keep `adapters.genesis` unchanged.

```json
  "candidate_adapters": {
    "genesis_meristem_candidate": {
      "disabled": true,
      "root_id": "genesis",
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
      "spend_reason": "proof-only sidecar mapping; does not run paid generation",
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
      "contract_version": "0.1.0",
      "note": "Disabled proof-only Genesis candidate for Sheshiyer/meristem. It must not be routed by compose run until a separate replacement plan promotes it."
    }
  }
```

The final file must remain valid JSON. If `adapters.json` already has a top-level object after `adapters`, place `candidate_adapters` beside it rather than nesting inside `adapters`.

- [ ] **Step 4: Run adapter metadata test**

Run:

```bash
node --test bin/meristem-genesis-adapter.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run compose validation**

Run:

```bash
npm run validate
```

Expected: PASS. The active pipeline still resolves through the existing `adapters.genesis`.

- [ ] **Step 6: Commit**

```bash
git add adapters.json bin/meristem-genesis-adapter.test.mjs
git commit -m "chore: record disabled meristem genesis candidate"
```

---

### Task 5: Final Verification And Handoff

**Files:**
- Verify: `docs/superpowers/specs/2026-06-27-meristem-genesis-sidecar-design.md`
- Verify: `docs/plans/2026-06-27-meristem-genesis-sidecar-intake.md`
- Verify: `scripts/meristem-genesis-contract.mjs`
- Verify: `adapters.json`

**Interfaces:**
- Consumes: completed Tasks 1-4.
- Produces: a clean, evidence-backed implementation handoff.

- [ ] **Step 1: Run focused sidecar tests**

```bash
node --test bin/meristem-genesis-contract.test.mjs bin/meristem-genesis-adapter.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run full Cambium tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run compose validation**

```bash
npm run validate
```

Expected: PASS with registry and pipeline valid.

- [ ] **Step 4: Verify no active Genesis route changed**

```bash
jq '.adapters.genesis.cmd, .adapters.genesis.args, .candidate_adapters.genesis_meristem_candidate.disabled' adapters.json
```

Expected:

```text
"brandmint"
[
  "launch",
  "--waves",
  "1-8",
  "--brand",
  "{tenant}"
]
true
```

- [ ] **Step 5: Verify the evidence packet names runner blockers**

```bash
rg -n "orchestrator/plan\\.sh|runner/resume\\.sh|Do not replace the active Genesis adapter yet" docs/plans/2026-06-27-meristem-genesis-sidecar-intake.md
```

Expected: three matches.

- [ ] **Step 6: Commit verification notes only if files changed**

If verification updates the evidence packet, run:

```bash
git add docs/plans/2026-06-27-meristem-genesis-sidecar-intake.md
git commit -m "docs: finalize meristem sidecar proof evidence"
```

If no file changed, do not create an empty commit.

---

## Execution Notes

- Keep unrelated modified files out of every commit.
- Use `git status --short` before every commit.
- If `adapters.json` conflicts with current `main`, keep the existing active `adapters.genesis` block and add only disabled candidate metadata.
- If meristem's live SHA differs from the design-time SHA, record both in the intake packet.
- If any proof gate fails, stop and update the evidence packet with the failure. Do not promote the candidate adapter.
