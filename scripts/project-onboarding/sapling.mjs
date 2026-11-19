const id = (s) => typeof s === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(s)
const line = (s) => typeof s === 'string' && !!s.trim() && s.length <= 900 && !/[\r\n\u0000]/.test(s)
const lines = (v, min = 1, max = 12) => Array.isArray(v) && v.length >= min && v.length <= max && v.every(line)
const pct = (v) => Number.isFinite(v) && v >= 0 && v <= 100
const md = (value) => String(value).replace(/[\\|<>`*_\[\]\r\n]/g, '\\$&')
const https = (value) => {
  if (!line(value) || /[\s()<>\[\]\\]/.test(value)) return false
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password } catch { return false }
}

export const SAPLING_DISCOVERY = {
  Q01: ['Who is accountable for this Sapling’s user outcome, risk, pilot, spending and stop decisions?', 'Name a founder sponsor and one review owner. Write the pilot approval and spend/stop boundaries before recruiting or committing: these replace commercial assumptions, not legal or data approvals.'],
  Q02: ['What first-party evidence supports this problem, and where is the weakest assumption?', 'Separate dated observations from inferences, competitor features and untested demand. Ask for consented interviews or a redacted baseline before committing a solution.'],
  Q03: ['Which audience, use case, market and competing alternative will the first experiment address?', 'Select one reachable segment and one narrow job. Compare their actual current alternative with a prototype. Keep other markets as explicit non-goals.'],
  Q04: ['Which experiment can disprove the idea quickly, and which access or supply assumptions could invalidate it?', 'Pin a timebox, eligible sample, test environment and pre-registered threshold. Track inability to recruit as insufficient evidence.'],
  Q05: ['Who approves changes to the product hypothesis, guardrails or experiment threshold?', 'Record the original hypothesis and where it came from. Review scope and threshold changes before observing results; document deviations afterwards.'],
  Q06: ['What evidence would justify a second pilot, a redesign, or stopping?', 'Define a measure, observation window and decision for each outcome. Technical proof of a journey and market validation remain separate conclusions.'],
  Q07: ['Which user job should the first prototype make easier than the best current alternative?', 'Test a thin journey and its manual fallback. Measure the behavior or outcome directly; interview evidence informs the hypothesis and does not replace a pilot.'],
  Q10: ['Which accessibility and device needs affect the selected segment?', 'Choose a proposed web accessibility target and a native device matrix. Test the critical experiment and an accessible alternative with approved participants.'],
  Q12: ['Which features or markets would make the experiment harder to interpret?', 'Defer unrelated surfaces, paid acquisition and new monetization unless essential to the hypothesis. Name what evidence can change that choice.'],
  Q17: ['What data does the hypothesis actually require, and how will participation and withdrawal work?', 'Use synthetic scenarios first. Collect the smallest consented event set and identify a privacy owner, storage/retention/withdrawal rules, and safer substitute for sensitive data.'],
  Q25: ['Which events measure the hypothesis and which guardrails can falsify it?', 'Define an eligible exposure and a successful completion, exact deduplication and exclusions, and qualifying guardrail failures. Avoid vanity measures.'],
  Q26: ['Who can run the prototype study and what would immediately stop it?', 'Agree scope, consent, cost, case escalation and rollback. Make internal simulation, live study, expanded pilot and release distinct decisions.'],
  Q27: ['Who owns participant support, follow-up and evidence deletion if the experiment ends?', 'Record the accountable operator and a shutdown checklist before the pilot. Use qualified human support for risks outside the product boundary.'],
}

export function validateSapling(input, observed) {
  if (!input) return null
  const allowedKinds = new Set(['first-party', 'competitor', 'standard', 'repo', 'pilot'])
  const { sources, hypothesis, goal, experiment, flows } = input
  if (!Array.isArray(sources) || !sources.length || sources.length > 20) throw new Error('Sapling research needs dated source evidence.')
  const byId = new Map()
  for (const s of sources) {
    if (!s || !id(s.id) || byId.has(s.id) || !allowedKinds.has(s.kind) || (!https(s.ref) && !observed.has(s.ref))
      || !line(s.title) || !line(s.observation) || !line(s.limit) || !/^\d{4}-\d{2}-\d{2}$/.test(s.observedOn) || !Number.isFinite(Date.parse(s.observedOn))) throw new Error('Invalid Sapling source. Separate the observation from what it cannot establish.')
    byId.set(s.id, s)
  }
  const sourcesExist = (ids) => Array.isArray(ids) && ids.length > 0 && ids.every((anchor) => byId.has(anchor))
  if (!hypothesis || !line(hypothesis.segment) || !line(hypothesis.job) || !line(hypothesis.claim) || !line(hypothesis.alternative)
    || !line(hypothesis.unknown) || !sourcesExist(hypothesis.sources)) throw new Error('Sapling needs a falsifiable, source-linked hypothesis.')
  if (!goal || !line(goal.outcome) || !line(goal.metric) || !line(goal.numerator) || !line(goal.denominator) || !id(goal.event)
    || !pct(goal.targetPercent) || (goal.baselinePercent !== null && !pct(goal.baselinePercent)) || !line(goal.window)
    || !Number.isInteger(goal.minSample) || goal.minSample < 1 || !line(goal.decision) || !lines(goal.nonGoals) || !lines(goal.guardrails)) throw new Error('Sapling goal needs an outcome, explicit baseline (or null), measurable threshold, decision and safety guardrails.')
  if (!experiment || !line(experiment.method) || !line(experiment.comparison) || !line(experiment.reviewGate) || !line(experiment.stop)) throw new Error('Sapling experiment needs a method, comparison, review gate and stop rule.')
  if (!Array.isArray(flows) || !flows.length || flows.length > 12) throw new Error('Sapling needs bounded flows with checkable success and failure cases.')
  const seen = new Set()
  for (const f of flows) {
    if (!f || !id(f.id) || seen.has(f.id) || !line(f.actor) || !line(f.intent) || !lines(f.steps, 2) || !line(f.failure) || !line(f.proof)
      || !sourcesExist(f.sources) || (f.event !== undefined && !id(f.event))) throw new Error('Each Sapling flow needs an actor, steps, failure behavior, proof and source lineage.')
    seen.add(f.id)
  }
  if (flows.filter((f) => f.event === goal.event).length !== 1) throw new Error('Exactly one flow must own the metric completion event.')
  return { sources, hypothesis, goal, experiment, flows }
}

const story = (i) => `US-${String(i + 1).padStart(2, '0')}`
const criterion = (i) => `SC-${String(i + 1).padStart(3, '0')}`

export function renderSapling(packet) {
  const product = packet.sapling
  if (!product) return Object.fromEntries(['market-evidence', 'spec-kit-spec', 'spec-kit-plan', 'spec-kit-tasks', 'goal-flow'].map((name) => [
    `${name}.md`, '# Sapling research held\n\nNo current reviewed evidence was supplied. Collect dated primary evidence or reconcile the changed inputs before using a product goal, specification, plan, tasks or trace.\n',
  ]))
  const { sources, hypothesis: h, goal: g, experiment: exp, flows } = product
  const details = sources.map((s) => `| ${md(s.id)} | ${md(s.kind)} | ${https(s.ref) ? `[${md(s.title)}](${s.ref})` : `\`${s.ref}\``} (${s.observedOn}) | ${md(s.observation)} | ${md(s.limit)} |`)
  return {
    'market-evidence.md': ['# Sapling · market evidence', '', 'This is a proposal for product discovery. An alternative’s published feature establishes what it offers; pilot and first-party evidence are needed for demand and adoption.', '',
      '| Evidence | Type | Dated source | Observation | Limit |', '| --- | --- | --- | --- | --- |', ...details, '',
      `**Segment:** ${md(h.segment)}`, '', `**User job:** ${md(h.job)}`, '', `**Current alternative:** ${md(h.alternative)}`, '',
      `**Hypothesis:** ${md(h.claim)} (${h.sources.join(', ')})`, '', `**Material unknown:** ${md(h.unknown)}`, '',
      `**Test:** ${md(exp.method)}`, '', `**Comparison:** ${md(exp.comparison)}`, '', `**Review gate:** ${md(exp.reviewGate)}`, '', `**Stop rule:** ${md(exp.stop)}`, ''].join('\n'),
    'spec-kit-spec.md': ['# Draft Spec Kit feature specification', '', '**Status:** proposal for owner review. Keep the approved repository constitution and ISA as the governing sources.', '',
      `**Product goal G1:** ${md(g.outcome)}`, '', `**Segment and job:** ${md(h.segment)} — ${md(h.job)}`, '',
      '## User scenarios and checks', '', ...flows.flatMap((f, i) => [
        `### ${story(i)} · ${md(f.actor)}`, '', md(f.intent), '', ...f.steps.map((s, n) => `${n + 1}. ${md(s)}`), '',
        `Failure path: ${md(f.failure)}`, '', `${criterion(i)}: ${md(f.proof)}`, '', `Evidence: ${f.sources.join(', ')}.`, '',
      ]), '## Success criteria and non-goals', '',
      `- ${md(g.metric)}: ${md(g.numerator)} ÷ ${md(g.denominator)}. Target at least ${g.targetPercent}% of a minimum ${g.minSample}; baseline ${g.baselinePercent === null ? 'unknown' : `${g.baselinePercent}%`}. Window: ${md(g.window)}.`,
      `- Decision after the study: ${md(g.decision)}`, ...g.guardrails.map((s) => `- Guardrail: ${md(s)}`), ...g.nonGoals.map((s) => `- Out of scope: ${md(s)}`), ''].join('\n'),
    'spec-kit-plan.md': ['# Draft Spec Kit implementation and evidence plan', '',
      `- Reconcile with the existing repo constitution, ISA and GSD sequence before execution. ${md(exp.reviewGate)}`,
      `- Begin in an isolated fixture environment. ${md(exp.method)}`, `- Comparison: ${md(exp.comparison)}`,
      `- Instrument only approved measures. The single completion flow emits \`${g.event}\`; link the event to eligibility and deduplicate per eligible participant/observation.`,
      `- Pause and reconcile: ${md(exp.stop)}`, '- Run the positive and failure path for every scenario, read back server state on the same source pins, and distinguish technical acceptance from user research.', ''].join('\n'),
    'spec-kit-tasks.md': ['# Draft Spec Kit tasks', '', '- [ ] T001 Confirm audience, approval, comparison, data/consent boundaries and measurement contract.', '',
      ...flows.map((f, i) => `- [ ] T${String(i + 2).padStart(3, '0')} ${story(i)}: verify ${criterion(i)} and the failure path for ${md(f.id)}.`),
      '- [ ] Read back eligible events and decide whether to iterate, stop, or seek approval for a larger pilot.', ''].join('\n'),
    'goal-flow.md': ['# Sapling · goal and flow trace', '', `**G1:** ${md(g.outcome)}`, '', '```mermaid', 'flowchart LR',
      ...h.sources.map((s) => `  E_${s.replaceAll('-', '_')}[${s}] --> G1[Product goal G1]`),
      ...flows.flatMap((f, i) => [`  G1 --> US${i}[${story(i)}] --> F${i}[${f.id}] --> SC${i}[${criterion(i)}]`,
        ...(f.event === g.event ? [`  SC${i} --> M[Metric completion event]`] : [])]),
      '```', '', '| Story | Flow | Check | Evidence | Event |', '| --- | --- | --- | --- | --- |',
      ...flows.map((f, i) => `| ${story(i)} | ${md(f.id)} | ${criterion(i)} | ${f.sources.join(', ')} | ${md(f.event ?? '—')} |`), '',
      'Use this proposal to inspect whether each flow contributes to G1. It can inform the existing Cambium product graph review; it does not admit a node, assign a task, or write a Goal Graph.', ''].join('\n'),
  }
}
