import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import {
  PortfolioAdminActionConflictError,
  PortfolioAdminActionQueueError,
  PortfolioAdminActionValidationError,
  createPortfolioAdminActionQueue,
  createPortfolioAdminActionStore,
  createPortfolioFounderGateResolver,
  projectCreationIntentDigest,
  recordPortfolioAdminAction,
} from './portfolio-admin-actions.ts';
import {
  PORTFOLIO_CATALOG,
  PORTFOLIO_DISPLAY_CATALOG_DIGEST,
  PORTFOLIO_CLASSIFICATION_DIGEST,
} from './portfolio-catalog.ts';
import {
  PORTFOLIO_ROOT_MAP_DIGEST,
  REVIEWED_PORTFOLIO_ROOT_MAP_DIGEST,
} from './portfolio-root-map.generated.ts';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

const ROOT_DIGEST = REVIEWED_PORTFOLIO_ROOT_MAP_DIGEST;
const SOURCE_DIGEST = PORTFOLIO_CLASSIFICATION_DIGEST;
const CATALOG_DIGEST = PORTFOLIO_CATALOG.catalogDigest;

function thoughtseedInput(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'thoughtseed.portfolio-admin-action.v1',
    kind: 'reconcile-work-object',
    portfolioId: 'thoughtseed',
    idempotencyKey: 'save-sapling-cambium-1',
    rootMapDigest: ROOT_DIGEST,
    sourceDigest: SOURCE_DIGEST,
    catalogDigest: CATALOG_DIGEST,
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

function projectCreationInput(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'thoughtseed.portfolio-admin-action.v1',
    kind: 'create-thoughtseed-project',
    portfolioId: 'thoughtseed',
    idempotencyKey: 'create-project-nova-1',
    rootMapDigest: ROOT_DIGEST,
    sourceDigest: SOURCE_DIGEST,
    catalogDigest: CATALOG_DIGEST,
    subject: { id: 'project-nova', name: 'Project Nova' },
    proposal: {
      intentSchema: 'thoughtseed.project-creation-intent.v1',
      requestSource: 'local-founder',
      name: 'Project Nova',
      slug: 'project-nova',
      origin: 'thoughtseed-venture',
      clientFamilyId: '',
      founderApproval: null,
    },
    ...overrides,
  };
}

