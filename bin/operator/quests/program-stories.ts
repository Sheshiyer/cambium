export type CompanyProgramKind = 'company' | 'client' | 'capability' | 'operations';

export interface CompanyProgramPacketV1 {
  schema: 'company-program-packet.v1';
  programId: string;
  tenantId: string;
  title: string;
  programKind: CompanyProgramKind;
  lifecycle: 'proposed' | 'approved' | 'executing' | 'verifying' | 'complete' | 'retired';
  outcomeMetric: string;
  authority: { kind: 'goal-graph'; namespace: string; graphVersion: number };
  missionIds: readonly string[];
}

const packetKeys = [
  'schema',
  'programId',
  'tenantId',
  'title',
  'programKind',
  'lifecycle',
  'outcomeMetric',
  'authority',
  'missionIds',
] as const;
const authorityKeys = ['kind', 'namespace', 'graphVersion'] as const;
const programKinds = new Set<CompanyProgramKind>(['company', 'client', 'capability', 'operations']);
const lifecycles = new Set<CompanyProgramPacketV1['lifecycle']>([
  'proposed', 'approved', 'executing', 'verifying', 'complete', 'retired',
]);
const forbiddenName = /(?:secret|token|password|credential|initdata)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireExactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TypeError(`${label} contains unknown key: ${key}`);
  }
  for (const key of allowed) {
    if (!(key in value)) throw new TypeError(`${label} is missing required key: ${key}`);
  }
}

function requireString(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new TypeError(`${label} must be a non-empty string up to ${maximum} characters`);
  }
  if (forbiddenName.test(value)) throw new TypeError(`${label} must not contain secret-bearing content`);
  return value;
}

function requireIdentifier(value: unknown, label: string): string {
  const identifier = requireString(value, label, 128);
  if (!/^[a-z][a-z0-9-]*$/.test(identifier)) {
    throw new TypeError(`${label} must be a lowercase kebab-case identifier`);
  }
  return identifier;
}

function parseAuthority(value: unknown): CompanyProgramPacketV1['authority'] {
  if (!isRecord(value)) throw new TypeError('authority must be an object');
  requireExactKeys(value, authorityKeys, 'authority');
  if (value.kind !== 'goal-graph') throw new TypeError('authority.kind must be goal-graph');
  const graphVersion = value.graphVersion;
  if (!Number.isSafeInteger(graphVersion) || graphVersion <= 0) {
    throw new TypeError('authority.graphVersion must be a positive integer');
  }
  return {
    kind: 'goal-graph',
    namespace: requireString(value.namespace, 'authority.namespace', 256),
    graphVersion,
  };
}

function parseMissionIds(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 64) {
    throw new TypeError('missionIds must contain between 1 and 64 mission identifiers');
  }
  const missionIds = value.map((missionId, index) => requireIdentifier(missionId, `missionIds[${index}]`));
  for (let index = 1; index < missionIds.length; index += 1) {
    if (missionIds[index - 1] >= missionIds[index]) {
      throw new TypeError('missionIds must be sorted and unique');
    }
  }
  return Object.freeze(missionIds);
}

export function parseCompanyProgram(input: unknown): CompanyProgramPacketV1 {
  if (!isRecord(input)) throw new TypeError('company program packet must be an object');
  requireExactKeys(input, packetKeys, 'company program packet');
  if (input.schema !== 'company-program-packet.v1') {
    throw new TypeError('schema must be company-program-packet.v1');
  }
  if (!programKinds.has(input.programKind as CompanyProgramKind)) {
    throw new TypeError('programKind is invalid');
  }
  if (!lifecycles.has(input.lifecycle as CompanyProgramPacketV1['lifecycle'])) {
    throw new TypeError('lifecycle is invalid');
  }
  return Object.freeze({
    schema: 'company-program-packet.v1',
    programId: requireIdentifier(input.programId, 'programId'),
    tenantId: requireIdentifier(input.tenantId, 'tenantId'),
    title: requireString(input.title, 'title', 256),
    programKind: input.programKind as CompanyProgramKind,
    lifecycle: input.lifecycle as CompanyProgramPacketV1['lifecycle'],
    outcomeMetric: requireString(input.outcomeMetric, 'outcomeMetric', 512),
    authority: Object.freeze(parseAuthority(input.authority)),
    missionIds: parseMissionIds(input.missionIds),
  });
}

export const PROGRAM_FIXTURE: CompanyProgramPacketV1 = parseCompanyProgram({
  schema: 'company-program-packet.v1',
  programId: 'cambium-operating-fabric',
  tenantId: 'cambium-synthetic',
  title: 'Cambium Operating Fabric',
  programKind: 'operations',
  lifecycle: 'executing',
  outcomeMetric: 'Every approved mission has a bounded, evidence-linked execution path.',
  authority: { kind: 'goal-graph', namespace: 'cambium.synthetic.goal-graph', graphVersion: 1 },
  missionIds: ['mission-fabric-foundation', 'mission-fabric-proof'],
});
