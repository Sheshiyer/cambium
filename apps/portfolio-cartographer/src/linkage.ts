import {
  PORTFOLIO_CATALOG_DIGEST,
  PORTFOLIO_CLASSIFICATION_DIGEST,
} from '../../../shared/portfolio-catalog-authority.ts'
import { PORTFOLIO_LINKAGE_MANIFEST } from './portfolio-linkage.generated.ts'
import { PORTFOLIO_ROOT_MAP_DIGEST } from './portfolio-root-map.generated.ts'

export interface PortfolioLinkageRow {
  readonly workId: string
  readonly classification: 'sapling' | 'client-branch' | 'internal-program'
  readonly filesystem: {
    readonly state: 'mapped' | 'explicit-folderless-gap'
    readonly folders: readonly string[]
  }
  readonly storyArc: {
    readonly state: 'packet-backed' | 'explicit-unadmitted-gap'
    readonly arcId: string | null
  }
  readonly quests: {
    readonly state: 'packet-backed' | 'explicit-unadmitted-gap'
    readonly count: number
  }
  readonly missionData: {
    readonly state: 'mission-data-needed' | 'catalog-fields-present'
    readonly missingFields: readonly string[]
  }
  readonly organs: {
    readonly state: 'receipt-backed' | 'workflow-available-unassigned'
    readonly linked: readonly string[]
  }
  readonly miniApp: {
    readonly canopy: 'catalog-visible'
    readonly mission: 'packet-projected' | 'explicit-gap'
  }
  readonly telegramTransport: 'hermes-only'
}

if (PORTFOLIO_LINKAGE_MANIFEST.catalogDigest !== PORTFOLIO_CATALOG_DIGEST) {
  throw new Error('Portfolio linkage catalog digest drift')
}
if (PORTFOLIO_LINKAGE_MANIFEST.classificationDigest !== PORTFOLIO_CLASSIFICATION_DIGEST) {
  throw new Error('Portfolio linkage classification digest drift')
}
if (PORTFOLIO_LINKAGE_MANIFEST.rootMapDigest !== PORTFOLIO_ROOT_MAP_DIGEST) {
  throw new Error('Portfolio linkage root-map digest drift')
}

const linkageByWorkId = new Map<string, PortfolioLinkageRow>(
  PORTFOLIO_LINKAGE_MANIFEST.rows.map((row) => [row.workId, row as PortfolioLinkageRow]),
)
if (linkageByWorkId.size !== PORTFOLIO_LINKAGE_MANIFEST.summary.totalWorkObjects) {
  throw new Error('Portfolio linkage WorkObject identity drift')
}

export const PORTFOLIO_LINKAGE_SUMMARY = PORTFOLIO_LINKAGE_MANIFEST.summary

export function portfolioLinkageFor(workId: string): PortfolioLinkageRow {
  const linkage = linkageByWorkId.get(workId)
  if (!linkage) throw new Error(`Unknown portfolio linkage: ${workId}`)
  return linkage
}
