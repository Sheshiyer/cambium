import {
  RAW_CLASSIFICATION_REVIEW,
  RAW_HISTORICAL_PRODUCTS,
  RAW_PROGRAMS,
  RAW_SAPLINGS,
} from './portfolio-catalog-data.ts'
import { REPOSITORY_EVIDENCE } from './repository-evidence.generated.ts'
import {
  PORTFOLIO_ROOT_MAP_DIGEST,
  PORTFOLIO_ROOTS,
} from './portfolio-root-map.generated.ts'

export const WORKBENCH_SCHEMA = 'thoughtseed.portfolio-workbench.v4' as const
export const V3_SCHEMA = 'thoughtseed.portfolio-workbench.v3' as const
export const V2_SCHEMA = 'thoughtseed.portfolio-workbench.v2' as const
export const LEGACY_SCHEMA = 'thoughtseed.portfolio-cartographer.v1' as const
export const CARTOGRAPHER_SCHEMA = WORKBENCH_SCHEMA
export const CLASSIFICATION_DIGEST = '43630e6e65dfa78cd5c5e486b389308a8dede9d7bda012b400f4976107cdb309'
export const PORTFOLIO_CATALOG_DIGEST = 'sha256:1fcdc4dc690447ebd4bd23e228cd1a306440d8c37d65e6e56ea21e692eeacc24'
export const SOURCE_SCHEMA = 'thoughtseed.work-object-registry.v1'
export const SOURCE_GENERATED_AT = '2026-07-29T06:46:00Z'

export type Classification = 'sapling' | 'client-branch' | 'internal-program'
export type Horizon = 'now' | 'next' | 'this-year' | 'later' | 'park'
export type BoardHorizon = 'unscheduled' | Horizon
export type Priority = 1 | 2 | 3 | 4 | 5
export type PortfolioSignal = 'unplanned' | 'ongoing' | 'paused' | 'completed' | 'archived'
export type SmartView = 'all' | 'ongoing' | 'paused' | 'white-labelable' | 'needs-review' | 'unplanned' | 'completed-closed' | 'historical'
export type OrganId = 'genesis' | 'taste' | 'hands' | 'will' | 'cortex'
export type SignalStatus = 'ready' | 'complete' | 'blocked' | 'failed' | 'drifted'
export type Audience = 'internal' | 'client'
export type PlanningCategory = 'keep-canonical' | Classification | 'needs-review'
export type ReviewProposal = Classification | 'needs-review'
export type QuickPlanningDecision = 'now' | 'next' | 'later' | 'park' | 'needs-review'
export type WorkGroupKind = 'client-family' | 'saplings' | 'internal-programs'
export type PortfolioOrigin = 'thoughtseed-venture' | 'thoughtseed-internal' | 'client' | 'unknown'
export type DerivedClassification = Classification | 'needs-review'
export type RepositoryDisposition = 'resolved' | 'no-repository' | 'unmatched' | 'ambiguous'
export type PortfolioId = 'thoughtseed' | 'tryambakam-noesis'
export type PortfolioFolderKind = 'client-branch' | 'sapling' | 'internal-program' | 'needs-review' | 'project' | 'co-founded-venture'
export type PortfolioFolderStatus = 'mapping-proposal' | 'awaiting-ingestion' | 'empty-hold'
export type CloseoutDisposition = 'completed' | 'closed' | 'terminated'
export type ActiveIndexDisposition = 'remove-from-active' | 'mark-finished'

export interface PortfolioFolderMapping {
  portfolioId: PortfolioId
  portfolioLabel: string
  itemLabel: string
  folder: string
  path: string
  proposedKind: PortfolioFolderKind
  accountId: string | null
  workIds: readonly string[]
  status: PortfolioFolderStatus
}

export type PlanningAuthority =
  | { kind: 'repository'; repositoryId: string; fullName: string }
  | { kind: 'cambium'; reason: string }

export interface WorkObject {
  workId: string
  name: string
  classification: Classification
  lifecycle: string
  tenantStatus: string
  tenantId: string | null
  accountId: string | null
  linkedWorkIds: readonly string[]
  provenance: readonly string[]
  overlay: 'paused' | null
  commercialReuse: 'white-labelable' | null
}

export interface ReviewRecord {
  canonicalId: string
  source: string
  needed: string
}

export interface HistoricalRecord {
  canonicalId: string
  name: string
  status: string
  linkedCanonicalId: string | null
  provenance: readonly string[]
}

export interface OrganWorkflow {
  id: OrganId
  name: string
  glyph: string
  triggers: readonly string[]
  stages: readonly string[]
  skillHints: readonly string[]
  defaultTopic: string
  approval: 'none' | 'client-audience'
}

export interface DeliveryPlan {
  organ: OrganId
  trigger: string
  status: SignalStatus
  audience: Audience
}

export interface WorkPlan {
  signal: PortfolioSignal | null
  horizon: Horizon | null
  priority: Priority
  tags: string[]
  nextAction: string
  evidence: string
  delivery: DeliveryPlan
}

export interface WorkbenchState {
  focusedId: string | null
  plans: Record<string, WorkPlan>
  reviewDecisions: Record<string, ReviewDecision>
  retiredReviewDecisions: Record<string, ReviewDecision>
  reconciliations: Record<string, PortfolioReconciliation>
  closeouts: Record<string, ProjectCloseout>
}

export interface WorkbenchInput {
  focusedId: string | null
  plans: Record<string, WorkPlan>
  reviewDecisions?: Record<string, ReviewDecision>
  retiredReviewDecisions?: Record<string, ReviewDecision>
  reconciliations?: Record<string, PortfolioReconciliation>
  closeouts?: Record<string, ProjectCloseout>
}

export interface PortfolioReconciliation {
  workObjectId: string
  repositorySourceRef: string | null
  repositoryDisposition: RepositoryDisposition
  origin: PortfolioOrigin
  clientFamilyId: string
  planningAuthority: PlanningAuthority | null
  repositoryPlanningReviewed: boolean
  githubIssuesReviewed: boolean
  legacyEvidenceReviewed: boolean
  note: string
  updatedAt: string
}

export interface ProjectCloseout {
  workObjectId: string
  disposition: CloseoutDisposition
  finalSummary: string
  handoffMarkdownPath: string
  closureReceiptJsonPath: string
  agentMemoryJsonPath: string
  r2VaultPrefix: string
  activeIndexDisposition: ActiveIndexDisposition
  repositoryFinalStateReviewed: boolean
  handoffDocumented: boolean
  r2VaultRecorded: boolean
  agentMemoryUpdated: boolean
  activeIndexUpdated: boolean
  downstreamFlowsStopped: boolean
  successorWorkObjectId: string
  receiptId: string | null
  updatedAt: string
}

export interface IntakeReadiness {
  ready: boolean
  derivedType: DerivedClassification
  classificationMismatch: boolean
  blockers: string[]
}

export interface CloseoutReadiness {
  ready: boolean
  blockers: string[]
}

export interface ReusableIpProposal {
  proposedType: 'sapling'
  origin: 'thoughtseed-venture'
  name: string
  linkedWorkId: string
  preservesSourceType: 'client-branch'
}

export interface ReviewDecision {
  proposedType: ReviewProposal
  clientFamilyId: string
  note: string
  suggestionRule: string
  sourceDigest: string
}

export interface ReviewSuggestion {
  proposedType: ReviewProposal
  rationale: string
  ruleVersion: typeof REVIEW_SUGGESTION_RULE_VERSION
  sourceDigest: typeof CLASSIFICATION_DIGEST
}

export interface WorkObjectGroup {
  groupId: string
  label: string
  kind: WorkGroupKind
  accountId: string | null
  provenance: 'source-account' | 'source-classification'
  members: readonly WorkObject[]
  signalSummary: Readonly<Record<PortfolioSignal, number>>
}

export { PORTFOLIO_ROOT_MAP_DIGEST, PORTFOLIO_ROOTS }

export function portfolioRoot(portfolioId: PortfolioId) {
  const root = PORTFOLIO_ROOTS.find((candidate) => candidate.portfolioId === portfolioId)
  if (!root) throw new Error(`Unknown portfolio root: ${portfolioId}`)
  return root
}

