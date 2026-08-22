import assert from 'node:assert/strict'
import { lstat, mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  DEFAULT_WORKFLOW_REGISTRY_PATH,
  executeProjectBirth,
  normalizeProjectCreationAction,
  projectCreationIntentDigest,
  REVIEWED_ACTION_CATALOG_DIGEST,
  REVIEWED_ACTION_SOURCE_DIGEST,
  REVIEWED_PORTFOLIO_CATALOG_DIGEST,
  REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST,
  REVIEWED_ROOT_MAP_DIGEST,
} from './thoughtseed-project-birth.mjs'

const ROOT_DIGEST = REVIEWED_ROOT_MAP_DIGEST
const SOURCE_DIGEST = REVIEWED_ACTION_SOURCE_DIGEST
const CATALOG_DIGEST = REVIEWED_ACTION_CATALOG_DIGEST

function alterFirstHex(value) {
  const offset = value.startsWith('sha256:') ? 7 : 0
  const replacement = value[offset] === '0' ? '1' : '0'
  return `${value.slice(0, offset)}${replacement}${value.slice(offset + 1)}`
}

function action(proposal = {}, top = {}) {
  return {
    schema: 'thoughtseed.portfolio-admin-action.v1',
    kind: 'create-thoughtseed-project',
    portfolioId: 'thoughtseed',
    idempotencyKey: 'project-nova-create-1',
    rootMapDigest: ROOT_DIGEST,
    sourceDigest: SOURCE_DIGEST,
    catalogDigest: CATALOG_DIGEST,
    subject: { id: 'project-nova', name: 'Project Nova' },
    proposal: {
      intentSchema: 'thoughtseed.project-creation-intent.v1',
      requestSource: 'local-founder',
      name: 'Project Nova',
      slug: 'project-nova',
      origin: 'thoughtseed-venture',
      derivedKind: 'sapling',
      clientFamilyId: '',
      founderApproval: null,
      ...proposal,
    },
    ...top,
  }
}

async function fixture() {
  const projectsRoot = await mkdtemp(join(tmpdir(), 'thoughtseed-project-birth-'))
  await mkdir(join(projectsRoot, 'thoughtseed'))
  const workflowRegistryPath = join(projectsRoot, 'workflow-registry.json')
  await writeFile(workflowRegistryPath, JSON.stringify(registryFixture()))
  return { projectsRoot, workflowRegistryPath }
}

function stage(id, label) {
  return {
    id,
    label,
    meaning: `${label} lifecycle meaning`,
    requiredEvidence: [`${label} evidence`],
  }
}

function registryFixture() {
  return {
    schema: 'thoughtseed.project-intake-workflows.v1',
    version: 1,
    status: 'test-fixture',
    defaultWorkflowByKind: {
      sapling: 'sapling-product',
      'client-branch': 'client-delivery',
      'internal-program': 'internal-capability',
    },
    workflows: [
      {
        id: 'sapling-product',
        label: 'Sapling product',
        lifecycleMeaning: 'Sapling product lifecycle',
        compatibleKinds: ['sapling'],
        stages: [stage('0-discover', 'Discovery'), stage('1-brand', 'Brand'), stage('7-ship', 'Ship')],
      },
      {
        id: 'client-delivery',
        label: 'Client delivery',
        lifecycleMeaning: 'Client delivery lifecycle',
        compatibleKinds: ['client-branch'],
        stages: [stage('0-intake', 'Intake'), stage('1-deliver', 'Delivery'), stage('2-accept', 'Acceptance')],
      },
      {
        id: 'internal-capability',
        label: 'Internal capability',
        lifecycleMeaning: 'Internal capability lifecycle',
        compatibleKinds: ['internal-program'],
        stages: [stage('0-intake', 'Intake'), stage('1-operate', 'Operate')],
      },
    ],
  }
}

test('dry-run derives a shallow Thoughtseed destination without writing', async () => {
  const fx = await fixture()
  const result = await executeProjectBirth({ action: action(), ...fx, workflowId: 'sapling-product', execute: false })
  assert.equal(result.relativePath, 'thoughtseed/project-nova')
  assert.equal(result.derivedKind, 'sapling')
  assert.deepEqual(result.workflow.stages.map((stage) => stage.id), ['0-discover', '1-brand', '7-ship'])
  await assert.rejects(() => readFile(join(fx.projectsRoot, result.relativePath, 'PROJECT.md')), /ENOENT/)
  assert.equal(JSON.stringify(result).includes(fx.projectsRoot), false)
})

