import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import {
  PortfolioAdminActionConflictError,
  PortfolioAdminActionQueueError,
  PortfolioAdminActionValidationError,
  createPortfolioAdminActionQueue,
  createPortfolioAdminActionStore,
  recordPortfolioAdminAction,
} from './portfolio-admin-actions.ts';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

const ROOT_DIGEST = '588f136a14cac55dbba30b11394288943c56bfebba2b700b4c2d25590747c52b';
const SOURCE_DIGEST = '50ba63b213debb1df57423c4edf97df79f29d5c77875245dbbc45251266902d2';

function thoughtseedInput(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'thoughtseed.portfolio-admin-action.v1',
    kind: 'reconcile-work-object',
    portfolioId: 'thoughtseed',
    idempotencyKey: 'save-sapling-cambium-1',
    rootMapDigest: ROOT_DIGEST,
    sourceDigest: SOURCE_DIGEST,
    subject: { id: 'sapling:cambium', name: 'Cambium' },
    proposal: {
      repositorySourceRef: 'repo:Sheshiyer/cambium',
      repositoryDisposition: 'resolved',
      origin: 'thoughtseed-venture',
      clientFamilyId: '',
      planningAuthority: {
        kind: 'repository',
        repositoryId: 'R_kgDOExample',
        fullName: 'Sheshiyer/cambium',
      },
      repositoryPlanningReviewed: true,
      githubIssuesReviewed: true,
      legacyEvidenceReviewed: true,
      note: 'Repository planning is authoritative; legacy evidence was reconciled.',
    },
    ...overrides,
  };
}

function noesisInput(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'thoughtseed.portfolio-admin-action.v1',
    kind: 'start-project-ingestion',
    portfolioId: 'tryambakam-noesis',
    idempotencyKey: 'ingest-astrolens-1',
    rootMapDigest: ROOT_DIGEST,
    subject: {
      id: 'astrolens',
      name: 'Astrolens',
      path: 'tryambakam-noesis/astrolens',
    },
    proposal: { status: 'awaiting-ingestion' },
    ...overrides,
  };
}

function fixtures() {
  const r2 = new Map<string, string>();
  const kv = new Map<string, string>();
  const events: string[] = [];
  const bucket = {
    async get(key: string) {
      const value = r2.get(key);
      return value === undefined ? null : { key, etag: `etag-${key}`, async text() { return value; } };
    },
    async put(key: string, value: Uint8Array, options?: { onlyIf?: { etagDoesNotMatch?: string } }) {
      events.push(`r2:${key}`);
      assert.equal(options?.onlyIf?.etagDoesNotMatch, '*');
      if (r2.has(key)) return null;
      r2.set(key, new TextDecoder().decode(value));
      return { key, etag: `etag-${key}`, async text() { return r2.get(key)!; } };
    },
  };
  const queueKv = {
    async get(key: string) { return kv.get(key) ?? null; },
    async put(key: string, value: string) {
      events.push(`kv:${key}`);
      kv.set(key, value);
    },
  };
  return { r2, kv, events, bucket, queueKv };
}

test('records immutable R2 evidence before queueing the governed next flow', async () => {
  const fixture = fixtures();
  const receipt = await recordPortfolioAdminAction(thoughtseedInput(), {
    store: createPortfolioAdminActionStore(fixture.bucket),
    queue: createPortfolioAdminActionQueue(fixture.queueKv),
    actorId: 'plexus:pid_founder',
    now: () => '2026-08-07T09:30:00.000Z',
  });

  assert.equal(receipt.schema, 'thoughtseed.portfolio-admin-action-receipt.v1');
  assert.equal(receipt.status, 'queued');
  assert.equal(receipt.nextFlow, 'repository-intake-review');
  assert.equal(receipt.duplicate, false);
  assert.match(receipt.actionDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(receipt.receiptId, /^pa_[0-9a-f]{24}$/);
  assert.equal(fixture.r2.size, 1);
  assert.equal(fixture.kv.size, 1);
  assert.equal(fixture.events[0].startsWith('r2:'), true);
  assert.equal(fixture.events[1].startsWith('kv:'), true);

  const evidence = JSON.parse([...fixture.r2.values()][0]);
  assert.equal(evidence.action.subject.id, 'sapling:cambium');
  assert.equal(evidence.action.proposal.planningAuthority.fullName, 'Sheshiyer/cambium');
  assert.match(evidence.actorDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(evidence).includes('pid_founder'), false);

  const trigger = JSON.parse([...fixture.kv.values()][0]);
  assert.equal(trigger.schema, 'thoughtseed.portfolio-admin-action-trigger.v1');
  assert.equal(trigger.status, 'pending-governed-intake');
  assert.equal(trigger.nextFlow, 'repository-intake-review');
  assert.equal('r2Key' in trigger, false);
});

test('exact replay returns the same receipt without duplicate R2 or queue writes', async () => {
  const fixture = fixtures();
  const deps = {
    store: createPortfolioAdminActionStore(fixture.bucket),
    queue: createPortfolioAdminActionQueue(fixture.queueKv),
    actorId: 'plexus:pid_founder',
    now: () => '2026-08-07T09:30:00.000Z',
  };
  const first = await recordPortfolioAdminAction(thoughtseedInput(), deps);
  const eventCount = fixture.events.length;
  const second = await recordPortfolioAdminAction(thoughtseedInput(), {
    ...deps,
    now: () => '2026-08-08T12:00:00.000Z',
  });

  assert.equal(second.receiptId, first.receiptId);
  assert.equal(second.actionDigest, first.actionDigest);
  assert.equal(second.recordedAt, first.recordedAt);
  assert.equal(second.duplicate, true);
  assert.equal(fixture.events.length, eventCount);
});

test('same idempotency key with different content is rejected as a conflict', async () => {
  const fixture = fixtures();
  const deps = {
    store: createPortfolioAdminActionStore(fixture.bucket),
    queue: createPortfolioAdminActionQueue(fixture.queueKv),
    actorId: 'plexus:pid_founder',
    now: () => '2026-08-07T09:30:00.000Z',
  };
  await recordPortfolioAdminAction(thoughtseedInput(), deps);
  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({
      proposal: { ...(thoughtseedInput().proposal as Record<string, unknown>), note: 'changed' },
    }), deps),
    PortfolioAdminActionConflictError,
  );
});