function toPortfolioFolderMapping(
  portfolioId: PortfolioId,
  folder: (typeof PORTFOLIO_ROOTS)[number]['folders'][number],
): PortfolioFolderMapping {
  const root = portfolioRoot(portfolioId)
  return {
    portfolioId,
    portfolioLabel: root.label,
    itemLabel: root.itemLabel,
    folder: folder.folder,
    path: `${portfolioId}/${folder.folder}`,
    proposedKind: folder.proposedKind,
    accountId: folder.accountId,
    workIds: folder.workIds,
    status: folder.status,
  }
}

export function portfolioFolderMappings(portfolioId: PortfolioId): readonly PortfolioFolderMapping[] {
  const root = portfolioRoot(portfolioId)
  return root.folders.map((folder) => toPortfolioFolderMapping(portfolioId, folder))
}

export function portfolioFolderMappingsForWork(workId: string): readonly PortfolioFolderMapping[] {
  return portfolioFolderMappings('thoughtseed').filter((mapping) => mapping.workIds.includes(workId))
}

export function portfolioFolderMappingsForGroup(group: WorkObjectGroup): readonly PortfolioFolderMapping[] {
  const workIds = new Set(group.members.map((member) => member.workId))
  return portfolioFolderMappings('thoughtseed').filter((mapping) => (
    group.kind === 'client-family'
      ? group.accountId !== null && mapping.accountId === group.accountId
      : mapping.workIds.some((workId) => workIds.has(workId))
  ))
}

export interface Pipeline {
  workObjectId: string
  workObjectName: string
  organ: OrganId
  organName: string
  trigger: string
  stages: readonly string[]
  skillHints: readonly string[]
  topic: string
  escalationTopic: 'Alerts' | null
  requiresApproval: boolean
  horizon: BoardHorizon
  priority: Priority
  signal: PortfolioSignal
  status: SignalStatus
  audience: Audience
  nextAction: string
  evidence: string
  tags: readonly string[]
}

export interface ExportPacket extends WorkbenchState {
  schema: typeof WORKBENCH_SCHEMA
  version: 4
  source: {
    schema: string
    generatedAt: string
    classificationDigest: string
    authority: 'vault'
  }
  authority: {
    mode: 'proposal-only'
    operationalWriter: 'cambium-goal-graph-d1'
    telegramTransport: 'hermes'
  }
  pipelines: readonly Pipeline[]
  exportedAt: string
}

export const ORGAN_WORKFLOWS: readonly OrganWorkflow[] = [
  {
    id: 'genesis',
    name: 'Genesis',
    glyph: 'GE',
    triggers: ['brand-intake', 'brand-proof'],
    stages: ['intake', 'proof'],
    skillHints: ['brand discovery', 'visual identity'],
    defaultTopic: 'Inbox',
    approval: 'none',
  },
  {
    id: 'taste',
    name: 'Taste',
    glyph: 'TA',
    triggers: ['brief', 'qa', 'reroll'],
    stages: ['brief', 'quality review', 'reroll review'],
    skillHints: ['critique', 'quality review'],
    defaultTopic: 'Digests',
    approval: 'none',
  },
  {
    id: 'hands',
    name: 'Hands',
    glyph: 'HA',
    triggers: ['build', 'verification', 'ship'],
    stages: ['build', 'verification', 'ship gate'],
    skillHints: ['engineering', 'verification'],
    defaultTopic: 'Dev',
    approval: 'none',
  },
  {
    id: 'will',
    name: 'Will',
    glyph: 'WI',
    triggers: ['approved-business', 'client-delivery'],
    stages: ['business approval', 'client delivery'],
    skillHints: ['proposals', 'delivery operations'],
    defaultTopic: 'Clients',
    approval: 'client-audience',
  },
  {
    id: 'cortex',
    name: 'Cortex',
    glyph: 'CX',
    triggers: ['evidence', 'learning', 'drift'],
    stages: ['evidence', 'derived learning', 'drift review'],
    skillHints: ['evidence', 'systems learning'],
    defaultTopic: 'Agent Ops',
    approval: 'none',
  },
] as const

const saplings: WorkObject[] = RAW_SAPLINGS.map((row) => {
  const [workId, name, promotionState, tenantStatus, tenantId, provenance, linkedWorkIds = []] = row
  return {
    workId,
    name,
    classification: 'sapling',
    lifecycle: promotionState,
    tenantStatus,
    tenantId,
    accountId: null,
    linkedWorkIds,
    provenance,
    overlay: null,
    commercialReuse: null,
  }
})

const programs: WorkObject[] = RAW_PROGRAMS.map((row) => {
  const [
    workId,
    name,
    programKind,
    lifecycle,
    tenantStatus,
    tenantId,
    provenance,
    accountId,
    linkedWorkIds = [],
    overlay,
    commercialReuse,
  ] = row
  return {
    workId,
    name,
    classification: programKind === 'client' ? 'client-branch' : 'internal-program',
    lifecycle,
    tenantStatus,
    tenantId,
    accountId: accountId ?? null,
    linkedWorkIds,
    provenance,
    overlay: overlay ?? null,
    commercialReuse: commercialReuse ?? null,
  }
})

export const WORK_OBJECTS: readonly WorkObject[] = [...saplings, ...programs].sort((a, b) =>
  a.name.localeCompare(b.name),
)

export const REVIEW_RECORDS: readonly ReviewRecord[] = RAW_CLASSIFICATION_REVIEW.map(
  ([canonicalId, source, needed]) => ({ canonicalId, source, needed }),
)

export const HISTORICAL_RECORDS: readonly HistoricalRecord[] = RAW_HISTORICAL_PRODUCTS.map(
  ([canonicalId, name, status, linkedCanonicalId, source]) => ({
    canonicalId,
    name,
    status,
    linkedCanonicalId,
    provenance: [source],
  }),
)

export const CLASSIFICATION_COUNTS = Object.freeze({
  total: WORK_OBJECTS.length,
  saplings: WORK_OBJECTS.filter((item) => item.classification === 'sapling').length,
  clientBranches: WORK_OBJECTS.filter((item) => item.classification === 'client-branch').length,
  internalPrograms: WORK_OBJECTS.filter((item) => item.classification === 'internal-program').length,
  review: REVIEW_RECORDS.length,
  historical: HISTORICAL_RECORDS.length,
})

export const HORIZONS: readonly Horizon[] = ['now', 'next', 'this-year', 'later', 'park']
export const BOARD_HORIZONS: readonly BoardHorizon[] = ['unscheduled', ...HORIZONS]
export const PORTFOLIO_SIGNALS: readonly PortfolioSignal[] = ['unplanned', 'ongoing', 'paused', 'completed', 'archived']
export const SMART_VIEWS: readonly SmartView[] = ['all', 'ongoing', 'paused', 'white-labelable', 'needs-review', 'unplanned', 'completed-closed', 'historical']
export const SIGNAL_STATUSES: readonly SignalStatus[] = ['ready', 'complete', 'blocked', 'failed', 'drifted']
export const CLASSIFICATIONS: readonly Classification[] = ['sapling', 'client-branch', 'internal-program']
export const REVIEW_PROPOSALS: readonly ReviewProposal[] = ['sapling', 'client-branch', 'internal-program', 'needs-review']
export const REVIEW_SUGGESTION_RULE_VERSION = 'thoughtseed.review-suggestion.v1' as const
export const PORTFOLIO_ORIGINS: readonly PortfolioOrigin[] = ['thoughtseed-venture', 'thoughtseed-internal', 'client', 'unknown']
export const REPOSITORY_DISPOSITIONS: readonly RepositoryDisposition[] = ['resolved', 'no-repository', 'unmatched', 'ambiguous']
export const CLOSEOUT_DISPOSITIONS: readonly CloseoutDisposition[] = ['completed', 'closed', 'terminated']
export const ACTIVE_INDEX_DISPOSITIONS: readonly ActiveIndexDisposition[] = ['remove-from-active', 'mark-finished']

const workById = new Map(WORK_OBJECTS.map((work) => [work.workId, work]))
const reviewById = new Map(REVIEW_RECORDS.map((record) => [record.canonicalId, record]))
const repositoryEvidenceBySourceRef = new Map<string, (typeof REPOSITORY_EVIDENCE)[number]>(
  REPOSITORY_EVIDENCE.map((record) => [record.sourceRef, record]),
)
const workflowById = new Map(ORGAN_WORKFLOWS.map((workflow) => [workflow.id, workflow]))

