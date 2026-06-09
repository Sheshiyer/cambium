// Cambium operator · CodeGraph code-recall lane (M2 / B6, issue #24) — adapter + client (mocked exec).
// Mocks mirror the REAL `codegraph` CLI shapes: status {initialized,nodeCount}; query [{node,score}].

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codegraphRecall, stubCodegraphClient, cliCodegraphClient } from './codegraph-recall.ts';

test('codegraphRecall · structural neighbors + a note (stub client)', async () => {
  const client = stubCodegraphClient({
    'wake loop': [
      { name: 'wake', kind: 'function', file: 'bin/operator/operator.ts', relation: 'match' },
      { name: 'wakeAsync', kind: 'function', file: 'bin/operator/orchestrate.ts', relation: 'match' },
    ],
  });
  const r = await codegraphRecall(client, 'wake loop', '/repo', 5);
  assert.equal(r.count, 2);
  assert.equal(r.neighbors[0].name, 'wake');
  assert.match(r.note, /code-recall: 2 structural neighbors → function wake/);
});

test('codegraphRecall · fail-closed when there is no .codegraph index', async () => {
  const client = { ready: () => false, context: () => [] };
  await assert.rejects(() => codegraphRecall(client, 'x', '/repo'), /fail-closed/);
});

test('codegraphRecall · honors k', async () => {
  const client = stubCodegraphClient({ q: [
    { name: 'a', kind: 'fn', relation: 'm' }, { name: 'b', kind: 'fn', relation: 'm' }, { name: 'c', kind: 'fn', relation: 'm' },
  ] });
  assert.equal((await codegraphRecall(client, 'q', '/repo', 2)).count, 2);
});

test('cliCodegraphClient · ready parses status.initialized + nodeCount', async () => {
  const exec = async (args: string[]) => args[0] === 'status'
    ? { ok: true, stdout: JSON.stringify({ initialized: true, nodeCount: 5000, fileCount: 100 }) }
    : { ok: true, stdout: '[]' };
  assert.equal(await cliCodegraphClient({ exec }).ready('/repo'), true);
});

test('cliCodegraphClient · ready=false when not initialized, empty, or status fails', async () => {
  assert.equal(await cliCodegraphClient({ exec: async () => ({ ok: true, stdout: JSON.stringify({ initialized: false, nodeCount: 0 }) }) }).ready('/repo'), false);
  assert.equal(await cliCodegraphClient({ exec: async () => ({ ok: false, stdout: '' }) }).ready('/repo'), false);
});

test('cliCodegraphClient · parses the real `codegraph query --json` ({node,score} array)', async () => {
  const exec = async (args: string[]) => args[0] === 'query'
    ? { ok: true, stdout: JSON.stringify([
        { node: { name: 'wake', kind: 'function', filePath: 'bin/operator/operator.ts' }, score: 58.1 },
        { node: { name: 'wakeAsync', kind: 'function', filePath: 'bin/operator/orchestrate.ts' }, score: 40.2 },
      ]) }
    : { ok: true, stdout: JSON.stringify({ initialized: true, nodeCount: 1 }) };
  const ns = await cliCodegraphClient({ exec }).context('wake', '/repo');
  assert.equal(ns.length, 2);
  assert.equal(ns[0].name, 'wake');
  assert.equal(ns[0].kind, 'function');
  assert.equal(ns[0].file, 'bin/operator/operator.ts');
});

test('cliCodegraphClient · normalize handles flat shapes too (defensive)', async () => {
  const exec = async (args: string[]) => args[0] === 'query'
    ? { ok: true, stdout: JSON.stringify([{ symbol: 'foo', type: 'class', path: 'x.ts' }]) }
    : { ok: true, stdout: JSON.stringify({ initialized: true, nodeCount: 1 }) };
  const ns = await cliCodegraphClient({ exec }).context('foo', '/repo');
  assert.equal(ns[0].name, 'foo');
  assert.equal(ns[0].kind, 'class');
  assert.equal(ns[0].file, 'x.ts');
});
