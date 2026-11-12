import { createHash } from 'node:crypto';

export interface CambiumPatchPolicy {
  schema: 'thoughtseed.cambium.patch.policy.v1'; id: 'cambium.shared-signal-title.v1'; version: 1;
  workObjectId: 'sapling:cambium'; baseCommit: string; patchDigest: string;
  allowedPaths: readonly ['workers/quests/src/shared-signals.ts', 'workers/quests/src/shared-signals.test.ts'];
  testCommand: readonly ['node', '--test', 'workers/quests/src/shared-signals.test.ts'];
  image: string; modelPool: 'noesis-free'; acceptance: 'review-required'; externalActions: 'none';
  limits: { timeoutSeconds: 180; memoryMiB: 768; cpus: 1; pids: 128; outputBytes: 1048576; archiveBytes: 33554432 };
}
export interface CambiumPatchInput {
  schema: 'thoughtseed.cambium.patch.verify_input.v1'; taskId: string; workObjectId: 'sapling:cambium';
  directionId: string; directionRevision: number; directionDigest: string; workNodeId: string;
  approvedGraphVersion: number; baseCommit: string; patchBase64: string; patchDigest: string;
  policyId: string; policyDigest: string;
}
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH = /^sha256:[a-f0-9]{64}$/;
export const CAMBIUM_PATCH_PATHS = ['workers/quests/src/shared-signals.ts', 'workers/quests/src/shared-signals.test.ts'] as const;
export const CAMBIUM_PATCH_TEST = ['node', '--test', 'workers/quests/src/shared-signals.test.ts'] as const;
export const CAMBIUM_PATCH_LIMITS = { timeoutSeconds: 180, memoryMiB: 768, cpus: 1, pids: 128, outputBytes: 1048576, archiveBytes: 33554432 } as const;
function plain(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![null, Object.prototype].includes(Object.getPrototypeOf(v))) return false;
  return Reflect.ownKeys(v).every(k => typeof k === 'string' && 'value' in Object.getOwnPropertyDescriptor(v, k)!);
}
function exact(v: unknown, keys: readonly string[]): v is Record<string, unknown> {
  return plain(v) && Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
}
/** One wire digest across Worker and runner. Bytes are hashed without JSON encoding. */
export function canonicalPatchJson(value: unknown): string {
  const seen = new Set<object>();
  const visit = (v: unknown): string => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
    if (typeof v === 'number' && Number.isFinite(v)) return JSON.stringify(v);
    if (typeof v !== 'object' || !v || seen.has(v)) throw Error('non_json_value');
    seen.add(v);
    let result: string;
    if (Array.isArray(v)) {
      if (Reflect.ownKeys(v).length !== v.length + 1 || !Array.from({ length: v.length }, (_, i) => Object.hasOwn(v, i)).every(Boolean)) throw Error('non_json_array');
      result = '[' + v.map(visit).join(',') + ']';
    } else {
      if (!plain(v)) throw Error('non_json_object');
      result = '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + visit(v[k])).join(',') + '}';
    }
    seen.delete(v); return result;
  };
  return visit(value);
}
export function patchDigest(value: unknown): string {
  return 'sha256:' + createHash('sha256').update(value instanceof Uint8Array ? value : canonicalPatchJson(value)).digest('hex');
}

/** Shape validation only: policy authority must come from reviewed owner configuration. */
export function parseCambiumPatchPolicy(raw: unknown): CambiumPatchPolicy | null {
  if (!exact(raw, ['schema','id','version','workObjectId','baseCommit','patchDigest','allowedPaths','testCommand','image','modelPool','acceptance','externalActions','limits'])) return null;
  if (raw.schema !== 'thoughtseed.cambium.patch.policy.v1' || raw.id !== 'cambium.shared-signal-title.v1' || raw.version !== 1
      || raw.workObjectId !== 'sapling:cambium' || typeof raw.baseCommit !== 'string' || !/^[a-f0-9]{40}$/.test(raw.baseCommit)
      || typeof raw.patchDigest !== 'string' || !HASH.test(raw.patchDigest) || raw.modelPool !== 'noesis-free'
      || raw.acceptance !== 'review-required' || raw.externalActions !== 'none') return null;
  if (!Array.isArray(raw.allowedPaths) || JSON.stringify(raw.allowedPaths) !== JSON.stringify(CAMBIUM_PATCH_PATHS)
      || !Array.isArray(raw.testCommand) || JSON.stringify(raw.testCommand) !== JSON.stringify(CAMBIUM_PATCH_TEST)) return null;
  // A repository and immutable image digest only, never a Docker option or floating tag.
  if (typeof raw.image !== 'string' || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*@sha256:[a-f0-9]{64}$/.test(raw.image)) return null;
  if (!exact(raw.limits, Object.keys(CAMBIUM_PATCH_LIMITS)) || Object.entries(CAMBIUM_PATCH_LIMITS).some(([k,v]) => raw.limits[k] !== v)) return null;
  return raw as unknown as CambiumPatchPolicy;
}

