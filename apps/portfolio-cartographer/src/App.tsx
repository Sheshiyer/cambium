import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Braces,
  Check,
  ChevronRight,
  CirclePause,
  Clipboard,
  Columns3,
  Download,
  FileUp,
  Filter,
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
  PORTFOLIO_SIGNALS,
  REVIEW_RECORDS,
  SIGNAL_STATUSES,
  SMART_VIEWS,
  SOURCE_GENERATED_AT,
  WORK_OBJECTS,
  createPacket,
  boardHorizon,
  defaultPlan,
  effectiveSignal,
  filterWorkObjects,
  hasLocalPlan,
  normalizeTag,
  normalizeTags,
  parsePacket,
  resolvePipeline,
  signalProvenance,
  smartViewCount,
  sourceSignal,
  toMarkdown,
  type Audience,
  type BoardHorizon,
  type Classification,
  type Horizon,
  type OrganId,
  type PortfolioSignal,
  type Priority,
  type SignalStatus,
  type SmartView,
  type WorkObject,
  type WorkPlan,
  type WorkbenchState,
} from './domain.ts'

const STORAGE_KEY = 'thoughtseed.portfolio-workbench.v2'
const LEGACY_STORAGE_KEY = 'thoughtseed.portfolio-cartographer.v1'
type DrawerTab = 'overview' | 'plan' | 'delivery'
type ViewMode = 'grid' | 'board'
type BulkUndo = Record<string, WorkPlan | null>

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
        return { ...parsePacket(JSON.parse(current)), notice: 'Restored local planning · proposal only', autosaveBlocked: false }
      } catch {
        return {
          focusedId: null,
          plans: {},
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
          notice: 'Autosave paused · unreadable v1 data remains untouched',
          autosaveBlocked: true,
        }
      }
    }
  } catch {
    return {
      focusedId: null,
      plans: {},
      notice: 'Local save unavailable · export before closing',
      autosaveBlocked: true,
    }
  }
  return { focusedId: null, plans: {}, notice: 'Ready · planning stays in this browser', autosaveBlocked: false }
}

