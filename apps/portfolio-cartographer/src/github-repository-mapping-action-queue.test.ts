import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { PORTFOLIO_CATALOG, PORTFOLIO_CLASSIFICATION_DIGEST } from '../../../workers/quests/src/portfolio-catalog.ts';
import { REPOSITORY_EVIDENCE } from './repository-evidence.generated.ts';
import { REPOSITORY_INVENTORY } from './repository-inventory.generated.ts';
import { PORTFOLIO_ROOT_MAP_DIGEST, PORTFOLIO_ROOTS } from './portfolio-root-map.generated.ts';

type Assignment = {
  workId: string;
  repositoryRefs: string[];
  receiptStatus?: string;
};

type Cluster = {
  candidateRepos: string[];
  holdRepos?: string[];
  unavailableCandidateRepos?: string[];
  requiresRootMapRepair?: boolean;
  resolvedAssignments: Assignment[];
  workIds: string[];
};

type MappingRow = {
  candidateRepos: string[];
  context: string;
  deferredNoGitIdentity?: boolean;
  resolvedAssignments: Assignment[];
  unavailableCandidateRepos?: string[];
  workIds: string[];
};

type Batch = {
  batchId: string;
  rows?: MappingRow[];
  summary: Record<string, number>;
  clusters?: Cluster[];
  status?: string;
  defaults?: {
    catalogDigest: string;
    classificationDigest: string;
    founderDecisionStatus: string;
    rootMapDigest: string;
  };
  directSaplingMappings?: Array<{ workId: string; candidateRepos: string[] }>;
  founderHolds?: unknown[];
  resolvedProvenanceSplits?: Array<{
    targetWorkId?: string;
    productWorkId?: string;
    clientWorkId?: string;
    mappedRepos?: string[];
    branchRepos?: string[];
    excludedContamination?: Array<{ targetWorkId: string; repository: string }>;
  }>;
  renameReadiness?: {
    cambiumPhase1Applied?: boolean;
    cambiumPhase1ApplyReceipt?: string;
    temperancePhase2PreflightReady?: boolean;
    temperancePhase2PreflightReceipt?: string;
    temperancePhase2Applied?: boolean;
    temperancePhase2ApplyReceipt?: string;
    filesystemMutationAuthorized?: boolean;
    shallowPortfolioRoot?: string;
    vaultContextRoot?: string;
    thoughtseedLabsBoundary?: string;
  };
};

type Batch5Row = {
  folder: string;
  status: string;
  currentWorkId?: string;
  previousWorkId?: string;
  closeoutArtifacts?: {
    handoffMarkdownPath: string;
    closeoutReceiptJsonPath: string;
    agentMemoryJsonPath: string;
    activeIndexDisposition: string;
  };
  relocationGate?: {
    requiresFounderApprovedManifest: boolean;
  };
};

