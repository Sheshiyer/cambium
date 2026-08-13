function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function sortedUniqueStrings(values, label) {
  if (values == null) return []
  if (!Array.isArray(values)) throw new Error(`${label}_must_be_array`)
  const unique = new Set()
  for (const value of values) {
    if (typeof value !== 'string' || !value) throw new Error(`${label}_entry_invalid`)
    unique.add(value)
  }
  return [...unique].sort()
}

function parseWorkId(workId, label) {
  if (typeof workId !== 'string' || !workId) throw new Error(`${label}_invalid`)
  const separator = workId.indexOf(':')
  if (separator <= 0 || separator === workId.length - 1) throw new Error(`${label}_invalid`)
  return {
    workId,
    kind: workId.slice(0, separator),
    slug: workId.slice(separator + 1),
  }
}

function normalizeCatalog(catalog) {
  if (!isRecord(catalog)) throw new Error('catalog_must_be_object')
  if (catalog.schema !== 'cambium.portfolio-catalog.v1') throw new Error('catalog_schema_invalid')
  if (!Array.isArray(catalog.records)) throw new Error('catalog_records_invalid')
  const records = catalog.records.map((record, index) => {
      if (!isRecord(record)) throw new Error(`catalog_record_${index}_invalid`)
      const workId = parseWorkId(record.workId, `catalog_record_${index}_work_id`).workId
      if (!['sapling', 'client-branch', 'internal-program'].includes(record.classification)) {
        throw new Error(`catalog_record_${index}_classification_invalid`)
      }
      return { workId, classification: record.classification }
    })
  const workIds = sortedUniqueStrings(
    records.map((record) => record.workId),
    'catalog_work_ids',
  )
  if (workIds.length !== records.length) throw new Error('catalog_work_ids_duplicate')
  return {
    workIds,
    records: [...records].sort((left, right) => left.workId.localeCompare(right.workId)),
    recordCount: workIds.length,
    catalogDigest: typeof catalog.catalogDigest === 'string' ? catalog.catalogDigest : null,
    classificationDigest: typeof catalog.classificationDigest === 'string' ? catalog.classificationDigest : null,
  }
}

function normalizeBranchStories(branchStories) {
  if (!Array.isArray(branchStories)) throw new Error('branch_stories_must_be_array')
  const canonicalPacketWorkIds = new Set()
  const templatePacketIds = new Set()
  const packets = []
  for (const [index, story] of branchStories.entries()) {
    if (!isRecord(story)) throw new Error(`branch_story_${index}_invalid`)
    if (typeof story.productId !== 'string' || !story.productId) throw new Error(`branch_story_${index}_product_id_invalid`)
    if (story.canonicalWorkId == null) {
      templatePacketIds.add(story.productId)
      continue
    }
    const workId = parseWorkId(story.canonicalWorkId, `branch_story_${index}_canonical_work_id`).workId
    if (canonicalPacketWorkIds.has(workId)) throw new Error(`branch_story_${index}_canonical_work_id_duplicate`)
    canonicalPacketWorkIds.add(workId)
    packets.push({
      workId,
      productId: story.productId,
      arcId: typeof story.arcId === 'string' && story.arcId ? story.arcId : null,
      questCount: Array.isArray(story.questline) ? story.questline.length : 0,
    })
  }
  return {
    canonicalPacketWorkIds: [...canonicalPacketWorkIds].sort(),
    templatePacketIds: [...templatePacketIds].sort(),
    packets: packets.sort((left, right) => left.workId.localeCompare(right.workId)),
  }
}

