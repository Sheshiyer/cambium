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
const rootPath = fileURLToPath(new URL('../../../docs/project-management/portfolio-roots.v1.json', import.meta.url))
const currentSourcePath = fileURLToPath(new URL('../../../docs/project-management/repository-intake-source.v1.json', import.meta.url))
const currentOutputPath = fileURLToPath(new URL('../../../docs/project-management/repository-intake.v1.json', import.meta.url))
const roots = JSON.parse(await readFile(rootPath, 'utf8'))
const repository = (fullName = 'Example/Website', repositoryId = 'R_WEBSITE') => ({ fullName, repositoryId, nodeId: repositoryId })
const local = (kind = 'portfolio-root', folder = 'cambium-telegram-showcase', relativePath = null) => ({ kind, portfolioId: 'thoughtseed', folder, relativePath })
const source = (observations = [{ repository: repository(), local: local() }]) => ({
  schema: 'thoughtseed.repository-intake-source.v1', observedAt: '2026-09-07T00:00:00Z',
  cutoffAt: '2026-08-08T00:00:00Z', rootMapDigest: snapshotDigest(roots),
  collection: { local: 'complete', remote: 'complete' },
  observations: observations.map((row) => ({ activityKind: 'unknown', activityAt: null, ...row })),
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

test('exact awaiting-ingestion roots such as session-atlas stay held without candidate bindings', () => {
  for (const folder of ['session-atlas', 'synchronocities-blog']) {
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

test('committed intake snapshot renders exactly and preserves corrected portfolio semantics', async () => {
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
  assert.equal(sessionAtlas?.classification, 'awaiting-ingestion')
  assert.equal(sessionAtlas?.proposal, null)
  assert.ok(sessionAtlas?.gaps.includes('root-map-proposal-held'))
})