const queue = JSON.parse(
  readFileSync(new URL('../../../docs/project-management/github-repository-mapping-action-queue.v1.json', import.meta.url), 'utf8'),
) as {
  batches: Batch[];
  currentDigests: { catalogDigest: string; classificationDigest: string; rootMapDigest: string };
  folderRenameReadiness: { status: string };
  requiredPayloadFieldsBeforeMutation: string[];
};
const physicalLaneManifest = JSON.parse(
  readFileSync(
    new URL('../../../docs/project-management/relocation-manifests/2026-08-08-thoughtseed-physical-lane.v1.json', import.meta.url),
    'utf8',
  ),
) as {
  applyAuthorization: Record<string, boolean>;
  observedDrift: Array<{ subject: string; status: string }>;
  phases: Array<{
    phaseId: string;
    order: number;
    status: string;
    liveApplyReady: boolean;
    preflightReceipt?: string;
    applyReceipt?: string;
    requiredApprovalText?: string;
    postApplyObservations?: {
      canonicalSlot: { gitIdentity: string; workingTree: string };
      archivedShallowState: { disposition: string };
      archivedNestedLocalState: { statusFileSha256: string };
      websiteContainer: { children: string[] };
      rootMapDigest: string;
    };
    resolvedPreflight?: string[];
    proposedOperations?: Array<{ op: string; source?: string; target?: string; path?: string }>;
    proposedOperationsWhenUnblocked?: Array<{ op: string; source?: string; target?: string; path?: string }>;
    proposedOperationsWhenApproved?: Array<{ op: string; source?: string; target?: string; path?: string }>;
    mustNotDo?: string[];
  }>;
  scope: {
    shallowPortfolioRoot: string;
    vaultContextRoot: string;
    vaultBoundary: string;
  };
  status: string;
};
const physicalLanePreflight = JSON.parse(
  readFileSync(
    new URL('../../../docs/project-management/relocation-manifests/2026-08-08-thoughtseed-physical-lane-preflight.v1.json', import.meta.url),
    'utf8',
  ),
) as {
  founderDecision: {
    cleanupDrift: string;
    liveApplyApproved: boolean;
  };
  nextGate: {
    filesystemMutationAuthorized: boolean;
    requiredApprovalText: string;
  };
  phase1CambiumProof: {
    canonicalSlot: { exists: boolean; gitProbe: string };
    temporaryAuthorityCheckout: { exists: boolean; gitProbe: string };
  };
  rootMapProof: {
    depthOneCompareOnlyUnignoredDrift: boolean;
    ignoredDrift: string[];
  };
  status: string;
};
const physicalLanePhase1Receipt = JSON.parse(
  readFileSync(
    new URL('../../../docs/project-management/relocation-manifests/2026-08-08-thoughtseed-physical-lane-phase-1-apply-receipt.v1.json', import.meta.url),
    'utf8',
  ),
) as {
  approval: { consumed: boolean; matchedFounderMessage: boolean; requiredText: string; scope: string };
  externalMutation: Record<string, boolean>;
  heldBoundaries: { symphonicsExists: boolean; temperanceMutationPerformed: boolean; thoughtseedLabsInodeBeforeAndAfter: string };
  phaseId: string;
  postApply: {
    archivedPreAuthorityState: { disposition: string; gitIdentity: string; inode: string };
    canonicalSlot: { gitIdentity: string; inode: string; remote: string };
    depthOneComparison: { missing: string[]; ok: boolean; unexpected: string[] };
    rootMap: { fileSha256: string; snapshotDigest: string };
    temporaryAuthoritySiblingExists: boolean;
  };
  status: string;
};
const physicalLanePhase2Preflight = JSON.parse(
  readFileSync(
    new URL('../../../docs/project-management/relocation-manifests/2026-08-08-thoughtseed-physical-lane-phase-2-preflight.v1.json', import.meta.url),
    'utf8',
  ),
) as {
  approval: { filesystemMutationAuthorized: boolean; liveApplyApproved: boolean; reconciliationApproved: boolean; requiredText: string };
  containerDecision: { decision: string; postApplyChildren: string[]; rootMapChangeExpected: boolean };
  contentReconciliation: {
    changedNonSensitive: Array<{ path: string }>;
    identicalNonSensitiveCount: number;
    nestedOnlyNonSensitive: unknown[];
    sensitiveIgnoredState: { commonFileCount: number; contentHashed: boolean; contentInspected: boolean; metadataDifferenceCount: number; pathRecorded: boolean };
    shallowOnlyNonSensitive: Array<{ path: string }>;
    untrackedProjectStatus: { identicalToShallowCounterpart: boolean; path: string; sha256: string };
  };
  externalMutation: Record<string, boolean>;
  phaseId: string;
  postApplyRequirements: { rootMapDigest: string; rootMapExpectedCount: number; rootMapObservedCount: number };
  preApply: {
    archiveTargets: { bothAbsent: boolean };
    nestedAuthorityCheckout: { gitIdentity: string; porcelainStatus: string[]; remote: string };
    rootMap: { missing: string[]; snapshotDigest: string; unexpected: string[] };
    shallowSlot: { gitIdentity: string };
  };
  proposedOperationsAfterExactApproval: Array<{ op: string; order: number; path?: string; source?: string; target?: string }>;
  rollback: Record<string, string[]>;
  status: string;
};
const physicalLanePhase2Receipt = JSON.parse(
  readFileSync(
    new URL('../../../docs/project-management/relocation-manifests/2026-08-08-thoughtseed-physical-lane-phase-2-apply-receipt.v1.json', import.meta.url),
    'utf8',
  ),
) as {
  approval: { consumed: boolean; matchedFounderMessage: boolean; requiredText: string; scope: string };
  externalMutation: Record<string, boolean>;
  heldBoundaries: {
    shallowGitignoreMergedIntoAuthority: boolean;
    symphonicsExists: boolean;
    thoughtseedLabsInodeBeforeAndAfter: string;
    websiteWorkObjectCreated: boolean;
  };
  operations: Array<{ op: string; order: number }>;
  phaseId: string;
  postApply: {
    archivedNestedLocalState: { children: string[]; inode: string; statusFileSha256: string };
    archivedShallowState: { disposition: string; gitIdentity: string; inode: string; regularFileCount: number };
    canonicalSlot: { gitIdentity: string; inode: string; remote: string; workingTreeClean: boolean };
    container: { children: string[]; inode: string; role: string };
    depthOneComparison: { expectedCount: number; missing: string[]; observedCount: number; ok: boolean; unexpected: string[] };
    formerNestedAuthorityPathExists: boolean;
    rootMap: { changed: boolean; fileSha256: string; snapshotDigest: string };
    sensitiveIgnoredState: { contentHashed: boolean; contentInspected: boolean; pathRecorded: boolean };
  };
  rollback: { available: boolean; steps: string[] };
  status: string;
};

const batch = queue.batches.find(({ batchId }) => batchId === 'github-batch-002-client-branch-clusters');
if (!batch) throw new Error('Batch 2 client branch queue is missing');
const batch4 = queue.batches.find(({ batchId }) => batchId === 'github-batch-004-internal-programs-and-vault');
if (!batch4) throw new Error('Batch 4 internal program queue is missing');
const batch5 = queue.batches.find(({ batchId }) => batchId === 'github-batch-005-root-map-catalog-repair');
if (!batch5) throw new Error('Batch 5 root-map repair queue is missing');
const batch1 = queue.batches.find(({ batchId }) => batchId === 'github-batch-001-thoughtseed-org-history');
if (!batch1) throw new Error('Batch 1 Thoughtseed org queue is missing');
const batch3 = queue.batches.find(({ batchId }) => batchId === 'github-batch-003-sapling-provenance');
if (!batch3) throw new Error('Batch 3 Sapling provenance queue is missing');
const batch6 = queue.batches.find(({ batchId }) => batchId === 'github-batch-006-foundation-repository-reconciliation');
if (!batch6) throw new Error('Batch 6 foundation reconciliation queue is missing');

const repositoryName = (repositoryRef: string): string => repositoryRef.split('/').slice(0, 2).join('/');

test('current queue digests bind exact catalog and root authorities', () => {
  assert.deepEqual(queue.currentDigests, {
    rootMapDigest: PORTFOLIO_ROOT_MAP_DIGEST,
    catalogDigest: PORTFOLIO_CATALOG.catalogDigest,
    classificationDigest: PORTFOLIO_CLASSIFICATION_DIGEST,
  });
  assert.equal(batch1.defaults?.rootMapDigest, PORTFOLIO_ROOT_MAP_DIGEST);
  assert.equal(batch1.defaults?.catalogDigest, PORTFOLIO_CATALOG.catalogDigest);
  assert.equal(batch1.defaults?.classificationDigest, PORTFOLIO_CLASSIFICATION_DIGEST);
  assert.equal(batch1.defaults?.founderDecisionStatus, 'founder-reviewed');
  assert.equal(queue.requiredPayloadFieldsBeforeMutation.includes('catalogDigest'), true);
  assert.equal(queue.requiredPayloadFieldsBeforeMutation.includes('classificationDigest'), true);
  assert.equal(queue.folderRenameReadiness.status, 'phase-1-and-phase-2-applied-phase-3-held');
});