function normalizeRootMap(rootMap, observedFolders) {
  if (rootMap == null) return null
  if (!isRecord(rootMap) || rootMap.schema !== 'thoughtseed.portfolio-root-map.v1') {
    throw new Error('root_map_invalid')
  }
  if (!Array.isArray(rootMap.portfolios)) throw new Error('root_map_portfolios_invalid')
  const portfolio = rootMap.portfolios.find((entry) => isRecord(entry) && entry.portfolioId === 'thoughtseed')
  if (!portfolio || !Array.isArray(portfolio.folders) || !Array.isArray(portfolio.infrastructure)) {
    throw new Error('root_map_thoughtseed_invalid')
  }
  if (portfolio.folders.length !== portfolio.folderCount) throw new Error('root_map_folder_count_drift')
  const folders = portfolio.folders.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.folder !== 'string' || !entry.folder) {
      throw new Error(`root_map_folder_${index}_invalid`)
    }
    if (!['client-branch', 'sapling', 'internal-program', 'needs-review'].includes(entry.proposedKind)) {
      throw new Error(`root_map_folder_${index}_kind_invalid`)
    }
    const workIds = sortedUniqueStrings(entry.workIds, `root_map_folder_${index}_work_ids`)
    workIds.forEach((workId, workIndex) => parseWorkId(workId, `root_map_folder_${index}_work_id_${workIndex}`))
    return {
      folder: entry.folder,
      proposedKind: entry.proposedKind,
      status: typeof entry.status === 'string' ? entry.status : null,
      workIds,
    }
  }).sort((left, right) => left.folder.localeCompare(right.folder))
  if (new Set(folders.map((entry) => entry.folder)).size !== folders.length) throw new Error('root_map_folders_duplicate')
  const infrastructure = sortedUniqueStrings(portfolio.infrastructure, 'root_map_infrastructure')
  const expected = [...folders.map((entry) => entry.folder), ...infrastructure].sort()
  const observed = observedFolders == null ? null : sortedUniqueStrings(observedFolders, 'observed_folders')
  return {
    folders,
    infrastructure,
    expected,
    observed,
    missing: observed ? expected.filter((folder) => !observed.includes(folder)) : [],
    unexpected: observed ? observed.filter((folder) => !expected.includes(folder)) : [],
  }
}

function normalizeOrganPlan(organPlan) {
  if (organPlan == null) return null
  if (!isRecord(organPlan) || !Array.isArray(organPlan.workflows) || !Array.isArray(organPlan.activeDeliveries)) {
    throw new Error('organ_plan_invalid')
  }
  const workflowIds = sortedUniqueStrings(
    organPlan.workflows.map((workflow, index) => {
      if (!isRecord(workflow) || typeof workflow.organ !== 'string') throw new Error(`organ_workflow_${index}_invalid`)
      return workflow.organ
    }),
    'organ_workflow_ids',
  )
  const activeDeliveries = organPlan.activeDeliveries.map((delivery, index) => {
    if (!isRecord(delivery) || typeof delivery.workObjectId !== 'string' || typeof delivery.organ !== 'string') {
      throw new Error(`organ_delivery_${index}_invalid`)
    }
    return { workObjectId: parseWorkId(delivery.workObjectId, `organ_delivery_${index}_work_id`).workId, organ: delivery.organ }
  })
  return { workflowIds, activeDeliveries }
}

function normalizeMirrors(mirrors) {
  if (!isRecord(mirrors)) throw new Error('mirrors_must_be_object')
  for (const key of ['catalogData', 'catalogModule', 'rootMap']) {
    if (typeof mirrors[key] !== 'boolean') throw new Error(`mirrors_${key}_invalid`)
  }
  return {
    catalogData: mirrors.catalogData,
    catalogModule: mirrors.catalogModule,
    rootMap: mirrors.rootMap,
  }
}

function normalizePins(pins) {
  if (!isRecord(pins)) throw new Error('pins_must_be_object')
  const keys = [
    'reviewedRootMapDigest',
    'currentRootMapDigest',
    'reviewedCatalogDigest',
    'currentCatalogDigest',
    'reviewedClassificationDigest',
    'currentClassificationDigest',
  ]
  for (const key of keys) {
    if (typeof pins[key] !== 'string' || !pins[key]) throw new Error(`pins_${key}_invalid`)
  }
  return {
    reviewedRootMapDigest: pins.reviewedRootMapDigest,
    currentRootMapDigest: pins.currentRootMapDigest,
    reviewedCatalogDigest: pins.reviewedCatalogDigest,
    currentCatalogDigest: pins.currentCatalogDigest,
    reviewedClassificationDigest: pins.reviewedClassificationDigest,
    currentClassificationDigest: pins.currentClassificationDigest,
  }
}

