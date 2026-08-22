import type { GoalGraphLoadoutAuthority, GoalGraphLoadoutAuthorityRecord } from './goal-graph/types.ts';
import { sha256 } from './goal-graph/identity.ts';

const TENANT_ID = 'cambium' as const;

const ACTIVATION_MANIFEST_SCHEMA = 'cambium.governed-activation-manifest.v1' as const;
const ACTIVATION_RECORD_SCHEMA = 'cambium.governed-activation-record.v1' as const;
const PREPARED_MAPPING_RECEIPT_AUTHORITY_SCHEMA = 'cambium.governed-mapping-receipt-authority.v1' as const;
const HELD_ACTIVATION_AUTHORITY_SCHEMA = 'cambium.governed-held-activation-authority.v1' as const;
const ISSUED_MAPPING_RECEIPT_AUTHORITY_SCHEMA = 'cambium.governed-issued-mapping-receipt-authority.v1' as const;
const ADMITTED_ACTIVATION_AUTHORITY_SCHEMA = 'cambium.governed-admitted-activation-authority.v1' as const;
const LOADOUT_REGISTRY_SCHEMA = 'cambium.governed-loadout-registry.v1' as const;
const LOADOUT_RECORD_SCHEMA = 'cambium.governed-loadout-record.v1' as const;
const DISPATCH_INPUT_SCHEMA = 'cambium.governed-dispatch-preparation-input.v1' as const;
const DISPATCH_SCHEMA = 'cambium.governed-dispatch-preparation.v1' as const;
const APPROVAL_REFERENCE_SCHEMA = 'cambium.governed-dispatch-approval-reference.v1' as const;
const APPROVAL_SUBJECT_SCHEMA = 'cambium.governed-dispatch-approval-subject.v1' as const;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,159}$/;
const REPOSITORY_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REPOSITORY_ID = /^R_[A-Za-z0-9_-]{6,}$/;
const SHA256_REF = /^sha256:[0-9a-f]{64}$/;
const WORK_OBJECT_ID = /^sapling:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOADOUT_ID = /^loadout:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TASK_ID = /^task:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CLUSTER_ID = /^cluster:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMMAND_ID = /^command:[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type GovernedWorkObjectId = 'sapling:fitcheck' | 'sapling:iverif' | 'sapling:dlock';
export type GovernedLoadoutId = 'loadout:fitcheck-launch' | 'loadout:iverif-observer' | 'loadout:dlock-inventory';
export type GovernedTaskId = 'task:fitcheck-launch' | 'task:iverif-observer' | 'task:dlock-inventory';
export type GovernedClusterId = 'cluster:fitcheck-launch' | 'cluster:iverif-observer' | 'cluster:dlock-inventory';
export type GovernedCommandId = 'command:fitcheck-launch-packet' | 'command:iverif-observe-packet' | 'command:dlock-inventory-packet';

interface GovernedRepositoryIdentity {
  readonly nameWithOwner: string;
  readonly repositoryId: string;
  readonly role: 'product-source' | 'folderless-planning-authority';
}

interface GovernedPacketAuthority {
  readonly sourceRef: string;
  readonly sourceDigest: string;
}

interface GovernedRootContext {
  readonly folder: string | null;
  readonly additionalFolders: readonly [];
  readonly proposedKind: 'sapling' | null;
  readonly accountId: null;
  readonly workIds: readonly GovernedWorkObjectId[];
  readonly status: 'mapping-proposal' | 'no-shallow-folder';
}

export interface PreparedMappingReceiptAuthority {
  readonly schema: typeof PREPARED_MAPPING_RECEIPT_AUTHORITY_SCHEMA;
  readonly preparedAuthorityRef: string;
  readonly preparedAuthorityDigest: string;
  readonly state: 'prepared-not-issued';
  readonly issued: false;
}

export interface HeldActivationAuthority {
  readonly schema: typeof HELD_ACTIVATION_AUTHORITY_SCHEMA;
  readonly preparedAuthorityRef: string;
  readonly preparedAuthorityDigest: string;
  readonly state: 'prepared-not-issued';
  readonly issued: false;
  readonly admitted: false;
}

export interface IssuedMappingReceiptAuthority {
  readonly schema: typeof ISSUED_MAPPING_RECEIPT_AUTHORITY_SCHEMA;
  readonly tenantId: typeof TENANT_ID;
  readonly workObjectId: GovernedWorkObjectId;
  readonly repository: GovernedRepositoryIdentity;
  readonly preparedAuthorityRef: string;
  readonly preparedAuthorityDigest: string;
  readonly issuedAuthorityRef: string;
  readonly issuedAuthorityDigest: string;
  readonly state: 'issued';
  readonly issued: true;
}

export interface AdmittedActivationAuthority {
  readonly schema: typeof ADMITTED_ACTIVATION_AUTHORITY_SCHEMA;
  readonly tenantId: typeof TENANT_ID;
  readonly workObjectId: GovernedWorkObjectId;
  readonly activationDigest: string;
  readonly activationRecordDigest: string;
  readonly preparedAuthorityRef: string;
  readonly preparedAuthorityDigest: string;
  readonly issuedMappingReceiptAuthorityRef: string;
  readonly issuedMappingReceiptAuthorityDigest: string;
  readonly admittedAuthorityRef: string;
  readonly admittedAuthorityDigest: string;
  readonly state: 'admitted';
  readonly issued: true;
  readonly admitted: true;
}

export interface GovernedActivationRecord {
  readonly schema: typeof ACTIVATION_RECORD_SCHEMA;
  readonly recordId: string;
  readonly tenantId: typeof TENANT_ID;
  readonly workObjectId: GovernedWorkObjectId;
  readonly workObjectKind: 'sapling';
  readonly repository: GovernedRepositoryIdentity;
  readonly packet: GovernedPacketAuthority;
  readonly rootContext: GovernedRootContext;
  readonly mappingReceiptAuthority: PreparedMappingReceiptAuthority;
  readonly activationAuthority: HeldActivationAuthority;
  readonly recordDigest: string;
  readonly activationDigest: string;
}

export interface GovernedActivationManifest {
  readonly schema: typeof ACTIVATION_MANIFEST_SCHEMA;
  readonly version: 1;
  readonly tenantId: typeof TENANT_ID;
  readonly records: readonly GovernedActivationRecord[];
  readonly manifestDigest: string;
}

export interface GovernedLoadoutRecord extends GoalGraphLoadoutAuthorityRecord {
  readonly schema: typeof LOADOUT_RECORD_SCHEMA;
  readonly tenantId: typeof TENANT_ID;
  readonly workObjectId: GovernedWorkObjectId;
  readonly taskId: GovernedTaskId;
  readonly loadoutId: GovernedLoadoutId;
  readonly eligibleWorkObjectIds: readonly [GovernedWorkObjectId];
  readonly authorizedClusterIds: readonly [GovernedClusterId];
  readonly commandAllowlist: readonly [GovernedCommandId];
  readonly spendClass: 'none';
  readonly deliveryEnabled: false;
  readonly externalMutationAllowed: false;
  readonly sourceRef: string;
  readonly sourceDigest: string;
  readonly authorityDigest: string;
}

export interface GovernedLoadoutRegistry {
  readonly schema: typeof LOADOUT_REGISTRY_SCHEMA;
  readonly version: 1;
  readonly tenantId: typeof TENANT_ID;
  readonly records: readonly GovernedLoadoutRecord[];
  readonly registryDigest: string;
}

export interface SignedApprovalReference {
  readonly schema: typeof APPROVAL_REFERENCE_SCHEMA;
  readonly approvalRef: string;
  readonly approvalSubjectDigest: string;
  readonly status: 'signed-unconsumed';
  readonly consumed: false;
}

export interface GovernedDispatchPreparationInput {
  readonly schema: typeof DISPATCH_INPUT_SCHEMA;
  readonly tenantId: typeof TENANT_ID;
  readonly workObjectId: GovernedWorkObjectId;
  readonly taskId: GovernedTaskId;
  readonly graphVersion: number;
  readonly loadoutId: GovernedLoadoutId;
  readonly clusterIds: readonly [GovernedClusterId];
  readonly command: GovernedCommandId;
  readonly repository: GovernedRepositoryIdentity;
  readonly issuedMappingReceiptAuthority: IssuedMappingReceiptAuthority;
  readonly admittedActivationAuthority: AdmittedActivationAuthority;
  readonly approval: SignedApprovalReference;
}

export interface GovernedDispatchPreparation {
  readonly schema: typeof DISPATCH_SCHEMA;
  readonly version: 1;
  readonly tenantId: typeof TENANT_ID;
  readonly workObjectId: GovernedWorkObjectId;
  readonly taskId: GovernedTaskId;
  readonly graphVersion: number;
  readonly activationManifestDigest: string;
  readonly activationRecordDigest: string;
  readonly activationDigest: string;
  readonly repository: GovernedRepositoryIdentity;
  readonly loadoutId: GovernedLoadoutId;
  readonly loadoutDigest: string;
  readonly clusters: readonly [GovernedClusterId];
  readonly command: GovernedCommandId;
  readonly mappingReceiptAuthority: {
    readonly preparedAuthorityRef: string;
    readonly preparedAuthorityDigest: string;
    readonly issuedAuthorityRef: string;
    readonly issuedAuthorityDigest: string;
  };
  readonly admittedActivationAuthority: AdmittedActivationAuthority;
  readonly approval: SignedApprovalReference;
  readonly approvalSubjectDigest: string;
  readonly dispatchAuthorityDigest: string;
  readonly spendClass: 'none';
  readonly deliveryEnabled: false;
  readonly externalMutationAllowed: false;
}

/**
 * Supplied by the trusted orchestration boundary after immutable R2 and D1
 * readback. Local hash self-consistency is necessary but never admission.
 */
export interface GovernedDispatchAuthorityVerifier {
  readonly source: 'external-authority-readback';
  verifyIssuedMappingReceiptAuthority(authority: IssuedMappingReceiptAuthority): boolean;
  verifyAdmittedActivationAuthority(authority: AdmittedActivationAuthority): boolean;
}

type ActivationSourceDefinition = {
  readonly workObjectId: GovernedWorkObjectId;
  readonly repository: GovernedRepositoryIdentity;
  readonly packet: GovernedPacketAuthority;
  readonly rootContext: GovernedRootContext;
};

type LoadoutSourceDefinition = {
  readonly workObjectId: GovernedWorkObjectId;
  readonly loadoutId: GovernedLoadoutId;
  readonly taskId: GovernedTaskId;
  readonly clusterIds: readonly [GovernedClusterId];
  readonly commandAllowlist: readonly [GovernedCommandId];
};

export class GovernedPortfolioOperationalCohortValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GovernedPortfolioOperationalCohortValidationError';
  }
}

