// Route B acceptance transport (operator decision 2026-10-19, design 2026-10-20).
//
// Temperance's accepted-work-unit owner authenticates its local store with an
// HMAC key that never leaves the Mac, so a Worker cannot verify it. Receipts
// that cross into Cambium are instead signed with a separate Ed25519 owner key.
// The Worker holds only the public half (`ACCEPTANCE_OWNER_PUBKEYS`, not a
// secret) and verifies every envelope it stores or reads. Nothing here can
// mint acceptance: a missing key, bad signature, digest mismatch, wrong
// binding or non-production domain all fail closed.
//
// Canonical bytes must match Temperance `canonicalJson` exactly; the parity
// vector in accepted-work-unit-attestation.test.ts is shared with
// router/wtfmedia-accepted-work-unit-attestation.v1.test.ts.

import type { R2BucketLike } from './context-bindings.ts';
import type { AcceptedWorkUnitReadback, AcceptedWorkUnitReceipt } from './foldback-mission-consumer.ts';

export const ACCEPTED_WORK_UNIT_ATTESTATION_SCHEMA = 'temperance.accepted-work-unit-attestation.v1' as const;
/** The only domain a production readback accepts. Fixture domains are a test seam, never wired here. */
export const PRODUCTION_ACCEPTANCE_DOMAINS: readonly string[] = Object.freeze(['local-source-verification']);

const TEXT = new TextEncoder();
const SHA256_REF = /^sha256:[0-9a-f]{64}$/;
const KEY_ID = /^ed25519:[0-9a-f]{64}$/;
const B64URL = /^[A-Za-z0-9_-]+$/;
const WORK_ID = /^(sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ENVELOPE_BYTES = 16 * 1024;
const MAX_KEYS = 4;
/**
 * The committed test-vector key (seed 0x01..0x20, shared by both repos' parity
 * tests). Its private half is public, so production parsing always refuses it.
 */
export const TEST_VECTOR_KEY_ID = 'ed25519:65b60673d6ed884bf01c2c222d82ada0740f29ac3355d6a925c81f17f47a27b8';

export interface AcceptanceOwnerPublicKey {
  keyId: string;
  /** Raw 32-byte Ed25519 public key, base64url. */
  publicKey: string;
}

export interface AcceptedWorkUnitAttestation {
  schema: typeof ACCEPTED_WORK_UNIT_ATTESTATION_SCHEMA;
  algorithm: 'Ed25519';
  keyId: string;
  receiptDigest: string;
  signature: string;
  receipt: AcceptedWorkUnitReceipt;
}

export class AcceptedWorkUnitAttestationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AcceptedWorkUnitAttestationError';
  }
}

const fail = (message: string): never => { throw new AcceptedWorkUnitAttestationError(message); };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Sorted keys, no whitespace, undefined members dropped. Byte-identical to Temperance `canonicalJson`. */
export function canonicalAttestationJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalAttestationJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalAttestationJson(record[key])}`).join(',')}}`;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return [...new Uint8Array(result)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function acceptedReceiptDigest(receipt: unknown): Promise<string> {
  return `sha256:${await sha256Hex(TEXT.encode(canonicalAttestationJson(receipt)))}`;
}

/** Domain-separated signing input; must match Temperance `attestationMessage`. */
export function attestationMessage(receiptDigest: string, keyId: string): Uint8Array {
  return TEXT.encode(`${ACCEPTED_WORK_UNIT_ATTESTATION_SCHEMA}\n${keyId}\n${receiptDigest}`);
}

function base64urlBytes(value: string, label: string): Uint8Array {
  if (!B64URL.test(value)) fail(`${label} is not base64url`);
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  let binary: string;
  try { binary = atob(padded); } catch { return fail(`${label} is not base64url`); }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  // Strict: only the canonical unpadded encoding of these bytes is accepted, so
  // one signature cannot be re-spelled to occupy an immutable slot first.
  const canonical = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (canonical !== value) fail(`${label} is not canonical base64url`);
  return bytes;
}

/**
 * Parses the Worker var. Each key id is self-certifying (`ed25519:` + sha256 of
 * the raw key), so a var that pairs an id with a different key is rejected.
 * Absent or malformed config yields no keys, which leaves acceptance held.
 */
export async function parseAcceptanceOwnerPublicKeys(raw: string | undefined, options: { allowTestVectorKey?: boolean } = {}): Promise<AcceptanceOwnerPublicKey[]> {
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_KEYS) return [];
  const keys: AcceptanceOwnerPublicKey[] = [];
  for (const entry of parsed) {
    if (!isRecord(entry) || Object.keys(entry).sort().join(',') !== 'keyId,publicKey') return [];
    const { keyId, publicKey } = entry;
    if (typeof keyId !== 'string' || !KEY_ID.test(keyId) || typeof publicKey !== 'string') return [];
    let bytes: Uint8Array;
    try { bytes = base64urlBytes(publicKey, 'publicKey'); } catch { return []; }
    if (bytes.length !== 32 || `ed25519:${await sha256Hex(bytes)}` !== keyId) return [];
    if (keyId === TEST_VECTOR_KEY_ID && !options.allowTestVectorKey) return [];
    keys.push({ keyId, publicKey });
  }
  return keys;
}

