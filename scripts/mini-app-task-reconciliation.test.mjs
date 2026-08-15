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

  assert.equal(taskMap.schema_version, '2026-08-15-mini-app-page-wiring-reconciliation.v1')
  assert.equal(taskMap.source_head, 'f7e8795615e372323aaa24a5ae2d0255cb45aaec')
  assert.deepEqual(taskMap.tasks.map(({ id }) => id), expectedIds)
  assert.equal(new Set(taskMap.tasks.map(({ id }) => id)).size, 80)
  assert.deepEqual(taskMap.counts, {
    total: 80,
    executable: 28,
    implemented: 44,
    superseded: 4,
    residual: 28,
    'approval-gated': 4,
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
    }
    if (task.status === 'approval-gated') {
      assert.ok(task.current_evidence)
      assert.ok(task.missingAuthority)
    }
  }
})

test('source reconciliation and execution manifest agree with the governed queue', async () => {
  const taskMap = await readJson('.planning/2026-08-11-mini-app-page-wiring.tasks.json')
  const ledger = await readJson('.planning/execution/2026-08-12-source-reconciliation.v1.json')
  const manifest = await readJson('.planning/2026-08-12-cambium-execution-wave.tasks.json')
  const gip003 = manifest.find(({ id }) => id === 'GIP-003')

  assert.deepEqual(ledger.tasks, taskMap.tasks)
  assert.deepEqual(ledger.counts.dispositions, {
    implemented: 44,
    superseded: 4,
    residual: 28,
    'approval-gated': 4,
  })
  assert.equal(ledger.counts.executable_tasks, 28)
  assert.equal(gip003.status, 'completed')
  assert.match(gip003.validation, /44 implemented, 4 superseded, 28 executable residuals, and 4 non-executable approval-gated/)

  const serialized = JSON.stringify({ taskMap, ledger, manifest })
  assert.equal(serialized.includes('/Volumes/'), false)
  assert.equal(serialized.includes('/Users/'), false)
})
