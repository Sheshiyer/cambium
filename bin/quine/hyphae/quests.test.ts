import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { questLedger } from '../../operator/quests/quests.ts';
import { applySideQuestQueueDecisions, buildVisualEnvelope } from './quests.ts';
import { auditPrioritySource, capturePrioritySource, prioritySourceTemplate, refreshPrioritySignals } from './priority-signals.ts';
import type { QuineCtx } from '../types.ts';

function tmpCtx(): QuineCtx {
  const root = mkdtempSync(join(tmpdir(), 'cambium-quests-'));
  mkdirSync(join(root, '.operator'), { recursive: true });
  return { root, vaultRoot: join(root, 'vault') };
}

const quietPaperclip = { reachable: false, agents: 0, issuesDone: 0, issuesOpen: 0, agentErrors: 0, pendingApprovals: 0 };

const openItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'THO-10',
  title: 'Founder preferred delivery gate',
  status: 'blocked',
  owner: 'Mathis',
  updatedAt: '2026-06-22T02:00:00.000Z',
  evidence: 'THO-10 is blocked · owner Mathis · updated 2026-06-22T02:00:00.000Z',
  consequence: 'founder decision changes Paperclip handling for THO-10',
  approveConsequence: 'approve THO-10 for Paperclip execution',
  rerollConsequence: 'reroll THO-10 and request revision before execution',
  reversibility: 'queued action can be superseded until consumed',
  idempotencyHint: 'THO-10:blocked:2026-06-22T02:00:00.000Z',
  priority: { source: 'paperclip-priority@v1', risk: 'high', dependency: 'blocks-delivery', score: 23, reasons: ['high risk'] },
  ...overrides,
});

const action = (overrides: Record<string, unknown> = {}) => ({
  id: 'gate-side-1',
  ts: '2026-06-22T00:00:00.000Z',
  founderId: '1371522080',
  kind: 'queue-side-quest',
  subject: 'wake-proof',
  evidence: 'wake-proof: ingest missing · viability missing',
  consequence: 'queue side quest wake-proof for operator follow-up; no browser-side completion',
  reversibility: 'queued side quest can be superseded until consumed; side quest ledger remains unchanged',
  idempotencyKey: 'queue-side-quest:acme:wake-proof',
  status: 'queued',
  ...overrides,
});

