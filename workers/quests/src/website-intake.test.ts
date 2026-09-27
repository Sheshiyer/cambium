import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createIntakeTurn,
  handleWebsiteIntake,
  purgeExpiredWebsiteLeads,
  saveWebsiteLead,
  validateWebsiteLead,
} from './website-intake.ts';

const aiVersion = 'ai-processing-v1';
const leadVersion = 'lead-storage-90d-v1';
const fields = {
  requirement: 'A support workflow needs automation',
  stage: 'A prototype exists',
  handoff: 'A working prototype',
  cadence: 'Exploratory, no rush',
};

function env(overrides: Record<string, unknown> = {}) {
  return {
    WEBSITE_ORIGINS: 'http://localhost:5176',
    WEBSITE_AI_CONSENT_VERSION: aiVersion,
    WEBSITE_LEAD_CONSENT_VERSION: leadVersion,
    OPENAI_API_KEY: 'test-only-key',
    OPENAI_MODEL: 'gpt-6-luna',
    WEBSITE_OPS_EMAILS: 'ops@example.test',
    WEBSITE_ACCESS_TEAM_DOMAIN: 'thoughtseedlabs.cloudflareaccess.com',
    WEBSITE_ACCESS_AUDIENCE: 'website-ops-test-aud',
    ...overrides,
  } as any;
}

function intakeBody(overrides: Record<string, unknown> = {}) {
  return {
    consent: { accepted: true, version: aiVersion },
    messages: [{ role: 'user', content: 'We need to automate support triage.' }],
    currentFields: { requirement: null, stage: null, handoff: null, cadence: null },
    ...overrides,
  };
}

function leadBody(overrides: Record<string, unknown> = {}) {
  return {
    consent: { accepted: true, version: leadVersion },
    brief: { ...fields, notes: 'Please begin with a small pilot.' },
    contact: { channel: 'email', value: 'owner@example.test' },
    ...overrides,
  };
}

function fakeLimiter() {
  return { limit: async () => ({ success: true }) };
}

function makeDb() {
  const rows = new Map<string, any>();
  return {
    rows,
    prepare(sql: string) {
      let values: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          values = args;
          return {
            async run() {
              if (sql.includes('INSERT INTO website_intake_leads')) {
                const [id, briefJson, channel, contact, consentVersion, consentedAt, createdAt, expiresAt] = values as string[];
                rows.set(id, { id, brief_json: briefJson, reply_channel: channel, reply_contact: contact, consent_version: consentVersion, consented_at: consentedAt, created_at: createdAt, expires_at: expiresAt });
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith('DELETE FROM website_intake_leads WHERE id')) return { meta: { changes: Number(rows.delete(values[0] as string)) } };
              if (sql.startsWith('DELETE FROM website_intake_leads WHERE expires_at')) {
                let changes = 0;
                for (const [id, row] of rows) if (row.expires_at <= values[0]) { rows.delete(id); changes += 1; }
                return { meta: { changes } };
              }
              return { meta: { changes: 0 } };
            },
            async first() {
              const row = rows.get(values[0] as string);
              return row && row.expires_at > values[1] ? row : null;
            },
            async all() {
              return { results: [...rows.values()].filter((row) => row.expires_at > values[0]).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100) };
            },
          };
        },
      };
    },
  };
}

function request(path: string, body?: unknown, options: { method?: string; origin?: string; headers?: Record<string, string> } = {}) {
  const method = options.method || 'POST';
  return new Request(`https://cambium.test${path}`, {
    method,
    headers: {
      ...(options.origin ? { origin: options.origin } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...options.headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function providerReply(overrides: Record<string, unknown> = {}) {
  const value = {
    reply: 'That is a useful starting point. What is already in place?',
    fields: { requirement: fields.requirement, stage: null, handoff: null, cadence: null },
    nextField: 'stage',
    readyForReview: false,
    ...overrides,
  };
  return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }));
}

test('AI turn requires consent and does not send contact details or enable tools/storage', async () => {
  let calls = 0;
  await assert.rejects(createIntakeTurn(intakeBody({ consent: { accepted: false, version: aiVersion } }), env(), async () => { calls += 1; return providerReply(); }), /consent/i);
  assert.equal(calls, 0);
  let sent: any;
  await createIntakeTurn(intakeBody({ messages: [{ role: 'user', content: 'Email owner@example.test, please build support triage.' }] }), env(), async (_url, init) => { sent = JSON.parse(String(init?.body)); return providerReply(); });
  assert.equal(sent.model, 'gpt-6-luna');
  assert.equal(sent.store, false);
  assert.equal('tools' in sent, false);
  assert.doesNotMatch(JSON.stringify(sent), /owner@example\.test/);
});

test('AI intake rejects malformed output, refusal, provider errors, and ninth response', async () => {
  const refusal = new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }));
  await assert.rejects(createIntakeTurn(intakeBody(), env(), async () => refusal), /process/i);
  await assert.rejects(createIntakeTurn(intakeBody(), env(), async () => new Response('{')), /invalid/i);
  await assert.rejects(createIntakeTurn(intakeBody(), env(), async () => new Response('', { status: 429 })), /unavailable/i);
  const messages = Array.from({ length: 17 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `Turn ${i}` }));
  let calls = 0;
  await assert.rejects(createIntakeTurn(intakeBody({ messages }), env(), async () => { calls += 1; return providerReply(); }), /eight|review|manual/i);
  assert.equal(calls, 0);
});