const ACTIVATION_SOURCE_DEFINITIONS: readonly ActivationSourceDefinition[] = deepFreeze([
  {
    workObjectId: 'sapling:fitcheck',
    repository: {
      nameWithOwner: 'Sheshiyer/fitcheck-landing',
      repositoryId: 'R_kgDOSzF56w',
      role: 'product-source',
    },
    packet: {
      sourceRef: 'cambium:docs/plans/product-branches/fitcheck.md',
      sourceDigest: 'sha256:04d246adfc558538601929ae3082304572e1a9a115dcfa712e7f57e5d5a311d2',
    },
    rootContext: {
      folder: 'fitcheck-landing',
      additionalFolders: [],
      proposedKind: 'sapling',
      accountId: null,
      workIds: ['sapling:fitcheck'],
      status: 'mapping-proposal',
    },
  },
  {
    workObjectId: 'sapling:iverif',
    repository: {
      nameWithOwner: 'Sheshiyer/iverif-wiki',
      repositoryId: 'R_kgDOSwXJ7Q',
      role: 'product-source',
    },
    packet: {
      sourceRef: 'cambium:docs/plans/product-branches/iverif.md',
      sourceDigest: 'sha256:dcb71ac5cbb6563d296930f29145e2b1cf647114213bce9c8bb2ffb4265c07c1',
    },
    rootContext: {
      folder: 'iverif',
      additionalFolders: [],
      proposedKind: 'sapling',
      accountId: null,
      workIds: ['sapling:iverif'],
      status: 'mapping-proposal',
    },
  },
  {
    workObjectId: 'sapling:dlock',
    repository: {
      nameWithOwner: 'thoughtseed-labs/lockwell-portal',
      repositoryId: 'R_kgDOP5AZyQ',
      role: 'folderless-planning-authority',
    },
    packet: {
      sourceRef: 'cambium:docs/plans/product-branches/dlock.md',
      sourceDigest: 'sha256:13a3d07255f938f7680a24f8a82e090003009c3dd3f6b4edba25b0716948ea09',
    },
    rootContext: {
      folder: null,
      additionalFolders: [],
      proposedKind: null,
      accountId: null,
      workIds: [],
      status: 'no-shallow-folder',
    },
  },
] as const);

const LOADOUT_SOURCE_DEFINITIONS: readonly LoadoutSourceDefinition[] = deepFreeze([
  {
    workObjectId: 'sapling:fitcheck',
    loadoutId: 'loadout:fitcheck-launch',
    taskId: 'task:fitcheck-launch',
    clusterIds: ['cluster:fitcheck-launch'],
    commandAllowlist: ['command:fitcheck-launch-packet'],
  },
  {
    workObjectId: 'sapling:iverif',
    loadoutId: 'loadout:iverif-observer',
    taskId: 'task:iverif-observer',
    clusterIds: ['cluster:iverif-observer'],
    commandAllowlist: ['command:iverif-observe-packet'],
  },
  {
    workObjectId: 'sapling:dlock',
    loadoutId: 'loadout:dlock-inventory',
    taskId: 'task:dlock-inventory',
    clusterIds: ['cluster:dlock-inventory'],
    commandAllowlist: ['command:dlock-inventory-packet'],
  },
] as const);

const ACTIVATION_SOURCE_BY_WORK_OBJECT = new Map(
  ACTIVATION_SOURCE_DEFINITIONS.map((definition) => [definition.workObjectId, definition] as const),
);
const LOADOUT_SOURCE_BY_WORK_OBJECT = new Map(
  LOADOUT_SOURCE_DEFINITIONS.map((definition) => [definition.workObjectId, definition] as const),
);
const LOADOUT_SOURCE_BY_ID = new Map(
  LOADOUT_SOURCE_DEFINITIONS.map((definition) => [definition.loadoutId, definition] as const),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const entry of value) deepFreeze(entry);
    return Object.freeze(value) as T;
  }
  for (const entry of Object.values(value as Record<string, unknown>)) deepFreeze(entry);
  return Object.freeze(value) as T;
}

function exactFields(record: Record<string, unknown>, fields: readonly string[], label: string): void {
  const actual = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${label} fields are invalid`);
  }
}

function safeId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} is invalid`);
  }
  return value;
}

function safeRepositoryName(value: unknown, field: string): string {
  if (typeof value !== 'string' || !REPOSITORY_NAME.test(value)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} is invalid`);
  }
  return value;
}

function safeRepositoryId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !REPOSITORY_ID.test(value)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} is invalid`);
  }
  return value;
}

function safeDigestRef(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SHA256_REF.test(value)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} is invalid`);
  }
  return value;
}

function safeWorkObjectId(value: unknown, field: string): GovernedWorkObjectId {
  if (typeof value !== 'string' || !WORK_OBJECT_ID.test(value)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} is invalid`);
  }
  if (!ACTIVATION_SOURCE_BY_WORK_OBJECT.has(value as GovernedWorkObjectId)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} is not in the governed cohort`);
  }
  return value as GovernedWorkObjectId;
}

function safeLoadoutId(value: unknown, field: string): GovernedLoadoutId {
  if (typeof value !== 'string' || !LOADOUT_ID.test(value)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} is invalid`);
  }
  if (!LOADOUT_SOURCE_BY_ID.has(value as GovernedLoadoutId)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} is not in the governed cohort`);
  }
  return value as GovernedLoadoutId;
}

function safeTaskId(value: unknown, field: string): GovernedTaskId {
  if (typeof value !== 'string' || !TASK_ID.test(value)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} is invalid`);
  }
  return value as GovernedTaskId;
}

