import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applySkillPromotionDecisions } from './skills.ts';
import type { QuineCtx } from '../types.ts';
import type { SkillRecord } from '../../operator/skills/forge.ts';

function tmpCtx(): QuineCtx {
  const root = mkdtempSync(join(tmpdir(), 'cambium-skills-'));
  mkdirSync(join(root, '.operator'), { recursive: true });
  return { root, vaultRoot: join(root, 'vault') };
}

function healthyScenarios(): Array<{ ts: number; ok: boolean }> {
  return [1, 2, 3, 4, 5].map((ts) => ({ ts, ok: true }));
}

function skill(overrides: Partial<SkillRecord> = {}): SkillRecord {
  return {
    skill_id: 'cambium-founder-review',
    status: 'validated',
    category: 'delivery',
    description: 'test skill',
    trigger_signals: ['test'],
    required_inputs: [],
    output_contract: { format: 'decision', location: 'world.log' },
    verification_steps: ['test'],
    promotion_rule: 'validated -> production requires founder approval',
    source: { signature: 'micro|test', from: 'world-log', occurrences: 5 },
    telemetry: {
      uses: 5,
      successes: 5,
      failures: 0,
      scenarios: healthyScenarios(),
      gotchas: [],
      amendments: [],
    },
    created: 1,
    updated: 1,
    ...overrides,
  };
}

function writeRegistry(ctx: QuineCtx, tenant: string, skills: SkillRecord[]): void {
  writeFileSync(join(ctx.root, '.operator', `${tenant}.skills.json`), JSON.stringify(skills, null, 2) + '\n');
}

function readRegistry(ctx: QuineCtx, tenant: string): SkillRecord[] {
  return JSON.parse(readFileSync(join(ctx.root, '.operator', `${tenant}.skills.json`), 'utf8')) as SkillRecord[];
}

function readAudit(ctx: QuineCtx, tenant: string): any[] {
  return readFileSync(join(ctx.root, '.operator', `${tenant}.skill-promotions.jsonl`), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

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

const TEST_TELEGRAM_USER_ID = '1000000001';

const action = (overrides: Record<string, unknown> = {}) => ({
  id: 'gate-1',
  ts: '2026-06-22T00:00:00.000Z',
  founderId: TEST_TELEGRAM_USER_ID,
  kind: 'promote-skill',
  subject: 'cambium-founder-review',
  evidence: 'validated · RELIABLE · 5 uses · 100% total · 100% recent · promotion: FOUNDER REVIEW',
  consequence: 'founder review may promote cambium-founder-review to production after operator consumption',
  reversibility: 'queued promotion can be superseded until consumed; skill registry remains unchanged',
  idempotencyKey: 'promote-skill:acme:cambium-founder-review',
  status: 'queued',
  ...overrides,
});

test('skills apply-promotions promotes healthy founder-approved skill and writes audit before consume', async () => {
  const ctx = tmpCtx();
  writeRegistry(ctx, 'acme', [skill()]);
  const consumed: any[] = [];

  const result: any = await applySkillPromotionDecisions(ctx, 'acme', {
    baseUrl: 'https://worker.test',
    token: 'push-token',
    fetchImpl: gateFetch([action()], consumed),
    now: () => 123456,
    nowIso: () => '2026-06-22T00:01:00.000Z',
  });

  assert.equal(result.applied, 1);
  assert.equal(result.consumed, 1);
  assert.equal(readRegistry(ctx, 'acme')[0].status, 'production');
  assert.equal(readRegistry(ctx, 'acme')[0].updated, 123456);

  const audit = readAudit(ctx, 'acme');
  assert.equal(audit.length, 1);
  assert.equal(audit[0].result, 'promoted');
  assert.equal(audit[0].previousStatus, 'validated');
  assert.equal(audit[0].nextStatus, 'production');
  assert.equal(audit[0].idempotencyKey, 'promote-skill:acme:cambium-founder-review');
  assert.equal(consumed[0].id, 'gate-1');
  assert.equal(consumed[0].result.result, 'promoted');
});

test('skills apply-promotions rejects stale subjects and declined telemetry without registry mutation', async () => {
  const ctx = tmpCtx();
  writeRegistry(ctx, 'acme', [
    skill({
      skill_id: 'cambium-declining',
      telemetry: {
        uses: 5,
        successes: 1,
        failures: 4,
        scenarios: [{ ts: 1, ok: true }, { ts: 2, ok: false }, { ts: 3, ok: false }, { ts: 4, ok: false }, { ts: 5, ok: false }],
        gotchas: ['recent failure'],
        amendments: [],
      },
    }),
  ]);
  const consumed: any[] = [];

  const result: any = await applySkillPromotionDecisions(ctx, 'acme', {
    baseUrl: 'https://worker.test',
    token: 'push-token',
    fetchImpl: gateFetch([
      action({ id: 'gate-missing', subject: 'cambium-renamed-skill', idempotencyKey: 'promote-skill:acme:cambium-renamed-skill' }),
      action({ id: 'gate-declining', subject: 'cambium-declining', idempotencyKey: 'promote-skill:acme:cambium-declining' }),
    ], consumed),
    now: () => 123456,
    nowIso: () => '2026-06-22T00:02:00.000Z',
  });

  assert.equal(result.rejected, 2);
  assert.equal(result.applied, 0);
  assert.equal(result.consumed, 2);
  assert.equal(readRegistry(ctx, 'acme')[0].status, 'validated');
  assert.equal(readRegistry(ctx, 'acme')[0].updated, 1);

  const audit = readAudit(ctx, 'acme');
  assert.equal(audit.length, 2);
  assert.match(audit[0].reason, /unknown skill cambium-renamed-skill/);
  assert.match(audit[1].reason, /declining/);
});

test('skills apply-promotions consumes already-production action idempotently', async () => {
  const ctx = tmpCtx();
  writeRegistry(ctx, 'acme', [skill({ status: 'production' })]);
  const consumed: any[] = [];

  const result: any = await applySkillPromotionDecisions(ctx, 'acme', {
    baseUrl: 'https://worker.test',
    token: 'push-token',
    fetchImpl: gateFetch([action()], consumed),
    now: () => 123456,
    nowIso: () => '2026-06-22T00:03:00.000Z',
  });

  assert.equal(result.alreadyProduction, 1);
  assert.equal(result.applied, 0);
  assert.equal(result.consumed, 1);
  assert.equal(readRegistry(ctx, 'acme')[0].status, 'production');
  assert.equal(readRegistry(ctx, 'acme')[0].updated, 1);
  assert.equal(readAudit(ctx, 'acme')[0].result, 'already-production');
});

test('skills apply-promotions dry-run reports readiness without consuming or writing', async () => {
  const ctx = tmpCtx();
  writeRegistry(ctx, 'acme', [skill()]);
  const consumed: any[] = [];

  const result: any = await applySkillPromotionDecisions(ctx, 'acme', {
    baseUrl: 'https://worker.test',
    token: 'push-token',
    fetchImpl: gateFetch([action()], consumed),
    now: () => 123456,
    nowIso: () => '2026-06-22T00:04:00.000Z',
    dryRun: true,
  });

  assert.equal(result.applied, 1);
  assert.equal(result.consumed, 0);
  assert.equal(consumed.length, 0);
  assert.equal(readRegistry(ctx, 'acme')[0].status, 'validated');
  assert.equal(existsSync(join(ctx.root, '.operator', 'acme.skill-promotions.jsonl')), false);
});
