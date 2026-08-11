#!/usr/bin/env node

import { createHash } from 'node:crypto'
import {
  lstat,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises'
import { dirname, isAbsolute, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  isReviewedPortfolioWorkId,
  reviewedPortfolioWorkName,
  REVIEWED_ACTION_CATALOG_DIGEST,
  REVIEWED_ACTION_SOURCE_DIGEST,
  REVIEWED_PORTFOLIO_CATALOG_DIGEST,
  REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST,
  REVIEWED_ROOT_MAP_DIGEST,
} from './portfolio-foundation-pins.mjs'

export {
  REVIEWED_ACTION_CATALOG_DIGEST,
  REVIEWED_ACTION_SOURCE_DIGEST,
  REVIEWED_PORTFOLIO_CATALOG_DIGEST,
  REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST,
  REVIEWED_ROOT_MAP_DIGEST,
}

export const PROJECT_CLOSEOUT_SCHEMA = 'thoughtseed.project-closeout.v1'
export const PROJECT_CLOSEOUT_RECEIPT_SCHEMA = 'thoughtseed.project-closeout-receipt.v1'
export const AGENT_MEMORY_PROJECTION_SCHEMA = 'thoughtseed.agent-memory-projection.v1'
export const FINISHED_INDEX_DELTA_SCHEMA = 'thoughtseed.portfolio-finished-index-delta.v1'

const SAFE_DOC_PATH = /^(?:[.]project|docs)\/[A-Za-z0-9._/-]+\.(?:md|json)$/
const SAFE_R2_PREFIX = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{7,219}$/
const SAFE_SUBJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,159}$/
const DISPOSITIONS = new Set(['completed', 'closed', 'terminated'])
const ACTIVE_INDEX_DISPOSITIONS = new Set(['remove-from-active', 'mark-finished'])

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

function text(value, label, max, required = true) {
  if (typeof value !== 'string') throw new Error(`${label}_invalid`)
  const normalized = value.replace(/\s+/g, ' ').trim()
  if ((required && !normalized) || normalized.length > max) throw new Error(`${label}_invalid`)
  return normalized
}

function docPath(value, label) {
  const normalized = text(value, label, 160)
  if (!SAFE_DOC_PATH.test(normalized) || normalized.includes('..') || normalized.includes('//')) {
    throw new Error(`${label}_invalid`)
  }
  return normalized
}

function confirmed(value, label) {
  if (value !== true) throw new Error(`${label}_not_confirmed`)
  return true
}

