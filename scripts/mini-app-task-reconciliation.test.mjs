import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { test } from 'node:test'

const repositoryRoot = new URL('../', import.meta.url)
const schedulerStages = [
  ['planning', ['T-032', 'T-033']],
  ['mission', ['T-044']],
  ['tools', ['T-053', 'T-054', 'T-056']],
  ['story', ['T-059', 'T-060', 'T-061', 'T-062', 'T-063']],
  ['inspect', ['T-065', 'T-068']],
  ['portfolio', ['T-074', 'T-075']],
  ['validation', ['T-028', 'T-036', 'T-037']],
]
const serializedHandlerOrder = ['T-044', 'T-053', 'T-059', 'T-074']
const remainingHandlerOrder = []
const approvalGatedIds = ['T-020', 'T-038', 'T-078', 'T-079', 'T-080']
const terminalStatuses = new Set(['implemented', 'superseded'])

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, repositoryRoot), 'utf8'))
}

function deriveReadyTaskIds(taskMap) {
  const byId = new Map(taskMap.tasks.map((task) => [task.id, task]))

  for (const [stage, stageTaskIds] of schedulerStages) {
    const incompleteTasks = stageTaskIds.map((id) => byId.get(id)).filter(({ status }) => !terminalStatuses.has(status))
    if (incompleteTasks.length === 0) continue

    return {
      stage,
      readyTaskIds: incompleteTasks
        .filter(({ status, executable, dependencies }) => {
          if (status !== 'residual' || !executable) return false
          return dependencies.every((dependencyId) => terminalStatuses.has(byId.get(dependencyId).status))
        })
        .map(({ id }) => id),
    }
  }

  return { stage: null, readyTaskIds: [] }
}

