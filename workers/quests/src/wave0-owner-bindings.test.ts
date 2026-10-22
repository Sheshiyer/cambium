import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { wave0OwnerBindings } from './wave0-owner-bindings.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
// A fresh key per run: production parsing refuses the committed test-vector key.
const raw = (generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }) as Buffer).subarray(12);
const KEYS = JSON.stringify([{ keyId: `ed25519:${createHash('sha256').update(raw).digest('hex')}`, publicKey: raw.toString('base64url') }]);
const TEST_VECTOR_KEYS = JSON.stringify([{ keyId: 'ed25519:65b60673d6ed884bf01c2c222d82ada0740f29ac3355d6a925c81f17f47a27b8', publicKey: 'ebVWLo_mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ' }]);
const SECRET = 's'.repeat(32);
const vault = { async get() { return null; }, async put() { return null; } };
const readOnlyVault = { async get() { return null; } };
const db = { prepare() { throw new Error('not used at wiring time'); } } as never;

test('wiring is all-or-nothing: any missing D1, writable vault or valid owner key keeps the read-only reader', async () => {
  for (const env of [
    {}, { THOUGHTSEED_VAULT: vault }, { THOUGHTSEED_VAULT: vault, BRIDGE_DB: db, WAVE0_ACTIVATION_KEY: SECRET },
    { THOUGHTSEED_VAULT: vault, BRIDGE_DB: db, ACCEPTANCE_OWNER_PUBKEYS: '[]', WAVE0_ACTIVATION_KEY: SECRET },
    { THOUGHTSEED_VAULT: vault, BRIDGE_DB: db, ACCEPTANCE_OWNER_PUBKEYS: KEYS.replace('ed25519:', 'ed25519:0'), WAVE0_ACTIVATION_KEY: SECRET },
    { THOUGHTSEED_VAULT: vault, BRIDGE_DB: db, ACCEPTANCE_OWNER_PUBKEYS: TEST_VECTOR_KEYS, WAVE0_ACTIVATION_KEY: SECRET },
    { THOUGHTSEED_VAULT: vault, BRIDGE_DB: db, ACCEPTANCE_OWNER_PUBKEYS: KEYS },
    { THOUGHTSEED_VAULT: vault, BRIDGE_DB: db, ACCEPTANCE_OWNER_PUBKEYS: KEYS, WAVE0_ACTIVATION_KEY: 'short' },
    { THOUGHTSEED_VAULT: readOnlyVault, BRIDGE_DB: db, ACCEPTANCE_OWNER_PUBKEYS: KEYS, WAVE0_ACTIVATION_KEY: SECRET },
    { BRIDGE_DB: db, ACCEPTANCE_OWNER_PUBKEYS: KEYS, WAVE0_ACTIVATION_KEY: SECRET },
  ]) {
    const deps = await wave0OwnerBindings(env as never);
    assert.equal(deps.terminalFoldback, undefined);
    assert.equal(deps.acceptedWorkUnitReadback, undefined);
    assert.equal(Boolean(deps.foldbackReader), Boolean((env as { THOUGHTSEED_VAULT?: unknown }).THOUGHTSEED_VAULT));
  }
  const full = await wave0OwnerBindings({ THOUGHTSEED_VAULT: vault, BRIDGE_DB: db, ACCEPTANCE_OWNER_PUBKEYS: KEYS, WAVE0_ACTIVATION_KEY: SECRET } as never);
  assert.ok(full.terminalFoldback?.acceptanceStore && full.terminalFoldback.prepare && full.acceptedWorkUnitReadback && full.foldbackReader);
  assert.equal(full.terminalFoldback.activationVerifier.source, 'external-admission-readback');
});

function staticImports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/^\s*import\s+(?!type\b)[^'"]*?from\s+['"](\.[^'"]+)['"]/gm), ...text.matchAll(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g)]
    .map((match) => resolve(dirname(file), match[1]))
    .filter((path) => existsSync(path));
}

test('fixture guard: the production Worker import graph reaches no fixture or test module', () => {
  const seen = new Set<string>();
  const queue = [join(HERE, 'index.ts')];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...staticImports(file));
  }
  assert.ok(seen.has(join(HERE, 'wave0-owner-bindings.ts')) && seen.has(join(HERE, 'terminal-admission.ts')) && seen.has(join(HERE, 'accepted-work-unit-attestation.ts')));
  const offenders = [...seen].filter((file) => /\.test\.|fixture|synthetic/i.test(file.slice(HERE.length)));
  assert.deepEqual(offenders, []);
  for (const file of ['wave0-owner-bindings.ts', 'terminal-admission.ts', 'accepted-work-unit-attestation.ts']) {
    assert.doesNotMatch(readFileSync(join(HERE, file), 'utf8'), /test-fixture|local-synthetic-fixture/, file);
  }
  // The production call site never widens the acceptance domain seam.
  const handler = readFileSync(join(HERE, 'handler.ts'), 'utf8');
  const calls = handler.match(/readFoldbackMissionFacts\(\{[\s\S]*?\}\)/g) ?? [];
  assert.ok(calls.length >= 1);
  for (const call of calls) assert.doesNotMatch(call, /acceptanceDomains/);
});

test('labs config: ACCEPTANCE_OWNER_PUBKEYS holds exactly one production owner key, and the activation secret is not a var', async () => {
  const { parseJsonc } = await import('../../../scripts/quests-wrangler-profile.mjs');
  const { parseAcceptanceOwnerPublicKeys, TEST_VECTOR_KEY_ID } = await import('./accepted-work-unit-attestation.ts');
  const config = parseJsonc(readFileSync(join(HERE, '..', 'wrangler.labs.jsonc'), 'utf8'));
  const keys = await parseAcceptanceOwnerPublicKeys(config.vars.ACCEPTANCE_OWNER_PUBKEYS);
  assert.equal(keys.length, 1);
  assert.notEqual(keys[0].keyId, TEST_VECTOR_KEY_ID);
  assert.equal('WAVE0_ACTIVATION_KEY' in config.vars, false);
});