test('repository-owned registry selects the Sapling workflow by default', async () => {
  const fx = await fixture()
  const result = await executeProjectBirth({
    action: action(),
    projectsRoot: fx.projectsRoot,
    execute: false,
  })
  assert.equal(result.workflow.id, 'sapling-product')
  assert.deepEqual(result.workflow.compatibleKinds, ['sapling'])
  assert.match(result.workflow.digest, /^sha256:[0-9a-f]{64}$/)
  assert.match(result.workflow.registryDigest, /^sha256:[0-9a-f]{64}$/)
  assert.equal((await lstat(DEFAULT_WORKFLOW_REGISTRY_PATH)).isFile(), true)
})

test('repository-owned registry selects the Client Branch workflow by default', async () => {
  const fx = await fixture()
  const result = await executeProjectBirth({
    action: action({
      origin: 'client',
      derivedKind: 'client-branch',
      clientFamilyId: 'client-acme',
    }),
    projectsRoot: fx.projectsRoot,
    execute: false,
  })
  assert.equal(result.derivedKind, 'client-branch')
  assert.equal(result.workflow.id, 'client-delivery')
  assert.deepEqual(result.workflow.compatibleKinds, ['client-branch'])
})

test('workflow selection fails closed when kind compatibility does not match origin', async () => {
  const fx = await fixture()
  await assert.rejects(
    () => executeProjectBirth({
      action: action(),
      projectsRoot: fx.projectsRoot,
      workflowId: 'client-delivery',
      execute: false,
    }),
    /workflow_kind_incompatible/,
  )
  await assert.rejects(() => lstat(join(fx.projectsRoot, 'thoughtseed', 'project-nova')), /ENOENT/)
})

test('explicit workflow registries must be absolute regular files', async () => {
  const fx = await fixture()
  await assert.rejects(
    () => executeProjectBirth({
      action: action(),
      projectsRoot: fx.projectsRoot,
      workflowRegistryPath: 'workflow-registry.json',
      execute: false,
    }),
    /workflow_registry_must_be_absolute/,
  )

  const linkedRegistry = join(fx.projectsRoot, 'linked-workflow-registry.json')
  await symlink(fx.workflowRegistryPath, linkedRegistry)
  await assert.rejects(
    () => executeProjectBirth({
      action: action(),
      projectsRoot: fx.projectsRoot,
      workflowRegistryPath: linkedRegistry,
      execute: false,
    }),
    /workflow_registry_path_invalid/,
  )
})

test('current Workbench action binds classification source and complete catalog separately', () => {
  const normalized = normalizeProjectCreationAction(action())
  assert.equal(normalized.rootMapDigest, REVIEWED_ROOT_MAP_DIGEST)
  assert.equal(normalized.sourceDigest, REVIEWED_ACTION_SOURCE_DIGEST)
  assert.equal(normalized.sourceDigest, REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST)
  assert.equal(normalized.catalogDigest, REVIEWED_ACTION_CATALOG_DIGEST)
  assert.equal(normalized.catalogDigest, REVIEWED_PORTFOLIO_CATALOG_DIGEST)
  assert.match(normalized.catalogDigest, /^sha256:[0-9a-f]{64}$/)
  assert.notEqual(normalized.catalogDigest, normalized.sourceDigest)
})

test('creation intent digest binds all three reviewed foundation pins', () => {
  const normalized = normalizeProjectCreationAction(action())
  const digest = projectCreationIntentDigest(normalized)
  for (const [field, value] of [
    ['rootMapDigest', alterFirstHex(normalized.rootMapDigest)],
    ['sourceDigest', alterFirstHex(normalized.sourceDigest)],
    ['catalogDigest', alterFirstHex(normalized.catalogDigest)],
  ]) {
    assert.notEqual(projectCreationIntentDigest({ ...normalized, [field]: value }), digest, field)
  }
})

