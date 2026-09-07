import { createHash } from 'node:crypto'
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { snapshotDigest, stableJson, validateSnapshot } from './generate-portfolio-root-map.mjs'

export const INTAKE_SOURCE_SCHEMA = 'thoughtseed.repository-intake-source.v1'
export const INTAKE_OBSERVATION_SCHEMA = 'thoughtseed.repository-intake-observations.v1'
const collectionStates = new Set(['complete', 'partial', 'unavailable'])
const unplacedKinds = new Set(['external-root', 'infrastructure', 'undeclared-nested', 'excluded-profile'])
const localKinds = new Set(['portfolio-root', 'nested-application', 'nested-dependency', ...unplacedKinds])
const activityKinds = new Set(['github-push', 'github-created', 'local-branch', 'unknown'])
const unsafeIdentity = /(?:^|[/._-])(?:ghp_|github_pat_|x-access-token|oauth(?:[/._:-]|$))/i
const segment = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const identityId = /^[A-Za-z0-9_=-]{1,200}$/
const digest = (value) => createHash('sha256').update(JSON.stringify(stableJson(value))).digest('hex')
const canonical = (value) => JSON.stringify(stableJson(value))
const compare = (left, right) => canonical(left) < canonical(right) ? -1 : canonical(left) > canonical(right) ? 1 : 0

function closed(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new TypeError(`Invalid ${label} fields`)
  }
}

function safeRelative(value, label) {
  if (typeof value !== 'string' || value.length > 256 || !value.split('/').every((part) => segment.test(part))) {
    throw new TypeError(`Unsafe ${label}`)
  }
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().replace('.000Z', 'Z') !== value.replace('.000Z', 'Z')) {
    throw new TypeError(`Invalid ${label} timestamp`)
  }
  return Date.parse(value)
}

function validateRepository(value) {
  if (value === null) return
  closed(value, ['fullName', 'repositoryId', 'nodeId'], 'repository')
  if (typeof value.fullName !== 'string' || value.fullName.length > 200 ||
    value.fullName.split('/').length !== 2 || !value.fullName.split('/').every((part) => segment.test(part)) || unsafeIdentity.test(value.fullName)) {
    throw new TypeError('Unsafe repository identity')
  }
  for (const key of ['repositoryId', 'nodeId']) {
    if (value[key] !== null && (typeof value[key] !== 'string' || !identityId.test(value[key]) || unsafeIdentity.test(value[key]))) {
      throw new TypeError(`Invalid ${key}`)
    }
  }
}

function validateLocal(value, portfolios) {
  if (value === null) return
  closed(value, ['kind', 'portfolioId', 'folder', 'relativePath'], 'local observation')
  if (!localKinds.has(value.kind)) throw new TypeError('Invalid local observation kind')
  if (unplacedKinds.has(value.kind)) {
    if (value.portfolioId !== null || value.folder !== null || value.relativePath !== null) throw new TypeError('Unplaced observation cannot carry portfolio placement or paths')
    return
  }
  if (!portfolios.has(value.portfolioId)) throw new TypeError('Unknown local portfolio')
  safeRelative(value.folder, 'folder')
  if (value.folder.includes('/')) throw new TypeError('Folder must be shallow')
  if (value.kind === 'portfolio-root') {
    if (value.relativePath !== null) throw new TypeError('Root observation cannot carry nested path')
  } else {
    safeRelative(value.relativePath, 'nested path')
  }
}