test('Batch 1 reviewed rows retain immutable repository and WorkObject identities', () => {
  const records = (batch1.rows ?? []) as Array<{ repository: string; repositoryId: string; targetWorkId: string }>;
  const inventory = new Map(REPOSITORY_INVENTORY.map((record) => [record.fullName.toLowerCase(), record]));
  const workIds = new Set([
    ...PORTFOLIO_CATALOG.records.map((record) => record.workId),
    ...PORTFOLIO_CATALOG.historicalProducts.map((record) => record.canonicalId),
  ]);

  assert.equal(batch1.status, 'founder-reviewed-ready-for-mapping-receipts');
  assert.equal(records.length, batch1.summary.reposReviewed);
  for (const record of records) {
    assert.equal(workIds.has(record.targetWorkId), true, `${record.targetWorkId} must exist in the catalog`);
    assert.equal(inventory.get(record.repository.toLowerCase())?.repositoryId, record.repositoryId);
  }
});

test('Batch 3 Sapling provenance is referentially exact and collision-free', () => {
  const inventory = new Set(REPOSITORY_INVENTORY.map((record) => record.fullName.toLowerCase()));
  const workIds = new Set(PORTFOLIO_CATALOG.records.map((record) => record.workId));
  const bindings: Array<{ workId: string; repository: string }> = [];
  for (const row of batch3.directSaplingMappings ?? []) {
    assert.match(row.workId, /^sapling:/);
    for (const repository of row.candidateRepos) bindings.push({ workId: row.workId, repository });
  }
  for (const split of batch3.resolvedProvenanceSplits ?? []) {
    for (const repository of split.mappedRepos ?? []) bindings.push({ workId: split.targetWorkId!, repository });
    for (const repository of split.branchRepos ?? []) bindings.push({ workId: split.clientWorkId!, repository });
    for (const contamination of split.excludedContamination ?? []) bindings.push({ workId: contamination.targetWorkId, repository: contamination.repository });
    for (const id of [split.targetWorkId, split.productWorkId, split.clientWorkId].filter(Boolean) as string[]) {
      assert.equal(workIds.has(id), true, `${id} must exist in the catalog`);
    }
  }

  assert.equal(batch3.status, 'founder-reviewed-provenance-split-ready-for-mapping-receipts');
  assert.equal(batch3.founderHolds?.length, 0);
  assert.equal(batch3.directSaplingMappings?.length, batch3.summary.directSaplingMappings);
  assert.equal(batch3.resolvedProvenanceSplits?.length, batch3.summary.resolvedProvenanceSplits);
  assert.equal(bindings.length, 40);
  assert.deepEqual(
    bindings.find(({ workId }) => workId === 'sapling:fitcheck'),
    { workId: 'sapling:fitcheck', repository: 'Sheshiyer/fitcheck-landing' },
  );
  assert.equal(new Set(bindings.map(({ repository }) => repository.toLowerCase())).size, bindings.length);
  for (const binding of bindings) {
    assert.equal(workIds.has(binding.workId), true, `${binding.workId} must exist in the catalog`);
    assert.equal(inventory.has(binding.repository.toLowerCase()), true, `${binding.repository} must have immutable inventory evidence`);
  }

  const thoughtseed = PORTFOLIO_ROOTS.find(({ portfolioId }) => portfolioId === 'thoughtseed')!;
  const roots = new Map(thoughtseed.folders.map((folder) => [folder.folder, folder]));
  assert.equal(roots.get('klear-karma')?.proposedKind, 'client-branch');
  assert.deepEqual(roots.get('klear-karma')?.workIds, ['branch:klear-karma']);
  assert.deepEqual(roots.get('kristudios')?.workIds, ['branch:kristudios']);
  assert.deepEqual(roots.get('parkarea')?.workIds, ['branch:parkarea']);
  assert.deepEqual(roots.get('tirak')?.workIds, ['branch:tirak']);
});