function safeClusterId(value: unknown, field: string): GovernedClusterId {
  if (typeof value !== 'string' || !CLUSTER_ID.test(value)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} is invalid`);
  }
  return value as GovernedClusterId;
}

function safeCommandId(value: unknown, field: string): GovernedCommandId {
  if (typeof value !== 'string' || !COMMAND_ID.test(value)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} is invalid`);
  }
  return value as GovernedCommandId;
}

function normalizeSingleItemArray<T extends string>(
  value: unknown,
  field: string,
  guard: (entry: unknown, innerField: string) => T,
): readonly [T] {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} must contain exactly one item`);
  }
  return [guard(value[0], `${field}[0]`)];
}

function compareStringArrays(actual: readonly string[], expected: readonly string[], field: string): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} does not match the governed authority`);
  }
}

function sha256Ref(value: unknown): string {
  return `sha256:${sha256(value)}`;
}

function buildPreparedMappingReceiptAuthority(source: ActivationSourceDefinition): PreparedMappingReceiptAuthority {
  const preparedAuthorityRef = `mapping-receipt:${TENANT_ID}:${source.workObjectId}:${source.repository.repositoryId}`;
  return deepFreeze({
    schema: PREPARED_MAPPING_RECEIPT_AUTHORITY_SCHEMA,
    preparedAuthorityRef,
    preparedAuthorityDigest: sha256Ref({
      schema: 'cambium.governed-mapping-receipt-prepared-digest.v1',
      tenantId: TENANT_ID,
      workObjectId: source.workObjectId,
      repository: source.repository,
      packet: source.packet,
      rootContext: source.rootContext,
    }),
    state: 'prepared-not-issued' as const,
    issued: false as const,
  });
}

function buildHeldActivationAuthority(
  source: ActivationSourceDefinition,
  mappingReceiptAuthority: PreparedMappingReceiptAuthority,
): HeldActivationAuthority {
  const preparedAuthorityRef = `activation:${TENANT_ID}:${source.workObjectId}:${source.repository.repositoryId}`;
  return deepFreeze({
    schema: HELD_ACTIVATION_AUTHORITY_SCHEMA,
    preparedAuthorityRef,
    preparedAuthorityDigest: sha256Ref({
      schema: 'cambium.governed-held-activation-prepared-digest.v1',
      tenantId: TENANT_ID,
      workObjectId: source.workObjectId,
      repository: source.repository,
      packet: source.packet,
      rootContext: source.rootContext,
      mappingReceiptAuthority,
      issued: false,
      admitted: false,
    }),
    state: 'prepared-not-issued' as const,
    issued: false as const,
    admitted: false as const,
  });
}

export function deriveActivationRecordDigest(record: Omit<GovernedActivationRecord, 'recordDigest' | 'activationDigest'>): string {
  return sha256Ref({
    schema: 'cambium.governed-activation-record-digest.v1',
    record,
  });
}

function deriveActivationDigest(record: Omit<GovernedActivationRecord, 'activationDigest'>): string {
  return sha256Ref({
    schema: 'cambium.governed-activation-held-digest.v1',
    tenantId: record.tenantId,
    workObjectId: record.workObjectId,
    recordDigest: record.recordDigest,
    mappingReceiptAuthority: record.mappingReceiptAuthority,
    activationAuthority: record.activationAuthority,
    admitted: false,
    issued: false,
  });
}

function buildActivationRecord(source: ActivationSourceDefinition): GovernedActivationRecord {
  const mappingReceiptAuthority = buildPreparedMappingReceiptAuthority(source);
  const activationAuthority = buildHeldActivationAuthority(source, mappingReceiptAuthority);
  const baseRecord = {
    schema: ACTIVATION_RECORD_SCHEMA,
    recordId: `activation-record:${source.workObjectId}`,
    tenantId: TENANT_ID,
    workObjectId: source.workObjectId,
    workObjectKind: 'sapling' as const,
    repository: source.repository,
    packet: source.packet,
    rootContext: source.rootContext,
    mappingReceiptAuthority,
    activationAuthority,
  };
  const recordDigest = deriveActivationRecordDigest(baseRecord);
  return deepFreeze({
    ...baseRecord,
    recordDigest,
    activationDigest: deriveActivationDigest({ ...baseRecord, recordDigest }),
  });
}

function buildActivationManifest(records: readonly GovernedActivationRecord[]): GovernedActivationManifest {
  return deepFreeze({
    schema: ACTIVATION_MANIFEST_SCHEMA,
    version: 1 as const,
    tenantId: TENANT_ID,
    records,
    manifestDigest: sha256Ref({
      schema: 'cambium.governed-activation-manifest-digest.v1',
      tenantId: TENANT_ID,
      version: 1,
      records: records.map((record) => ({
        recordId: record.recordId,
        workObjectId: record.workObjectId,
        recordDigest: record.recordDigest,
        activationDigest: record.activationDigest,
      })),
    }),
  });
}

export function deriveLoadoutAuthorityDigest(record: Omit<GovernedLoadoutRecord, 'authorityDigest'>): string {
  return sha256Ref({
    schema: 'cambium.governed-loadout-record-digest.v1',
    record,
  });
}

function buildLoadoutRecord(source: LoadoutSourceDefinition, activationRecord: GovernedActivationRecord): GovernedLoadoutRecord {
  const baseRecord = {
    schema: LOADOUT_RECORD_SCHEMA,
    tenantId: TENANT_ID,
    workObjectId: source.workObjectId,
    taskId: source.taskId,
    loadoutId: source.loadoutId,
    eligibleWorkObjectIds: [source.workObjectId] as const,
    authorizedClusterIds: source.clusterIds,
    commandAllowlist: source.commandAllowlist,
    spendClass: 'none' as const,
    deliveryEnabled: false as const,
    externalMutationAllowed: false as const,
    sourceRef: activationRecord.packet.sourceRef,
    sourceDigest: activationRecord.packet.sourceDigest,
  };
  return deepFreeze({
    ...baseRecord,
    authorityDigest: deriveLoadoutAuthorityDigest(baseRecord),
  });
}

function buildLoadoutRegistry(records: readonly GovernedLoadoutRecord[]): GovernedLoadoutRegistry {
  return deepFreeze({
    schema: LOADOUT_REGISTRY_SCHEMA,
    version: 1 as const,
    tenantId: TENANT_ID,
    records,
    registryDigest: sha256Ref({
      schema: 'cambium.governed-loadout-registry-digest.v1',
      tenantId: TENANT_ID,
      version: 1,
      records: records.map((record) => ({
        loadoutId: record.loadoutId,
        workObjectId: record.workObjectId,
        authorityDigest: record.authorityDigest,
      })),
    }),
  });
}

function validateRepositoryIdentity(
  raw: unknown,
  field: string,
  expected?: GovernedRepositoryIdentity,
): GovernedRepositoryIdentity {
  if (!isRecord(raw)) throw new GovernedPortfolioOperationalCohortValidationError(`${field} must be an object`);
  exactFields(raw, ['nameWithOwner', 'repositoryId', 'role'], field);
  const normalized = deepFreeze({
    nameWithOwner: safeRepositoryName(raw.nameWithOwner, `${field}.nameWithOwner`),
    repositoryId: safeRepositoryId(raw.repositoryId, `${field}.repositoryId`),
    role: raw.role === 'product-source' || raw.role === 'folderless-planning-authority' ? raw.role : (() => {
      throw new GovernedPortfolioOperationalCohortValidationError(`${field}.role is invalid`);
    })(),
  });
  if (expected && (
    normalized.nameWithOwner !== expected.nameWithOwner
    || normalized.repositoryId !== expected.repositoryId
    || normalized.role !== expected.role
  )) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} does not match the governed repository identity`);
  }
  return normalized;
}

function validatePacketAuthority(raw: unknown, field: string, expected?: GovernedPacketAuthority): GovernedPacketAuthority {
  if (!isRecord(raw)) throw new GovernedPortfolioOperationalCohortValidationError(`${field} must be an object`);
  exactFields(raw, ['sourceRef', 'sourceDigest'], field);
  const normalized = deepFreeze({
    sourceRef: safeId(raw.sourceRef, `${field}.sourceRef`),
    sourceDigest: safeDigestRef(raw.sourceDigest, `${field}.sourceDigest`),
  });
  if (expected && (
    normalized.sourceRef !== expected.sourceRef
    || normalized.sourceDigest !== expected.sourceDigest
  )) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} does not match the governed packet authority`);
  }
  return normalized;
}

