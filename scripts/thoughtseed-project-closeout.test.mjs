import assert from 'node:assert/strict'
import { lstat, mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  executeProjectCloseout,
  normalizeProjectCloseoutAction,
  projectCloseoutDigest,
  REVIEWED_PORTFOLIO_CATALOG_DIGEST,
  REVIEWED_ROOT_MAP_DIGEST,
} from './thoughtseed-project-closeout.mjs'

const ROOT_DIGEST = REVIEWED_ROOT_MAP_DIGEST
const SOURCE_DIGEST = REVIEWED_PORTFOLIO_CATALOG_DIGEST

function action(proposal = {}, top = {}) {
  return {
    schema: 'thoughtseed.portfolio-admin-action.v1',
    kind: 'close-work-object',
    portfolioId: 'thoughtseed',
    idempotencyKey: 'close-cambium-1',
    rootMapDigest: ROOT_DIGEST,
    sourceDigest: SOURCE_DIGEST,
    subject: { id: 'sapling:cambium', name: 'Cambium' },
    proposal: {
      closeoutSchema: 'thoughtseed.project-closeout.v1',
      disposition: 'completed',
      finalSummary: 'Final handoff accepted; no active tracking remains.',
      handoffMarkdownPath: '.project/HANDOFF.md',
      closureReceiptJsonPath: '.project/project-closeout-receipt.v1.json',
      agentMemoryJsonPath: '.project/agent-memory-projection.v1.json',
      r2VaultPrefix: 'project-closeouts/v1/thoughtseed/sapling-cambium',
      activeIndexDisposition: 'remove-from-active',
      repositoryFinalStateReviewed: true,
      handoffDocumented: true,
      r2VaultRecorded: true,
      agentMemoryUpdated: true,
      activeIndexUpdated: true,
      downstreamFlowsStopped: true,
      successorWorkObjectId: '',
      ...proposal,
    },
    ...top,
  }
}

async function fixture() {
  const projectRoot = await mkdtemp(join(tmpdir(), 'thoughtseed-project-closeout-'))
  await mkdir(join(projectRoot, '.project'))
  await writeFile(join(projectRoot, 'PROJECT.md'), '# Cambium\n')
  await writeFile(join(projectRoot, '.project/HANDOFF.md'), '# Project handoff\n\n- Status: active\n')
  return { projectRoot }
}

test('dry-run plans terminal closeout without writing project files', async () => {
  const fx = await fixture()
  const result = await executeProjectCloseout({ action: action(), ...fx, execute: false, now: () => '2026-08-08T05:30:00.000Z' })

  assert.equal(result.dryRun, true)
  assert.equal(result.active, false)
  assert.equal(result.finished, true)
  assert.equal(result.outputs.handoffMarkdownPath, '.project/HANDOFF.md')
  assert.equal(result.outputs.agentMemoryJsonPath, '.project/agent-memory-projection.v1.json')
  assert.equal(JSON.stringify(result).includes(fx.projectRoot), false)
  await assert.rejects(() => readFile(join(fx.projectRoot, '.project/project-closeout-receipt.v1.json'), 'utf8'), /ENOENT/)
})

test('execution writes final handoff, receipt, memory projection, and finished-index delta', async () => {
  const fx = await fixture()
  const result = await executeProjectCloseout({ action: action(), ...fx, execute: true, now: () => '2026-08-08T05:30:00.000Z' })

  const handoff = await readFile(join(fx.projectRoot, '.project/HANDOFF.md'), 'utf8')
  const receipt = JSON.parse(await readFile(join(fx.projectRoot, '.project/project-closeout-receipt.v1.json'), 'utf8'))
  const memory = JSON.parse(await readFile(join(fx.projectRoot, '.project/agent-memory-projection.v1.json'), 'utf8'))
  const index = JSON.parse(await readFile(join(fx.projectRoot, '.project/finished-index-delta.v1.json'), 'utf8'))

  assert.match(handoff, /## Project closeout/)
  assert.equal(receipt.status, 'completed-closed')
  assert.equal(receipt.active, false)
  assert.equal(receipt.finished, true)
  assert.equal(memory.schema, 'thoughtseed.agent-memory-projection.v1')
  assert.equal(memory.active, false)
  assert.equal(memory.finished, true)
  assert.equal(index.removeFromActive, true)
  assert.equal(index.addToFinished, true)
  assert.equal(receipt.closeoutDigest, projectCloseoutDigest(normalizeProjectCloseoutAction(action())))
  assert.equal(result.r2VaultObjects.length, 4)
  assert.equal(JSON.stringify({ receipt, memory, index }).includes(fx.projectRoot), false)
})

test('executor rejects stale digests and incomplete closeout confirmations', async () => {
  const stale = await fixture()
  await assert.rejects(
    () => executeProjectCloseout({ action: action({}, { rootMapDigest: '0'.repeat(64) }), ...stale, execute: false }),
    /root_map_digest_not_reviewed/,
  )
  const incomplete = await fixture()
  await assert.rejects(
    () => executeProjectCloseout({ action: action({ downstreamFlowsStopped: false }), ...incomplete, execute: true }),
    /downstream_flows_stopped_not_confirmed/,
  )
  const unsafe = await fixture()
  await assert.rejects(
    () => executeProjectCloseout({ action: action({ handoffMarkdownPath: '../HANDOFF.md' }), ...unsafe, execute: true }),
    /handoff_markdown_path_invalid/,
  )
})

test('executor rejects symlinked project roots', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'thoughtseed-project-closeout-symlink-'))
  const actualRoot = join(parent, 'actual')
  await mkdir(join(actualRoot, '.project'), { recursive: true })
  await writeFile(join(actualRoot, 'PROJECT.md'), '# Actual\n')
  const linkedRoot = join(parent, 'linked')
  await symlink(actualRoot, linkedRoot)

  await assert.rejects(
    () => executeProjectCloseout({ action: action(), projectRoot: linkedRoot, execute: false }),
    /project_root_invalid/,
  )
  assert.equal((await lstat(actualRoot)).isDirectory(), true)
})