test('Batch 6 covers every unresolved catalog repository without inference', () => {
  const rows = (batch6.rows ?? []) as Array<{
    sourceRef: string;
    workIds: string[];
    candidateRepos: string[];
    unavailableCandidateRepos?: string[];
    resolvedAssignments: Assignment[];
    holdReasons?: string[];
    status: string;
  }>;
  const bySourceRef = new Map(rows.map((row) => [row.sourceRef, row]));
  const unresolved = REPOSITORY_EVIDENCE.filter((record) => record.status !== 'resolved');
  const inventory = new Set(REPOSITORY_INVENTORY.map((record) => record.fullName.toLowerCase()));
  const workIds = new Set(PORTFOLIO_CATALOG.records.map((record) => record.workId));

  assert.equal(rows.length, batch6.summary.rowsReviewed);
  for (const record of unresolved) {
    assert.equal(bySourceRef.has(record.sourceRef), true, `${record.sourceRef} needs an explicit Batch 6 disposition`);
  }
  for (const row of rows) {
    for (const id of row.workIds) assert.equal(workIds.has(id), true, `${id} must exist in the catalog`);
    for (const assignment of row.resolvedAssignments) {
      assert.equal(workIds.has(assignment.workId), true, `${assignment.workId} must exist in the catalog`);
      for (const repository of assignment.repositoryRefs) {
        assert.equal(inventory.has(repositoryName(repository).toLowerCase()), true, `${repository} must have immutable inventory evidence`);
      }
    }
    if (row.status.includes('hold')) {
      assert.equal(row.resolvedAssignments.length, 0);
      assert.equal((row.holdReasons?.length ?? 0) > 0, true);
    }
  }
  assert.deepEqual(bySourceRef.get('relocation-registry:bwssb')?.workIds, ['branch:bwssb']);
  assert.deepEqual(bySourceRef.get('repo:reddit-cli')?.resolvedAssignments, [
    { workId: 'program:operator-utilities', repositoryRefs: ['Sheshiyer/reddit-flux'] },
  ]);
  assert.deepEqual(bySourceRef.get('relocation-registry:brandmint-showcase')?.workIds, ['program:meristem-brand-system']);
  assert.deepEqual(bySourceRef.get('relocation-registry:brandmint-showcase')?.resolvedAssignments, [
    { workId: 'program:meristem-brand-system', repositoryRefs: ['Sheshiyer/brandmint-showcase'] },
  ]);
  assert.equal(bySourceRef.get('relocation-registry:brandmint-showcase')?.status, 'resolved-supporting-repository-by-registry-and-architecture');
  assert.deepEqual(bySourceRef.get('catalog-folder-hold:sapling:whatslegal')?.workIds, ['sapling:whatslegal']);
  assert.deepEqual(bySourceRef.get('catalog-folder-hold:sapling:seedforge')?.workIds, ['sapling:seedforge']);
  assert.equal(batch6.summary.folderlessWorkObjectHolds, 2);
  assert.equal(batch6.summary.inferredAssignments, 0);
});

test('Batch 2 summary matches the executable queue', () => {
  const clusters = batch.clusters ?? [];
  const candidates = clusters.flatMap(({ candidateRepos }) => candidateRepos);
  const holds = clusters.flatMap(({ holdRepos = [] }) => holdRepos);
  const assignments = clusters.flatMap(({ resolvedAssignments }) => resolvedAssignments);
  const workIds = new Set(clusters.flatMap(({ workIds }) => workIds));
  const assignedWorkIds = new Set(assignments.map(({ workId }) => workId));
  const rootMapBlocked = assignments.filter(({ receiptStatus }) => receiptStatus === 'blocked-missing-shallow-folder');
  const inventoryNames = new Set(REPOSITORY_INVENTORY.map(({ fullName }) => fullName.toLowerCase()));
  const unavailable = [...new Set([...candidates, ...holds].filter((name) => !inventoryNames.has(name.toLowerCase())))];
  const unavailableCandidates = candidates.filter((name) => !inventoryNames.has(name.toLowerCase()));
  const holdOrUnavailable = new Set([...holds, ...unavailable].map((name) => name.toLowerCase()));

  assert.equal(batch.summary.clientFamiliesReviewed, clusters.length);
  assert.equal(batch.summary.catalogClientBranchTargets, workIds.size);
  assert.equal(batch.summary.catalogClientBranchTargetsWithRepositoryAssignments, assignedWorkIds.size);
  assert.equal(batch.summary.candidateRowsGrouped, candidates.length);
  assert.equal(batch.summary.holdOrExcludeRows, holds.length);
  assert.equal(batch.summary.unavailableImmutableIdentityRows, unavailable.length);
  assert.equal(batch.summary.rootMapBlockedRows, rootMapBlocked.length);
  assert.equal(batch.summary.receiptEligibleRows, candidates.length - unavailableCandidates.length - rootMapBlocked.length);
  assert.equal(batch.summary.blockedReceiptRows, holdOrUnavailable.size + rootMapBlocked.length);
  assert.equal(batch.summary.saplingPromotionsRecommended, 0);
  assert.deepEqual([...workIds].filter((workId) => !assignedWorkIds.has(workId)), ['branch:heyzack-panel-app']);
});

test('every executable Batch 2 repository has an immutable GitHub identity', () => {
  const inventoryNames = new Set(REPOSITORY_INVENTORY.map(({ fullName }) => fullName.toLowerCase()));
  const unavailable = new Set(
    (batch.clusters ?? []).flatMap(({ unavailableCandidateRepos = [] }) => unavailableCandidateRepos.map((name) => name.toLowerCase())),
  );

  for (const cluster of batch.clusters ?? []) {
    for (const assignment of cluster.resolvedAssignments) {
      assert.match(assignment.workId, /^branch:/, `${assignment.workId} must remain a Client Branch`);
      for (const repositoryRef of assignment.repositoryRefs) {
        const name = repositoryName(repositoryRef).toLowerCase();
        assert.equal(unavailable.has(name), false, `${repositoryRef} cannot be executable while its identity is unavailable`);
        assert.equal(inventoryNames.has(name), true, `${repositoryRef} must resolve to immutable inventory evidence`);
      }
    }
  }
});

test('root-map blocks stay explicit instead of becoming executable receipts', () => {
  const blocked = (batch.clusters ?? []).flatMap(({ resolvedAssignments }) =>
    resolvedAssignments.filter(({ receiptStatus }) => receiptStatus === 'blocked-missing-shallow-folder'),
  );

  assert.deepEqual(blocked.map(({ workId }) => workId), ['branch:symphonics']);
  assert.equal((batch.clusters ?? []).find(({ requiresRootMapRepair }) => requiresRootMapRepair)?.requiresRootMapRepair, true);
});