function displayAccountId(accountId: string): string {
  if (accountId === 'heyzack') return 'HeyZack'
  if (accountId === 'axdis-group') return 'Axdis Group'
  return accountId.replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function summarizeSignals(
  members: readonly WorkObject[],
  plans: Readonly<Record<string, WorkPlan>>,
): Readonly<Record<PortfolioSignal, number>> {
  return Object.freeze(Object.fromEntries(PORTFOLIO_SIGNALS.map((signal) => [
    signal,
    members.filter((work) => effectiveSignal(work, plans[work.workId]) === signal).length,
  ])) as Record<PortfolioSignal, number>)
}

export function groupWorkObjects(
  works: readonly WorkObject[] = WORK_OBJECTS,
  plans: Readonly<Record<string, WorkPlan>> = {},
): WorkObjectGroup[] {
  const clientFamilies = new Map<string, WorkObject[]>()
  const saplingMembers: WorkObject[] = []
  const programMembers: WorkObject[] = []
  for (const work of works) {
    if (work.classification === 'sapling') {
      saplingMembers.push(work)
      continue
    }
    if (work.classification === 'internal-program') {
      programMembers.push(work)
      continue
    }
    if (!work.accountId) throw new TypeError(`Client Branch ${work.workId} has no source accountId`)
    const family = clientFamilies.get(work.accountId) ?? []
    family.push(work)
    clientFamilies.set(work.accountId, family)
  }
  const groups: WorkObjectGroup[] = []
  if (saplingMembers.length) groups.push({
    groupId: 'classification:saplings',
    label: 'Saplings',
    kind: 'saplings',
    accountId: null,
    provenance: 'source-classification',
    members: saplingMembers,
    signalSummary: summarizeSignals(saplingMembers, plans),
  })
  for (const [accountId, members] of [...clientFamilies.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    groups.push({
      groupId: `client:${accountId}`,
      label: displayAccountId(accountId),
      kind: 'client-family',
      accountId,
      provenance: 'source-account',
      members: [...members].sort((left, right) => left.name.localeCompare(right.name)),
      signalSummary: summarizeSignals(members, plans),
    })
  }
  if (programMembers.length) groups.push({
    groupId: 'classification:internal-programs',
    label: 'Internal Programs',
    kind: 'internal-programs',
    accountId: null,
    provenance: 'source-classification',
    members: programMembers,
    signalSummary: summarizeSignals(programMembers, plans),
  })
  return groups
}

export function reviewSuggestion(record: ReviewRecord): ReviewSuggestion {
  const evidence = `${record.source} ${record.needed}`.toLowerCase()
  if (/client account|client note|client mapping|client project/.test(evidence)) {
    return {
      proposedType: 'client-branch',
      rationale: 'The missing evidence is primarily a client account or delivery mapping.',
      ruleVersion: REVIEW_SUGGESTION_RULE_VERSION,
      sourceDigest: CLASSIFICATION_DIGEST,
    }
  }
  if (/thoughtseed[- ]origin|thoughtseed[- ]owned venture|founder[- ]owned thoughtseed venture/.test(evidence)) {
    return {
      proposedType: 'sapling',
      rationale: 'Explicit Thoughtseed-origin evidence supports testing this record as a Sapling.',
      ruleVersion: REVIEW_SUGGESTION_RULE_VERSION,
      sourceDigest: CLASSIFICATION_DIGEST,
    }
  }
  if (/company program|portfolio container|media sapling/.test(evidence)) {
    return {
      proposedType: 'internal-program',
      rationale: 'The uncertainty concerns a company capability or portfolio container boundary.',
      ruleVersion: REVIEW_SUGGESTION_RULE_VERSION,
      sourceDigest: CLASSIFICATION_DIGEST,
    }
  }
  return {
    proposedType: 'needs-review',
    rationale: 'The source evidence does not safely distinguish product, client delivery, or internal program.',
    ruleVersion: REVIEW_SUGGESTION_RULE_VERSION,
    sourceDigest: CLASSIFICATION_DIGEST,
  }
}

export function deriveClassificationFromOrigin(origin: PortfolioOrigin): DerivedClassification {
  if (origin === 'thoughtseed-venture') return 'sapling'
  if (origin === 'thoughtseed-internal') return 'internal-program'
  if (origin === 'client') return 'client-branch'
  return 'needs-review'
}

export function defaultReconciliation(workObjectId: string): PortfolioReconciliation {
  return {
    workObjectId,
    repositorySourceRef: null,
    repositoryDisposition: 'unmatched',
    origin: 'unknown',
    clientFamilyId: '',
    planningAuthority: null,
    repositoryPlanningReviewed: false,
    githubIssuesReviewed: false,
    legacyEvidenceReviewed: false,
    note: '',
    updatedAt: '',
  }
}

export function defaultCloseout(workObjectId: string): ProjectCloseout {
  return {
    workObjectId,
    disposition: 'completed',
    finalSummary: '',
    handoffMarkdownPath: '.project/HANDOFF.md',
    closureReceiptJsonPath: '.project/project-closeout-receipt.v1.json',
    agentMemoryJsonPath: '.project/agent-memory-projection.v1.json',
    r2VaultPrefix: `project-closeouts/v1/thoughtseed/${workObjectId.replace(/[^a-zA-Z0-9._-]+/g, '-')}`,
    activeIndexDisposition: 'remove-from-active',
    repositoryFinalStateReviewed: false,
    handoffDocumented: false,
    r2VaultRecorded: false,
    agentMemoryUpdated: false,
    activeIndexUpdated: false,
    downstreamFlowsStopped: false,
    successorWorkObjectId: '',
    receiptId: null,
    updatedAt: '',
  }
}

export const SEEDED_PROJECT_CLOSEOUTS: Readonly<Record<string, ProjectCloseout>> = Object.freeze({
  'branch:safvr-landing-page': Object.freeze({
    workObjectId: 'branch:safvr-landing-page',
    disposition: 'closed',
    finalSummary: 'SAFVR is a client website branch. Founder approval marks the landing-page delivery completed and closed, with no active Thoughtseed workflow remaining.',
    handoffMarkdownPath: 'docs/project-management/closeouts/safvr-landing-page-handoff.md',
    closureReceiptJsonPath: 'docs/project-management/closeouts/safvr-landing-page-closeout.v1.json',
    agentMemoryJsonPath: 'docs/project-management/closeouts/safvr-landing-page-agent-memory.v1.json',
    r2VaultPrefix: 'portfolio/thoughtseed/workobjects/branch:safvr-landing-page/closeout/',
    activeIndexDisposition: 'remove-from-active',
    repositoryFinalStateReviewed: true,
    handoffDocumented: true,
    r2VaultRecorded: true,
    agentMemoryUpdated: true,
    activeIndexUpdated: true,
    downstreamFlowsStopped: true,
    successorWorkObjectId: '',
    receiptId: 'pa_55d6162386ed202608080001',
    updatedAt: '2026-08-08T06:30:00.000Z',
  }),
})

export function closeoutReadiness(closeout: ProjectCloseout): CloseoutReadiness {
  const blockers: string[] = []
  if (!closeout.finalSummary.trim()) blockers.push('Write the final outcome and handoff summary.')
  if (!closeout.handoffMarkdownPath.trim().endsWith('.md')) blockers.push('Name the final handoff Markdown path.')
  if (!closeout.closureReceiptJsonPath.trim().endsWith('.json')) blockers.push('Name the closeout receipt JSON path.')
  if (!closeout.agentMemoryJsonPath.trim().endsWith('.json')) blockers.push('Name the agent memory projection JSON path.')
  if (!closeout.r2VaultPrefix.trim()) blockers.push('Name the R2 vault closeout prefix.')
  if (!closeout.repositoryFinalStateReviewed) blockers.push('Review the repository final state.')
  if (!closeout.handoffDocumented) blockers.push('Prepare the final handoff Markdown.')
  if (!closeout.r2VaultRecorded) blockers.push('Prepare the R2 vault record manifest.')
  if (!closeout.agentMemoryUpdated) blockers.push('Prepare the agent-aware active/finished memory JSON.')
  if (!closeout.activeIndexUpdated) blockers.push('Prepare the active-index removal and finished-index delta.')
  if (!closeout.downstreamFlowsStopped) blockers.push('Stop or transfer all downstream active flows.')
  return { ready: blockers.length === 0, blockers }
}

export function isTerminalCloseout(closeout?: ProjectCloseout): boolean {
  return Boolean(closeout?.receiptId && closeoutReadiness(closeout).ready)
}

export function intakeReadiness(
  work: WorkObject,
  reconciliation: PortfolioReconciliation,
): IntakeReadiness {
  const derivedType = deriveClassificationFromOrigin(reconciliation.origin)
  const classificationMismatch = derivedType !== 'needs-review' && derivedType !== work.classification
  const blockers: string[] = []
  const selectedRepository = reconciliation.repositorySourceRef
    ? repositoryEvidenceBySourceRef.get(reconciliation.repositorySourceRef)
    : undefined

  if (reconciliation.repositoryDisposition === 'resolved') {
    if (!reconciliation.repositorySourceRef || !work.provenance.includes(reconciliation.repositorySourceRef)) {
      blockers.push('Select repository evidence attached to this WorkObject.')
    } else if (!selectedRepository || selectedRepository.status !== 'resolved') {
      blockers.push('The selected repository evidence is not an exact resolved match.')
    } else if (!selectedRepository.repositoryId || !selectedRepository.fullName) {
      blockers.push('The selected repository still lacks immutable GitHub identity metadata.')
    }
  } else if (reconciliation.repositoryDisposition === 'no-repository') {
    if (reconciliation.repositorySourceRef !== null) {
      blockers.push('An explicit no-repository gap cannot retain a repository reference.')
    }
    if (work.provenance.some((source) => source.startsWith('repo:'))) {
      blockers.push('This WorkObject already carries repository evidence; resolve that mapping gap instead of bypassing it.')
    }
  } else if (selectedRepository?.status === 'unverified') {
    blockers.push('The repository candidate needs immutable GitHub identity metadata before it can become planning authority.')
  } else if (work.provenance.some((source) => source.startsWith('repo:'))) {
    blockers.push('Resolve the repository evidence attached to this WorkObject.')
  } else {
    blockers.push('Resolve an exact repository or record an explicit no-repository gap.')
  }
  if (reconciliation.origin === 'unknown') blockers.push('Record the project origin before classification.')
  if (reconciliation.origin === 'client' && !reconciliation.clientFamilyId) {
    blockers.push('Map client-originated work to an explicit client family.')
  }
  if (!reconciliation.planningAuthority) {
    blockers.push('Choose the repository or Cambium as planning authority.')
  } else if (reconciliation.repositoryDisposition === 'resolved' && reconciliation.planningAuthority.kind !== 'repository') {
    blockers.push('Resolved repository work must use that repository as project-local planning authority.')
  } else if (
    reconciliation.repositoryDisposition === 'resolved' &&
    reconciliation.planningAuthority.kind === 'repository' &&
    (
      !selectedRepository ||
      reconciliation.planningAuthority.repositoryId !== selectedRepository.repositoryId ||
      reconciliation.planningAuthority.fullName !== selectedRepository.fullName
    )
  ) {
    blockers.push('Planning authority must match the selected immutable repository evidence.')
  } else if (reconciliation.repositoryDisposition === 'no-repository' && reconciliation.planningAuthority.kind !== 'cambium') {
    blockers.push('Repository-less work must remain coordinated by Cambium.')
  }
  if (!reconciliation.repositoryPlanningReviewed) blockers.push('Review repository planning and roadmap evidence.')
  if (!reconciliation.githubIssuesReviewed) blockers.push('Review the repository GitHub issues.')
  if (!reconciliation.legacyEvidenceReviewed) blockers.push('Reconcile tool, session, and dated planning evidence.')
  if (classificationMismatch) {
    blockers.push(`Origin derives ${derivedType}, but the canonical catalog currently says ${work.classification}. Export a mapping proposal.`)
  }

  return {
    ready: blockers.length === 0,
    derivedType,
    classificationMismatch,
    blockers,
  }
}

export function createReusableIpProposal(work: WorkObject, name: string): ReusableIpProposal {
  if (work.classification !== 'client-branch') {
    throw new TypeError('Reusable client-derived IP proposals require a Client Branch source')
  }
  const normalizedName = name.trim().slice(0, 120)
  if (!normalizedName) throw new TypeError('Reusable IP proposal name is required')
  return {
    proposedType: 'sapling',
    origin: 'thoughtseed-venture',
    name: normalizedName,
    linkedWorkId: work.workId,
    preservesSourceType: 'client-branch',
  }
}

export function normalizeClientFamilyId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
}

export function normalizeReviewNote(value: string): string {
  return value.trim().slice(0, 400)
}

export function applyUnplannedDecision(plan: WorkPlan, decision: QuickPlanningDecision): WorkPlan {
  if (decision === 'needs-review') {
    return { ...plan, tags: normalizeTags([...plan.tags, 'needs-review']) }
  }
  if (decision === 'now') return { ...plan, signal: 'ongoing', horizon: 'now' }
  if (decision === 'park') return { ...plan, signal: 'paused', horizon: 'park' }
  return { ...plan, signal: null, horizon: decision }
}

export function defaultPlan(): WorkPlan {
  return {
    signal: null,
    horizon: null,
    priority: 3,
    tags: [],
    nextAction: '',
    evidence: '',
    delivery: {
      organ: 'hands',
      trigger: 'build',
      status: 'ready',
      audience: 'internal',
    },
  }
}

export function boardHorizon(plan?: WorkPlan): BoardHorizon {
  return plan?.horizon ?? 'unscheduled'
}

export function sourceSignal(work: WorkObject): PortfolioSignal {
  if (work.overlay === 'paused') return 'paused'
  if (work.lifecycle === 'complete') return 'completed'
  if (work.lifecycle === 'retired') return 'archived'
  if (['executing', 'verifying', 'approved', 'supervised-branch'].includes(work.lifecycle)) return 'ongoing'
  return 'unplanned'
}

export function effectiveSignal(work: WorkObject, plan?: WorkPlan): PortfolioSignal {
  return plan?.signal ?? sourceSignal(work)
}

export function signalProvenance(_work: WorkObject, plan?: WorkPlan): 'local plan' | 'source' {
  return plan?.signal ? 'local plan' : 'source'
}

export function normalizeTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

export function normalizeTags(values: readonly string[]): string[] {
  return [...new Set(values.map(normalizeTag).filter(Boolean))].slice(0, 12)
}

export function hasWhiteLabelReuse(work: WorkObject, plan?: WorkPlan): boolean {
  return work.commercialReuse === 'white-labelable' || Boolean(plan?.tags.includes('white-labelable'))
}

function matchesView(
  work: WorkObject,
  plan: WorkPlan | undefined,
  view: SmartView,
  reconciliations?: Readonly<Record<string, PortfolioReconciliation>>,
  closeouts?: Readonly<Record<string, ProjectCloseout>>,
): boolean {
  const terminalCloseout = isTerminalCloseout(closeouts?.[work.workId])
  if (view === 'completed-closed') return terminalCloseout
  if (terminalCloseout) return false
  if (view === 'all') return true
  if (view === 'white-labelable') return hasWhiteLabelReuse(work, plan)
  if (view === 'needs-review') return Boolean(plan?.tags.includes('needs-review'))
  if (view === 'historical') return false
  if (view === 'unplanned') {
    if (reconciliations && sourceSignal(work) === 'unplanned') {
      const reconciliation = reconciliations[work.workId] ?? defaultReconciliation(work.workId)
      if (!intakeReadiness(work, reconciliation).ready) return true
    }
    return effectiveSignal(work, plan) === 'unplanned'
      && !plan?.horizon
      && !plan?.tags.includes('needs-review')
  }
  return effectiveSignal(work, plan) === view
}

export function filterWorkObjects(
  query: string,
  classifications: ReadonlySet<Classification>,
  view: SmartView,
  plans: Readonly<Record<string, WorkPlan>> = {},
  reconciliations?: Readonly<Record<string, PortfolioReconciliation>>,
  closeouts?: Readonly<Record<string, ProjectCloseout>>,
): WorkObject[] {
  const needle = query.trim().toLowerCase()
  return WORK_OBJECTS.filter((work) => {
    const plan = plans[work.workId]
    if (classifications.size > 0 && !classifications.has(work.classification)) return false
    if (!matchesView(work, plan, view, reconciliations, closeouts)) return false
    if (!needle) return true
    return [
      work.name,
      work.workId,
      work.accountId ?? '',
      work.lifecycle,
      work.overlay ?? '',
      work.commercialReuse ?? '',
      work.tenantStatus,
      work.tenantId ?? '',
      effectiveSignal(work, plan),
      plan?.horizon ?? '',
      ...(plan?.tags ?? []),
    ].some((value) => value.toLowerCase().includes(needle))
  })
}

export function smartViewCount(
  view: SmartView,
  plans: Readonly<Record<string, WorkPlan>>,
  reconciliations?: Readonly<Record<string, PortfolioReconciliation>>,
  closeouts?: Readonly<Record<string, ProjectCloseout>>,
): number {
  if (view === 'needs-review') {
    return REVIEW_RECORDS.length + WORK_OBJECTS.filter((work) => !isTerminalCloseout(closeouts?.[work.workId]) && plans[work.workId]?.tags.includes('needs-review')).length
  }
  if (view === 'historical') return HISTORICAL_RECORDS.length
  return WORK_OBJECTS.filter((work) => matchesView(work, plans[work.workId], view, reconciliations, closeouts)).length
}

export function resolvePipeline(work: WorkObject, plan: WorkPlan): Pipeline {
  const workflow = workflowById.get(plan.delivery.organ)
  if (!workflow) throw new TypeError('Unknown organ workflow')
  const trigger = workflow.triggers.includes(plan.delivery.trigger)
    ? plan.delivery.trigger
    : workflow.triggers[0]
  const exceptional = ['blocked', 'failed', 'drifted'].includes(plan.delivery.status)
  const audience: Audience = workflow.id === 'will' ? plan.delivery.audience : 'internal'
  return {
    workObjectId: work.workId,
    workObjectName: work.name,
    organ: workflow.id,
    organName: workflow.name,
    trigger,
    stages: workflow.stages,
    skillHints: workflow.skillHints,
    topic: exceptional ? 'Alerts' : workflow.defaultTopic,
    escalationTopic: exceptional ? 'Alerts' : null,
    requiresApproval: workflow.id === 'will' && audience === 'client',
    horizon: plan.horizon ?? 'unscheduled',
    priority: plan.priority,
    signal: effectiveSignal(work, plan),
    status: plan.delivery.status,
    audience,
    nextAction: plan.nextAction.trim(),
    evidence: plan.evidence.trim(),
    tags: normalizeTags(plan.tags),
  }
}

export function hasLocalPlan(plan: WorkPlan): boolean {
  const base = defaultPlan()
  return Boolean(
    plan.signal ||
    plan.horizon !== base.horizon ||
    plan.priority !== base.priority ||
    plan.tags.length ||
    plan.nextAction.trim() ||
    plan.evidence.trim() ||
    plan.delivery.organ !== base.delivery.organ ||
    plan.delivery.trigger !== base.delivery.trigger ||
    plan.delivery.status !== base.delivery.status ||
    plan.delivery.audience !== base.delivery.audience
  )
}

export function createPacket(state: WorkbenchInput, now = new Date()): ExportPacket {
  const focusedId = state.focusedId && workById.has(state.focusedId) ? state.focusedId : null
  const plans: Record<string, WorkPlan> = {}
  for (const [id, raw] of Object.entries(state.plans)) {
    if (!workById.has(id)) continue
    const plan = sanitizePlan(raw, id)
    if (hasLocalPlan(plan)) plans[id] = plan
  }
  const reviewDecisions: Record<string, ReviewDecision> = {}
  for (const [id, raw] of Object.entries(state.reviewDecisions ?? {})) {
    if (!reviewById.has(id)) continue
    reviewDecisions[id] = sanitizeReviewDecision(raw, id)
  }
  const retiredReviewDecisions: Record<string, ReviewDecision> = {}
  for (const [id, raw] of Object.entries(state.retiredReviewDecisions ?? {})) {
    retiredReviewDecisions[safeText(id, 160)] = sanitizeRetiredReviewDecision(raw, id)
  }
  const reconciliations: Record<string, PortfolioReconciliation> = {}
  for (const [id, raw] of Object.entries(state.reconciliations ?? {})) {
    if (!workById.has(id)) continue
    reconciliations[id] = sanitizeReconciliation(raw, id)
  }
  const closeouts: Record<string, ProjectCloseout> = {}
  for (const [id, raw] of Object.entries(state.closeouts ?? {})) {
    if (!workById.has(id)) continue
    closeouts[id] = sanitizeCloseout(raw, id)
  }
  const pipelines = Object.entries(plans).map(([id, plan]) => resolvePipeline(workById.get(id)!, plan))
  return {
    schema: WORKBENCH_SCHEMA,
    version: 4,
    source: {
      schema: SOURCE_SCHEMA,
      generatedAt: SOURCE_GENERATED_AT,
      classificationDigest: CLASSIFICATION_DIGEST,
      authority: 'vault',
    },
    authority: {
      mode: 'proposal-only',
      operationalWriter: 'cambium-goal-graph-d1',
      telegramTransport: 'hermes',
    },
    focusedId,
    plans,
    reviewDecisions,
    retiredReviewDecisions,
    reconciliations,
    closeouts,
    pipelines,
    exportedAt: now.toISOString(),
  }
}

function safeText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function sanitizeDelivery(value: unknown, id: string): DeliveryPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultPlan().delivery
  const raw = value as Partial<DeliveryPlan>
  if (!ORGAN_WORKFLOWS.some((workflow) => workflow.id === raw.organ)) throw new TypeError(`Invalid organ for ${id}`)
  if (!SIGNAL_STATUSES.includes(raw.status as SignalStatus)) throw new TypeError(`Invalid delivery status for ${id}`)
  const workflow = workflowById.get(raw.organ as OrganId)!
  if (!workflow.triggers.includes(String(raw.trigger))) throw new TypeError(`Invalid trigger for ${id}`)
  return {
    organ: raw.organ as OrganId,
    trigger: String(raw.trigger),
    status: raw.status as SignalStatus,
    audience: raw.organ === 'will' && raw.audience === 'client' ? 'client' : 'internal',
  }
}