/** Only ordinary text modifications to both pinned files; no mode/path transformations. */
export function validCambiumPatchText(text: string): boolean {
  if (!text || /[\u0000\r]/.test(text) || !text.endsWith('\n')) return false;
  const lines = text.split('\n'); lines.pop();
  const seen = new Set<string>(); let i = 0;
  while (i < lines.length) {
    const header = /^diff --git a\/(\S+) b\/(\S+)$/.exec(lines[i++]);
    if (!header || header[1] !== header[2] || !CAMBIUM_PATCH_PATHS.includes(header[1] as any) || seen.has(header[1])) return false;
    const path = header[1]; seen.add(path);
    if (!/^index [a-f0-9]{7,40}\.\.[a-f0-9]{7,40}(?: 100644)?$/.test(lines[i++] ?? '')) return false;
    if (lines[i++] !== `--- a/${path}` || lines[i++] !== `+++ b/${path}`) return false;
    let hunks = 0, changed = false;
    while (i < lines.length && !lines[i].startsWith('diff --git ')) {
      const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/.exec(lines[i++]);
      if (!hunk) return false;
      let old = Number(hunk[2] ?? 1), next = Number(hunk[4] ?? 1);
      if (![old,next,Number(hunk[1]),Number(hunk[3])].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000)) return false;
      hunks++;
      while (old || next) {
        const line = lines[i++]; if (line === undefined) return false;
        if (line === '\\ No newline at end of file') continue;
        if (line.startsWith(' ')) { old--; next--; }
        else if (line.startsWith('-')) { old--; changed = true; }
        else if (line.startsWith('+')) { next--; changed = true; }
        else return false;
        if (old < 0 || next < 0) return false;
      }
      if (lines[i] === '\\ No newline at end of file') i++;
    }
    if (!hunks || !changed) return false;
  }
  return seen.size === 2;
}
export function parseCambiumPatchInput(raw: unknown, trustedPolicy: unknown): CambiumPatchInput | null {
  const policy = parseCambiumPatchPolicy(trustedPolicy);
  if (!policy || !exact(raw, ['schema','taskId','workObjectId','directionId','directionRevision','directionDigest','workNodeId','approvedGraphVersion','baseCommit','patchBase64','patchDigest','policyId','policyDigest'])) return null;
  if (raw.schema !== 'thoughtseed.cambium.patch.verify_input.v1' || raw.workObjectId !== 'sapling:cambium'
      || !['taskId','directionId','workNodeId'].every(k => typeof raw[k] === 'string' && ID.test(raw[k] as string))
      || !['directionRevision','approvedGraphVersion'].every(k => Number.isSafeInteger(raw[k]) && (raw[k] as number) > 0)
      || typeof raw.directionDigest !== 'string' || !HASH.test(raw.directionDigest)
      || raw.baseCommit !== policy.baseCommit || raw.policyId !== policy.id || raw.policyDigest !== patchDigest(policy)
      || raw.patchDigest !== policy.patchDigest || typeof raw.patchBase64 !== 'string' || raw.patchBase64.length > 21848) return null;
  const bytes = Buffer.from(raw.patchBase64, 'base64');
  if (!bytes.length || bytes.length > 16384 || bytes.toString('base64') !== raw.patchBase64 || patchDigest(bytes) !== raw.patchDigest) return null;
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes) || !validCambiumPatchText(text)) return null;
  return raw as unknown as CambiumPatchInput;
}

export interface CambiumPatchResult {
  schema: 'thoughtseed.cambium.patch.result.v1'; taskId: string; directionId: string; directionRevision: number;
  executionId: string; inputDigest: string; policyDigest: string; baseCommit: string; patchDigest: string; image: string;
  baselineExitCode: number; candidateExitCode: number; diffBase64: string; baselineLog: string; candidateLog: string;
  status: 'result-ready' | 'failed'; acceptance: 'review-required'; externalActions: 'none';
}

export function parseCambiumPatchResult(raw: unknown, input: CambiumPatchInput, policy: CambiumPatchPolicy, executionId: string): CambiumPatchResult | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as CambiumPatchResult;
  const keys = ['schema','taskId','directionId','directionRevision','executionId','inputDigest','policyDigest','baseCommit','patchDigest','image','baselineExitCode','candidateExitCode','diffBase64','baselineLog','candidateLog','status','acceptance','externalActions'];
  if (Object.keys(r).length !== keys.length || !keys.every(k => Object.hasOwn(r,k)) || r.schema !== 'thoughtseed.cambium.patch.result.v1'
      || r.taskId !== input.taskId || r.directionId !== input.directionId || r.directionRevision !== input.directionRevision
      || r.executionId !== executionId || r.inputDigest !== patchDigest(input) || r.policyDigest !== patchDigest(policy)
      || r.baseCommit !== input.baseCommit || r.patchDigest !== input.patchDigest || r.image !== policy.image
      || r.acceptance !== 'review-required' || r.externalActions !== 'none'
      || !Number.isInteger(r.baselineExitCode) || r.baselineExitCode < 0 || r.baselineExitCode > 255
      || !Number.isInteger(r.candidateExitCode) || r.candidateExitCode < 0 || r.candidateExitCode > 255
      || typeof r.baselineLog !== 'string' || Buffer.byteLength(r.baselineLog) > 8192
      || typeof r.candidateLog !== 'string' || Buffer.byteLength(r.candidateLog) > 8192
      || typeof r.diffBase64 !== 'string' || r.diffBase64 !== input.patchBase64) return null;
  const ready = r.baselineExitCode !== 0 && r.candidateExitCode === 0;
  return r.status === (ready ? 'result-ready' : 'failed') ? r : null;
}