test('Batch 4 summary matches the internal program receipt queue', () => {
  const rows = batch4.rows ?? [];
  const candidates = rows.flatMap(({ candidateRepos }) => candidateRepos);
  const assignments = rows.flatMap(({ resolvedAssignments }) => resolvedAssignments);
  const workIds = new Set(rows.flatMap(({ workIds }) => workIds));
  const assignedWorkIds = new Set(assignments.map(({ workId }) => workId));
  const unavailable = new Set(rows.flatMap(({ unavailableCandidateRepos = [] }) => unavailableCandidateRepos));
  const executableRepositories = new Set(assignments.flatMap(({ repositoryRefs }) => repositoryRefs.map(repositoryName)));
  const deferred = rows.filter(({ deferredNoGitIdentity }) => deferredNoGitIdentity);
  const r2BoundaryRows = rows.filter(({ workIds: ids }) => ids.includes('program:thoughtseed-vault'));

  assert.equal(batch4.summary.contextsReviewed, rows.length);
  assert.equal(batch4.summary.internalProgramTargets, workIds.size);
  assert.equal(batch4.summary.internalProgramTargetsWithRepositoryAssignments, assignedWorkIds.size);
  assert.equal(batch4.summary.candidateRowsGrouped, candidates.length);
  assert.equal(batch4.summary.executableRepositoryRows, executableRepositories.size);
  assert.equal(batch4.summary.receiptEligibleBindings, assignments.flatMap(({ repositoryRefs }) => repositoryRefs).length);
  assert.equal(batch4.summary.unavailableImmutableIdentityRows, unavailable.size);
  assert.equal(batch4.summary.deferredNoGitIdentityRows, deferred.length);
  assert.equal(batch4.summary.blockedReceiptRows, unavailable.size + deferred.length);
  assert.equal(batch4.summary.r2BoundaryRows, r2BoundaryRows.length);
  assert.equal(batch4.summary.saplingPromotionsRecommended, 0);
});

test('every executable Batch 4 repository has immutable GitHub identity', () => {
  const inventoryNames = new Set(REPOSITORY_INVENTORY.map(({ fullName }) => fullName.toLowerCase()));
  const unavailable = new Set(
    (batch4.rows ?? []).flatMap(({ unavailableCandidateRepos = [] }) => unavailableCandidateRepos.map((name) => name.toLowerCase())),
  );

  for (const row of batch4.rows ?? []) {
    for (const assignment of row.resolvedAssignments) {
      assert.match(assignment.workId, /^program:/, `${assignment.workId} must remain an internal Program`);
      for (const repositoryRef of assignment.repositoryRefs) {
        const name = repositoryName(repositoryRef).toLowerCase();
        assert.equal(unavailable.has(name), false, `${repositoryRef} cannot be executable while its identity is unavailable`);
        assert.equal(inventoryNames.has(name), true, `${repositoryRef} must resolve to immutable inventory evidence`);
      }
    }
  }
});

test('Batch 4 plugin work remains deferred until it has a Git identity or fold decision', () => {
  const plugins = (batch4.rows ?? []).find(({ context }) => context === 'plugins');
  assert.equal(plugins?.deferredNoGitIdentity, true);
  assert.deepEqual(plugins?.resolvedAssignments, []);
  assert.deepEqual(plugins?.workIds, ['program:operator-utilities', 'program:engineering-orchestration']);
});

test('Batch 5 settles closeouts while holding physical renames behind a manifest', () => {
  const rows = (batch5.rows ?? []) as unknown as Batch5Row[];
  const byFolder = new Map(rows.map((row) => [row.folder, row]));

  assert.equal(batch5.status, 'founder-reviewed-source-controlled-closeout-exclusion-ready-with-symphonics-repository-role-resolved');
  assert.equal(batch5.summary.rowsReviewed, rows.length);
  assert.deepEqual([...byFolder.keys()].sort(), ['safvr', 'symphonics', 'virtualtryon-3d']);
  assert.equal(byFolder.get('virtualtryon-3d')?.status, 'complete-retired-ignore');
  assert.equal(byFolder.get('virtualtryon-3d')?.previousWorkId, 'sapling:virtualtryon');
  assert.equal(byFolder.get('safvr')?.status, 'complete-closed-client-branch');
  assert.equal(byFolder.get('safvr')?.closeoutArtifacts?.activeIndexDisposition, 'remove-from-active');
  assert.equal(byFolder.get('symphonics')?.status, 'resolved-repository-only-planning-surface-shallow-held');
  assert.equal(byFolder.get('symphonics')?.relocationGate?.requiresFounderApprovedManifest, true);
  assert.equal(batch5.renameReadiness?.filesystemMutationAuthorized, false);
  assert.equal(batch5.renameReadiness?.cambiumPhase1Applied, true);
  assert.match(batch5.renameReadiness?.cambiumPhase1ApplyReceipt ?? '', /phase-1-apply-receipt\.v1\.json$/);
  assert.equal(batch5.renameReadiness?.temperancePhase2PreflightReady, false);
  assert.match(batch5.renameReadiness?.temperancePhase2PreflightReceipt ?? '', /phase-2-preflight\.v1\.json$/);
  assert.equal(batch5.renameReadiness?.temperancePhase2Applied, true);
  assert.match(batch5.renameReadiness?.temperancePhase2ApplyReceipt ?? '', /phase-2-apply-receipt\.v1\.json$/);
  assert.equal(batch5.renameReadiness?.shallowPortfolioRoot, '$PROJECTS_ROOT/thoughtseed');
  assert.equal(batch5.renameReadiness?.vaultContextRoot, '$PROJECTS_ROOT/thoughtseed/thoughtseed-labs');
  assert.match(batch5.renameReadiness?.thoughtseedLabsBoundary ?? '', /never a WorkObject folder/);
});

