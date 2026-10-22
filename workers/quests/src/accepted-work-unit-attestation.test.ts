import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, sign } from 'node:crypto';
import {
  acceptanceObjectKey, acceptedReceiptDigest, attestationMessage, canonicalAttestationJson, createAttestedAcceptanceStore,
  createAttestedAcceptedWorkUnitReadback, parseAcceptanceOwnerPublicKeys, verifyAcceptedWorkUnitAttestation,
} from './accepted-work-unit-attestation.ts';

// Shared with Temperance router/wtfmedia-accepted-work-unit-attestation.v1.test.ts (PARITY_VECTOR).
// Both repos must produce these exact bytes; change them together or not at all.
const PARITY_VECTOR = {
  publicKey: 'ebVWLo_mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ',
  keyId: 'ed25519:65b60673d6ed884bf01c2c222d82ada0740f29ac3355d6a925c81f17f47a27b8',
  receipt: { schema: 'temperance.accepted-work-unit.v1', contractId: 'c'.repeat(64), binding: { taskId: 'wtf-source-mode-audit', goalId: 'wtf-finite-source-audit', workObjectId: 'branch:wtfmedia', executionInputDigest: 'sha256:' + 'a'.repeat(64) }, repoIdentity: 'Sheshiyer/wtfmedia', domain: 'local-source-verification', taskAccepted: true, wholeLifecycleAccepted: false, productionCambiumAdmission: false, note: 'é ✓ "quoted"' },
  receiptDigest: 'sha256:25ab15ef1346c2c7192eaed83dbe68715d45a56ebd8935403f37536b43f37ae7',
  signature: 'LNroRDzEunxoyLI8JyIXYUZ11P6n79gmBXY0AJlvmLjSQ0INrhPxo_G3y--W1voIFUk5s12Aa0tsvAX-6va0Cg',
};
// Test-only signing key: the deterministic seed 0x01..0x20 that produced PARITY_VECTOR.
const SEED = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1));
const PRIVATE = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), SEED]), format: 'der', type: 'pkcs8' });
const KEYS = [{ keyId: PARITY_VECTOR.keyId, publicKey: PARITY_VECTOR.publicKey }];
// These tests sign with the public test seed, so they opt in through the explicit seam.

async function envelope(receipt: Record<string, unknown> = PARITY_VECTOR.receipt, keyId = PARITY_VECTOR.keyId) {
  const receiptDigest = await acceptedReceiptDigest(receipt);
  return { schema: 'temperance.accepted-work-unit-attestation.v1', algorithm: 'Ed25519', keyId, receiptDigest,
    signature: sign(null, attestationMessage(receiptDigest, keyId), PRIVATE).toString('base64url'), receipt };
}

function memoryBucket() {
  const objects = new Map<string, string>();
  let puts = 0;
  return {
    objects, puts: () => puts,
    async get(key: string) { const body = objects.get(key); return body === undefined ? null : { async text() { return body; } }; },
    async put(key: string, value: Uint8Array, options?: { onlyIf?: { etagDoesNotMatch?: string } }) {
      puts++;
      if (options?.onlyIf?.etagDoesNotMatch === '*' && objects.has(key)) return null;
      objects.set(key, new TextDecoder().decode(value)); return { async text() { return objects.get(key)!; } };
    },
  };
}

test('parity vector: canonical bytes, digest and Worker-side Ed25519 verify match Temperance', async () => {
  const v = PARITY_VECTOR;
  assert.equal(canonicalAttestationJson(v.receipt), '{"binding":{"executionInputDigest":"sha256:' + 'a'.repeat(64) + '","goalId":"wtf-finite-source-audit","taskId":"wtf-source-mode-audit","workObjectId":"branch:wtfmedia"},"contractId":"' + 'c'.repeat(64) + '","domain":"local-source-verification","note":"é ✓ \\"quoted\\"","productionCambiumAdmission":false,"repoIdentity":"Sheshiyer/wtfmedia","schema":"temperance.accepted-work-unit.v1","taskAccepted":true,"wholeLifecycleAccepted":false}');
  assert.equal(await acceptedReceiptDigest(v.receipt), v.receiptDigest);
  const verified = await verifyAcceptedWorkUnitAttestation({ schema: 'temperance.accepted-work-unit-attestation.v1', algorithm: 'Ed25519', keyId: v.keyId, receiptDigest: v.receiptDigest, signature: v.signature, receipt: v.receipt }, { publicKeys: KEYS });
  assert.equal(verified.receiptDigest, v.receiptDigest);
});

