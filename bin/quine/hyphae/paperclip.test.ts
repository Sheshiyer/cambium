import test from 'node:test';
import assert from 'node:assert/strict';

import { activePaperclipIssues, paperclipOpenItemForIssue } from './paperclip.ts';

test('paperclip archive notes keep THO-1 out of active work', () => {
  const active = activePaperclipIssues([
    {
      id: 'issue-1',
      identifier: 'THO-1',
      title: 'Historical Mathis blocker',
      status: 'blocked',
    },
    {
      id: 'issue-2',
      identifier: 'THO-2',
      title: 'Current work',
      status: 'done',
    },
  ], new Set(['THO-1']));

  assert.deepEqual(active.map((issue) => issue.identifier), ['THO-2']);
});

test('paperclip open items carry gate evidence and consequences', () => {
  const item = paperclipOpenItemForIssue({
    id: 'issue-9',
    identifier: 'THO-9',
    title: 'Review launch copy',
    status: 'blocked',
    assigneeAgentId: 'agent-1',
    updatedAt: '2026-06-22T00:00:00.000Z',
  }, new Map([['agent-1', 'Mathis']]));

  assert.equal(item.id, 'THO-9');
  assert.equal(item.owner, 'Mathis');
  assert.equal(item.updatedAt, '2026-06-22T00:00:00.000Z');
  assert.match(item.evidence, /THO-9 is blocked/);
  assert.match(item.evidence, /owner Mathis/);
  assert.match(item.approveConsequence, /approve THO-9/);
  assert.match(item.rerollConsequence, /reroll THO-9/);
  assert.match(item.reversibility, /superseded until consumed/);
  assert.equal(item.idempotencyHint, 'THO-9:blocked:2026-06-22T00:00:00.000Z');
  assert.equal(item.priority.source, 'paperclip-priority@v1');
  assert.equal(item.priority.risk, 'critical');
  assert.equal(item.priority.dependency, 'blocks-delivery');
  assert.ok(item.priority.score > 0);
  assert.match(item.priority.reasons.join(' · '), /blocked|delivery/);
});