test('local founder execution creates Git, packet, stages, and pending index receipts', async () => {
  const fx = await fixture()
  const result = await executeProjectBirth({ action: action(), ...fx, workflowId: 'sapling-product', execute: true })
  const target = join(fx.projectsRoot, result.relativePath)
  for (const relativePath of [
    'PROJECT.md', 'AGENTS.md', 'CLAUDE.md', '.project/project.yaml', '.project/CONTEXT.md',
    '.project/HANDOFF.md', '.project/WORKFLOW.md', '.project/project-ingestion-receipt.v1.json',
    '.project/project-index-proposal.v1.json', '.git/HEAD',
  ]) assert.equal((await readFile(join(target, relativePath), 'utf8')).length > 0, true, relativePath)
  for (const stage of ['0-discover', '1-brand', '7-ship']) await assert.rejects(
    () => writeFile(join(target, stage), 'not-a-file', { flag: 'wx' }),
    /EEXIST/,
  )
  const receipt = JSON.parse(await readFile(join(target, '.project/project-ingestion-receipt.v1.json'), 'utf8'))
  const index = JSON.parse(await readFile(join(target, '.project/project-index-proposal.v1.json'), 'utf8'))
  assert.equal(receipt.status, 'pending-cambium-ingestion')
  assert.equal(index.relativePath, 'thoughtseed/project-nova')
  assert.equal(index.githubPlanningAuthority, 'pending')
  assert.equal(receipt.workflowId, 'sapling-product')
  assert.equal(index.workflowId, 'sapling-product')
  assert.match(receipt.workflowDigest, /^sha256:[0-9a-f]{64}$/)
  assert.equal(receipt.workflowDigest, index.workflowDigest)
  assert.equal(receipt.workflowRegistryDigest, index.workflowRegistryDigest)
  assert.deepEqual(receipt.workflowStages, ['0-discover', '1-brand', '7-ship'])
  assert.deepEqual(receipt.workflowStages, index.workflowStages)
  assert.equal(JSON.stringify({ receipt, index }).includes(fx.projectsRoot), false)
})

test('agent execution requires a trusted Founder Gate resolver bound to the exact intent', async () => {
  const fx = await fixture()
  const pending = action({ requestSource: 'agent' })
  await assert.rejects(
    () => executeProjectBirth({ action: pending, ...fx, workflowId: 'sapling-product', execute: true }),
    /founder_gate_approval_required/,
  )
  const normalized = normalizeProjectCreationAction(pending)
  const approved = action({
    requestSource: 'agent',
    founderApproval: { receiptId: 'gate_project_nova_approved', intentDigest: projectCreationIntentDigest(normalized) },
  }, { idempotencyKey: 'project-nova-approved-1' })
  await assert.rejects(
    () => executeProjectBirth({ action: approved, ...fx, workflowId: 'sapling-product', execute: true }),
    /trusted_founder_gate_resolver_required/,
  )
  await assert.rejects(
    () => executeProjectBirth({
      action: approved,
      ...fx,
      workflowId: 'sapling-product',
      execute: true,
      founderGateResolver: async (receiptId) => ({
        id: receiptId,
        kind: 'approve',
        subject: `sha256:${'f'.repeat(64)}`,
        founderId: 'founder-1',
        status: 'queued',
      }),
    }),
    /founder_gate_approval_not_verified/,
  )
  const founderGateResolver = async (receiptId) => ({
    id: receiptId,
    kind: 'approve',
    subject: projectCreationIntentDigest(normalizeProjectCreationAction(approved)),
    founderId: 'founder-1',
    status: 'queued',
  })
  const result = await executeProjectBirth({
    action: approved,
    ...fx,
    workflowId: 'sapling-product',
    execute: true,
    founderGateResolver,
  })
  assert.equal(result.approvalReceiptId, 'gate_project_nova_approved')
})

