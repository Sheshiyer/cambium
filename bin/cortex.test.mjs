import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCortex, localTransport } from './lib/cortex.mjs';

// makeCortex is a thin client over an injected transport (the real CF Worker swaps in for the stub)
test('makeCortex delegates every method to the injected transport', async () => {
  const calls = [];
  const fake = {
    embed: (x) => { calls.push(['embed', x]); return [0.1]; },
    search: (v, k) => { calls.push(['search', v, k]); return []; },
    readContract: (b, g) => { calls.push(['readContract', b, g]); return null; },
    writeContract: (b, g, d) => { calls.push(['writeContract', b, g, d]); },
    writeDeviation: (r) => { calls.push(['writeDeviation', r]); },
  };
  const cortex = makeCortex(fake);
  await cortex.embed('x'); await cortex.search([1], 3);
  await cortex.readContract('acme', 'brand_system'); await cortex.writeContract('acme', 'brand_system', { a: 1 });
  cortex.writeDeviation('{"stage":"build"}');
  assert.deepEqual(calls.map((c) => c[0]), ['embed', 'search', 'readContract', 'writeContract', 'writeDeviation']);
});

// the LOCAL transport: writeDeviation is the real swap (appends the ledger); fs injected for testability
test('localTransport.writeDeviation appends the record line to deviations.jsonl', () => {
  const writes = [];
  const fs = { appendFileSync: (p, s) => writes.push([p, s]), readFileSync: () => '', writeFileSync: () => {}, existsSync: () => false, mkdirSync: () => {} };
  const t = localTransport({ root: '/x', fs });
  t.writeDeviation('{"stage":"build","kind":"error"}');
  assert.equal(writes.length, 1);
  assert.match(writes[0][0], /deviations\.jsonl$/);
  assert.equal(writes[0][1], '{"stage":"build","kind":"error"}\n');
});

test('localTransport round-trips a variable-contract group (write then read returns it)', () => {
  const store = {};
  const fs = {
    appendFileSync: () => {},
    writeFileSync: (p, s) => { store[p] = s; },
    readFileSync: (p) => store[p],
    existsSync: (p) => p in store,
    mkdirSync: () => {},
  };
  const t = localTransport({ root: '/x', fs });
  t.writeContract('acme', 'brand_system', { palette: ['#FF6B35'] });
  assert.deepEqual(t.readContract('acme', 'brand_system'), { palette: ['#FF6B35'] });
});

test('localTransport.readContract returns null for an absent group', () => {
  const fs = { appendFileSync: () => {}, writeFileSync: () => {}, readFileSync: () => '', existsSync: () => false, mkdirSync: () => {} };
  assert.equal(localTransport({ root: '/x', fs }).readContract('acme', 'nope'), null);
});

test('localTransport.embed throws — embeddings need the NIM Worker transport (I3 follow-up)', () => {
  const fs = { appendFileSync: () => {}, writeFileSync: () => {}, readFileSync: () => '', existsSync: () => false, mkdirSync: () => {} };
  assert.throws(() => localTransport({ root: '/x', fs }).embed('x'), /NIM Worker/);
});