test('physical relocation manifest records Phase 1 and Phase 2 applied with Phase 3 held', () => {
  const phases = new Map(physicalLaneManifest.phases.map((phase) => [phase.phaseId, phase]));
  const cambium = phases.get('phase-1-cambium-archive-first-promote');
  const temperance = phases.get('phase-2-temperance-landing-page-promote-authority');
  const symphonics = phases.get('phase-3-symphonics-held');
  const manifestText = JSON.stringify(physicalLaneManifest);

  assert.equal(physicalLaneManifest.status, 'phase-1-and-phase-2-applied-phase-3-held');
  assert.equal(physicalLaneManifest.applyAuthorization.cleanupDriftIgnoredByFounder, true);
  assert.equal(physicalLaneManifest.applyAuthorization.liveApplyApproved, true);
  assert.equal(physicalLaneManifest.applyAuthorization.phase1ApprovalConsumed, true);
  assert.equal(physicalLaneManifest.applyAuthorization.phase2ReconciliationApproved, true);
  assert.equal(physicalLaneManifest.applyAuthorization.phase2LiveApplyApproved, true);
  assert.equal(physicalLaneManifest.applyAuthorization.phase2ApprovalConsumed, true);
  assert.equal(physicalLaneManifest.applyAuthorization.filesystemMutationAuthorized, false);
  assert.equal(physicalLaneManifest.scope.shallowPortfolioRoot, '$PROJECTS_ROOT/thoughtseed');
  assert.equal(physicalLaneManifest.scope.vaultContextRoot, '$PROJECTS_ROOT/thoughtseed/thoughtseed-labs');
  assert.match(physicalLaneManifest.scope.vaultBoundary, /never a WorkObject folder/);
  assert.equal(manifestText.includes('/Volumes/'), false);
  assert.equal(manifestText.includes('thoughtseed-labs/'), false);

  assert.equal(cambium?.order, 1);
  assert.equal(cambium?.liveApplyReady, false);
  assert.equal(cambium?.status, 'applied-verified');
  assert.equal(cambium?.proposedOperations?.some(({ source, target }) =>
    source === '$PROJECTS_ROOT/thoughtseed/cambium' &&
    target === '$PROJECTS_ROOT/thoughtseed/_physical-relocation-archive-2026-08-08/cambium-pre-git-authority',
  ), true);
  assert.equal(cambium?.proposedOperations?.some(({ source, target }) =>
    source === '$PROJECTS_ROOT/thoughtseed/cambium-authoritative' &&
    target === '$PROJECTS_ROOT/thoughtseed/cambium',
  ), true);

  assert.equal(temperance?.order, 2);
  assert.equal(temperance?.liveApplyReady, false);
  assert.equal(temperance?.status, 'applied-verified');
  assert.equal(temperance?.requiredApprovalText, 'approve live apply phase 2 Temperance archive-first promote preserve website container');
  assert.match(temperance?.preflightReceipt ?? '', /phase-2-preflight\.v1\.json$/);
  assert.match(temperance?.applyReceipt ?? '', /phase-2-apply-receipt\.v1\.json$/);
  assert.equal(temperance?.resolvedPreflight?.length, 6);
  assert.equal(temperance?.proposedOperationsWhenApproved?.some(({ source, target }) =>
    source === '$PROJECTS_ROOT/thoughtseed/website/temperance-engine-landing-page' &&
    target === '$PROJECTS_ROOT/thoughtseed/temperance-engine-landing-page',
  ), true);
  assert.equal(temperance?.proposedOperationsWhenApproved?.some(({ op, path }) =>
    op === 'preserve-empty-container' && path === '$PROJECTS_ROOT/thoughtseed/website',
  ), true);
  assert.equal(temperance?.postApplyObservations?.canonicalSlot.gitIdentity, 'exact-root');
  assert.equal(temperance?.postApplyObservations?.canonicalSlot.workingTree, 'clean');
  assert.equal(temperance?.postApplyObservations?.archivedShallowState.disposition, 'preserved-recoverable');
  assert.match(temperance?.postApplyObservations?.archivedNestedLocalState.statusFileSha256 ?? '', /^[0-9a-f]{64}$/);
  assert.deepEqual(temperance?.postApplyObservations?.websiteContainer.children, []);
  assert.match(temperance?.postApplyObservations?.rootMapDigest ?? '', /^[0-9a-f]{64}$/);

  assert.equal(symphonics?.order, 3);
  assert.equal(symphonics?.liveApplyReady, false);
  assert.equal(symphonics?.mustNotDo?.some((rule) => rule.includes('create $PROJECTS_ROOT/thoughtseed/symphonics')), true);
  assert.equal(physicalLaneManifest.observedDrift.find(({ subject }) => subject === '_home-cleanup-2026-08-08')?.status, 'ignored-nonblocking-by-founder');
});

test('physical relocation preflight records cleanup drift as nonblocking without authorizing moves', () => {
  const preflightText = JSON.stringify(physicalLanePreflight);

  assert.equal(physicalLanePreflight.status, 'phase-1-preflight-passed-awaiting-explicit-live-apply-approval');
  assert.equal(physicalLanePreflight.founderDecision.cleanupDrift, 'ignore-nonblocking');
  assert.equal(physicalLanePreflight.founderDecision.liveApplyApproved, false);
  assert.equal(physicalLanePreflight.rootMapProof.depthOneCompareOnlyUnignoredDrift, true);
  assert.deepEqual(physicalLanePreflight.rootMapProof.ignoredDrift, ['_home-cleanup-2026-08-08']);
  assert.equal(physicalLanePreflight.phase1CambiumProof.canonicalSlot.exists, true);
  assert.equal(physicalLanePreflight.phase1CambiumProof.canonicalSlot.gitProbe, 'not-a-git-repository');
  assert.equal(physicalLanePreflight.phase1CambiumProof.temporaryAuthorityCheckout.exists, true);
  assert.equal(physicalLanePreflight.phase1CambiumProof.temporaryAuthorityCheckout.gitProbe, 'exact-root');
  assert.equal(physicalLanePreflight.nextGate.filesystemMutationAuthorized, false);
  assert.equal(physicalLanePreflight.nextGate.requiredApprovalText, 'approve live apply phase 1 Cambium archive-first promote');
  assert.equal(preflightText.includes('/Volumes/'), false);
});

