import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adaptersFile = new URL('../adapters.json', import.meta.url);

test('meristem Genesis candidate is recorded but not active', () => {
  const config = JSON.parse(readFileSync(adaptersFile, 'utf8'));

  assert.equal(config.adapters.genesis.cmd, 'brandmint');
  assert.deepEqual(config.adapters.genesis.args, ['launch', '--waves', '1-8', '--brand', '{tenant}']);
  assert.equal(config.adapters.genesis_meristem_candidate, undefined);

  const candidate = config.candidate_adapters?.genesis_meristem_candidate;
  assert.ok(candidate, 'candidate adapter missing');
  assert.equal(candidate.disabled, true);
  assert.equal(candidate.cmd, 'node');
  assert.deepEqual(candidate.contract_produces, ['brand_system', 'copy_system', 'visual_system']);
  assert.match(candidate.note, /proof-only/i);
});