function sanitizePlan(value: unknown, id: string): WorkPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid plan for ${id}`)
  const raw = value as Partial<WorkPlan>
  if (raw.signal !== null && !PORTFOLIO_SIGNALS.includes(raw.signal as PortfolioSignal)) {
    throw new TypeError(`Invalid portfolio signal for ${id}`)
  }
  if (raw.horizon !== null && !HORIZONS.includes(raw.horizon as Horizon)) throw new TypeError(`Invalid horizon for ${id}`)
  if (![1, 2, 3, 4, 5].includes(raw.priority as number)) throw new TypeError(`Invalid priority for ${id}`)
  if (!isStringArray(raw.tags)) throw new TypeError(`Invalid tags for ${id}`)
  return {
    signal: (raw.signal as PortfolioSignal | null) ?? null,
    horizon: (raw.horizon as Horizon | null) ?? null,
    priority: raw.priority as Priority,
    tags: normalizeTags(raw.tags),
    nextAction: safeText(raw.nextAction, 600),
    evidence: safeText(raw.evidence, 400),
    delivery: sanitizeDelivery(raw.delivery, id),
  }
}

function sanitizeReviewDecision(value: unknown, id: string): ReviewDecision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid review decision for ${id}`)
  const raw = value as Partial<ReviewDecision>
  if (!REVIEW_PROPOSALS.includes(raw.proposedType as ReviewProposal)) {
    throw new TypeError(`Invalid review proposal for ${id}`)
  }
  const proposedType = raw.proposedType as ReviewProposal
  if (raw.suggestionRule !== REVIEW_SUGGESTION_RULE_VERSION) {
    throw new TypeError(`Invalid suggestion rule for ${id}`)
  }
  if (raw.sourceDigest !== CLASSIFICATION_DIGEST) {
    throw new TypeError(`Invalid suggestion source digest for ${id}`)
  }
  const clientFamilyId = proposedType === 'client-branch'
    ? normalizeClientFamilyId(String(raw.clientFamilyId ?? ''))
    : ''
  return {
    proposedType,
    clientFamilyId,
    note: normalizeReviewNote(String(raw.note ?? '')),
    suggestionRule: REVIEW_SUGGESTION_RULE_VERSION,
    sourceDigest: CLASSIFICATION_DIGEST,
  }
}