test('Cambium Phase 1 apply receipt proves recoverable promotion and preserves held boundaries', () => {
  const receiptText = JSON.stringify(physicalLanePhase1Receipt);

  assert.equal(physicalLanePhase1Receipt.status, 'applied-verified');
  assert.equal(physicalLanePhase1Receipt.phaseId, 'phase-1-cambium-archive-first-promote');
  assert.equal(physicalLanePhase1Receipt.approval.requiredText, 'approve live apply phase 1 Cambium archive-first promote');
  assert.equal(physicalLanePhase1Receipt.approval.matchedFounderMessage, true);
  assert.equal(physicalLanePhase1Receipt.approval.scope, 'phase-1-only');
  assert.equal(physicalLanePhase1Receipt.approval.consumed, true);
  assert.equal(physicalLanePhase1Receipt.postApply.canonicalSlot.gitIdentity, 'exact-root');
  assert.equal(physicalLanePhase1Receipt.postApply.canonicalSlot.remote, 'https://github.com/Sheshiyer/cambium.git');
  assert.equal(physicalLanePhase1Receipt.postApply.canonicalSlot.inode, '30620729');
  assert.equal(physicalLanePhase1Receipt.postApply.archivedPreAuthorityState.gitIdentity, 'not-a-git-repository');
  assert.equal(physicalLanePhase1Receipt.postApply.archivedPreAuthorityState.disposition, 'preserved-recoverable');
  assert.equal(physicalLanePhase1Receipt.postApply.archivedPreAuthorityState.inode, '30272996');
  assert.equal(physicalLanePhase1Receipt.postApply.temporaryAuthoritySiblingExists, false);
  assert.deepEqual(physicalLanePhase1Receipt.postApply.depthOneComparison, { expectedCount: 58, observedCount: 58, missing: [], unexpected: [], ok: true });
  assert.match(physicalLanePhase1Receipt.postApply.rootMap.snapshotDigest, /^[0-9a-f]{64}$/);
  assert.match(physicalLanePhase1Receipt.postApply.rootMap.fileSha256, /^[0-9a-f]{64}$/);
  assert.equal(physicalLanePhase1Receipt.heldBoundaries.symphonicsExists, false);
  assert.equal(physicalLanePhase1Receipt.heldBoundaries.temperanceMutationPerformed, false);
  assert.equal(Object.values(physicalLanePhase1Receipt.externalMutation).every((performed) => performed === false), true);
  assert.equal(receiptText.includes('/Volumes/'), false);
});

