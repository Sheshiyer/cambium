#!/usr/bin/env node

import { createHash } from 'node:crypto'
import {
  lstat,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const PROJECT_CREATION_INTENT_SCHEMA = 'thoughtseed.project-creation-intent.v1'
export const PROJECT_INGESTION_RECEIPT_SCHEMA = 'thoughtseed.project-ingestion-receipt.v1'
export const PROJECT_INDEX_PROPOSAL_SCHEMA = 'thoughtseed.project-index-proposal.v1'
export const REVIEWED_ROOT_MAP_DIGEST = '588f136a14cac55dbba30b11394288943c56bfebba2b700b4c2d25590747c52b'
export const REVIEWED_PORTFOLIO_CATALOG_DIGEST = '50ba63b213debb1df57423c4edf97df79f29d5c77875245dbbc45251266902d2'

const SAFE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
const SAFE_CLIENT_FAMILY = /^[a-z0-9][a-z0-9-]{0,63}$/
const SAFE_STAGE = /^[0-9]+-[a-z0-9]+(?:-[a-z0-9]+)*$/
const SAFE_GATE_RECEIPT = /^gate_[A-Za-z0-9._:-]{8,120}$/
const SHA256_REF = /^sha256:[0-9a-f]{64}$/
const REQUEST_SOURCES = new Set(['local-founder', 'agent', 'rbac', 'dgchat', 'system'])
const ORIGINS = new Set(['thoughtseed-venture', 'thoughtseed-internal', 'client', 'unknown'])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactFields(value, expected, label) {
  if (!isRecord(value)) throw new Error(`${label}_must_be_object`)
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length || actual.some((field, index) => field !== wanted[index])) {
    throw new Error(`${label}_fields_invalid`)
  }
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]))
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value))
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function deriveProjectKind(origin) {
  if (origin === 'thoughtseed-venture') return 'sapling'
  if (origin === 'thoughtseed-internal') return 'internal-program'
  if (origin === 'client') return 'client-branch'
  return 'needs-review'
}

function normalizedProposal(raw) {
  exactFields(raw, ['intentSchema', 'requestSource', 'name', 'slug', 'origin', 'derivedKind', 'clientFamilyId', 'founderApproval'], 'proposal')
  if (raw.intentSchema !== PROJECT_CREATION_INTENT_SCHEMA) throw new Error('intent_schema_invalid')
  if (!REQUEST_SOURCES.has(raw.requestSource)) throw new Error('request_source_invalid')
  if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.trim().length > 120) throw new Error('project_name_invalid')
  if (typeof raw.slug !== 'string' || !SAFE_SLUG.test(raw.slug)) throw new Error('project_slug_invalid')
  if (!ORIGINS.has(raw.origin)) throw new Error('project_origin_invalid')
  const derivedKind = deriveProjectKind(raw.origin)
  if (raw.derivedKind !== derivedKind) throw new Error('derived_kind_mismatch')
  if (typeof raw.clientFamilyId !== 'string') throw new Error('client_family_invalid')
  if (raw.origin === 'client' && !SAFE_CLIENT_FAMILY.test(raw.clientFamilyId)) throw new Error('client_family_required')
  if (raw.origin !== 'client' && raw.clientFamilyId !== '') throw new Error('client_family_not_allowed')
  if (raw.founderApproval !== null) {
    exactFields(raw.founderApproval, ['receiptId', 'intentDigest'], 'founder_approval')
    if (!SAFE_GATE_RECEIPT.test(raw.founderApproval.receiptId) || !SHA256_REF.test(raw.founderApproval.intentDigest)) {
      throw new Error('founder_approval_invalid')
    }
  }
  return {
    intentSchema: PROJECT_CREATION_INTENT_SCHEMA,
    requestSource: raw.requestSource,
    name: raw.name.trim(),
    slug: raw.slug,
    origin: raw.origin,
    derivedKind,
    clientFamilyId: raw.clientFamilyId,
    founderApproval: raw.founderApproval,
  }
}

