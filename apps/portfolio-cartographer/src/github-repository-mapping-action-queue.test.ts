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

type Batch = {
  batchId: string;
  summary: Record<string, number>;
  clusters: Cluster[];
};

const queue = JSON.parse(
  readFileSync(new URL('../../../docs/project-management/github-repository-mapping-action-queue.v1.json', import.meta.url), 'utf8'),
) as { batches: Batch[] };

const batch = queue.batches.find(({ batchId }) => batchId === 'github-batch-002-client-branch-clusters');
if (!batch) throw new Error('Batch 2 client branch queue is missing');

const repositoryName = (repositoryRef: string): string => repositoryRef.split('/').slice(0, 2).join('/');

test('Batch 2 summary matches the executable queue', () => {
  const candidates = batch.clusters.flatMap(({ candidateRepos }) => candidateRepos);
  const holds = batch.clusters.flatMap(({ holdRepos = [] }) => holdRepos);
  const assignments = batch.clusters.flatMap(({ resolvedAssignments }) => resolvedAssignments);
  const workIds = new Set(batch.clusters.flatMap(({ workIds }) => workIds));
  const assignedWorkIds = new Set(assignments.map(({ workId }) => workId));
  const rootMapBlocked = assignments.filter(({ receiptStatus }) => receiptStatus === 'blocked-missing-shallow-folder');
  const inventoryNames = new Set(REPOSITORY_INVENTORY.map(({ fullName }) => fullName.toLowerCase()));
  const unavailable = [...new Set([...candidates, ...holds].filter((name) => !inventoryNames.has(name.toLowerCase())))];
  const unavailableCandidates = candidates.filter((name) => !inventoryNames.has(name.toLowerCase()));
  const holdOrUnavailable = new Set([...holds, ...unavailable].map((name) => name.toLowerCase()));

  assert.equal(batch.summary.clientFamiliesReviewed, batch.clusters.length);
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
    batch.clusters.flatMap(({ unavailableCandidateRepos = [] }) => unavailableCandidateRepos.map((name) => name.toLowerCase())),
  );

  for (const cluster of batch.clusters) {
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
  const blocked = batch.clusters.flatMap(({ resolvedAssignments }) =>
    resolvedAssignments.filter(({ receiptStatus }) => receiptStatus === 'blocked-missing-shallow-folder'),
  );

  assert.deepEqual(blocked.map(({ workId }) => workId), ['branch:symphonics']);
  assert.equal(batch.clusters.find(({ requiresRootMapRepair }) => requiresRootMapRepair)?.requiresRootMapRepair, true);
});