function sanitizeRetiredReviewDecision(value: unknown, id: string): ReviewDecision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid retired review decision for ${id}`)
  const raw = value as Partial<ReviewDecision>
  if (!REVIEW_PROPOSALS.includes(raw.proposedType as ReviewProposal)) {
    throw new TypeError(`Invalid retired review proposal for ${id}`)
  }
  const suggestionRule = safeText(raw.suggestionRule, 160)
  const sourceDigest = safeText(raw.sourceDigest, 128)
  if (!suggestionRule || !/^[a-f0-9]{64}$/i.test(sourceDigest)) {
    throw new TypeError(`Invalid retired review provenance for ${id}`)
  }
  const proposedType = raw.proposedType as ReviewProposal
  return {
    proposedType,
    clientFamilyId: proposedType === 'client-branch' ? normalizeClientFamilyId(String(raw.clientFamilyId ?? '')) : '',
    note: normalizeReviewNote(String(raw.note ?? '')),
    suggestionRule,
    sourceDigest,
  }
}

function sanitizePlanningAuthority(value: unknown, id: string): PlanningAuthority | null {
  if (value === null || value === undefined) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Invalid planning authority for ${id}`)
  }
  const raw = value as Partial<PlanningAuthority> & Record<string, unknown>
  if (raw.kind === 'repository') {
    const repositoryId = safeText(raw.repositoryId, 200)
    const fullName = safeText(raw.fullName, 200)
    if (!repositoryId || !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(fullName)) {
      throw new TypeError(`Invalid repository planning authority for ${id}`)
    }
    return { kind: 'repository', repositoryId, fullName }
  }
  if (raw.kind === 'cambium') {
    const reason = safeText(raw.reason, 400)
    if (!reason) throw new TypeError(`Cambium planning authority requires a reason for ${id}`)
    return { kind: 'cambium', reason }
  }
  throw new TypeError(`Invalid planning authority kind for ${id}`)
}

