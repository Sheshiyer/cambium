# Portfolio Catalog Resync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the drift between `cambium`'s frozen portfolio catalog (`portfolio-catalog-data.ts` + its digest chain) and the current canonical registry (72 WorkObjects, 0 unresolved — up from the frozen 54/16), via a reusable generator script instead of a one-time hand patch.

**Architecture:** A new pure-function generator (`scripts/generate-portfolio-catalog-data.mjs`) transforms the registry JSON into the existing `RAW_*` tuple shapes and writes both mirrored `portfolio-catalog-data.ts` files byte-identical. The validator's pinned digest/count constants (`portfolio-catalog.ts`, `domain.ts`) are updated as a separate manual step, since they require running the module's own hashing logic against the new data — not something the generator (a pure data transform) computes.

**Tech Stack:** Node.js (`node --experimental-strip-types`), TypeScript (no build step for these files — run directly), `node:test` for tests, existing `pnpm bundle` for the generated-artifact rebuild.

## Global Constraints

- The generator must be a pure, testable transform (`transformRegistryToRawData(registry)`) plus a thin CLI wrapper — not a script that only works end-to-end.
- Output must be byte-identical between `workers/quests/src/portfolio-catalog-data.ts` and `apps/portfolio-cartographer/src/portfolio-catalog-data.ts` (their only difference is a 4-line header comment, which the generator preserves per-file).
- Never hand-edit `workers/quests/src/portfolio-workbench.generated.ts` or `apps/portfolio-cartographer/bundle.html` — always regenerate via `pnpm bundle`.
- `sourceRefs` values must never be absolute filesystem paths (`rejectForbiddenMaterial`'s `ABSOLUTE_PATH` check covers the whole catalog recursively) — the registry already follows this convention, but the generator must not introduce any.
- Trailing-optional-field convention in `RAW_SAPLINGS`/`RAW_PROGRAMS` tuples: omit a trailing field entirely when undefined; only emit an explicit `undefined` for a field that has a later, populated field after it (see existing rows like `['branch:brightme', ..., undefined, 'white-labelable']`).
- `RAW_OPERATIONAL_GAP_WORK_IDS` is declared `as const`; `RAW_SAPLINGS`, `RAW_PROGRAMS`, `RAW_HISTORICAL_PRODUCTS`, and `RAW_CLASSIFICATION_REVIEW` are all declared with explicit `readonly RawX[]` type annotations (no `as const`) — the latter two were moved off `as const` mid-branch (commit `b71c04c`) to fix a real `tsc` TS2488 bug where an empty `as const` array infers the literal empty-tuple type, breaking downstream destructuring. Preserve this per-array.

---

### Task 1: Extend RawSapling schema for `commercialReuse`

**Files:**
- Modify: `workers/quests/src/portfolio-catalog-data.ts:6-15` (RawSapling type), `:193-207` (materializeRecords sapling branch — line numbers approximate, anchor on content)
- Modify: `apps/portfolio-cartographer/src/portfolio-catalog-data.ts` (identical edit, mirrored file)
- Modify: `workers/quests/src/portfolio-catalog.ts` (materializeRecords sapling branch, function starting at line 193)

**Interfaces:**
- Produces: `RawSapling` tuple gains an optional 9th slot `commercialReuse?: 'white-labelable'`, consumed by `materializeRecords()` and validated by the already-generic check at `portfolio-catalog.ts:336` (`if (record.commercialReuse !== undefined) expectEnum(...)`) — no `validateRecord` changes needed, that check already runs before the kind-specific branch.

This is a pure additive schema change verified by the *existing* test suite still passing against the *old* 54-record data (which never populates this field) — confirming backward compatibility before Task 3 swaps in data that uses it.

- [ ] **Step 1: Run the existing test suite to confirm a clean baseline**

Run: `cd <worktree-root>/workers/quests && node --experimental-strip-types --test src/portfolio-catalog.test.ts`
Expected: PASS (this is the pre-change baseline)

- [ ] **Step 2: Add the `commercialReuse` slot to `RawSapling`**

In both `workers/quests/src/portfolio-catalog-data.ts` and `apps/portfolio-cartographer/src/portfolio-catalog-data.ts`, change:

```ts
export type RawSapling = readonly [
  workId: string,
  name: string,
  promotionState: 'proof-only' | 'supervised-branch',
  tenantStatus: 'canonical' | 'canonical-parent' | 'unresolved',
  tenantId: string | null,
  provenance: readonly string[],
  linkedWorkIds?: readonly string[],
  aliases?: readonly RawAlias[],
];
```

to:

```ts
export type RawSapling = readonly [
  workId: string,
  name: string,
  promotionState: 'proof-only' | 'supervised-branch',
  tenantStatus: 'canonical' | 'canonical-parent' | 'unresolved',
  tenantId: string | null,
  provenance: readonly string[],
  linkedWorkIds?: readonly string[],
  aliases?: readonly RawAlias[],
  commercialReuse?: 'white-labelable',
];
```

- [ ] **Step 3: Pass `commercialReuse` through in `materializeRecords()`**

In `workers/quests/src/portfolio-catalog.ts`, change the sapling branch inside `materializeRecords()`:

```ts
  const saplings: PortfolioCatalogRecord[] = RAW_SAPLINGS.map((row) => {
    const [workId, name, promotionState, tenantStatus, tenantId, provenance, linkedWorkIds = [], aliases = []] = row;
    return compact({
      canonicalId: workId,
      workId,
      name,
      kind: 'sapling' as const,
      classification: 'sapling' as const,
      portfolioStatus: 'active' as const,
      promotionState,
      tenantIdentity: { status: tenantStatus, tenantId },
      parentTenant: tenantId ?? undefined,
      provenance: [...provenance],
      linkedCanonicalIds: [...linkedWorkIds],
      aliases: aliases.map(([value, namespace]) => ({ value, namespace, tenantAuthority: false as const })),
    });
  });
```

to:

```ts
  const saplings: PortfolioCatalogRecord[] = RAW_SAPLINGS.map((row) => {
    const [workId, name, promotionState, tenantStatus, tenantId, provenance, linkedWorkIds = [], aliases = [], commercialReuse] = row;
    return compact({
      canonicalId: workId,
      workId,
      name,
      kind: 'sapling' as const,
      classification: 'sapling' as const,
      portfolioStatus: 'active' as const,
      promotionState,
      tenantIdentity: { status: tenantStatus, tenantId },
      parentTenant: tenantId ?? undefined,
      provenance: [...provenance],
      linkedCanonicalIds: [...linkedWorkIds],
      aliases: aliases.map(([value, namespace]) => ({ value, namespace, tenantAuthority: false as const })),
      commercialReuse,
    });
  });
```

- [ ] **Step 4: Run the test suite again to confirm no regression**

Run: `node --experimental-strip-types --test src/portfolio-catalog.test.ts` (from `workers/quests/`)
Expected: PASS — identical result to Step 1, since no `RAW_SAPLINGS` row populates the new field yet.

- [ ] **Step 5: Commit**

```bash
cd <worktree-root>
git add workers/quests/src/portfolio-catalog-data.ts apps/portfolio-cartographer/src/portfolio-catalog-data.ts workers/quests/src/portfolio-catalog.ts
git commit -m "feat(catalog): add commercialReuse slot to RawSapling schema"
```

---

### Task 2: Build the registry→catalog generator (TDD)

**Files:**
- Create: `scripts/generate-portfolio-catalog-data.mjs`
- Create: `scripts/generate-portfolio-catalog-data.test.mjs`

**Interfaces:**
- Produces: `export function transformRegistryToRawData(registry)` → `{ saplings, programs, historicalProducts, classificationReview, operationalGapWorkIds }` (plain JS arrays of tuples, not yet formatted to source text).
- Produces: `export function formatRawDataModule(raw, headerLines)` → the full TS source text for one `portfolio-catalog-data.ts` file, given the transform output and a per-file header comment.
- Consumes (Task 3): both functions, plus a CLI `main()` that isn't unit tested directly (thin I/O wrapper).

- [ ] **Step 1: Write the failing test for sapling transformation**

Create `scripts/generate-portfolio-catalog-data.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformRegistryToRawData, formatRawDataModule } from './generate-portfolio-catalog-data.mjs';

test('transforms a Sapling workObject with empty linkedWorkIds and populated aliases, emitting an explicit undefined hole for the empty earlier field', () => {
  const registry = {
    workObjects: [
      {
        workId: 'sapling:fitcheck',
        name: 'Fitcheck',
        kind: 'sapling',
        promotionState: 'supervised-branch',
        tenantIdentity: { status: 'canonical-parent', tenantId: 'cambium' },
        identityAliases: [
          { value: 'FitCheck', namespace: 'legacy-product-name', tenantAuthority: false },
          { value: 'getfitcheck', namespace: 'brand-alias', tenantAuthority: false },
        ],
        linkedWorkIds: [],
        sourceRefs: ['repo:fitcheck-landing/README.md', 'cambium:docs/plans/product-branches/fitcheck.md'],
      },
    ],
    historicalProductSurfaces: [],
    unresolvedCandidates: [],
    operationalGaps: [],
  };
  const result = transformRegistryToRawData(registry);
  assert.deepEqual(result.saplings, [
    [
      'sapling:fitcheck',
      'Fitcheck',
      'supervised-branch',
      'canonical-parent',
      'cambium',
      ['repo:fitcheck-landing/README.md', 'cambium:docs/plans/product-branches/fitcheck.md'],
      undefined,
      [['FitCheck', 'legacy-product-name'], ['getfitcheck', 'brand-alias']],
    ],
  ]);
});

test('transforms a Sapling with commercialReuse but no aliases, emitting an explicit undefined hole', () => {
  const registry = {
    workObjects: [
      {
        workId: 'sapling:hostscale',
        name: 'HostScale',
        kind: 'sapling',
        promotionState: 'proof-only',
        commercialReuse: 'white-labelable',
        tenantIdentity: { status: 'unresolved', tenantId: null },
        linkedWorkIds: ['branch:co-property'],
        sourceRefs: ['repo:hostscalev0', 'cambium:docs/evidence/2026-08-06-classification-needed-findings.md'],
      },
    ],
    historicalProductSurfaces: [],
    unresolvedCandidates: [],
    operationalGaps: [],
  };
  const result = transformRegistryToRawData(registry);
  assert.deepEqual(result.saplings, [
    [
      'sapling:hostscale',
      'HostScale',
      'proof-only',
      'unresolved',
      null,
      ['repo:hostscalev0', 'cambium:docs/evidence/2026-08-06-classification-needed-findings.md'],
      ['branch:co-property'],
      undefined,
      'white-labelable',
    ],
  ]);
});

test('transforms a Program with paused overlay and accountId', () => {
  const registry = {
    workObjects: [
      {
        workId: 'branch:sandboxlife',
        name: 'SandBoxLife',
        kind: 'program',
        programKind: 'client',
        accountId: 'valore-ventures',
        lifecycle: 'approved',
        operationalStatus: 'paused',
        tenantIdentity: { status: 'unresolved', tenantId: null },
        linkedWorkIds: [],
        sourceRefs: ['vault:60-client-ecosystem/valore-ventures/project-brief.md'],
      },
    ],
    historicalProductSurfaces: [],
    unresolvedCandidates: [],
    operationalGaps: [],
  };
  const result = transformRegistryToRawData(registry);
  assert.deepEqual(result.programs, [
    [
      'branch:sandboxlife',
      'SandBoxLife',
      'client',
      'approved',
      'unresolved',
      null,
      ['vault:60-client-ecosystem/valore-ventures/project-brief.md'],
      'valore-ventures',
      undefined,
      'paused',
    ],
  ]);
});

test('transforms historicalProductSurfaces, unresolvedCandidates, and operationalGaps', () => {
  const registry = {
    workObjects: [],
    historicalProductSurfaces: [
      { id: 'historical-product:bezly', name: 'Bezly', status: 'archived', linkedWorkId: null, sourceRef: 'vault:40-products/01-bezly/product-overview.md' },
    ],
    unresolvedCandidates: [
      { workId: 'review:example', name: 'Example', needed: 'owner and commercial outcome' },
    ],
    operationalGaps: [
      { workId: 'sapling:cambium', fieldSet: 'mission-core-v1', tenantActivation: 'not-authorized-by-registry' },
    ],
  };
  const result = transformRegistryToRawData(registry);
  assert.deepEqual(result.historicalProducts, [
    ['historical-product:bezly', 'Bezly', 'archived', null, 'vault:40-products/01-bezly/product-overview.md'],
  ]);
  assert.deepEqual(result.classificationReview, [
    ['review:example', 'Example', 'owner and commercial outcome'],
  ]);
  assert.deepEqual(result.operationalGapWorkIds, ['sapling:cambium']);
});

test('throws naming the workId for a Sapling missing tenantIdentity', () => {
  const registry = {
    workObjects: [{ workId: 'sapling:broken', name: 'Broken', kind: 'sapling', promotionState: 'proof-only', sourceRefs: ['vault:x.md'] }],
    historicalProductSurfaces: [],
    unresolvedCandidates: [],
    operationalGaps: [],
  };
  assert.throws(() => transformRegistryToRawData(registry), /sapling:broken.*tenantIdentity/);
});

test('throws naming the workId for a Program with an unrecognized programKind', () => {
  const registry = {
    workObjects: [{
      workId: 'program:broken',
      name: 'Broken',
      kind: 'program',
      programKind: 'not-a-real-kind',
      lifecycle: 'executing',
      tenantIdentity: { status: 'not-applicable', tenantId: null },
      sourceRefs: ['vault:x.md'],
    }],
    historicalProductSurfaces: [],
    unresolvedCandidates: [],
    operationalGaps: [],
  };
  assert.throws(() => transformRegistryToRawData(registry), /program:broken.*programKind/);
});

test('throws naming the workId for a workObject with no sourceRefs', () => {
  const registry = {
    workObjects: [{
      workId: 'sapling:no-refs',
      name: 'No Refs',
      kind: 'sapling',
      promotionState: 'proof-only',
      tenantIdentity: { status: 'unresolved', tenantId: null },
      sourceRefs: [],
    }],
    historicalProductSurfaces: [],
    unresolvedCandidates: [],
    operationalGaps: [],
  };
  assert.throws(() => transformRegistryToRawData(registry), /sapling:no-refs.*sourceRefs/);
});

test('formatRawDataModule renders valid, trailing-trimmed TS source', () => {
  const raw = {
    saplings: [['sapling:a', 'A', 'proof-only', 'unresolved', null, ['vault:x.md']]],
    programs: [],
    historicalProducts: [],
    classificationReview: [],
    operationalGapWorkIds: [],
  };
  const text = formatRawDataModule(raw, ['// header line one']);
  assert.match(text, /\/\/ header line one/);
  assert.match(text, /export const RAW_SAPLINGS: readonly RawSapling\[\] = \[\n {2}\['sapling:a', 'A', 'proof-only', 'unresolved', null, \['vault:x\.md'\]\],\n\];/);
  assert.match(text, /export const RAW_CLASSIFICATION_REVIEW = \[\] as const;/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test scripts/generate-portfolio-catalog-data.test.mjs` (from repo root)
Expected: FAIL with "Cannot find module './generate-portfolio-catalog-data.mjs'"

- [ ] **Step 3: Implement the generator**

Create `scripts/generate-portfolio-catalog-data.mjs`:

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function trimTrailing(fixedFields, optionalValues) {
  let lastDefinedIndex = -1;
  optionalValues.forEach((value, index) => {
    if (value !== undefined) lastDefinedIndex = index;
  });
  return [...fixedFields, ...optionalValues.slice(0, lastDefinedIndex + 1)];
}

const SAPLING_TENANT_STATUSES = new Set(['canonical', 'canonical-parent', 'unresolved']);
const PROGRAM_TENANT_STATUSES = new Set(['canonical', 'documented-not-runtime-verified', 'not-applicable', 'unresolved']);
const PROGRAM_KINDS = new Set(['client', 'company', 'capability', 'operations']);

function requireSourceRefs(w) {
  if (!Array.isArray(w.sourceRefs) || w.sourceRefs.length === 0) {
    throw new Error(`${w.workId}: missing or empty sourceRefs`);
  }
  return [...w.sourceRefs];
}

function requireTenantIdentity(w, allowedStatuses) {
  const identity = w.tenantIdentity;
  if (!identity || typeof identity.status !== 'string') {
    throw new Error(`${w.workId}: missing tenantIdentity`);
  }
  if (!allowedStatuses.has(identity.status)) {
    throw new Error(`${w.workId}: tenantIdentity.status "${identity.status}" is not a recognized value`);
  }
  return identity;
}

function transformSapling(w) {
  const identity = requireTenantIdentity(w, SAPLING_TENANT_STATUSES);
  const sourceRefs = requireSourceRefs(w);
  const fixed = [w.workId, w.name, w.promotionState, identity.status, identity.tenantId, sourceRefs];
  const linkedWorkIds = w.linkedWorkIds && w.linkedWorkIds.length ? [...w.linkedWorkIds] : undefined;
  const aliases = w.identityAliases && w.identityAliases.length
    ? w.identityAliases.map((a) => [a.value, a.namespace])
    : undefined;
  const commercialReuse = w.commercialReuse;
  return trimTrailing(fixed, [linkedWorkIds, aliases, commercialReuse]);
}

function transformProgram(w) {
  if (!PROGRAM_KINDS.has(w.programKind)) {
    throw new Error(`${w.workId}: programKind "${w.programKind}" is not a recognized value`);
  }
  const identity = requireTenantIdentity(w, PROGRAM_TENANT_STATUSES);
  const sourceRefs = requireSourceRefs(w);
  const fixed = [w.workId, w.name, w.programKind, w.lifecycle, identity.status, identity.tenantId, sourceRefs];
  const accountId = w.accountId;
  const linkedWorkIds = w.linkedWorkIds && w.linkedWorkIds.length ? [...w.linkedWorkIds] : undefined;
  const overlay = w.operationalStatus === 'paused' ? 'paused' : undefined;
  const commercialReuse = w.commercialReuse;
  return trimTrailing(fixed, [accountId, linkedWorkIds, overlay, commercialReuse]);
}

export function transformRegistryToRawData(registry) {
  const saplings = [];
  const programs = [];
  for (const w of registry.workObjects) {
    if (w.kind === 'sapling') saplings.push(transformSapling(w));
    else programs.push(transformProgram(w));
  }
  const historicalProducts = registry.historicalProductSurfaces.map((h) => [
    h.id,
    h.name,
    h.status,
    h.linkedWorkId ?? null,
    h.sourceRef,
  ]);
  // unresolvedCandidates is empty as of this generator's authoring (the
  // registry's classification backlog was fully resolved before this piece
  // was built) — this mapping is inferred from the last non-empty snapshot
  // of RAW_CLASSIFICATION_REVIEW and has no live example to verify against.
  const classificationReview = registry.unresolvedCandidates.map((c) => [
    c.workId ?? `review:${String(c.name ?? c.path).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    c.name ?? c.path,
    c.needed ?? c.reason,
  ]);
  const operationalGapWorkIds = registry.operationalGaps.map((g) => g.workId);
  return { saplings, programs, historicalProducts, classificationReview, operationalGapWorkIds };
}

function formatValue(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (Array.isArray(v)) return `[${v.map(formatValue).join(', ')}]`;
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return JSON.stringify(v);
}

function formatTuple(tuple) {
  return `[${tuple.map(formatValue).join(', ')}]`;
}

function formatArrayOfTuples(name, typeAnnotation, tuples, asConst) {
  const decl = typeAnnotation ? `export const ${name}: ${typeAnnotation} = ` : `export const ${name} = `;
  const suffix = asConst ? ' as const;' : ';';
  if (tuples.length === 0) return `${decl}[]${suffix}`;
  const lines = tuples.map((t) => `  ${formatTuple(t)},`);
  return `${decl}[\n${lines.join('\n')}\n]${suffix}`;
}

export function formatRawDataModule(raw, headerLines) {
  const parts = [
    ...headerLines,
    '',
    "export type RawAlias = readonly [value: string, namespace: string];",
    "export type RawSapling = readonly [",
    "  workId: string,",
    "  name: string,",
    "  promotionState: 'proof-only' | 'supervised-branch',",
    "  tenantStatus: 'canonical' | 'canonical-parent' | 'unresolved',",
    "  tenantId: string | null,",
    "  provenance: readonly string[],",
    "  linkedWorkIds?: readonly string[],",
    "  aliases?: readonly RawAlias[],",
    "  commercialReuse?: 'white-labelable',",
    "];",
    "export type RawProgram = readonly [",
    "  workId: string,",
    "  name: string,",
    "  programKind: 'client' | 'company' | 'capability' | 'operations',",
    "  lifecycle: 'proposed' | 'approved' | 'executing' | 'verifying' | 'complete' | 'retired',",
    "  tenantStatus: 'canonical' | 'documented-not-runtime-verified' | 'not-applicable' | 'unresolved',",
    "  tenantId: string | null,",
    "  provenance: readonly string[],",
    "  accountId?: string,",
    "  linkedWorkIds?: readonly string[],",
    "  overlay?: 'paused',",
    "  commercialReuse?: 'white-labelable',",
    "];",
    "",
    formatArrayOfTuples('RAW_SAPLINGS', 'readonly RawSapling[]', raw.saplings, false),
    "",
    formatArrayOfTuples('RAW_PROGRAMS', 'readonly RawProgram[]', raw.programs, false),
    "",
    formatArrayOfTuples('RAW_HISTORICAL_PRODUCTS', undefined, raw.historicalProducts, true),
    "",
    formatArrayOfTuples('RAW_CLASSIFICATION_REVIEW', undefined, raw.classificationReview, true),
    "",
    `export const RAW_OPERATIONAL_GAP_WORK_IDS = [\n${raw.operationalGapWorkIds.map((id) => `  '${id}',`).join('\n')}\n] as const;`,
    "",
  ];
  return parts.join('\n');
}

function main() {
  const registryPath = process.argv[2];
  if (!registryPath) {
    console.error('Usage: node scripts/generate-portfolio-catalog-data.mjs <path-to-work-object-registry.v1.json>');
    process.exit(1);
  }
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  const raw = transformRegistryToRawData(registry);

  const workersHeader = [
    '// Normalized, deployment-safe projection of',
    '// thoughtseed-labs/00-meta/work-object-registry.v1.json.',
    '// Source inventory paths and operational payloads are intentionally omitted.',
  ];
  const appsHeader = [
    '// Standalone snapshot for the proposal-only Portfolio Cartographer.',
    '// Copied byte-for-byte from workers/quests/src/portfolio-catalog-data.ts',
    `// regenerated by scripts/generate-portfolio-catalog-data.mjs; domain.ts binds it to the verified semantic digest.`,
    '//',
    ...workersHeader,
  ];

  const workersOut = formatRawDataModule(raw, workersHeader);
  const appsOut = formatRawDataModule(raw, appsHeader);

  writeFileSync(new URL('../workers/quests/src/portfolio-catalog-data.ts', import.meta.url), workersOut);
  writeFileSync(new URL('../apps/portfolio-cartographer/src/portfolio-catalog-data.ts', import.meta.url), appsOut);

  const saplingCount = raw.saplings.length;
  const programCount = raw.programs.length;
  const clientCount = raw.programs.filter((p) => p[2] === 'client').length;
  const internalCount = programCount - clientCount;

  console.log(JSON.stringify({
    total: saplingCount + programCount,
    saplings: saplingCount,
    clientBranches: clientCount,
    internalPrograms: internalCount,
    classificationReview: raw.classificationReview.length,
    historicalProducts: raw.historicalProducts.length,
    operationalGaps: raw.operationalGapWorkIds.length,
    classificationDigestValue: registry.classificationDigest?.value,
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --experimental-strip-types --test scripts/generate-portfolio-catalog-data.test.mjs` (from repo root)
Expected: PASS, all 8 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-portfolio-catalog-data.mjs scripts/generate-portfolio-catalog-data.test.mjs
git commit -m "feat(scripts): add reusable registry-to-catalog-data generator with tests"
```

---

### Task 3: Run the generator and patch the pinned validator constants

**Files:**
- Modify: `workers/quests/src/portfolio-catalog-data.ts`, `apps/portfolio-cartographer/src/portfolio-catalog-data.ts` (overwritten by generator)
- Modify: `workers/quests/src/portfolio-catalog.ts:11,111-118,179-187,387-390,398,441-448`
- Modify: `apps/portfolio-cartographer/src/domain.ts:12`

**Interfaces:**
- Consumes: `node scripts/generate-portfolio-catalog-data.mjs <registry-path>` (Task 2's CLI; the registry path is a required argument, never a hardcoded default, to keep private filesystem paths out of checked-in code), printing `{total, saplings, clientBranches, internalPrograms, classificationReview, historicalProducts, operationalGaps, classificationDigestValue}`.

- [ ] **Step 1: Run the generator against the real registry**

Run: `node scripts/generate-portfolio-catalog-data.mjs <path-to-work-object-registry.v1.json>` (from repo root)
Expected output (values, not exact formatting): `total: 72, saplings: 20, clientBranches: 37, internalPrograms: 15, classificationReview: 0, historicalProducts: 20, operationalGaps: 48, classificationDigestValue: "50ba63b213debb1df57423c4edf97df79f29d5c77875245dbbc45251266902d2"`

Confirm both output files changed: `git diff --stat workers/quests/src/portfolio-catalog-data.ts apps/portfolio-cartographer/src/portfolio-catalog-data.ts`

- [ ] **Step 2: Update `PORTFOLIO_CLASSIFICATION_DIGEST` and `CLASSIFICATION_DIGEST`**

In `workers/quests/src/portfolio-catalog.ts:11`, replace the value with the `classificationDigestValue` printed in Step 1 (the registry's own `classificationDigest.value`).

In `apps/portfolio-cartographer/src/domain.ts:12`, set the same value — these two constants must stay byte-identical.

- [ ] **Step 3: Update the pinned `PortfolioCatalogSummary` interface literal**

In `workers/quests/src/portfolio-catalog.ts`, the `PortfolioCatalogSummary` interface (around line 111) currently reads:

```ts
export interface PortfolioCatalogSummary {
  total: 54;
  saplings: 12;
  clientBranches: 28;
  internalPrograms: 14;
  classificationReview: 16;
  historicalProducts: 19;
  operationalGaps: 47;
}
```

Replace each literal with the value from Step 1's printed output (`total: 72; saplings: 20; clientBranches: 37; internalPrograms: 15; classificationReview: 0; historicalProducts: 20; operationalGaps: 48;`).

- [ ] **Step 4: Update the `SUMMARY` constant**

The `const SUMMARY: PortfolioCatalogSummary = Object.freeze({...})` block (around line 179) mirrors the same 7 fields — update it to the same values as Step 3.

- [ ] **Step 5: Update the four pinned count assertions**

In `validatePortfolioCatalog()` (around lines 387-390), update the four numeric literals to match:

```ts
  if (!Array.isArray(records) || records.length !== 72 || records.length > MAX_RECORDS) fail('record count drifted');
  if (!Array.isArray(historicalProducts) || historicalProducts.length !== 20 || historicalProducts.length > MAX_HISTORICAL) fail('historical count drifted');
  if (!Array.isArray(classificationReview) || classificationReview.length !== 0 || classificationReview.length > MAX_REVIEW) fail('classification review count drifted');
  if (!Array.isArray(operationalGaps) || operationalGaps.length !== 48 || operationalGaps.length > MAX_GAPS) fail('operational gap count drifted');
```

`MAX_RECORDS` is 64 (declared near the top of the file) — 72 exceeds it, so also update `const MAX_RECORDS = 64;` to `const MAX_RECORDS = 96;` (round headroom above 72, consistent with the existing headroom pattern: old `MAX_RECORDS = 64` gave 10 records of headroom above the old total of 54; 96 gives 24 above 72, similar proportional slack).

- [ ] **Step 6: Update the classification-counts check**

Around line 398:

```ts
  if (saplings !== 20 || clients !== 37 || programs !== 15) fail('classification counts drifted');
```

- [ ] **Step 7: Update the summary-drift check**

Around lines 441-448, update each literal comparison (`summary.total !== 54` etc.) to the new values, matching Step 3.

- [ ] **Step 8: Compute the new `EXPECTED_CATALOG_DIGEST`**

The real module can't be imported yet (it still throws on the old `EXPECTED_CATALOG_DIGEST` value until this step completes it). Write a throwaway script that duplicates the module's own hashing logic against the now-updated data and constants:

```js
// /tmp/compute-catalog-digest.mjs — throwaway, not committed
import { createHash } from 'node:crypto';
import {
  RAW_CLASSIFICATION_REVIEW,
  RAW_HISTORICAL_PRODUCTS,
  RAW_OPERATIONAL_GAP_WORK_IDS,
  RAW_PROGRAMS,
  RAW_SAPLINGS,
} from '<worktree-root>/workers/quests/src/portfolio-catalog-data.ts';

const PORTFOLIO_CLASSIFICATION_DIGEST = 'PASTE_THE_STEP_2_VALUE_HERE';
const SUMMARY = Object.freeze({
  total: 72, saplings: 20, clientBranches: 37, internalPrograms: 15,
  classificationReview: 0, historicalProducts: 20, operationalGaps: 48,
});
const MISSING_MISSION_FIELDS = Object.freeze([
  'desiredState', 'currentState', 'ownerId', 'nextAction', 'blocker',
  'proofRequired', 'reviewAt', 'sourceDigest', 'goalGraphRef',
]);

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
}
function materializeRecords() {
  const saplings = RAW_SAPLINGS.map((row) => {
    const [workId, name, promotionState, tenantStatus, tenantId, provenance, linkedWorkIds = [], aliases = [], commercialReuse] = row;
    return compact({
      canonicalId: workId, workId, name, kind: 'sapling', classification: 'sapling',
      portfolioStatus: 'active', promotionState, tenantIdentity: { status: tenantStatus, tenantId },
      parentTenant: tenantId ?? undefined, provenance: [...provenance], linkedCanonicalIds: [...linkedWorkIds],
      aliases: aliases.map(([value, namespace]) => ({ value, namespace, tenantAuthority: false })),
      commercialReuse,
    });
  });
  const programs = RAW_PROGRAMS.map((row) => {
    const [workId, name, programKind, lifecycle, tenantStatus, tenantId, provenance, accountId, linkedWorkIds = [], overlay, commercialReuse] = row;
    return compact({
      canonicalId: workId, workId, name, kind: 'program',
      classification: programKind === 'client' ? 'client-branch' : 'internal-program',
      programKind, lifecycle, tenantIdentity: { status: tenantStatus, tenantId },
      parentTenant: tenantId ?? undefined, provenance: [...provenance], linkedCanonicalIds: [...linkedWorkIds],
      aliases: [], accountId, operationalOverlay: overlay, commercialReuse,
    });
  });
  return [...saplings, ...programs].sort((a, b) => a.workId.localeCompare(b.workId));
}
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}
function sha256(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

const withoutDigest = {
  schema: 'cambium.portfolio-catalog.v1', version: 1, status: 'proposed-read-only', readOnly: true,
  sourceSchema: 'thoughtseed.work-object-registry.v1', sourceGeneratedAt: '2026-07-29T06:46:00Z',
  classificationDigest: PORTFOLIO_CLASSIFICATION_DIGEST,
  authority: { classification: 'vault', operational: 'd1-goal-graph' },
  summary: SUMMARY,
  records: materializeRecords(),
  historicalProducts: RAW_HISTORICAL_PRODUCTS.map(([canonicalId, name, status, linkedCanonicalId, source]) => ({ canonicalId, name, status, linkedCanonicalId, provenance: [source] })),
  classificationReview: RAW_CLASSIFICATION_REVIEW.map(([canonicalId, source, needed]) => ({ canonicalId, source, needed })),
  operationalGaps: RAW_OPERATIONAL_GAP_WORK_IDS.map((workId) => ({ workId, gapKind: 'mission-data-needed', missingFields: MISSING_MISSION_FIELDS })),
};
console.log(sha256(withoutDigest));
```

Fill in the `PASTE_THE_STEP_2_VALUE_HERE` placeholder with Step 2's real value, then run:

Run: `node --experimental-strip-types /tmp/compute-catalog-digest.mjs`
Expected: prints a `sha256:...` string — this is the new `EXPECTED_CATALOG_DIGEST`.

Paste that value into `workers/quests/src/portfolio-catalog.ts:13` (`const EXPECTED_CATALOG_DIGEST = '...'`). Delete the throwaway script afterward (it is scratch, not committed).

- [ ] **Step 9: Run the real test suite to confirm self-validation passes**

Run: `cd workers/quests && node --experimental-strip-types --test src/portfolio-catalog.test.ts`
Expected: PASS — if any pinned value is still wrong, the error message names exactly which check failed (e.g. `'classification counts drifted'`), so fix the corresponding step above and re-run.

- [ ] **Step 10: Commit**

```bash
cd <worktree-root>
git add workers/quests/src/portfolio-catalog-data.ts apps/portfolio-cartographer/src/portfolio-catalog-data.ts workers/quests/src/portfolio-catalog.ts apps/portfolio-cartographer/src/domain.ts
git commit -m "feat(catalog): resync portfolio catalog data and pinned constants against current registry (72 WorkObjects, 0 unresolved)"
```

---

### Task 4: Regenerate the offline bundle

**Files:**
- Modify: `workers/quests/src/portfolio-workbench.generated.ts` (regenerated, not hand-edited)
- Modify: `apps/portfolio-cartographer/bundle.html` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: `apps/portfolio-cartographer`'s existing `pnpm bundle` script (`pnpm build && node scripts/bundle.mjs`), unchanged by this plan.

- [ ] **Step 1: Run the existing bundle script**

Run: `cd apps/portfolio-cartographer && pnpm bundle`
Expected: exits 0, rewrites `bundle.html` and `../../workers/quests/src/portfolio-workbench.generated.ts`

- [ ] **Step 2: Confirm both generated artifacts changed**

Run: `cd <worktree-root> && git diff --stat apps/portfolio-cartographer/bundle.html workers/quests/src/portfolio-workbench.generated.ts`
Expected: both files show changes (they embed the resynced catalog data)

- [ ] **Step 3: Commit**

```bash
git add apps/portfolio-cartographer/bundle.html workers/quests/src/portfolio-workbench.generated.ts
git commit -m "chore(bundle): regenerate portfolio workbench offline bundle from resynced catalog"
```

---

### Task 5: Full verification across both packages

**Files:** none modified — this task only runs and confirms existing verification commands.

**Interfaces:** none new.

- [ ] **Step 1: Confirm the two operating-fabric test files need no change**

They already use a fully self-contained synthetic `CATALOG` fixture (not imported from `portfolio-catalog-data.ts` or `PORTFOLIO_CLASSIFICATION_DIGEST`) — confirmed by inspection during planning (`grep -n "classificationDigest\|import.*portfolio-catalog-data" workers/quests/src/operating-fabric-portfolio.test.ts workers/quests/src/operating-fabric-organ-update.test.ts` shows only local fixture usage, no import). Run them to confirm they're still green and unaffected:

Run: `cd workers/quests && node --experimental-strip-types --test src/operating-fabric-portfolio.test.ts src/operating-fabric-organ-update.test.ts`
Expected: PASS, no changes needed to either file

- [ ] **Step 2: Run the cartographer app's full local gate**

Run: `cd apps/portfolio-cartographer && pnpm check`
Expected: PASS (test, lint, bundle, standalone:audit, standalone:csp, standalone:smoke all green)

- [ ] **Step 3: Run the root deterministic release verification (same as CI)**

Run: `cd <worktree-root> && npm run verify:release`
Expected: PASS — this is the exact command CI's "deterministic release verification" job runs; if it fails, the failure output names the specific check (matches the earlier `standalone:audit`-style failure format from PR #278's history).

- [ ] **Step 4: Run the full root test suite**

Run: `npm test` (root `package.json`'s `test` script, covering all `*.test.ts`/`*.test.mjs` across the repo)
Expected: PASS

- [ ] **Step 5: Final commit if any fixes were needed during verification**

If Steps 1-4 required any fixes, commit them individually with a message naming the specific check that was failing. If all steps passed clean on first run, no commit needed for this task.