function normalizeProposal(raw) {
  exactFields(raw, [
    'closeoutSchema',
    'disposition',
    'finalSummary',
    'handoffMarkdownPath',
    'closureReceiptJsonPath',
    'agentMemoryJsonPath',
    'r2VaultPrefix',
    'activeIndexDisposition',
    'repositoryFinalStateReviewed',
    'handoffDocumented',
    'r2VaultRecorded',
    'agentMemoryUpdated',
    'activeIndexUpdated',
    'downstreamFlowsStopped',
    'successorWorkObjectId',
  ], 'proposal')
  if (raw.closeoutSchema !== PROJECT_CLOSEOUT_SCHEMA) throw new Error('closeout_schema_invalid')
  if (!DISPOSITIONS.has(raw.disposition)) throw new Error('disposition_invalid')
  if (!ACTIVE_INDEX_DISPOSITIONS.has(raw.activeIndexDisposition)) throw new Error('active_index_disposition_invalid')
  const r2VaultPrefix = text(raw.r2VaultPrefix, 'r2_vault_prefix', 220)
  if (!SAFE_R2_PREFIX.test(r2VaultPrefix) || r2VaultPrefix.includes('..') || r2VaultPrefix.includes('//')) {
    throw new Error('r2_vault_prefix_invalid')
  }
  const successorWorkObjectId = text(raw.successorWorkObjectId, 'successor_work_object_id', 160, false)
  if (successorWorkObjectId && !SAFE_SUBJECT_ID.test(successorWorkObjectId)) throw new Error('successor_work_object_id_invalid')
  return {
    closeoutSchema: PROJECT_CLOSEOUT_SCHEMA,
    disposition: raw.disposition,
    finalSummary: text(raw.finalSummary, 'final_summary', 1200),
    handoffMarkdownPath: docPath(raw.handoffMarkdownPath, 'handoff_markdown_path'),
    closureReceiptJsonPath: docPath(raw.closureReceiptJsonPath, 'closure_receipt_json_path'),
    agentMemoryJsonPath: docPath(raw.agentMemoryJsonPath, 'agent_memory_json_path'),
    r2VaultPrefix,
    activeIndexDisposition: raw.activeIndexDisposition,
    repositoryFinalStateReviewed: confirmed(raw.repositoryFinalStateReviewed, 'repository_final_state_reviewed'),
    handoffDocumented: confirmed(raw.handoffDocumented, 'handoff_documented'),
    r2VaultRecorded: confirmed(raw.r2VaultRecorded, 'r2_vault_recorded'),
    agentMemoryUpdated: confirmed(raw.agentMemoryUpdated, 'agent_memory_updated'),
    activeIndexUpdated: confirmed(raw.activeIndexUpdated, 'active_index_updated'),
    downstreamFlowsStopped: confirmed(raw.downstreamFlowsStopped, 'downstream_flows_stopped'),
    successorWorkObjectId,
  }
}

function validateCloseoutIdentityBinding(proposal, subjectId) {
  if (!isReviewedPortfolioWorkId(subjectId)) throw new Error('closeout_subject_not_canonical')
  const expectedSuffix = `/${subjectId.replaceAll(':', '-')}`
  if (!proposal.r2VaultPrefix.endsWith(expectedSuffix)) throw new Error('r2_vault_prefix_subject_mismatch')
  if (proposal.successorWorkObjectId && !isReviewedPortfolioWorkId(proposal.successorWorkObjectId)) {
    throw new Error('successor_work_object_not_canonical')
  }
  if (proposal.successorWorkObjectId === subjectId) throw new Error('successor_work_object_matches_subject')
}

export function normalizeProjectCloseoutAction(raw) {
  exactFields(raw, ['schema', 'kind', 'portfolioId', 'idempotencyKey', 'rootMapDigest', 'sourceDigest', 'catalogDigest', 'subject', 'proposal'], 'action')
  if (raw.schema !== 'thoughtseed.portfolio-admin-action.v1' || raw.kind !== 'close-work-object' || raw.portfolioId !== 'thoughtseed') {
    throw new Error('project_closeout_action_invalid')
  }
  if (raw.rootMapDigest !== REVIEWED_ROOT_MAP_DIGEST) throw new Error('root_map_digest_not_reviewed')
  if (raw.sourceDigest !== REVIEWED_ACTION_SOURCE_DIGEST) throw new Error('source_digest_not_reviewed')
  if (raw.catalogDigest !== REVIEWED_ACTION_CATALOG_DIGEST) throw new Error('catalog_digest_not_reviewed')
  exactFields(raw.subject, ['id', 'name'], 'subject')
  const subjectId = text(raw.subject.id, 'subject_id', 160)
  if (!SAFE_SUBJECT_ID.test(subjectId)) throw new Error('subject_id_invalid')
  const subjectName = text(raw.subject.name, 'subject_name', 160)
  if (reviewedPortfolioWorkName(subjectId) !== subjectName) throw new Error('closeout_subject_not_canonical')
  const proposal = normalizeProposal(raw.proposal)
  validateCloseoutIdentityBinding(proposal, subjectId)
  return {
    schema: 'thoughtseed.portfolio-admin-action.v1',
    kind: 'close-work-object',
    portfolioId: 'thoughtseed',
    idempotencyKey: text(raw.idempotencyKey, 'idempotency_key', 128),
    rootMapDigest: raw.rootMapDigest,
    sourceDigest: raw.sourceDigest,
    catalogDigest: raw.catalogDigest,
    subject: {
      id: subjectId,
      name: subjectName,
    },
    proposal,
  }
}

