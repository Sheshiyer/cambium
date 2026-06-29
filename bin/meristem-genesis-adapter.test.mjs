import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adaptersFile = new URL('../adapters.json', import.meta.url);

test('meristem Genesis adapter is active and brandmint is rollback-only', () => {
  const config = JSON.parse(readFileSync(adaptersFile, 'utf8'));

  const genesis = config.adapters.genesis;
  assert.equal(genesis.root_id, 'genesis');
  assert.equal(genesis.local_dir, 'cambium');
  assert.equal(genesis.cmd, 'node');
  assert.deepEqual(genesis.args, [
    'scripts/meristem-genesis-contract.mjs',
    '--meristem-root',
    '{input}',
    '--brand-dir',
    'brands/thoughtseed',
    '--out',
    '-',
  ]);
  assert.equal(genesis.spend, 'none');
  assert.equal(genesis.input_default, '../meristem');
  assert.equal(genesis.output, 'json:brand-dna');
  assert.deepEqual(genesis.contract_requires, ['idea']);
  assert.deepEqual(genesis.contract_produces, ['brand_system', 'copy_system', 'visual_system']);

  assert.equal(config.candidate_adapters?.genesis_meristem_candidate, undefined);

  const legacy = config.candidate_adapters?.genesis_brandmint_legacy;
  assert.ok(legacy, 'legacy brandmint rollback adapter missing');
  assert.equal(legacy.disabled, true);
  assert.equal(legacy.cmd, 'brandmint');
  assert.deepEqual(legacy.args, ['launch', '--waves', '1-8', '--brand', '{tenant}']);
});