function validateRootContext(raw: unknown, field: string, expected?: GovernedRootContext): GovernedRootContext {
  if (!isRecord(raw)) throw new GovernedPortfolioOperationalCohortValidationError(`${field} must be an object`);
  exactFields(raw, ['folder', 'additionalFolders', 'proposedKind', 'accountId', 'workIds', 'status'], field);
  const folder = raw.folder === null ? null : safeId(raw.folder, `${field}.folder`);
  if (!Array.isArray(raw.additionalFolders) || raw.additionalFolders.length !== 0) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field}.additionalFolders is invalid`);
  }
  if (raw.proposedKind !== 'sapling' && raw.proposedKind !== null) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field}.proposedKind is invalid`);
  }
  if (raw.accountId !== null) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field}.accountId is invalid`);
  }
  if (!Array.isArray(raw.workIds)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field}.workIds is invalid`);
  }
  const workIds = raw.workIds.map((entry, index) => safeWorkObjectId(entry, `${field}.workIds[${index}]`));
  if (new Set(workIds).size !== workIds.length) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field}.workIds contains duplicates`);
  }
  const status = raw.status;
  if (status !== 'mapping-proposal' && status !== 'no-shallow-folder') {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field}.status is invalid`);
  }
  const normalized = deepFreeze({
    folder,
    additionalFolders: [] as const,
    proposedKind: raw.proposedKind,
    accountId: null,
    workIds,
    status,
  });
  if (expected && JSON.stringify(normalized) !== JSON.stringify(expected)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`${field} does not match the governed root context`);
  }
  return normalized;
}

function validatePreparedMappingReceiptAuthority(raw: unknown, source: ActivationSourceDefinition): PreparedMappingReceiptAuthority {
  if (!isRecord(raw)) throw new GovernedPortfolioOperationalCohortValidationError('mappingReceiptAuthority must be an object');
  exactFields(raw, ['schema', 'preparedAuthorityRef', 'preparedAuthorityDigest', 'state', 'issued'], 'mappingReceiptAuthority');
  if (raw.schema !== PREPARED_MAPPING_RECEIPT_AUTHORITY_SCHEMA || raw.state !== 'prepared-not-issued' || raw.issued !== false) {
    throw new GovernedPortfolioOperationalCohortValidationError('mappingReceiptAuthority grammar is invalid');
  }
  const normalized = deepFreeze({
    schema: PREPARED_MAPPING_RECEIPT_AUTHORITY_SCHEMA,
    preparedAuthorityRef: safeId(raw.preparedAuthorityRef, 'mappingReceiptAuthority.preparedAuthorityRef'),
    preparedAuthorityDigest: safeDigestRef(raw.preparedAuthorityDigest, 'mappingReceiptAuthority.preparedAuthorityDigest'),
    state: 'prepared-not-issued' as const,
    issued: false as const,
  });
  const expected = buildPreparedMappingReceiptAuthority(source);
  if (
    normalized.preparedAuthorityRef !== expected.preparedAuthorityRef
    || normalized.preparedAuthorityDigest !== expected.preparedAuthorityDigest
  ) {
    throw new GovernedPortfolioOperationalCohortValidationError('mappingReceiptAuthority does not match the governed prepared receipt authority');
  }
  return normalized;
}

function validateHeldActivationAuthority(
  raw: unknown,
  source: ActivationSourceDefinition,
  mappingReceiptAuthority: PreparedMappingReceiptAuthority,
): HeldActivationAuthority {
  if (!isRecord(raw)) throw new GovernedPortfolioOperationalCohortValidationError('activationAuthority must be an object');
  exactFields(raw, ['schema', 'preparedAuthorityRef', 'preparedAuthorityDigest', 'state', 'issued', 'admitted'], 'activationAuthority');
  if (
    raw.schema !== HELD_ACTIVATION_AUTHORITY_SCHEMA
    || raw.state !== 'prepared-not-issued'
    || raw.issued !== false
    || raw.admitted !== false
  ) {
    throw new GovernedPortfolioOperationalCohortValidationError('activationAuthority grammar is invalid');
  }
  const normalized = deepFreeze({
    schema: HELD_ACTIVATION_AUTHORITY_SCHEMA,
    preparedAuthorityRef: safeId(raw.preparedAuthorityRef, 'activationAuthority.preparedAuthorityRef'),
    preparedAuthorityDigest: safeDigestRef(raw.preparedAuthorityDigest, 'activationAuthority.preparedAuthorityDigest'),
    state: 'prepared-not-issued' as const,
    issued: false as const,
    admitted: false as const,
  });
  const expected = buildHeldActivationAuthority(source, mappingReceiptAuthority);
  if (
    normalized.preparedAuthorityRef !== expected.preparedAuthorityRef
    || normalized.preparedAuthorityDigest !== expected.preparedAuthorityDigest
  ) {
    throw new GovernedPortfolioOperationalCohortValidationError('activationAuthority does not match the governed held activation authority');
  }
  return normalized;
}

export function validateGovernedActivationRecord(raw: unknown): GovernedActivationRecord {
  if (!isRecord(raw)) throw new GovernedPortfolioOperationalCohortValidationError('activation record must be an object');
  exactFields(raw, [
    'schema', 'recordId', 'tenantId', 'workObjectId', 'workObjectKind', 'repository', 'packet', 'rootContext',
    'mappingReceiptAuthority', 'activationAuthority', 'recordDigest', 'activationDigest',
  ], 'activation record');
  if (raw.schema !== ACTIVATION_RECORD_SCHEMA || raw.tenantId !== TENANT_ID || raw.workObjectKind !== 'sapling') {
    throw new GovernedPortfolioOperationalCohortValidationError('activation record grammar is invalid');
  }
  const workObjectId = safeWorkObjectId(raw.workObjectId, 'activation record.workObjectId');
  const expectedSource = ACTIVATION_SOURCE_BY_WORK_OBJECT.get(workObjectId);
  if (!expectedSource) throw new GovernedPortfolioOperationalCohortValidationError(`activation record ${workObjectId} is unknown`);
  const recordId = safeId(raw.recordId, 'activation record.recordId');
  if (recordId !== `activation-record:${workObjectId}`) {
    throw new GovernedPortfolioOperationalCohortValidationError(`activation record ${workObjectId} has an invalid recordId`);
  }
  const repository = validateRepositoryIdentity(raw.repository, 'activation record.repository', expectedSource.repository);
  const packet = validatePacketAuthority(raw.packet, 'activation record.packet', expectedSource.packet);
  const rootContext = validateRootContext(raw.rootContext, 'activation record.rootContext', expectedSource.rootContext);
  const mappingReceiptAuthority = validatePreparedMappingReceiptAuthority(raw.mappingReceiptAuthority, expectedSource);
  const activationAuthority = validateHeldActivationAuthority(raw.activationAuthority, expectedSource, mappingReceiptAuthority);
  const recordDigest = safeDigestRef(raw.recordDigest, 'activation record.recordDigest');
  const activationDigest = safeDigestRef(raw.activationDigest, 'activation record.activationDigest');
  const normalizedBase = {
    schema: ACTIVATION_RECORD_SCHEMA,
    recordId,
    tenantId: TENANT_ID,
    workObjectId,
    workObjectKind: 'sapling' as const,
    repository,
    packet,
    rootContext,
    mappingReceiptAuthority,
    activationAuthority,
  };
  const expectedRecordDigest = deriveActivationRecordDigest(normalizedBase);
  if (recordDigest !== expectedRecordDigest) {
    throw new GovernedPortfolioOperationalCohortValidationError(`activation record ${workObjectId} digest is tampered`);
  }
  const expectedActivationDigest = deriveActivationDigest({ ...normalizedBase, recordDigest });
  if (activationDigest !== expectedActivationDigest) {
    throw new GovernedPortfolioOperationalCohortValidationError(`activation record ${workObjectId} activation digest is tampered`);
  }
  return deepFreeze({ ...normalizedBase, recordDigest, activationDigest });
}

