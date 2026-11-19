import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildPacket, PROGRESS, REVIEW } from './project-onboarding/packet.mjs'
import { renderSapling } from './project-onboarding/sapling.mjs'
import { readBoard, resolveWorkObject } from './project-onboarding/sources.mjs'

const ref = 'repo:example/core:specs/011-booking/spec.md'
const issue = 'https://github.com/example/core/issues/42'
const evidence = () => ({
  identity: { workId: 'branch:project', name: 'Project', classification: 'client-branch', status: 'vault-and-workbench' },
  primary: { status: 'reviewed-and-observed', repository: 'example/core' },
  board: { status: 'verified-exact', existingIssueUrls: [issue] },
  repos: [{ repository: 'example/core', refs: [{ ref }], github: {}, roles: ['backend'], lifecycle: 'current' }], reviewSources: [],
})
const input = (e, schema = REVIEW, track) => ({ schema, workId: e.identity.workId, inputDigest: buildPacket(e, null, null, track).inputDigest })

test('a client name with multiple projects requires a precise selection; slug-relative documents are not repos', () => {
  const records = [
    { workId: 'branch:client', accountId: 'client', provenance: ['repo:client-project/README.md'] },
    { workId: 'branch:side-project', accountId: 'client', provenance: ['repo:owner/side-project/docs/contracts.md'] },
  ]
  assert.throws(() => resolveWorkObject('client', records, () => []), /branch:client, branch:side-project/)
  assert.equal(resolveWorkObject('git@github.com:owner/side-project.git', records, () => [])?.workId, 'branch:side-project')
  assert.equal(resolveWorkObject('client-project/README.md', records, () => []), null)
})

test('GitHub board discovery never binds by title and refuses conflicting local board bindings', async () => {
  const options = { primary: 'example/core', repos: [], name: 'Core', github: true }
  const read = async (_tool, args) => {
    assert.deepEqual(args.slice(0, 3), ['project', 'list', '--closed'])
    return JSON.stringify({ totalCount: 2, projects: [1, 2].map((number) => ({ number, title: 'Core', url: `https://github.com/users/example/projects/${number}` })) })
  }
  const listed = await readBoard(options, read)
  assert.equal(listed.status, 'unbound')
  assert.deepEqual(listed.candidates.map((p) => p.number), [1, 2])
  const packet = { planning: { github_project: { owner: 'example', number: 1, url: 'https://github.com/users/example/projects/1' } } }
  assert.equal((await readBoard({ ...options, packet, requested: 'example/2' }, () => assert.fail())).status, 'conflicting-bindings')
})

test('an exact bound board needs a read-back of privacy and repository items', async () => {
  let isPublic = false
  let repository = 'example/core'
  const read = async (_tool, args) => JSON.stringify(({
    view: { number: 1, id: 'project-v2-id', public: isPublic, closed: false, title: 'Core', url: 'https://github.com/users/example/projects/1' },
    'item-list': { totalCount: 1, items: [{ content: { repository, url: issue } }] }, 'field-list': { fields: [{ name: 'Status' }] },
  })[args[1]])
  const options = { requested: 'example/1', primary: 'example/core', repos: [], github: true }
  assert.equal((await readBoard(options, read)).status, 'verified-exact')
  isPublic = true
  assert.equal((await readBoard(options, read)).status, 'board-not-private')
  isPublic = false
  repository = 'example/unrelated'
  assert.equal((await readBoard(options, read)).status, 'board-repo-unconfirmed')
})

test('a stale source holds contract, answers and closeout claims together', () => {
  const e = evidence()
  const review = { ...input(e), contract: { state: 'mixed', note: 'Exhibit missing', sources: [ref] } }
  const terminal = { key: 'booking-proof', rail: 'backend', state: 'terminal', worktree: 'clean', commit: 'a'.repeat(40), pending: [], terminalReceipt: 'receipt', acceptanceRef: 'isa:booking', handoffRef: 'handoff:booking' }
  const progress = { ...input(e, PROGRESS), answers: { Q02: { state: 'deferred', by: 'Owner', note: 'Waiting for exhibit' } }, children: [terminal] }
  const prepared = buildPacket(e, review, progress)
  assert.equal(prepared.contract.state, 'mixed')
  assert.equal(prepared.questions.length, 30)
  assert.equal(prepared.questions[1].answer.state, 'deferred')
  assert.equal(prepared.children[0].disposition, 'archive-candidate')
  assert.equal(buildPacket(e, review, { ...progress, children: [{ ...terminal, pending: ['unmerged review'] }] }).children[0].disposition, 'retain')
  assert.equal(buildPacket(e, review, { ...progress, children: [{ ...terminal, worktree: 'dirty' }] }).children[0].disposition, 'retain')
  e.repos[0].refs[0].fingerprint = 'new-source-hash'
  const stale = buildPacket(e, review, progress)
  assert.equal(stale.contract.state, 'unverified')
  assert.equal(stale.questions[1].answer, null)
  assert.deepEqual(stale.children, [])
  assert.equal(stale.notices.length, 2)
})

