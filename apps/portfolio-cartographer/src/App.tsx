import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Check,
  ChevronRight,
  CirclePause,
  Columns3,
  Filter,
  FolderGit2,
  GitBranch,
  Grid2X2,
  History,
  Layers3,
  Leaf,
  ListChecks,
  Menu,
  Network,
  PanelRightOpen,
  Play,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Target,
  X,
} from 'lucide-react'
import {
  CARTOGRAPHER_SCHEMA,
  BOARD_HORIZONS,
  CLASSIFICATION_COUNTS,
  CLASSIFICATION_DIGEST,
  CLASSIFICATIONS,
  HISTORICAL_RECORDS,
  HORIZONS,
  ORGAN_WORKFLOWS,
  PORTFOLIO_ROOT_MAP_DIGEST,
  PORTFOLIO_SIGNALS,
  REVIEW_RECORDS,
  SIGNAL_STATUSES,
  SMART_VIEWS,
  SOURCE_GENERATED_AT,
  WORK_OBJECTS,
  createPacket,
  boardHorizon,
  defaultReconciliation,
  defaultPlan,
  deriveClassificationFromOrigin,
  effectiveSignal,
  filterWorkObjects,
  groupWorkObjects,
  hasLocalPlan,
  intakeReadiness,
  normalizeTag,
  normalizeTags,
  normalizeClientFamilyId,
  normalizeReviewNote,
  parsePacket,
  portfolioFolderMappingsForGroup,
  portfolioFolderMappingsForWork,
  resolvePipeline,
  signalProvenance,
  smartViewCount,
  sourceSignal,
  reviewSuggestion,
  type Audience,
  type BoardHorizon,
  type Classification,
  type Horizon,
  type OrganId,
  type PortfolioSignal,
  type PortfolioOrigin,
  type PortfolioReconciliation,
  type Priority,
  type ReviewDecision,
  type ReviewProposal,
  type SignalStatus,
  type SmartView,
  type WorkObject,
  type WorkPlan,
  type WorkbenchState,
  type WorkObjectGroup,
} from './domain.ts'
import {
  REPOSITORY_EVIDENCE,
  REPOSITORY_EVIDENCE_DIGEST,
} from './repository-evidence.generated.ts'
import {
  discardBulkUndo,
  emptyPlanningHistory,
  recordBulkUndo,
} from './planning-history.ts'

const STORAGE_KEY = 'thoughtseed.portfolio-workbench.v4'
const V3_STORAGE_KEY = 'thoughtseed.portfolio-workbench.v3'
const V2_STORAGE_KEY = 'thoughtseed.portfolio-workbench.v2'
const LEGACY_STORAGE_KEY = 'thoughtseed.portfolio-cartographer.v1'
type DrawerTab = 'intake' | 'plan' | 'delivery'
type ViewMode = 'family' | 'grid' | 'board'
const PORTFOLIO_ACTION_ENDPOINT = '/v1/admin/portfolio/actions'
type AdminActionState =
  | { status: 'idle'; receiptId: null }
  | { status: 'saving'; receiptId: null }
  | { status: 'queued'; receiptId: string }
  | { status: 'error'; receiptId: string | null }

interface AdminActionReceipt {
  receiptId: string
  status: 'queued'
  nextFlow: 'repository-intake-review' | 'founder-gate-review' | 'project-creation-execution'
  approvalStatus?: 'founder-gate-pending' | 'execution-ready'
  duplicate: boolean
}
type ProjectCreationOrigin = 'thoughtseed-venture' | 'thoughtseed-internal' | 'client' | 'unknown'
type ProjectCreationKind = 'sapling' | 'internal-program' | 'client-branch' | 'needs-review'

interface ProjectCreationDraft {
  name: string
  slug: string
  origin: ProjectCreationOrigin
  clientFamilyId: string
}

function derivedProjectKind(origin: ProjectCreationOrigin): ProjectCreationKind {
  if (origin === 'thoughtseed-venture') return 'sapling'
  if (origin === 'thoughtseed-internal') return 'internal-program'
  if (origin === 'client') return 'client-branch'
  return 'needs-review'
}
interface RepositoryEvidence {
  sourceRef: string
  status: 'resolved' | 'unverified' | 'ambiguous' | 'unmatched' | 'malformed' | 'unsafe'
  matchMethod: 'relocation-registry' | 'qualified-name' | 'unique-name' | null
  stableId: string | null
  fullName: string | null
  sourcePath: string | null
  url: string | null
  repositoryId: string | null
  nodeId: string | null
  visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL' | null
  defaultBranch: string | null
  archived: boolean | null
  pushedAt: string | null
  updatedAt: string | null
  gaps: readonly string[]
  candidates?: readonly string[]
}

interface LocalLoad extends WorkbenchState {
  notice: string
  autosaveBlocked: boolean
}

function label(value: string): string {
  if (value === 'this-year') return 'This year'
  return value.replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function loadLocalState(): LocalLoad {
  try {
    const current = window.localStorage.getItem(STORAGE_KEY)
    if (current) {
      try {
        return { ...parsePacket(JSON.parse(current)), notice: 'Restored local draft · save a record to create a durable action', autosaveBlocked: false }
      } catch {
        return {
          focusedId: null,
          plans: {},
          reviewDecisions: {},
          retiredReviewDecisions: {},
          reconciliations: {},
          notice: 'Autosave paused · unreadable v4 data remains untouched',
          autosaveBlocked: true,
        }
      }
    }
    const v3 = window.localStorage.getItem(V3_STORAGE_KEY)
    if (v3) {
      try {
        return {
          ...parsePacket(JSON.parse(v3)),
          notice: 'Migrated v3 plans · original backup preserved',
          autosaveBlocked: false,
        }
      } catch {
        return {
          focusedId: null,
          plans: {},
          reviewDecisions: {},
          retiredReviewDecisions: {},
          reconciliations: {},
          notice: 'Autosave paused · unreadable v3 data remains untouched',
          autosaveBlocked: true,
        }
      }
    }
    const v2 = window.localStorage.getItem(V2_STORAGE_KEY)
    if (v2) {
      try {
        return {
          ...parsePacket(JSON.parse(v2)),
          notice: 'Migrated v2 plans · original backup preserved',
          autosaveBlocked: false,
        }
      } catch {
        return {
          focusedId: null,
          plans: {},
          reviewDecisions: {},
          retiredReviewDecisions: {},
          reconciliations: {},
          notice: 'Autosave paused · unreadable v2 data remains untouched',
          autosaveBlocked: true,
        }
      }
    }
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      try {
        return {
          ...parsePacket(JSON.parse(legacy)),
          notice: 'Migrated v1 plan · original backup preserved',
          autosaveBlocked: false,
        }
      } catch {
        return {
          focusedId: null,
          plans: {},
          reviewDecisions: {},
          retiredReviewDecisions: {},
          reconciliations: {},
          notice: 'Autosave paused · unreadable v1 data remains untouched',
          autosaveBlocked: true,
        }
      }
    }
  } catch {
    return {
      focusedId: null,
      plans: {},
      reviewDecisions: {},
      retiredReviewDecisions: {},
      reconciliations: {},
      notice: 'Local draft unavailable · server actions remain explicit',
      autosaveBlocked: true,
    }
  }
  return { focusedId: null, plans: {}, reviewDecisions: {}, retiredReviewDecisions: {}, reconciliations: {}, notice: 'Ready · edit a record, then save its admin action', autosaveBlocked: false }
}

function hostedAdminActionsAvailable(): boolean {
  return ['/admin/portfolio', '/admin/portfolio/web', '/v1/admin/portfolio'].includes(window.location.pathname)
}

