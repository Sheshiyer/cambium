import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { REPOSITORY_INVENTORY } from './repository-inventory.generated.ts';

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
  renameReadiness?: {
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
) as { batches: Batch[] };

const batch = queue.batches.find(({ batchId }) => batchId === 'github-batch-002-client-branch-clusters');
if (!batch) throw new Error('Batch 2 client branch queue is missing');
const batch4 = queue.batches.find(({ batchId }) => batchId === 'github-batch-004-internal-programs-and-vault');
if (!batch4) throw new Error('Batch 4 internal program queue is missing');
const batch5 = queue.batches.find(({ batchId }) => batchId === 'github-batch-005-root-map-catalog-repair');
if (!batch5) throw new Error('Batch 5 root-map repair queue is missing');

const repositoryName = (repositoryRef: string): string => repositoryRef.split('/').slice(0, 2).join('/');

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

  assert.equal(batch5.status, 'founder-reviewed-source-controlled-closeout-exclusion-ready-with-symphonics-founder-hold');
  assert.equal(batch5.summary.rowsReviewed, rows.length);
  assert.deepEqual([...byFolder.keys()].sort(), ['safvr', 'symphonics', 'virtualtryon-3d']);
  assert.equal(byFolder.get('virtualtryon-3d')?.status, 'complete-retired-ignore');
  assert.equal(byFolder.get('virtualtryon-3d')?.previousWorkId, 'sapling:virtualtryon');
  assert.equal(byFolder.get('safvr')?.status, 'complete-closed-client-branch');
  assert.equal(byFolder.get('safvr')?.closeoutArtifacts?.activeIndexDisposition, 'remove-from-active');
  assert.equal(byFolder.get('symphonics')?.status, 'founder-hold-missing-shallow-folder');
  assert.equal(byFolder.get('symphonics')?.relocationGate?.requiresFounderApprovedManifest, true);
  assert.equal(batch5.renameReadiness?.filesystemMutationAuthorized, false);
  assert.equal(batch5.renameReadiness?.shallowPortfolioRoot, '$PROJECTS_ROOT/thoughtseed');
  assert.equal(batch5.renameReadiness?.vaultContextRoot, '$PROJECTS_ROOT/thoughtseed/thoughtseed-labs');
  assert.match(batch5.renameReadiness?.thoughtseedLabsBoundary ?? '', /never a WorkObject folder/);
});