function validateReceipt(raw: unknown, allowedDomains: readonly string[]): AcceptedWorkUnitReceipt {
  if (!isRecord(raw)) return fail('receipt must be an object');
  if (raw.schema !== 'temperance.accepted-work-unit.v1') fail('receipt schema is invalid');
  if (raw.taskAccepted !== true || raw.wholeLifecycleAccepted !== false || raw.productionCambiumAdmission !== false) {
    fail('receipt scope is invalid');
  }
  if (typeof raw.domain !== 'string' || !allowedDomains.includes(raw.domain)) fail('receipt domain is not accepted here');
  if (typeof raw.contractId !== 'string' || !isRecord(raw.binding)) fail('receipt binding is invalid');
  const binding = raw.binding as Record<string, unknown>;
  for (const field of ['taskId', 'goalId', 'workObjectId'] as const) {
    if (typeof binding[field] !== 'string' || !(binding[field] as string)) fail(`receipt binding.${field} is invalid`);
  }
  if (binding.executionInputDigest !== undefined && (typeof binding.executionInputDigest !== 'string' || !SHA256_REF.test(binding.executionInputDigest))) {
    fail('receipt binding.executionInputDigest is invalid');
  }
  return raw as unknown as AcceptedWorkUnitReceipt;
}

/** Full verification of one envelope. Returns the receipt only when every check passes. */
export async function verifyAcceptedWorkUnitAttestation(raw: unknown, options: {
  publicKeys: readonly AcceptanceOwnerPublicKey[];
  allowedDomains?: readonly string[];
}): Promise<AcceptedWorkUnitAttestation> {
  if (!isRecord(raw)) return fail('attestation must be an object');
  if (Object.keys(raw).sort().join(',') !== 'algorithm,keyId,receipt,receiptDigest,schema,signature') fail('attestation fields are invalid');
  if (raw.schema !== ACCEPTED_WORK_UNIT_ATTESTATION_SCHEMA || raw.algorithm !== 'Ed25519') fail('attestation schema is invalid');
  if (typeof raw.keyId !== 'string' || typeof raw.receiptDigest !== 'string' || typeof raw.signature !== 'string') fail('attestation fields are invalid');
  const keyId = raw.keyId as string;
  const receiptDigest = raw.receiptDigest as string;
  if (!SHA256_REF.test(receiptDigest)) fail('attestation digest is invalid');
  const key = options.publicKeys.find((candidate) => candidate.keyId === keyId);
  if (!key) fail('attestation key is not trusted');
  const receipt = validateReceipt(raw.receipt, options.allowedDomains ?? PRODUCTION_ACCEPTANCE_DOMAINS);
  if (await acceptedReceiptDigest(receipt) !== receiptDigest) fail('attestation digest does not match receipt');
  const signature = base64urlBytes(raw.signature as string, 'signature');
  if (signature.length !== 64) fail('attestation signature is invalid');
  let verified = false;
  try {
    const cryptoKey = await crypto.subtle.importKey('raw', base64urlBytes(key!.publicKey, 'publicKey') as unknown as BufferSource,
      { name: 'Ed25519' }, false, ['verify']);
    verified = await crypto.subtle.verify({ name: 'Ed25519' }, cryptoKey, signature as unknown as BufferSource,
      attestationMessage(receiptDigest, keyId) as unknown as BufferSource);
  } catch {
    verified = false;
  }
  if (!verified) fail('attestation signature does not verify');
  return { schema: ACCEPTED_WORK_UNIT_ATTESTATION_SCHEMA, algorithm: 'Ed25519', keyId, receiptDigest, signature: raw.signature as string, receipt };
}

