import {
  RAW_CLASSIFICATION_REVIEW,
  RAW_HISTORICAL_PRODUCTS,
  RAW_PROGRAMS,
  RAW_SAPLINGS,
} from './portfolio-catalog-data.ts'

export const WORKBENCH_SCHEMA = 'thoughtseed.portfolio-workbench.v2' as const
export const LEGACY_SCHEMA = 'thoughtseed.portfolio-cartographer.v1' as const
export const CARTOGRAPHER_SCHEMA = WORKBENCH_SCHEMA
export const CLASSIFICATION_DIGEST = '93b90ed7cee268ac7ee87321a88efefced7980349658cf3c640657a71c361281'
export const SOURCE_SCHEMA = 'thoughtseed.work-object-registry.v1'
export const SOURCE_GENERATED_AT = '2026-07-29T06:46:00Z'

export type Classification = 'sapling' | 'client-branch' | 'internal-program'
export type Horizon = 'now' | 'next' | 'this-year' | 'later' | 'park'
export type BoardHorizon = 'unscheduled' | Horizon
export type Priority = 1 | 2 | 3 | 4 | 5
export type PortfolioSignal = 'unplanned' | 'ongoing' | 'paused' | 'completed' | 'archived'
export type SmartView = 'all' | 'ongoing' | 'paused' | 'white-labelable' | 'needs-review' | 'unplanned' | 'historical'
export type OrganId = 'genesis' | 'taste' | 'hands' | 'will' | 'cortex'
export type SignalStatus = 'ready' | 'complete' | 'blocked' | 'failed' | 'drifted'
export type Audience = 'internal' | 'client'
export type PlanningCategory = 'keep-canonical' | Classification | 'needs-review'

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
  version: 2
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
export const SMART_VIEWS: readonly SmartView[] = ['all', 'ongoing', 'paused', 'white-labelable', 'needs-review', 'unplanned', 'historical']
export const SIGNAL_STATUSES: readonly SignalStatus[] = ['ready', 'complete', 'blocked', 'failed', 'drifted']
export const CLASSIFICATIONS: readonly Classification[] = ['sapling', 'client-branch', 'internal-program']

const workById = new Map(WORK_OBJECTS.map((work) => [work.workId, work]))
const workflowById = new Map(ORGAN_WORKFLOWS.map((workflow) => [workflow.id, workflow]))

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

function matchesView(work: WorkObject, plan: WorkPlan | undefined, view: SmartView): boolean {
  if (view === 'all') return true
  if (view === 'white-labelable') return hasWhiteLabelReuse(work, plan)
  if (view === 'needs-review') return Boolean(plan?.tags.includes('needs-review'))
  if (view === 'historical') return false
  return effectiveSignal(work, plan) === view
}

export function filterWorkObjects(
  query: string,
  classifications: ReadonlySet<Classification>,
  view: SmartView,
  plans: Readonly<Record<string, WorkPlan>> = {},
): WorkObject[] {
  const needle = query.trim().toLowerCase()
  return WORK_OBJECTS.filter((work) => {
    const plan = plans[work.workId]
    if (classifications.size > 0 && !classifications.has(work.classification)) return false
    if (!matchesView(work, plan, view)) return false
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

export function smartViewCount(view: SmartView, plans: Readonly<Record<string, WorkPlan>>): number {
  if (view === 'needs-review') {
    return REVIEW_RECORDS.length + WORK_OBJECTS.filter((work) => plans[work.workId]?.tags.includes('needs-review')).length
  }
  if (view === 'historical') return HISTORICAL_RECORDS.length
  return WORK_OBJECTS.filter((work) => matchesView(work, plans[work.workId], view)).length
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

export function createPacket(state: WorkbenchState, now = new Date()): ExportPacket {
  const focusedId = state.focusedId && workById.has(state.focusedId) ? state.focusedId : null
  const plans: Record<string, WorkPlan> = {}
  for (const [id, raw] of Object.entries(state.plans)) {
    if (!workById.has(id)) continue
    const plan = sanitizePlan(raw, id)
    if (hasLocalPlan(plan)) plans[id] = plan
  }
  const pipelines = Object.entries(plans).map(([id, plan]) => resolvePipeline(workById.get(id)!, plan))
  return {
    schema: WORKBENCH_SCHEMA,
    version: 2,
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

function parseV2(packet: Record<string, unknown>): WorkbenchState {
  if (packet.version !== 2) throw new TypeError('Packet version is not supported')
  if (!packet.plans || typeof packet.plans !== 'object' || Array.isArray(packet.plans)) {
    throw new TypeError('Plans are invalid')
  }
  const plans: Record<string, WorkPlan> = {}
  for (const [id, value] of Object.entries(packet.plans as Record<string, unknown>)) {
    if (!workById.has(id)) throw new TypeError(`Unknown WorkObject in v2 packet: ${id}`)
    plans[id] = sanitizePlan(value, id)
  }
  if (typeof packet.focusedId === 'string' && !workById.has(packet.focusedId)) {
    throw new TypeError(`Unknown focused WorkObject in v2 packet: ${packet.focusedId}`)
  }
  const focusedId = typeof packet.focusedId === 'string' && workById.has(packet.focusedId) ? packet.focusedId : null
  return { focusedId, plans }
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
  return { focusedId: ids[0] ?? null, plans }
}

export function parsePacket(value: unknown): WorkbenchState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Packet must be an object')
  const packet = value as Record<string, unknown>
  if (packet.schema === WORKBENCH_SCHEMA) return parseV2(packet)
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
    `- white-labelable: ${smartViewCount('white-labelable', packet.plans)}`,
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
  lines.push(
    '## Safety boundary',
    '',
    '- Local tags and signals are proposals, never canonical Vault or operational state.',
    '- This packet does not activate tenants, assign agents, mint receipts, or send Telegram traffic.',
    '- Runtime integration remains a separately approved, receipt-backed step.',
    '',
  )
  return lines.join('\n')
}