export function projectCloseoutDigest(action) {
  return `sha256:${sha256(canonicalJson({
    portfolioId: action.portfolioId,
    kind: action.kind,
    rootMapDigest: action.rootMapDigest,
    sourceDigest: action.sourceDigest,
    catalogDigest: action.catalogDigest,
    subject: action.subject,
    proposal: action.proposal,
  }))}`
}

function safeOutputPath(projectRoot, relativePath) {
  const normalized = docPath(relativePath, 'output_path')
  const root = resolve(projectRoot)
  const target = resolve(root, normalized)
  if (!target.startsWith(`${root}${sep}`)) throw new Error('output_path_escapes_project')
  return { relativePath: normalized, absolutePath: target }
}

async function assertProjectRoot(projectRoot) {
  if (!isAbsolute(projectRoot)) throw new Error('project_root_must_be_absolute')
  const root = resolve(projectRoot)
  const stat = await lstat(root)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('project_root_invalid')
  const projectFile = await lstat(resolve(root, 'PROJECT.md'))
  const projectDir = await lstat(resolve(root, '.project'))
  if (!projectFile.isFile() || projectFile.isSymbolicLink() || !projectDir.isDirectory() || projectDir.isSymbolicLink()) {
    throw new Error('project_packet_missing')
  }
  return root
}

async function writeNewJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
}