/**
 * Content-addressed: the key commits to the digest, and the signature commits to the owner.
 * Acceptance is looked up by receipt digest alone (review M2). That is safe because every
 * native command's outputDigest is either pinned by the bridge (canary, service agreement)
 * or, for source_verification.accept, verified at ingress against an owner-signed envelope
 * for that exact digest, task and directive input. Any new command whose outputDigest the
 * runner chooses must do the same before it ships.
 */
export function acceptanceObjectKey(workObjectId: string, receiptDigest: string): string {
  if (!WORK_ID.test(workObjectId)) fail('acceptance WorkObject is invalid');
  if (!SHA256_REF.test(receiptDigest)) fail('acceptance digest is invalid');
  return `portfolio/thoughtseed/workobjects/${workObjectId}/acceptance/${receiptDigest.slice('sha256:'.length)}.json`;
}

export interface AttestedAcceptanceStore {
  /** Verification only, with the same trusted keys; no R2 access. */
  verify(envelope: unknown): Promise<AcceptedWorkUnitAttestation>;
  record(envelope: unknown): Promise<{ r2Key: string; receiptDigest: string; duplicate: boolean }>;
}

/** Verify-then-write, immutable. A second write of different bytes to the same key is a conflict. */
export function createAttestedAcceptanceStore(bucket: R2BucketLike, publicKeys: readonly AcceptanceOwnerPublicKey[]): AttestedAcceptanceStore {
  return {
    verify: (envelope) => verifyAcceptedWorkUnitAttestation(envelope, { publicKeys }),
    async record(envelope) {
      if (!bucket.put) fail('acceptance R2 binding is not writable');
      const verified = await verifyAcceptedWorkUnitAttestation(envelope, { publicKeys });
      const r2Key = acceptanceObjectKey(verified.receipt.binding.workObjectId, verified.receiptDigest);
      const body = canonicalAttestationJson(verified);
      const existing = await bucket.get(r2Key);
      if (existing) {
        if (await existing.text() !== body) fail('acceptance object conflict');
        return { r2Key, receiptDigest: verified.receiptDigest, duplicate: true };
      }
      let stored: unknown;
      try {
        stored = await bucket.put!(r2Key, TEXT.encode(body), {
          onlyIf: { etagDoesNotMatch: '*' },
          httpMetadata: { contentType: 'application/json' },
          customMetadata: { schema: ACCEPTED_WORK_UNIT_ATTESTATION_SCHEMA, keyId: verified.keyId },
        });
      } catch {
        stored = null;
      }
      // A null put means another writer won the race; only identical bytes count as success.
      const winner = await bucket.get(r2Key);
      if (!winner) fail('acceptance write was not confirmed');
      if (await winner!.text() !== body) fail('acceptance object conflict');
      return { r2Key, receiptDigest: verified.receiptDigest, duplicate: !stored };
    },
  };
}

/**
 * Production `AcceptedWorkUnitReadback`. Reads the content-addressed envelope
 * for the terminal proof digest, verifies it again (R2 bytes are not trusted
 * just because they exist) and returns the receipt only for the exact binding.
 */
export function createAttestedAcceptedWorkUnitReadback(bucket: R2BucketLike, publicKeys: readonly AcceptanceOwnerPublicKey[]): AcceptedWorkUnitReadback {
  return {
    source: 'owner-readback',
    async readAcceptedWorkUnit({ taskId, workObjectId, terminalProofDigest }) {
      if (!publicKeys.length || !terminalProofDigest) return null;
      const object = await bucket.get(acceptanceObjectKey(workObjectId, terminalProofDigest));
      if (!object) return null;
      const text = await object.text();
      if (TEXT.encode(text).length > MAX_ENVELOPE_BYTES) fail('acceptance object exceeds bounded size');
      let raw: unknown;
      try { raw = JSON.parse(text); } catch { return fail('acceptance object is not JSON'); }
      const verified = await verifyAcceptedWorkUnitAttestation(raw, { publicKeys });
      if (verified.receiptDigest !== terminalProofDigest) fail('acceptance digest does not match terminal proof');
      if (verified.receipt.binding.taskId !== taskId || verified.receipt.binding.workObjectId !== workObjectId) fail('acceptance binding mismatch');
      return verified.receipt;
    },
  };
}
