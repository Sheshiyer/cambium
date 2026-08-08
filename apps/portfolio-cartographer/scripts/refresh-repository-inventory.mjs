import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(root, '../..')
const sourcePath = path.join(root, 'src/repository-inventory.generated.ts')
const queuePath = path.join(repositoryRoot, 'docs/project-management/github-repository-mapping-action-queue.v1.json')
const allowUnresolved = process.argv.includes('--allow-unresolved')
const refreshAll = process.argv.includes('--refresh-all')
const repositoryListKeys = new Set([
  'branchRepos',
  'candidateRepos',
  'excludedFalsePositiveRepos',
  'holdRepos',
  'mappedRepos',
])
const qualifiedRepository = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/

function compareRepository(left, right) {
  return left.fullName.localeCompare(right.fullName, 'en', { sensitivity: 'base' })
}

function collectQueueRepositories(value, parentKey = '') {
  if (Array.isArray(value)) {
    if (repositoryListKeys.has(parentKey)) {
      return value.filter((entry) => typeof entry === 'string' && qualifiedRepository.test(entry))
    }
    return value.flatMap((entry) => collectQueueRepositories(entry))
  }
  if (!value || typeof value !== 'object') return []
  const repositories = []
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'repository' && typeof entry === 'string' && qualifiedRepository.test(entry)) {
      repositories.push(entry)
      continue
    }
    repositories.push(...collectQueueRepositories(entry, key))
  }
  return repositories
}

function fetchRepository(fullName) {
  try {
    const raw = execFileSync('gh', ['api', `repos/${fullName}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const repository = JSON.parse(raw)
    return {
      fullName: repository.full_name,
      repositoryId: repository.node_id,
      nodeId: repository.node_id,
      visibility: String(repository.visibility).toUpperCase(),
      defaultBranch: repository.default_branch ?? '',
      archived: Boolean(repository.archived),
      pushedAt: repository.pushed_at ?? null,
      updatedAt: repository.updated_at ?? null,
    }
  } catch {
    return null
  }
}

const queue = JSON.parse(await readFile(queuePath, 'utf8'))
const inventoryModule = await import(`${pathToFileURL(sourcePath).href}?refresh=${Date.now()}`)
const inventoryByName = new Map(
  inventoryModule.REPOSITORY_INVENTORY.map((record) => [record.fullName.toLowerCase(), { ...record }]),
)
const requested = [...new Set(collectQueueRepositories(queue))]
  .sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }))
const unresolved = []
let refreshed = 0

for (const fullName of requested) {
  const key = fullName.toLowerCase()
  if (!refreshAll && inventoryByName.has(key)) continue
  const repository = fetchRepository(fullName)
  if (!repository) {
    if (!inventoryByName.has(key)) unresolved.push(fullName)
    continue
  }
  inventoryByName.set(repository.fullName.toLowerCase(), repository)
  refreshed += 1
}

if (unresolved.length > 0 && !allowUnresolved) {
  console.error(`repository inventory blocked · ${unresolved.length} identities unavailable`)
  for (const fullName of unresolved) console.error(`- ${fullName}`)
  process.exitCode = 2
} else {
  const records = [...inventoryByName.values()].sort(compareRepository)
  const generated = [
    `// Generated from authenticated read-only GitHub metadata on ${new Date().toISOString().slice(0, 10)}.`,
    '// Contains repository identities referenced by the portfolio catalog or mapping queue.',
    `export const REPOSITORY_INVENTORY = ${JSON.stringify(records, null, 2)} as const;`,
    '',
  ].join('\n')
  await writeFile(sourcePath, generated, 'utf8')
  console.log(`repository inventory ok · ${records.length} identities · ${refreshed} refreshed · ${unresolved.length} unavailable`)
  for (const fullName of unresolved) console.log(`unavailable · ${fullName}`)
}