function normalizeVaultRegistry(vaultRegistry) {
  if (vaultRegistry == null) return null
  if (!isRecord(vaultRegistry)) throw new Error('vault_registry_must_be_object')
  if (vaultRegistry.schema !== 'thoughtseed.work-object-registry.v1') throw new Error('vault_registry_schema_invalid')
  if (!Array.isArray(vaultRegistry.workObjects)) throw new Error('vault_registry_work_objects_invalid')
  const workIds = sortedUniqueStrings(
    vaultRegistry.workObjects.map((entry, index) => {
      if (!isRecord(entry)) throw new Error(`vault_registry_work_object_${index}_invalid`)
      return parseWorkId(entry.workId, `vault_registry_work_object_${index}_work_id`).workId
    }),
    'vault_registry_work_ids',
  )
  return {
    workIds,
    recordCount: workIds.length,
    observedAt: typeof vaultRegistry.generatedAt === 'string' ? vaultRegistry.generatedAt : null,
    classificationDigest: typeof vaultRegistry.classificationDigest === 'string' ? vaultRegistry.classificationDigest : null,
  }
}

function normalizeLiveSnapshot(liveSnapshot) {
  if (liveSnapshot == null) return null
  if (!isRecord(liveSnapshot)) throw new Error('live_snapshot_must_be_object')
  if (liveSnapshot.schema !== 'cambium.portfolio-workbench-observation.v1') throw new Error('live_snapshot_schema_invalid')
  const workIds = sortedUniqueStrings(liveSnapshot.workIds, 'live_snapshot_work_ids')
  for (const [index, workId] of workIds.entries()) {
    parseWorkId(workId, `live_snapshot_work_id_${index}`)
  }
  return {
    workIds,
    recordCount: workIds.length,
    observedAt: typeof liveSnapshot.observedAt === 'string' ? liveSnapshot.observedAt : null,
  }
}

function sameStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function compareWorkObjectSets(left, right) {
  const leftWorkIds = sortedUniqueStrings(left, 'left_work_ids')
  const rightWorkIds = sortedUniqueStrings(right, 'right_work_ids')
  for (const [index, workId] of leftWorkIds.entries()) {
    parseWorkId(workId, `left_work_id_${index}`)
  }
  for (const [index, workId] of rightWorkIds.entries()) {
    parseWorkId(workId, `right_work_id_${index}`)
  }

  const leftSet = new Set(leftWorkIds)
  const rightSet = new Set(rightWorkIds)
  const onlyLeft = leftWorkIds.filter((workId) => !rightSet.has(workId))
  const onlyRight = rightWorkIds.filter((workId) => !leftSet.has(workId))

  const leftKindsBySlug = new Map()
  const rightKindsBySlug = new Map()
  for (const workId of leftWorkIds) {
    const { kind, slug } = parseWorkId(workId, 'left_work_id')
    const kinds = leftKindsBySlug.get(slug) ?? new Set()
    kinds.add(kind)
    leftKindsBySlug.set(slug, kinds)
  }
  for (const workId of rightWorkIds) {
    const { kind, slug } = parseWorkId(workId, 'right_work_id')
    const kinds = rightKindsBySlug.get(slug) ?? new Set()
    kinds.add(kind)
    rightKindsBySlug.set(slug, kinds)
  }

  const slugs = [...new Set([
    ...leftKindsBySlug.keys(),
    ...rightKindsBySlug.keys(),
  ])].sort()
  const kindSetDifferences = slugs.flatMap((slug) => {
    const leftKinds = [...(leftKindsBySlug.get(slug) ?? new Set())].sort()
    const rightKinds = [...(rightKindsBySlug.get(slug) ?? new Set())].sort()
    if (sameStringArray(leftKinds, rightKinds)) return []
    return [{ slug, leftKinds, rightKinds }]
  })

  return {
    onlyLeft,
    onlyRight,
    kindSetDifferences,
  }
}

function hasDiff(diff) {
  return diff.onlyLeft.length > 0 || diff.onlyRight.length > 0 || diff.kindSetDifferences.length > 0
}