function gateFetch(actions: any[], consumed: any[]): typeof fetch {
  return (async (url, init = {}) => {
    const path = String(url);
    if (path.endsWith('/internal/gate/acme/consume')) {
      const body = JSON.parse(String(init.body ?? '{}'));
      consumed.push(body);
      return new Response(JSON.stringify({ consumed: body.id }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (path.endsWith('/internal/gate/acme')) {
      return new Response(JSON.stringify({ tenant: 'acme', actions }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'unexpected url' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

function sideQuestEvents(ctx: QuineCtx, tenant: string): any[] {
  return readFileSync(join(ctx.root, '.operator', `${tenant}.side-quests.jsonl`), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

test('quests priority-source captures explicit operator source and refreshes policy signals', () => {
  const ctx = tmpCtx();

  const result = capturePrioritySource(ctx, 'acme', {
    founderTarget: 'THO-10',
    founderWeight: 9,
    founderProof: 'founder selected THO-10 during operator review',
    owner: 'Mathis',
    capacity: 2,
    capacityProof: 'capacity roster reviewed by operator',
    amount: 12000,
    currency: 'usd',
    economicRisk: 'high',
    economicProof: 'contract amount and deposit exposure recorded',
    available: 1,
    required: 2,
    availabilityProof: 'review rota has one available reviewer',
    revoked: false,
    revocationProof: 'member revocation ledger clear',
    urgencyProof: 'tenant queues and gate blockers scored',
  }, {
    tenantIds: ['acme', 'cambium'],
    openItems: [openItem(), openItem({ id: 'THO-11', owner: 'Mathis' })] as any,
    nowIso: '2026-06-22T02:00:00.000Z',
  });

  assert.equal(result.status, 'captured');
  assert.equal(result.sourceFile, '.operator/acme.priority-source.json');
  assert.equal(result.signalFile, '.operator/acme.priority-signals.json');
  const source = JSON.parse(readFileSync(join(ctx.root, '.operator', 'acme.priority-source.json'), 'utf8'));
  const signals = JSON.parse(readFileSync(join(ctx.root, '.operator', 'acme.priority-signals.json'), 'utf8'));
  assert.equal(source.source, 'operator-priority-source@v1');
  assert.equal(source.capturedAt, '2026-06-22T02:00:00.000Z');
  assert.equal(signals.source, 'operator-priority-signals@v1');
  assert.equal(signals.founderPreference.targetId, 'THO-10');
  assert.equal(signals.ownerLoad.openItems, 2);
  assert.equal(signals.economicRisk.currency, 'USD');
});

test('quests priority-audit reports missing source without writing policy authority', () => {
  const ctx = tmpCtx();

  const result = auditPrioritySource(ctx, 'acme', {
    tenantIds: ['acme'],
    openItems: [openItem()] as any,
    nowIso: '2026-06-22T03:00:00.000Z',
  });

  assert.equal(result.status, 'skipped');
  assert.equal(result.sourceExists, false);
  assert.equal(result.signalExists, false);
  assert.equal(result.wouldWriteSignal, false);
  assert.equal(result.wouldBlockStaleAuthority, false);
  assert.deepEqual(result.missing, ['operator-priority-source@v1 file']);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-source.json')), false);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-signals.json')), false);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-signals.readiness.json')), false);
});

test('quests priority-audit previews ready source without mutating files', () => {
  const ctx = tmpCtx();
  writeFileSync(join(ctx.root, '.operator', 'acme.priority-source.json'), JSON.stringify({
    source: 'operator-priority-source@v1',
    founderPreference: { targetId: 'THO-10', weight: 10, proof: 'founder ranked THO-10 first' },
    ownerCapacity: { owner: 'Mathis', capacity: 2, proof: 'Mathis capacity roster served' },
    economicRisk: { amount: 12000, currency: 'USD', risk: 'high', proof: 'contract amount and currency served' },
    teamAvailability: { available: 1, required: 2, proof: 'one reviewer available for two-reviewer gate' },
    memberRevocation: { revoked: false, proof: 'revocation ledger clear' },
    crossTenantUrgency: { proof: 'active queues across tenants scored' },
  }, null, 2));

  const result = auditPrioritySource(ctx, 'acme', {
    tenantIds: ['acme', 'cambium'],
    openItems: [openItem(), openItem({ id: 'THO-11', owner: 'Mathis' })] as any,
    nowIso: '2026-06-22T03:01:00.000Z',
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.sourceExists, true);
  assert.equal(result.signalExists, false);
  assert.equal(result.wouldWriteSignal, true);
  assert.equal(result.wouldBlockStaleAuthority, false);
  assert.deepEqual(result.missing, []);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-signals.json')), false);
});

test('quests priority-audit reports stale authority would be blocked', () => {
  const ctx = tmpCtx();
  writeFileSync(join(ctx.root, '.operator', 'acme.priority-signals.json'), JSON.stringify({
    source: 'operator-priority-signals@v1',
    founderPreference: { targetId: 'THO-OLD', weight: 10, proof: 'stale founder preference' },
    ownerLoad: { owner: 'Mathis', openItems: 2, capacity: 2, proof: 'stale capacity' },
    economicRisk: { amount: 12000, currency: 'USD', risk: 'high', proof: 'stale economics' },
    teamAvailability: { available: 2, required: 2, proof: 'stale team' },
    memberRevocation: { revoked: false, proof: 'stale revocation' },
    crossTenantUrgency: { score: 4, tenants: 2, proof: 'stale urgency' },
  }, null, 2));

  const result = auditPrioritySource(ctx, 'acme', {
    tenantIds: ['acme'],
    openItems: [openItem()] as any,
    nowIso: '2026-06-22T03:02:00.000Z',
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.sourceExists, false);
  assert.equal(result.signalExists, true);
  assert.equal(result.currentSignalStatus, 'ready');
  assert.equal(result.wouldWriteSignal, true);
  assert.equal(result.wouldBlockStaleAuthority, true);
  assert.deepEqual(result.missing, ['operator-priority-source@v1 file']);
  const signals = JSON.parse(readFileSync(join(ctx.root, '.operator', 'acme.priority-signals.json'), 'utf8'));
  assert.equal(signals.founderPreference.targetId, 'THO-OLD');
});

test('quests priority-template previews source facts without writing authority', () => {
  const ctx = tmpCtx();

  const result = prioritySourceTemplate(ctx, 'acme', {
    tenantIds: ['acme', 'cambium'],
    openItems: [openItem(), openItem({ id: 'THO-11', owner: 'Mathis' })] as any,
    nowIso: '2026-06-22T04:00:00.000Z',
  });

  assert.equal(result.status, 'template');
  assert.equal(result.writesAuthority, false);
  assert.equal(result.written, false);
  assert.equal(result.suggestedFounderTarget, 'THO-10');
  assert.equal(result.suggestedOwner, 'Mathis');
  assert.equal(result.tenantCount, 2);
  assert.equal((result.template as any).source, 'operator-priority-source-template@v1');
  assert.equal((result.template as any).targetSource, 'operator-priority-source@v1');
  assert.equal((result.template as any).sourceDocument.founderPreference.targetId, 'THO-10');
  assert.equal((result.template as any).sourceDocument.ownerCapacity.owner, 'Mathis');
  assert.equal((result.template as any).sourceDocument.ownerCapacity.capacity, null);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-source.json')), false);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-signals.json')), false);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-source.template.json')), false);
});

test('quests priority-template may write only a non-authoritative template file', () => {
  const ctx = tmpCtx();

  const result = prioritySourceTemplate(ctx, 'acme', {
    tenantIds: ['acme'],
    openItems: [openItem()] as any,
    nowIso: '2026-06-22T04:01:00.000Z',
    writeTemplate: true,
  });

  assert.equal(result.written, true);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-source.template.json')), true);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-source.json')), false);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-signals.json')), false);
  const template = JSON.parse(readFileSync(join(ctx.root, '.operator', 'acme.priority-source.template.json'), 'utf8'));
  assert.equal(template.source, 'operator-priority-source-template@v1');
  assert.equal(template.writesAuthority, false);
  assert.equal(template.sourceDocument.source, 'operator-priority-source@v1');
});

test('quests priority-source rejects partial capture without creating policy authority', () => {
  const ctx = tmpCtx();

  const result = capturePrioritySource(ctx, 'acme', {
    founderTarget: 'THO-10',
    founderWeight: 9,
    owner: 'Mathis',
    capacity: 2,
    capacityProof: 'capacity roster reviewed by operator',
  }, {
    tenantIds: ['acme'],
    openItems: [openItem()] as any,
    nowIso: '2026-06-22T02:01:00.000Z',
  });

  assert.equal(result.status, 'rejected');
  assert.equal(result.sourceFile, null);
  assert.match(result.missing.join(' · '), /founder preference/);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-source.json')), false);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-signals.json')), false);
  const readiness = JSON.parse(readFileSync(join(ctx.root, '.operator', 'acme.priority-signals.readiness.json'), 'utf8'));
  assert.equal(readiness.status, 'rejected');
});

test('quests priority-source rejection neutralizes stale policy authority', () => {
  const ctx = tmpCtx();
  writeFileSync(join(ctx.root, '.operator', 'acme.priority-signals.json'), JSON.stringify({
    source: 'operator-priority-signals@v1',
    founderPreference: { targetId: 'THO-OLD', weight: 10, proof: 'stale founder preference' },
    ownerLoad: { owner: 'Mathis', openItems: 2, capacity: 2, proof: 'stale capacity' },
    economicRisk: { amount: 12000, currency: 'USD', risk: 'high', proof: 'stale economics' },
    teamAvailability: { available: 2, required: 2, proof: 'stale team' },
    memberRevocation: { revoked: false, proof: 'stale revocation' },
    crossTenantUrgency: { score: 4, tenants: 2, proof: 'stale urgency' },
  }, null, 2));

  const result = capturePrioritySource(ctx, 'acme', {
    founderTarget: 'THO-10',
    founderWeight: 9,
    owner: 'Mathis',
    capacity: 2,
    capacityProof: 'capacity roster reviewed by operator',
  }, {
    tenantIds: ['acme'],
    openItems: [openItem()] as any,
    nowIso: '2026-06-22T02:02:00.000Z',
  });

  assert.equal(result.status, 'rejected');
  assert.equal(result.signalFile, '.operator/acme.priority-signals.json');
  const signals = JSON.parse(readFileSync(join(ctx.root, '.operator', 'acme.priority-signals.json'), 'utf8'));
  assert.equal(signals.source, 'operator-priority-signals@v1');
  assert.equal(signals.status, 'blocked');
  assert.match(signals.proof, /priority source incomplete/);
  assert.equal(signals.founderPreference, undefined);
});

test('quests priority-signals skips policy authority when no source exists', () => {
  const ctx = tmpCtx();

  const result = refreshPrioritySignals(ctx, 'acme', {
    tenantIds: ['acme'],
    openItems: [],
    nowIso: '2026-06-22T01:00:00.000Z',
  });

  assert.equal(result.status, 'skipped');
  assert.equal(result.signalFile, null);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-signals.json')), false);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.priority-signals.readiness.json')), true);
  const readiness = JSON.parse(readFileSync(join(ctx.root, '.operator', 'acme.priority-signals.readiness.json'), 'utf8'));
  assert.equal(readiness.status, 'skipped');
});

