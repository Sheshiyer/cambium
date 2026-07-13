import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  auditActionRequestFixtureRows,
  auditOperationalMarkdown,
  auditRepository,
  auditViewportProofArtifact,
} from './drift-audit.mjs';

test('drift audit · rejects display fields absent from the public ActionRequest projection', () => {
  const failures = auditActionRequestFixtureRows([{
    schema: 'thoughtseed.action-request-list-item.v1',
    topic: { topicKey: 'clients', threadId: 804, sourceMessageId: '1068' },
    telegram: { messageId: 1068 },
    receiptExpectation: 'copied fixture prose',
  }]);

  assert.deepEqual(failures, [
    'ActionRequest fixture row 0 contains noncanonical field telegram',
    'ActionRequest fixture row 0 contains noncanonical field receiptExpectation',
  ]);
});

test('drift audit · rejects fixed live state instructions but allows historical evidence', () => {
  const active = auditOperationalMarkdown(
    'docs/runbooks/example.md',
    'Open Telegram message 1068. Close and reopen the Mini App. Tap Confirm signed exactly once.',
  );
  assert.ok(active.some((failure) => /fixed Telegram message/.test(failure)));
  assert.ok(active.some((failure) => /fixed ActionRequest state/.test(failure)));

  const historical = auditOperationalMarkdown(
    'docs/plans/2026-07-10-example.md',
    '> Lifecycle: historical; non-operational.\n\nEvidence captured message 1068 and Confirm signed.',
  );
  assert.deepEqual(historical, []);
});

test('drift audit · binds each canonical PNG to its manifest digest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cambium-proof-digest-'));
  await writeFile(join(root, 'proof.png'), 'canonical screenshot bytes');
  assert.deepEqual(await auditViewportProofArtifact(root, { path:'proof.png', sha256:'0'.repeat(64) }), [
    'viewport proof PNG digest mismatch for proof.png',
  ]);
});

test('drift audit · current repository has one canonical operational surface', async () => {
  const report = await auditRepository(new URL('..', import.meta.url));
  assert.equal(report.ok, true, report.failures.join('\n'));
  assert.deepEqual(report.failures, []);
});
