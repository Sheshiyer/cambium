import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlexusRoutineContext } from './plexus-knowledge.ts';

test('Plexus knowledge context accepts only provenance-bearing gateway excerpts', async () => {
  const context = createPlexusRoutineContext({ url: 'https://plexus.example/v1/github/knowledge/routine-snapshot', token: 'gateway-token', fetchImpl: async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get('routine'), 'daily-standup');
    return Response.json({ ok: true, data: { repository: 'Sheshiyer/thoughtseed-labs', commit: 'a'.repeat(40), documents: [{ title: 'System of records', path: '00-meta/system-of-records.md', fileSha: 'b'.repeat(40), excerpt: '# Canonical records' }] } });
  } });
  const snapshot = await context.getSnapshot({ tenant: 'cambium', routine: 'daily-standup' });
  assert.equal(snapshot.metadata.provider, 'plexus-github-app-gateway');
  assert.equal(snapshot.sections[0]?.items[0]?.sourceKey, `github://Sheshiyer/thoughtseed-labs/00-meta/system-of-records.md@${'b'.repeat(40)}`);
});

test('Plexus knowledge context fails closed on malformed gateway provenance', async () => {
  const context = createPlexusRoutineContext({ url: 'https://plexus.example/v1/github/knowledge/routine-snapshot', token: 'gateway-token', fetchImpl: async () => Response.json({ ok: true, data: { repository: 'repo', commit: 'not-a-sha', documents: [] } }) });
  const snapshot = await context.getSnapshot({ tenant: 'cambium', routine: 'daily-standup' });
  assert.equal(snapshot.sections[0]?.signalState, 'blocked-no-signal');
});

test('Plexus knowledge context exposes no sections until the gateway is configured', async () => {
  const snapshot = await createPlexusRoutineContext().getSnapshot({ tenant: 'cambium', routine: 'daily-standup' });
  assert.deepEqual(snapshot.sections, []);
});
