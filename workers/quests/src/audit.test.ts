// cambium-quests · audit-log tests (node:test style).
//
// Covers:
//   - append + list round-trip
//   - tenant partitioning (tenant A never sees tenant B events)
//   - frozen copies (mutating a returned event does not change the store)
//   - story-beat mapping contains action + decision + principalId
//   - denied events include reason in beat detail

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  appendAudit,
  auditToStoryBeat,
  listAudit,
  makeAuditStore,
  type AuditEvent,
} from './audit.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const allowedEvent: AuditEvent = {
  at: '2026-07-20T10:00:00.000Z',
  principalId: 'p-alice',
  tenant: 'thoughtseed',
  action: 'publish-branch',
  target: 'branch-argus',
  decision: 'allowed',
};

const deniedEvent: AuditEvent = {
  at: '2026-07-20T10:01:00.000Z',
  principalId: 'p-bob',
  tenant: 'thoughtseed',
  action: 'delete-branch',
  target: 'branch-argus',
  decision: 'denied',
  reason: 'insufficient role: consultant ceiling is read-only',
};

const otherTenantEvent: AuditEvent = {
  at: '2026-07-20T10:02:00.000Z',
  principalId: 'p-carol',
  tenant: 'acme',
  action: 'view-envelope',
  target: 'map-subsection:lanes',
  decision: 'allowed',
};

// ---------------------------------------------------------------------------
// append + list round-trip
// ---------------------------------------------------------------------------

test('append + list round-trip returns appended events in order', () => {
  const store = makeAuditStore();
  appendAudit(store, allowedEvent);
  appendAudit(store, deniedEvent);

  const events = listAudit(store, { tenant: 'thoughtseed' });
  assert.equal(events.length, 2);
  assert.equal(events[0].principalId, 'p-alice');
  assert.equal(events[0].decision, 'allowed');
  assert.equal(events[1].principalId, 'p-bob');
  assert.equal(events[1].decision, 'denied');
  assert.equal(events[1].reason, deniedEvent.reason);
});

test('listAudit respects limit (most recent N events)', () => {
  const store = makeAuditStore();
  appendAudit(store, allowedEvent);
  appendAudit(store, deniedEvent);

  const events = listAudit(store, { tenant: 'thoughtseed', limit: 1 });
  assert.equal(events.length, 1);
  assert.equal(events[0].principalId, 'p-bob');
});

test('listAudit filters by principalId', () => {
  const store = makeAuditStore();
  appendAudit(store, allowedEvent);
  appendAudit(store, deniedEvent);

  const aliceEvents = listAudit(store, { tenant: 'thoughtseed', principalId: 'p-alice' });
  assert.equal(aliceEvents.length, 1);
  assert.equal(aliceEvents[0].action, 'publish-branch');

  const bobEvents = listAudit(store, { tenant: 'thoughtseed', principalId: 'p-bob' });
  assert.equal(bobEvents.length, 1);
  assert.equal(bobEvents[0].action, 'delete-branch');

  const nobody = listAudit(store, { tenant: 'thoughtseed', principalId: 'p-nobody' });
  assert.equal(nobody.length, 0);
});

test('listAudit returns empty array for unknown tenant', () => {
  const store = makeAuditStore();
  const events = listAudit(store, { tenant: 'missing' });
  assert.deepEqual(events, []);
});

// ---------------------------------------------------------------------------
// Tenant partitioning
// ---------------------------------------------------------------------------

test('tenant partitioning: tenant A never sees tenant B events', () => {
  const store = makeAuditStore();
  appendAudit(store, allowedEvent);
  appendAudit(store, otherTenantEvent);

  const thoughtseedEvents = listAudit(store, { tenant: 'thoughtseed' });
  assert.equal(thoughtseedEvents.length, 1);
  assert.equal(thoughtseedEvents[0].principalId, 'p-alice');
  assert.equal(thoughtseedEvents[0].tenant, 'thoughtseed');

  const acmeEvents = listAudit(store, { tenant: 'acme' });
  assert.equal(acmeEvents.length, 1);
  assert.equal(acmeEvents[0].principalId, 'p-carol');
  assert.equal(acmeEvents[0].tenant, 'acme');
});

// ---------------------------------------------------------------------------
// Frozen copies
// ---------------------------------------------------------------------------

test('frozen copies: mutating a returned event does not change the store', () => {
  const store = makeAuditStore();
  appendAudit(store, allowedEvent);

  const events = listAudit(store, { tenant: 'thoughtseed' });
  assert.equal(events.length, 1);

  // Verify returned event is frozen
  assert.throws(
    () => {
      (events[0] as AuditEvent).action = 'hacked-action';
    },
    /object is not extensible|Cannot assign to read only property/i,
  );

  // Re-fetch and verify store is intact
  const refetched = listAudit(store, { tenant: 'thoughtseed' });
  assert.equal(refetched[0].action, 'publish-branch');
});

test('frozen copies: mutating append input does not change the store', () => {
  const store = makeAuditStore();
  const mutableEvent: AuditEvent = {
    at: '2026-07-20T10:00:00.000Z',
    principalId: 'p-eve',
    tenant: 'thoughtseed',
    action: 'original-action',
    target: 'branch-mock',
    decision: 'allowed',
  };
  appendAudit(store, mutableEvent);

  // Mutate the caller's copy after append
  mutableEvent.action = 'tampered-action';

  const events = listAudit(store, { tenant: 'thoughtseed' });
  assert.equal(events[0].action, 'original-action');
});

// ---------------------------------------------------------------------------
// Story-beat mapping
// ---------------------------------------------------------------------------

test('story-beat mapping for allowed event contains action + decision + principalId', () => {
  const beat = auditToStoryBeat(allowedEvent);
  assert.equal(beat.kind, 'audit');
  assert.equal(beat.title, 'publish-branch — allowed');
  assert.equal(beat.detail, 'p-alice → branch-argus');
  assert.equal(beat.at, allowedEvent.at);
  assert.ok(beat.id.startsWith('audit-'));
});

test('story-beat mapping for denied event includes reason in detail', () => {
  const beat = auditToStoryBeat(deniedEvent);
  assert.equal(beat.kind, 'audit');
  assert.equal(beat.title, 'delete-branch — denied');
  assert.ok(beat.detail.includes('insufficient role'));
  assert.ok(beat.detail.includes('delete-branch'));
  assert.ok(beat.detail.includes('branch-argus'));
  assert.equal(beat.at, deniedEvent.at);
});

test('story-beat mapping for denied event without reason still works', () => {
  const noReason: AuditEvent = {
    at: '2026-07-20T11:00:00.000Z',
    principalId: 'p-frank',
    tenant: 'thoughtseed',
    action: 'secret-action',
    target: 'vault',
    decision: 'denied',
  };
  const beat = auditToStoryBeat(noReason);
  assert.equal(beat.title, 'secret-action — denied');
  assert.equal(beat.detail, 'Denied secret-action on vault');
  assert.ok(beat.id.startsWith('audit-'));
});
