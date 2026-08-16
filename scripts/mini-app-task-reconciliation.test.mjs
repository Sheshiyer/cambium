import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { test } from 'node:test'

const repositoryRoot = new URL('../', import.meta.url)

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, repositoryRoot), 'utf8'))
}

test('GIP-003 preserves all task provenance and exposes only residuals', async () => {
  const taskMap = await readJson('.planning/2026-08-11-mini-app-page-wiring.tasks.json')
  const expectedIds = Array.from({ length: 80 }, (_, index) => `T-${String(index + 1).padStart(3, '0')}`)

  assert.equal(taskMap.schema_version, '2026-08-16-mini-app-page-wiring-ownership.v2')
  assert.equal(taskMap.source_head, 'f988d31922385d9352c4efac6abe14b6de4bb1d8')
  assert.deepEqual(taskMap.tasks.map(({ id }) => id), expectedIds)
  assert.equal(new Set(taskMap.tasks.map(({ id }) => id)).size, 80)
  assert.deepEqual(taskMap.counts, {
    total: 80,
    executable: 18,
    implemented: 53,
    superseded: 4,
    residual: 18,
    'approval-gated': 5,
  })

  const executableIds = taskMap.tasks.filter(({ executable }) => executable).map(({ id }) => id)
  assert.deepEqual(taskMap.executable_task_ids, executableIds)

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
    }
    if (task.status === 'approval-gated') {
      assert.ok(task.current_evidence)
      assert.ok(task.missingAuthority)
    }
  }

  const byId = new Map(taskMap.tasks.map((task) => [task.id, task]))
  for (const id of ['T-008', 'T-009', 'T-021']) {
    assert.equal(byId.get(id).status, 'implemented', `${id} must carry issue #331 P1 acceptance evidence`)
    assert.match(byId.get(id).evidence, /Issue #331 P1/)
  }
  for (const id of ['T-053', 'T-059', 'T-074']) {
    assert.ok(byId.get(id).integration_lock_zones.includes('workers/quests/src/handler.ts'), `${id} must serialize handler.ts`)
  }
  for (const id of ['T-029', 'T-030', 'T-031', 'T-034', 'T-035', 'T-042']) {
    assert.equal(byId.get(id).status, 'implemented', `${id} must carry exact completion evidence`)
  }
  for (const id of ['T-032', 'T-033']) {
    assert.equal(byId.get(id).status, 'residual', `${id} remains contract-blocked`)
    assert.match(byId.get(id).missingAcceptance, /T-00[89]/)
  }
  assert.equal(byId.get('T-065').file_owner, 'workers/quests/src/page/scenes/inspect.ts')
  assert.deepEqual(
    taskMap.tasks.filter(({ status }) => status === 'approval-gated').map(({ id }) => id),
    ['T-020', 'T-038', 'T-078', 'T-079', 'T-080'],
  )
})

test('source reconciliation and execution manifest agree with the governed queue', async () => {
  const taskMap = await readJson('.planning/2026-08-11-mini-app-page-wiring.tasks.json')
  const ledger = await readJson('.planning/execution/2026-08-12-source-reconciliation.v1.json')
  const manifest = await readJson('.planning/2026-08-12-cambium-execution-wave.tasks.json')
  const gip003 = manifest.find(({ id }) => id === 'GIP-003')

  assert.deepEqual(ledger.tasks, taskMap.tasks)
  assert.deepEqual(ledger.counts.dispositions, {
    implemented: 53,
    superseded: 4,
    residual: 18,
    'approval-gated': 5,
  })
  assert.equal(ledger.counts.executable_tasks, 18)
  assert.equal(gip003.status, 'completed')
  assert.match(gip003.validation, /50 implemented, 4 superseded, 21 executable residuals, and 5 non-executable approval-gated/)

  const serialized = JSON.stringify({ taskMap, ledger, manifest })
  assert.equal(serialized.includes('/Volumes/'), false)
  assert.equal(serialized.includes('/Users/'), false)
})