export function normalizeProjectCreationAction(raw) {
  exactFields(raw, ['schema', 'kind', 'portfolioId', 'idempotencyKey', 'rootMapDigest', 'sourceDigest', 'subject', 'proposal'], 'action')
  if (raw.schema !== 'thoughtseed.portfolio-admin-action.v1' || raw.kind !== 'create-thoughtseed-project' || raw.portfolioId !== 'thoughtseed') {
    throw new Error('project_creation_action_invalid')
  }
  if (typeof raw.idempotencyKey !== 'string' || !raw.idempotencyKey) throw new Error('idempotency_key_invalid')
  if (raw.rootMapDigest !== REVIEWED_ROOT_MAP_DIGEST) throw new Error('root_map_digest_not_reviewed')
  if (raw.sourceDigest !== REVIEWED_PORTFOLIO_CATALOG_DIGEST) throw new Error('source_digest_not_reviewed')
  exactFields(raw.subject, ['id', 'name'], 'subject')
  const proposal = normalizedProposal(raw.proposal)
  if (raw.subject.id !== proposal.slug || raw.subject.name !== proposal.name) throw new Error('subject_proposal_mismatch')
  return {
    schema: 'thoughtseed.portfolio-admin-action.v1',
    kind: 'create-thoughtseed-project',
    portfolioId: 'thoughtseed',
    idempotencyKey: raw.idempotencyKey,
    rootMapDigest: raw.rootMapDigest,
    sourceDigest: raw.sourceDigest,
    subject: { id: proposal.slug, name: proposal.name },
    proposal,
  }
}

export function projectCreationIntentDigest(action) {
  const { founderApproval: _approval, ...proposal } = action.proposal
  const core = { portfolioId: action.portfolioId, kind: action.kind, subject: action.subject, proposal }
  return `sha256:${sha256(canonicalJson(core))}`
}

async function assertExecutionAuthority(action, founderGateResolver) {
  if (action.proposal.origin === 'unknown') throw new Error('unknown_origin_requires_review')
  if (action.proposal.requestSource === 'local-founder') {
    if (action.proposal.founderApproval !== null) throw new Error('local_founder_approval_not_allowed')
    return { approvalStatus: 'execution-ready', approvalReceiptId: null }
  }
  if (!action.proposal.founderApproval) throw new Error('founder_gate_approval_required')
  const expectedDigest = projectCreationIntentDigest(action)
  if (action.proposal.founderApproval.intentDigest !== expectedDigest) {
    throw new Error('founder_gate_intent_digest_mismatch')
  }
  if (typeof founderGateResolver !== 'function') throw new Error('trusted_founder_gate_resolver_required')
  const resolved = await founderGateResolver(action.proposal.founderApproval.receiptId)
  if (!isRecord(resolved)
    || resolved.id !== action.proposal.founderApproval.receiptId
    || resolved.kind !== 'approve'
    || resolved.subject !== expectedDigest
    || typeof resolved.founderId !== 'string'
    || !resolved.founderId.trim()
    || !['queued', 'consumed'].includes(resolved.status)) {
    throw new Error('founder_gate_approval_not_verified')
  }
  return { approvalStatus: 'execution-ready', approvalReceiptId: action.proposal.founderApproval.receiptId }
}

async function loadWorkflow(registryPath, workflowId) {
  if (!isAbsolute(registryPath)) throw new Error('workflow_registry_must_be_absolute')
  const registry = JSON.parse(await readFile(registryPath, 'utf8'))
  if (!isRecord(registry) || !Array.isArray(registry.workflows)) throw new Error('workflow_registry_invalid')
  const workflow = registry.workflows.find((candidate) => isRecord(candidate) && candidate.id === workflowId)
  if (!workflow || !Array.isArray(workflow.stages)) throw new Error('workflow_not_found')
  const stages = workflow.stages.map((stage) => {
    if (!isRecord(stage) || typeof stage.id !== 'string' || !SAFE_STAGE.test(stage.id)) throw new Error('workflow_stage_invalid')
    return { id: stage.id, label: typeof stage.label === 'string' ? stage.label : stage.id }
  })
  if (stages.length === 0 || new Set(stages.map((stage) => stage.id)).size !== stages.length) throw new Error('workflow_stages_invalid')
  return { id: workflowId, stages, digest: `sha256:${sha256(canonicalJson(workflow))}` }
}

