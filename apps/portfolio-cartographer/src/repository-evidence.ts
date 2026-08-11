import { createHash } from 'node:crypto'

export const REPOSITORY_EVIDENCE_SCHEMA = 'thoughtseed.repository-evidence.v1' as const

export type RepositoryMatchMethod = 'relocation-registry' | 'qualified-name' | 'unique-name'
export type RepositoryEvidenceStatus = 'resolved' | 'unverified' | 'ambiguous' | 'unmatched' | 'malformed' | 'unsafe'
export type RepositoryVisibility = 'PUBLIC' | 'PRIVATE' | 'INTERNAL'
export type RepositoryEvidenceGap = 'immutable-id-unavailable' | 'live-metadata-unavailable'

export interface RelocationRegistryEntry {
  stableId: string
  githubIdentity: string
}

export interface RepositoryInventoryRecord {
  fullName: string
  repositoryId?: string | null
  nodeId?: string | null
  visibility?: RepositoryVisibility | null
  defaultBranch?: string | null
  archived?: boolean | null
  pushedAt?: string | null
  updatedAt?: string | null
}

export interface RepositoryEvidenceRecord {
  sourceRef: string
  status: RepositoryEvidenceStatus
  matchMethod: RepositoryMatchMethod | null
  stableId: string | null
  fullName: string | null
  sourcePath: string | null
  url: string | null
  repositoryId: string | null
  nodeId: string | null
  visibility: RepositoryVisibility | null
  defaultBranch: string | null
  archived: boolean | null
  pushedAt: string | null
  updatedAt: string | null
  gaps: readonly RepositoryEvidenceGap[]
  candidates?: readonly string[]
}

const SAFE_ALIAS_RE = /^[A-Za-z0-9._-]+(?:\.[A-Za-z0-9._-]+)*$/
const SAFE_QUALIFIED_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/
const SAFE_PATH_RE = /^[A-Za-z0-9._/-]+$/
const SAFE_NAME_RE = /^[A-Za-z0-9._-]+$/
const UNSAFE_MARKERS = ['http://', 'https://', '?', '#', '&', '=', '@']
const UNSAFE_CREDENTIAL_MARKER = /(?:^|[/._-])(?:ghp_|github_pat_|x-access-token|oauth(?:[/._:-]|$))/i

function compareText(left: string, right: string): number {
  return left.localeCompare(right, 'en', { sensitivity: 'base' })
}

function normalizeSourceRef(sourceRef: string): string {
  return sourceRef.trim()
}

function sourceBody(sourceRef: string): string | null {
  const normalized = normalizeSourceRef(sourceRef)
  if (!normalized.startsWith('repo:')) return null
  const value = normalized.slice('repo:'.length).trim()
  return value.length > 0 ? value : null
}

function isUnsafeRepositoryBody(value: string): boolean {
  const lowered = value.toLowerCase()
  return UNSAFE_MARKERS.some((marker) => lowered.includes(marker)) || UNSAFE_CREDENTIAL_MARKER.test(value)
}

function metadataGaps(metadata: RepositoryInventoryRecord | undefined): RepositoryEvidenceGap[] {
  if (!metadata) return ['immutable-id-unavailable', 'live-metadata-unavailable']
  if (!metadata.repositoryId) return ['immutable-id-unavailable']
  return []
}

function repositoryUrl(fullName: string | null): string | null {
  return fullName ? `https://github.com/${fullName}` : null
}

function resolvedRecord(
  sourceRef: string,
  matchMethod: RepositoryMatchMethod,
  fullName: string,
  stableId: string | null,
  metadata: RepositoryInventoryRecord | undefined,
  sourcePath: string | null = null,
): RepositoryEvidenceRecord {
  return {
    sourceRef,
    status: metadata?.repositoryId ? 'resolved' : 'unverified',
    matchMethod,
    stableId,
    fullName,
    sourcePath,
    url: repositoryUrl(fullName),
    repositoryId: metadata?.repositoryId ?? null,
    nodeId: metadata?.nodeId ?? null,
    visibility: metadata?.visibility ?? null,
    defaultBranch: metadata?.defaultBranch ?? null,
    archived: metadata?.archived ?? null,
    pushedAt: metadata?.pushedAt ?? null,
    updatedAt: metadata?.updatedAt ?? null,
    gaps: metadataGaps(metadata),
  }
}

function unresolvedRecord(
  sourceRef: string,
  status: Exclude<RepositoryEvidenceStatus, 'resolved' | 'unverified'>,
  candidates?: readonly string[],
): RepositoryEvidenceRecord {
  return {
    sourceRef,
    status,
    matchMethod: null,
    stableId: null,
    fullName: null,
    sourcePath: null,
    url: null,
    repositoryId: null,
    nodeId: null,
    visibility: null,
    defaultBranch: null,
    archived: null,
    pushedAt: null,
    updatedAt: null,
    gaps: [],
    candidates,
  }
}

export function repositoryEvidenceDigest(records: readonly RepositoryEvidenceRecord[]): string {
  return createHash('sha256')
    .update(JSON.stringify(records), 'utf8')
    .digest('hex')
}