export function validateGovernedActivationManifest(raw: unknown): GovernedActivationManifest {
  if (!isRecord(raw)) throw new GovernedPortfolioOperationalCohortValidationError('activation manifest must be an object');
  exactFields(raw, ['schema', 'version', 'tenantId', 'records', 'manifestDigest'], 'activation manifest');
  if (raw.schema !== ACTIVATION_MANIFEST_SCHEMA || raw.version !== 1 || raw.tenantId !== TENANT_ID) {
    throw new GovernedPortfolioOperationalCohortValidationError('activation manifest grammar is invalid');
  }
  if (!Array.isArray(raw.records) || raw.records.length !== ACTIVATION_SOURCE_DEFINITIONS.length) {
    throw new GovernedPortfolioOperationalCohortValidationError('activation manifest must contain exactly three records');
  }
  const records = raw.records.map((record) => validateGovernedActivationRecord(record));
  const seenWorkObjects = new Set<string>();
  const seenRepositories = new Set<string>();
  for (const record of records) {
    if (seenWorkObjects.has(record.workObjectId)) {
      throw new GovernedPortfolioOperationalCohortValidationError(`activation manifest contains a duplicate WorkObject ${record.workObjectId}`);
    }
    if (seenRepositories.has(record.repository.repositoryId)) {
      throw new GovernedPortfolioOperationalCohortValidationError(`activation manifest contains a duplicate repository ${record.repository.repositoryId}`);
    }
    seenWorkObjects.add(record.workObjectId);
    seenRepositories.add(record.repository.repositoryId);
  }
  for (const definition of ACTIVATION_SOURCE_DEFINITIONS) {
    if (!seenWorkObjects.has(definition.workObjectId)) {
      throw new GovernedPortfolioOperationalCohortValidationError(`activation manifest is missing governed WorkObject ${definition.workObjectId}`);
    }
  }
  const manifestDigest = safeDigestRef(raw.manifestDigest, 'activation manifest.manifestDigest');
  const expectedDigest = buildActivationManifest(records).manifestDigest;
  if (manifestDigest !== expectedDigest) {
    throw new GovernedPortfolioOperationalCohortValidationError('activation manifest digest is tampered');
  }
  return deepFreeze({
    schema: ACTIVATION_MANIFEST_SCHEMA,
    version: 1 as const,
    tenantId: TENANT_ID,
    records,
    manifestDigest,
  });
}

function validateLoadoutSourceConsistency(
  workObjectId: GovernedWorkObjectId,
  taskId: GovernedTaskId,
  loadoutId: GovernedLoadoutId,
  clusterIds: readonly [GovernedClusterId],
  commandAllowlist: readonly [GovernedCommandId],
): void {
  const expected = LOADOUT_SOURCE_BY_WORK_OBJECT.get(workObjectId);
  if (!expected) throw new GovernedPortfolioOperationalCohortValidationError(`loadout ${loadoutId} references unknown WorkObject ${workObjectId}`);
  if (
    expected.taskId !== taskId
    || expected.loadoutId !== loadoutId
    || expected.clusterIds[0] !== clusterIds[0]
    || expected.commandAllowlist[0] !== commandAllowlist[0]
  ) {
    throw new GovernedPortfolioOperationalCohortValidationError(`loadout ${loadoutId} does not match the governed cohort definition`);
  }
}

export function validateGovernedLoadoutRecord(raw: unknown): GovernedLoadoutRecord {
  if (!isRecord(raw)) throw new GovernedPortfolioOperationalCohortValidationError('loadout record must be an object');
  exactFields(raw, [
    'schema', 'tenantId', 'workObjectId', 'taskId', 'loadoutId', 'eligibleWorkObjectIds', 'authorizedClusterIds',
    'commandAllowlist', 'spendClass', 'deliveryEnabled', 'externalMutationAllowed', 'sourceRef', 'sourceDigest', 'authorityDigest',
  ], 'loadout record');
  if (
    raw.schema !== LOADOUT_RECORD_SCHEMA
    || raw.tenantId !== TENANT_ID
    || raw.spendClass !== 'none'
    || raw.deliveryEnabled !== false
    || raw.externalMutationAllowed !== false
  ) {
    throw new GovernedPortfolioOperationalCohortValidationError('loadout record grammar is invalid');
  }
  const workObjectId = safeWorkObjectId(raw.workObjectId, 'loadout record.workObjectId');
  const taskId = safeTaskId(raw.taskId, 'loadout record.taskId');
  const loadoutId = safeLoadoutId(raw.loadoutId, 'loadout record.loadoutId');
  const eligibleWorkObjectIds = normalizeSingleItemArray(raw.eligibleWorkObjectIds, 'loadout record.eligibleWorkObjectIds', safeWorkObjectId);
  const authorizedClusterIds = normalizeSingleItemArray(raw.authorizedClusterIds, 'loadout record.authorizedClusterIds', safeClusterId);
  const commandAllowlist = normalizeSingleItemArray(raw.commandAllowlist, 'loadout record.commandAllowlist', safeCommandId);
  if (eligibleWorkObjectIds[0] !== workObjectId) {
    throw new GovernedPortfolioOperationalCohortValidationError(`loadout ${loadoutId} must authorize exactly its bound WorkObject`);
  }
  validateLoadoutSourceConsistency(workObjectId, taskId, loadoutId, authorizedClusterIds, commandAllowlist);
  const activationSource = ACTIVATION_SOURCE_BY_WORK_OBJECT.get(workObjectId);
  if (!activationSource) throw new GovernedPortfolioOperationalCohortValidationError(`loadout ${loadoutId} references unknown WorkObject ${workObjectId}`);
  const sourceRef = safeId(raw.sourceRef, 'loadout record.sourceRef');
  const sourceDigest = safeDigestRef(raw.sourceDigest, 'loadout record.sourceDigest');
  if (sourceRef !== activationSource.packet.sourceRef || sourceDigest !== activationSource.packet.sourceDigest) {
    throw new GovernedPortfolioOperationalCohortValidationError(`loadout ${loadoutId} packet authority is inconsistent`);
  }
  const authorityDigest = safeDigestRef(raw.authorityDigest, 'loadout record.authorityDigest');
  const normalizedBase = {
    schema: LOADOUT_RECORD_SCHEMA,
    tenantId: TENANT_ID,
    workObjectId,
    taskId,
    loadoutId,
    eligibleWorkObjectIds,
    authorizedClusterIds,
    commandAllowlist,
    spendClass: 'none' as const,
    deliveryEnabled: false as const,
    externalMutationAllowed: false as const,
    sourceRef,
    sourceDigest,
  };
  const expectedDigest = deriveLoadoutAuthorityDigest(normalizedBase);
  if (authorityDigest !== expectedDigest) {
    throw new GovernedPortfolioOperationalCohortValidationError(`loadout ${loadoutId} digest is tampered`);
  }
  return deepFreeze({ ...normalizedBase, authorityDigest });
}