function renderProjectPacket(action, workflow) {
  const { proposal } = action
  const workIdPrefix = proposal.derivedKind === 'client-branch' ? 'branch' : proposal.derivedKind === 'internal-program' ? 'program' : 'sapling'
  const workId = `${workIdPrefix}:${proposal.slug}`
  const projectYaml = [
    'schema_version: 1',
    `project_id: ${proposal.slug}`,
    'portfolio: thoughtseed',
    `repository: ${proposal.slug}`,
    `work_object_id: ${workId}`,
    `work_object_kind: ${proposal.derivedKind}`,
    `packet_status: draft-held`,
    `client_family_id: ${proposal.clientFamilyId || 'null'}`,
    'planning_authority: pending-github-repository',
    '',
  ].join('\n')
  const commonBoundary = 'This packet is draft-held. Folder creation does not authorize registry, Vault, R2, Goal Graph, provider, or production changes.'
  return {
    'PROJECT.md': `# ${proposal.name}\n\n- Portfolio: Thoughtseed\n- Repository: \`${proposal.slug}\`\n- Kind: \`${proposal.derivedKind}\`\n- Status: \`pending-cambium-ingestion\`\n\n${commonBoundary}\n`,
    'AGENTS.md': `# Agent operating contract\n\n1. Read \`PROJECT.md\` and \`.project/HANDOFF.md\` before work.\n2. Keep repository planning in GitHub after identity is established.\n3. Do not rewrite project classification; origin-derived kind is \`${proposal.derivedKind}\`.\n4. Agent-originated governed actions require Founder Gate approval.\n5. ${commonBoundary}\n`,
    'CLAUDE.md': `# Project context\n\nThis is a Thoughtseed \`${proposal.derivedKind}\` project. Treat \`.project/project-index-proposal.v1.json\` as pending ingestion evidence, not canonical portfolio authority.\n`,
    '.project/project.yaml': projectYaml,
    '.project/CONTEXT.md': `# Project context\n\nCreated through \`${PROJECT_CREATION_INTENT_SCHEMA}\`. GitHub repository identity and repository-owned planning remain pending.\n`,
    '.project/HANDOFF.md': `# Project handoff\n\n- Status: \`draft-held\`\n- Ingestion: \`pending-cambium-ingestion\`\n- Workflow: \`${workflow.id}\`\n- Next: establish GitHub identity, review this packet, then reconcile the Cambium project index.\n`,
    '.project/WORKFLOW.md': `# Workflow provenance\n\n- Workflow: \`${workflow.id}\`\n- Digest: \`${workflow.digest}\`\n\n${workflow.stages.map((stage) => `- \`${stage.id}\` — ${stage.label}`).join('\n')}\n`,
  }
}

async function assertRootAndTarget(projectsRoot, slug) {
  if (!isAbsolute(projectsRoot)) throw new Error('projects_root_must_be_absolute')
  const resolvedRoot = resolve(projectsRoot)
  const rootStat = await lstat(resolvedRoot)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('projects_root_invalid')
  const portfolioRoot = resolve(resolvedRoot, 'thoughtseed')
  const portfolioStat = await lstat(portfolioRoot)
  if (!portfolioStat.isDirectory() || portfolioStat.isSymbolicLink()) throw new Error('thoughtseed_root_invalid')
  const target = resolve(portfolioRoot, slug)
  if (dirname(target) !== portfolioRoot) throw new Error('project_destination_nested')
  try {
    await lstat(target)
    throw new Error('project_destination_exists')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  return { resolvedRoot, portfolioRoot, target, relativePath: `thoughtseed/${slug}` }
}

export async function planProjectBirth({ action: rawAction, projectsRoot, workflowRegistryPath, workflowId, founderGateResolver }) {
  const action = normalizeProjectCreationAction(rawAction)
  const authority = await assertExecutionAuthority(action, founderGateResolver)
  const workflow = await loadWorkflow(workflowRegistryPath, workflowId)
  const destination = await assertRootAndTarget(projectsRoot, action.proposal.slug)
  return {
    schema: 'thoughtseed.project-birth-plan.v1',
    portfolioId: 'thoughtseed',
    name: action.proposal.name,
    slug: action.proposal.slug,
    origin: action.proposal.origin,
    derivedKind: action.proposal.derivedKind,
    clientFamilyId: action.proposal.clientFamilyId || null,
    requestSource: action.proposal.requestSource,
    approvalStatus: authority.approvalStatus,
    approvalReceiptId: authority.approvalReceiptId,
    intentDigest: projectCreationIntentDigest(action),
    relativePath: destination.relativePath,
    workflow,
    action,
    target: destination.target,
  }
}

export async function executeProjectBirth(options) {
  const plan = await planProjectBirth(options)
  if (!options.execute) {
    const { action: _action, target: _target, ...safePlan } = plan
    return { ...safePlan, dryRun: true }
  }
  let created = false
  try {
    await mkdir(plan.target, { mode: 0o700 })
    created = true
    const git = spawnSync('git', ['init', '--quiet', '-b', 'main'], { cwd: plan.target, encoding: 'utf8' })
    if (git.status !== 0) throw new Error('git_init_failed')
    const packet = renderProjectPacket(plan.action, plan.workflow)
    for (const [relativePath, content] of Object.entries(packet)) {
      const absolutePath = join(plan.target, relativePath)
      await mkdir(dirname(absolutePath), { recursive: true, mode: 0o700 })
      await writeFile(absolutePath, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    }
    for (const stage of plan.workflow.stages) await mkdir(join(plan.target, stage.id), { mode: 0o700 })
    const receipt = {
      schema: PROJECT_INGESTION_RECEIPT_SCHEMA,
      status: 'pending-cambium-ingestion',
      portfolioId: 'thoughtseed',
      relativePath: plan.relativePath,
      requestSource: plan.requestSource,
      approvalStatus: plan.approvalStatus,
      approvalReceiptId: plan.approvalReceiptId,
      intentDigest: plan.intentDigest,
      workflowId: plan.workflow.id,
      workflowDigest: plan.workflow.digest,
    }
    const indexProposal = {
      schema: PROJECT_INDEX_PROPOSAL_SCHEMA,
      status: 'pending-cambium-ingestion',
      portfolioId: 'thoughtseed',
      folder: plan.slug,
      relativePath: plan.relativePath,
      proposedKind: plan.derivedKind,
      accountId: plan.clientFamilyId,
      workId: `${plan.derivedKind === 'client-branch' ? 'branch' : plan.derivedKind === 'internal-program' ? 'program' : 'sapling'}:${plan.slug}`,
      githubPlanningAuthority: 'pending',
      intentDigest: plan.intentDigest,
    }
    await writeFile(join(plan.target, '.project/project-ingestion-receipt.v1.json'), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    await writeFile(join(plan.target, '.project/project-index-proposal.v1.json'), `${JSON.stringify(indexProposal, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    const { action: _action, target: _target, ...safePlan } = plan
    return { ...safePlan, dryRun: false, receipt, indexProposal }
  } catch (error) {
    if (created) await rm(plan.target, { recursive: true, force: true })
    throw error
  }
}

function parseArgs(argv) {
  const values = { execute: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--execute') values.execute = true
    else if (['--intent', '--projects-root', '--workflow-registry', '--workflow-id'].includes(argument)) {
      const value = argv[++index]
      if (!value || value.startsWith('--')) throw new Error(`missing_value:${argument}`)
      values[argument.slice(2)] = value
    } else throw new Error(`unknown_argument:${argument}`)
  }
  for (const required of ['intent', 'projects-root', 'workflow-registry', 'workflow-id']) {
    if (!values[required]) throw new Error(`missing_argument:--${required}`)
  }
  return values
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const action = JSON.parse(await readFile(resolve(args.intent), 'utf8'))
  const result = await executeProjectBirth({
    action,
    projectsRoot: args['projects-root'],
    workflowRegistryPath: args['workflow-registry'],
    workflowId: args['workflow-id'],
    execute: args.execute,
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