export function resolveRepositoryEvidence(
  sourceRefs: readonly string[],
  relocationEntries: readonly RelocationRegistryEntry[],
  inventory: readonly RepositoryInventoryRecord[] = [],
): RepositoryEvidenceRecord[] {
  const inventoryByFullName = new Map(
    inventory.map((record) => [record.fullName.toLowerCase(), record] as const),
  )
  const inventoryByRepositoryName = new Map<string, RepositoryInventoryRecord[]>()
  const duplicateImmutableId = new Map<string, string>()
  for (const record of inventory) {
    const repositoryName = record.fullName.split('/')[1]?.toLowerCase()
    if (repositoryName) {
      const matches = inventoryByRepositoryName.get(repositoryName) ?? []
      matches.push(record)
      inventoryByRepositoryName.set(repositoryName, matches)
    }
    if (!record.repositoryId) continue
    const prior = duplicateImmutableId.get(record.repositoryId)
    if (prior) {
      throw new TypeError(`Duplicate immutable repository id ${record.repositoryId} for ${prior} and ${record.fullName}`)
    }
    duplicateImmutableId.set(record.repositoryId, record.fullName)
  }

  const namesToEntries = new Map<string, RelocationRegistryEntry[]>()
  for (const entry of relocationEntries) {
    const parts = entry.githubIdentity.split('/')
    if (parts.length !== 2 || !parts.every((segment) => SAFE_NAME_RE.test(segment))) {
      throw new TypeError(`Malformed relocation githubIdentity: ${entry.githubIdentity}`)
    }
    const repoName = parts[1].toLowerCase()
    const matches = namesToEntries.get(repoName) ?? []
    matches.push(entry)
    namesToEntries.set(repoName, matches)
  }

  const uniqueSourceRefs = [...new Set(sourceRefs.map(normalizeSourceRef))]
  const records = uniqueSourceRefs.map((sourceRef) => {
    const body = sourceBody(sourceRef)
    if (!body) return unresolvedRecord(sourceRef, 'malformed')
    if (isUnsafeRepositoryBody(body)) return unresolvedRecord(sourceRef, 'unsafe')

    const exactRegistryMatches = relocationEntries.filter((entry) => {
      const stableMatch = entry.stableId.toLowerCase() === body.toLowerCase()
      const identityMatch = entry.githubIdentity.toLowerCase() === body.toLowerCase()
      return stableMatch || identityMatch
    })

    if (exactRegistryMatches.length > 1) {
      return unresolvedRecord(
        sourceRef,
        'ambiguous',
        exactRegistryMatches.map((entry) => entry.githubIdentity).sort(compareText),
      )
    }
    if (exactRegistryMatches.length === 1) {
      const [entry] = exactRegistryMatches
      const metadata = inventoryByFullName.get(entry.githubIdentity.toLowerCase())
      return resolvedRecord(sourceRef, 'relocation-registry', entry.githubIdentity, entry.stableId, metadata)
    }

    const registryPathMatches = relocationEntries.filter((entry) => (
      body.toLowerCase().startsWith(`${entry.stableId.toLowerCase()}/`)
    ))
    if (registryPathMatches.length > 1) {
      return unresolvedRecord(
        sourceRef,
        'ambiguous',
        registryPathMatches.map((entry) => entry.githubIdentity).sort(compareText),
      )
    }
    if (registryPathMatches.length === 1) {
      const [entry] = registryPathMatches
      const sourcePath = body.slice(entry.stableId.length + 1)
      if (!sourcePath || !SAFE_PATH_RE.test(sourcePath)) return unresolvedRecord(sourceRef, 'malformed')
      const metadata = inventoryByFullName.get(entry.githubIdentity.toLowerCase())
      return resolvedRecord(sourceRef, 'relocation-registry', entry.githubIdentity, entry.stableId, metadata, sourcePath)
    }

    if (SAFE_QUALIFIED_RE.test(body)) {
      const metadata = inventoryByFullName.get(body.toLowerCase())
      return resolvedRecord(sourceRef, 'qualified-name', body, null, metadata)
    }

    const qualifiedParts = body.split('/')
    if (qualifiedParts.length > 2 && qualifiedParts.every((segment) => SAFE_NAME_RE.test(segment))) {
      const fullName = qualifiedParts.slice(0, 2).join('/')
      const sourcePath = qualifiedParts.slice(2).join('/')
      const metadata = inventoryByFullName.get(fullName.toLowerCase())
      return resolvedRecord(sourceRef, 'qualified-name', fullName, null, metadata, sourcePath)
    }

    if (!SAFE_ALIAS_RE.test(body)) return unresolvedRecord(sourceRef, 'malformed')

    const uniqueMatches = namesToEntries.get(body.toLowerCase()) ?? []
    if (uniqueMatches.length > 1) {
      return unresolvedRecord(
        sourceRef,
        'ambiguous',
        uniqueMatches.map((entry) => entry.githubIdentity).sort(compareText),
      )
    }
    if (uniqueMatches.length === 1) {
      const [entry] = uniqueMatches
      const metadata = inventoryByFullName.get(entry.githubIdentity.toLowerCase())
      return resolvedRecord(sourceRef, 'unique-name', entry.githubIdentity, entry.stableId, metadata)
    }

    const inventoryNameMatches = inventoryByRepositoryName.get(body.toLowerCase()) ?? []
    if (inventoryNameMatches.length > 1) {
      return unresolvedRecord(
        sourceRef,
        'ambiguous',
        inventoryNameMatches.map((record) => record.fullName).sort(compareText),
      )
    }
    if (inventoryNameMatches.length === 1) {
      const [metadata] = inventoryNameMatches
      return resolvedRecord(sourceRef, 'unique-name', metadata.fullName, null, metadata)
    }

    return unresolvedRecord(sourceRef, 'unmatched')
  })

  return records.sort((left, right) => compareText(left.sourceRef, right.sourceRef))
}
