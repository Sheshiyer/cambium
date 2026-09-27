import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Vendored canonical bytes plus reviewed immutable digests are the portable proof.
// Live cross-repository parity is a separate owner readback, never a CI sibling dependency.
const CONTRACTS = [
  {
    vendor: new URL('./platform-playbook-telegram-readiness.v1.json', import.meta.url),
    sha256: 'e1321e12f9fbf9dc33452b4f1811da9d30f27c69e8ef754f32b54f1617e09be0',
  },
  {
    vendor: new URL('./platform-playbook-messaging-consent.v1.json', import.meta.url),
    sha256: 'b4cfc79a885cec8e02460ea47011c16c5247972c295dbd96d3aa77440fdee411',
  },
] as const;

test('vendored platform-playbook contracts match reviewed canonical SHA-256 pins', () => {
  const provenance = JSON.parse(readFileSync(new URL('../../../docs/adapters/platform-playbook-contract-provenance.v1.json', import.meta.url), 'utf8'));
  assert.equal(provenance.sourceRepository, 'Sheshiyer/hermes-aws-ts');
  assert.equal(provenance.sourceCommit, '9865f716995790dd22e1366051483e7594b825ec');
  assert.equal(provenance.records.length, CONTRACTS.length);
  for (const [index, contract] of CONTRACTS.entries()) {
    const vendor = readFileSync(contract.vendor);
    assert.equal(provenance.records[index].sha256, contract.sha256);
    assert.equal(provenance.records[index].bytes, vendor.length);
    assert.equal(createHash('sha256').update(vendor).digest('hex'), contract.sha256);
  }
});