test('public key config is self-certifying and fails to an empty, held key set', async () => {
  assert.deepEqual(await parseAcceptanceOwnerPublicKeys(JSON.stringify(KEYS)), [], 'the public test-vector key is refused in production parsing');
  assert.deepEqual(await parseAcceptanceOwnerPublicKeys(JSON.stringify(KEYS), { allowTestVectorKey: true }), KEYS);
  for (const raw of [undefined, '', 'not json', '[]', JSON.stringify([{ ...KEYS[0], keyId: 'ed25519:' + '0'.repeat(64) }]),
    JSON.stringify([{ ...KEYS[0], extra: 1 }]), JSON.stringify([{ keyId: KEYS[0].keyId, publicKey: 'AAAA' }]), JSON.stringify(Array(5).fill(KEYS[0]))]) {
    assert.deepEqual(await parseAcceptanceOwnerPublicKeys(raw, { allowTestVectorKey: true }), [], String(raw));
  }
});

test('tampered receipt, digest, signature, key id, extra fields and fixture domain all fail closed', async () => {
  const good = await envelope();
  await verifyAcceptedWorkUnitAttestation(good, { publicKeys: KEYS });
  const sig = Buffer.from(good.signature, 'base64url'); sig[0] ^= 1;
  // Same 64 bytes, different spelling: the last char's unused low bits flipped.
  const last = good.signature.at(-1)!;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const respelled = good.signature.slice(0, -1) + alphabet[alphabet.indexOf(last) ^ 1];
  assert.deepEqual(Buffer.from(respelled, 'base64url'), Buffer.from(good.signature, 'base64url'));
  const cases: unknown[] = [
    { ...good, receipt: { ...good.receipt, wholeLifecycleAccepted: true } },
    { ...good, receipt: { ...good.receipt, note: 'changed' } },
    { ...good, receiptDigest: 'sha256:' + 'f'.repeat(64) },
    { ...good, signature: sig.toString('base64url') },
    { ...good, signature: respelled },
    { ...good, keyId: 'ed25519:' + '0'.repeat(64) },
    { ...good, extra: true },
    { ...good, algorithm: 'HS256' },
    await envelope({ ...PARITY_VECTOR.receipt, domain: 'test-fixture' }),
    await envelope({ ...PARITY_VECTOR.receipt, productionCambiumAdmission: true }),
    null,
  ];
  for (const candidate of cases) await assert.rejects(() => verifyAcceptedWorkUnitAttestation(candidate, { publicKeys: KEYS }));
  await assert.rejects(() => verifyAcceptedWorkUnitAttestation(good, { publicKeys: [] }));
});

test('store verifies before writing, is content-addressed and immutable; readback re-verifies the exact binding', async () => {
  const bucket = memoryBucket();
  const store = createAttestedAcceptanceStore(bucket, KEYS);
  const forged = { ...(await envelope()), signature: PARITY_VECTOR.signature.replace(/^./, 'A') };
  await assert.rejects(() => store.record(forged));
  assert.equal(bucket.puts(), 0, 'nothing is written before verification');
  const good = await envelope();
  const first = await store.record(good);
  assert.equal(first.r2Key, acceptanceObjectKey('branch:wtfmedia', good.receiptDigest));
  assert.equal(first.duplicate, false);
  assert.equal((await store.record(good)).duplicate, true);
  const readback = createAttestedAcceptedWorkUnitReadback(bucket, KEYS);
  const binding = { taskId: 'wtf-source-mode-audit', workObjectId: 'branch:wtfmedia', terminalProofDigest: good.receiptDigest };
  assert.deepEqual(await readback.readAcceptedWorkUnit(binding), good.receipt);
  // Replay under a different task, a missing digest or no keys grants nothing.
  await assert.rejects(() => readback.readAcceptedWorkUnit({ ...binding, taskId: 'another-task' }));
  assert.equal(await readback.readAcceptedWorkUnit({ ...binding, terminalProofDigest: undefined }), null);
  assert.equal(await createAttestedAcceptedWorkUnitReadback(bucket, []).readAcceptedWorkUnit(binding), null);
  assert.equal(await readback.readAcceptedWorkUnit({ ...binding, terminalProofDigest: 'sha256:' + 'e'.repeat(64) }), null);
  // Bytes planted directly in R2 are re-verified, not trusted for existing.
  bucket.objects.set(first.r2Key, canonicalAttestationJson({ ...good, receipt: { ...good.receipt, note: 'planted' } }));
  await assert.rejects(() => readback.readAcceptedWorkUnit(binding));
  bucket.objects.set(first.r2Key, 'x'.repeat(20_000));
  await assert.rejects(() => readback.readAcceptedWorkUnit(binding), /bounded size/);
  await assert.rejects(() => store.record(good), /conflict/);
});
