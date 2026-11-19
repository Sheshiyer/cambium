import { DEFAULT_PRIORITY, QUESTIONS, STANDARDS } from './discovery.mjs'
import { digest, repoName } from './sources.mjs'
import { SAPLING_DISCOVERY, validateSapling } from './sapling.mjs'

export const REVIEW = 'cambium.project-onboarding-review.v1'
export const PROGRESS = 'cambium.project-onboarding-progress.v1'

const defaultRails = [
  ['ui', 'Web UI / design', ['frontend'], 'Critical journeys, accessible and localized UI, design and copy approvals.'],
  ['backend', 'Backend / data', ['backend'], 'API and state contracts, role isolation, migrations, providers and reconciliation.'],
  ['infra', 'Infrastructure / release', [], 'Environment custody, observability, privacy bindings, rollback and restore.'],
  ['mobile', 'Native mobile', ['experience'], 'iOS and Android journeys, permissions, device evidence and store gates.'],
  ['dev-tooling', 'Developer tooling', [], 'Reproducible checkout and build, CI, test evidence and pinned tooling.'],
  ['maintenance', 'Maintenance / support', ['docs'], 'Owner handover, incidents, security updates, accessibility and ongoing support.'],
  ['analytics', 'Analytics / measurement', [], 'Product success, event quality, consent, and an owner-facing readout.'],
]
const gateStates = new Set(['signed', 'mixed', 'unsigned', 'missing', 'unverified', 'not-applicable'])
const customizationStates = new Set(['missing', 'confirmed', 'conflicting', 'unverified', 'not-applicable'])
const answerStates = new Set(['answered', 'deferred', 'not-applicable'])
const goalStates = new Set(['proposed', 'needs-decision', 'dependency-blocked', 'source-evidence', 'engineering-verified'])
const laneKinds = new Set(['confirmed-scope', 'approved-change', 'product-goal', 'recommendation'])
const record = (value) => value && typeof value === 'object' && !Array.isArray(value)
const safeId = (value) => typeof value === 'string' && /^[a-z][a-z\d]*(?:-[a-z\d]+)*$/.test(value)
const line = (value) => typeof value === 'string' && !!value.trim() && value.length <= 1200 && !/[\r\n\u0000]/.test(value)
const md = (value) => String(value ?? '—').replace(/[\\|<>`*_\[\]\r\n]/g, '\\$&')
const ref = (value) => `\`${String(value).replace(/`/g, '')}\``
const any = (rows, render, fallback) => rows.length ? rows.map(render).join('\n') : fallback

function bind(input, schema, identity, inputDigest, notices) {
  if (!input) return null
  if (!record(input) || input.schema !== schema || !/^sha256:[a-f0-9]{64}$/.test(input.inputDigest ?? '')) throw new Error(`Invalid ${schema} file.`)
  if (input.inputDigest !== inputDigest || input.workId !== identity.workId) {
    notices.push(`${schema} is stale or belongs to another WorkObject. Its decisions and claims were held for review.`)
    return null
  }
  return input
}

function sourceCheck(values, observed, label) {
  if (!Array.isArray(values) || !values.length || values.some((item) => !observed.has(item))) throw new Error(`${label} must cite exact source refs read in the evidence packet.`)
  return [...new Set(values)]
}

function issueURL(value, evidence) {
  const match = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/[1-9]\d*$/.exec(value ?? '')
  return match && evidence.repos.some((r) => r.repository.toLowerCase() === match[1].toLowerCase()) ? value : null
}