/** Validate declarations only: this function performs no Git, filesystem, or network observation. */
export function validateIntakeSource(source, rootMap) {
  validateSnapshot(rootMap)
  closed(source, ['schema', 'observedAt', 'cutoffAt', 'rootMapDigest', 'collection', 'observations'], 'source envelope')
  if (source.schema !== INTAKE_SOURCE_SCHEMA) throw new TypeError('Unsupported intake source schema')
  const observedAt = timestamp(source.observedAt, 'observation')
  const cutoffAt = timestamp(source.cutoffAt, 'cutoff')
  if (cutoffAt > observedAt) throw new TypeError('Cutoff exceeds observation timestamp')
  if (source.rootMapDigest !== snapshotDigest(rootMap)) throw new TypeError('Root-map digest drift')
  closed(source.collection, ['local', 'remote'], 'collection')
  if (!Object.values(source.collection).every((value) => collectionStates.has(value))) throw new TypeError('Invalid collection state')
  if (!Array.isArray(source.observations) || source.observations.length > 2000) throw new TypeError('Invalid observations')
  const portfolios = new Set(rootMap.portfolios.map((portfolio) => portfolio.portfolioId))
  const locations = new Set()
  const idsByName = new Map()
  const namesById = new Map()
  for (const row of source.observations) {
    closed(row, ['repository', 'local', 'activityKind', 'activityAt'], 'observation')
    validateRepository(row.repository)
    validateLocal(row.local, portfolios)
    if (row.local?.kind === 'excluded-profile') {
      const parts = row.repository?.fullName.toLowerCase().split('/')
      if (!parts || parts[0] !== parts[1]) throw new TypeError('Excluded profile must identify an owner/owner profile repository')
    }
    if (!activityKinds.has(row.activityKind)) throw new TypeError('Invalid activity kind')
    if (row.activityKind === 'unknown') {
      if (row.activityAt !== null) throw new TypeError('Unknown activity must use null timestamp')
    } else {
      const activityAt = timestamp(row.activityAt, 'activity')
      if (activityAt < cutoffAt || activityAt > observedAt) throw new TypeError('Activity timestamp outside observation window')
    }
    if (row.repository === null && row.local === null) throw new TypeError('Empty observation')
    // A source reports one repository at a local tuple. Multiple checkouts of one
    // immutable identity remain separate observations, never inventory rows.
    const location = unplacedKinds.has(row.local?.kind) || row.local === null
      ? `${row.local?.kind ?? 'remote'}:${row.repository?.fullName.toLowerCase() ?? ''}`
      : `${row.local.portfolioId}/${row.local.folder}/${row.local.relativePath ?? ''}`.toLowerCase()
    if (locations.has(location)) throw new TypeError('Duplicate observation location')
    locations.add(location)
    if (row.repository) {
      const name = row.repository.fullName.toLowerCase()
      for (const field of ['repositoryId', 'nodeId']) {
        const id = row.repository[field]
        if (id === null) continue
        const nameKey = `${field}:${name}`
        const idKey = `${field}:${id}`
        if ((idsByName.has(nameKey) && idsByName.get(nameKey) !== id) || (namesById.has(idKey) && namesById.get(idKey) !== name)) {
          throw new TypeError('Repository identity conflict')
        }
        idsByName.set(nameKey, id)
        namesById.set(idKey, name)
      }
    }
  }
  return source
}

function reconcile(row, rootMap) {
  const local = row.local
  let proposal = null
  let classification = 'awaiting-ingestion'
  let held = false
  if (unplacedKinds.has(local?.kind)) classification = local.kind
  else if (local?.kind === 'nested-dependency') classification = 'nested-dependency'
  else if (local) {
    const portfolio = rootMap.portfolios.find((entry) => entry.portfolioId === local.portfolioId)
    const folder = portfolio.folders.find((entry) => entry.folder === local.folder)
    const mapped = local.kind === 'portfolio-root' ? folder : folder?.nestedRepositories?.find((entry) => entry.relativePath === local.relativePath)
    if (mapped) {
      if (mapped.workIds.some((id) => !/^(sapling|branch|program):[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id))) {
        throw new TypeError('Invalid root-map proposal evidence')
      }
      if (folder.status === 'mapping-proposal' && mapped.workIds.length > 0) {
        classification = 'mapped'
        proposal = {
          portfolioId: local.portfolioId, folder: local.folder, nestedRelativePath: local.relativePath,
          displayName: mapped.displayName ?? folder.folder, accountId: folder.accountId,
          workIds: [...mapped.workIds], status: 'mapping-proposal',
        }
      } else {
        held = true
      }
    }
  }
  const gaps = []
  if (row.activityKind === 'unknown') gaps.push('activity-unavailable')
  if (!row.repository) gaps.push('repository-identity-unavailable')
  else if (!row.repository.repositoryId) gaps.push('immutable-id-unavailable')
  if (!local) gaps.push('local-observation-unavailable')
  if (classification === 'awaiting-ingestion') gaps.push(held ? 'root-map-proposal-held' : 'root-map-proposal-unavailable')
  if (classification === 'infrastructure' || classification === 'undeclared-nested') gaps.push(`${classification}-observation-only`)
  if (classification === 'excluded-profile') gaps.push('github-profile-readme-excluded')
  return { ...structuredClone(row), classification, proposal, gaps }
}