test('GIP-003 preserves all task provenance and exposes only residuals', async () => {
  const taskMap = await readJson('.planning/2026-08-11-mini-app-page-wiring.tasks.json')
  const expectedIds = Array.from({ length: 80 }, (_, index) => `T-${String(index + 1).padStart(3, '0')}`)
  const byId = new Map(taskMap.tasks.map((task) => [task.id, task]))
  const derivedReady = deriveReadyTaskIds(taskMap)

  assert.equal(taskMap.schema_version, '2026-08-16-mini-app-page-wiring-ownership.v2')
  assert.equal(taskMap.source_head, 'f988d31922385d9352c4efac6abe14b6de4bb1d8')
  assert.equal(taskMap.source_head_role, 'immutable 2026-08-15 task-map reconciliation baseline; not the current execution head')
  assert.equal(taskMap.evidence_reconciled_through, 'origin/main@111c5f9423edd9878212627d20e268304a6acc31')
  assert.deepEqual(taskMap.tasks.map(({ id }) => id), expectedIds)
  assert.equal(new Set(taskMap.tasks.map(({ id }) => id)).size, 80)
  assert.deepEqual(taskMap.counts, {
    total: 80,
    executable: 0,
    implemented: 71,
    superseded: 4,
    residual: 0,
    'approval-gated': 5,
  })

  const executableIds = taskMap.tasks.filter(({ executable }) => executable).map(({ id }) => id)
  assert.deepEqual(taskMap.executable_task_ids, executableIds)
  assert.deepEqual(taskMap.execution_scheduler.ordered_stages, schedulerStages.map(([stage, task_ids]) => ({ stage, task_ids })))
  assert.deepEqual(taskMap.execution_scheduler.ready_task_ids, [])
  assert.deepEqual(taskMap.execution_scheduler.queue_policy.serialized_handler_task_ids, serializedHandlerOrder)
  assert.deepEqual(taskMap.execution_scheduler.backlog_task_ids, executableIds)
  assert.equal(taskMap.execution_scheduler.queue_policy.ready_frontier_rule, 'Only the earliest incomplete stage may contribute ready_task_ids.')
  assert.equal(taskMap.execution_scheduler.queue_policy.backlog_rule, 'executable=true enumerates the residual backlog, not immediate dispatch readiness.')
  assert.equal(taskMap.execution_scheduler.queue_policy.stale_blocked_packet_rule, 'Implemented packet tasks never remain executable or carry missingAcceptance blockers.')
  assert.deepEqual(taskMap.execution_scheduler.queue_policy.terminal_statuses, ['implemented', 'superseded'])
  assert.equal(taskMap.execution_scheduler.queue_policy.handler_serialization.path, 'workers/quests/src/handler.ts')
  assert.equal(taskMap.execution_scheduler.queue_policy.handler_serialization.policy, 'serialized')
  assert.deepEqual(taskMap.execution_scheduler.queue_policy.handler_serialization.remaining_task_ids, remainingHandlerOrder)
  assert.deepEqual(derivedReady, {
    stage: null,
    readyTaskIds: [],
  })

  for (const task of taskMap.tasks) {
    assert.match(task.status, /^(implemented|superseded|residual|approval-gated)$/)
    assert.equal(task.executable, task.status === 'residual')
    assert.ok(Array.isArray(task.dependencies))
    assert.ok(task.dependencies.every((id) => expectedIds.includes(id)))
    assert.ok(task.validation)
    assert.ok(task.file_owner)
    assert.equal(task.file_owner.startsWith('/'), false)
    await access(new URL(task.file_owner, repositoryRoot))

    if (task.status === 'implemented' || task.status === 'superseded') assert.ok(task.evidence)
    if (task.status === 'residual') {
      assert.ok(task.current_evidence)
      assert.ok(task.missingAcceptance)
      for (const field of ['implementation_owners', 'test_owners', 'integration_lock_zones']) {
        assert.ok(Array.isArray(task[field]), `${task.id} must enumerate ${field}`)
        assert.equal(new Set(task[field]).size, task[field].length, `${task.id} ${field} must not contain duplicates`)
        for (const owner of task[field]) {
          assert.equal(owner.startsWith('/'), false)
          await access(new URL(owner, repositoryRoot))
        }
      }
      assert.ok(task.implementation_owners.length > 0, `${task.id} needs an implementation owner`)
      assert.ok(task.test_owners.length > 0, `${task.id} needs a test owner`)
      assert.ok(task.implementation_owners.includes(task.file_owner), `${task.id} file_owner must be included in implementation_owners`)
    }
    if (task.status === 'approval-gated') {
      assert.ok(task.current_evidence)
      assert.ok(task.missingAuthority)
    }
  }

  for (const id of ['T-008', 'T-009', 'T-021']) {
    assert.equal(byId.get(id).status, 'implemented', `${id} must carry issue #331 P1 acceptance evidence`)
    assert.match(byId.get(id).evidence, /Issue #331 P1/)
  }
  for (const id of remainingHandlerOrder) {
    assert.ok(byId.get(id).integration_lock_zones.includes('workers/quests/src/handler.ts'), `${id} must serialize handler.ts`)
  }
  assert.deepEqual(
    taskMap.tasks
      .filter(({ status, integration_lock_zones }) => status === 'residual' && integration_lock_zones.includes('workers/quests/src/handler.ts'))
      .map(({ id }) => id),
    remainingHandlerOrder,
    'every residual handler owner must appear in the exact serialized order',
  )
  for (const id of ['T-029', 'T-030', 'T-031', 'T-034', 'T-035', 'T-042']) {
    assert.equal(byId.get(id).status, 'implemented', `${id} must carry exact completion evidence`)
  }
  for (const id of ['T-032', 'T-033']) {
    assert.equal(byId.get(id).status, 'implemented', `${id} must close with merged contract-backed packet evidence`)
    assert.equal(byId.get(id).executable, false, `${id} must leave the executable backlog once the packet is complete`)
    assert.ok(byId.get(id).evidence)
    assert.equal('missingAcceptance' in byId.get(id), false, `${id} must not retain missingAcceptance once implemented`)
  }
  assert.equal(byId.get('T-044').status, 'implemented')
  assert.equal(byId.get('T-044').executable, false)
  assert.match(byId.get('T-044').evidence, /tenant-scoped Mission selection key/)
  assert.equal(byId.get('T-053').status, 'implemented')
  assert.equal(byId.get('T-053').executable, false)
  assert.match(byId.get('T-053').evidence, /validated five-panel ToolsCommandProjection/)
  for (const id of ['T-054', 'T-056']) {
    assert.equal(byId.get(id).status, 'implemented')
    assert.equal(byId.get(id).executable, false)
    assert.equal('missingAcceptance' in byId.get(id), false)
  }
  assert.match(byId.get('T-054').evidence, /strictest envelope\/panel result/)
  assert.match(byId.get('T-056').evidence, /Mission-to-Tools navigation control/)
  assert.equal(byId.get('T-059').status, 'implemented')
  assert.equal(byId.get('T-059').executable, false)
  assert.equal('missingAcceptance' in byId.get('T-059'), false)
  assert.match(byId.get('T-059').evidence, /receipt, founder-decision, and completed-transition facts/)
  assert.deepEqual(byId.get('T-059').implementation_owners, [
    'workers/quests/src/page/scenes/story.ts',
    'workers/quests/src/handler.ts',
  ])
  for (const id of ['T-060', 'T-061']) {
    assert.equal(byId.get(id).status, 'implemented')
    assert.equal(byId.get(id).executable, false)
    assert.equal('missingAcceptance' in byId.get(id), false)
  }
  assert.match(byId.get('T-060').evidence, /stable eventId plus a canonical event fingerprint/)
  assert.match(byId.get('T-061').evidence, /authoritative storyProjection marker/)
  for (const id of ['T-062', 'T-063']) {
    assert.equal(byId.get(id).status, 'implemented')
    assert.equal(byId.get(id).executable, false)
    assert.equal('missingAcceptance' in byId.get(id), false)
  }
  assert.match(byId.get('T-062').evidence, /marker-qualified Story provenance/)
  assert.match(byId.get('T-063').evidence, /receipt, decision, and completed transition/)
  assert.equal(byId.get('T-065').file_owner, 'workers/quests/src/page/scenes/inspect.ts')
  assert.equal(byId.get('T-065').status, 'implemented')
  assert.equal(byId.get('T-065').executable, false)
  assert.equal('missingAcceptance' in byId.get('T-065'), false)
  assert.match(byId.get('T-065').evidence, /blocker, freshness, and redacted-receipt lead cues/)
  assert.equal(byId.get('T-068').file_owner, 'workers/quests/src/page/scenes/inspect.ts')
  assert.equal(byId.get('T-068').status, 'implemented')
  assert.equal(byId.get('T-068').executable, false)
  assert.equal('missingAcceptance' in byId.get('T-068'), false)
  assert.match(byId.get('T-068').evidence, /five-scene InspectPageReadiness panel/)
  assert.equal(byId.get('T-074').status, 'implemented')
  assert.equal(byId.get('T-074').executable, false)
  assert.equal('missingAcceptance' in byId.get('T-074'), false)
  assert.match(byId.get('T-074').evidence, /explicit promote-portfolio action/)
  assert.deepEqual(byId.get('T-074').implementation_owners, [
    'workers/quests/src/page/operating-fabric/portfolio.ts',
    'workers/quests/src/page/operating-fabric/client.ts',
    'workers/quests/src/page/client/signed-action.ts',
    'workers/quests/src/handler.ts',
  ])
  assert.equal(byId.get('T-075').status, 'implemented')
  assert.equal(byId.get('T-075').executable, false)
  assert.equal('missingAcceptance' in byId.get('T-075'), false)
  assert.match(byId.get('T-075').evidence, /all-zone and all-state matrix/)
  assert.match(byId.get('T-075').evidence, /Node\/browser parity/)
  assert.equal(byId.get('T-028').status, 'implemented')
  assert.equal(byId.get('T-028').executable, false)
  assert.equal('missingAcceptance' in byId.get('T-028'), false)
  assert.match(byId.get('T-028').evidence, /reproducible pre-activation 403\/ledger baseline/i)
  assert.equal(byId.get('T-036').status, 'implemented')
  assert.equal(byId.get('T-036').executable, false)
  assert.equal('missingAcceptance' in byId.get('T-036'), false)
  assert.match(byId.get('T-036').evidence, /authoritative page-state matrix/i)
  assert.equal(byId.get('T-037').status, 'implemented')
  assert.equal(byId.get('T-037').executable, false)
  assert.equal('missingAcceptance' in byId.get('T-037'), false)
  assert.match(byId.get('T-037').evidence, /mobile and desktop browser-story matrix/i)
  assert.deepEqual(taskMap.tasks.filter(({ status }) => status === 'approval-gated').map(({ id }) => id), approvalGatedIds)
})

test('source reconciliation and execution manifest agree with the governed queue', async () => {
  const taskMap = await readJson('.planning/2026-08-11-mini-app-page-wiring.tasks.json')
  const ledger = await readJson('.planning/execution/2026-08-12-source-reconciliation.v1.json')
  const manifest = await readJson('.planning/2026-08-12-cambium-execution-wave.tasks.json')
  const gip003 = manifest.find(({ id }) => id === 'GIP-003')
  const markdownPlan = await readFile(new URL('docs/plans/2026-08-11-mini-app-page-wiring-swarm-plan.md', repositoryRoot), 'utf8')

  assert.deepEqual(ledger.tasks, taskMap.tasks)
  assert.deepEqual(ledger.execution_scheduler, taskMap.execution_scheduler)
  assert.equal(ledger.source_authority_role, 'immutable 2026-08-15 reconciliation inputs; not the current execution head')
  assert.equal(ledger.evidence_reconciled_through, taskMap.evidence_reconciled_through)
  assert.deepEqual(ledger.counts.dispositions, {
    implemented: 71,
    superseded: 4,
    residual: 0,
    'approval-gated': 5,
  })
  assert.equal(ledger.counts.executable_tasks, 0)
  assert.equal(gip003.status, 'completed')
  assert.match(
    gip003.validation,
    new RegExp(`${taskMap.counts.implemented} implemented, ${taskMap.counts.superseded} superseded, ${taskMap.counts.residual} executable residuals, and ${taskMap.counts['approval-gated']} non-executable approval-gated`),
  )
  assert.match(gip003.validation, /executable frontier is empty/)
  assert.match(gip003.validation, /serialized handler order T-044, T-053, T-059, T-074 is complete/)
  assert.doesNotMatch(gip003.validation, /50 implemented|21 executable residuals|53 implemented|18 executable residuals|56 implemented|15 executable residuals|57 implemented|14 executable residuals/)

  assert.match(markdownPlan, /#### Tools packet — T-032 complete/)
  assert.match(markdownPlan, /#### Story packet — T-033 complete/)
  assert.match(markdownPlan, /panels status\/services\/agents\/activeWork\/handoffs/)
  assert.match(markdownPlan, /panelId mappings status\/services\/agents\/active-work\/handoffs/)
  assert.match(markdownPlan, /freshness state `fresh\|stale\|unknown`/)
  assert.match(markdownPlan, /handler-to-renderer normal\/fail-closed\/malformed\/unexpected fixtures/)
  assert.match(markdownPlan, /Landed T-053 boundary:\*\* `GET \/api\/quests\/\{tenant\}` serves the validated `ToolsCommandProjection`/)
  assert.match(markdownPlan, /Landed T-054\/T-056 boundary:\*\* every panel exposes source-aware freshness/)
  assert.match(markdownPlan, /Landed T-059 boundary:\*\* the Worker projects only receipt-backed public facts/)
  assert.match(markdownPlan, /Landed T-060\/T-061 boundary:\*\* exact replay collapses by stable event identity/)
  assert.match(markdownPlan, /Landed T-062\/T-063 boundary:\*\* marker-qualified events expose separate exact WorkObject kind and identity controls/)
  assert.match(markdownPlan, /Landed T-065 boundary:\*\* Inspect renders explicit blocker, freshness, and redacted-receipt cues/)
  assert.match(markdownPlan, /Landed T-068 boundary:\*\* the System pane lists Mission, Gate, Tools, Story, and Inspect/)
  assert.match(markdownPlan, /Landed T-074 boundary:\*\* exact eligible Saplings expose an explicit founder-gated Portfolio promotion proposal/)
  assert.match(markdownPlan, /Landed T-075 boundary:\*\* the dedicated Portfolio matrix proves all five record zones/)
  assert.match(markdownPlan, /Landed T-028 boundary:\*\* a reproducible pre-activation 403\/ledger baseline/)
  assert.match(markdownPlan, /Landed T-036 boundary:\*\* CI runs the authoritative page-state matrix/)
  assert.match(markdownPlan, /Landed T-037 boundary:\*\* the mobile and desktop browser-story matrix/)
  assert.match(markdownPlan, /Next collision-safe slice:\*\* the executable Mini App queue is complete/)
  assert.match(markdownPlan, /Remaining write set:\*\* no implementation residuals remain/)
  assert.match(markdownPlan, /eventId/)
  assert.match(markdownPlan, /stable replay dedupe/)
  assert.match(markdownPlan, /first qualifying event and empty guidance/)
  assert.doesNotMatch(markdownPlan, /partial, contract blocked/)

  const serialized = JSON.stringify({ taskMap, ledger, manifest })
  assert.equal(serialized.includes('/Volumes/'), false)
  assert.equal(serialized.includes('/Users/'), false)
})