export function buildPacket(evidence, reviewInput, progressInput, requestedTrack) {
  // No timestamps or absolute paths in the bindable input. Git, board and file
  // observations are included; a changed source requires another review.
  const track = requestedTrack ?? (evidence.identity.classification === 'sapling' ? 'sapling' : 'delivery')
  const inputDigest = digest(JSON.stringify(track === 'sapling' ? { track, evidence } : evidence))
  const notices = []
  const review = bind(reviewInput, REVIEW, evidence.identity, inputDigest, notices)
  const progress = bind(progressInput, PROGRESS, evidence.identity, inputDigest, notices)
  const observed = new Set([...evidence.reviewSources, ...evidence.repos.flatMap((r) => r.refs)].map((v) => v.ref))
  for (const repo of evidence.repos) for (const branch of repo.github.branches ?? []) {
    if (branch.commit) observed.add(`https://github.com/${repo.repository}/tree/${branch.commit}`)
  }
  const client = evidence.identity.classification === 'client-branch' && track !== 'sapling'
  const contract = review?.contract ?? (track === 'sapling'
    ? { state: 'not-applicable', note: 'This research and product-goal proposal has no assumed delivery contract. Record founder, legal, data and pilot gates separately.', sources: [] }
    : { state: 'unverified', note: client ? 'Identify the active agreement and approved changes.' : 'Confirm whether an engagement agreement applies.', sources: [] })
  const customization = review?.customization ?? (track === 'sapling'
    ? { state: 'not-applicable', note: 'Use customer discovery and an explicit product hypothesis to set the first scope.', sources: [] }
    : { state: 'unverified', note: 'Identify client-specific differences in scope, delivery and acceptance.', sources: [] })
  if (!gateStates.has(contract.state) || !line(contract.note) || (client && contract.state === 'not-applicable')) throw new Error('Invalid contract state or note.')
  if (!customizationStates.has(customization.state) || !line(customization.note) || (client && customization.state === 'not-applicable')) throw new Error('Invalid customization state or note.')
  if (review?.contract) sourceCheck(contract.sources, observed, 'Contract review')
  if (review?.customization) sourceCheck(customization.sources, observed, 'Customization review')

  const questionIds = new Set(QUESTIONS.map((q) => q.id))
  const amendments = review?.questions ?? {}
  const answers = progress?.answers ?? {}
  for (const [label, rows] of [['review questions', amendments], ['progress answers', answers]]) {
    if (!record(rows) || Object.keys(rows).some((id) => !questionIds.has(id))) throw new Error(`Invalid ${label}. Use Q01–Q30.`)
  }
  const questions = QUESTIONS.map((row) => {
    const change = track === 'sapling' && SAPLING_DISCOVERY[row.id]
    const q = change ? { ...row, section: row.id === 'Q01' ? 'Market evidence and founder decisions' : row.section,
      question: change[0], recommendation: change[1], inspect: 'Founder decision, dated first-party or competitor evidence, and pilot readback.' } : row
    const specific = amendments[q.id]
    if (specific && ((!record(specific)) || !line(specific.recommendation) || (specific.question !== undefined && !line(specific.question)))) throw new Error(`Invalid ${q.id} review.`)
    const answer = answers[q.id]
    if (answer && (!record(answer) || !answerStates.has(answer.state) || !line(answer.note) || !line(answer.by))) throw new Error(`Invalid ${q.id} answer or disposition.`)
    return { ...q, ...(specific ? { question: specific.question ?? q.question, recommendation: specific.recommendation, sources: sourceCheck(specific.sources, observed, q.id) } : { sources: [] }),
      answer: answer ? { state: answer.state, note: answer.note, by: answer.by } : null }
  })
  const priority = review?.priority ?? (track === 'sapling' ? ['Q02', 'Q03', 'Q06', 'Q25', 'Q26'] : DEFAULT_PRIORITY)
  if (!Array.isArray(priority) || priority.some((id) => !questionIds.has(id))) throw new Error('Invalid question priority list.')
  const ordered = [...new Set([...priority, ...questions.map((q) => q.id)])]
  const nextQuestions = ordered.filter((id) => !answers[id]).slice(0, 3)

  const rawGoals = review?.goals ?? []
  if (!Array.isArray(rawGoals) || rawGoals.length > 40) throw new Error('Invalid project goals.')
  const ids = new Set()
  const goals = rawGoals.map((g) => {
    if (!record(g) || !safeId(g.id) || ids.has(g.id) || !safeId(g.rail) || !line(g.outcome) || !line(g.measure) || !line(g.gate)
      || !line(g.stage) || !goalStates.has(g.state) || !laneKinds.has(g.basis)) throw new Error('Invalid or duplicate goal. Include a measure, evidence and a delivery gate.')
    ids.add(g.id)
    const issue = g.issue ? issueURL(g.issue, evidence) : null
    if (g.issue && !issue) throw new Error('Goal issue must be an exact issue URL in an observed repository.')
    if (g.dependsOn !== undefined && (!Array.isArray(g.dependsOn) || g.dependsOn.some((id) => !safeId(id)))) throw new Error(`Invalid prerequisites for ${g.id}.`)
    return { id: g.id, rail: g.rail, stage: g.stage, outcome: g.outcome, measure: g.measure, gate: g.gate, state: g.state,
      basis: g.basis, dependsOn: [...new Set(g.dependsOn ?? [])], sources: sourceCheck(g.sources, observed, g.id), issue,
      boardItem: issue ? (evidence.board.existingIssueUrls?.includes(issue) ? 'observed-on-board' : 'not-observed-on-board') : null }
  })
  const byId = new Map(goals.map((goal) => [goal.id, goal]))
  const checked = new Set()
  function checkPrerequisites(id, stack) {
    if (!byId.has(id) || stack.has(id)) throw new Error(`Missing or circular roadmap prerequisite: ${id}.`)
    if (checked.has(id)) return
    stack.add(id)
    for (const prereq of byId.get(id).dependsOn) checkPrerequisites(prereq, stack)
    stack.delete(id)
    checked.add(id)
  }
  for (const id of byId.keys()) checkPrerequisites(id, new Set())

  const rawRails = review?.rails ?? {}
  if (!record(rawRails) || Object.keys(rawRails).length > 20) throw new Error('Invalid pillar selection.')
  for (const [id, entry] of Object.entries(rawRails)) {
    if (!safeId(id) || !record(entry) || !['candidate', 'active-in-proposal', 'not-needed'].includes(entry.state)
      || (!defaultRails.some(([known]) => known === id) && !line(entry.label)) || !line(entry.proof)
      || !Array.isArray(entry.repositories) || entry.repositories.some((name) => !repoName(name) || !evidence.repos.some((r) => r.repository.toLowerCase() === name.toLowerCase()))) throw new Error(`Invalid pillar ${id}. Use observed repository names and give a verification handoff.`)
  }
  const custom = Object.entries(rawRails).filter(([id]) => !defaultRails.some(([known]) => known === id))
  const rails = [...defaultRails, ...custom.map(([id, r]) => [id, r.label, [], r.proof])].map(([id, label, roles, proof]) => {
    const inferred = evidence.repos.filter((r) => r.lifecycle === 'current' && r.roles.some((role) => roles.includes(role))).map((r) => r.repository)
    const explicit = rawRails[id]
    return { id, label, state: explicit?.state ?? 'candidate', repositories: explicit?.repositories ?? inferred, proof: explicit?.proof ?? proof }
  })
  for (const g of goals) if (g.rail !== 'governor' && !rails.some((r) => r.id === g.rail)) throw new Error(`Goal ${g.id} uses an unknown pillar.`)

  const childInput = progress?.children ?? []
  if (!Array.isArray(childInput) || childInput.length > 80) throw new Error('Invalid child receipt list.')
  const keys = new Set()
  const children = childInput.map((child) => {
    if (!record(child) || !safeId(child.key) || keys.has(child.key) || !rails.some((r) => r.id === child.rail)
      || !['active', 'blocked', 'awaiting-review', 'terminal'].includes(child.state)
      || !['clean', 'dirty', 'none', 'unknown'].includes(child.worktree) || !Array.isArray(child.pending) || child.pending.some((p) => !line(p))) throw new Error('Invalid child receipt.')
    keys.add(child.key)
    const evidenceBound = line(child.terminalReceipt) && line(child.acceptanceRef) && line(child.handoffRef)
    const handoffSafe = (child.worktree === 'clean' && /^[a-f0-9]{40}$/.test(child.commit)) || child.worktree === 'none'
    const disposition = child.state === 'terminal' && evidenceBound && handoffSafe && !child.pending.length ? 'archive-candidate' : 'retain'
    return { key: child.key, rail: child.rail, state: child.state, disposition }
  })

  if (track !== 'sapling' && review?.sapling) throw new Error('Use the Sapling track for market experiments and proposed product goals.')
  const sapling = track === 'sapling' ? validateSapling(review?.sapling, observed) : null
  return { schema: 'cambium.project-onboarding.v1', track, inputDigest, notices, evidence, contract, customization, questions, nextQuestions, goals, rails, children, sapling,
    roadmap: track === 'sapling' ? 'product-discovery-proposal' : evidence.identity.status !== 'vault-and-workbench' ? 'work-object-reconciliation-required'
      : !evidence.primary ? 'planning-owner-unbound' : evidence.primary.status !== 'reviewed-and-observed' ? 'planning-owner-unverified'
      : evidence.board.status === 'verified-exact' ? 'reuse-existing-board' : evidence.board.status === 'unbound' ? 'board-discovery-required' : 'board-binding-held' }
}

