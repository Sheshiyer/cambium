import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBranchMapProjection } from './branch-map.ts';
import type { GoalGraphNode } from './goal-graph/types.ts';
import {
  BRANCH_MAP_SHEET_SCHEMA,
  buildBranchMapSheet,
  redactBranchMapSourceRef,
  renderBranchMapSheet,
  validateBranchMapProjectionForSheet,
} from './branch-map-sheet.ts';

function node(nodeId: string, branchId: string, sourceRef = `docs/branches/${branchId}.md`): GoalGraphNode {
  return {
    nodeId,
    tenantId: 'tenant-alpha',
    namespace: branchId,
    externalId: null,
    parentNodeId: null,
    scope: 'macro',
    desiredState: 'proof',
    currentState: 'active',
    owner: 'founder',
    nextAction: 'review',
    waitCondition: null,
    proofRequired: true,
    reviewAt: null,
    status: 'active',
    sourceRef,
    sourceDigest: `sha256:${'a'.repeat(64)}`,
    graphVersion: 7,
    metadata: { organ: 'Hands' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function projection() {
  const first = node('node-a', 'branch-a');
  const second = node('node-b', 'branch-b');
  const sourceReceipt = {
    receiptId: 'receipt-a', tenantId: 'tenant-alpha', branchId: 'branch-a', organId: 'organ-hands', organName: 'Hands',
    fromNodeId: null, toNodeId: 'node-a', observedAt: '2026-01-02T00:00:00.000Z', evidenceRefs: ['evidence:a'],
    sourceRef: first.sourceRef, sourceDigest: first.sourceDigest, graphVersion: 7, status: 'verified' as const,
  };
  const built = buildBranchMapProjection({
    tenantId: 'tenant-alpha', graphVersion: 7, graphDigest: `sha256:${'b'.repeat(64)}`,
    generatedAt: '2026-01-03T00:00:00.000Z', sourceRef: 'goal-graph:receipt:7', nodes: [second, first],
    branches: [
      { branchId: 'branch-b', label: 'Beta', nodeIds: ['node-b'] },
      { branchId: 'branch-a', label: 'Alpha', nodeIds: ['node-a'] },
    ],
    receipts: [sourceReceipt],
    lineage: [],
    campaignOverlays: [{ overlayId: 'campaign-a', branchId: 'branch-a', label: 'Launch', status: 'observed-active', sourceRef: 'campaign:launch', observedAt: null, freshness: 'fresh' as const }],
    wikiOverlays: [{ overlayId: 'wiki-a', branchId: 'branch-a', label: 'Runbook', status: 'linked', sourceRef: 'wiki:runbook', observedAt: null, freshness: 'fresh' as const }],
  });
  assert.equal(built.accepted, true);
  if (!built.accepted) throw new Error(built.errors.join('; '));
  return built.projection;
}

test('sheet is versioned, read-only, deterministic, and covers every row kind', () => {
  const input = projection();
  const first = renderBranchMapSheet(input);
  const second = buildBranchMapSheet({ ...input, branches: [...input.branches].reverse() });
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  if (!first.accepted || !second.accepted) return;
  assert.equal(first.sheet.schema, BRANCH_MAP_SHEET_SCHEMA);
  assert.deepEqual(first.sheet.rows, second.sheet.rows);
  assert.match(first.sheet.text, /Branch map · tenant-alpha · graph 7 · generated=2026-01-03T00:00:00.000Z/);
  assert.equal(first.sheet.generatedAt, input.generatedAt);
  assert.equal(first.sheet.projectionDigest, input.projectionDigest);
  assert.deepEqual(first.sheet.rows.map((row) => row.kind), ['branch', 'branch', 'organ', 'receipt', 'campaign', 'wiki', 'gap', 'gap', 'gap']);
  assert.equal(first.sheet.rows.find((row) => row.kind === 'branch')?.sourceRef, 'docs/branches/branch-a.md');
  assert.equal(first.sheet.rows.find((row) => row.kind === 'receipt')?.status, 'verified');
  assert.equal(first.sheet.rows.find((row) => row.kind === 'campaign')?.status, 'observed-active');
  assert.equal(first.sheet.rows.find((row) => row.kind === 'wiki')?.status, 'linked');
  assert.equal(first.sheet.rows.find((row) => row.kind === 'gap')?.status, 'unknown');
});

test('source references redact labeled secrets and opaque credentials', () => {
  const source = 'https://example.test/run?token=super-secret&chat_id=12345';
  const redacted = redactBranchMapSourceRef(source);
  assert.equal(redacted, 'https://example.test/run?token=[REDACTED]&chat_id=[REDACTED]');
  assert.doesNotMatch(redacted ?? '', /super-secret|12345/);
  assert.equal(redactBranchMapSourceRef('https://example.test/secret/path-secret'), 'https://example.test/secret/[REDACTED]');
  assert.equal(redactBranchMapSourceRef('token=standalone-secret'), 'token=[REDACTED]');

  const result = renderBranchMapSheet(projection(), { maxTextLength: 4096 });
  assert.equal(result.accepted, true);
  if (result.accepted) assert.doesNotMatch(result.sheet.text, /Bearer|api[_-]?key|password|secret/i);
});

test('sheet rows and text remain bounded with deterministic overflow', () => {
  const result = renderBranchMapSheet(projection(), { maxRows: 3, maxTextLength: 240, maxRowLength: 80 });
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.equal(result.sheet.rows.length, 3);
  assert.equal(result.sheet.truncated, true);
  assert.ok(result.sheet.text.length <= 240);
  assert.equal(result.sheet.counts.branch, 2);
});

test('invalid or malformed projections fail closed before Telegram rendering', () => {
  const input = projection();
  assert.equal(validateBranchMapProjectionForSheet({ ...input, schema: 'other.v1' }).valid, false);
  const result = renderBranchMapSheet({ ...input, overlays: null } as never);
  assert.equal(result.accepted, false);
  if (!result.accepted) assert.match(result.errors.join(' '), /projection envelope is invalid/i);
});
