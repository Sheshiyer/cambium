import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('ISC-3467 snapshot stays dated behind the checked ISA evidence', () => {
  const closure = read('.planning/native-mac/ISC-3467-CLOSURE.md');
  const limits = read('.planning/native-mac/SNAPSHOT-LIMITS-20261109.md');
  const activation = read('.planning/native-mac/NATIVE-INBOX-ACTIVATION-20261103.md');
  const isa = read('ISA.md');
  assert.match(closure, /Dated observation, not current acceptance/);
  assert.match(closure, /NATIVE-INBOX-ACTIVATION-20261103\.md/);
  assert.match(isa, /\[x\] ISC-3467:/);
  assert.match(activation, /ISC-3467 and ISC-3672 are satisfied/);
  assert.match(activation, /Only migrations 0100, 0101 and 0102 were applied/);
  assert.match(limits, /0103_shared_directions\.sql/);
  assert.match(limits, /not a reversal/);
  assert.equal(readdirSync(path.join(root, 'workers/quests/migrations')).some((name) => name.startsWith('0103_')), false);
});

test('native roadmap does not claim all sixteen decisions are implemented', () => {
  const roadmap = read('.planning/native-mac/2026-11-02-ROADMAP.md');
  assert.match(roadmap, /remaining decisions, peer delivery, and production migration stay proposed/);
  assert.doesNotMatch(roadmap, /decisions are implemented/);
});

test('temperance goal keeps its text and names this repository', () => {
  const goal = JSON.parse(read('.temperance/goal.json'));
  assert.equal(goal.schema, 'temperance.goal.v1');
  assert.equal(goal.project_id, 'cambium');
  assert.equal(goal.gsd_command, 'plan-phase');
  assert.match(goal.text, /Thoughtseed Labs account/);
  assert.doesNotMatch(goal.text, /AxTech|Snow Gloves/i);
});

test('snapshot records do not carry machine paths or secret assignments', () => {
  const files = [
    '.planning/native-mac/SNAPSHOT-LIMITS-20261109.md',
    '.planning/native-mac/ISC-3467-CLOSURE.md',
    '.planning/native-mac/WORK-DIRECTION-ROLLOUT-RECEIPT-20261104.json',
    '.temperance/goal.json',
    'docs/plans/2026-11-02-temperance-hand-in-glove-handoff.md',
    'docs/evidence/2026-11-03-isc-3467-verification.json',
  ];
  for (const relativePath of files) {
    const body = read(relativePath);
    assert.doesNotMatch(body, /\/(?:Users|home|Volumes)\//, relativePath);
    assert.doesNotMatch(body, /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/, relativePath);
    assert.doesNotMatch(body, /(?:api[_-]?key|client[_-]?secret|password)\s*[:=]\s*["'][^"']{8,}/i, relativePath);
  }
});