export function buildPortfolioMiniappLinkageReport(input) {
  if (!isRecord(input)) throw new Error('linkage_input_must_be_object')

  const catalog = normalizeCatalog(input.catalog)
  const branchStories = normalizeBranchStories(input.branchStories)
  const mirrors = normalizeMirrors(input.mirrors)
  const pins = normalizePins(input.pins)
  const vaultRegistry = normalizeVaultRegistry(input.vaultRegistry)
  const liveSnapshot = normalizeLiveSnapshot(input.liveSnapshot)
  const rootMap = normalizeRootMap(input.rootMap, input.observedFolders)
  const organPlan = normalizeOrganPlan(input.organPlan)

  const catalogWorkIdSet = new Set(catalog.workIds)
  const catalogWorkIdsWithoutPackets = catalog.workIds.filter(
    (workId) => !branchStories.canonicalPacketWorkIds.includes(workId),
  )
  const packetWorkIdsMissingFromCatalog = branchStories.canonicalPacketWorkIds.filter(
    (workId) => !catalogWorkIdSet.has(workId),
  )

  const releaseBlockers = []
  if (!mirrors.catalogData) releaseBlockers.push('catalog-data-mirror-drift')
  if (!mirrors.catalogModule) releaseBlockers.push('catalog-module-mirror-drift')
  if (!mirrors.rootMap) releaseBlockers.push('portfolio-root-map-mirror-drift')
  if (pins.reviewedClassificationDigest !== pins.currentClassificationDigest) {
    releaseBlockers.push('portfolio-classification-pin-drift')
  }
  if (pins.reviewedCatalogDigest !== pins.currentCatalogDigest) {
    releaseBlockers.push('portfolio-catalog-pin-drift')
  }
  if (pins.reviewedRootMapDigest !== pins.currentRootMapDigest) {
    releaseBlockers.push('portfolio-root-map-pin-drift')
  }
  for (const workId of packetWorkIdsMissingFromCatalog) {
    releaseBlockers.push(`unknown-packet-work-id:${workId}`)
  }
  const mappedWorkIds = rootMap ? sortedUniqueStrings(rootMap.folders.flatMap((entry) => entry.workIds), 'root_map_mapped_work_ids') : []
  const mappedWorkIdsMissingFromCatalog = mappedWorkIds.filter((workId) => !catalogWorkIdSet.has(workId))
  for (const workId of mappedWorkIdsMissingFromCatalog) releaseBlockers.push(`unknown-root-map-work-id:${workId}`)
  if (rootMap?.missing.length) releaseBlockers.push(...rootMap.missing.map((folder) => `missing-working-folder:${folder}`))
  if (rootMap?.unexpected.length) releaseBlockers.push(...rootMap.unexpected.map((folder) => `unmapped-working-folder:${folder}`))

  const packetsByWorkId = new Map(branchStories.packets.map((packet) => [packet.workId, packet]))
  const foldersByWorkId = new Map()
  for (const entry of rootMap?.folders ?? []) {
    for (const workId of entry.workIds) {
      const folders = foldersByWorkId.get(workId) ?? []
      folders.push(entry.folder)
      foldersByWorkId.set(workId, folders)
    }
  }
  const deliveriesByWorkId = new Map()
  for (const delivery of organPlan?.activeDeliveries ?? []) {
    const organs = deliveriesByWorkId.get(delivery.workObjectId) ?? []
    organs.push(delivery.organ)
    deliveriesByWorkId.set(delivery.workObjectId, organs)
  }
  const operatingCoverage = catalog.records.map((record) => {
    const packet = packetsByWorkId.get(record.workId)
    const folders = [...(foldersByWorkId.get(record.workId) ?? [])].sort()
    const organs = [...new Set(deliveriesByWorkId.get(record.workId) ?? [])].sort()
    return {
      workId: record.workId,
      classification: record.classification,
      filesystem: folders.length ? { state: 'mapped', folders } : { state: 'explicit-folderless-gap', folders: [] },
      storyArc: packet ? { state: 'packet-backed', arcId: packet.arcId } : { state: 'explicit-unadmitted-gap', arcId: null },
      quests: packet ? { state: 'packet-backed', count: packet.questCount } : { state: 'explicit-unadmitted-gap', count: 0 },
      organs: organs.length ? { state: 'receipt-backed', linked: organs } : { state: 'workflow-available-unassigned', linked: [] },
      miniApp: { canopy: 'catalog-visible', mission: packet ? 'packet-projected' : 'explicit-gap' },
      telegramTransport: 'hermes-only',
    }
  })
  const questCount = operatingCoverage.reduce((total, row) => total + row.quests.count, 0)

  const observations = {}
  let driftObserved = false
  if (vaultRegistry) {
    const diff = compareWorkObjectSets(vaultRegistry.workIds, catalog.workIds)
    observations.vault = {
      source: 'provided-vault-registry',
      authority: 'read-only-comparison-only',
      observedAt: vaultRegistry.observedAt,
      recordCount: vaultRegistry.recordCount,
      diff,
    }
    driftObserved ||= hasDiff(diff)
  }
  if (liveSnapshot) {
    const diff = compareWorkObjectSets(liveSnapshot.workIds, catalog.workIds)
    observations.live = {
      source: 'provided-live-snapshot',
      authority: 'read-only-comparison-only',
      observedAt: liveSnapshot.observedAt,
      recordCount: liveSnapshot.recordCount,
      diff,
    }
    driftObserved ||= hasDiff(diff)
  }

  return {
    schema: 'cambium.portfolio-miniapp-linkage.v1',
    readOnly: true,
    status: releaseBlockers.length > 0 ? 'blocked' : (driftObserved ? 'drift-observed' : 'aligned'),
    releaseBlockers,
    mutationsPerformed: [],
    catalogVisibility: {
      authority: 'portfolio-catalog-read-only-visibility',
      recordCount: catalog.recordCount,
      workIds: [...catalog.workIds],
      classificationDigest: catalog.classificationDigest,
      catalogDigest: catalog.catalogDigest,
    },
    missionAdmission: {
      authorityBoundary: 'catalog-visibility-does-not-grant-operational-admission',
      policy: 'explicit-packet-and-goal-graph-admission-only',
      canonicalPacketWorkIds: [...branchStories.canonicalPacketWorkIds],
      templatePacketIds: [...branchStories.templatePacketIds],
      catalogWorkIdsWithoutPackets,
      packetWorkIdsMissingFromCatalog,
    },
    filesystemAssimilation: rootMap ? {
      authority: 'proposal-only-working-root-evidence',
      expectedCount: rootMap.expected.length,
      mappedFolderCount: rootMap.folders.length,
      infrastructureCount: rootMap.infrastructure.length,
      observedCount: rootMap.observed?.length ?? null,
      missingFolders: rootMap.missing,
      unexpectedFolders: rootMap.unexpected,
      unresolvedFolders: rootMap.folders.filter((entry) => entry.workIds.length === 0),
      mappedWorkIdsMissingFromCatalog,
      catalogWorkIdsWithoutFolders: catalog.workIds.filter((workId) => !foldersByWorkId.has(workId)),
    } : null,
    operatingCoverage: {
      authorityBoundary: 'explicit-gaps-never-grant-goal-graph-admission',
      totalWorkObjects: operatingCoverage.length,
      packetBackedStoryArcs: operatingCoverage.filter((row) => row.storyArc.state === 'packet-backed').length,
      explicitStoryArcGaps: operatingCoverage.filter((row) => row.storyArc.state === 'explicit-unadmitted-gap').length,
      packetBackedQuestRows: questCount,
      organWorkflowIds: organPlan?.workflowIds ?? [],
      activeOrganAssignments: operatingCoverage.filter((row) => row.organs.state === 'receipt-backed').length,
      rows: operatingCoverage,
    },
    operationalMirrors: {
      catalogData: mirrors.catalogData,
      catalogModule: mirrors.catalogModule,
      rootMap: mirrors.rootMap,
    },
    reviewedPins: {
      reviewedRootMapDigest: pins.reviewedRootMapDigest,
      currentRootMapDigest: pins.currentRootMapDigest,
      reviewedCatalogDigest: pins.reviewedCatalogDigest,
      currentCatalogDigest: pins.currentCatalogDigest,
      reviewedClassificationDigest: pins.reviewedClassificationDigest,
      currentClassificationDigest: pins.currentClassificationDigest,
    },
    observations,
  }
}
