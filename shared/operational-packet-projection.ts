export const OPERATIONAL_PACKET_PROJECTION_SCHEMA = 'cambium.operational-packet-projection.v1' as const;
export const OPERATIONAL_PACKET_PROJECTION_VERSION = 1 as const;

const WORK_OBJECT_ID = /^(sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPOSITORY_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REPOSITORY_ID = /^(?:R_[A-Za-z0-9_-]{6,}|MDEwOlJlcG9zaXRvcnk[0-9A-Za-z+/=]+)$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SURFACE_SCHEMA = /^[a-z0-9][a-z0-9.-]+\.v[1-9][0-9]*$/;

export type OperationalWorkObjectKind = 'sapling' | 'branch' | 'program';
export type OperationalRepositoryRole =
  | 'experience'
  | 'frontend'
  | 'backend'
  | 'docs'
  | 'infra';
export type OperationalAccessState = 'verified' | 'selected' | 'held' | 'missing' | 'unknown';
export type OperationalDependencyKind =
  | 'capability'
  | 'product'
  | 'client-delivery'
  | 'planning'
  | 'runtime'
  | 'proof';
export type OperationalServiceKind =
  | 'platform'
  | 'provider'
  | 'database'
  | 'storage'
  | 'payments'
  | 'commerce'
  | 'identity'
  | 'messaging'
  | 'observability'
  | 'memory';

export interface OperationalPacketIdentity {
  readonly workId: string;
  readonly kind: OperationalWorkObjectKind;
  readonly parentTenant: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly promotionState: string;
  readonly autonomyLabel: string;
}

export interface OperationalRepositoryComponent {
  readonly componentId: string;
  readonly nameWithOwner: string;
  readonly immutableRepositoryId?: string;
  readonly roles: readonly OperationalRepositoryRole[];
  readonly ownerWorkObjectId: string;
  readonly planningAuthority: boolean;
  readonly accessState: OperationalAccessState;
}

export interface OperationalWorkObjectDependency {
  readonly dependencyId: string;
  readonly workObjectId: string;
  readonly kind: OperationalDependencyKind;
  readonly required: boolean;
  readonly purpose: string;
}

export interface OperationalServiceDependency {
  readonly dependencyId: string;
  readonly kind: OperationalServiceKind;
  readonly name: string;
  readonly componentIds: readonly string[];
  readonly ownerWorkObjectId?: string;
  readonly accessState: OperationalAccessState;
  readonly purpose: string;
}

export interface OperationalLifecycleStageInput {
  readonly stage: string;
  readonly authority: string;
  readonly current: boolean;
  readonly surface: 'intake' | 'execution' | 'both';
}

export interface OperationalLifecycleStage {
  readonly stage: string;
  readonly authority: string;
  readonly current: boolean;
}

export interface OperationalMappingAuthority {
  readonly state: 'missing' | 'prepared-not-issued' | 'issued-readback-pending' | 'readback-verified';
  readonly bundleRef?: string;
  readonly preparedReceiptId?: string;
  readonly preparedR2Key?: string;
  readonly receiptIssued: boolean;
  readonly readbackVerified: boolean;
  readonly issueAuthority: string;
}

export interface OperationalAuthorityBoundary {
  readonly boundaryId: string;
  readonly domain: 'planning' | 'runtime' | 'proof' | 'dispatch' | 'spend' | 'external-mutation' | 'next-intent';
  readonly authority: string;
  readonly approvalRequired: boolean;
  readonly mutationAllowed: boolean;
}

export interface OperationalMission {
  readonly missionId: string;
  readonly title: string;
  readonly type: string;
  readonly owner: string;
  readonly gate: string;
  readonly proofRequired: string;
  readonly dispatchTarget: string;
  readonly proofIds?: readonly string[];
}

export interface OperationalKpi {
  readonly kpiId: string;
  readonly label: string;
  readonly survival: string;
  readonly betterThanSurvival: string;
  readonly currentState: string;
}

export interface OperationalGate {
  readonly gate: string;
  readonly status: string;
  readonly requiredProof: string;
}

export interface OperationalProof {
  readonly proofId: string;
  readonly sourcePath: string;
  readonly validates: string;
  readonly promotes: string;
}

export interface OperationalOrgan {
  readonly name: string;
  readonly owner: string;
  readonly state: string;
  readonly role: string;
}

export interface OperationalSupportRail {
  readonly name: string;
  readonly state: string;
  readonly role: string;
}

export interface OperationalPacketProjectionInput {
  readonly schema: string;
  readonly version: number;
  readonly identity: OperationalPacketIdentity;
  readonly authority: {
    readonly packet: string;
    readonly runtime: string;
    readonly proof: string;
    readonly nextIntent: string;
  };
  readonly authorityBoundaries: readonly OperationalAuthorityBoundary[];
  readonly runtimeJoin: {
    readonly evidenceStage: string;
    readonly evidencedLabel: string;
    readonly heldLabel: string;
  };
  readonly mappingAuthority: OperationalMappingAuthority;
  readonly lifecycleLadder: readonly OperationalLifecycleStageInput[];
  readonly repositoryComponents: readonly OperationalRepositoryComponent[];
  readonly workObjectDependencies: readonly OperationalWorkObjectDependency[];
  readonly infrastructureDependencies: readonly OperationalServiceDependency[];
  readonly story: {
    readonly arcTitle: string;
    readonly vision: string;
    readonly icp: string;
    readonly currentFrontier: string;
    readonly antiClaims: string;
  };
  readonly feedbackLoop: readonly string[];
  readonly loop: {
    readonly loopId: string;
    readonly title: string;
    readonly cadence: string;
    readonly objective: string;
    readonly metric: string;
    readonly boundaryColor: string;
    readonly oneChangeRule: string;
    readonly stopRule: string;
  };
  readonly organs: readonly OperationalOrgan[];
  readonly supportRails: readonly OperationalSupportRail[];
  readonly missions: readonly OperationalMission[];
  readonly kpis: readonly OperationalKpi[];
  readonly gates: readonly OperationalGate[];
  readonly proofs: readonly OperationalProof[];
  readonly sources: {
    readonly packet: string;
    readonly catalog: string;
    readonly runtime: string;
    readonly foldback: string;
  };
}

export interface OperationalPacketProjection extends Omit<OperationalPacketProjectionInput, 'lifecycleLadder'> {
  readonly projectionSchema: typeof OPERATIONAL_PACKET_PROJECTION_SCHEMA;
  readonly projectionVersion: typeof OPERATIONAL_PACKET_PROJECTION_VERSION;
  readonly lifecycleLadder: readonly OperationalLifecycleStage[];
  readonly intakeLadder: readonly OperationalLifecycleStage[];
  readonly executionLadder: readonly OperationalLifecycleStage[];
}

export class OperationalPacketProjectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OperationalPacketProjectionValidationError';
  }
}

