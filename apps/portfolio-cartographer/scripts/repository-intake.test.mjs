import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { link, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { compileRepositoryIntake, renderRepositoryIntake, validateIntakeSource } from './repository-intake.mjs'
import { snapshotDigest } from './generate-portfolio-root-map.mjs'
import { resolveRepositoryEvidence } from '../src/repository-evidence.ts'

const script = fileURLToPath(new URL('./repository-intake.mjs', import.meta.url))
// Dated intake is verified against its exact source snapshot; it must not adopt later census evidence.
const rootPath = fileURLToPath(new URL('../../../docs/project-management/portfolio-roots.pre-2026-10-08-census.v1.json', import.meta.url))
const currentRootPath = fileURLToPath(new URL('../../../docs/project-management/portfolio-roots.v1.json', import.meta.url))
const currentSourcePath = fileURLToPath(new URL('../../../docs/project-management/repository-intake-source.v1.json', import.meta.url))
const currentOutputPath = fileURLToPath(new URL('../../../docs/project-management/repository-intake.v1.json', import.meta.url))
const roots = JSON.parse(await readFile(rootPath, 'utf8'))
const mappingReceipts = JSON.parse(await readFile(new URL('../../../docs/project-management/portfolio-mapping-receipts-batch-3.v1.json', import.meta.url), 'utf8'))
const reviewedMappings = mappingReceipts.receipts.filter((row) => ['R_kgDOSzF56w', 'R_kgDOSwXJ7Q', 'R_kgDOSzK35A'].includes(row.repository.repositoryId))
  .map((row) => ({ fullName: row.repository.nameWithOwner, repositoryId: row.repository.repositoryId,
    workObjectId: row.workObjectId, receiptId: row.receiptId, contentDigest: row.contentDigest }))
const repository = (fullName = 'Example/Website', repositoryId = 'R_WEBSITE') => ({ fullName, repositoryId, nodeId: repositoryId })
const local = (kind = 'portfolio-root', folder = 'cambium-telegram-showcase', relativePath = null) => ({ kind, portfolioId: 'thoughtseed', folder, relativePath })
const source = (observations = [{ repository: repository(), local: local() }]) => ({
  schema: 'thoughtseed.repository-intake-source.v1', observedAt: '2026-09-07T00:00:00Z',
  cutoffAt: '2026-08-08T00:00:00Z', rootMapDigest: snapshotDigest(roots),
  collection: { local: 'complete', remote: 'complete' },
  observations: observations.map((row) => ({ activityKind: 'unknown', activityAt: null, ...row })),
})
const identitySource = () => ({
  ...source(reviewedMappings.map((mapping) => ({ repository: repository(mapping.fullName, mapping.repositoryId), local: null }))),
  identityMappings: structuredClone(reviewedMappings),
})

test('reviewed immutable identities project only their selected existing work with receipt provenance', () => {
  const input = identitySource()
  const before = JSON.stringify({ input, roots, mappingReceipts })
  const output = compileRepositoryIntake(input, roots, mappingReceipts)
  for (const mapping of reviewedMappings) {
    const row = output.observations.find((entry) => entry.repository.repositoryId === mapping.repositoryId)
    assert.equal(row.classification, 'mapped')
    assert.deepEqual(row.proposal.workIds, [mapping.workObjectId])
    assert.equal(row.proposal.status, 'mapping-proposal')
    assert.deepEqual(row.proposal.evidence, { kind: 'reviewed-repository-identity', receiptId: mapping.receiptId,
      contentDigest: mapping.contentDigest, receiptStatus: 'prepared' })
    assert.equal(row.local, null)
    assert.equal(row.proposal.folder, null)
    assert.equal(row.proposal.nestedRelativePath, null)
    assert.equal(row.proposal.displayName, mapping.fullName.split('/')[1])
    assert.ok(row.gaps.includes('local-observation-unavailable'))
    assert.ok(!row.gaps.includes('root-map-proposal-unavailable'))
  }
  assert.equal(output.authority, 'observation-only')
  assert.ok(!JSON.stringify(output).includes('panaroma-webapp'))
  assert.equal(output.complete, false)
  assert.equal(JSON.stringify({ input, roots, mappingReceipts }), before)
})

test('legacy remote observations gain no implicit mappings; declarations and observations sort deterministically', () => {
  const input = identitySource()
  const reversed = structuredClone(input)
  reversed.identityMappings.reverse()
  reversed.observations.reverse()
  assert.equal(renderRepositoryIntake(input, roots), renderRepositoryIntake(reversed, roots))
  delete reversed.identityMappings
  assert.ok(compileRepositoryIntake(reversed, roots).observations.every((row) => row.proposal === null))
  reversed.identityMappings = []
  assert.ok(compileRepositoryIntake(reversed, roots).observations.every((row) => row.proposal === null))
})

test('identity declarations reject mismatched names, IDs, work, receipt pins, duplicate and injected fields', () => {
  for (const mutate of [
    (input) => { input.identityMappings[0].fullName = 'Other/fitcheck-landing' },
    (input) => { input.identityMappings[0].repositoryId = 'R_OTHER' },
    (input) => { input.identityMappings[0].repositoryId = null },
    (input) => { input.identityMappings[0].workObjectId = 'sapling:iverif' },
    (input) => { input.identityMappings[0].receiptId = reviewedMappings[1].receiptId },
    (input) => { input.identityMappings[0].contentDigest = `sha256:${'0'.repeat(64)}` },
    (input) => { input.identityMappings.push(structuredClone(input.identityMappings[0])) },
    (input) => { input.identityMappings[0].local = local() },
    (input) => { input.identityMappings = null },
    (input) => { input.observations[0].repository.nodeId = 'R_OTHER' },
    (input) => { input.observations[0].repository.repositoryId = null },
    (input) => { input.observations.shift() },
  ]) {
    const input = identitySource()
    mutate(input)
    assert.throws(() => compileRepositoryIntake(input, roots))
  }
})

test('matching source and observation still cannot bypass receipt repository identity binding', () => {
  for (const field of ['fullName', 'repositoryId']) {
    const input = identitySource()
    input.identityMappings[0][field] = field === 'fullName' ? 'Other/fitcheck-landing' : 'R_OTHER'
    input.observations[0].repository[field] = input.identityMappings[0][field]
    if (field === 'repositoryId') input.observations[0].repository.nodeId = 'R_OTHER'
    assert.throws(() => compileRepositoryIntake(input, roots), /receipt identity or digest mismatch/)
  }
})

test('receipt lookup rejects missing, ambiguous, modified, or unreviewed checked-in evidence', () => {
  const firstId = reviewedMappings[0].receiptId
  for (const mutate of [
    (bundle, receipt) => { bundle.receipts = bundle.receipts.filter((row) => row !== receipt) },
    (bundle, receipt) => { bundle.receipts.push(structuredClone(receipt)) },
    (_bundle, receipt) => { receipt.repository.nameWithOwner = 'Other/fitcheck-landing' },
    (_bundle, receipt) => { receipt.workObjectId = 'sapling:iverif' },
    (_bundle, receipt) => { receipt.lifecycle = 'modified-without-new-digest' },
    (_bundle, receipt) => { receipt.contentDigest = `sha256:${'0'.repeat(64)}` },
    (_bundle, receipt) => { receipt.decision = 'hold' },
    (_bundle, receipt) => { receipt.status = 'issued' },
    (_bundle, receipt) => { receipt.idempotencyKey = 'different' },
    (bundle) => { bundle.founderApprovalId = 'different' },
  ]) {
    const bundle = structuredClone(mappingReceipts)
    mutate(bundle, bundle.receipts.find((row) => row.receiptId === firstId))
    assert.throws(() => compileRepositoryIntake(identitySource(), roots, bundle))
  }
})

test('receipt identity cannot reopen held or changed roots even with refreshed source digest', () => {
  for (const mutate of [
    (folder) => { folder.status = 'awaiting-ingestion' },
    (folder) => { folder.workIds = ['sapling:iverif'] },
    (folder) => { folder.accountId = 'codigo-olimpo' },
    (folder) => { folder.folder = 'renamed-fitcheck-root' },
  ]) {
    const changedRoots = structuredClone(roots)
    mutate(changedRoots.portfolios.find((row) => row.portfolioId === 'thoughtseed').folders.find((row) => row.folder === 'fitcheck-landing'))
    const input = identitySource()
    input.rootMapDigest = snapshotDigest(changedRoots)
    assert.throws(() => compileRepositoryIntake(input, changedRoots), /root proposal held or changed/)
  }
})

test('identity declarations cannot override observed exclusions, dependencies, or local held roots', () => {
  for (const observedLocal of [
    { kind: 'infrastructure', portfolioId: null, folder: null, relativePath: null },
    { kind: 'external-root', portfolioId: null, folder: null, relativePath: null },
    local('nested-dependency', 'codigo', 'research/Dependency'),
    local('portfolio-root', 'session-atlas'),
  ]) {
    const input = identitySource()
    input.observations[0].local = observedLocal
    assert.throws(() => compileRepositoryIntake(input, roots), /matching remote observation/)
  }
})

test('exact root and nested tuples preserve existing proposal identity without mutation', () => {
  const input = source([{ repository: repository(), local: local() }, { repository: repository('Example/Decodik', 'R_DECODIK'), local: local('nested-application', 'codigo', 'research/Decodik') }])
  const before = JSON.stringify({ input, roots })
  const output = compileRepositoryIntake(input, roots)
  assert.equal(output.schema, 'thoughtseed.repository-intake-observations.v1')
  assert.equal(output.authority, 'observation-only')
  const website = output.observations.find((row) => row.proposal?.displayName === 'Cambium Website')
  assert.equal(website.classification, 'mapped')
  assert.deepEqual(website.proposal.workIds, ['sapling:cambium'])
  const decodik = output.observations.find((row) => row.proposal?.displayName === 'Decodik')
  assert.equal(decodik.classification, 'mapped')
  assert.equal(decodik.proposal.accountId, 'codigo-olimpo')
  assert.equal(decodik.proposal.status, 'mapping-proposal')
  assert.deepEqual(decodik.proposal.workIds, ['branch:codigo-olimpo', 'branch:codigo-olimpo-creator-platform'])
  assert.equal(JSON.stringify({ input, roots }), before)
})

test('remote-only, dependencies, external roots, infrastructure and unknown paths gain no bindings', () => {
  const observations = [
    { repository: repository('Example/Remote', 'R_REMOTE'), local: null },
    { repository: null, local: local('nested-dependency', 'codigo', 'research/Dependency') },
    { repository: repository('Example/External', 'R_EXTERNAL'), local: { kind: 'external-root', portfolioId: null, folder: null, relativePath: null } },
    { repository: null, local: local('portfolio-root', 'cambium-website-semantics') },
    { repository: null, local: local('nested-application', 'codigo', 'research/Unknown') },
  ]
  const output = compileRepositoryIntake(source(observations), roots)
  assert.deepEqual(output.observations.map((row) => row.classification).sort(), ['awaiting-ingestion', 'awaiting-ingestion', 'awaiting-ingestion', 'external-root', 'nested-dependency'])
  assert.ok(output.observations.every((row) => row.proposal === null))
})

test('partial collection and missing immutable metadata remain explicit gaps', () => {
  const input = source([{ repository: repository('Example/Website', null), local: local() }])
  input.collection = { local: 'partial', remote: 'unavailable' }
  const output = compileRepositoryIntake(input, roots)
  assert.equal(output.complete, false)
  assert.deepEqual(output.collection, input.collection)
  assert.ok(output.observations[0].gaps.includes('immutable-id-unavailable'))
  assert.ok(output.gaps.includes('local-collection-partial'))
  assert.ok(output.gaps.includes('remote-collection-unavailable'))
})

test('activity provenance binds the requested window and rejects malformed or out-of-window timestamps', () => {
  const input = source([{ repository: repository(), local: local(), activityKind: 'local-branch', activityAt: '2026-08-08T00:00:00Z' }])
  const output = compileRepositoryIntake(input, roots)
  assert.equal(output.cutoffAt, input.cutoffAt)
  assert.equal(output.observations[0].activityAt, input.cutoffAt)
  assert.equal(output.observations[0].activityKind, 'local-branch')
  for (const activityAt of ['2026-08-07T23:59:59Z', '2026-09-08T00:00:00Z', '2026-09-07', '2026-09-07T00:00:00+00:00', '2026-02-30T00:00:00Z', null]) {
    const invalid = structuredClone(input)
    invalid.observations[0].activityAt = activityAt
    assert.throws(() => compileRepositoryIntake(invalid, roots))
  }
  for (const cutoffAt of ['yesterday', '2026-09-08T00:00:00Z', null]) {
    assert.throws(() => compileRepositoryIntake({ ...input, cutoffAt }, roots))
  }
  for (const activityKind of ['unknown', 'invented', null]) {
    const invalid = structuredClone(input)
    invalid.observations[0].activityKind = activityKind
    assert.throws(() => compileRepositoryIntake(invalid, roots))
  }
  const unknown = compileRepositoryIntake(source(), roots).observations[0]
  assert.equal(unknown.activityAt, null)
  assert.ok(unknown.gaps.includes('activity-unavailable'))
})

test('remaining awaiting-ingestion roots stay held without candidate bindings', () => {
  for (const folder of ['somatic-canticles-book', 'somatic-canticles-webapp']) {
    const portfolio = roots.portfolios.find((entry) => entry.folders.some((row) => row.folder === folder))
    const mapped = portfolio.folders.find((row) => row.folder === folder)
    assert.equal(mapped.status, 'awaiting-ingestion')
    assert.deepEqual(mapped.workIds, [])
    const output = compileRepositoryIntake(source([{ repository: repository(), local: { ...local('portfolio-root', folder), portfolioId: portfolio.portfolioId } }]), roots).observations[0]
    assert.equal(output.classification, 'awaiting-ingestion')
    assert.equal(output.proposal, null)
    assert.ok(output.gaps.includes('root-map-proposal-held'))
  }
})

test('infrastructure and undeclared nested host observations never invent portfolio tuples', () => {
  for (const kind of ['infrastructure', 'undeclared-nested']) {
    const input = source([{ repository: repository(), local: { kind, portfolioId: null, folder: null, relativePath: null } }])
    const row = compileRepositoryIntake(input, roots).observations[0]
    assert.equal(row.classification, kind)
    assert.equal(row.proposal, null)
    assert.ok(row.gaps.includes(`${kind}-observation-only`))
    input.observations[0].local.folder = 'codigo'
    assert.throws(() => compileRepositoryIntake(input, roots))
  }
})

test('explicit profile README exclusion has no placement or WorkObject binding', () => {
  const input = source([{ repository: repository('Example/Example'), local: { kind: 'excluded-profile', portfolioId: null, folder: null, relativePath: null } }])
  const row = compileRepositoryIntake(input, roots).observations[0]
  assert.equal(row.classification, 'excluded-profile')
  assert.equal(row.proposal, null)
  assert.ok(row.gaps.includes('github-profile-readme-excluded'))
  input.observations[0].repository.fullName = 'Example/Project'
  assert.throws(() => compileRepositoryIntake(input, roots), /profile/)
})

test('ordering, source digest and rendered bytes are deterministic', () => {
  const input = source([{ repository: repository(), local: local() }, { repository: repository('Example/Other', 'R_OTHER'), local: null }])
  const reversed = structuredClone(input)
  reversed.observations.reverse()
  assert.equal(renderRepositoryIntake(input, roots), renderRepositoryIntake(reversed, roots))
  const output = compileRepositoryIntake(input, roots)
  assert.match(output.sourceDigest, /^[a-f0-9]{64}$/)
  assert.match(output.observationDigest, /^[a-f0-9]{64}$/)
  reversed.observedAt = '2026-09-07T01:00:00Z'
  assert.notEqual(compileRepositoryIntake(reversed, roots).sourceDigest, output.sourceDigest)
})

test('closed source rejects malformed identities, unsafe paths, duplicate locations, and digest drift', () => {
  for (const fullName of ['../escape', 'Example/..', '/absolute', 'https://github.com/A/B', 'Example/a?token=x', 'Example/ghp_secret', 'Example/a/b']) {
    assert.throws(() => validateIntakeSource(source([{ repository: repository(fullName), local: null }]), roots))
  }
  for (const relativePath of ['/absolute', '../Decodik', 'a/../b', 'a//b', 'a\\b', '.', 'a/']) {
    assert.throws(() => validateIntakeSource(source([{ repository: null, local: local('nested-application', 'codigo', relativePath) }]), roots))
  }
  for (const mutate of [
    (input) => { input.rootMapDigest = '0'.repeat(64) },
    (input) => { input.observations.push(structuredClone(input.observations[0])) },
    (input) => { input.observations[0].repository.token = 'private' },
    (input) => { input.observations[0].local.portfolioId = 'unknown' },
    (input) => { input.observations[0].local.folder = '..' },
    (input) => { input.observations[0].local.relativePath = 'unexpected' },
    (input) => { input.schema = 'future' },
    (input) => { input.observedAt = 'yesterday' },
    (input) => { input.collection.local = 'ready' },
  ]) { const input = source(); mutate(input); assert.throws(() => validateIntakeSource(input, roots)) }
})

test('identity conflicts are rejected but separate checkouts of one identity are allowed', () => {
  assert.throws(() => compileRepositoryIntake(source([
    { repository: repository('Example/One', 'R_SAME'), local: null },
    { repository: repository('Example/Two', 'R_SAME'), local: null },
  ]), roots), /identity conflict/)
  assert.throws(() => compileRepositoryIntake(source([
    { repository: repository('Example/One', 'R_ONE'), local: null },
    { repository: repository('example/one', 'R_TWO'), local: local() },
  ]), roots), /identity conflict/)
  assert.equal(compileRepositoryIntake(source([
    { repository: repository(), local: local() },
    { repository: repository(), local: local('portfolio-root', 'cambium') },
  ]), roots).observations.length, 2)
})

test('mapping is exact and root-map content drift invalidates the captured source', () => {
  const wrongCase = source([{ repository: null, local: local('nested-application', 'codigo', 'research/decodik') }])
  assert.equal(compileRepositoryIntake(wrongCase, roots).observations[0].classification, 'awaiting-ingestion')
  const drifted = structuredClone(roots)
  drifted.portfolios[0].folders.find((row) => row.folder === 'codigo').displayName = 'Changed'
  assert.throws(() => compileRepositoryIntake(source(), drifted), /digest drift/)
  const invalid = source()
  invalid.observations[0].local.workIds = ['branch:invented']
  assert.throws(() => compileRepositoryIntake(invalid, roots), /fields/)
})

test('observations do not alter legacy evidence resolution or widen existing inventory', () => {
  const inventory = [{ fullName: 'Legacy/shared', repositoryId: 'R_LEGACY' }]
  const before = resolveRepositoryEvidence(['repo:shared', 'repo:Website'], [], inventory)
  compileRepositoryIntake(source([{ repository: repository('Observed/shared', 'R_NEW'), local: null }, { repository: repository(), local: local() }]), roots)
  assert.deepEqual(resolveRepositoryEvidence(['repo:shared', 'repo:Website'], [], inventory), before)
  assert.equal(before.find((row) => row.sourceRef === 'repo:Website').status, 'unmatched')
  assert.equal(inventory.length, 1)
})

test('CLI import/check never writes; explicit output write is bounded to the declared temp file', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'repository-intake-'))
  try {
    const inputPath = path.join(directory, 'input.json')
    const outputPath = path.join(directory, 'output.json')
    await writeFile(inputPath, JSON.stringify(source()))
    const run = (args) => execFileSync(process.execPath, [script, '--input', inputPath, '--root-map', rootPath, ...args], { encoding: 'utf8', cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] })
    execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('./repository-intake.mjs', import.meta.url).href)})`], { cwd: directory })
    assert.equal(JSON.parse(run([])).authority, 'observation-only')
    run(['--check'])
    assert.deepEqual(await readdir(directory), ['input.json'])
    assert.throws(() => run(['--write']))
    assert.throws(() => run(['--output', outputPath]))
    assert.throws(() => run(['--write', '--output', inputPath]))
    assert.throws(() => run(['--check', '--write', '--output', outputPath]))
    await symlink(inputPath, outputPath)
    assert.throws(() => run(['--write', '--output', outputPath]))
    await rm(outputPath)
    await link(inputPath, outputPath)
    assert.throws(() => run(['--write', '--output', outputPath]))
    await rm(outputPath)
    assert.equal(await readFile(inputPath, 'utf8'), JSON.stringify(source()))
    run(['--write', '--output', outputPath])
    assert.equal(await readFile(outputPath, 'utf8'), renderRepositoryIntake(source(), roots))
    assert.deepEqual((await readdir(directory)).sort(), ['input.json', 'output.json'])
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('historical committed intake renders exactly against its original root snapshot', async () => {
  const currentSource = JSON.parse(await readFile(currentSourcePath, 'utf8'))
  const currentOutput = await readFile(currentOutputPath, 'utf8')
  const compiled = compileRepositoryIntake(currentSource, roots)
  assert.equal(renderRepositoryIntake(currentSource, roots), currentOutput)
  assert.equal(compiled.authority, 'observation-only')
  assert.equal(compiled.observations.length, 41)
  const cambiumWebsite = compiled.observations.find((row) => row.proposal?.displayName === 'Cambium Website')
  assert.equal(cambiumWebsite?.classification, 'mapped')
  assert.equal(cambiumWebsite?.repository, null)
  assert.ok(cambiumWebsite?.gaps.includes('repository-identity-unavailable'))
  const decodik = compiled.observations.find((row) => row.proposal?.displayName === 'Decodik')
  assert.equal(decodik?.classification, 'mapped')
  assert.deepEqual(decodik?.proposal?.workIds, ['branch:codigo-olimpo', 'branch:codigo-olimpo-creator-platform'])
  const sessionAtlas = compiled.observations.find((row) => row.repository?.fullName === 'Sheshiyer/session-atlas')
  assert.equal(sessionAtlas?.classification, 'mapped')
  assert.deepEqual(sessionAtlas.proposal.workIds, ['program:session-atlas'])
  assert.equal(sessionAtlas.proposal.identityStatus, 'reviewed-local-node')
  for (const decision of currentSource.ownershipDecisions) {
    const row = compiled.observations.find((entry) => entry.repository?.repositoryId === decision.repositoryId)
    assert.equal(row.classification, 'mapped')
    assert.deepEqual(row.proposal.workIds, [decision.workObjectId])
    assert.equal(row.proposal.ownership, decision.ownership)
    assert.equal(row.proposal.relationship, decision.relationship)
    assert.equal(row.proposal.relatedWorkId, decision.relatedWorkId)
    assert.equal(row.proposal.accountId, null)
    assert.equal(row.proposal.evidence.kind, 'reviewed-owner-decision')
    assert.equal(row.proposal.evidence.status, 'reviewed-local')
    if (decision.repositoryId !== 'R_kgDOUAjRiQ') {
      assert.equal(row.local, null)
      assert.equal(row.proposal.folder, null)
      assert.ok(row.gaps.includes('local-observation-unavailable'))
    }
  }
  assert.deepEqual(currentSource.identityMappings, reviewedMappings)
  assert.equal(compiled.observations.filter((row) => row.proposal?.evidence?.kind === 'reviewed-repository-identity').length, 3)
})

test('historical intake cannot silently adopt the refreshed physical census', async () => {
  const historicalSource = JSON.parse(await readFile(currentSourcePath, 'utf8'))
  const currentRoots = JSON.parse(await readFile(currentRootPath, 'utf8'))
  assert.equal(snapshotDigest(roots), historicalSource.rootMapDigest)
  assert.notEqual(snapshotDigest(currentRoots), historicalSource.rootMapDigest)
  assert.throws(() => compileRepositoryIntake(historicalSource, currentRoots), /Root-map digest drift/)
  const currentObservation = source([{ repository: repository(), local: local('portfolio-root', 'cambium-showcase-ui-rebuild') }])
  currentObservation.rootMapDigest = snapshotDigest(currentRoots)
  currentObservation.observedAt = currentRoots.portfolios[0].censusObservedAt
  const current = compileRepositoryIntake(currentObservation, currentRoots)
  assert.equal(current.authority, 'observation-only')
  assert.equal(current.observations[0].proposal.folder, 'cambium-showcase-ui-rebuild')
  assert.deepEqual(current.observations[0].proposal.workIds, ['sapling:cambium'])
  const staleObservation = structuredClone(currentObservation)
  staleObservation.observations[0].local.folder = 'cambium-telegram-showcase'
  const stale = compileRepositoryIntake(staleObservation, currentRoots).observations[0]
  assert.equal(stale.classification, 'awaiting-ingestion')
  assert.equal(stale.proposal, null)
  assert.ok(stale.gaps.includes('root-map-proposal-unavailable'))
})


test('owner decisions reject conflicting identity, placement, relationship, authority and extra fields', async () => {
  const original = JSON.parse(await readFile(currentSourcePath, 'utf8'))
  for (const mutate of [
    (s) => { s.ownershipDecisions.push(s.ownershipDecisions[0]) },
    (s) => { s.ownershipDecisions[0].repositoryId = 'R_OTHER' },
    (s) => { s.observations.find((r) => r.repository?.repositoryId === 'R_kgDOS1oGpg').local = { kind: 'infrastructure', portfolioId: null, folder: null, relativePath: null } },
    (s) => { s.ownershipDecisions[0].workObjectId = 'sapling:cambium' },
    (s) => { s.ownershipDecisions[0].portfolioId = 'tryambakam-noesis' },
    (s) => { s.ownershipDecisions[0].status = 'issued' },
    (s) => { s.ownershipDecisions[0].folder = 'invented' },
    (s) => { s.ownershipDecisions[3].ownership = 'thoughtseed' },
    (s) => { s.ownershipDecisions[0].relatedWorkId = 'program:session-atlas' },
  ]) {
    const changed = structuredClone(original)
    mutate(changed)
    assert.throws(() => compileRepositoryIntake(changed, roots))
  }
  const reversed = structuredClone(original)
  reversed.ownershipDecisions.reverse()
  reversed.observations.reverse()
  assert.deepEqual(compileRepositoryIntake(reversed, roots), compileRepositoryIntake(original, roots))
})


test('owner decisions cannot override a held exact local folder using another eligible root', async () => {
  const input = JSON.parse(await readFile(currentSourcePath, 'utf8'))
  const changed = structuredClone(roots)
  const portfolio = changed.portfolios[0]
  const folder = portfolio.folders.find((entry) => entry.folder === 'session-atlas')
  portfolio.folders.find((entry) => entry.folder === 'meristem').workIds.push('program:session-atlas')
  folder.status = 'awaiting-ingestion'
  input.rootMapDigest = snapshotDigest(changed)
  assert.throws(() => compileRepositoryIntake(input, changed), /conflicts with local root mapping/)
})