export function renderMap({ evidence: e, track, inputDigest, notices, contract, customization }) {
  const { identity, repos, primary, workflow, board } = e
  return [
    `# ${md(identity.name)} · ecosystem map`, '', `Evidence fingerprint: ${ref(inputDigest)}`, '',
    `- WorkObject: ${ref(identity.workId ?? 'unmapped')} (${md(identity.status)}); Workbench catalog ${ref(identity.catalogDigest)}.`,
    `- Client account: ${md(identity.account)}. Runtime tenant evidence: ${md(identity.tenantStatus)}.`,
    `- Linked WorkObjects: ${identity.linkedWorkIds.map(ref).join(', ') || 'none in the selected snapshots'}.`,
    `- Preparation track: ${md(track)}. Registry lifecycle: ${md(workflow?.id ?? 'requires classification review')}. Planning repository: ${md(primary?.repository)} (${md(primary?.status ?? 'unbound')}).`,
    `- Board: ${board.url ? `[${md(board.title)}](${board.url})` : md(board.selected ?? 'unbound')}; ${md(board.status)}.`,
    `- Contract: **${md(contract.state)}**. ${md(contract.note)} ${contract.sources.map(ref).join(', ')}`,
    `- Client customization: **${md(customization.state)}**. ${md(customization.note)} ${customization.sources.map(ref).join(', ')}`, '',
    '| Repository | Membership / association / roles | GitHub default branch and head | Local checkout | Spec Kit evidence |',
    '| --- | --- | --- | --- | --- |',
    ...repos.map((r) => {
      const specCount = r.refs.filter((s) => s.ref.endsWith('/spec.md')).length
      const constitution = r.refs.some((s) => s.ref.endsWith('/constitution.md'))
      const remote = r.github.status === 'observed' ? `${ref(r.github.defaultBranch)} · ${md(r.github.defaultCommit?.slice(0, 12) ?? 'head unavailable')}${r.github.archived ? ' (GitHub archived)' : ''}` : md(r.github.status)
      return `| ${md(r.repository)} | ${md([r.membership, r.lifecycle, r.association, ...r.roles].filter(Boolean).join(' · '))}${r.identityConflict ? ' **ID conflict**' : ''} | ${remote} | ${r.local ? `${ref(r.local.branch)} · ${md(r.local.commit.slice(0, 12))} (${md(r.local.worktree)})` : 'not present in bounded scan'} | ${constitution ? 'constitution · ' : ''}${specCount} local specs |`
    }), '',
    ...repos.flatMap((r) => (r.github.branches ?? []).map((branch) => `- ${md(r.repository)} · ${ref(branch.branch)}: ${branch.commit
      ? `[${branch.commit.slice(0, 12)}](https://github.com/${r.repository}/tree/${branch.commit})${branch.rootPaths ? `; ${branch.rootPaths.length} root entries` : '; root tree unavailable'}` : 'commit unavailable'}.`)), '',
    ...notices.map((n) => `- ${md(n)}`), '', '## Source anchors', '',
    ...identity.workbenchRefs.map((s) => `- Workbench: ${ref(s)}`),
    ...e.reviewSources.map((s) => `- ${ref(s.ref)} · ${ref(s.fingerprint)}`), '',
    'The packet JSON contains exact source pins and document hashes. Remote branch trees inventory root entries only. Candidate repositories need a mapping decision before they can carry planning authority.', '',
  ].join('\n')
}

export function renderQuestions(packet) {
  return [`# ${md(packet.evidence.identity.name)} · 30 onboarding questions`, '',
    `Ask next: **${packet.nextQuestions.join(', ') || 'all questions have dispositions'}**. Use up to three per turn and preserve the owner’s exact decision or explicit deferral.`,
    'Each recommendation is a proposed decision. Project evidence is cited where the intake has a reviewed overlay; otherwise the question names the evidence to inspect.', '',
    ...packet.questions.flatMap((q) => [
      ...(q.section ? [`## ${q.section}`, ''] : []),
      `### ${q.id}. ${md(q.question)}`, '', md(q.recommendation), '',
      `Evidence: ${q.sources.length ? q.sources.map(ref).join(', ') : md(q.inspect)}`,
      ...(q.standards.length ? [`Reference: ${q.standards.map((id) => `[${STANDARDS[id][0]}](${STANDARDS[id][1]})`).join(' · ')}`] : []),
      ...(q.answer ? [`${md(q.answer.state)} · ${md(q.answer.by)}: ${md(q.answer.note)}`] : []), '',
    ])].join('\n')
}

export function renderRoadmap({ evidence, roadmap, goals, sapling }) {
  const { identity, board } = evidence
  return [`# ${md(identity.name)} · GitHub roadmap preview`, '', `Disposition: **${md(roadmap)}**. Dates and field changes require a reviewed proposal.`, '',
    ...(board.url ? [`Exact board: [${md(board.title)}](${board.url}); observed item count: ${md(board.itemCount)}. Fields: ${md(board.fieldNames.join(', '))}.`, ''] : []),
    ...(board.candidates?.length ? ['Candidate titles are discovery hints:', '', ...board.candidates.map((p) => `- ${md(p.title)} (${md(p.number)})`), ''] : []),
    'ISA owns acceptance. GSD owns sequence and dependencies. Spec Kit supplies user journeys, requirements, success criteria and implementation tasks. GitHub gives people a roadmap view of reviewed work.', '',
    `Use the board’s [roadmap layout](${STANDARDS.roadmap[1]}) with agreed Start and Target fields or an iteration. Keep unapproved dates blank and preserve existing issue status.`, '',
    ...(sapling ? ['## Product discovery sequence', '',
      '1. Review the dated market evidence and find the weakest untested assumption.',
      '2. Agree the goal, measure, audience and stop rules in the draft Spec Kit.',
      '3. Prove positive and failure paths in an isolated fixture environment.',
      '4. Review whether the evidence warrants a scoped pilot or changes the proposal.', '',
      'See [goal-flow.md](goal-flow.md) for the source-to-outcome trace.'] : !goals.length ? ['## Suggested sequence', '',
      '1. Reconcile ownership, agreement and acceptance baseline.',
      '2. Specify a thin user journey and its success evidence.',
      '3. Verify integrated delivery and its operational dependencies.',
      '4. Review rollout, human acceptance and handover gates.', '',
      'No project goals are asserted yet. Add a source-linked review for this project.'] : goals.flatMap((g) => [
      `## ${md(g.stage)} · ${md(g.outcome)}`, '',
      `- ${ref(g.id)} · ${md(g.rail)} · ${md(g.basis)} · ${md(g.state)}.`,
      `- Acceptance measure: ${md(g.measure)}`,
      ...(g.dependsOn.length ? [`- Prerequisites: ${g.dependsOn.map(ref).join(', ')}.`] : []),
      `- Gate: ${md(g.gate)}`,
      `- Evidence: ${g.sources.map(ref).join(', ')}.${g.issue ? ` [Existing issue](${g.issue}) (${md(g.boardItem)}).` : ''}`, '',
    ])), '',
  ].join('\n')
}

export function renderRails(packet) {
  return [`# ${md(packet.evidence.identity.name)} · pillar chats`, '',
    'Use one project governor for shared decisions, the next wave and final acceptance. Reuse a durable chat for each active pillar; children report through that pillar’s handoff.', '',
    '| Pillar | Proposal | Repositories | Required handoff evidence |', '| --- | --- | --- | --- |',
    ...packet.rails.map((r) => `| ${md(r.label)} | ${md(r.state)} | ${md(r.repositories.join(', ') || 'choose with owner')} | ${md(r.proof)} |`), '',
    'The recurring review is a separate standing operation: inspect source and handoff drift, surface decisions and archive candidates, and use existing approvals for any admitted execution. See the skill’s activation runbook for session tools, scheduling and closeout.', '',
    any(packet.children, (c) => `- ${ref(c.key)} (${md(c.rail)}): **${md(c.disposition)}**.`, 'No child receipts supplied.'), '',
  ].join('\n')
}