function fail(message: string): never {
  throw new OperationalPacketProjectionValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string') fail(`${field} must be text`);
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > max) fail(`${field} is invalid`);
  return normalized;
}

function workObjectId(value: unknown, field: string): string {
  const normalized = text(value, field, 160);
  if (!WORK_OBJECT_ID.test(normalized)) fail(`${field} is not a canonical WorkObject ID`);
  return normalized;
}

function assertUnique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) fail(`${field} contains duplicates`);
}

function assertStringArray(value: unknown, field: string, allowEmpty = false): readonly string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) fail(`${field} must be a non-empty array`);
  const entries = value.map((entry, index) => text(entry, `${field}[${index}]`, 200));
  assertUnique(entries, field);
  return entries;
}

function assertEnum(value: unknown, allowed: readonly string[], field: string): void {
  if (!allowed.includes(String(value))) fail(`${field} is invalid`);
}

function assertRecordArray(value: unknown, field: string, allowEmpty = false): readonly Record<string, unknown>[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some((entry) => !isRecord(entry))) {
    fail(`${field} must be ${allowEmpty ? 'an' : 'a non-empty'} object array`);
  }
  return value as readonly Record<string, unknown>[];
}

function assertNamedRecords(
  value: unknown,
  field: string,
  key: string,
  allowEmpty = false,
): readonly Record<string, unknown>[] {
  const records = assertRecordArray(value, field, allowEmpty);
  const ids = records.map((record, index) => text(record[key], `${field}[${index}].${key}`, 160));
  assertUnique(ids, `${field}.${key}`);
  return records;
}