function sanitizeReconciliation(value: unknown, id: string): PortfolioReconciliation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Invalid reconciliation for ${id}`)
  }
  const raw = value as Partial<PortfolioReconciliation>
  if (raw.workObjectId !== id) throw new TypeError(`Reconciliation WorkObject mismatch for ${id}`)
  if (!REPOSITORY_DISPOSITIONS.includes(raw.repositoryDisposition as RepositoryDisposition)) {
    throw new TypeError(`Invalid repository disposition for ${id}`)
  }
  if (!PORTFOLIO_ORIGINS.includes(raw.origin as PortfolioOrigin)) {
    throw new TypeError(`Invalid portfolio origin for ${id}`)
  }
  const repositorySourceRef = raw.repositorySourceRef === null
    ? null
    : safeText(raw.repositorySourceRef, 300)
  if (repositorySourceRef && !repositorySourceRef.startsWith('repo:')) {
    throw new TypeError(`Invalid repository source reference for ${id}`)
  }
  const work = workById.get(id)!
  const repositoryEvidence = repositorySourceRef
    ? repositoryEvidenceBySourceRef.get(repositorySourceRef)
    : undefined
  if (repositorySourceRef && (!work.provenance.includes(repositorySourceRef) || !repositoryEvidence)) {
    throw new TypeError(`Repository evidence is not attached to ${id}`)
  }
  if (repositoryEvidence) {
    const evidenceStatus: string = repositoryEvidence.status
    const expectedDisposition: RepositoryDisposition = evidenceStatus === 'resolved'
      ? 'resolved'
      : evidenceStatus === 'ambiguous'
        ? 'ambiguous'
        : 'unmatched'
    if (raw.repositoryDisposition !== expectedDisposition) {
      throw new TypeError(`Repository disposition does not match generated evidence for ${id}`)
    }
  } else if (raw.repositoryDisposition === 'resolved' || raw.repositoryDisposition === 'ambiguous') {
    throw new TypeError(`Repository disposition lacks generated evidence for ${id}`)
  }
  if (
    raw.repositoryDisposition === 'no-repository' &&
    (repositorySourceRef !== null || work.provenance.some((source) => source.startsWith('repo:')))
  ) {
    throw new TypeError(`No-repository disposition conflicts with catalog evidence for ${id}`)
  }
  for (const [field, flag] of [
    ['repositoryPlanningReviewed', raw.repositoryPlanningReviewed],
    ['githubIssuesReviewed', raw.githubIssuesReviewed],
    ['legacyEvidenceReviewed', raw.legacyEvidenceReviewed],
  ] as const) {
    if (typeof flag !== 'boolean') throw new TypeError(`Invalid ${field} flag for ${id}`)
  }
  const origin = raw.origin as PortfolioOrigin
  const planningAuthority = sanitizePlanningAuthority(raw.planningAuthority, id)
  if (
    raw.repositoryDisposition === 'resolved' &&
    planningAuthority?.kind === 'repository' &&
    (
      planningAuthority.repositoryId !== repositoryEvidence?.repositoryId ||
      planningAuthority.fullName !== repositoryEvidence.fullName
    )
  ) {
    throw new TypeError(`Repository planning authority does not match generated evidence for ${id}`)
  }
  return {
    workObjectId: id,
    repositorySourceRef,
    repositoryDisposition: raw.repositoryDisposition as RepositoryDisposition,
    origin,
    clientFamilyId: origin === 'client' ? normalizeClientFamilyId(String(raw.clientFamilyId ?? '')) : '',
    planningAuthority,
    repositoryPlanningReviewed: raw.repositoryPlanningReviewed as boolean,
    githubIssuesReviewed: raw.githubIssuesReviewed as boolean,
    legacyEvidenceReviewed: raw.legacyEvidenceReviewed as boolean,
    note: normalizeReviewNote(String(raw.note ?? '')),
    updatedAt: safeText(raw.updatedAt, 64),
  }
}

function sanitizeCloseout(value: unknown, id: string): ProjectCloseout {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Invalid closeout for ${id}`)
  }
  const raw = value as Partial<ProjectCloseout>
  if (raw.workObjectId !== id) throw new TypeError(`Closeout WorkObject mismatch for ${id}`)
  if (!CLOSEOUT_DISPOSITIONS.includes(raw.disposition as CloseoutDisposition)) {
    throw new TypeError(`Invalid closeout disposition for ${id}`)
  }
  if (!ACTIVE_INDEX_DISPOSITIONS.includes(raw.activeIndexDisposition as ActiveIndexDisposition)) {
    throw new TypeError(`Invalid active index disposition for ${id}`)
  }
  const receiptId = raw.receiptId === null || raw.receiptId === undefined ? null : safeText(raw.receiptId, 80)
  if (receiptId !== null && !/^pa_[0-9a-f]{24}$/.test(receiptId)) {
    throw new TypeError(`Invalid closeout receipt for ${id}`)
  }
  return {
    workObjectId: id,
    disposition: raw.disposition as CloseoutDisposition,
    finalSummary: safeText(raw.finalSummary, 1200),
    handoffMarkdownPath: safeText(raw.handoffMarkdownPath, 160),
    closureReceiptJsonPath: safeText(raw.closureReceiptJsonPath, 160),
    agentMemoryJsonPath: safeText(raw.agentMemoryJsonPath, 160),
    r2VaultPrefix: safeText(raw.r2VaultPrefix, 220),
    activeIndexDisposition: raw.activeIndexDisposition as ActiveIndexDisposition,
    repositoryFinalStateReviewed: Boolean(raw.repositoryFinalStateReviewed),
    handoffDocumented: Boolean(raw.handoffDocumented),
    r2VaultRecorded: Boolean(raw.r2VaultRecorded),
    agentMemoryUpdated: Boolean(raw.agentMemoryUpdated),
    activeIndexUpdated: Boolean(raw.activeIndexUpdated),
    downstreamFlowsStopped: Boolean(raw.downstreamFlowsStopped),
    successorWorkObjectId: safeText(raw.successorWorkObjectId, 160),
    receiptId,
    updatedAt: safeText(raw.updatedAt, 64),
  }
}

