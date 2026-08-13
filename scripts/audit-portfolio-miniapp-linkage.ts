import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { loadBranchStories } from '../bin/quine/hyphae/branch-stories.ts'
import { PORTFOLIO_CATALOG } from '../workers/quests/src/portfolio-catalog.ts'
import { ORGAN_UPDATE_PLAN } from '../workers/quests/src/organ-update-delivery.ts'
import {
  REVIEWED_PORTFOLIO_CATALOG_DIGEST,
  REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST,
  REVIEWED_ROOT_MAP_DIGEST,
} from './portfolio-foundation-pins.mjs'
import { buildPortfolioMiniappLinkageReport } from './portfolio-miniapp-linkage.mjs'

const ROOT_MAP_DIGEST = /PORTFOLIO_ROOT_MAP_DIGEST = "([0-9a-f]{64})"/

function optionValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name.slice(2)}_path_missing`)
  return value
}

async function jsonFile(path: string | undefined): Promise<Record<string, unknown> | undefined> {
  if (!path) return undefined
  const parsed = JSON.parse(await readFile(path, 'utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('comparison_input_invalid')
  return parsed as Record<string, unknown>
}

function liveSnapshotFromEvidence(input: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!input) return undefined
  const live = input.liveWorkbench
  if (live && typeof live === 'object' && !Array.isArray(live)) {
    return {
      schema: 'cambium.portfolio-workbench-observation.v1',
      observedAt: input.observedAt,
      workIds: (live as Record<string, unknown>).workIds,
    }
  }
  return input
}

async function source(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

const [
  appCatalogData,
  workerCatalogData,
  appCatalogModule,
  workerCatalogModule,
  appRootMap,
  workerRootMap,
] = await Promise.all([
  source('../apps/portfolio-cartographer/src/portfolio-catalog-data.ts'),
  source('../workers/quests/src/portfolio-catalog-data.ts'),
  source('../apps/portfolio-cartographer/src/portfolio-catalog.ts'),
  source('../workers/quests/src/portfolio-catalog.ts'),
  source('../apps/portfolio-cartographer/src/portfolio-root-map.generated.ts'),
  source('../workers/quests/src/portfolio-root-map.generated.ts'),
])

const appRootMapDigest = ROOT_MAP_DIGEST.exec(appRootMap)?.[1]
const workerRootMapDigest = ROOT_MAP_DIGEST.exec(workerRootMap)?.[1]
if (!appRootMapDigest || !workerRootMapDigest) throw new Error('portfolio_root_map_digest_missing')

const liveInput = await jsonFile(optionValue('--live-snapshot'))
const vaultRegistry = await jsonFile(optionValue('--vault-registry'))
const rootMap = await jsonFile(fileURLToPath(new URL('../docs/project-management/portfolio-roots.v1.json', import.meta.url)))
const projectsRoot = optionValue('--projects-root')
const observedFolders = projectsRoot
  ? (await readdir(projectsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  : undefined
const report = buildPortfolioMiniappLinkageReport({
  catalog: PORTFOLIO_CATALOG,
  branchStories: loadBranchStories({ root: fileURLToPath(new URL('..', import.meta.url)) }, 'cambium'),
  mirrors: {
    catalogData: appCatalogData === workerCatalogData,
    catalogModule: appCatalogModule === workerCatalogModule,
    rootMap: appRootMapDigest === workerRootMapDigest,
  },
  pins: {
    reviewedRootMapDigest: REVIEWED_ROOT_MAP_DIGEST,
    currentRootMapDigest: appRootMapDigest,
    reviewedCatalogDigest: REVIEWED_PORTFOLIO_CATALOG_DIGEST,
    currentCatalogDigest: PORTFOLIO_CATALOG.catalogDigest,
    reviewedClassificationDigest: REVIEWED_PORTFOLIO_CLASSIFICATION_DIGEST,
    currentClassificationDigest: PORTFOLIO_CATALOG.classificationDigest,
  },
  ...(vaultRegistry ? { vaultRegistry } : {}),
  ...(liveInput ? { liveSnapshot: liveSnapshotFromEvidence(liveInput) } : {}),
  rootMap,
  ...(observedFolders ? { observedFolders } : {}),
  organPlan: ORGAN_UPDATE_PLAN,
})

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (process.argv.includes('--strict') && report.status === 'blocked') process.exitCode = 1