async function upsertHandoff(path, content) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  let prior = ''
  try {
    prior = await readFile(path, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  await writeFile(path, `${prior.trimEnd()}${prior ? '\n\n' : ''}${content}\n`, { encoding: 'utf8', mode: 0o600 })
}

export async function planProjectCloseout({ action: rawAction, projectRoot, now = () => new Date().toISOString() }) {
  const action = normalizeProjectCloseoutAction(rawAction)
  const root = await assertProjectRoot(projectRoot)
  const closeoutDigest = projectCloseoutDigest(action)
  const closedAt = now()
  if (!Number.isFinite(Date.parse(closedAt))) throw new Error('server_clock_invalid')
  const handoff = safeOutputPath(root, action.proposal.handoffMarkdownPath)
  const closeoutReceipt = safeOutputPath(root, action.proposal.closureReceiptJsonPath)
  const memoryProjection = safeOutputPath(root, action.proposal.agentMemoryJsonPath)
  const finishedIndexDelta = safeOutputPath(root, '.project/finished-index-delta.v1.json')
  return {
    schema: 'thoughtseed.project-closeout-plan.v1',
    portfolioId: 'thoughtseed',
    workObjectId: action.subject.id,
    workObjectName: action.subject.name,
    disposition: action.proposal.disposition,
    active: false,
    finished: true,
    activeIndexDisposition: action.proposal.activeIndexDisposition,
    closeoutDigest,
    closedAt,
    r2VaultPrefix: action.proposal.r2VaultPrefix,
    outputs: {
      handoffMarkdownPath: handoff.relativePath,
      closureReceiptJsonPath: closeoutReceipt.relativePath,
      agentMemoryJsonPath: memoryProjection.relativePath,
      finishedIndexDeltaPath: finishedIndexDelta.relativePath,
    },
    r2VaultObjects: [
      { kind: 'final-handoff-markdown', sourcePath: handoff.relativePath, target: `${action.proposal.r2VaultPrefix}/final-handoff.md` },
      { kind: 'closeout-receipt-json', sourcePath: closeoutReceipt.relativePath, target: `${action.proposal.r2VaultPrefix}/project-closeout-receipt.v1.json` },
      { kind: 'agent-memory-json', sourcePath: memoryProjection.relativePath, target: `${action.proposal.r2VaultPrefix}/agent-memory-projection.v1.json` },
      { kind: 'finished-index-delta-json', sourcePath: finishedIndexDelta.relativePath, target: `${action.proposal.r2VaultPrefix}/finished-index-delta.v1.json` },
    ],
    absoluteOutputs: { handoff, closeoutReceipt, memoryProjection, finishedIndexDelta },
    action,
  }
}

export async function executeProjectCloseout(options) {
  const plan = await planProjectCloseout(options)
  const { absoluteOutputs: _absoluteOutputs, action: _action, ...safePlan } = plan
  if (!options.execute) return { ...safePlan, dryRun: true }
  const receipt = {
    schema: PROJECT_CLOSEOUT_RECEIPT_SCHEMA,
    status: 'completed-closed',
    portfolioId: plan.portfolioId,
    workObjectId: plan.workObjectId,
    workObjectName: plan.workObjectName,
    disposition: plan.disposition,
    active: false,
    finished: true,
    activeIndexDisposition: plan.activeIndexDisposition,
    closeoutDigest: plan.closeoutDigest,
    closedAt: plan.closedAt,
    r2VaultPrefix: plan.r2VaultPrefix,
    r2VaultObjects: plan.r2VaultObjects,
    finalSummary: plan.action.proposal.finalSummary,
    successorWorkObjectId: plan.action.proposal.successorWorkObjectId || null,
  }
  const memoryProjection = {
    schema: AGENT_MEMORY_PROJECTION_SCHEMA,
    portfolioId: plan.portfolioId,
    workObjectId: plan.workObjectId,
    active: false,
    finished: true,
    disposition: plan.disposition,
    closedAt: plan.closedAt,
    summary: plan.action.proposal.finalSummary,
    r2VaultPrefix: plan.r2VaultPrefix,
  }
  const finishedIndexDelta = {
    schema: FINISHED_INDEX_DELTA_SCHEMA,
    portfolioId: plan.portfolioId,
    workObjectId: plan.workObjectId,
    activeIndexDisposition: plan.activeIndexDisposition,
    removeFromActive: plan.activeIndexDisposition === 'remove-from-active',
    addToFinished: true,
    closedAt: plan.closedAt,
    closeoutDigest: plan.closeoutDigest,
  }
  const handoffSection = [
    '## Project closeout',
    '',
    `- Status: \`completed-closed\``,
    `- Disposition: \`${plan.disposition}\``,
    `- WorkObject: \`${plan.workObjectId}\``,
    `- Closed at: \`${plan.closedAt}\``,
    `- Closeout digest: \`${plan.closeoutDigest}\``,
    `- R2 vault prefix: \`${plan.r2VaultPrefix}\``,
    `- Active index: \`${plan.activeIndexDisposition}\``,
    `- Summary: ${plan.action.proposal.finalSummary}`,
  ].join('\n')
  await upsertHandoff(plan.absoluteOutputs.handoff.absolutePath, handoffSection)
  await writeNewJson(plan.absoluteOutputs.closeoutReceipt.absolutePath, receipt)
  await writeNewJson(plan.absoluteOutputs.memoryProjection.absolutePath, memoryProjection)
  await writeNewJson(plan.absoluteOutputs.finishedIndexDelta.absolutePath, finishedIndexDelta)
  return { ...safePlan, dryRun: false, receipt, memoryProjection, finishedIndexDelta }
}

function parseArgs(argv) {
  const values = { execute: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--execute') values.execute = true
    else if (['--intent', '--project-root'].includes(argument)) {
      const value = argv[++index]
      if (!value || value.startsWith('--')) throw new Error(`missing_value:${argument}`)
      values[argument.slice(2)] = value
    } else throw new Error(`unknown_argument:${argument}`)
  }
  for (const required of ['intent', 'project-root']) {
    if (!values[required]) throw new Error(`missing_argument:--${required}`)
  }
  return values
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const action = JSON.parse(await readFile(resolve(args.intent), 'utf8'))
  const result = await executeProjectCloseout({
    action,
    projectRoot: resolve(args['project-root']),
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