function actionIdempotencyKey(subjectId: string): string {
  const nonce = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${subjectId.replace(/[^A-Za-z0-9._:@/-]/g, '-').slice(0, 72)}:${nonce}`
}

async function postPortfolioAdminAction(action: Record<string, unknown>): Promise<AdminActionReceipt> {
  if (!hostedAdminActionsAvailable()) throw new Error('Hosted admin connection required')
  const telegram = (window as Window & {
    Telegram?: { WebApp?: { initData?: string } }
  }).Telegram
  const initData = telegram?.WebApp?.initData?.trim()
  const response = await window.fetch(PORTFOLIO_ACTION_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      ...(initData ? { 'x-telegram-init-data': initData } : {}),
    },
    body: JSON.stringify(action),
  })
  const body = await response.json() as {
    receipt?: AdminActionReceipt
    error?: string
    durable?: boolean
    receiptId?: string
  }
  if (!response.ok || !body.receipt) {
    const durable = body.durable && body.receiptId ? ` Evidence ${body.receiptId} is durable; retry the trigger.` : ''
    throw new Error(`${body.error ?? 'Portfolio action failed'}.${durable}`)
  }
  return body.receipt
}

function classificationIcon(classification: Classification) {
  if (classification === 'sapling') return <Leaf aria-hidden="true" />
  if (classification === 'client-branch') return <GitBranch aria-hidden="true" />
  return <Layers3 aria-hidden="true" />
}

function signalIcon(signal: PortfolioSignal) {
  if (signal === 'ongoing') return <Play aria-hidden="true" />
  if (signal === 'paused') return <CirclePause aria-hidden="true" />
  if (signal === 'completed') return <Check aria-hidden="true" />
  if (signal === 'archived') return <Archive aria-hidden="true" />
  return <Target aria-hidden="true" />
}

function quickActionLabel(signal: PortfolioSignal): string {
  if (signal === 'ongoing') return 'Pause'
  if (signal === 'paused') return 'Resume'
  return 'Start'
}

function quickActionSignal(signal: PortfolioSignal): PortfolioSignal {
  if (signal === 'ongoing') return 'paused'
  return 'ongoing'
}

function writePlanned(
  plans: Record<string, WorkPlan>,
  id: string,
  candidate: WorkPlan,
): void {
  if (hasLocalPlan(candidate)) plans[id] = candidate
  else delete plans[id]
}

function repositoryEvidenceForWork(work: WorkObject): RepositoryEvidence[] {
  const refs = new Set(work.provenance.filter((source) => source.startsWith('repo:')))
  return REPOSITORY_EVIDENCE.filter((record) => refs.has(record.sourceRef)) as RepositoryEvidence[]
}

function WorkCard({
  work,
  plan,
  bulkMode,
  bulkSelected,
  onBulkToggle,
  onFocus,
  onQuickSignal,
  unplannedTriage,
  reconciliation,
}: {
  work: WorkObject
  plan?: WorkPlan
  bulkMode: boolean
  bulkSelected: boolean
  onBulkToggle: () => void
  onFocus: () => void
  onQuickSignal: (signal: PortfolioSignal) => void
  unplannedTriage: boolean
  reconciliation?: PortfolioReconciliation
}) {
  const signal = effectiveSignal(work, plan)
  const provenance = signalProvenance(work, plan)
  const tags = plan?.tags ?? []
  const readiness = intakeReadiness(work, reconciliation ?? defaultReconciliation(work.workId))
  const planningLocked = sourceSignal(work) === 'unplanned' && !readiness.ready
  const folderMappings = portfolioFolderMappingsForWork(work.workId)
  return (
    <article
      className={bulkSelected ? `work-card signal-${signal} is-bulk-selected` : `work-card signal-${signal}`}
      data-work-id={work.workId}
      data-card-id={work.workId}
    >
      <header className="work-card-head">
        {bulkMode && (
          <label className="bulk-check">
            <input type="checkbox" checked={bulkSelected} onChange={onBulkToggle} disabled={planningLocked} />
            <span className="visually-hidden">Select {work.name} for bulk planning</span>
          </label>
        )}
        <div className={`kind-mark kind-${work.classification}`}>{classificationIcon(work.classification)}</div>
        <div className="work-heading">
          <span className="work-type">{label(work.classification)}</span>
          <h3>{work.name}</h3>
          <code>{work.workId}</code>
        </div>
        <button
          type="button"
          className="icon-button focus-work"
          data-focus
          onClick={onFocus}
          aria-label={`Open ${work.name} plan`}
          title="Open project plan"
        >
          <PanelRightOpen aria-hidden="true" />
        </button>
      </header>

      <div className="chip-row source-row" aria-label="Source facts">
        <span className="chip chip-source" title="Immutable source classification">
          {label(work.lifecycle)} <small>source</small>
        </span>
        {work.overlay === 'paused' && (
          <span className="chip chip-paused" title="Vault projection overlay">Paused <small>source</small></span>
        )}
        {work.commercialReuse === 'white-labelable' && (
          <span className="chip chip-reuse" title="Vault commercial reuse signal">White-labelable <small>source</small></span>
        )}
      </div>

      <div className="planning-summary">
        <span className={`signal-pill signal-pill-${signal}`}>
          {signalIcon(signal)}
          {label(signal)}
          <small>{provenance}</small>
        </span>
        {plan && (
          <span className="plan-meta">
            {label(boardHorizon(plan))} · P{plan.priority}
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="chip-row local-tags" aria-label="Local planning tags">
          {tags.slice(0, 3).map((tagValue) => <span className="chip chip-local" key={tagValue}>#{tagValue}</span>)}
          {tags.length > 3 && <span className="tag-overflow">+{tags.length - 3}</span>}
        </div>
      )}

      <div className={folderMappings.length > 0 ? 'folder-receipt' : 'folder-receipt is-gap'}>
        <FolderGit2 aria-hidden="true" />
        <span>{folderMappings.length > 0 ? folderMappings.map((mapping) => mapping.path).join(' · ') : 'Folder mapping gap'}</span>
        <small>proposal</small>
      </div>

      {unplannedTriage && (
        <div className="unplanned-actions" aria-label={`Reconcile ${work.name} before scheduling`}>
          <button type="button" className="intake-action" onClick={onFocus} aria-label={`Inspect & reconcile ${work.name}`}>
            <ShieldCheck aria-hidden="true" />
            <span>Review repository & map<small>{readiness.ready
              ? 'Ready for scheduling'
              : work.classification === 'client-branch'
                ? 'Assign the Client Branch family'
                : 'Confirm Thoughtseed origin before planning'}</small></span>
          </button>
        </div>
      )}

      <footer className="work-card-actions">
        <span>{work.accountId ? `account · ${work.accountId}` : `tenant · ${work.tenantId ?? work.tenantStatus}`}</span>
        {!unplannedTriage && planningLocked && (
          <button type="button" className="quick-action intake-locked" onClick={onFocus} aria-label={`Reconcile ${work.name} before planning`}>
            <ShieldCheck aria-hidden="true" /> Reconcile first
          </button>
        )}
        {!unplannedTriage && !planningLocked && (
          <button
            type="button"
            className="quick-action"
            onClick={() => onQuickSignal(quickActionSignal(signal))}
            aria-label={`${quickActionLabel(signal)} ${work.name}`}
          >
            {signal === 'ongoing' ? <CirclePause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {quickActionLabel(signal)}
          </button>
        )}
      </footer>
    </article>
  )
}

function FamilyGroup({
  group,
  expanded,
  onToggle,
  renderCard,
}: {
  group: WorkObjectGroup
  expanded: boolean
  onToggle: () => void
  renderCard: (work: WorkObject) => ReactNode
}) {
  const folderMappings = portfolioFolderMappingsForGroup(group)
  const rollup = Object.entries(group.signalSummary)
    .filter(([, count]) => count > 0)
    .map(([signal, count]) => `${count} ${label(signal)}`)
    .join(' · ')
  return (
    <section className="family-group" data-family-id={group.groupId}>
      <button
        type="button"
        className="family-header"
        aria-expanded={expanded}
        aria-controls={`family-${group.groupId.replaceAll(':', '-')}`}
        onClick={onToggle}
      >
        <ChevronRight aria-hidden="true" />
        <span>
          <strong>{group.label}</strong>
          <small>{group.provenance}</small>
          <code className={folderMappings.length > 0 ? 'family-folder-map' : 'family-folder-map is-gap'}>
            {folderMappings.length > 0 ? folderMappings.map((mapping) => mapping.path).join(' · ') : 'folder mapping gap'}
          </code>
        </span>
        <span className="family-rollup">{rollup || 'No matching signals'}</span>
        <b>{group.members.length}</b>
      </button>
      <div id={`family-${group.groupId.replaceAll(':', '-')}`} hidden={!expanded}>
        <div className="card-grid">{group.members.map(renderCard)}</div>
      </div>
    </section>
  )
}

function AdminActionStatus({ state, available }: { state: AdminActionState; available: boolean }) {
  const labelText = !available
    ? 'Local preview'
    : state.status === 'saving'
      ? 'Saving action'
      : state.status === 'queued'
        ? 'Action queued'
        : state.status === 'error'
          ? 'Action needs retry'
          : 'Admin actions ready'
  return (
    <div className={`admin-action-status status-${state.status}`} aria-live="polite">
      <ShieldCheck aria-hidden="true" />
      <span>{labelText}<small>{available ? state.receiptId ?? 'R2 evidence · governed queue' : 'hosted connection required'}</small></span>
    </div>
  )
}

function ProjectCreationDrawer({
  draft,
  derivedKind,
  actionState,
  actionsAvailable,
  onChange,
  onSubmit,
  onClose,
}: {
  draft: ProjectCreationDraft
  derivedKind: ProjectCreationKind
  actionState: AdminActionState
  actionsAvailable: boolean
  onChange: (patch: Partial<ProjectCreationDraft>) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const slugValid = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(draft.slug)
  const clientValid = draft.origin !== 'client' || /^[a-z0-9][a-z0-9-]{0,63}$/.test(draft.clientFamilyId)
  const canSubmit = actionsAvailable
    && actionState.status !== 'saving'
    && draft.name.trim().length > 0
    && slugValid
    && clientValid
    && draft.origin !== 'unknown'
  return (
    <aside className="plan-drawer project-creation-drawer" role="dialog" aria-modal="false" aria-labelledby="project-creation-title">
      <header className="drawer-head">
        <div className="kind-mark"><Plus aria-hidden="true" /></div>
        <div>
          <span>Thoughtseed · governed project birth</span>
          <h2 id="project-creation-title">New Thoughtseed project</h2>
          <code>thoughtseed/{draft.slug || '&lt;repository&gt;'}</code>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close project creation"><X aria-hidden="true" /></button>
      </header>
      <div className="drawer-body">
        <form className="drawer-section intake-section" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
          <div className="intake-rule">
            <ShieldCheck aria-hidden="true" />
            <div>
              <strong>Founder command · execution intent</strong>
              <p>The hosted surface records immutable intent. A trusted local executor creates the folder later; this form never writes the filesystem.</p>
            </div>
          </div>
          <div className="field-grid">
            <label><span>Project name</span><input value={draft.name} maxLength={120} onChange={(event) => onChange({ name: event.target.value })} placeholder="Project name" /></label>
            <label><span>Repository slug</span><input value={draft.slug} maxLength={64} onChange={(event) => onChange({ slug: event.target.value.toLowerCase() })} placeholder="project-name" aria-invalid={draft.slug.length > 0 && !slugValid} /></label>
            <label><span>Origin</span><select value={draft.origin} onChange={(event) => onChange({ origin: event.target.value as ProjectCreationOrigin, clientFamilyId: event.target.value === 'client' ? draft.clientFamilyId : '' })}>
              <option value="unknown">Needs review</option>
              <option value="thoughtseed-venture">Thoughtseed venture</option>
              <option value="thoughtseed-internal">Thoughtseed internal</option>
              <option value="client">Client engagement</option>
            </select></label>
            {draft.origin === 'client' && <label><span>Client family</span><input value={draft.clientFamilyId} maxLength={64} onChange={(event) => onChange({ clientFamilyId: event.target.value.toLowerCase() })} placeholder="client-family" aria-invalid={draft.clientFamilyId.length > 0 && !clientValid} /></label>}
          </div>
          <div className="project-evidence-list">
            <span><b>Request source</b><code>local-founder · locked</code></span>
            <span><b>Derived kind</b><code>{derivedKind}</code></span>
            <span><b>Destination</b><code>thoughtseed/{draft.slug || '&lt;repository&gt;'}</code></span>
            <span><b>After creation</b><code>pending-cambium-ingestion</code></span>
          </div>
          <div className="admin-action-panel">
            <div><ShieldCheck aria-hidden="true" /><span><strong>Durable creation intent</strong><small>R2 evidence first · trusted local execution later</small></span></div>
            <button type="submit" className="primary-button" disabled={!canSubmit}>
              <Plus aria-hidden="true" /> {actionState.status === 'saving' ? 'Saving…' : 'Save creation intent'}
            </button>
            {!actionsAvailable && <p>Hosted admin connection required. The local preview cannot write.</p>}
            {draft.origin === 'unknown' && <p>Choose explicit origin evidence before creating a repository.</p>}
            {actionState.status === 'queued' && <p role="status">Execution-ready intent queued · receipt {actionState.receiptId}</p>}
          </div>
        </form>
      </div>
    </aside>
  )
}

function ReviewQueue({
  decisions,
  onChoose,
  onChange,
  onReset,
}: {
  decisions: Readonly<Record<string, ReviewDecision>>
  onChoose: (id: string, proposedType: ReviewProposal) => void
  onChange: (id: string, patch: Partial<ReviewDecision>) => void
  onReset: (id: string) => void
}) {
  const decided = REVIEW_RECORDS.filter((record) => Boolean(decisions[record.canonicalId])).length
  const familyIds = groupWorkObjects().filter((group) => group.kind === 'client-family').map((group) => group.accountId!)
  return (
    <section className="review-desk" aria-label="Classification review queue">
      <header className="review-progress">
        <div><span>Guided source review</span><h2>{decided} decided · {REVIEW_RECORDS.length - decided} remaining</h2></div>
        <progress value={decided} max={REVIEW_RECORDS.length}>{decided} of {REVIEW_RECORDS.length}</progress>
      </header>
      <div className="review-grid">
        {REVIEW_RECORDS.map((record) => {
          const suggestion = reviewSuggestion(record)
          const decision = decisions[record.canonicalId]
          return (
            <article className={decision ? 'review-triage-card is-decided' : 'review-triage-card'} key={record.canonicalId} data-review-id={record.canonicalId}>
              <header>
                <AlertTriangle aria-hidden="true" />
                <div><span>Source review record</span><h3>{record.source}</h3><code>{record.canonicalId}</code></div>
              </header>
              <p className="review-needed"><strong>Evidence missing</strong>{record.needed}</p>
              <div className="suggestion-box">
                <span>Suggested · local rule</span>
                <strong>{label(suggestion.proposedType)}</strong>
                <p>{suggestion.rationale}</p>
                <code>{suggestion.ruleVersion} · {suggestion.sourceDigest}</code>
              </div>
              <div className="review-choices" aria-label={`Propose a classification for ${record.source}`}>
                {(['sapling', 'client-branch', 'internal-program', 'needs-review'] as const).map((proposal) => (
                  <button
                    type="button"
                    key={proposal}
                    className={decision?.proposedType === proposal ? 'is-active' : proposal === suggestion.proposedType ? 'is-suggested' : ''}
                    aria-pressed={decision?.proposedType === proposal}
                    aria-label={`Propose ${proposal === 'needs-review' ? 'Keep reviewing' : label(proposal)} for ${record.source}`}
                    onClick={() => onChoose(record.canonicalId, proposal)}
                  >
                    {proposal === 'needs-review' ? 'Keep reviewing' : label(proposal)}
                  </button>
                ))}
              </div>
              {decision && (
                <div className="review-local-fields">
                  {decision.proposedType === 'client-branch' && (
                    <label><span>Optional client family · local proposal</span><input list="client-family-options" maxLength={72} value={decision.clientFamilyId} onChange={(event) => onChange(record.canonicalId, { clientFamilyId: normalizeClientFamilyId(event.target.value) })} placeholder="account-family-id" /></label>
                  )}
                  <label><span>Decision note · local proposal</span><textarea rows={2} maxLength={400} value={decision.note} onChange={(event) => onChange(record.canonicalId, { note: normalizeReviewNote(event.target.value) })} placeholder="What evidence should confirm this proposal?" /></label>
                  <button type="button" className="reset-review" onClick={() => onReset(record.canonicalId)}><RotateCcw aria-hidden="true" /> Reset local decision</button>
                </div>
              )}
            </article>
          )
        })}
      </div>
      <datalist id="client-family-options">{familyIds.map((familyId) => <option key={familyId} value={familyId} />)}</datalist>
    </section>
  )
}

function HistoricalQueue() {
  return (
    <section className="secondary-grid" aria-label="Historical product surfaces">
      {HISTORICAL_RECORDS.map((record) => (
        <article className="secondary-card historical-card" key={record.canonicalId}>
          <History aria-hidden="true" />
          <div>
            <span>{label(record.status)} · source archive</span>
            <h3>{record.name}</h3>
            <code>{record.canonicalId}</code>
          </div>
        </article>
      ))}
    </section>
  )
}

function PlanDrawer({
  work,
  plan,
  reconciliation,
  repositoryEvidence,
  planningLocked,
  tab,
  onTab,
  onChange,
  onReconciliationChange,
  actionState,
  actionsAvailable,
  onQueueReconciliation,
  onClose,
}: {
  work: WorkObject
  plan: WorkPlan
  reconciliation: PortfolioReconciliation
  repositoryEvidence: readonly RepositoryEvidence[]
  planningLocked: boolean
  tab: DrawerTab
  onTab: (tab: DrawerTab) => void
  onChange: (patch: Partial<WorkPlan>) => void
  onReconciliationChange: (patch: Partial<PortfolioReconciliation>) => void
  actionState: AdminActionState
  actionsAvailable: boolean
  onQueueReconciliation: () => void
  onClose: () => void
}) {
  const [tagDraft, setTagDraft] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)
  const pipeline = resolvePipeline(work, plan)
  const workflow = ORGAN_WORKFLOWS.find((candidate) => candidate.id === plan.delivery.organ)!
  const readiness = intakeReadiness(work, reconciliation)
  const selectedRepository = repositoryEvidence.find((record) => record.sourceRef === reconciliation.repositorySourceRef)

  useEffect(() => {
    closeRef.current?.focus()
  }, [work.workId])

  function addTag() {
    const normalized = normalizeTag(tagDraft)
    if (!normalized) return
    onChange({ tags: normalizeTags([...plan.tags, normalized]) })
    setTagDraft('')
  }

  function changeOrgan(organ: OrganId) {
    const nextWorkflow = ORGAN_WORKFLOWS.find((candidate) => candidate.id === organ)!
    onChange({
      delivery: {
        ...plan.delivery,
        organ,
        trigger: nextWorkflow.triggers[0],
        audience: organ === 'will' ? plan.delivery.audience : 'internal',
      },
    })
  }

  function selectRepository(value: string) {
    if (value === '__none__') {
      onReconciliationChange({
        repositorySourceRef: null,
        repositoryDisposition: 'no-repository',
        planningAuthority: { kind: 'cambium', reason: 'No exact project repository is available; Cambium coordinates this mapping gap.' },
      })
      return
    }
    const evidence = repositoryEvidence.find((record) => record.sourceRef === value)
    if (!evidence) {
      onReconciliationChange({ repositorySourceRef: null, repositoryDisposition: 'unmatched', planningAuthority: null })
      return
    }
    const disposition = evidence.status === 'resolved'
      ? 'resolved'
      : evidence.status === 'ambiguous'
        ? 'ambiguous'
        : 'unmatched'
    onReconciliationChange({
      repositorySourceRef: evidence.sourceRef,
      repositoryDisposition: disposition,
      planningAuthority: evidence.status === 'resolved' && evidence.repositoryId && evidence.fullName
        ? { kind: 'repository', repositoryId: evidence.repositoryId, fullName: evidence.fullName }
        : null,
    })
  }

  return (
    <aside className="plan-drawer" role="dialog" aria-modal="false" aria-labelledby="drawer-title">
      <header className="drawer-head">
        <div className={`kind-mark kind-${work.classification}`}>{classificationIcon(work.classification)}</div>
        <div>
          <span>{label(work.classification)} · focused plan</span>
          <h2 id="drawer-title">{work.name}</h2>
          <code>{work.workId}</code>
        </div>
        <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close project plan">
          <X aria-hidden="true" />
        </button>
      </header>

      <nav className="drawer-tabs" aria-label="Project detail views">
        {(['intake', 'plan', 'delivery'] as const).map((drawerTab) => (
          <button
            type="button"
            key={drawerTab}
            className={tab === drawerTab ? 'is-active' : ''}
            aria-current={tab === drawerTab ? 'page' : undefined}
            onClick={() => onTab(drawerTab)}
          >
            {label(drawerTab)}
          </button>
        ))}
      </nav>

      <div className="drawer-body">
        {tab === 'intake' && (
          <section className="drawer-section overview-section intake-section">
            <div className="intake-rule">
              <ShieldCheck aria-hidden="true" />
              <div>
                <strong>Origin before scheduling</strong>
                <p>Only Thoughtseed-originated ventures become Saplings. Every client project remains a Client Branch, even when new. Shared Thoughtseed capability work is an Internal Program.</p>
              </div>
            </div>
            <label className="wide-field">
              <span>Exact repository evidence</span>
              <select
                value={reconciliation.repositoryDisposition === 'no-repository' ? '__none__' : reconciliation.repositorySourceRef ?? ''}
                onChange={(event) => selectRepository(event.target.value)}
              >
                <option value="">Choose an exact repository or preserve the gap</option>
                {repositoryEvidence.map((evidence) => (
                  <option key={evidence.sourceRef} value={evidence.sourceRef}>
                    {evidence.fullName ?? evidence.sourceRef} · {evidence.status}{evidence.repositoryId ? ' · verified ID' : ' · metadata gap'}
                  </option>
                ))}
                {repositoryEvidence.length === 0 && <option value="__none__">No project repository · coordinate in Cambium</option>}
              </select>
            </label>
            {selectedRepository && (
              <div className={`repository-receipt repository-${selectedRepository.status}`}>
                <div>
                  <span>{selectedRepository.status} · {selectedRepository.matchMethod ?? 'no match rule'}</span>
                  <strong>{selectedRepository.fullName ?? selectedRepository.sourceRef}</strong>
                  <code>{selectedRepository.repositoryId ?? 'immutable GitHub ID unavailable'}</code>
                </div>
                {selectedRepository.url && (
                  <a href={selectedRepository.url} target="_blank" rel="noreferrer">Open GitHub repository</a>
                )}
                {selectedRepository.gaps.length > 0 && <p>Evidence gaps: {selectedRepository.gaps.join(' · ')}</p>}
              </div>
            )}
            <div className="field-grid">
              <label>
                <span>Origin</span>
                <select
                  value={reconciliation.origin}
                  onChange={(event) => onReconciliationChange({
                    origin: event.target.value as PortfolioOrigin,
                    clientFamilyId: event.target.value === 'client'
                      ? reconciliation.clientFamilyId || work.accountId || ''
                      : '',
                  })}
                >
                  <option value="unknown">Unknown · Needs Review</option>
                  <option value="thoughtseed-venture">Thoughtseed venture or product</option>
                  <option value="client">Client-originated project</option>
                  <option value="thoughtseed-internal">Thoughtseed shared capability or operations</option>
                </select>
              </label>
              <label>
                <span>Derived WorkObject type</span>
                <input value={label(deriveClassificationFromOrigin(reconciliation.origin))} readOnly />
              </label>
            </div>
            {reconciliation.origin === 'client' && (
              <label className="wide-field">
                <span>Client family · local mapping proposal</span>
                <input
                  value={reconciliation.clientFamilyId}
                  maxLength={64}
                  onChange={(event) => onReconciliationChange({ clientFamilyId: normalizeClientFamilyId(event.target.value) })}
                  placeholder={work.accountId ?? 'client-family-id'}
                  list="portfolio-client-families"
                />
                <datalist id="portfolio-client-families">
                  {[...new Set(WORK_OBJECTS.map((candidate) => candidate.accountId).filter((accountId): accountId is string => Boolean(accountId)))].sort().map((accountId) => (
                    <option key={accountId} value={accountId} />
                  ))}
                </datalist>
              </label>
            )}
            <dl className="intake-comparison">
              <div><dt>Canonical catalog</dt><dd>{label(work.classification)}</dd></div>
              <div><dt>Origin derives</dt><dd>{label(readiness.derivedType)}</dd></div>
              <div><dt>Planning authority</dt><dd>{reconciliation.planningAuthority?.kind === 'repository' ? reconciliation.planningAuthority.fullName : reconciliation.planningAuthority?.kind === 'cambium' ? 'Cambium · cross-portfolio' : 'not selected'}</dd></div>
            </dl>
            {readiness.classificationMismatch && (
              <div className="mapping-warning" role="alert">
                <AlertTriangle aria-hidden="true" />
                <p>Canonical mismatch: save and queue the mapping proposal for governed review. This WorkObject stays locked until that review changes source truth.</p>
              </div>
            )}
            <fieldset className="intake-checklist">
              <legend>Evidence reviewed</legend>
              <label><input type="checkbox" checked={reconciliation.repositoryPlanningReviewed} onChange={(event) => onReconciliationChange({ repositoryPlanningReviewed: event.target.checked })} /> Repository planning and roadmap</label>
              <label><input type="checkbox" checked={reconciliation.githubIssuesReviewed} onChange={(event) => onReconciliationChange({ githubIssuesReviewed: event.target.checked })} /> GitHub issues and current backlog</label>
              <label><input type="checkbox" checked={reconciliation.legacyEvidenceReviewed} onChange={(event) => onReconciliationChange({ legacyEvidenceReviewed: event.target.checked })} /> Tool, session, and dated planning evidence reconciled</label>
            </fieldset>
            <label className="wide-field">
              <span>Reconciliation note</span>
              <textarea rows={3} maxLength={400} value={reconciliation.note} onChange={(event) => onReconciliationChange({ note: normalizeReviewNote(event.target.value) })} placeholder="Record the evidence, conflict, or repository-planning handoff." />
            </label>
            <div className={readiness.ready ? 'intake-readiness is-ready' : 'intake-readiness is-locked'}>
              {readiness.ready ? <Check aria-hidden="true" /> : <Target aria-hidden="true" />}
              <div><strong>{readiness.ready ? 'Ready for scheduling' : 'Scheduling locked'}</strong>{readiness.blockers.map((blocker) => <p key={blocker}>{blocker}</p>)}</div>
            </div>
            <div className="admin-action-panel">
              <div><ShieldCheck aria-hidden="true" /><span><strong>Save intake action</strong><small>Immutable R2 receipt · pending repository review</small></span></div>
              <button type="button" className="primary-button" disabled={!actionsAvailable || actionState.status === 'saving'} onClick={onQueueReconciliation}>
                <FolderGit2 aria-hidden="true" /> {actionState.status === 'saving' ? 'Saving…' : 'Save & queue repository review'}
              </button>
              {!actionsAvailable && <p>Hosted admin connection required. The local preview cannot write.</p>}
              {actionState.status === 'queued' && <p role="status">Queued · receipt {actionState.receiptId}</p>}
            </div>
            {work.classification === 'client-branch' && (
              <div className="reusable-ip-note"><Sparkles aria-hidden="true" /><p>Reusable Thoughtseed IP from this client work becomes a separate linked Sapling proposal. The client project remains a Client Branch.</p></div>
            )}
            <div className="authority-note">
              <ShieldCheck aria-hidden="true" />
              <div><strong>Source truth changes through governance</strong><p>This action records durable evidence and queues review; it never rewrites the catalog directly.</p></div>
            </div>
            <dl className="fact-grid">
              <div><dt>Canonical type</dt><dd>{label(work.classification)}</dd></div>
              <div><dt>Source state</dt><dd>{label(work.lifecycle)}</dd></div>
              <div><dt>Source signal</dt><dd>{label(sourceSignal(work))}</dd></div>
              <div><dt>Tenant boundary</dt><dd>{work.tenantId ?? work.tenantStatus}</dd></div>
              <div><dt>Account</dt><dd>{work.accountId ?? 'not applicable'}</dd></div>
              <div><dt>Linked work</dt><dd>{work.linkedWorkIds.length || 'none'}</dd></div>
            </dl>
            {work.commercialReuse === 'white-labelable' && (
              <div className="source-banner reuse-banner"><Sparkles /> White-labelable delivery IP <small>source</small></div>
            )}
            {work.overlay === 'paused' && (
              <div className="source-banner paused-banner"><CirclePause /> Paused projection; canonical lifecycle stays {label(work.lifecycle)}.</div>
            )}
            <div className="provenance-list">
              <span>Evidence references</span>
              {work.provenance.map((source) => <code key={source}>{source}</code>)}
            </div>
          </section>
        )}

        {tab === 'plan' && (
          <section className="drawer-section plan-section">
            {planningLocked && <div className="planning-lock"><ShieldCheck aria-hidden="true" /><p>Complete Intake before changing scheduling. Existing legacy plan values remain visible in the local draft.</p></div>}
            <fieldset disabled={planningLocked} className="planning-fieldset">
            <div className="field-block">
              <span className="field-title">Portfolio signal <small>draft until saved</small></span>
              <div className="signal-options">
                {PORTFOLIO_SIGNALS.map((signal) => (
                  <button
                    type="button"
                    key={signal}
                    className={(plan.signal ?? sourceSignal(work)) === signal ? `signal-choice signal-${signal} is-active` : `signal-choice signal-${signal}`}
                    aria-pressed={plan.signal === signal}
                    onClick={() => onChange({ signal })}
                  >
                    {signalIcon(signal)} {label(signal)}
                  </button>
                ))}
              </div>
              {plan.signal && (
                <button type="button" className="text-button" onClick={() => onChange({ signal: null })}>
                  Restore source-derived signal
                </button>
              )}
            </div>

            <div className="field-grid">
              <label>
                <span>Planning horizon</span>
                <select
                  value={plan.horizon ?? ''}
                  onChange={(event) => onChange({ horizon: event.target.value ? event.target.value as Horizon : null })}
                >
                  <option value="">Unscheduled</option>
                  {HORIZONS.map((horizon) => <option key={horizon} value={horizon}>{label(horizon)}</option>)}
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select value={plan.priority} onChange={(event) => onChange({ priority: Number(event.target.value) as Priority })}>
                  {[1, 2, 3, 4, 5].map((priority) => <option key={priority} value={priority}>P{priority}</option>)}
                </select>
              </label>
            </div>

            <div className="field-block">
              <label htmlFor="tag-draft"><span className="field-title">Planning tags</span></label>
              <div className="tag-input">
                <input
                  id="tag-draft"
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addTag()
                    }
                  }}
                  maxLength={40}
                  placeholder="white-labelable, needs-review…"
                />
                <button type="button" onClick={addTag}><Plus aria-hidden="true" /> Add</button>
              </div>
              <div className="tag-editor">
                {work.commercialReuse === 'white-labelable' && <span className="chip chip-reuse">White-labelable <small>source</small></span>}
                {plan.tags.map((tagValue) => (
                  <button
                    type="button"
                    className="chip chip-local removable-tag"
                    key={tagValue}
                    onClick={() => onChange({ tags: plan.tags.filter((candidate) => candidate !== tagValue) })}
                    aria-label={`Remove ${tagValue} tag`}
                  >
                    #{tagValue} <X aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>

            <label className="wide-field">
              <span>Next action</span>
              <textarea
                rows={4}
                maxLength={600}
                value={plan.nextAction}
                onChange={(event) => onChange({ nextAction: event.target.value })}
                placeholder="What is the next meaningful move?"
              />
            </label>
            <label className="wide-field">
              <span>Evidence of completion</span>
              <input
                maxLength={400}
                value={plan.evidence}
                onChange={(event) => onChange({ evidence: event.target.value })}
                placeholder="What receipt or result proves this moved?"
              />
            </label>
            </fieldset>
          </section>
        )}

        {tab === 'delivery' && (
          <section className="drawer-section delivery-section">
            {planningLocked && <div className="planning-lock"><ShieldCheck aria-hidden="true" /><p>Complete Intake before changing delivery planning.</p></div>}
            <fieldset disabled={planningLocked} className="planning-fieldset">
            <div className="delivery-boundary">
              <Network aria-hidden="true" />
              <p>Optional delivery planning. Cambium compiles intent; Hermes owns Telegram transport.</p>
            </div>
            <div className="field-grid">
              <label>
                <span>Primary organ</span>
                <select value={plan.delivery.organ} onChange={(event) => changeOrgan(event.target.value as OrganId)}>
                  {ORGAN_WORKFLOWS.map((organ) => <option key={organ.id} value={organ.id}>{organ.name}</option>)}
                </select>
              </label>
              <label>
                <span>Valid trigger</span>
                <select
                  value={plan.delivery.trigger}
                  onChange={(event) => onChange({ delivery: { ...plan.delivery, trigger: event.target.value } })}
                >
                  {workflow.triggers.map((trigger) => <option key={trigger} value={trigger}>{label(trigger)}</option>)}
                </select>
              </label>
              <label>
                <span>Delivery signal</span>
                <select
                  value={plan.delivery.status}
                  onChange={(event) => onChange({ delivery: { ...plan.delivery, status: event.target.value as SignalStatus } })}
                >
                  {SIGNAL_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
                </select>
              </label>
              <label>
                <span>Audience</span>
                <select
                  value={plan.delivery.audience}
                  disabled={plan.delivery.organ !== 'will'}
                  onChange={(event) => onChange({ delivery: { ...plan.delivery, audience: event.target.value as Audience } })}
                >
                  <option value="internal">Internal</option>
                  {plan.delivery.organ === 'will' && <option value="client">Client</option>}
                </select>
              </label>
            </div>

            <div className="pipeline-preview" data-pipeline-id={work.workId}>
              <div className="pipeline-nodes" aria-label={`${work.name} connected delivery path`}>
                <div><small>WorkObject</small><strong>{work.name}</strong></div>
                <ChevronRight aria-hidden="true" />
                <div><small>Organ</small><strong>{pipeline.organName}</strong></div>
                <ChevronRight aria-hidden="true" />
                <div className={pipeline.topic === 'Alerts' ? 'is-alert' : ''}><small>Telegram topic</small><strong>{pipeline.topic}</strong></div>
              </div>
              <div className="stage-rail">
                {pipeline.stages.map((stage, index) => (
                  <span key={stage}><i>{index + 1}</i>{stage}{index < pipeline.stages.length - 1 && <ArrowRight />}</span>
                ))}
              </div>
              <p>Required skills · {pipeline.skillHints.join(' · ')}</p>
              {pipeline.requiresApproval && <div className="gate-flag"><ShieldCheck /> Mini App Gate required for client delivery</div>}
              {pipeline.escalationTopic && <div className="alert-flag"><AlertTriangle /> Exceptional signal escalates to Alerts</div>}
            </div>
            </fieldset>
          </section>
        )}
      </div>
    </aside>
  )
}

function App() {
  const initial = useMemo(loadLocalState, [])
  const [plans, setPlans] = useState<Record<string, WorkPlan>>({ ...initial.plans })
  const [reviewDecisions, setReviewDecisions] = useState<Record<string, ReviewDecision>>({ ...initial.reviewDecisions })
  const [retiredReviewDecisions] = useState<Record<string, ReviewDecision>>({ ...initial.retiredReviewDecisions })
  const [reconciliations, setReconciliations] = useState<Record<string, PortfolioReconciliation>>({ ...initial.reconciliations })
  const [focusedId, setFocusedId] = useState<string | null>(initial.focusedId)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('intake')
  const [projectCreationOpen, setProjectCreationOpen] = useState(false)
  const [projectCreation, setProjectCreation] = useState<ProjectCreationDraft>({ name: '', slug: '', origin: 'unknown', clientFamilyId: '' })
  const [activeView, setActiveView] = useState<SmartView>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('family')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(
    groupWorkObjects().filter((group) => group.kind === 'client-family' && group.members.length > 1).map((group) => group.groupId),
  ))
  const [query, setQuery] = useState('')
  const [classifications, setClassifications] = useState<Set<Classification>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkSignal, setBulkSignal] = useState<PortfolioSignal>('ongoing')
  const [bulkHorizon, setBulkHorizon] = useState<Horizon>('next')
  const [bulkTag, setBulkTag] = useState('')
  const [planningHistory, setPlanningHistory] = useState(emptyPlanningHistory)
  const bulkUndo = planningHistory.bulk
  const [autosaveBlocked] = useState(initial.autosaveBlocked)
  const [notice, setNotice] = useState(initial.notice)
  const [adminAction, setAdminAction] = useState<AdminActionState>({ status: 'idle', receiptId: null })
  const actionsAvailable = useMemo(hostedAdminActionsAvailable, [])
  const pendingActionKeys = useRef(new Map<string, { fingerprint: string; key: string }>())
  const workspaceHeadingRef = useRef<HTMLHeadingElement>(null)

  const focusedWork = useMemo(
    () => WORK_OBJECTS.find((work) => work.workId === focusedId) ?? null,
    [focusedId],
  )
  const visible = useMemo(
    () => filterWorkObjects(query, classifications, activeView, plans, reconciliations),
    [query, classifications, activeView, plans, reconciliations],
  )
  const grouped = useMemo(
    () => Object.fromEntries(BOARD_HORIZONS.map((horizon) => [
      horizon,
      visible.filter((work) => boardHorizon(plans[work.workId]) === horizon),
    ])) as Record<BoardHorizon, WorkObject[]>,
    [plans, visible],
  )
  const familyGroups = useMemo(() => groupWorkObjects(visible, plans), [visible, plans])
  const plannedCount = Object.keys(plans).length

  useEffect(() => {
    if (autosaveBlocked) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(createPacket({ focusedId, plans, reviewDecisions, retiredReviewDecisions, reconciliations })))
      setNotice('Local draft updated · save the focused action when ready')
    } catch {
      setNotice('Local draft unavailable · use the explicit server action when ready')
    }
  }, [autosaveBlocked, focusedId, plans, reconciliations, retiredReviewDecisions, reviewDecisions])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (projectCreationOpen) setProjectCreationOpen(false)
      else if (focusedId) closeDrawer()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function updatePlan(id: string, patch: Partial<WorkPlan>) {
    const work = WORK_OBJECTS.find((candidate) => candidate.workId === id)
    if (work && sourceSignal(work) === 'unplanned') {
      const readiness = intakeReadiness(work, reconciliations[id] ?? defaultReconciliation(id))
      if (!readiness.ready) {
        setDrawerTab('intake')
        setNotice(`${work.name} · scheduling locked until repository-first intake is complete`)
        return
      }
    }
    setPlanningHistory(emptyPlanningHistory())
    setPlans((current) => {
      const candidate = { ...(current[id] ?? defaultPlan()), ...patch }
      const next = { ...current }
      writePlanned(next, id, candidate)
      return next
    })
  }

  function updateReconciliation(id: string, patch: Partial<PortfolioReconciliation>) {
    setPlanningHistory(emptyPlanningHistory())
    setReconciliations((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? defaultReconciliation(id)),
        ...patch,
        workObjectId: id,
        updatedAt: new Date().toISOString(),
      },
    }))
    setNotice('Repository-first intake draft updated · save and queue it when ready')
  }

  function toggleFamily(groupId: string) {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  function chooseReview(id: string, proposedType: ReviewProposal) {
    const record = REVIEW_RECORDS.find((candidate) => candidate.canonicalId === id)!
    const suggestion = reviewSuggestion(record)
    setReviewDecisions((current) => ({
      ...current,
      [id]: {
        proposedType,
        clientFamilyId: proposedType === 'client-branch' ? current[id]?.clientFamilyId ?? '' : '',
        note: current[id]?.note ?? '',
        suggestionRule: suggestion.ruleVersion,
        sourceDigest: suggestion.sourceDigest,
      },
    }))
    setNotice(`${record.source} · ${proposedType === 'needs-review' ? 'kept in review' : `${label(proposedType)} proposed`}`)
  }

  function changeReview(id: string, patch: Partial<ReviewDecision>) {
    setReviewDecisions((current) => {
      const prior = current[id]
      if (!prior) return current
      return { ...current, [id]: { ...prior, ...patch } }
    })
  }

  function resetReview(id: string) {
    setReviewDecisions((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setNotice('Local review decision reset · source record unchanged')
  }

  function toggleClassification(classification: Classification) {
    setClassifications((current) => {
      const next = new Set(current)
      if (next.has(classification)) next.delete(classification)
      else next.add(classification)
      return next
    })
  }

  function toggleBulk(id: string) {
    const work = WORK_OBJECTS.find((candidate) => candidate.workId === id)
    if (work && sourceSignal(work) === 'unplanned' && !intakeReadiness(work, reconciliations[id] ?? defaultReconciliation(id)).ready) {
      setFocusedId(id)
      setDrawerTab('intake')
      setNotice(`${work.name} · reconcile before bulk planning`)
      return
    }
    setBulkSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitBulkMode() {
    setBulkMode(false)
    setBulkSelected(new Set())
    setPlanningHistory((current) => discardBulkUndo(current))
  }

  function rememberBulkState(): void {
    setPlanningHistory(recordBulkUndo(Object.fromEntries([...bulkSelected].map((id) => [id, plans[id] ?? null]))))
  }

  function applyBulkPatch(patch: Partial<WorkPlan>, message: string) {
    if (bulkSelected.size === 0) return
    rememberBulkState()
    setPlans((current) => {
      const next = { ...current }
      for (const id of bulkSelected) {
        writePlanned(next, id, { ...(next[id] ?? defaultPlan()), ...patch })
      }
      return next
    })
    setNotice(`${message} · ${bulkSelected.size} projects`)
  }

  function applyBulkTag(remove: boolean) {
    const normalized = normalizeTag(bulkTag)
    if (!normalized || bulkSelected.size === 0) return
    rememberBulkState()
    setPlans((current) => {
      const next = { ...current }
      for (const id of bulkSelected) {
        const prior = next[id] ?? defaultPlan()
        const tags = remove
          ? prior.tags.filter((tagValue) => tagValue !== normalized)
          : normalizeTags([...prior.tags, normalized])
        writePlanned(next, id, { ...prior, tags })
      }
      return next
    })
    setNotice(`${remove ? 'Removed' : 'Added'} #${normalized} · ${bulkSelected.size} projects`)
    setBulkTag('')
  }

  function undoBulkChange() {
    if (!bulkUndo) return
    setPlanningHistory(emptyPlanningHistory())
    setPlans((current) => {
      const next = { ...current }
      for (const [id, prior] of Object.entries(bulkUndo)) {
        if (prior) next[id] = prior
        else delete next[id]
      }
      return next
    })
    setNotice('Undid last bulk change · prior local plans restored')
  }

  function openDrawer(id: string) {
    setFocusedId(id)
    setDrawerTab('intake')
  }

  function closeDrawer() {
    const priorId = focusedId
    setFocusedId(null)
    window.requestAnimationFrame(() => {
      if (!priorId) return
      const trigger = document.querySelector<HTMLButtonElement>(`[data-card-id="${priorId}"] [data-focus]`)
      if (trigger) trigger.focus()
      else workspaceHeadingRef.current?.focus()
    })
  }

  function setView(view: SmartView) {
    setActiveView(view)
    setQuery('')
    setFocusedId(null)
  }

  function retrySafeActionKey(subjectId: string, proposal: Record<string, unknown>): string {
    const fingerprint = JSON.stringify(proposal)
    const pending = pendingActionKeys.current.get(subjectId)
    if (pending?.fingerprint === fingerprint) return pending.key
    const key = actionIdempotencyKey(subjectId)
    pendingActionKeys.current.set(subjectId, { fingerprint, key })
    return key
  }

  async function queueWorkObjectReconciliation(work: WorkObject, reconciliation: PortfolioReconciliation) {
    setAdminAction({ status: 'saving', receiptId: null })
    const proposal = {
      repositorySourceRef: reconciliation.repositorySourceRef,
      repositoryDisposition: reconciliation.repositoryDisposition,
      origin: reconciliation.origin,
      clientFamilyId: reconciliation.clientFamilyId,
      planningAuthority: reconciliation.planningAuthority,
      repositoryPlanningReviewed: reconciliation.repositoryPlanningReviewed,
      githubIssuesReviewed: reconciliation.githubIssuesReviewed,
      legacyEvidenceReviewed: reconciliation.legacyEvidenceReviewed,
      note: reconciliation.note,
    }
    try {
      const receipt = await postPortfolioAdminAction({
        schema: 'thoughtseed.portfolio-admin-action.v1',
        kind: 'reconcile-work-object',
        portfolioId: 'thoughtseed',
        idempotencyKey: retrySafeActionKey(work.workId, proposal),
        rootMapDigest: PORTFOLIO_ROOT_MAP_DIGEST,
        sourceDigest: CLASSIFICATION_DIGEST,
        subject: { id: work.workId, name: work.name },
        proposal,
      })
      pendingActionKeys.current.delete(work.workId)
      setAdminAction({ status: 'queued', receiptId: receipt.receiptId })
      setNotice(`${work.name} · saved to durable evidence and queued for repository intake review`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Portfolio action failed'
      const durableReceipt = message.match(/Evidence (pa_[0-9a-f]+) is durable/)?.[1] ?? null
      setAdminAction({ status: 'error', receiptId: durableReceipt })
      setNotice(message)
    }
  }

  async function queueProjectCreation() {
    setAdminAction({ status: 'saving', receiptId: null })
    const proposal = {
      intentSchema: 'thoughtseed.project-creation-intent.v1',
      requestSource: 'local-founder',
      name: projectCreation.name.trim(),
      slug: projectCreation.slug,
      origin: projectCreation.origin,
      clientFamilyId: projectCreation.clientFamilyId,
      founderApproval: null,
    }
    try {
      const receipt = await postPortfolioAdminAction({
        schema: 'thoughtseed.portfolio-admin-action.v1',
        kind: 'create-thoughtseed-project',
        portfolioId: 'thoughtseed',
        idempotencyKey: retrySafeActionKey(`new:${projectCreation.slug}`, proposal),
        rootMapDigest: PORTFOLIO_ROOT_MAP_DIGEST,
        sourceDigest: CLASSIFICATION_DIGEST,
        subject: { id: projectCreation.slug, name: projectCreation.name.trim() },
        proposal,
      })
      pendingActionKeys.current.delete(`new:${projectCreation.slug}`)
      setAdminAction({ status: 'queued', receiptId: receipt.receiptId })
      setNotice(`${projectCreation.name.trim()} · creation intent is ${receipt.approvalStatus ?? 'execution-ready'}; local executor is the filesystem writer`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Portfolio action failed'
      const durableReceipt = message.match(/Evidence (pa_[0-9a-f]+) is durable/)?.[1] ?? null
      setAdminAction({ status: 'error', receiptId: durableReceipt })
      setNotice(message)
    }
  }

  function renderCard(work: WorkObject) {
    return (
      <WorkCard
        key={work.workId}
        work={work}
        plan={plans[work.workId]}
        bulkMode={bulkMode}
        bulkSelected={bulkSelected.has(work.workId)}
        onBulkToggle={() => toggleBulk(work.workId)}
        onFocus={() => openDrawer(work.workId)}
        onQuickSignal={(signal) => {
          updatePlan(work.workId, { signal })
          setNotice(`${work.name} · ${label(signal)} draft plan`)
        }}
        unplannedTriage={activeView === 'unplanned'}
        reconciliation={reconciliations[work.workId]}
      />
    )
  }

  return (
    <main className={focusedWork || projectCreationOpen ? 'workbench has-drawer' : 'workbench'}>
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><Sparkles aria-hidden="true" /></span>
          <div><span>Thoughtseed · hosted founder admin</span><strong>Portfolio Workbench</strong></div>
        </div>
        <div className="top-actions">
          <button type="button" className="primary-button" onClick={() => { setProjectCreationOpen(true); setFocusedId(null); setAdminAction({ status: 'idle', receiptId: null }) }}><Plus aria-hidden="true" /> New Thoughtseed project</button>
          <AdminActionStatus state={adminAction} available={actionsAvailable} />
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-intro">
          <p>Plan the whole portfolio without changing source truth.</p>
          <div className="authority-line"><ShieldCheck /><span>Vault classifies<br />Cambium operates<br />Hermes transports</span></div>
        </div>
        <nav className="smart-nav" aria-label="Portfolio smart views">
          <span>Smart views</span>
          {SMART_VIEWS.map((view) => (
            <button
              type="button"
              key={view}
              className={activeView === view ? 'is-active' : ''}
              aria-current={activeView === view ? 'page' : undefined}
              onClick={() => setView(view)}
            >
              {view === 'ongoing' && <Play />}
              {view === 'paused' && <CirclePause />}
              {view === 'white-labelable' && <Sparkles />}
              {view === 'needs-review' && <AlertTriangle />}
              {view === 'historical' && <History />}
              {view === 'unplanned' && <Target />}
              {view === 'all' && <Grid2X2 />}
              <span>{label(view)}</span>
              <strong>{smartViewCount(view, plans, reconciliations)}</strong>
            </button>
          ))}
        </nav>
        <div className="source-receipt">
          <span>Registry receipt</span>
          <code>{CLASSIFICATION_DIGEST.slice(0, 12)}…</code>
          <small>{SOURCE_GENERATED_AT}</small>
          <span>Repository evidence</span>
          <code>{REPOSITORY_EVIDENCE_DIGEST.slice(0, 12)}…</code>
          <div><b>{CLASSIFICATION_COUNTS.total}</b> work · <b>{CLASSIFICATION_COUNTS.review}</b> review · <b>{CLASSIFICATION_COUNTS.historical}</b> history</div>
        </div>
      </aside>

      <section className="workspace">
        {autosaveBlocked && (
          <div className="recovery-banner" role="alert">
            Local draft autosave is paused so unreadable data stays untouched. Server actions remain explicit and never overwrite this draft.
          </div>
        )}
        <header className="workspace-head">
          <div>
            <span className="eyebrow">Portfolio / {label(activeView)}</span>
            <h1 ref={workspaceHeadingRef} tabIndex={-1}>
              {activeView === 'all' ? 'Plan the portfolio' : label(activeView)}
              <em>{activeView === 'historical' ? HISTORICAL_RECORDS.length : activeView === 'needs-review' ? smartViewCount(activeView, plans, reconciliations) : visible.length}</em>
            </h1>
            <p>
              {activeView === 'all'
                ? 'Scan source truth, set local intent, and focus only when detail matters.'
                : activeView === 'historical'
                  ? 'Preserved product history stays separate from live WorkObjects.'
                  : activeView === 'needs-review'
                    ? 'Resolve uncertain identity and commercial boundaries before admission.'
                    : `A computed view of ${label(activeView).toLowerCase()} portfolio signals.`}
            </p>
          </div>
          <div className="summary-pills" aria-label="Classification counts">
            <span><Leaf />{CLASSIFICATION_COUNTS.saplings} Saplings</span>
            <span><GitBranch />{CLASSIFICATION_COUNTS.clientBranches} Branches</span>
            <span><Layers3 />{CLASSIFICATION_COUNTS.internalPrograms} Programs</span>
            <span><ListChecks />{plannedCount} locally planned</span>
          </div>
        </header>

        <div className="mobile-view-rail" aria-label="Mobile smart views">
          {SMART_VIEWS.map((view) => (
            <button type="button" key={view} className={activeView === view ? 'is-active' : ''} onClick={() => setView(view)}>
              {label(view)} <strong>{smartViewCount(view, plans, reconciliations)}</strong>
            </button>
          ))}
        </div>

        {activeView !== 'historical' && (
          <div className="command-bar">
            <label className="search-control">
              <Search aria-hidden="true" />
              <span className="visually-hidden">Search portfolio</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search work, account, tenant, horizon, tag…"
              />
            </label>
            <div className="type-filters" aria-label="Classification filters">
              <Filter aria-hidden="true" />
              {CLASSIFICATIONS.map((classification) => (
                <button
                  type="button"
                  key={classification}
                  className={classifications.has(classification) ? 'is-active' : ''}
                  aria-pressed={classifications.has(classification)}
                  onClick={() => toggleClassification(classification)}
                >
                  {label(classification)}
                </button>
              ))}
            </div>
            <div className="view-toggle" aria-label="Portfolio layout">
              <button type="button" className={viewMode === 'family' ? 'is-active' : ''} aria-pressed={viewMode === 'family'} onClick={() => setViewMode('family')} aria-label="Client family view"><GitBranch /></button>
              <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} aria-label="Grid view"><Grid2X2 /></button>
              <button type="button" className={viewMode === 'board' ? 'is-active' : ''} aria-pressed={viewMode === 'board'} onClick={() => setViewMode('board')} aria-label="Horizon board view"><Columns3 /></button>
            </div>
            <button
              type="button"
              className={bulkMode ? 'bulk-mode-button is-active' : 'bulk-mode-button'}
              onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
              aria-pressed={bulkMode}
            >
              {bulkMode ? <X /> : <Menu />} {bulkMode ? 'Exit bulk' : 'Bulk plan'}
            </button>
          </div>
        )}

        {bulkMode && bulkSelected.size > 0 && (
          <div className="bulk-action-bar" aria-label="Bulk planning actions">
            <strong aria-live="polite">{bulkSelected.size} selected</strong>
            <label><span>Signal</span><select value={bulkSignal} onChange={(event) => setBulkSignal(event.target.value as PortfolioSignal)}>{PORTFOLIO_SIGNALS.map((signal) => <option key={signal} value={signal}>{label(signal)}</option>)}</select></label>
            <button type="button" onClick={() => applyBulkPatch({ signal: bulkSignal }, `Set ${label(bulkSignal)}`)}>Apply signal</button>
            <label><span>Horizon</span><select value={bulkHorizon} onChange={(event) => setBulkHorizon(event.target.value as Horizon)}>{HORIZONS.map((horizon) => <option key={horizon} value={horizon}>{label(horizon)}</option>)}</select></label>
            <button type="button" onClick={() => applyBulkPatch({ horizon: bulkHorizon }, `Set ${label(bulkHorizon)}`)}>Apply horizon</button>
            <label className="bulk-tag"><Tag /><span className="visually-hidden">Bulk tag</span><input value={bulkTag} onChange={(event) => setBulkTag(event.target.value)} placeholder="tag" /></label>
            <button type="button" onClick={() => applyBulkTag(false)}>Add tag</button>
            <button type="button" onClick={() => applyBulkTag(true)}>Remove tag</button>
            {bulkUndo && <button type="button" className="undo-bulk" onClick={undoBulkChange}>Undo bulk change</button>}
          </div>
        )}

        <div className="content-surface">
          {activeView === 'historical' ? (
            <HistoricalQueue />
          ) : activeView === 'needs-review' ? (
            <>
              <ReviewQueue decisions={reviewDecisions} onChoose={chooseReview} onChange={changeReview} onReset={resetReview} />
              {visible.length > 0 && (
                <section className="locally-flagged">
                  <header><span>Local review proposals</span><strong>{visible.length}</strong></header>
                  <div className="card-grid">{visible.map(renderCard)}</div>
                </section>
              )}
            </>
          ) : viewMode === 'family' ? (
            familyGroups.length > 0 ? (
              <section className="family-layout" aria-label="Portfolio grouped by source client families">
                {familyGroups.map((group) => (
                  <FamilyGroup
                    key={group.groupId}
                    group={group}
                    expanded={Boolean(query.trim()) || activeView === 'unplanned' || expandedGroups.has(group.groupId)}
                    onToggle={() => toggleFamily(group.groupId)}
                    renderCard={renderCard}
                  />
                ))}
              </section>
            ) : (
              <div className="empty-state"><Search /><h2>No matching work</h2><p>Clear search or classification filters to widen the view.</p></div>
            )
          ) : viewMode === 'grid' ? (
            visible.length > 0 ? <section className="card-grid">{visible.map(renderCard)}</section> : (
              <div className="empty-state"><Search /><h2>No matching work</h2><p>Clear search or classification filters to widen the view.</p></div>
            )
          ) : (
            <section className="horizon-board">
              {BOARD_HORIZONS.map((horizon) => (
                <div className="horizon-column" key={horizon}>
                  <header><h2>{label(horizon)}</h2><strong>{grouped[horizon].length}</strong></header>
                  <div>{grouped[horizon].map(renderCard)}</div>
                </div>
              ))}
            </section>
          )}
        </div>

        <footer className="workspace-footer">
          <div><ShieldCheck /> <span>{CARTOGRAPHER_SCHEMA} · admin actions receipted</span></div>
          <p aria-live="polite">{notice}</p>
          <div><Network /> <span>{actionsAvailable ? 'Hosted admin · governed writes' : 'Local preview · no writes'}</span></div>
        </footer>
      </section>

      {focusedWork && (
        <PlanDrawer
          work={focusedWork}
          plan={plans[focusedWork.workId] ?? defaultPlan()}
          reconciliation={reconciliations[focusedWork.workId] ?? defaultReconciliation(focusedWork.workId)}
          repositoryEvidence={repositoryEvidenceForWork(focusedWork)}
          planningLocked={sourceSignal(focusedWork) === 'unplanned' && !intakeReadiness(focusedWork, reconciliations[focusedWork.workId] ?? defaultReconciliation(focusedWork.workId)).ready}
          tab={drawerTab}
          onTab={setDrawerTab}
          onChange={(patch) => updatePlan(focusedWork.workId, patch)}
          onReconciliationChange={(patch) => updateReconciliation(focusedWork.workId, patch)}
          actionState={adminAction}
          actionsAvailable={actionsAvailable}
          onQueueReconciliation={() => void queueWorkObjectReconciliation(
            focusedWork,
            reconciliations[focusedWork.workId] ?? defaultReconciliation(focusedWork.workId),
          )}
          onClose={closeDrawer}
        />
      )}
      {projectCreationOpen && (
        <ProjectCreationDrawer
          draft={projectCreation}
          derivedKind={derivedProjectKind(projectCreation.origin)}
          actionState={adminAction}
          actionsAvailable={actionsAvailable}
          onChange={(patch) => { setProjectCreation((current) => ({ ...current, ...patch })); setAdminAction({ status: 'idle', receiptId: null }) }}
          onSubmit={() => void queueProjectCreation()}
          onClose={() => setProjectCreationOpen(false)}
        />
      )}
    </main>
  )
}

export default App