test('executor rejects stale but valid-shaped root and catalog digests', async () => {
  const fx = await fixture()
  await assert.rejects(
    () => executeProjectBirth({ action: action({}, { rootMapDigest: '0'.repeat(64) }), ...fx, workflowId: 'sapling-product', execute: false }),
    /root_map_digest_not_reviewed/,
  )
  await assert.rejects(
    () => executeProjectBirth({ action: action({}, { sourceDigest: '0'.repeat(64) }), ...fx, workflowId: 'sapling-product', execute: false }),
    /source_digest_not_reviewed/,
  )
  await assert.rejects(
    () => executeProjectBirth({ action: action({}, { catalogDigest: `sha256:${'0'.repeat(64)}` }), ...fx, workflowId: 'sapling-product', execute: false }),
    /catalog_digest_not_reviewed/,
  )
  const { catalogDigest: _catalogDigest, ...missingCatalogDigest } = action()
  await assert.rejects(
    () => executeProjectBirth({ action: missingCatalogDigest, ...fx, workflowId: 'sapling-product', execute: false }),
    /action_fields_invalid/,
  )
})

test('unknown origin, derived-kind overrides, unsafe stage names, and existing targets fail closed', async () => {
  const unknownFx = await fixture()
  await assert.rejects(
    () => executeProjectBirth({ action: action({ origin: 'unknown', derivedKind: 'needs-review' }), ...unknownFx, workflowId: 'sapling-product', execute: true }),
    /unknown_origin_requires_review/,
  )
  const kindFx = await fixture()
  await assert.rejects(
    () => executeProjectBirth({ action: action({ derivedKind: 'client-branch' }), ...kindFx, workflowId: 'sapling-product', execute: false }),
    /derived_kind_mismatch/,
  )
  const stageFx = await fixture()
  const unsafeRegistry = registryFixture()
  unsafeRegistry.workflows[0].stages[0].id = '../escape'
  await writeFile(stageFx.workflowRegistryPath, JSON.stringify(unsafeRegistry))
  await assert.rejects(
    () => executeProjectBirth({ action: action(), ...stageFx, workflowId: 'sapling-product', execute: false }),
    /workflow_stage_invalid/,
  )
  const existingFx = await fixture()
  await mkdir(join(existingFx.projectsRoot, 'thoughtseed', 'project-nova'))
  await assert.rejects(
    () => executeProjectBirth({ action: action(), ...existingFx, workflowId: 'sapling-product', execute: false }),
    /project_destination_exists/,
  )
})

test('executor rejects symlinked project roots and Thoughtseed roots', async () => {
  const rootParent = await mkdtemp(join(tmpdir(), 'thoughtseed-project-birth-symlink-root-'))
  const actualRoot = join(rootParent, 'actual')
  await mkdir(join(actualRoot, 'thoughtseed'), { recursive: true })
  const linkedRoot = join(rootParent, 'linked')
  await symlink(actualRoot, linkedRoot)
  const workflowRegistryPath = join(rootParent, 'workflow-registry.json')
  await writeFile(workflowRegistryPath, JSON.stringify(registryFixture()))
  await assert.rejects(
    () => executeProjectBirth({ action: action(), projectsRoot: linkedRoot, workflowRegistryPath, workflowId: 'sapling-product', execute: false }),
    /projects_root_invalid/,
  )

  const portfolioRoot = await mkdtemp(join(tmpdir(), 'thoughtseed-project-birth-symlink-portfolio-'))
  const actualThoughtseed = join(rootParent, 'actual-thoughtseed')
  await mkdir(actualThoughtseed)
  await symlink(actualThoughtseed, join(portfolioRoot, 'thoughtseed'))
  await assert.rejects(
    () => executeProjectBirth({ action: action(), projectsRoot: portfolioRoot, workflowRegistryPath, workflowId: 'sapling-product', execute: false }),
    /thoughtseed_root_invalid/,
  )
})

test('executor removes the exact new target after a partial creation failure', async () => {
  const fx = await fixture()
  const target = join(fx.projectsRoot, 'thoughtseed', 'project-nova')
  const originalPath = process.env.PATH
  process.env.PATH = '/definitely-missing-cambium-project-birth-bin'
  try {
    await assert.rejects(
      () => executeProjectBirth({ action: action(), ...fx, workflowId: 'sapling-product', execute: true }),
      /git_init_failed/,
    )
  } finally {
    if (originalPath === undefined) delete process.env.PATH
    else process.env.PATH = originalPath
  }
  await assert.rejects(() => lstat(target), /ENOENT/)
  assert.equal((await lstat(join(fx.projectsRoot, 'thoughtseed'))).isDirectory(), true)
})