test('lead writes require storage consent and valid selected reply channel', () => {
  assert.throws(() => validateWebsiteLead(leadBody({ consent: { accepted: false, version: leadVersion } }), env()), /consent/i);
  assert.throws(() => validateWebsiteLead(leadBody({ brief: { ...fields, cadence: '' } }), env()), /complete brief/i);
  assert.throws(() => validateWebsiteLead(leadBody({ contact: { channel: 'whatsapp', value: '123' } }), env()), /WhatsApp/i);
  assert.throws(() => validateWebsiteLead(leadBody({ contact: { channel: 'email', value: 'invalid' } }), env()), /email/i);
});

test('D1 persistence keeps one consented brief and contact for exactly 90 days', async () => {
  const db = makeDb();
  const receipt = await saveWebsiteLead(db as any, leadBody(), env(), new Date('2026-09-24T12:00:00.000Z'), () => 'lead-test-uuid');
  const row = db.rows.get(receipt.id);
  assert.equal(receipt.expiresAt, '2026-12-23T12:00:00.000Z');
  assert.deepEqual(JSON.parse(row.brief_json), { ...fields, notes: 'Please begin with a small pilot.' });
  assert.equal(row.reply_contact, 'owner@example.test');
  assert.equal(row.consent_version, leadVersion);
  assert.equal(row.consented_at, '2026-09-24T12:00:00.000Z');
  assert.doesNotMatch(JSON.stringify(row), /transcript|messages|ip|user_agent/i);
});

test('retention cleanup deletes only records at or past their expiry', async () => {
  const db = makeDb();
  const now = new Date('2026-09-24T12:00:00.000Z');
  const receipt = await saveWebsiteLead(db as any, leadBody(), env(), now, () => 'lead-expiring-uuid');
  assert.equal(await purgeExpiredWebsiteLeads(db as any, receipt.expiresAt), 1);
  assert.equal(db.rows.size, 0);
});

test('public endpoints require allowed origins and fail closed without rate-limit bindings', async () => {
  const blockedOrigin = await handleWebsiteIntake(request('/v1/leads', leadBody(), { origin: 'https://attacker.test' }), env({ WEBSITE_LEAD_LIMITER: fakeLimiter(), BRIDGE_DB: makeDb() }));
  assert.equal(blockedOrigin?.status, 403);
  const noLimiter = await handleWebsiteIntake(request('/v1/intake/turn', intakeBody(), { origin: 'http://localhost:5176' }), env());
  assert.equal(noLimiter?.status, 503);
});

test('admin inbox requires Access and configured email allowlist on every request', async () => {
  const db = makeDb();
  const denied = await handleWebsiteIntake(request('/v1/admin/leads', undefined, { method: 'GET' }), env({ BRIDGE_DB: db }));
  assert.equal(denied?.status, 403);
  const allowed = await handleWebsiteIntake(request('/v1/admin/leads', undefined, { method: 'GET' }), env({ BRIDGE_DB: db }), {
    verifyOperator: async () => 'ops@example.test',
  });
  assert.equal(allowed?.status, 200);
  assert.deepEqual(await allowed?.json(), { leads: [] });
  const wrongEmail = await handleWebsiteIntake(request('/v1/admin/leads', undefined, { method: 'GET' }), env({ BRIDGE_DB: db }), {
    verifyOperator: async () => 'other@example.test',
  });
  assert.equal(wrongEmail?.status, 403);
});

test('admin list, detail, and delete remain Cambium-owned and re-check Access each time', async () => {
  const db = makeDb();
  const id = '00000000-0000-4000-8000-000000000001';
  await saveWebsiteLead(db as any, leadBody(), env(), new Date('2026-09-24T12:00:00.000Z'), () => id);
  let accessChecks = 0;
  const verifyOperator = async () => { accessChecks += 1; return 'ops@example.test'; };
  const list = await handleWebsiteIntake(request('/v1/admin/leads', undefined, { method: 'GET' }), env({ BRIDGE_DB: db }), { verifyOperator });
  const listed = await list?.json() as any;
  assert.deepEqual(listed.leads.map((lead: any) => lead.id), [id]);
  assert.doesNotMatch(JSON.stringify(listed), /owner@example\.test/);
  const detail = await handleWebsiteIntake(request(`/v1/admin/leads/${id}`, undefined, { method: 'GET' }), env({ BRIDGE_DB: db }), { verifyOperator });
  assert.equal((await detail?.json() as any).lead.replyContact, 'owner@example.test');
  const deletion = await handleWebsiteIntake(request(`/v1/admin/leads/${id}`, undefined, { method: 'DELETE', origin: 'https://cambium.test' }), env({ BRIDGE_DB: db }), { verifyOperator });
  assert.deepEqual(await deletion?.json(), { deleted: true });
  assert.equal(accessChecks, 3);
  assert.equal(db.rows.size, 0);
});

test('Cambium admin page is hosted under ops, no-cache, and protected before rendering', async () => {
  const db = makeDb();
  const blocked = await handleWebsiteIntake(request('/ops/leads', undefined, { method: 'GET' }), env({ BRIDGE_DB: db }));
  assert.equal(blocked?.status, 403);
  const page = await handleWebsiteIntake(request('/ops/leads', undefined, { method: 'GET' }), env({ BRIDGE_DB: db }), { verifyOperator: async () => 'ops@example.test' });
  assert.equal(page?.status, 200);
  assert.match(page?.headers.get('content-type') || '', /text\/html/);
  assert.equal(page?.headers.get('cache-control'), 'no-store');
  assert.match(await page?.text() || '', /Cambium/);
});