export function validateGovernedLoadoutRegistry(raw: unknown): GovernedLoadoutRegistry {
  if (!isRecord(raw)) throw new GovernedPortfolioOperationalCohortValidationError('loadout registry must be an object');
  exactFields(raw, ['schema', 'version', 'tenantId', 'records', 'registryDigest'], 'loadout registry');
  if (raw.schema !== LOADOUT_REGISTRY_SCHEMA || raw.version !== 1 || raw.tenantId !== TENANT_ID) {
    throw new GovernedPortfolioOperationalCohortValidationError('loadout registry grammar is invalid');
  }
  if (!Array.isArray(raw.records) || raw.records.length !== LOADOUT_SOURCE_DEFINITIONS.length) {
    throw new GovernedPortfolioOperationalCohortValidationError('loadout registry must contain exactly three records');
  }
  const records = raw.records.map((record) => validateGovernedLoadoutRecord(record));
  const seenLoadouts = new Set<string>();
  const seenWorkObjects = new Set<string>();
  const seenTasks = new Set<string>();
  for (const record of records) {
    if (seenLoadouts.has(record.loadoutId)) {
      throw new GovernedPortfolioOperationalCohortValidationError(`loadout registry contains duplicate loadout ${record.loadoutId}`);
    }
    if (seenWorkObjects.has(record.workObjectId)) {
      throw new GovernedPortfolioOperationalCohortValidationError(`loadout registry contains duplicate WorkObject ${record.workObjectId}`);
    }
    if (seenTasks.has(record.taskId)) {
      throw new GovernedPortfolioOperationalCohortValidationError(`loadout registry contains duplicate task ${record.taskId}`);
    }
    seenLoadouts.add(record.loadoutId);
    seenWorkObjects.add(record.workObjectId);
    seenTasks.add(record.taskId);
  }
  for (const definition of LOADOUT_SOURCE_DEFINITIONS) {
    if (!seenLoadouts.has(definition.loadoutId)) {
      throw new GovernedPortfolioOperationalCohortValidationError(`loadout registry is missing governed loadout ${definition.loadoutId}`);
    }
  }
  const registryDigest = safeDigestRef(raw.registryDigest, 'loadout registry.registryDigest');
  const expectedDigest = buildLoadoutRegistry(records).registryDigest;
  if (registryDigest !== expectedDigest) {
    throw new GovernedPortfolioOperationalCohortValidationError('loadout registry digest is tampered');
  }
  return deepFreeze({
    schema: LOADOUT_REGISTRY_SCHEMA,
    version: 1 as const,
    tenantId: TENANT_ID,
    records,
    registryDigest,
  });
}

function buildIssuedMappingReceiptAuthorityCore(
  record: GovernedActivationRecord,
  issuedAuthorityRef: string,
): Omit<IssuedMappingReceiptAuthority, 'issuedAuthorityDigest'> {
  return {
    schema: ISSUED_MAPPING_RECEIPT_AUTHORITY_SCHEMA,
    tenantId: TENANT_ID,
    workObjectId: record.workObjectId,
    repository: record.repository,
    preparedAuthorityRef: record.mappingReceiptAuthority.preparedAuthorityRef,
    preparedAuthorityDigest: record.mappingReceiptAuthority.preparedAuthorityDigest,
    issuedAuthorityRef,
    state: 'issued' as const,
    issued: true as const,
  };
}

function deriveIssuedMappingReceiptAuthorityDigest(authority: Omit<IssuedMappingReceiptAuthority, 'issuedAuthorityDigest'>): string {
  return sha256Ref({
    schema: 'cambium.governed-issued-mapping-receipt-authority-digest.v1',
    authority,
  });
}

/** Builds a self-consistent claim for transport/testing; it has no authority until external readback verification. */
export function buildUnverifiedIssuedMappingReceiptClaim(
  workObjectId: GovernedWorkObjectId,
  issuedAuthorityRef: string,
): IssuedMappingReceiptAuthority {
  const record = activationRecordFor(workObjectId);
  const core = buildIssuedMappingReceiptAuthorityCore(record, safeId(issuedAuthorityRef, 'issuedAuthorityRef'));
  return deepFreeze({
    ...core,
    issuedAuthorityDigest: deriveIssuedMappingReceiptAuthorityDigest(core),
  });
}

function validateIssuedMappingReceiptAuthority(
  raw: unknown,
  record: GovernedActivationRecord,
): IssuedMappingReceiptAuthority {
  if (!isRecord(raw)) throw new GovernedPortfolioOperationalCohortValidationError('issuedMappingReceiptAuthority must be an object');
  exactFields(raw, [
    'schema', 'tenantId', 'workObjectId', 'repository', 'preparedAuthorityRef', 'preparedAuthorityDigest',
    'issuedAuthorityRef', 'issuedAuthorityDigest', 'state', 'issued',
  ], 'issuedMappingReceiptAuthority');
  if (
    raw.schema !== ISSUED_MAPPING_RECEIPT_AUTHORITY_SCHEMA
    || raw.tenantId !== TENANT_ID
    || raw.state !== 'issued'
    || raw.issued !== true
  ) {
    throw new GovernedPortfolioOperationalCohortValidationError('issuedMappingReceiptAuthority grammar is invalid');
  }
  const workObjectId = safeWorkObjectId(raw.workObjectId, 'issuedMappingReceiptAuthority.workObjectId');
  if (workObjectId !== record.workObjectId) {
    throw new GovernedPortfolioOperationalCohortValidationError(`issued mapping receipt authority WorkObject ${workObjectId} does not match ${record.workObjectId}`);
  }
  const repository = validateRepositoryIdentity(raw.repository, 'issuedMappingReceiptAuthority.repository', record.repository);
  const preparedAuthorityRef = safeId(raw.preparedAuthorityRef, 'issuedMappingReceiptAuthority.preparedAuthorityRef');
  const preparedAuthorityDigest = safeDigestRef(raw.preparedAuthorityDigest, 'issuedMappingReceiptAuthority.preparedAuthorityDigest');
  if (
    preparedAuthorityRef !== record.mappingReceiptAuthority.preparedAuthorityRef
    || preparedAuthorityDigest !== record.mappingReceiptAuthority.preparedAuthorityDigest
  ) {
    throw new GovernedPortfolioOperationalCohortValidationError(`issued mapping receipt authority for ${record.workObjectId} does not match the prepared authority`);
  }
  const issuedAuthorityRef = safeId(raw.issuedAuthorityRef, 'issuedMappingReceiptAuthority.issuedAuthorityRef');
  const issuedAuthorityDigest = safeDigestRef(raw.issuedAuthorityDigest, 'issuedMappingReceiptAuthority.issuedAuthorityDigest');
  const core = buildIssuedMappingReceiptAuthorityCore(record, issuedAuthorityRef);
  if (issuedAuthorityDigest !== deriveIssuedMappingReceiptAuthorityDigest(core)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`issued mapping receipt authority for ${record.workObjectId} has a tampered digest`);
  }
  return deepFreeze({ ...core, repository, issuedAuthorityDigest });
}

function buildAdmittedActivationAuthorityCore(
  record: GovernedActivationRecord,
  issuedMappingReceiptAuthority: IssuedMappingReceiptAuthority,
  admittedAuthorityRef: string,
): Omit<AdmittedActivationAuthority, 'admittedAuthorityDigest'> {
  return {
    schema: ADMITTED_ACTIVATION_AUTHORITY_SCHEMA,
    tenantId: TENANT_ID,
    workObjectId: record.workObjectId,
    activationDigest: record.activationDigest,
    activationRecordDigest: record.recordDigest,
    preparedAuthorityRef: record.activationAuthority.preparedAuthorityRef,
    preparedAuthorityDigest: record.activationAuthority.preparedAuthorityDigest,
    issuedMappingReceiptAuthorityRef: issuedMappingReceiptAuthority.issuedAuthorityRef,
    issuedMappingReceiptAuthorityDigest: issuedMappingReceiptAuthority.issuedAuthorityDigest,
    admittedAuthorityRef,
    state: 'admitted' as const,
    issued: true as const,
    admitted: true as const,
  };
}

function deriveAdmittedActivationAuthorityDigest(authority: Omit<AdmittedActivationAuthority, 'admittedAuthorityDigest'>): string {
  return sha256Ref({
    schema: 'cambium.governed-admitted-activation-authority-digest.v1',
    authority,
  });
}

/** Builds a self-consistent claim for transport/testing; it has no authority until external readback verification. */
export function buildUnverifiedAdmittedActivationClaim(
  workObjectId: GovernedWorkObjectId,
  issuedMappingReceiptAuthority: IssuedMappingReceiptAuthority,
  admittedAuthorityRef: string,
): AdmittedActivationAuthority {
  const record = activationRecordFor(workObjectId);
  const issuedAuthority = validateIssuedMappingReceiptAuthority(issuedMappingReceiptAuthority, record);
  const core = buildAdmittedActivationAuthorityCore(
    record,
    issuedAuthority,
    safeId(admittedAuthorityRef, 'admittedAuthorityRef'),
  );
  return deepFreeze({
    ...core,
    admittedAuthorityDigest: deriveAdmittedActivationAuthorityDigest(core),
  });
}