/** Compile a separate evidence projection; it never supplies reconciliation authority. */
export function compileRepositoryIntake(source, rootMap) {
  validateIntakeSource(source, rootMap)
  const normalized = { ...structuredClone(source), observations: [...source.observations].sort(compare) }
  const observations = normalized.observations.map((row) => reconcile(row, rootMap)).sort(compare)
  const gaps = Object.entries(source.collection).filter(([, value]) => value !== 'complete').map(([key, value]) => `${key}-collection-${value}`)
  return {
    schema: INTAKE_OBSERVATION_SCHEMA, authority: 'observation-only', observedAt: source.observedAt, cutoffAt: source.cutoffAt,
    rootMapDigest: source.rootMapDigest, sourceDigest: digest(normalized), observationDigest: digest(observations),
    collection: { ...source.collection }, complete: gaps.length === 0 && observations.every((row) => row.gaps.length === 0),
    gaps, observations,
  }
}

export function renderRepositoryIntake(source, rootMap) {
  return `${JSON.stringify(compileRepositoryIntake(source, rootMap), null, 2)}\n`
}

function parseArgs(argv) {
  const args = { write: false, check: false }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--write' || flag === '--check') {
      if (args[flag.slice(2)]) throw new TypeError(`Duplicate ${flag}`)
      args[flag.slice(2)] = true
    } else if (['--input', '--root-map', '--output'].includes(flag)) {
      if (Object.hasOwn(args, flag.slice(2)) || !argv[index + 1] || argv[index + 1].startsWith('--')) throw new TypeError(`Invalid ${flag}`)
      args[flag.slice(2)] = argv[++index]
    } else throw new TypeError(`Unknown option ${flag}`)
  }
  if (!args.input || !args['root-map']) throw new TypeError('Required: --input SOURCE.json --root-map ROOTS.json')
  if (args.write !== Boolean(args.output) || (args.write && args.check)) throw new TypeError('Use --write --output TARGET.json together; --check never writes')
  return args
}

async function main(argv) {
  const args = parseArgs(argv)
  const inputPath = await realpath(args.input)
  const rootMapPath = await realpath(args['root-map'])
  const source = JSON.parse(await readFile(inputPath, 'utf8'))
  const rootMap = JSON.parse(await readFile(rootMapPath, 'utf8'))
  const rendered = renderRepositoryIntake(source, rootMap)
  if (args.write) {
    const outputPath = path.join(await realpath(path.dirname(path.resolve(args.output))), path.basename(args.output))
    if ([inputPath, rootMapPath].includes(outputPath)) throw new TypeError('Output cannot overwrite source or root map')
    try {
      const info = await lstat(outputPath)
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new TypeError('Output must be a regular non-linked file')
    } catch (error) { if (error.code !== 'ENOENT') throw error }
    await writeFile(outputPath, rendered, 'utf8')
  }
  if (!args.check) process.stdout.write(rendered)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)) } catch (error) {
    process.stderr.write(`repository intake: ${error.message}\n`)
    process.exitCode = 1
  }
}