function parsePlans(packet: Record<string, unknown>, versionLabel: string): Pick<WorkbenchState, 'focusedId' | 'plans'> {
  if (!packet.plans || typeof packet.plans !== 'object' || Array.isArray(packet.plans)) {
    throw new TypeError('Plans are invalid')
  }
  const plans: Record<string, WorkPlan> = {}
  for (const [id, value] of Object.entries(packet.plans as Record<string, unknown>)) {
    if (!workById.has(id)) throw new TypeError(`Unknown WorkObject in ${versionLabel} packet: ${id}`)
    plans[id] = sanitizePlan(value, id)
  }
  if (typeof packet.focusedId === 'string' && !workById.has(packet.focusedId)) {
    throw new TypeError(`Unknown focused WorkObject in ${versionLabel} packet: ${packet.focusedId}`)
  }
  const focusedId = typeof packet.focusedId === 'string' && workById.has(packet.focusedId) ? packet.focusedId : null
  return { focusedId, plans }
}

function parseReviewDecisions(packet: Record<string, unknown>, versionLabel: string): Record<string, ReviewDecision> {
  if (!packet.reviewDecisions || typeof packet.reviewDecisions !== 'object' || Array.isArray(packet.reviewDecisions)) {
    throw new TypeError('Review decisions are invalid')
  }
  const reviewDecisions: Record<string, ReviewDecision> = {}
  for (const [id, value] of Object.entries(packet.reviewDecisions as Record<string, unknown>)) {
    if (!reviewById.has(id)) throw new TypeError(`Unknown review record in ${versionLabel} packet: ${id}`)
    reviewDecisions[id] = sanitizeReviewDecision(value, id)
  }
  return reviewDecisions
}

function parseV4(packet: Record<string, unknown>): WorkbenchState {
  if (packet.version !== 4) throw new TypeError('Packet version is not supported')
  const parsed = parsePlans(packet, 'v4')
  const reviewDecisions = parseReviewDecisions(packet, 'v4')
  if (packet.retiredReviewDecisions !== undefined && (
    typeof packet.retiredReviewDecisions !== 'object' ||
    packet.retiredReviewDecisions === null ||
    Array.isArray(packet.retiredReviewDecisions)
  )) {
    throw new TypeError('Retired review decisions are invalid')
  }
  const retiredReviewDecisions: Record<string, ReviewDecision> = {}
  for (const [id, value] of Object.entries((packet.retiredReviewDecisions ?? {}) as Record<string, unknown>)) {
    retiredReviewDecisions[id] = sanitizeRetiredReviewDecision(value, id)
  }
  if (!packet.reconciliations || typeof packet.reconciliations !== 'object' || Array.isArray(packet.reconciliations)) {
    throw new TypeError('Reconciliations are invalid')
  }
  const reconciliations: Record<string, PortfolioReconciliation> = {}
  for (const [id, value] of Object.entries(packet.reconciliations as Record<string, unknown>)) {
    if (!workById.has(id)) throw new TypeError(`Unknown WorkObject in v4 reconciliation: ${id}`)
    reconciliations[id] = sanitizeReconciliation(value, id)
  }
  if (packet.closeouts !== undefined && (
    typeof packet.closeouts !== 'object' ||
    packet.closeouts === null ||
    Array.isArray(packet.closeouts)
  )) {
    throw new TypeError('Closeouts are invalid')
  }
  const closeouts: Record<string, ProjectCloseout> = {}
  for (const [id, value] of Object.entries((packet.closeouts ?? {}) as Record<string, unknown>)) {
    if (!workById.has(id)) throw new TypeError(`Unknown WorkObject in v4 closeout: ${id}`)
    closeouts[id] = sanitizeCloseout(value, id)
  }
  return { ...parsed, reviewDecisions, retiredReviewDecisions, reconciliations, closeouts }
}

function parseV3(packet: Record<string, unknown>): WorkbenchState {
  if (packet.version !== 3) throw new TypeError('Packet version is not supported')
  if (!packet.reviewDecisions || typeof packet.reviewDecisions !== 'object' || Array.isArray(packet.reviewDecisions)) {
    throw new TypeError('Review decisions are invalid')
  }
  const reviewDecisions: Record<string, ReviewDecision> = {}
  const retiredReviewDecisions: Record<string, ReviewDecision> = {}
  for (const [id, value] of Object.entries(packet.reviewDecisions as Record<string, unknown>)) {
    if (reviewById.has(id)) reviewDecisions[id] = sanitizeReviewDecision(value, id)
    else retiredReviewDecisions[id] = sanitizeRetiredReviewDecision(value, id)
  }
  return {
    ...parsePlans(packet, 'v3'),
    reviewDecisions,
    retiredReviewDecisions,
    reconciliations: {},
    closeouts: {},
  }
}

function parseV2(packet: Record<string, unknown>): WorkbenchState {
  if (packet.version !== 2) throw new TypeError('Packet version is not supported')
  return { ...parsePlans(packet, 'v2'), reviewDecisions: {}, retiredReviewDecisions: {}, reconciliations: {}, closeouts: {} }
}

interface LegacyDecision {
  proposedClassification?: PlanningCategory
  horizon?: 'now' | 'next' | 'later' | 'park'
  priority?: Priority
  instruction?: string
  outcome?: string
  organ?: OrganId
  trigger?: string
  status?: SignalStatus
  audience?: Audience
}

const legacyClassificationTags: Record<PlanningCategory, string> = {
  'keep-canonical': 'legacy-keep-canonical',
  'sapling': 'legacy-kind-sapling',
  'client-branch': 'legacy-kind-client-branch',
  'internal-program': 'legacy-kind-internal-program',
  'needs-review': 'needs-review',
}

function parseLegacy(packet: Record<string, unknown>): WorkbenchState {
  if (packet.version !== 1 || !isStringArray(packet.selectedIds)) throw new TypeError('Legacy packet is invalid')
  if (!packet.decisions || typeof packet.decisions !== 'object' || Array.isArray(packet.decisions)) {
    throw new TypeError('Legacy decisions are invalid')
  }
  const ids = [...new Set(packet.selectedIds)]
  const unknownId = ids.find((id) => !workById.has(id))
  if (unknownId) throw new TypeError(`Unknown WorkObject in v1 packet: ${unknownId}`)
  const rawDecisions = packet.decisions as Record<string, LegacyDecision>
  const plans: Record<string, WorkPlan> = {}
  for (const id of ids) {
    const raw = rawDecisions[id]
    if (!raw) throw new TypeError(`Missing legacy decision for ${id}`)
    const plan = defaultPlan()
    if (!['now', 'next', 'later', 'park'].includes(String(raw.horizon))) throw new TypeError(`Invalid legacy horizon for ${id}`)
    if (![1, 2, 3, 4, 5].includes(raw.priority as number)) throw new TypeError(`Invalid legacy priority for ${id}`)
    if (!raw.proposedClassification || !(raw.proposedClassification in legacyClassificationTags)) {
      throw new TypeError(`Invalid legacy classification proposal for ${id}`)
    }
    if (!ORGAN_WORKFLOWS.some((workflow) => workflow.id === raw.organ)) throw new TypeError(`Invalid legacy organ for ${id}`)
    if (!SIGNAL_STATUSES.includes(raw.status as SignalStatus)) throw new TypeError(`Invalid legacy status for ${id}`)
    const workflow = workflowById.get(raw.organ as OrganId)!
    if (!workflow.triggers.includes(String(raw.trigger))) throw new TypeError(`Invalid legacy trigger for ${id}`)
    plan.horizon = raw.horizon as Horizon
    plan.priority = raw.priority as Priority
    plan.nextAction = safeText(raw.instruction, 600)
    plan.evidence = safeText(raw.outcome, 400)
    plan.tags = [legacyClassificationTags[raw.proposedClassification]]
    plan.delivery = {
      organ: raw.organ as OrganId,
      trigger: String(raw.trigger),
      status: raw.status as SignalStatus,
      audience: raw.organ === 'will' && raw.audience === 'client' ? 'client' : 'internal',
    }
    plans[id] = plan
  }
  return { focusedId: ids[0] ?? null, plans, reviewDecisions: {}, retiredReviewDecisions: {}, reconciliations: {}, closeouts: {} }
}

export function parsePacket(value: unknown): WorkbenchState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Packet must be an object')
  const packet = value as Record<string, unknown>
  if (packet.schema === WORKBENCH_SCHEMA) return parseV4(packet)
  if (packet.schema === V3_SCHEMA) return parseV3(packet)
  if (packet.schema === V2_SCHEMA) return parseV2(packet)
  if (packet.schema === LEGACY_SCHEMA) return parseLegacy(packet)
  throw new TypeError('Packet schema is not supported')
}