export function validateOperationalPacketProjectionInput(raw: unknown): asserts raw is OperationalPacketProjectionInput {
  if (!isRecord(raw)) fail('operational packet projection input must be an object');
  if (!SURFACE_SCHEMA.test(text(raw.schema, 'schema', 160)) || raw.version !== 1) {
    fail('surface schema or version is invalid');
  }

  if (!isRecord(raw.identity)) fail('identity must be an object');
  const identityWorkId = workObjectId(raw.identity.workId, 'identity.workId');
  const identityKind = text(raw.identity.kind, 'identity.kind', 20);
  assertEnum(identityKind, ['sapling', 'branch', 'program'], 'identity.kind');
  if (!identityWorkId.startsWith(`${identityKind}:`)) fail('identity kind does not match its WorkObject ID');
  text(raw.identity.parentTenant, 'identity.parentTenant', 80);
  text(raw.identity.name, 'identity.name', 120);
  assertStringArray(raw.identity.aliases, 'identity.aliases', true);
  text(raw.identity.promotionState, 'identity.promotionState', 80);
  text(raw.identity.autonomyLabel, 'identity.autonomyLabel', 160);

  if (!isRecord(raw.authority)) fail('authority must be an object');
  for (const field of ['packet', 'runtime', 'proof', 'nextIntent'] as const) text(raw.authority[field], `authority.${field}`);

  const boundaries = assertNamedRecords(raw.authorityBoundaries, 'authorityBoundaries', 'boundaryId');
  for (const [index, boundary] of boundaries.entries()) {
    const prefix = `authorityBoundaries[${index}]`;
    assertEnum(boundary.domain, ['planning', 'runtime', 'proof', 'dispatch', 'spend', 'external-mutation', 'next-intent'], `${prefix}.domain`);
    text(boundary.authority, `${prefix}.authority`);
    if (typeof boundary.approvalRequired !== 'boolean' || typeof boundary.mutationAllowed !== 'boolean') {
      fail(`${prefix} approval and mutation flags must be boolean`);
    }
  }

  const dependencies = assertNamedRecords(raw.workObjectDependencies, 'workObjectDependencies', 'dependencyId', true);
  const dependencyWorkObjectIds = dependencies.map((dependency, index) => {
    const prefix = `workObjectDependencies[${index}]`;
    const dependencyWorkId = workObjectId(dependency.workObjectId, `${prefix}.workObjectId`);
    if (dependencyWorkId === identityWorkId) fail(`${prefix} cannot depend on itself`);
    assertEnum(dependency.kind, ['capability', 'product', 'client-delivery', 'planning', 'runtime', 'proof'], `${prefix}.kind`);
    if (typeof dependency.required !== 'boolean') fail(`${prefix}.required must be boolean`);
    text(dependency.purpose, `${prefix}.purpose`);
    return dependencyWorkId;
  });
  assertUnique(dependencyWorkObjectIds, 'workObjectDependencies.workObjectId');
  const allowedOwners = new Set([identityWorkId, ...dependencyWorkObjectIds]);

  const components = assertNamedRecords(raw.repositoryComponents, 'repositoryComponents', 'componentId');
  const componentIds = new Set<string>();
  const repositoryNames: string[] = [];
  let planningAuthorities = 0;
  for (const [index, component] of components.entries()) {
    const prefix = `repositoryComponents[${index}]`;
    const componentId = text(component.componentId, `${prefix}.componentId`, 128);
    if (!SAFE_ID.test(componentId)) fail(`${prefix}.componentId is invalid`);
    componentIds.add(componentId);
    const nameWithOwner = text(component.nameWithOwner, `${prefix}.nameWithOwner`, 200);
    if (!REPOSITORY_NAME.test(nameWithOwner)) fail(`${prefix}.nameWithOwner is invalid`);
    repositoryNames.push(nameWithOwner.toLowerCase());
    if (component.immutableRepositoryId !== undefined) {
      const immutableId = text(component.immutableRepositoryId, `${prefix}.immutableRepositoryId`, 160);
      if (!REPOSITORY_ID.test(immutableId)) fail(`${prefix}.immutableRepositoryId is invalid`);
    }
    const roles = assertStringArray(component.roles, `${prefix}.roles`);
    for (const role of roles) assertEnum(role, ['experience', 'frontend', 'backend', 'docs', 'infra'], `${prefix}.roles`);
    const owner = workObjectId(component.ownerWorkObjectId, `${prefix}.ownerWorkObjectId`);
    if (!allowedOwners.has(owner)) fail(`${prefix}.ownerWorkObjectId is not the subject or a declared dependency`);
    if (typeof component.planningAuthority !== 'boolean') fail(`${prefix}.planningAuthority must be boolean`);
    if (component.planningAuthority) {
      planningAuthorities += 1;
      if (owner !== identityWorkId) fail(`${prefix} cannot delegate the subject's planning authority`);
    }
    assertEnum(component.accessState, ['verified', 'selected', 'held', 'missing', 'unknown'], `${prefix}.accessState`);
  }
  assertUnique(repositoryNames, 'repositoryComponents.nameWithOwner');
  if (planningAuthorities !== 1) fail('repositoryComponents must declare exactly one subject-owned planning authority');

  const infrastructure = assertNamedRecords(raw.infrastructureDependencies, 'infrastructureDependencies', 'dependencyId', true);
  for (const [index, dependency] of infrastructure.entries()) {
    const prefix = `infrastructureDependencies[${index}]`;
    assertEnum(dependency.kind, ['platform', 'provider', 'database', 'storage', 'payments', 'commerce', 'identity', 'messaging', 'observability', 'memory'], `${prefix}.kind`);
    text(dependency.name, `${prefix}.name`, 120);
    text(dependency.purpose, `${prefix}.purpose`);
    assertEnum(dependency.accessState, ['verified', 'selected', 'held', 'missing', 'unknown'], `${prefix}.accessState`);
    const refs = assertStringArray(dependency.componentIds, `${prefix}.componentIds`, true);
    for (const componentId of refs) if (!componentIds.has(componentId)) fail(`${prefix} references unknown component ${componentId}`);
    if (dependency.ownerWorkObjectId !== undefined) {
      const owner = workObjectId(dependency.ownerWorkObjectId, `${prefix}.ownerWorkObjectId`);
      if (!allowedOwners.has(owner)) fail(`${prefix}.ownerWorkObjectId is not declared`);
    }
  }

  const lifecycle = assertNamedRecords(raw.lifecycleLadder, 'lifecycleLadder', 'stage');
  const stages = new Map<string, Record<string, unknown>>();
  for (const [index, stage] of lifecycle.entries()) {
    const prefix = `lifecycleLadder[${index}]`;
    const stageId = text(stage.stage, `${prefix}.stage`, 80);
    text(stage.authority, `${prefix}.authority`);
    if (typeof stage.current !== 'boolean') fail(`${prefix}.current must be boolean`);
    assertEnum(stage.surface, ['intake', 'execution', 'both'], `${prefix}.surface`);
    stages.set(stageId, stage);
  }
  for (const requiredStage of ['identified', 'systems-bound', 'mapping-receipt-verified', 'planned', 'd1-eligible']) {
    if (!stages.has(requiredStage)) fail(`lifecycleLadder is missing ${requiredStage}`);
  }
  if (stages.get('mapping-receipt-verified')?.current !== true && stages.get('d1-eligible')?.current === true) {
    fail('D1 eligibility requires mapping-receipt readback verification');
  }
  if (!isRecord(raw.runtimeJoin)) fail('runtimeJoin must be an object');
  const evidenceStage = text(raw.runtimeJoin.evidenceStage, 'runtimeJoin.evidenceStage', 80);
  if (!stages.has(evidenceStage)) fail('runtimeJoin.evidenceStage is absent from lifecycleLadder');
  text(raw.runtimeJoin.evidencedLabel, 'runtimeJoin.evidencedLabel');
  text(raw.runtimeJoin.heldLabel, 'runtimeJoin.heldLabel');

  if (!isRecord(raw.mappingAuthority)) fail('mappingAuthority must be an object');
  assertEnum(raw.mappingAuthority.state, ['missing', 'prepared-not-issued', 'issued-readback-pending', 'readback-verified'], 'mappingAuthority.state');
  if (typeof raw.mappingAuthority.receiptIssued !== 'boolean' || typeof raw.mappingAuthority.readbackVerified !== 'boolean') {
    fail('mappingAuthority issue and readback flags must be boolean');
  }
  text(raw.mappingAuthority.issueAuthority, 'mappingAuthority.issueAuthority');
  if (raw.mappingAuthority.bundleRef !== undefined) text(raw.mappingAuthority.bundleRef, 'mappingAuthority.bundleRef');
  if (raw.mappingAuthority.preparedReceiptId !== undefined) {
    const receiptId = text(raw.mappingAuthority.preparedReceiptId, 'mappingAuthority.preparedReceiptId', 80);
    if (!/^pmr_[0-9a-f]{24}$/.test(receiptId)) fail('mappingAuthority.preparedReceiptId is invalid');
  }
  if (raw.mappingAuthority.preparedR2Key !== undefined) {
    const r2Key = text(raw.mappingAuthority.preparedR2Key, 'mappingAuthority.preparedR2Key', 300);
    if (!r2Key.startsWith(`portfolio/thoughtseed/workobjects/${identityWorkId}/mapping/`)) {
      fail('mappingAuthority.preparedR2Key is not scoped to the subject WorkObject');
    }
  }
  const mappingStageCurrent = stages.get('mapping-receipt-verified')?.current === true;
  if (raw.mappingAuthority.readbackVerified !== mappingStageCurrent) {
    fail('mappingAuthority readback flag must match the mapping-receipt-verified lifecycle stage');
  }
  if (raw.mappingAuthority.readbackVerified && !raw.mappingAuthority.receiptIssued) {
    fail('mappingAuthority readback cannot be verified before issuance');
  }
  if (raw.mappingAuthority.state === 'prepared-not-issued') {
    if (raw.mappingAuthority.receiptIssued || raw.mappingAuthority.readbackVerified
      || raw.mappingAuthority.preparedReceiptId === undefined || raw.mappingAuthority.preparedR2Key === undefined) {
      fail('prepared mapping authority must identify an unissued receipt candidate');
    }
  }
  if (raw.mappingAuthority.state === 'readback-verified'
    && (!raw.mappingAuthority.receiptIssued || !raw.mappingAuthority.readbackVerified)) {
    fail('verified mapping authority requires issued readback proof');
  }

  const gates = assertNamedRecords(raw.gates, 'gates', 'gate');
  const gateNames = new Set(gates.map((gate) => text(gate.gate, 'gates.gate', 120)));
  for (const [index, gate] of gates.entries()) {
    text(gate.status, `gates[${index}].status`, 120);
    text(gate.requiredProof, `gates[${index}].requiredProof`);
  }
  const proofs = assertNamedRecords(raw.proofs, 'proofs', 'proofId');
  const proofIds = new Set(proofs.map((proof) => text(proof.proofId, 'proofs.proofId', 128)));
  for (const [index, proof] of proofs.entries()) {
    text(proof.sourcePath, `proofs[${index}].sourcePath`);
    text(proof.validates, `proofs[${index}].validates`);
    text(proof.promotes, `proofs[${index}].promotes`);
  }
  const missions = assertNamedRecords(raw.missions, 'missions', 'missionId');
  for (const [index, mission] of missions.entries()) {
    const prefix = `missions[${index}]`;
    for (const field of ['title', 'type', 'owner', 'proofRequired', 'dispatchTarget'] as const) text(mission[field], `${prefix}.${field}`);
    const gate = text(mission.gate, `${prefix}.gate`, 120);
    if (!gateNames.has(gate)) fail(`${prefix}.gate does not reference a declared gate`);
    if (mission.proofIds !== undefined) {
      for (const proofId of assertStringArray(mission.proofIds, `${prefix}.proofIds`)) {
        if (!proofIds.has(proofId)) fail(`${prefix}.proofIds references unknown proof ${proofId}`);
      }
    }
  }

  const kpis = assertNamedRecords(raw.kpis, 'kpis', 'kpiId');
  for (const [index, kpi] of kpis.entries()) {
    for (const field of ['label', 'survival', 'betterThanSurvival', 'currentState'] as const) text(kpi[field], `kpis[${index}].${field}`);
  }
  const organs = assertNamedRecords(raw.organs, 'organs', 'name');
  for (const [index, organ] of organs.entries()) {
    for (const field of ['owner', 'state', 'role'] as const) text(organ[field], `organs[${index}].${field}`);
  }
  const rails = assertNamedRecords(raw.supportRails, 'supportRails', 'name', true);
  for (const [index, rail] of rails.entries()) {
    for (const field of ['state', 'role'] as const) text(rail[field], `supportRails[${index}].${field}`);
  }

  if (!isRecord(raw.story)) fail('story must be an object');
  for (const field of ['arcTitle', 'vision', 'icp', 'currentFrontier', 'antiClaims'] as const) text(raw.story[field], `story.${field}`, 1000);
  assertStringArray(raw.feedbackLoop, 'feedbackLoop');
  if (!isRecord(raw.loop)) fail('loop must be an object');
  for (const field of ['loopId', 'title', 'cadence', 'objective', 'metric', 'boundaryColor', 'oneChangeRule', 'stopRule'] as const) {
    text(raw.loop[field], `loop.${field}`, 1000);
  }
  if (!isRecord(raw.sources)) fail('sources must be an object');
  for (const field of ['packet', 'catalog', 'runtime', 'foldback'] as const) text(raw.sources[field], `sources.${field}`);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function compileOperationalPacketProjection<T extends OperationalPacketProjectionInput>(
  input: T,
): OperationalPacketProjection & { readonly schema: T['schema'] } {
  validateOperationalPacketProjectionInput(input);
  const clone = structuredClone(input) as OperationalPacketProjectionInput;
  const stages = clone.lifecycleLadder.map(({ surface: _surface, ...stage }) => stage);
  const projection: OperationalPacketProjection = {
    ...clone,
    projectionSchema: OPERATIONAL_PACKET_PROJECTION_SCHEMA,
    projectionVersion: OPERATIONAL_PACKET_PROJECTION_VERSION,
    lifecycleLadder: stages,
    intakeLadder: clone.lifecycleLadder
      .filter((stage) => stage.surface === 'intake' || stage.surface === 'both')
      .map(({ surface: _surface, ...stage }) => stage),
    executionLadder: clone.lifecycleLadder
      .filter((stage) => stage.surface === 'execution' || stage.surface === 'both')
      .map(({ surface: _surface, ...stage }) => stage),
  };
  return deepFreeze(projection) as OperationalPacketProjection & { readonly schema: T['schema'] };
}