test('the roadmap reuses exact observed issue URLs and refuses circular or unsourced goals', () => {
  const e = evidence()
  const base = { id: 'booking-proof', rail: 'backend', stage: 'M1', basis: 'product-goal', state: 'proposed',
    outcome: 'See an accepted booking', measure: 'One fixture booking', gate: 'Owner approves fixtures', sources: [ref], issue }
  assert.equal(buildPacket(e, { ...input(e), goals: [base] }).goals[0].boardItem, 'observed-on-board')
  assert.throws(() => buildPacket(e, { ...input(e), goals: [{ ...base, dependsOn: [base.id] }] }), /circular/)
  assert.throws(() => buildPacket(e, { ...input(e), goals: [{ ...base, sources: ['unseen-contract'] }] }), /exact source refs/)
  e.identity.status = 'classification-conflict'
  assert.equal(buildPacket(e).roadmap, 'work-object-reconciliation-required')
})

test('Sapling evidence, Spec Kit and flow trace remain bound to one measurable event owner', () => {
  const e = evidence()
  const product = {
    sources: [{ id: 'spec', kind: 'repo', ref, title: 'Booking spec', observation: 'Supports booking', limit: 'Not user demand', observedOn: '2026-11-15' }],
    hypothesis: { segment: 'New users', job: 'Make a booking', claim: 'Mobile would help', alternative: 'Manual request', unknown: 'Baseline', sources: ['spec'] },
    goal: { outcome: 'Confirm a booking', metric: 'Acceptance rate', numerator: 'Accepted', denominator: 'Eligible', targetPercent: 50, baselinePercent: null,
      minSample: 10, event: 'booking-accepted', window: 'One week', decision: 'Continue or redesign', nonGoals: ['No release'], guardrails: ['No personal data'] },
    experiment: { method: 'Fixture', comparison: 'Manual', reviewGate: 'Owner readback', stop: 'Pause on failure' },
    flows: [{ id: 'booking', actor: 'User', intent: 'Book', steps: ['Request', 'Confirm'], failure: 'Retry safely', proof: 'One booking', sources: ['spec'], event: 'booking-accepted' }],
  }
  const review = { ...input(e, REVIEW, 'sapling'), sapling: product }
  const p = buildPacket(e, review, null, 'sapling')
  assert.equal(p.contract.state, 'not-applicable')
  assert.equal(p.evidence.identity.workId, 'branch:project')
  assert.equal(p.roadmap, 'product-discovery-proposal')
  assert.match(renderSapling(p)['goal-flow.md'], /G1 --> US0\[US-01\].*SC-001/)
  const dangling = structuredClone(review)
  dangling.sapling.flows[0].sources = ['unknown']
  assert.throws(() => buildPacket(e, dangling, null, 'sapling'), /source lineage/)
  const duplicate = structuredClone(review)
  duplicate.sapling.flows.push({ ...product.flows[0], id: 'second-acceptance' })
  assert.throws(() => buildPacket(e, duplicate, null, 'sapling'), /Exactly one flow/)
  assert.equal(buildPacket(e, review).sapling, null)
  assert.equal(buildPacket({ ...e, identity: { ...e.identity, classification: 'sapling' } }).track, 'sapling')
  assert.match(renderSapling({})['spec-kit-spec.md'], /held/)
})

test('checkout entry point observes a pinned GitHub origin offline without assuming membership', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'cambium-onboarding-'))
  const git = (...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' })
  try {
    git('init', '--quiet', '-b', 'main')
    git('remote', 'add', 'origin', 'git@github.com:example/unknown-repo.git')
    await writeFile(join(cwd, 'README.md'), 'private body not part of output\n')
    git('add', 'README.md')
    git('-c', 'user.email=fixture@example.invalid', '-c', 'user.name=Fixture', 'commit', '--quiet', '-m', 'Fixture')
    const cli = fileURLToPath(new URL('thoughtseed-project-onboarding.mjs', import.meta.url))
    const out = execFileSync(process.execPath, [cli, '--workspace', cwd, '--root', cwd], { encoding: 'utf8' })
    const p = JSON.parse(out)
    assert.equal(p.evidence.identity.status, 'unmapped')
    assert.equal(p.evidence.repos[0].local.commit, git('rev-parse', 'HEAD').trim())
    assert.equal(p.evidence.repos[0].github.status, 'not-requested')
    assert.doesNotMatch(out, /private body not part of output/)
    assert.equal(git('status', '--short'), '')
  } finally { await rm(cwd, { recursive: true, force: true }) }
})
