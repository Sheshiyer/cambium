import assert from 'node:assert/strict'
import { lstat, mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  executeProjectBirth,
  normalizeProjectCreationAction,
  projectCreationIntentDigest,
  REVIEWED_PORTFOLIO_CATALOG_DIGEST,
  REVIEWED_ROOT_MAP_DIGEST,
} from './thoughtseed-project-birth.mjs'

const ROOT_DIGEST = REVIEWED_ROOT_MAP_DIGEST
const SOURCE_DIGEST = REVIEWED_PORTFOLIO_CATALOG_DIGEST

function action(proposal = {}, top = {}) {
  return {
    schema: 'thoughtseed.portfolio-admin-action.v1',
    kind: 'create-thoughtseed-project',
    portfolioId: 'thoughtseed',
    idempotencyKey: 'project-nova-create-1',
    rootMapDigest: ROOT_DIGEST,
    sourceDigest: SOURCE_DIGEST,
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
  await writeFile(workflowRegistryPath, JSON.stringify({
    version: 2,
    workflows: [{ id: 'website-delivery', stages: [
      { id: '0-discover', label: 'Discovery' },
      { id: '1-brand', label: 'Brand' },
      { id: '7-ship', label: 'Ship' },
    ] }],
  }))
  return { projectsRoot, workflowRegistryPath }
}

test('dry-run derives a shallow Thoughtseed destination without writing', async () => {
  const fx = await fixture()
  const result = await executeProjectBirth({ action: action(), ...fx, workflowId: 'website-delivery', execute: false })
  assert.equal(result.relativePath, 'thoughtseed/project-nova')
  assert.equal(result.derivedKind, 'sapling')
  assert.deepEqual(result.workflow.stages.map((stage) => stage.id), ['0-discover', '1-brand', '7-ship'])
  await assert.rejects(() => readFile(join(fx.projectsRoot, result.relativePath, 'PROJECT.md')), /ENOENT/)
  assert.equal(JSON.stringify(result).includes(fx.projectsRoot), false)
})

test('local founder execution creates Git, packet, stages, and pending index receipts', async () => {
  const fx = await fixture()
  const result = await executeProjectBirth({ action: action(), ...fx, workflowId: 'website-delivery', execute: true })
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
  assert.equal(JSON.stringify({ receipt, index }).includes(fx.projectsRoot), false)
})

test('agent execution requires a trusted Founder Gate resolver bound to the exact intent', async () => {
  const fx = await fixture()
  const pending = action({ requestSource: 'agent' })
  await assert.rejects(
    () => executeProjectBirth({ action: pending, ...fx, workflowId: 'website-delivery', execute: true }),
    /founder_gate_approval_required/,
  )
  const normalized = normalizeProjectCreationAction(pending)
  const approved = action({
    requestSource: 'agent',
    founderApproval: { receiptId: 'gate_project_nova_approved', intentDigest: projectCreationIntentDigest(normalized) },
  }, { idempotencyKey: 'project-nova-approved-1' })
  await assert.rejects(
    () => executeProjectBirth({ action: approved, ...fx, workflowId: 'website-delivery', execute: true }),
    /trusted_founder_gate_resolver_required/,
  )
  await assert.rejects(
    () => executeProjectBirth({
      action: approved,
      ...fx,
      workflowId: 'website-delivery',
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
    workflowId: 'website-delivery',
    execute: true,
    founderGateResolver,
  })
  assert.equal(result.approvalReceiptId, 'gate_project_nova_approved')
})

test('executor rejects stale but valid-shaped root and catalog digests', async () => {
  const fx = await fixture()
  await assert.rejects(
    () => executeProjectBirth({ action: action({}, { rootMapDigest: '0'.repeat(64) }), ...fx, workflowId: 'website-delivery', execute: false }),
    /root_map_digest_not_reviewed/,
  )
  await assert.rejects(
    () => executeProjectBirth({ action: action({}, { sourceDigest: '0'.repeat(64) }), ...fx, workflowId: 'website-delivery', execute: false }),
    /source_digest_not_reviewed/,
  )
})

test('unknown origin, derived-kind overrides, unsafe stage names, and existing targets fail closed', async () => {
  const unknownFx = await fixture()
  await assert.rejects(
    () => executeProjectBirth({ action: action({ origin: 'unknown', derivedKind: 'needs-review' }), ...unknownFx, workflowId: 'website-delivery', execute: true }),
    /unknown_origin_requires_review/,
  )
  const kindFx = await fixture()
  await assert.rejects(
    () => executeProjectBirth({ action: action({ derivedKind: 'client-branch' }), ...kindFx, workflowId: 'website-delivery', execute: false }),
    /derived_kind_mismatch/,
  )
  const stageFx = await fixture()
  await writeFile(stageFx.workflowRegistryPath, JSON.stringify({ workflows: [{ id: 'website-delivery', stages: [{ id: '../escape' }] }] }))
  await assert.rejects(
    () => executeProjectBirth({ action: action(), ...stageFx, workflowId: 'website-delivery', execute: false }),
    /workflow_stage_invalid/,
  )
  const existingFx = await fixture()
  await mkdir(join(existingFx.projectsRoot, 'thoughtseed', 'project-nova'))
  await assert.rejects(
    () => executeProjectBirth({ action: action(), ...existingFx, workflowId: 'website-delivery', execute: false }),
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
  await writeFile(workflowRegistryPath, JSON.stringify({
    workflows: [{ id: 'website-delivery', stages: [{ id: '0-discover', label: 'Discovery' }] }],
  }))
  await assert.rejects(
    () => executeProjectBirth({ action: action(), projectsRoot: linkedRoot, workflowRegistryPath, workflowId: 'website-delivery', execute: false }),
    /projects_root_invalid/,
  )

  const portfolioRoot = await mkdtemp(join(tmpdir(), 'thoughtseed-project-birth-symlink-portfolio-'))
  const actualThoughtseed = join(rootParent, 'actual-thoughtseed')
  await mkdir(actualThoughtseed)
  await symlink(actualThoughtseed, join(portfolioRoot, 'thoughtseed'))
  await assert.rejects(
    () => executeProjectBirth({ action: action(), projectsRoot: portfolioRoot, workflowRegistryPath, workflowId: 'website-delivery', execute: false }),
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
      () => executeProjectBirth({ action: action(), ...fx, workflowId: 'website-delivery', execute: true }),
      /git_init_failed/,
    )
  } finally {
    if (originalPath === undefined) delete process.env.PATH
    else process.env.PATH = originalPath
  }
  await assert.rejects(() => lstat(target), /ENOENT/)
  assert.equal((await lstat(join(fx.projectsRoot, 'thoughtseed'))).isDirectory(), true)
})
