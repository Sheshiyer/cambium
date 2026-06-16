import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleProjectEvidence, type ProjectSignals } from './project-evidence.ts';

test('assembleProjectEvidence reflects empty signals as all-false / zero', () => {
  const out = assembleProjectEvidence({});
  assert.equal(out.briefStatus, 'draft');
  assert.equal(out.contractExists, false);
  assert.equal(out.depositReceived, false);
  assert.equal(out.repoExists, false);
  assert.equal(out.tenantProvisioned, false);
  assert.equal(out.specsFrozen, false);
  assert.equal(out.buildCommits, 0);
  assert.equal(out.reviewEvents, 0);
  assert.equal(out.gateApprovals, 0);
  assert.equal(out.deployEvents, 0);
  assert.equal(out.clientSignOff, false);
  assert.equal(out.lessonsMinted, 0);
  assert.equal(out.projectArchived, false);
});

test('assembleProjectEvidence reflects fully-populated signals', () => {
  const signals: ProjectSignals = {
    vault: { briefStatus: 'accepted', contractFound: true, depositRecorded: true, specFound: true, signOffRecorded: true },
    repo: { exists: true, commitsOnMain: 42 },
    tenant: { worldExists: true },
    reviews: { count: 3 },
    gate: { approvals: 1 },
    deploys: { count: 2 },
    skills: { lessonsMinted: 4, archived: true },
  };
  const out = assembleProjectEvidence(signals);
  assert.equal(out.briefStatus, 'accepted');
  assert.equal(out.contractExists, true);
  assert.equal(out.depositReceived, true);
  assert.equal(out.repoExists, true);
  assert.equal(out.buildCommits, 42);
  assert.equal(out.tenantProvisioned, true);
  assert.equal(out.specsFrozen, true);
  assert.equal(out.reviewEvents, 3);
  assert.equal(out.gateApprovals, 1);
  assert.equal(out.deployEvents, 2);
  assert.equal(out.clientSignOff, true);
  assert.equal(out.lessonsMinted, 4);
  assert.equal(out.projectArchived, true);
});

test('assembleProjectEvidence preserves the partial-signal honesty (vault unreachable ⇒ contract false)', () => {
  const out = assembleProjectEvidence({ repo: { exists: true, commitsOnMain: 5 } });
  assert.equal(out.contractExists, false);
  assert.equal(out.repoExists, true);
  assert.equal(out.buildCommits, 5);
});

test('gatherProjectSignals reviews are tenant-scoped (no global deviations bleed)', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-rev-');
  // Global deviations.jsonl with 5 entries — should NOT count toward this tenant.
  fs.writeFileSync(path.join(tmp, 'deviations.jsonl'), '{"a":1}\n{"a":2}\n{"a":3}\n{"a":4}\n{"a":5}\n');
  // No cortex/foo/deviations.jsonl — tenant-scoped file absent.
  const { gatherProjectSignals } = await import('./project-evidence.ts');
  const signals = gatherProjectSignals({ root: tmp } as any, 'foo');
  assert.equal(signals.reviews?.count, 0, 'no tenant-scoped reviews ⇒ 0, NOT a leak from global deviations.jsonl');
});

test('gatherProjectSignals counts tenant-scoped reviews when present', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-rev-');
  fs.mkdirSync(path.join(tmp, 'cortex', 'foo'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'cortex', 'foo', 'deviations.jsonl'), '{"r":1}\n{"r":2}\n{"r":3}\n');
  const { gatherProjectSignals } = await import('./project-evidence.ts');
  const signals = gatherProjectSignals({ root: tmp } as any, 'foo');
  assert.equal(signals.reviews?.count, 3);
});