test('Temperance Phase 2 preflight preserves local state and requires exact live approval', () => {
  const preflightText = JSON.stringify(physicalLanePhase2Preflight);

  assert.equal(physicalLanePhase2Preflight.status, 'preflight-passed-awaiting-explicit-live-apply-approval');
  assert.equal(physicalLanePhase2Preflight.phaseId, 'phase-2-temperance-landing-page-promote-authority');
  assert.equal(physicalLanePhase2Preflight.approval.reconciliationApproved, true);
  assert.equal(physicalLanePhase2Preflight.approval.liveApplyApproved, false);
  assert.equal(physicalLanePhase2Preflight.approval.filesystemMutationAuthorized, false);
  assert.equal(physicalLanePhase2Preflight.approval.requiredText, 'approve live apply phase 2 Temperance archive-first promote preserve website container');
  assert.equal(physicalLanePhase2Preflight.preApply.shallowSlot.gitIdentity, 'not-a-git-repository');
  assert.equal(physicalLanePhase2Preflight.preApply.nestedAuthorityCheckout.gitIdentity, 'exact-root');
  assert.equal(physicalLanePhase2Preflight.preApply.nestedAuthorityCheckout.remote, 'https://github.com/Sheshiyer/temperance_engine_landing_page.git');
  assert.deepEqual(physicalLanePhase2Preflight.preApply.nestedAuthorityCheckout.porcelainStatus, ['?? _PROJECT-STATUS.md']);
  assert.equal(physicalLanePhase2Preflight.preApply.archiveTargets.bothAbsent, true);
  assert.deepEqual(physicalLanePhase2Preflight.preApply.rootMap.missing, []);
  assert.deepEqual(physicalLanePhase2Preflight.preApply.rootMap.unexpected, []);
  assert.equal(physicalLanePhase2Preflight.contentReconciliation.identicalNonSensitiveCount, 50);
  assert.deepEqual(physicalLanePhase2Preflight.contentReconciliation.shallowOnlyNonSensitive.map(({ path }) => path), ['public/.DS_Store']);
  assert.deepEqual(physicalLanePhase2Preflight.contentReconciliation.nestedOnlyNonSensitive, []);
  assert.deepEqual(physicalLanePhase2Preflight.contentReconciliation.changedNonSensitive.map(({ path }) => path), ['.DS_Store', '.gitignore']);
  assert.equal(physicalLanePhase2Preflight.contentReconciliation.untrackedProjectStatus.path, '_PROJECT-STATUS.md');
  assert.equal(physicalLanePhase2Preflight.contentReconciliation.untrackedProjectStatus.identicalToShallowCounterpart, true);
  assert.match(physicalLanePhase2Preflight.contentReconciliation.untrackedProjectStatus.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(physicalLanePhase2Preflight.contentReconciliation.sensitiveIgnoredState, {
    commonFileCount: 1,
    onlyOneSideCount: 0,
    metadataDifferenceCount: 0,
    contentInspected: false,
    contentHashed: false,
    pathRecorded: false,
    preservation: 'both containing trees remain intact through archive-first movement',
  });
  assert.equal(physicalLanePhase2Preflight.containerDecision.decision, 'preserve-empty-container-as-infrastructure');
  assert.deepEqual(physicalLanePhase2Preflight.containerDecision.postApplyChildren, []);
  assert.equal(physicalLanePhase2Preflight.containerDecision.rootMapChangeExpected, false);
  assert.deepEqual(physicalLanePhase2Preflight.proposedOperationsAfterExactApproval.map(({ order }) => order), [1, 2, 3, 4, 5, 6]);
  assert.equal(Object.keys(physicalLanePhase2Preflight.rollback).length, 3);
  assert.equal(Object.values(physicalLanePhase2Preflight.rollback).every((steps) => steps.at(-1)?.includes('remove that directory')), true);
  assert.equal(physicalLanePhase2Preflight.postApplyRequirements.rootMapExpectedCount, 58);
  assert.equal(physicalLanePhase2Preflight.postApplyRequirements.rootMapObservedCount, 58);
  assert.equal(physicalLanePhase2Preflight.postApplyRequirements.rootMapDigest, physicalLanePhase2Preflight.preApply.rootMap.snapshotDigest);
  assert.equal(Object.values(physicalLanePhase2Preflight.externalMutation).every((performed) => performed === false), true);
  assert.equal(preflightText.includes('/Volumes/'), false);
  assert.equal(preflightText.includes('.env'), false);
});

test('Temperance Phase 2 apply receipt proves archive-first promotion and preserved boundaries', () => {
  const receiptText = JSON.stringify(physicalLanePhase2Receipt);

  assert.equal(physicalLanePhase2Receipt.status, 'applied-verified');
  assert.equal(physicalLanePhase2Receipt.phaseId, 'phase-2-temperance-landing-page-promote-authority');
  assert.equal(physicalLanePhase2Receipt.approval.requiredText, 'approve live apply phase 2 Temperance archive-first promote preserve website container');
  assert.equal(physicalLanePhase2Receipt.approval.matchedFounderMessage, true);
  assert.equal(physicalLanePhase2Receipt.approval.scope, 'phase-2-only');
  assert.equal(physicalLanePhase2Receipt.approval.consumed, true);
  assert.deepEqual(physicalLanePhase2Receipt.operations.map(({ order }) => order), [1, 2, 3, 4, 5, 6]);
  assert.equal(physicalLanePhase2Receipt.postApply.canonicalSlot.gitIdentity, 'exact-root');
  assert.equal(physicalLanePhase2Receipt.postApply.canonicalSlot.remote, 'https://github.com/Sheshiyer/temperance_engine_landing_page.git');
  assert.equal(physicalLanePhase2Receipt.postApply.canonicalSlot.inode, '20463948');
  assert.equal(physicalLanePhase2Receipt.postApply.canonicalSlot.workingTreeClean, true);
  assert.equal(physicalLanePhase2Receipt.postApply.archivedShallowState.gitIdentity, 'not-a-git-repository');
  assert.equal(physicalLanePhase2Receipt.postApply.archivedShallowState.disposition, 'preserved-recoverable');
  assert.equal(physicalLanePhase2Receipt.postApply.archivedShallowState.inode, '30366279');
  assert.equal(physicalLanePhase2Receipt.postApply.archivedShallowState.regularFileCount, 54);
  assert.equal(physicalLanePhase2Receipt.postApply.archivedNestedLocalState.inode, '30694077');
  assert.deepEqual(physicalLanePhase2Receipt.postApply.archivedNestedLocalState.children, ['_PROJECT-STATUS.md']);
  assert.match(physicalLanePhase2Receipt.postApply.archivedNestedLocalState.statusFileSha256, /^[0-9a-f]{64}$/);
  assert.equal(physicalLanePhase2Receipt.postApply.container.role, 'infrastructure-container');
  assert.equal(physicalLanePhase2Receipt.postApply.container.inode, '30575091');
  assert.deepEqual(physicalLanePhase2Receipt.postApply.container.children, []);
  assert.equal(physicalLanePhase2Receipt.postApply.formerNestedAuthorityPathExists, false);
  assert.deepEqual(physicalLanePhase2Receipt.postApply.depthOneComparison, { expectedCount: 58, observedCount: 58, missing: [], unexpected: [], ok: true });
  assert.equal(physicalLanePhase2Receipt.postApply.rootMap.changed, false);
  assert.match(physicalLanePhase2Receipt.postApply.rootMap.snapshotDigest, /^[0-9a-f]{64}$/);
  assert.match(physicalLanePhase2Receipt.postApply.rootMap.fileSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(physicalLanePhase2Receipt.postApply.sensitiveIgnoredState, {
    contentInspected: false,
    contentHashed: false,
    pathRecorded: false,
    disposition: 'remains contained inside the promoted authority and archived shallow trees',
  });
  assert.equal(physicalLanePhase2Receipt.rollback.available, true);
  assert.equal(physicalLanePhase2Receipt.rollback.steps.length, 4);
  assert.equal(physicalLanePhase2Receipt.heldBoundaries.thoughtseedLabsInodeBeforeAndAfter, '30565745');
  assert.equal(physicalLanePhase2Receipt.heldBoundaries.symphonicsExists, false);
  assert.equal(physicalLanePhase2Receipt.heldBoundaries.websiteWorkObjectCreated, false);
  assert.equal(physicalLanePhase2Receipt.heldBoundaries.shallowGitignoreMergedIntoAuthority, false);
  assert.equal(physicalLanePhase2Receipt.externalMutation.filesystemMutationPerformed, true);
  assert.equal(physicalLanePhase2Receipt.externalMutation.contentDeletionPerformed, false);
  assert.equal(Object.entries(physicalLanePhase2Receipt.externalMutation)
    .filter(([key]) => !['filesystemMutationPerformed', 'contentDeletionPerformed'].includes(key))
    .every(([, performed]) => performed === false), true);
  assert.equal(receiptText.includes('/Volumes/'), false);
  assert.equal(receiptText.includes('.env'), false);
});