test('validates closed action grammar before any durable write', async () => {
  const fixture = fixtures();
  const deps = {
    store: createPortfolioAdminActionStore(fixture.bucket),
    queue: createPortfolioAdminActionQueue(fixture.queueKv),
    actorId: 'plexus:pid_founder',
    now: () => '2026-08-07T09:30:00.000Z',
  };

  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({ extra: true }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({ portfolioId: 'tryambakam-noesis' }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({
      proposal: { ...(thoughtseedInput().proposal as Record<string, unknown>), note: 'x'.repeat(401) },
    }), deps),
    PortfolioAdminActionValidationError,
  );
  assert.equal(fixture.events.length, 0);
});

test('binds Thoughtseed receipts to the shipped root map and catalog', async () => {
  const fixture = fixtures();
  const deps = {
    store: createPortfolioAdminActionStore(fixture.bucket),
    queue: createPortfolioAdminActionQueue(fixture.queueKv),
    actorId: 'plexus:pid_founder',
    now: () => '2026-08-07T09:30:00.000Z',
  };

  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({ rootMapDigest: '0'.repeat(64) }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({ sourceDigest: '0'.repeat(64) }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({ subject: { id: 'sapling:invented', name: 'Invented' } }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({ subject: { id: 'sapling:cambium', name: 'Renamed evidence' } }), deps),
    PortfolioAdminActionValidationError,
  );
  assert.equal(fixture.events.length, 0);
});

test('binds Tryambakam ingestion to one exact reviewed shallow project', async () => {
  const fixture = fixtures();
  const deps = {
    store: createPortfolioAdminActionStore(fixture.bucket),
    queue: createPortfolioAdminActionQueue(fixture.queueKv),
    actorId: 'plexus:pid_founder',
    now: () => '2026-08-07T09:30:00.000Z',
  };

  await assert.rejects(
    () => recordPortfolioAdminAction(noesisInput({ rootMapDigest: '0'.repeat(64) }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(noesisInput({
      subject: { id: 'astrolens', name: 'Astrolens', path: 'tryambakam-noesis/astrolens/nested' },
    }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(noesisInput({
      subject: { id: 'invented', name: 'Invented', path: 'tryambakam-noesis/invented' },
    }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(noesisInput({ proposal: { status: 'empty-hold' } }), deps),
    PortfolioAdminActionValidationError,
  );
  assert.equal(fixture.events.length, 0);
});

test('Tryambakam project ingestion queues Project grammar, never Client Branch grammar', async () => {
  const fixture = fixtures();
  const receipt = await recordPortfolioAdminAction(noesisInput(), {
    store: createPortfolioAdminActionStore(fixture.bucket),
    queue: createPortfolioAdminActionQueue(fixture.queueKv),
    actorId: 'telegram:200000001',
    now: () => '2026-08-07T09:30:00.000Z',
  });
  assert.equal(receipt.nextFlow, 'project-repository-ingestion');
  const trigger = JSON.parse([...fixture.kv.values()][0]);
  assert.equal(trigger.portfolioId, 'tryambakam-noesis');
  assert.equal(trigger.kind, 'start-project-ingestion');
  assert.equal(JSON.stringify(trigger).includes('client-branch'), false);
});

test('a queue failure reports durable evidence so retry can finish the trigger', async () => {
  const fixture = fixtures();
  const queue = createPortfolioAdminActionQueue({
    async get() { return null; },
    async put() { throw new Error('KV unavailable'); },
  });
  await assert.rejects(
    () => recordPortfolioAdminAction(noesisInput(), {
      store: createPortfolioAdminActionStore(fixture.bucket),
      queue,
      actorId: 'plexus:pid_founder',
      now: () => '2026-08-07T09:30:00.000Z',
    }),
    (error: unknown) => {
      assert.equal(error instanceof PortfolioAdminActionQueueError, true);
      assert.equal((error as PortfolioAdminActionQueueError).durable, true);
      assert.match((error as PortfolioAdminActionQueueError).receiptId, /^pa_/);
      return true;
    },
  );
  assert.equal(fixture.r2.size, 1);
});