function downloadText(filename: string, value: string, type: string): void {
  const blob = new Blob([value], { type })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(href)
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

function WorkCard({
  work,
  plan,
  bulkMode,
  bulkSelected,
  onBulkToggle,
  onFocus,
  onQuickSignal,
}: {
  work: WorkObject
  plan?: WorkPlan
  bulkMode: boolean
  bulkSelected: boolean
  onBulkToggle: () => void
  onFocus: () => void
  onQuickSignal: (signal: PortfolioSignal) => void
}) {
  const signal = effectiveSignal(work, plan)
  const provenance = signalProvenance(work, plan)
  const tags = plan?.tags ?? []
  return (
    <article
      className={bulkSelected ? `work-card signal-${signal} is-bulk-selected` : `work-card signal-${signal}`}
      data-work-id={work.workId}
      data-card-id={work.workId}
    >
      <header className="work-card-head">
        {bulkMode && (
          <label className="bulk-check">
            <input type="checkbox" checked={bulkSelected} onChange={onBulkToggle} />
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

      <footer className="work-card-actions">
        <span>{work.accountId ? `account · ${work.accountId}` : `tenant · ${work.tenantId ?? work.tenantStatus}`}</span>
        <button
          type="button"
          className="quick-action"
          onClick={() => onQuickSignal(quickActionSignal(signal))}
          aria-label={`${quickActionLabel(signal)} ${work.name}`}
        >
          {signal === 'ongoing' ? <CirclePause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {quickActionLabel(signal)}
        </button>
      </footer>
    </article>
  )
}

function ReviewQueue() {
  return (
    <section className="secondary-grid" aria-label="Classification review queue">
      {REVIEW_RECORDS.map((record) => (
        <article className="secondary-card review-card" key={record.canonicalId}>
          <AlertTriangle aria-hidden="true" />
          <div>
            <span>Classification review</span>
            <h3>{record.source}</h3>
            <p>{record.needed}</p>
          </div>
        </article>
      ))}
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
  tab,
  onTab,
  onChange,
  onClose,
}: {
  work: WorkObject
  plan: WorkPlan
  tab: DrawerTab
  onTab: (tab: DrawerTab) => void
  onChange: (patch: Partial<WorkPlan>) => void
  onClose: () => void
}) {
  const [tagDraft, setTagDraft] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)
  const pipeline = resolvePipeline(work, plan)
  const workflow = ORGAN_WORKFLOWS.find((candidate) => candidate.id === plan.delivery.organ)!

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
        {(['overview', 'plan', 'delivery'] as const).map((drawerTab) => (
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
        {tab === 'overview' && (
          <section className="drawer-section overview-section">
            <div className="authority-note">
              <ShieldCheck aria-hidden="true" />
              <div><strong>Source truth is read-only</strong><p>Vault classifies. Local planning is a reversible proposal.</p></div>
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
            <div className="field-block">
              <span className="field-title">Portfolio signal <small>local plan</small></span>
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
          </section>
        )}

        {tab === 'delivery' && (
          <section className="drawer-section delivery-section">
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
          </section>
        )}
      </div>
    </aside>
  )
}

function App() {
  const initial = useMemo(loadLocalState, [])
  const [plans, setPlans] = useState<Record<string, WorkPlan>>({ ...initial.plans })
  const [focusedId, setFocusedId] = useState<string | null>(initial.focusedId)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview')
  const [activeView, setActiveView] = useState<SmartView>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [query, setQuery] = useState('')
  const [classifications, setClassifications] = useState<Set<Classification>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkSignal, setBulkSignal] = useState<PortfolioSignal>('ongoing')
  const [bulkHorizon, setBulkHorizon] = useState<Horizon>('next')
  const [bulkTag, setBulkTag] = useState('')
  const [bulkUndo, setBulkUndo] = useState<BulkUndo | null>(null)
  const [autosaveBlocked, setAutosaveBlocked] = useState(initial.autosaveBlocked)
  const [notice, setNotice] = useState(initial.notice)
  const importRef = useRef<HTMLInputElement>(null)
  const workspaceHeadingRef = useRef<HTMLHeadingElement>(null)

  const focusedWork = useMemo(
    () => WORK_OBJECTS.find((work) => work.workId === focusedId) ?? null,
    [focusedId],
  )
  const visible = useMemo(
    () => filterWorkObjects(query, classifications, activeView, plans),
    [query, classifications, activeView, plans],
  )
  const grouped = useMemo(
    () => Object.fromEntries(BOARD_HORIZONS.map((horizon) => [
      horizon,
      visible.filter((work) => boardHorizon(plans[work.workId]) === horizon),
    ])) as Record<BoardHorizon, WorkObject[]>,
    [plans, visible],
  )
  const plannedCount = Object.keys(plans).length

  useEffect(() => {
    if (autosaveBlocked) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(createPacket({ focusedId, plans })))
      setNotice('Saved locally · proposal only')
    } catch {
      setNotice('Local save unavailable · export before closing')
    }
  }, [autosaveBlocked, focusedId, plans])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && focusedId) closeDrawer()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function updatePlan(id: string, patch: Partial<WorkPlan>) {
    setPlans((current) => {
      const candidate = { ...(current[id] ?? defaultPlan()), ...patch }
      const next = { ...current }
      writePlanned(next, id, candidate)
      return next
    })
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
    setBulkUndo(null)
  }

  function rememberBulkState(): void {
    setBulkUndo(Object.fromEntries([...bulkSelected].map((id) => [id, plans[id] ?? null])))
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
    setPlans((current) => {
      const next = { ...current }
      for (const [id, prior] of Object.entries(bulkUndo)) {
        if (prior) next[id] = prior
        else delete next[id]
      }
      return next
    })
    setBulkUndo(null)
    setNotice('Undid last bulk change · prior local plans restored')
  }

  function openDrawer(id: string) {
    setFocusedId(id)
    setDrawerTab('overview')
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

  function exportJson() {
    const packet = createPacket({ focusedId, plans })
    downloadText('thoughtseed-portfolio-workbench.json', `${JSON.stringify(packet, null, 2)}\n`, 'application/json')
    setNotice('JSON planning packet exported')
  }

  function exportMarkdown() {
    downloadText('thoughtseed-portfolio-workbench.md', toMarkdown(createPacket({ focusedId, plans })), 'text/markdown')
    setNotice('Markdown planning brief exported')
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(toMarkdown(createPacket({ focusedId, plans })))
      setNotice('Planning brief copied')
    } catch {
      setNotice('Clipboard unavailable · use Markdown export')
    }
  }

  async function importPacket(file: File) {
    try {
      const restored = parsePacket(JSON.parse(await file.text()))
      setAutosaveBlocked(false)
      setPlans({ ...restored.plans })
      setFocusedId(restored.focusedId)
      setNotice(`Imported ${Object.keys(restored.plans).length} project plans`)
    } catch (error) {
      setNotice(error instanceof Error ? `Import rejected · ${error.message}` : 'Import rejected')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  function resetAll() {
    if (!window.confirm('Clear every local Portfolio Workbench plan? Export first if you need a recovery packet.')) return
    setPlans({})
    setFocusedId(null)
    setAutosaveBlocked(false)
    exitBulkMode()
    try {
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // State is already cleared in memory.
    }
    setNotice('Local planning state cleared')
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
          setNotice(`${work.name} · ${label(signal)} local plan`)
        }}
      />
    )
  }

  return (
    <main className={focusedWork ? 'workbench has-drawer' : 'workbench'}>
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><Sparkles aria-hidden="true" /></span>
          <div><span>Thoughtseed · founder planning artifact</span><strong>Portfolio Workbench</strong></div>
        </div>
        <div className="top-actions">
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importPacket(file)
            }}
          />
          <button type="button" className="quiet-button" onClick={() => importRef.current?.click()}><FileUp /> Import</button>
          <button type="button" className="quiet-button" onClick={copyBrief}><Clipboard /> Copy brief</button>
          <button type="button" className="quiet-button" onClick={exportJson}><Braces /> JSON</button>
          <button type="button" className="primary-button" onClick={exportMarkdown}><Download /> Markdown</button>
          <button type="button" className="icon-button danger" onClick={resetAll} aria-label="Reset local planning"><RotateCcw /></button>
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
              <strong>{smartViewCount(view, plans)}</strong>
            </button>
          ))}
        </nav>
        <div className="source-receipt">
          <span>Registry receipt</span>
          <code>{CLASSIFICATION_DIGEST.slice(0, 12)}…</code>
          <small>{SOURCE_GENERATED_AT}</small>
          <div><b>{CLASSIFICATION_COUNTS.total}</b> work · <b>{CLASSIFICATION_COUNTS.review}</b> review · <b>{CLASSIFICATION_COUNTS.historical}</b> history</div>
        </div>
      </aside>

      <section className="workspace">
        {autosaveBlocked && (
          <div className="recovery-banner" role="alert">
            Autosave is paused so unreadable local data stays untouched. Import a recovery packet or use Reset to replace it explicitly.
          </div>
        )}
        <header className="workspace-head">
          <div>
            <span className="eyebrow">Portfolio / {label(activeView)}</span>
            <h1 ref={workspaceHeadingRef} tabIndex={-1}>
              {activeView === 'all' ? 'Plan the portfolio' : label(activeView)}
              <em>{activeView === 'historical' ? HISTORICAL_RECORDS.length : activeView === 'needs-review' ? smartViewCount(activeView, plans) : visible.length}</em>
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
              {label(view)} <strong>{smartViewCount(view, plans)}</strong>
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
              <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => setViewMode('grid')} aria-label="Grid view"><Grid2X2 /></button>
              <button type="button" className={viewMode === 'board' ? 'is-active' : ''} onClick={() => setViewMode('board')} aria-label="Horizon board view"><Columns3 /></button>
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
              <ReviewQueue />
              {visible.length > 0 && (
                <section className="locally-flagged">
                  <header><span>Local review proposals</span><strong>{visible.length}</strong></header>
                  <div className="card-grid">{visible.map(renderCard)}</div>
                </section>
              )}
            </>
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
          <div><ShieldCheck /> <span>{CARTOGRAPHER_SCHEMA} · proposal only</span></div>
          <p aria-live="polite">{notice}</p>
          <div><Network /> <span>Offline · zero writers</span></div>
        </footer>
      </section>

      {focusedWork && (
        <PlanDrawer
          work={focusedWork}
          plan={plans[focusedWork.workId] ?? defaultPlan()}
          tab={drawerTab}
          onTab={setDrawerTab}
          onChange={(patch) => updatePlan(focusedWork.workId, patch)}
          onClose={closeDrawer}
        />
      )}
    </main>
  )
}

export default App