function closeoutInput(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'thoughtseed.portfolio-admin-action.v1',
    kind: 'close-work-object',
    portfolioId: 'thoughtseed',
    idempotencyKey: 'close-cambium-1',
    rootMapDigest: ROOT_DIGEST,
    sourceDigest: SOURCE_DIGEST,
    catalogDigest: CATALOG_DIGEST,
    subject: { id: 'sapling:cambium', name: 'Cambium' },
    proposal: {
      closeoutSchema: 'thoughtseed.project-closeout.v1',
      disposition: 'completed',
      finalSummary: 'Founder reviewed final handoff, receipts, memory projection, and finished-index delta.',
      handoffMarkdownPath: '.project/HANDOFF.md',
      closureReceiptJsonPath: '.project/project-closeout-receipt.v1.json',
      agentMemoryJsonPath: '.project/agent-memory-projection.v1.json',
      r2VaultPrefix: 'project-closeouts/v1/thoughtseed/sapling-cambium',
      activeIndexDisposition: 'remove-from-active',
      repositoryFinalStateReviewed: true,
      handoffDocumented: true,
      r2VaultRecorded: true,
      agentMemoryUpdated: true,
      activeIndexUpdated: true,
      downstreamFlowsStopped: true,
      successorWorkObjectId: '',
    },
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
    () => recordPortfolioAdminAction(thoughtseedInput({ rootMapDigest: PORTFOLIO_ROOT_MAP_DIGEST }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({ sourceDigest: '0'.repeat(64) }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({ catalogDigest: `sha256:${'0'.repeat(64)}` }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({ catalogDigest: PORTFOLIO_DISPLAY_CATALOG_DIGEST }), deps),
    /catalogDigest does not match the shipped portfolio catalog/,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({ subject: { id: 'sapling:invented', name: 'Invented' } }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({
      subject: { id: 'branch:codigo-olimpo', name: 'Codigo Olimpo (Brick And Mortar Client Acquisition FZCO)' },
    }), deps),
    /subject does not match the shipped portfolio catalog/,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(thoughtseedInput({ subject: { id: 'sapling:cambium', name: 'Renamed evidence' } }), deps),
    PortfolioAdminActionValidationError,
  );
  assert.equal(fixture.events.length, 0);
});

test('rejects retired Tryambakam actions and unsafe Thoughtseed creation paths', async () => {
  const fixture = fixtures();
  const deps = {
    store: createPortfolioAdminActionStore(fixture.bucket),
    queue: createPortfolioAdminActionQueue(fixture.queueKv),
    actorId: 'plexus:pid_founder',
    now: () => '2026-08-07T09:30:00.000Z',
  };

  await assert.rejects(
    () => recordPortfolioAdminAction({
      schema: 'thoughtseed.portfolio-admin-action.v1',
      kind: 'start-project-ingestion',
      portfolioId: 'tryambakam-noesis',
      idempotencyKey: 'retired-noesis-action',
      rootMapDigest: ROOT_DIGEST,
      subject: { id: 'astrolens', name: 'Astrolens', path: 'tryambakam-noesis/astrolens' },
      proposal: { status: 'awaiting-ingestion' },
    }, deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(projectCreationInput({
      subject: { id: '../nested', name: 'Nested' },
      proposal: { ...(projectCreationInput().proposal as Record<string, unknown>), name: 'Nested', slug: '../nested' },
    }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(projectCreationInput({ portfolioId: 'tryambakam-noesis' }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(projectCreationInput({
      proposal: { ...(projectCreationInput().proposal as Record<string, unknown>), origin: 'client', clientFamilyId: '' },
    }), deps),
    PortfolioAdminActionValidationError,
  );
  assert.equal(fixture.events.length, 0);
});

test('explicit local-founder creation derives grammar and becomes execution-ready', async () => {
  const fixture = fixtures();
  const receipt = await recordPortfolioAdminAction(projectCreationInput(), {
    store: createPortfolioAdminActionStore(fixture.bucket),
    queue: createPortfolioAdminActionQueue(fixture.queueKv),
    actorId: 'plexus:pid_founder',
    now: () => '2026-08-07T09:30:00.000Z',
  });
  assert.equal(receipt.nextFlow, 'project-creation-execution');
  assert.equal(receipt.approvalStatus, 'execution-ready');
  const evidence = JSON.parse([...fixture.r2.values()][0]);
  assert.equal(evidence.action.proposal.derivedKind, 'sapling');
  assert.equal('path' in evidence.action.subject, false);
  const trigger = JSON.parse([...fixture.kv.values()][0]);
  assert.equal(trigger.portfolioId, 'thoughtseed');
  assert.equal(trigger.kind, 'create-thoughtseed-project');
  assert.equal(trigger.status, 'execution-ready');
});

test('closeout records immutable R2 evidence before queuing the project-closeout flow', async () => {
  const fixture = fixtures();
  const receipt = await recordPortfolioAdminAction(closeoutInput(), {
    store: createPortfolioAdminActionStore(fixture.bucket),
    queue: createPortfolioAdminActionQueue(fixture.queueKv),
    actorId: 'plexus:pid_founder',
    now: () => '2026-08-08T05:30:00.000Z',
  });

  assert.equal(receipt.status, 'queued');
  assert.equal(receipt.nextFlow, 'project-closeout');
  assert.equal(receipt.approvalStatus, null);
  assert.equal(fixture.events[0].startsWith('r2:'), true);
  assert.equal(fixture.events[1].startsWith('kv:'), true);

  const evidence = JSON.parse([...fixture.r2.values()][0]);
  assert.equal(evidence.nextFlow, 'project-closeout');
  assert.equal(evidence.action.kind, 'close-work-object');
  assert.equal(evidence.action.proposal.closeoutSchema, 'thoughtseed.project-closeout.v1');
  assert.equal(evidence.action.proposal.agentMemoryJsonPath, '.project/agent-memory-projection.v1.json');
  assert.equal(evidence.action.proposal.activeIndexDisposition, 'remove-from-active');

  const trigger = JSON.parse([...fixture.kv.values()][0]);
  assert.equal(trigger.kind, 'close-work-object');
  assert.equal(trigger.status, 'pending-project-closeout');
  assert.equal(trigger.nextFlow, 'project-closeout');
  assert.equal('r2Key' in trigger, false);
});

test('incomplete closeout cannot write durable evidence or leave active workflow', async () => {
  const fixture = fixtures();
  const deps = {
    store: createPortfolioAdminActionStore(fixture.bucket),
    queue: createPortfolioAdminActionQueue(fixture.queueKv),
    actorId: 'plexus:pid_founder',
    now: () => '2026-08-08T05:30:00.000Z',
  };

  await assert.rejects(
    () => recordPortfolioAdminAction(closeoutInput({
      proposal: {
        ...(closeoutInput().proposal as Record<string, unknown>),
        handoffDocumented: false,
      },
    }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(closeoutInput({
      proposal: {
        ...(closeoutInput().proposal as Record<string, unknown>),
        r2VaultPrefix: 'project-closeouts/v1/thoughtseed/program-wrong-object',
      },
    }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(closeoutInput({
      proposal: {
        ...(closeoutInput().proposal as Record<string, unknown>),
        successorWorkObjectId: 'folder-name-not-a-work-id',
      },
    }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(closeoutInput({
      proposal: {
        ...(closeoutInput().proposal as Record<string, unknown>),
        r2VaultPrefix: '../escape',
      },
    }), deps),
    PortfolioAdminActionValidationError,
  );
  await assert.rejects(
    () => recordPortfolioAdminAction(closeoutInput({
      proposal: {
        ...(closeoutInput().proposal as Record<string, unknown>),
        agentMemoryJsonPath: 'secret/memory.txt',
      },
    }), deps),
    PortfolioAdminActionValidationError,
  );
  assert.equal(fixture.events.length, 0);
});

test('agent creation stays Founder-Gate-pending until exact intent approval', async () => {
  const pendingFixture = fixtures();
  const agentInput = projectCreationInput({
    idempotencyKey: 'agent-project-nova-1',
    proposal: { ...(projectCreationInput().proposal as Record<string, unknown>), requestSource: 'agent' },
  });
  const pending = await recordPortfolioAdminAction(agentInput, {
    store: createPortfolioAdminActionStore(pendingFixture.bucket),
    queue: createPortfolioAdminActionQueue(pendingFixture.queueKv),
    actorId: 'plexus:pid_founder',
    now: () => '2026-08-07T09:30:00.000Z',
  });
  assert.equal(pending.nextFlow, 'founder-gate-review');
  assert.equal(pending.approvalStatus, 'founder-gate-pending');
  assert.equal(JSON.parse([...pendingFixture.kv.values()][0]).status, 'founder-gate-pending');

  const approvedFixture = fixtures();
  const intentDigest = await projectCreationIntentDigest(agentInput);
  approvedFixture.kv.set('gate:thoughtseed:gate_project_nova_approved', JSON.stringify({
    id: 'gate_project_nova_approved',
    kind: 'approve',
    subject: intentDigest,
    founderId: 'founder-1',
    status: 'queued',
  }));
  const approvedInput = projectCreationInput({
    idempotencyKey: 'agent-project-nova-approved-1',
    proposal: {
      ...(agentInput.proposal as Record<string, unknown>),
      founderApproval: { receiptId: 'gate_project_nova_approved', intentDigest },
    },
  });
  const approved = await recordPortfolioAdminAction(approvedInput, {
    store: createPortfolioAdminActionStore(approvedFixture.bucket),
    queue: createPortfolioAdminActionQueue(approvedFixture.queueKv),
    founderGateResolver: createPortfolioFounderGateResolver(approvedFixture.queueKv),
    actorId: 'plexus:pid_founder',
    now: () => '2026-08-07T09:31:00.000Z',
  });
  assert.equal(approved.nextFlow, 'project-creation-execution');
  assert.equal(approved.approvalStatus, 'execution-ready');
  const approvedTrigger = [...approvedFixture.kv.values()]
    .map((value) => JSON.parse(value))
    .find((value) => value.schema === 'thoughtseed.portfolio-admin-action-trigger.v1');
  assert.equal(approvedTrigger.status, 'execution-ready');
});

test('inline Founder Gate claims cannot bypass the authoritative Gate resolver', async () => {
  const fixture = fixtures();
  const agentInput = projectCreationInput({
    idempotencyKey: 'agent-project-nova-untrusted-1',
    proposal: { ...(projectCreationInput().proposal as Record<string, unknown>), requestSource: 'agent' },
  });
  const intentDigest = await projectCreationIntentDigest(agentInput);
  const claimedApproval = projectCreationInput({
    idempotencyKey: 'agent-project-nova-untrusted-claim-1',
    proposal: {
      ...(agentInput.proposal as Record<string, unknown>),
      founderApproval: { receiptId: 'gate_project_nova_claimed', intentDigest },
    },
  });

  await assert.rejects(
    () => recordPortfolioAdminAction(claimedApproval, {
      store: createPortfolioAdminActionStore(fixture.bucket),
      queue: createPortfolioAdminActionQueue(fixture.queueKv),
      actorId: 'plexus:pid_founder',
      now: () => '2026-08-07T09:30:00.000Z',
    }),
    PortfolioAdminActionValidationError,
  );
  fixture.kv.set('gate:thoughtseed:gate_project_nova_claimed', JSON.stringify({
    id: 'gate_project_nova_claimed',
    kind: 'approve',
    subject: `sha256:${'f'.repeat(64)}`,
    founderId: 'founder-1',
    status: 'queued',
  }));
  await assert.rejects(
    () => recordPortfolioAdminAction(claimedApproval, {
      store: createPortfolioAdminActionStore(fixture.bucket),
      queue: createPortfolioAdminActionQueue(fixture.queueKv),
      founderGateResolver: createPortfolioFounderGateResolver(fixture.queueKv),
      actorId: 'plexus:pid_founder',
      now: () => '2026-08-07T09:30:00.000Z',
    }),
    PortfolioAdminActionValidationError,
  );
  assert.equal(fixture.events.length, 0);
});

test('mismatched Founder Gate approval is rejected before durable writes', async () => {
  const fixture = fixtures();
  await assert.rejects(
    () => recordPortfolioAdminAction(projectCreationInput({
      proposal: {
        ...(projectCreationInput().proposal as Record<string, unknown>),
        requestSource: 'dgchat',
        founderApproval: { receiptId: 'gate_project_nova_wrong', intentDigest: `sha256:${'0'.repeat(64)}` },
      },
    }), {
      store: createPortfolioAdminActionStore(fixture.bucket),
      queue: createPortfolioAdminActionQueue(fixture.queueKv),
      actorId: 'plexus:pid_founder',
      now: () => '2026-08-07T09:30:00.000Z',
    }),
    PortfolioAdminActionValidationError,
  );
  assert.equal(fixture.events.length, 0);
});

test('a queue failure reports durable evidence so retry can finish the trigger', async () => {
  const fixture = fixtures();
  const queue = createPortfolioAdminActionQueue({
    async get() { return null; },
    async put() { throw new Error('KV unavailable'); },
  });
  await assert.rejects(
    () => recordPortfolioAdminAction(projectCreationInput(), {
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

// A component-bearing request is planning evidence only, never execution admission.
import { validatePortfolioAdminAction } from './portfolio-admin-actions.ts';
import { repositoryComponentsForIntake, reviewedRepositoryComponentsFor } from '../../../shared/operational-packet-registry.ts';
import { createPacket, parsePacket, defaultReconciliation, WORK_OBJECTS } from '../../../apps/portfolio-cartographer/src/domain.ts';

for (const [workId, primary, count] of [
  ['branch:tirak', 'Sheshiyer/tirak-mobile-app-v2', 10],
  ['branch:parkarea', 'Sheshiyer/parkarea-aleph', 3],
  ['branch:insight-realtors-legal-advisors', 'Sheshiyer/Insightreality', 1],
  ['branch:co-property', 'Sheshiyer/coproperty-office-os', 10],
  ['branch:klear-karma', 'Sheshiyer/kkv2-klear-karma-RN', 10],
  ['branch:relovo', 'Sheshiyer/relovo', 1],
] as const) {
  test(`${workId}: full membership survives export/import, immutable evidence and pending-intake trigger`, async () => {
    const work = WORK_OBJECTS.find((row) => row.workId === workId)!;
    const components = repositoryComponentsForIntake(workId, `repo:${primary}`);
    const authority = components.find((component) => component.planningAuthority)!;
    const reconciliation = {
      ...defaultReconciliation(workId), repositorySourceRef: `repo:${primary}`,
      repositoryComponents: components, repositoryDisposition: 'resolved' as const,
      origin: 'client' as const, clientFamilyId: work.accountId!,
      planningAuthority: { kind: 'repository' as const, fullName: primary, repositoryId: authority.immutableRepositoryId! },
      repositoryPlanningReviewed: true, githubIssuesReviewed: true, legacyEvidenceReviewed: true,
    };
    const packet = createPacket({ focusedId: workId, plans: {}, reconciliations: { [workId]: reconciliation } }, new Date('2026-10-25T18:00:00Z'));
    const parsed = parsePacket(JSON.parse(JSON.stringify(packet)));
    assert.deepEqual(parsed.reconciliations[workId].repositoryComponents, components);
    const { workObjectId: _id, updatedAt: _time, ...proposal } = parsed.reconciliations[workId];
    const action = thoughtseedInput({ idempotencyKey: `membership-${workId}`, subject: { id: workId, name: work.name }, proposal });
    const fixture = fixtures();
    const deps = { store: createPortfolioAdminActionStore(fixture.bucket), queue: createPortfolioAdminActionQueue(fixture.queueKv), actorId: 'founder', now: () => '2026-10-25T18:00:00Z' };
    const receipt = await recordPortfolioAdminAction(action, deps);
    const evidence = JSON.parse([...fixture.r2.values()][0]);
    assert.equal(evidence.action.proposal.repositoryComponents.length, count);
    assert.deepEqual(evidence.action.proposal.repositoryComponents, components);
    assert.equal(receipt.nextFlow, 'repository-intake-review');
    assert.equal(receipt.approvalStatus, null);
    assert.equal(JSON.parse([...fixture.kv.values()][0]).status, 'pending-governed-intake');
    assert.deepEqual(await recordPortfolioAdminAction(action, deps), { ...receipt, duplicate: true });
    assert.equal(fixture.r2.size, 1);
    assert.equal(fixture.kv.size, 1);
    for (const mutate of [
      (value: any) => value.proposal.repositoryComponents.pop(),
      (value: any) => value.proposal.repositoryComponents.push(value.proposal.repositoryComponents[0]),
      (value: any) => value.proposal.repositoryComponents[0].ownerWorkObjectId = 'branch:unrelated',
      (value: any) => value.proposal.repositoryComponents[0].immutableRepositoryId = 'R_kgDOWrong',
      (value: any) => value.proposal.repositoryComponents[0].lifecycle = 'historical',
      (value: any) => value.proposal.repositoryComponents[0].roles = ['infra'],
      (value: any) => value.proposal.repositoryComponents[0].projectAssociation = 'other-project',
      (value: any) => value.proposal.repositoryComponents[0].planningAuthority = !value.proposal.repositoryComponents[0].planningAuthority,
      (value: any) => value.proposal.clientFamilyId = 'another-client',
      (value: any) => value.proposal.planningAuthority.fullName = 'Other/Repo',
    ]) {
      const changed = structuredClone(action); mutate(changed);
      const empty = fixtures();
      await assert.rejects(recordPortfolioAdminAction(changed, { ...deps, store: createPortfolioAdminActionStore(empty.bucket), queue: createPortfolioAdminActionQueue(empty.queueKv) }));
      assert.equal(empty.events.length, 0);
    }
  });
}

test('historical components cannot become planning authority and Co.Property associations do not mint project IDs', () => {
  const historical = 'repo:pineappleinnovationlabs/tirak-website-v1';
  const components = repositoryComponentsForIntake('branch:tirak', historical);
  const work = WORK_OBJECTS.find((row) => row.workId === 'branch:tirak')!;
  assert.throws(() => validatePortfolioAdminAction(thoughtseedInput({ subject: { id: work.workId, name: work.name }, proposal: {
    ...thoughtseedInput().proposal, repositorySourceRef: historical, repositoryComponents: components,
    origin: 'client', clientFamilyId: 'tirak', planningAuthority: { kind: 'repository', fullName: 'pineappleinnovationlabs/tirak-website-v1', repositoryId: 'R_kgDOQDuQIw' },
  } })), /approved current/);
  const co = reviewedRepositoryComponentsFor('branch:co-property');
  assert.deepEqual(co.filter((row) => row.lifecycle === 'current').map((row) => row.projectAssociation), ['office-os', 'website-2026', 'academy']);
  assert.ok(co.every((row) => row.ownerWorkObjectId === 'branch:co-property'));
  assert.equal(WORK_OBJECTS.some((row) => row.workId === 'branch:relovo'), true);
  assert.equal(reviewedRepositoryComponentsFor('branch:relovo')[0].nameWithOwner, 'Sheshiyer/relovo');
});

test('legacy singular action validation preserves historic payload shape and digest input', () => {
  const original = thoughtseedInput();
  assert.deepEqual(validatePortfolioAdminAction(original), original);
  assert.equal(Object.hasOwn(validatePortfolioAdminAction(original).proposal, 'repositoryComponents'), false);
});

test('incomplete multi-select drafts remain recoverable without authorizing an incomplete intake', () => {
  const workId = 'branch:tirak';
  const primary = 'repo:Sheshiyer/tirak-mobile-app-v2';
  const components = repositoryComponentsForIntake(workId, primary).slice(0, 2);
  const draft = { ...defaultReconciliation(workId), repositorySourceRef: primary,
    repositoryComponents: components, repositoryDisposition: 'resolved' as const,
    planningAuthority: { kind: 'repository' as const, fullName: 'Sheshiyer/tirak-mobile-app-v2', repositoryId: 'R_kgDOSkuDKw' },
  };
  const packet = createPacket({ focusedId: workId, plans: {}, reconciliations: { [workId]: draft } });
  assert.deepEqual(parsePacket(JSON.parse(JSON.stringify(packet))).reconciliations[workId].repositoryComponents, components);
});

test('legacy ParkArea alias retains its selected repository identity when full membership is added', () => {
  const id = 'branch:parkarea';
  const reconciliation = {
    ...defaultReconciliation(id), repositorySourceRef: 'repo:parkarea.parkarea-aleph', repositoryDisposition: 'resolved' as const,
    planningAuthority: { kind: 'repository' as const, fullName: 'Sheshiyer/parkarea-aleph', repositoryId: 'R_kgDOSDqEkg' },
    repositoryComponents: repositoryComponentsForIntake(id, 'repo:Sheshiyer/parkarea-aleph'),
  };
  const packet = createPacket({ focusedId: id, plans: {}, reconciliations: { [id]: reconciliation } });
  const readback = parsePacket(JSON.parse(JSON.stringify(packet))).reconciliations[id];
  assert.equal(readback.repositorySourceRef, 'repo:parkarea.parkarea-aleph');
  assert.equal(readback.repositoryComponents?.find((component) => component.planningAuthority)?.nameWithOwner, 'Sheshiyer/parkarea-aleph');
});

import { intakeReadiness, toMarkdown } from '../../../apps/portfolio-cartographer/src/domain.ts';

test('unreviewed Tirak backend stays membership evidence and cannot become approved planning authority', async () => {
  const id = 'branch:tirak';
  const name = 'Sheshiyer/tirak-backend-alpha01';
  const work = WORK_OBJECTS.find((row) => row.workId === id)!;
  const { repositoryComponents: _defaultComponents, ...legacyDraft } = defaultReconciliation(id);
  const reconciliation = {
    ...legacyDraft, repositorySourceRef: `repo:${name}`, repositoryDisposition: 'resolved' as const,
    origin: 'client' as const, clientFamilyId: 'tirak',
    planningAuthority: { kind: 'repository' as const, fullName: name, repositoryId: 'R_kgDOO5Ekzg' },
    repositoryPlanningReviewed: true, githubIssuesReviewed: true, legacyEvidenceReviewed: true,
  };
  assert.equal(intakeReadiness(work, reconciliation).ready, false);
  const components = repositoryComponentsForIntake(id, `repo:${name}`);
  assert.equal(components.length, 10);
  assert.equal(intakeReadiness(work, { ...reconciliation, repositoryComponents: components }).ready, false);
  const { workObjectId: _id, updatedAt: _time, ...proposal } = reconciliation;
  assert.throws(() => validatePortfolioAdminAction(thoughtseedInput({ subject: { id, name: work.name }, proposal })), /approved current/);
  const fixture = fixtures();
  await assert.rejects(recordPortfolioAdminAction(thoughtseedInput({ subject: { id, name: work.name }, proposal: { ...proposal, repositoryComponents: components } }), {
    store: createPortfolioAdminActionStore(fixture.bucket), queue: createPortfolioAdminActionQueue(fixture.queueKv), actorId: 'founder', now: () => '2026-10-25T18:00:00Z',
  }), /approved current/);
  assert.equal(fixture.events.length, 0);
  assert.equal(components.filter((component) => component.lifecycle === 'unreviewed').length, 4);
});

test('new JSON and Markdown exports enrich legacy drafts without changing original singular state', () => {
  const id = 'branch:tirak';
  const { repositoryComponents: _defaultComponents, ...legacyDraft } = defaultReconciliation(id);
  const reconciliation = {
    ...legacyDraft, repositorySourceRef: 'repo:Sheshiyer/tirak-mobile-app-v2', repositoryDisposition: 'resolved' as const,
    planningAuthority: { kind: 'repository' as const, fullName: 'Sheshiyer/tirak-mobile-app-v2', repositoryId: 'R_kgDOSkuDKw' },
  };
  const before = JSON.stringify(reconciliation);
  const packet = createPacket({ focusedId: id, plans: {}, reconciliations: { [id]: reconciliation } });
  const exported = parsePacket(JSON.parse(JSON.stringify(packet))).reconciliations[id];
  assert.equal(exported.repositoryComponents?.length, 10);
  assert.equal(exported.repositorySourceRef, reconciliation.repositorySourceRef);
  assert.equal(exported.repositoryComponents?.filter((component) => component.planningAuthority).length, 1);
  assert.equal(JSON.stringify(reconciliation), before);
  // Markdown may also be requested from an already-exported older packet.
  delete packet.reconciliations[id].repositoryComponents;
  const markdown = toMarkdown(packet);
  for (const component of reviewedRepositoryComponentsFor(id)) assert.ok(markdown.includes(component.nameWithOwner));
  assert.equal(Object.hasOwn(packet.reconciliations[id], 'repositoryComponents'), false);
});

test('singular planning identity is case-insensitive by name but bound to immutable ID and reference', () => {
  const work = WORK_OBJECTS.find((row) => row.workId === 'branch:tirak')!;
  const mobile = 'Sheshiyer/tirak-mobile-app-v2';
  const backend = 'Sheshiyer/tirak-backend-alpha01';
  function action(name: string, id: string, ref: string) {
    return thoughtseedInput({ subject: { id: work.workId, name: work.name }, proposal: {
      ...thoughtseedInput().proposal, origin: 'client', clientFamilyId: 'tirak', repositorySourceRef: ref,
      planningAuthority: { kind: 'repository', fullName: name, repositoryId: id },
    } });
  }
  for (const name of [backend, 'sheshiyer/tirak-backend-alpha01', 'Sheshiyer/TIRAK-BACKEND-ALPHA01']) {
    for (const ref of [`repo:${backend}`, `repo:${backend.toUpperCase()}`]) {
      assert.throws(() => validatePortfolioAdminAction(action(name, 'R_kgDOO5Ekzg', ref)), /approved current/);
      const withComponents = action(name, 'R_kgDOO5Ekzg', ref);
      Object.assign(withComponents.proposal, { repositoryComponents: repositoryComponentsForIntake(work.workId, `repo:${backend}`) });
      assert.throws(() => validatePortfolioAdminAction(withComponents), /approved current/);
    }
  }
  for (const name of [mobile, mobile.toLowerCase(), mobile.toUpperCase()]) {
    for (const ref of [`repo:${mobile}`, `repo:${mobile.toUpperCase()}`]) {
      const valid = action(name, 'R_kgDOSkuDKw', ref);
      assert.deepEqual(validatePortfolioAdminAction(valid), valid); // retain exact legacy bytes/shape
      for (const wrong of [
        action(name, 'R_kgDOO5Ekzg', ref),
        action(name, 'R_kgDOWrong', ref),
        action(name, 'R_kgDOSkuDKw', `repo:${backend}`),
        action(name, 'R_kgDOSkuDKw', 'repo:Other/Unknown'),
        action(backend, 'R_kgDOSkuDKw', ref),
      ]) assert.throws(() => validatePortfolioAdminAction(wrong), /ID, qualified name and source reference/);
      Object.assign(valid.proposal, { repositoryComponents: repositoryComponentsForIntake(work.workId, `repo:${mobile}`) });
      assert.doesNotThrow(() => validatePortfolioAdminAction(valid));
    }
  }
  const park = WORK_OBJECTS.find((row) => row.workId === 'branch:parkarea')!;
  const legacy = action('sheshiyer/PARKAREA-ALEPH', 'R_kgDOSDqEkg', 'repo:parkarea.parkarea-aleph');
  legacy.subject = { id: park.workId, name: park.name }; legacy.proposal.clientFamilyId = 'parkarea';
  assert.deepEqual(validatePortfolioAdminAction(legacy), legacy);
  legacy.proposal.repositorySourceRef = 'repo:parkarea.wiki';
  assert.throws(() => validatePortfolioAdminAction(legacy), /ID, qualified name and source reference/);
});