export function toMarkdown(packet: ExportPacket): string {
  const horizonOrder = new Map(BOARD_HORIZONS.map((horizon, index) => [horizon, index]))
  const pipelines = [...packet.pipelines].sort((a, b) => {
    const horizonDelta = (horizonOrder.get(a.horizon) ?? 9) - (horizonOrder.get(b.horizon) ?? 9)
    return horizonDelta || a.priority - b.priority || a.workObjectName.localeCompare(b.workObjectName)
  })
  const counts = Object.fromEntries(PORTFOLIO_SIGNALS.map((signal) => [
    signal,
    WORK_OBJECTS.filter((work) => effectiveSignal(work, packet.plans[work.workId]) === signal).length,
  ]))
  const lines = [
    '# Thoughtseed Portfolio Workbench Brief',
    '',
    `Generated: ${packet.exportedAt}`,
    `Source: ${packet.source.schema} · ${packet.source.classificationDigest}`,
    'Authority: proposal-only; Vault classifies, Cambium Goal Graph/D1 operates, Hermes transports.',
    '',
    '## Portfolio signals',
    '',
    ...PORTFOLIO_SIGNALS.map((signal) => `- ${signal}: ${counts[signal]}`),
    `- white-labelable: ${smartViewCount('white-labelable', packet.plans, packet.reconciliations, packet.closeouts)}`,
    `- completed/closed: ${smartViewCount('completed-closed', packet.plans, packet.reconciliations, packet.closeouts)}`,
    `- classification review queue: ${REVIEW_RECORDS.length}`,
    '',
    '## Planned work',
    '',
  ]
  if (pipelines.length === 0) lines.push('_No local planning overrides._', '')
  for (const pipeline of pipelines) {
    lines.push(
      `### ${pipeline.workObjectName}`,
      '',
      `- WorkObject: \`${pipeline.workObjectId}\``,
      `- Portfolio signal: **${pipeline.signal}**`,
      `- Horizon: **${pipeline.horizon}** · priority P${pipeline.priority}`,
      `- Tags: ${pipeline.tags.length ? pipeline.tags.map((tag) => '`' + tag + '`').join(', ') : '_none_'}`,
      `- Delivery: ${pipeline.organName} → ${pipeline.stages.join(' → ')} → ${pipeline.topic}`,
      `- Trigger: \`${pipeline.trigger}\` · status \`${pipeline.status}\` · audience \`${pipeline.audience}\``,
      `- Skills: ${pipeline.skillHints.join(', ')}`,
      `- Approval: ${pipeline.requiresApproval ? 'Mini App Gate required' : 'not required by this workflow'}`,
      `- Next action: ${pipeline.nextAction || '_not yet specified_'}`,
      `- Desired evidence: ${pipeline.evidence || '_not yet specified_'}`,
      '',
    )
  }
  const reconciliationRows = Object.entries(packet.reconciliations).sort(([left], [right]) => left.localeCompare(right))
  lines.push('## Repository-first reconciliation', '')
  if (reconciliationRows.length === 0) lines.push('_No repository reconciliation decisions recorded._', '')
  for (const [id, reconciliation] of reconciliationRows) {
    const work = workById.get(id)!
    const readiness = intakeReadiness(work, reconciliation)
    const authority = reconciliation.planningAuthority?.kind === 'repository'
      ? `repository · ${reconciliation.planningAuthority.fullName} · ${reconciliation.planningAuthority.repositoryId}`
      : reconciliation.planningAuthority?.kind === 'cambium'
        ? `Cambium · ${reconciliation.planningAuthority.reason}`
        : 'not selected'
    lines.push(
      `### ${work.name}`,
      '',
      `- WorkObject: \`${id}\``,
      `- Repository: ${reconciliation.repositorySourceRef ? `\`${reconciliation.repositorySourceRef}\`` : '_no exact repository selected_'}`,
      `- Repository handling: **${reconciliation.repositoryDisposition}**`,
      `- Origin: **${reconciliation.origin}**`,
      `- Derived type: **${readiness.derivedType}**`,
      `- Canonical type: **${work.classification}**`,
      `- Planning authority: ${authority}`,
      `- Evidence reviewed: repository planning ${reconciliation.repositoryPlanningReviewed ? 'yes' : 'no'} · GitHub issues ${reconciliation.githubIssuesReviewed ? 'yes' : 'no'} · legacy tools/sessions ${reconciliation.legacyEvidenceReviewed ? 'yes' : 'no'}`,
      `- Scheduling readiness: **${readiness.ready ? 'ready' : 'locked'}**`,
      `- Mapping proposal: ${readiness.classificationMismatch ? `change canonical type from ${work.classification} to ${readiness.derivedType} after authority review` : '_none_'}`,
      `- Blockers: ${readiness.blockers.length ? readiness.blockers.join(' ') : '_none_'}`,
      `- Note: ${reconciliation.note || '_none_'}`,
      '',
    )
  }
  const closeoutRows = Object.entries(packet.closeouts).sort(([left], [right]) => left.localeCompare(right))
  lines.push('## Completed / closed work', '')
  if (closeoutRows.length === 0) lines.push('_No completed/closed closeout receipts._', '')
  for (const [id, closeout] of closeoutRows) {
    const work = workById.get(id)
    lines.push(
      `### ${work?.name ?? id}`,
      '',
      `- WorkObject: \`${id}\``,
      `- Disposition: **${closeout.disposition}**`,
      `- Durable receipt: ${closeout.receiptId ? '`' + closeout.receiptId + '`' : '_not yet recorded_'}`,
      `- Final handoff: \`${closeout.handoffMarkdownPath}\``,
      `- Closeout receipt: \`${closeout.closureReceiptJsonPath}\``,
      `- Agent memory: \`${closeout.agentMemoryJsonPath}\``,
      `- R2 vault prefix: \`${closeout.r2VaultPrefix}\``,
      `- Active index disposition: \`${closeout.activeIndexDisposition}\``,
      `- Downstream flows: ${closeout.downstreamFlowsStopped ? 'stopped or transferred' : 'not yet closed'}`,
      `- Summary: ${closeout.finalSummary || '_not yet specified_'}`,
      '',
    )
  }
  const reviewRows = Object.entries(packet.reviewDecisions).sort(([left], [right]) => left.localeCompare(right))
  lines.push('## Classification review proposals', '')
  if (reviewRows.length === 0) lines.push('_No source review records decided locally._', '')
  for (const [id, decision] of reviewRows) {
    const record = reviewById.get(id)!
    lines.push(
      `### ${record.source}`,
      '',
      `- Review record: \`${id}\``,
      `- Proposed type: **${decision.proposedType}**`,
      `- Client family: ${decision.clientFamilyId ? `\`${decision.clientFamilyId}\`` : '_not proposed_'}`,
      `- Note: ${decision.note || '_none_'}`,
      `- Suggestion rule: \`${decision.suggestionRule}\``,
      `- Suggestion source digest: \`${decision.sourceDigest}\``,
      '',
    )
  }
  const retiredReviewRows = Object.entries(packet.retiredReviewDecisions).sort(([left], [right]) => left.localeCompare(right))
  lines.push('## Retired classification-review history', '')
  if (retiredReviewRows.length === 0) lines.push('_No resolved source-review history migrated._', '')
  for (const [id, decision] of retiredReviewRows) {
    lines.push(
      `### ${id}`,
      '',
      `- Historical proposed type: **${decision.proposedType}**`,
      `- Client family: ${decision.clientFamilyId ? `\`${decision.clientFamilyId}\`` : '_not proposed_'}`,
      `- Note: ${decision.note || '_none_'}`,
      `- Historical suggestion rule: \`${decision.suggestionRule}\``,
      `- Historical source digest: \`${decision.sourceDigest}\``,
      '- Status: preserved migration evidence; not an active classification queue item.',
      '',
    )
  }
  lines.push(
    '## Safety boundary',
    '',
    '- Local tags and signals are proposals, never canonical Vault or operational state.',
    '- Repository evidence, origin, and mapping mismatches remain proposals until their owning authority reviews them.',
    '- New client projects remain Client Branches; only Thoughtseed-originated ventures may become Saplings.',
    '- This packet does not activate tenants, assign agents, mint receipts, or send Telegram traffic.',
    '- Runtime integration remains a separately approved, receipt-backed step.',
    '',
  )
  return lines.join('\n')
}