function validateAdmittedActivationAuthority(
  raw: unknown,
  record: GovernedActivationRecord,
  issuedMappingReceiptAuthority: IssuedMappingReceiptAuthority,
): AdmittedActivationAuthority {
  if (!isRecord(raw)) throw new GovernedPortfolioOperationalCohortValidationError('admittedActivationAuthority must be an object');
  exactFields(raw, [
    'schema', 'tenantId', 'workObjectId', 'activationDigest', 'activationRecordDigest', 'preparedAuthorityRef',
    'preparedAuthorityDigest', 'issuedMappingReceiptAuthorityRef', 'issuedMappingReceiptAuthorityDigest',
    'admittedAuthorityRef', 'admittedAuthorityDigest', 'state', 'issued', 'admitted',
  ], 'admittedActivationAuthority');
  if (
    raw.schema !== ADMITTED_ACTIVATION_AUTHORITY_SCHEMA
    || raw.tenantId !== TENANT_ID
    || raw.state !== 'admitted'
    || raw.issued !== true
    || raw.admitted !== true
  ) {
    throw new GovernedPortfolioOperationalCohortValidationError('admittedActivationAuthority grammar is invalid');
  }
  const workObjectId = safeWorkObjectId(raw.workObjectId, 'admittedActivationAuthority.workObjectId');
  if (workObjectId !== record.workObjectId) {
    throw new GovernedPortfolioOperationalCohortValidationError(`admitted activation authority WorkObject ${workObjectId} does not match ${record.workObjectId}`);
  }
  const activationDigest = safeDigestRef(raw.activationDigest, 'admittedActivationAuthority.activationDigest');
  const activationRecordDigest = safeDigestRef(raw.activationRecordDigest, 'admittedActivationAuthority.activationRecordDigest');
  if (activationDigest !== record.activationDigest || activationRecordDigest !== record.recordDigest) {
    throw new GovernedPortfolioOperationalCohortValidationError(`admitted activation authority for ${record.workObjectId} does not match the held activation digest`);
  }
  const preparedAuthorityRef = safeId(raw.preparedAuthorityRef, 'admittedActivationAuthority.preparedAuthorityRef');
  const preparedAuthorityDigest = safeDigestRef(raw.preparedAuthorityDigest, 'admittedActivationAuthority.preparedAuthorityDigest');
  if (
    preparedAuthorityRef !== record.activationAuthority.preparedAuthorityRef
    || preparedAuthorityDigest !== record.activationAuthority.preparedAuthorityDigest
  ) {
    throw new GovernedPortfolioOperationalCohortValidationError(`admitted activation authority for ${record.workObjectId} does not match the prepared authority`);
  }
  const issuedMappingReceiptAuthorityRef = safeId(
    raw.issuedMappingReceiptAuthorityRef,
    'admittedActivationAuthority.issuedMappingReceiptAuthorityRef',
  );
  const issuedMappingReceiptAuthorityDigest = safeDigestRef(
    raw.issuedMappingReceiptAuthorityDigest,
    'admittedActivationAuthority.issuedMappingReceiptAuthorityDigest',
  );
  if (
    issuedMappingReceiptAuthorityRef !== issuedMappingReceiptAuthority.issuedAuthorityRef
    || issuedMappingReceiptAuthorityDigest !== issuedMappingReceiptAuthority.issuedAuthorityDigest
  ) {
    throw new GovernedPortfolioOperationalCohortValidationError(
      `admitted activation authority for ${record.workObjectId} does not match the issued mapping receipt authority`,
    );
  }
  const admittedAuthorityRef = safeId(raw.admittedAuthorityRef, 'admittedActivationAuthority.admittedAuthorityRef');
  const admittedAuthorityDigest = safeDigestRef(raw.admittedAuthorityDigest, 'admittedActivationAuthority.admittedAuthorityDigest');
  const core = buildAdmittedActivationAuthorityCore(record, issuedMappingReceiptAuthority, admittedAuthorityRef);
  if (admittedAuthorityDigest !== deriveAdmittedActivationAuthorityDigest(core)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`admitted activation authority for ${record.workObjectId} has a tampered digest`);
  }
  return deepFreeze({ ...core, admittedAuthorityDigest });
}

function validateSignedApprovalReference(raw: unknown, expectedSubjectDigest: string): SignedApprovalReference {
  if (!isRecord(raw)) throw new GovernedPortfolioOperationalCohortValidationError('approval must be an object');
  exactFields(raw, ['schema', 'approvalRef', 'approvalSubjectDigest', 'status', 'consumed'], 'approval');
  if (raw.schema !== APPROVAL_REFERENCE_SCHEMA || raw.status !== 'signed-unconsumed' || raw.consumed !== false) {
    throw new GovernedPortfolioOperationalCohortValidationError('approval grammar is invalid');
  }
  const approvalRef = safeId(raw.approvalRef, 'approval.approvalRef');
  const approvalSubjectDigest = safeDigestRef(raw.approvalSubjectDigest, 'approval.approvalSubjectDigest');
  if (approvalSubjectDigest !== expectedSubjectDigest) {
    throw new GovernedPortfolioOperationalCohortValidationError('approval subject digest does not match the dispatch authority');
  }
  return deepFreeze({
    schema: APPROVAL_REFERENCE_SCHEMA,
    approvalRef,
    approvalSubjectDigest,
    status: 'signed-unconsumed' as const,
    consumed: false as const,
  });
}

function activationRecordFor(workObjectId: GovernedWorkObjectId): GovernedActivationRecord {
  const record = GOVERNED_ACTIVATION_MANIFEST.records.find((entry) => entry.workObjectId === workObjectId) ?? null;
  if (!record) throw new GovernedPortfolioOperationalCohortValidationError(`missing activation record for ${workObjectId}`);
  return record;
}

export function resolveGovernedLoadout(loadoutId: string, workObjectId: string): GovernedLoadoutRecord | null {
  if (!LOADOUT_ID.test(loadoutId) || !WORK_OBJECT_ID.test(workObjectId)) return null;
  const record = GOVERNED_LOADOUT_REGISTRY.records.find((entry) => entry.loadoutId === loadoutId) ?? null;
  if (!record || record.workObjectId !== workObjectId) return null;
  return record;
}

function dispatchAuthorityCore(input: {
  tenantId: typeof TENANT_ID;
  workObjectId: GovernedWorkObjectId;
  taskId: GovernedTaskId;
  graphVersion: number;
  activationManifestDigest: string;
  activationRecordDigest: string;
  activationDigest: string;
  repository: GovernedRepositoryIdentity;
  loadoutId: GovernedLoadoutId;
  loadoutDigest: string;
  clusters: readonly [GovernedClusterId];
  command: GovernedCommandId;
  mappingReceiptAuthority: {
    readonly preparedAuthorityRef: string;
    readonly preparedAuthorityDigest: string;
    readonly issuedAuthorityRef: string;
    readonly issuedAuthorityDigest: string;
  };
  admittedActivationAuthority: AdmittedActivationAuthority;
}) {
  return {
    tenantId: input.tenantId,
    workObjectId: input.workObjectId,
    taskId: input.taskId,
    graphVersion: input.graphVersion,
    activationManifestDigest: input.activationManifestDigest,
    activationRecordDigest: input.activationRecordDigest,
    activationDigest: input.activationDigest,
    repository: input.repository,
    loadoutId: input.loadoutId,
    loadoutDigest: input.loadoutDigest,
    clusters: input.clusters,
    command: input.command,
    mappingReceiptAuthority: input.mappingReceiptAuthority,
    admittedActivationAuthority: input.admittedActivationAuthority,
    spendClass: 'none' as const,
    deliveryEnabled: false as const,
    externalMutationAllowed: false as const,
  };
}

function deriveGovernedDispatchAuthorityDigest(core: Parameters<typeof dispatchAuthorityCore>[0]): string {
  return sha256Ref({
    schema: 'cambium.governed-dispatch-authority-digest.v1',
    dispatch: dispatchAuthorityCore(core),
  });
}

export function deriveGovernedDispatchApprovalSubjectDigest(core: Parameters<typeof dispatchAuthorityCore>[0]): string {
  return sha256Ref({
    schema: APPROVAL_SUBJECT_SCHEMA,
    dispatch: dispatchAuthorityCore(core),
  });
}