test('quests priority-signals writes complete operator priority policy from explicit sources', () => {
  const ctx = tmpCtx();
  writeFileSync(join(ctx.root, '.operator', 'acme.priority-source.json'), JSON.stringify({
    source: 'operator-priority-source@v1',
    founderPreference: { targetId: 'THO-10', weight: 10, proof: 'founder ranked THO-10 first' },
    ownerCapacity: { owner: 'Mathis', capacity: 2, proof: 'Mathis capacity roster served' },
    economicRisk: { amount: 12000, currency: 'usd', risk: 'high', proof: 'contract amount and currency served' },
    teamAvailability: { available: 1, required: 2, proof: 'one reviewer available for two-reviewer gate' },
    memberRevocation: { revoked: false, proof: 'revocation ledger clear' },
    crossTenantUrgency: { score: 4, proof: 'active queues across tenants scored' },
  }, null, 2));

  const result = refreshPrioritySignals(ctx, 'acme', {
    tenantIds: ['acme', 'cambium', 'thoughtseed'],
    openItems: [
      openItem(),
      openItem({ id: 'THO-11', owner: 'Mathis', priority: { source: 'paperclip-priority@v1', risk: 'critical', dependency: 'blocks-delivery', score: 24, reasons: ['critical'] } }),
      openItem({ id: 'THO-12', owner: 'Paperclip', priority: { source: 'paperclip-priority@v1', risk: 'medium', dependency: 'none', score: 2, reasons: ['medium'] } }),
    ] as any,
    nowIso: '2026-06-22T01:01:00.000Z',
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.signalFile, '.operator/acme.priority-signals.json');
  const signals = JSON.parse(readFileSync(join(ctx.root, '.operator', 'acme.priority-signals.json'), 'utf8'));
  assert.equal(signals.source, 'operator-priority-signals@v1');
  assert.equal(signals.founderPreference.targetId, 'THO-10');
  assert.equal(signals.ownerLoad.owner, 'Mathis');
  assert.equal(signals.ownerLoad.openItems, 2);
  assert.equal(signals.ownerLoad.capacity, 2);
  assert.equal(signals.economicRisk.currency, 'USD');
  assert.equal(signals.crossTenantUrgency.tenants, 3);
  assert.equal(signals.crossTenantUrgency.score, 5);
});

test('quests priority-signals overwrites stale authority with blockers when source becomes incomplete', () => {
  const ctx = tmpCtx();
  writeFileSync(join(ctx.root, '.operator', 'acme.priority-signals.json'), JSON.stringify({
    source: 'operator-priority-signals@v1',
    founderPreference: { targetId: 'THO-OLD', weight: 10, proof: 'stale founder preference' },
    ownerLoad: { owner: 'Mathis', openItems: 2, capacity: 2, proof: 'stale capacity' },
    economicRisk: { amount: 12000, currency: 'USD', risk: 'high', proof: 'stale economics' },
    teamAvailability: { available: 2, required: 2, proof: 'stale team' },
    memberRevocation: { revoked: false, proof: 'stale revocation' },
    crossTenantUrgency: { score: 4, tenants: 2, proof: 'stale urgency' },
  }, null, 2));
  writeFileSync(join(ctx.root, '.operator', 'acme.priority-source.json'), JSON.stringify({
    source: 'operator-priority-source@v1',
    founderPreference: { targetId: 'THO-10', weight: 10 },
    ownerCapacity: { owner: 'Mathis', capacity: 2, proof: 'capacity roster served' },
    economicRisk: { amount: 12000, currency: 'USD', risk: 'high', proof: 'economic proof served' },
    teamAvailability: { available: 1, required: 2, proof: 'availability served' },
    memberRevocation: { revoked: false, proof: 'revocation ledger clear' },
    crossTenantUrgency: { proof: 'urgency proof served' },
  }, null, 2));

  const result = refreshPrioritySignals(ctx, 'acme', {
    tenantIds: ['acme', 'cambium'],
    openItems: [openItem()] as any,
    nowIso: '2026-06-22T01:02:00.000Z',
  });

  assert.equal(result.status, 'blocked');
  assert.match(result.missing.join(' · '), /founder preference/);
  const signals = JSON.parse(readFileSync(join(ctx.root, '.operator', 'acme.priority-signals.json'), 'utf8'));
  assert.equal(signals.source, 'operator-priority-signals@v1');
  assert.equal(signals.status, 'blocked');
  assert.match(signals.proof, /priority source incomplete/);
  assert.equal(signals.founderPreference, undefined);
});

test('quests apply-side-quests re-checks the current envelope before writing queued events', async () => {
  const ctx = tmpCtx();
  const consumed: any[] = [];

  const result: any = await applySideQuestQueueDecisions(ctx, 'acme', {
    baseUrl: 'https://worker.test',
    token: 'push-token',
    fetchImpl: gateFetch([action()], consumed),
    nowIso: () => '2026-06-22T00:05:00.000Z',
    paperclip: quietPaperclip,
    openItems: [],
  });

  assert.equal(result.checked, 1);
  assert.equal(result.queued, 1);
  assert.equal(result.rejected, 0);
  assert.equal(result.consumed, 1);
  assert.equal(consumed[0].id, 'gate-side-1');
  assert.equal(consumed[0].result.result, 'queued');
  assert.match(consumed[0].result.reason, /current visual envelope/);

  const events = sideQuestEvents(ctx, 'acme');
  assert.equal(events.length, 1);
  assert.equal(events[0].schema, 'cambium.side-quest-event.v1');
  assert.equal(events[0].sideQuestId, 'wake-proof');
  assert.equal(events[0].status, 'queued');
  assert.equal(events[0].source, 'founder-gate');
  assert.equal(events[0].actionId, 'gate-side-1');
  assert.equal(events[0].idempotencyKey, 'queue-side-quest:acme:wake-proof');
  assert.match(events[0].proof, /current envelope row wake-proof/);

  const visual = buildVisualEnvelope(
    ctx,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-22T00:06:00.000Z' },
  );
  const wakeProof = visual.sideQuests.rows.find((row) => row.id === 'wake-proof');
  assert.equal(wakeProof?.status, 'queued');
  assert.equal(wakeProof?.runtime?.latest?.source, 'founder-gate');
});

test('quests visual envelope surfaces redacted live-proof capture plan', () => {
  const ctx = tmpCtx();
  const proofDir = join(ctx.root, 'docs', 'plans', 'assets', 'tg-miniapp-live-proof');
  mkdirSync(proofDir, { recursive: true });
  writeFileSync(join(proofDir, 'readiness.json'), JSON.stringify({
    schema: 'cambium.tg-live-proof-readiness.v1',
    generatedAt: '2026-06-22T00:00:00.000Z',
    tenant: 'acme',
    workerUrl: 'https://curious.thoughtseed.space',
    status: 'blocked',
    summary: { ready: 7, blocked: 3, total: 10, liveProofReady: false },
    capturePlan: {
      schema: 'cambium.tg-live-proof-capture-plan.v1',
      invariant: 'Capture commands create redacted receipts; they are proof only after their artifacts validate ready.',
      workerUrl: 'https://curious.thoughtseed.space',
      steps: [
        {
          id: 'device-webview-proof',
          writes: 'docs/plans/assets/tg-miniapp-live-proof/telegram-webview.json',
          state: 'blocked',
          command: 'node workers/quests/src/live-proof-readiness.mjs --capture-device-proof --screenshot docs/plans/assets/tg-miniapp-live-proof/<founder-device>.png --write',
          prerequisites: [
            { id: 'fresh-telegram-init-data', state: 'blocked', detail: 'capture fresh Telegram initData from a founder WebView' },
            { id: 'screenshot-under-proof-dir', state: 'blocked', detail: 'founder-device screenshot path is required' },
          ],
          privacy: ['artifact stores hashes only'],
        },
      ],
    },
  }, null, 2));

  const visual = buildVisualEnvelope(
    ctx,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-22T00:06:00.000Z' },
  );
  assert.equal(visual.liveProof.status, 'blocked');
  assert.equal(visual.liveProof.rows[0]?.title, 'DEVICE WEBVIEW PROOF');
  assert.match(visual.liveProof.rows[0]?.detail ?? '', /2\/2 prerequisites blocked/);
  assert.match(visual.liveProof.rows[0]?.proof ?? '', /proof only after their artifacts validate ready/);
  assert.doesNotMatch(JSON.stringify(visual.liveProof), /query_id=|auth_date=|Bearer|QUESTS_PUSH_TOKEN=|rawInitData/i);
});

test('quests visual envelope prefers durable operator insight rows over ledger-derived boxes', () => {
  const ctx = tmpCtx();
  writeFileSync(join(ctx.root, '.operator', 'acme.insights.json'), JSON.stringify({
    source: 'operator-insights@v1',
    rows: [
      {
        id: 'insight-mira-handoff',
        title: 'Mira handoff evidence',
        state: 'ready',
        detail: 'operator served reusable evidence box',
        proof: 'operator reviewed handoff transcript and linked proof',
        evidence: [{ label: 'handoff transcript', status: 'ready', detail: 'linked proof reviewed' }],
      },
    ],
  }, null, 2));

  const visual = buildVisualEnvelope(
    ctx,
    'acme',
    {},
    questLedger({ current: { arc: 'I', id: 'calling' } }),
    { source: 'test', derivedAt: '2026-06-22T00:06:00.000Z' },
  );

  assert.equal(visual.insights.source, 'operator-insights@v1');
  assert.equal(visual.insights.status, 'ready');
  assert.equal(visual.insights.rows.length, 1);
  assert.equal(visual.insights.rows[0]?.id, 'insight-mira-handoff');
  assert.equal(visual.insights.rows[0]?.source, 'operator-insights@v1');
  assert.equal(visual.insights.rows[0]?.origin, 'operator-insight');
  assert.match(visual.insights.rows[0]?.proof ?? '', /linked proof/);
});

test('quests visual envelope rejects operator insight rows that look like random rewards', () => {
  const ctx = tmpCtx();
  writeFileSync(join(ctx.root, '.operator', 'acme.insights.json'), JSON.stringify({
    source: 'operator-insights@v1',
    rows: [
      {
        id: 'reward-box',
        title: 'Hidden quest bonus',
        state: 'ready',
        detail: 'random reward unlocked',
        proof: 'leaderboard rank improved',
      },
    ],
  }, null, 2));

  const visual = buildVisualEnvelope(
    ctx,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-22T00:06:00.000Z' },
  );

  assert.equal(visual.insights.source, 'quest-ledger-evidence@v1');
  assert.notEqual(visual.insights.source, 'operator-insights@v1');
  assert.doesNotMatch(JSON.stringify(visual.insights), /random reward|leaderboard rank|Hidden quest bonus/i);
});

test('quests apply-side-quests consumes stale side-quest actions as rejected without ledger writes', async () => {
  const ctx = tmpCtx();
  const consumed: any[] = [];

  const result: any = await applySideQuestQueueDecisions(ctx, 'acme', {
    baseUrl: 'https://worker.test',
    token: 'push-token',
    fetchImpl: gateFetch([action({ id: 'gate-stale', subject: 'vanished-branch', idempotencyKey: 'queue-side-quest:acme:vanished-branch' })], consumed),
    nowIso: () => '2026-06-22T00:07:00.000Z',
    paperclip: quietPaperclip,
    openItems: [],
  });

  assert.equal(result.checked, 1);
  assert.equal(result.queued, 0);
  assert.equal(result.rejected, 1);
  assert.equal(result.consumed, 1);
  assert.match(result.results[0].reason, /not present in the current visual envelope/);
  assert.equal(consumed[0].id, 'gate-stale');
  assert.equal(consumed[0].result.result, 'rejected');
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.side-quests.jsonl')), false);
});

test('quests apply-side-quests dry-run previews without writing or consuming', async () => {
  const ctx = tmpCtx();
  const consumed: any[] = [];

  const result: any = await applySideQuestQueueDecisions(ctx, 'acme', {
    baseUrl: 'https://worker.test',
    token: 'push-token',
    fetchImpl: gateFetch([action()], consumed),
    nowIso: () => '2026-06-22T00:08:00.000Z',
    paperclip: quietPaperclip,
    openItems: [],
    dryRun: true,
  });

  assert.equal(result.queued, 1);
  assert.equal(result.consumed, 0);
  assert.equal(consumed.length, 0);
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.side-quests.jsonl')), false);
});

test('quests apply-side-quests rejects reward or social-proof language before ledger writes', async () => {
  const ctx = tmpCtx();
  const consumed: any[] = [];

  const result: any = await applySideQuestQueueDecisions(ctx, 'acme', {
    baseUrl: 'https://worker.test',
    token: 'push-token',
    fetchImpl: gateFetch([action({ id: 'gate-overclaim', evidence: 'reward unlocked for the hidden quest' })], consumed),
    nowIso: () => '2026-06-22T00:09:00.000Z',
    paperclip: quietPaperclip,
    openItems: [],
  });

  assert.equal(result.queued, 0);
  assert.equal(result.rejected, 1);
  assert.equal(result.consumed, 1);
  assert.match(result.results[0].reason, /overclaiming language/);
  assert.equal(consumed[0].result.result, 'rejected');
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.side-quests.jsonl')), false);
});
