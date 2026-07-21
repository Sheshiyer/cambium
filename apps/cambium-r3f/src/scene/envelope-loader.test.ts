import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnvelope } from './envelope-loader.ts';
import { founderIdentity } from './identity-model.ts';
import { DEFAULT_SETTINGS, type AppSettings } from './settings-model.ts';

const baseSettings: AppSettings = { ...DEFAULT_SETTINGS, workerBaseUrl: 'https://worker.example.com', tenant: 'demo-org' };

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>): { calls: { url: string; init?: RequestInit }[]; restore: () => void } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return impl(String(url), init);
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('success parses the quest envelope', async () => {
  const envelope = { tenant: 'demo-org', surface: { sections: [], subsections: [{ id: 'tapestry' }] } };
  const stub = stubFetch(async () => ({ ok: true, json: async () => envelope }));
  try {
    const result = await loadEnvelope(baseSettings, null);
    assert.deepEqual(result, { ok: true, envelope });
    assert.equal(stub.calls.length, 1);
    assert.equal(stub.calls[0]!.url, 'https://worker.example.com/api/quests/demo-org');
  } finally {
    stub.restore();
  }
});

test('identity sends an x-principal JSON header', async () => {
  const stub = stubFetch(async () => ({ ok: true, json: async () => ({}) }));
  try {
    const identity = founderIdentity('demo-org');
    const result = await loadEnvelope(baseSettings, identity);
    assert.equal(result.ok, true);
    const headers = stub.calls[0]!.init?.headers as Record<string, string>;
    assert.deepEqual(JSON.parse(headers['x-principal']!), identity.principal);
  } finally {
    stub.restore();
  }
});

test('non-200 returns bad-status', async () => {
  const stub = stubFetch(async () => ({ ok: false, status: 401 }));
  try {
    const result = await loadEnvelope(baseSettings, null);
    assert.deepEqual(result, { ok: false, reason: 'bad-status' });
  } finally {
    stub.restore();
  }
});

test('fetch throw (abort or network) returns offline', async () => {
  const stub = stubFetch(async () => { throw new Error('aborted'); });
  try {
    const result = await loadEnvelope(baseSettings, null);
    assert.deepEqual(result, { ok: false, reason: 'offline' });
  } finally {
    stub.restore();
  }
});

test('empty workerBaseUrl returns unconfigured without fetching', async () => {
  const stub = stubFetch(async () => ({ ok: true, json: async () => ({}) }));
  try {
    const result = await loadEnvelope({ ...baseSettings, workerBaseUrl: '' }, null);
    assert.deepEqual(result, { ok: false, reason: 'unconfigured' });
    assert.equal(stub.calls.length, 0);
  } finally {
    stub.restore();
  }
});