function validateDispatchInput(raw: unknown): Omit<GovernedDispatchPreparationInput, 'approval'> & { approval: unknown } {
  if (!isRecord(raw)) throw new GovernedPortfolioOperationalCohortValidationError('dispatch input must be an object');
  exactFields(raw, [
    'schema', 'tenantId', 'workObjectId', 'taskId', 'graphVersion', 'loadoutId', 'clusterIds',
    'command', 'repository', 'issuedMappingReceiptAuthority', 'admittedActivationAuthority', 'approval',
  ], 'dispatch input');
  if (raw.schema !== DISPATCH_INPUT_SCHEMA || raw.tenantId !== TENANT_ID) {
    throw new GovernedPortfolioOperationalCohortValidationError('dispatch input grammar is invalid');
  }
  if (!Number.isSafeInteger(raw.graphVersion) || Number(raw.graphVersion) < 1) {
    throw new GovernedPortfolioOperationalCohortValidationError('dispatch input graphVersion is invalid');
  }
  return {
    schema: DISPATCH_INPUT_SCHEMA,
    tenantId: TENANT_ID,
    workObjectId: safeWorkObjectId(raw.workObjectId, 'dispatch input.workObjectId'),
    taskId: safeTaskId(raw.taskId, 'dispatch input.taskId'),
    graphVersion: Number(raw.graphVersion),
    loadoutId: safeLoadoutId(raw.loadoutId, 'dispatch input.loadoutId'),
    clusterIds: normalizeSingleItemArray(raw.clusterIds, 'dispatch input.clusterIds', safeClusterId),
    command: safeCommandId(raw.command, 'dispatch input.command'),
    repository: validateRepositoryIdentity(raw.repository, 'dispatch input.repository'),
    issuedMappingReceiptAuthority: raw.issuedMappingReceiptAuthority as IssuedMappingReceiptAuthority,
    admittedActivationAuthority: raw.admittedActivationAuthority as AdmittedActivationAuthority,
    approval: raw.approval,
  };
}

export function prepareGovernedDispatch(
  raw: unknown,
  authorityVerifier: GovernedDispatchAuthorityVerifier,
): GovernedDispatchPreparation {
  if (!authorityVerifier || authorityVerifier.source !== 'external-authority-readback') {
    throw new GovernedPortfolioOperationalCohortValidationError('dispatch requires an external authority readback verifier');
  }
  const input = validateDispatchInput(raw);
  const activationRecord = activationRecordFor(input.workObjectId);
  const loadout = resolveGovernedLoadout(input.loadoutId, input.workObjectId);
  if (!loadout) {
    throw new GovernedPortfolioOperationalCohortValidationError(`loadout ${input.loadoutId} is not governed for ${input.workObjectId}`);
  }
  if (
    input.repository.nameWithOwner !== activationRecord.repository.nameWithOwner
    || input.repository.repositoryId !== activationRecord.repository.repositoryId
    || input.repository.role !== activationRecord.repository.role
  ) {
    throw new GovernedPortfolioOperationalCohortValidationError(`repository identity does not match the governed activation record for ${input.workObjectId}`);
  }
  if (input.taskId !== loadout.taskId) {
    throw new GovernedPortfolioOperationalCohortValidationError(`task ${input.taskId} is not governed for ${input.workObjectId}`);
  }
  compareStringArrays(input.clusterIds, loadout.authorizedClusterIds, 'dispatch input.clusterIds');
  if (!loadout.commandAllowlist.includes(input.command)) {
    throw new GovernedPortfolioOperationalCohortValidationError(`command ${input.command} is not authorized by ${loadout.loadoutId}`);
  }
  const issuedMappingReceiptAuthority = validateIssuedMappingReceiptAuthority(input.issuedMappingReceiptAuthority, activationRecord);
  const admittedActivationAuthority = validateAdmittedActivationAuthority(
    input.admittedActivationAuthority,
    activationRecord,
    issuedMappingReceiptAuthority,
  );
  if (!authorityVerifier.verifyIssuedMappingReceiptAuthority(issuedMappingReceiptAuthority)) {
    throw new GovernedPortfolioOperationalCohortValidationError('issued mapping receipt authority lacks external readback proof');
  }
  if (!authorityVerifier.verifyAdmittedActivationAuthority(admittedActivationAuthority)) {
    throw new GovernedPortfolioOperationalCohortValidationError('admitted activation authority lacks external readback proof');
  }
  const core = {
    tenantId: TENANT_ID,
    workObjectId: input.workObjectId,
    taskId: input.taskId,
    graphVersion: input.graphVersion,
    activationManifestDigest: GOVERNED_ACTIVATION_MANIFEST_DIGEST,
    activationRecordDigest: activationRecord.recordDigest,
    activationDigest: activationRecord.activationDigest,
    repository: activationRecord.repository,
    loadoutId: loadout.loadoutId,
    loadoutDigest: loadout.authorityDigest,
    clusters: loadout.authorizedClusterIds,
    command: input.command,
    mappingReceiptAuthority: {
      preparedAuthorityRef: issuedMappingReceiptAuthority.preparedAuthorityRef,
      preparedAuthorityDigest: issuedMappingReceiptAuthority.preparedAuthorityDigest,
      issuedAuthorityRef: issuedMappingReceiptAuthority.issuedAuthorityRef,
      issuedAuthorityDigest: issuedMappingReceiptAuthority.issuedAuthorityDigest,
    },
    admittedActivationAuthority,
  };
  const approvalSubjectDigest = deriveGovernedDispatchApprovalSubjectDigest(core);
  const approval = validateSignedApprovalReference(input.approval, approvalSubjectDigest);
  return deepFreeze({
    schema: DISPATCH_SCHEMA,
    version: 1 as const,
    tenantId: TENANT_ID,
    workObjectId: input.workObjectId,
    taskId: input.taskId,
    graphVersion: input.graphVersion,
    activationManifestDigest: GOVERNED_ACTIVATION_MANIFEST_DIGEST,
    activationRecordDigest: activationRecord.recordDigest,
    activationDigest: activationRecord.activationDigest,
    repository: activationRecord.repository,
    loadoutId: loadout.loadoutId,
    loadoutDigest: loadout.authorityDigest,
    clusters: loadout.authorizedClusterIds,
    command: input.command,
    mappingReceiptAuthority: core.mappingReceiptAuthority,
    admittedActivationAuthority,
    approval,
    approvalSubjectDigest,
    dispatchAuthorityDigest: deriveGovernedDispatchAuthorityDigest(core),
    spendClass: 'none' as const,
    deliveryEnabled: false as const,
    externalMutationAllowed: false as const,
  });
}

const BUILT_ACTIVATION_MANIFEST = buildActivationManifest(
  ACTIVATION_SOURCE_DEFINITIONS.map((definition) => buildActivationRecord(definition)),
);

export const GOVERNED_ACTIVATION_MANIFEST = validateGovernedActivationManifest(BUILT_ACTIVATION_MANIFEST);
export const GOVERNED_ACTIVATION_MANIFEST_DIGEST = GOVERNED_ACTIVATION_MANIFEST.manifestDigest;

const BUILT_LOADOUT_REGISTRY = buildLoadoutRegistry(
  LOADOUT_SOURCE_DEFINITIONS.map((definition) => buildLoadoutRecord(definition, activationRecordFor(definition.workObjectId))),
);

export const GOVERNED_LOADOUT_REGISTRY = validateGovernedLoadoutRegistry(BUILT_LOADOUT_REGISTRY);
export const GOVERNED_LOADOUT_REGISTRY_DIGEST = GOVERNED_LOADOUT_REGISTRY.registryDigest;

export const THREE_SAPLING_LOADOUT_AUTHORITY: GoalGraphLoadoutAuthority = deepFreeze({
  resolve(loadoutId: string): GoalGraphLoadoutAuthorityRecord | null {
    if (!LOADOUT_ID.test(loadoutId)) return null;
    return GOVERNED_LOADOUT_REGISTRY.records.find((record) => record.loadoutId === loadoutId) ?? null;
  },
});
