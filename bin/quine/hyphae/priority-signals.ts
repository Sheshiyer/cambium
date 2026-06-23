// Quine hypha · priority signals — explicit policy-facing decision context.
// This module is the producer for `.operator/<tenant>.priority-signals.json`.
// It never invents business truth: founder preference, capacity, economic risk,
// team availability, and revocation must arrive through an operator source file.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { PolicyPrioritySignals } from '../../operator/quests/operator-policy.ts';
import type { QuineCtx } from '../types.ts';
import type { PaperclipOpenItem } from './paperclip.ts';

type EconomicRisk = PolicyPrioritySignals['economicRisk']['risk'];

export interface PrioritySignalSourceDocument {
  source: 'operator-priority-source@v1';
  founderPreference?: {
    targetId?: string;
    weight?: number;
    proof?: string;
  };
  ownerCapacity?: {
    owner?: string;
    capacity?: number;
    capacities?: Record<string, number>;
    defaultCapacity?: number;
    proof?: string;
  };
  economicRisk?: {
    amount?: number;
    currency?: string;
    risk?: EconomicRisk;
    proof?: string;
  };
  teamAvailability?: {
    available?: number;
    required?: number;
    proof?: string;
  };
  memberRevocation?: {
    revoked?: boolean;
    proof?: string;
  };
  crossTenantUrgency?: {
    score?: number;
    proof?: string;
  };
}

export interface PrioritySignalBuildOptions {
  tenant: string;
  tenantIds?: string[];
  openItems?: PaperclipOpenItem[];
  nowIso?: string;
  existingPolicyFile?: boolean;
}

export interface PrioritySignalBuildResult {
  status: 'ready' | 'blocked' | 'skipped';
  missing: string[];
  policy: Record<string, unknown> | null;
  signals?: PolicyPrioritySignals;
}

export interface PrioritySignalRefreshOptions extends Omit<PrioritySignalBuildOptions, 'tenant' | 'existingPolicyFile'> {
  writeReadiness?: boolean;
}

export interface PrioritySignalRefreshResult {
  hypha: 'quests';
  op: 'priority-signals';
  tenant: string;
  status: 'ready' | 'blocked' | 'skipped';
  missing: string[];
  signalFile: string | null;
  readinessFile: string | null;
  signals?: PolicyPrioritySignals;
}

export interface PrioritySourceCaptureInput {
  founderTarget?: string;
  founderWeight?: number;
  founderProof?: string;
  owner?: string;
  capacity?: number;
  capacityProof?: string;
  amount?: number;
  currency?: string;
  economicRisk?: EconomicRisk;
  economicProof?: string;
  available?: number;
  required?: number;
  availabilityProof?: string;
  revoked?: boolean;
  revocationProof?: string;
  urgencyScore?: number;
  urgencyProof?: string;
}

export interface PrioritySourceCaptureOptions extends Omit<PrioritySignalRefreshOptions, 'writeReadiness'> {
  writeReadiness?: boolean;
}

export interface PrioritySourceCaptureResult {
  hypha: 'quests';
  op: 'priority-source';
  tenant: string;
  status: 'captured' | 'rejected';
  missing: string[];
  sourceFile: string | null;
  signalFile: string | null;
  readinessFile: string | null;
  priority?: PrioritySignalRefreshResult;
}

export interface PrioritySourceAuditOptions extends Omit<PrioritySignalBuildOptions, 'tenant' | 'existingPolicyFile'> {}

export interface PrioritySourceAuditResult {
  hypha: 'quests';
  op: 'priority-audit';
  tenant: string;
  status: 'ready' | 'blocked' | 'skipped';
  missing: string[];
  sourceFile: string;
  signalFile: string;
  readinessFile: string;
  sourceExists: boolean;
  signalExists: boolean;
  readinessExists: boolean;
  currentSignalStatus: string | null;
  wouldWriteSignal: boolean;
  wouldBlockStaleAuthority: boolean;
}

export interface PrioritySourceTemplateOptions extends Omit<PrioritySignalBuildOptions, 'tenant' | 'existingPolicyFile'> {
  writeTemplate?: boolean;
}

export interface PrioritySourceTemplateResult {
  hypha: 'quests';
  op: 'priority-template';
  tenant: string;
  status: 'template';
  sourceFile: string;
  templateFile: string;
  signalFile: string;
  written: boolean;
  writesAuthority: false;
  suggestedFounderTarget: string | null;
  suggestedOwner: string | null;
  openItems: number;
  tenantCount: number;
  template: Record<string, unknown>;
}

const SIGNAL_SOURCE = 'operator-priority-signals@v1' as const;
const SOURCE_DOCUMENT = 'operator-priority-source@v1' as const;
const READINESS_SOURCE = 'operator-priority-readiness@v1' as const;
const SOURCE_TEMPLATE = 'operator-priority-source-template@v1' as const;
const economicRisks = new Set(['low', 'medium', 'high', 'critical']);

function readJson(path: string): any | undefined {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return undefined; }
}

function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  renameSync(tmp, path);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function risk(value: unknown): EconomicRisk | undefined {
  return economicRisks.has(String(value)) ? value as EconomicRisk : undefined;
}

function ownerCounts(openItems: PaperclipOpenItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of openItems) {
    const owner = text(item.owner) || 'Paperclip';
    counts.set(owner, (counts.get(owner) ?? 0) + 1);
  }
  return counts;
}

function busiestOwner(counts: Map<string, number>): string | undefined {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

function ownerCapacity(source: PrioritySignalSourceDocument | undefined, owner: string | undefined): number | undefined {
  const capacity = source?.ownerCapacity;
  if (!capacity || !owner) return undefined;
  const explicit = capacity.capacities?.[owner];
  if (finite(explicit)) return explicit;
  if (finite(capacity.capacity)) return capacity.capacity;
  if (finite(capacity.defaultCapacity)) return capacity.defaultCapacity;
  return undefined;
}

function clampUrgency(score: number): number {
  return Math.max(0, Math.min(5, Math.round(score)));
}

function derivedUrgencyScore(openItems: PaperclipOpenItem[], tenantCount: number, explicit: number | undefined): number {
  const blocking = openItems.filter((item) => item.priority?.dependency === 'blocks-delivery').length;
  const critical = openItems.filter((item) => item.priority?.risk === 'critical').length;
  const high = openItems.filter((item) => ['high', 'critical'].includes(String(item.priority?.risk))).length;
  const tenantLift = tenantCount > 1 ? 1 : 0;
  const itemLift = Math.min(2, blocking) + Math.min(1, critical) + Math.min(1, high > 1 ? 1 : 0);
  return clampUrgency(Math.max(finite(explicit) ? explicit : 0, tenantLift + itemLift));
}

function readinessPolicy(nowIso: string, missing: string[], sourcePresent: boolean, tenant: string): Record<string, unknown> {
  return {
    source: SIGNAL_SOURCE,
    status: 'blocked',
    tenant,
    generatedAt: nowIso,
    missing,
    proof: sourcePresent
      ? `priority source incomplete: ${missing.join(', ')}`
      : 'priority source missing; no policy priority signals served',
  };
}

function captureMissing(input: PrioritySourceCaptureInput): string[] {
  const missing: string[] = [];
  if (!text(input.founderTarget) || !finite(input.founderWeight) || !text(input.founderProof)) {
    missing.push('founder preference target, weight, or proof');
  }
  if (!text(input.owner) || !finite(input.capacity) || !text(input.capacityProof)) {
    missing.push('owner capacity owner, capacity, or proof');
  }
  if (!finite(input.amount) || !text(input.currency) || !risk(input.economicRisk) || !text(input.economicProof)) {
    missing.push('economic amount, currency, risk, or proof');
  }
  if (!finite(input.available) || !finite(input.required) || !text(input.availabilityProof)) {
    missing.push('team availability counts or proof');
  }
  if (typeof input.revoked !== 'boolean' || !text(input.revocationProof)) {
    missing.push('member revocation boolean or proof');
  }
  if (!text(input.urgencyProof)) {
    missing.push('cross-tenant urgency scoring proof');
  }
  return missing;
}

function sourceFromCapture(input: PrioritySourceCaptureInput, capturedAt: string): PrioritySignalSourceDocument & { capturedAt: string } {
  return {
    source: SOURCE_DOCUMENT,
    capturedAt,
    founderPreference: {
      targetId: text(input.founderTarget),
      weight: input.founderWeight as number,
      proof: text(input.founderProof),
    },
    ownerCapacity: {
      owner: text(input.owner),
      capacity: input.capacity as number,
      proof: text(input.capacityProof),
    },
    economicRisk: {
      amount: input.amount as number,
      currency: text(input.currency).toUpperCase(),
      risk: risk(input.economicRisk) as EconomicRisk,
      proof: text(input.economicProof),
    },
    teamAvailability: {
      available: input.available as number,
      required: input.required as number,
      proof: text(input.availabilityProof),
    },
    memberRevocation: {
      revoked: input.revoked as boolean,
      proof: text(input.revocationProof),
    },
    crossTenantUrgency: {
      ...(finite(input.urgencyScore) ? { score: input.urgencyScore } : {}),
      proof: text(input.urgencyProof),
    },
  };
}

export function buildPrioritySignals(
  source: PrioritySignalSourceDocument | undefined,
  options: PrioritySignalBuildOptions,
): PrioritySignalBuildResult {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const openItems = options.openItems ?? [];
  const counts = ownerCounts(openItems);
  const owner = text(source?.ownerCapacity?.owner) || busiestOwner(counts);
  const capacity = ownerCapacity(source, owner);
  const tenantIds = [...new Set((options.tenantIds ?? []).filter(Boolean))];
  const tenantCount = tenantIds.length || 1;
  const missing: string[] = [];

  if (!source || source.source !== SOURCE_DOCUMENT) {
    if (options.existingPolicyFile) {
      return {
        status: 'blocked',
        missing: ['operator-priority-source@v1 file'],
        policy: readinessPolicy(nowIso, ['operator-priority-source@v1 file'], false, options.tenant),
      };
    }
    return { status: 'skipped', missing: ['operator-priority-source@v1 file'], policy: null };
  }

  const founderTarget = text(source.founderPreference?.targetId);
  const founderWeight = source.founderPreference?.weight;
  const founderProof = text(source.founderPreference?.proof);
  if (!founderTarget || !finite(founderWeight) || !founderProof) {
    missing.push('founder preference target, weight, or proof');
  }

  const capacityProof = text(source.ownerCapacity?.proof);
  if (!owner || !finite(capacity) || !capacityProof) {
    missing.push('owner capacity owner, capacity, or proof');
  }

  const amount = source.economicRisk?.amount;
  const currency = text(source.economicRisk?.currency).toUpperCase();
  const economicRisk = risk(source.economicRisk?.risk);
  const economicProof = text(source.economicRisk?.proof);
  if (!finite(amount) || !currency || !economicRisk || !economicProof) {
    missing.push('economic amount, currency, risk, or proof');
  }

  const available = source.teamAvailability?.available;
  const required = source.teamAvailability?.required;
  const availabilityProof = text(source.teamAvailability?.proof);
  if (!finite(available) || !finite(required) || !availabilityProof) {
    missing.push('team availability counts or proof');
  }

  const revoked = source.memberRevocation?.revoked;
  const revocationProof = text(source.memberRevocation?.proof);
  if (typeof revoked !== 'boolean' || !revocationProof) {
    missing.push('member revocation boolean or proof');
  }

  const urgencyProof = text(source.crossTenantUrgency?.proof);
  if (!urgencyProof) missing.push('cross-tenant urgency scoring proof');

  if (missing.length > 0) {
    return {
      status: 'blocked',
      missing,
      policy: readinessPolicy(nowIso, missing, true, options.tenant),
    };
  }

  const openItemsForOwner = owner ? counts.get(owner) ?? 0 : 0;
  const urgencyScore = derivedUrgencyScore(openItems, tenantCount, source.crossTenantUrgency?.score);
  const signals: PolicyPrioritySignals = {
    source: SIGNAL_SOURCE,
    founderPreference: {
      targetId: founderTarget,
      weight: founderWeight as number,
      proof: founderProof,
    },
    ownerLoad: {
      owner: owner as string,
      openItems: openItemsForOwner,
      capacity: capacity as number,
      proof: `${capacityProof} · ${openItemsForOwner} open item${openItemsForOwner === 1 ? '' : 's'} currently assigned to ${owner}`,
    },
    economicRisk: {
      amount: amount as number,
      currency,
      risk: economicRisk as EconomicRisk,
      proof: economicProof,
    },
    teamAvailability: {
      available: available as number,
      required: required as number,
      proof: availabilityProof,
    },
    memberRevocation: {
      revoked: revoked as boolean,
      proof: revocationProof,
    },
    crossTenantUrgency: {
      score: urgencyScore,
      tenants: tenantCount,
      proof: `${urgencyProof} · ${tenantCount} registered tenant${tenantCount === 1 ? '' : 's'} · ${openItems.length} open gate item${openItems.length === 1 ? '' : 's'}`,
    },
  };

  return { status: 'ready', missing: [], policy: signals, signals };
}

export function prioritySourcePath(ctx: QuineCtx, tenant: string): string {
  return join(ctx.root, '.operator', `${tenant}.priority-source.json`);
}

export function prioritySignalsPath(ctx: QuineCtx, tenant: string): string {
  return join(ctx.root, '.operator', `${tenant}.priority-signals.json`);
}

export function priorityReadinessPath(ctx: QuineCtx, tenant: string): string {
  return join(ctx.root, '.operator', `${tenant}.priority-signals.readiness.json`);
}

export function prioritySourceTemplatePath(ctx: QuineCtx, tenant: string): string {
  return join(ctx.root, '.operator', `${tenant}.priority-source.template.json`);
}

export function auditPrioritySource(
  ctx: QuineCtx,
  tenant: string,
  options: PrioritySourceAuditOptions = {},
): PrioritySourceAuditResult {
  const sourcePath = prioritySourcePath(ctx, tenant);
  const signalPath = prioritySignalsPath(ctx, tenant);
  const readinessPath = priorityReadinessPath(ctx, tenant);
  const sourceExists = existsSync(sourcePath);
  const signalExists = existsSync(signalPath);
  const readinessExists = existsSync(readinessPath);
  const source = readJson(sourcePath) as PrioritySignalSourceDocument | undefined;
  const currentSignal = readJson(signalPath);
  const built = buildPrioritySignals(source, {
    ...options,
    tenant,
    existingPolicyFile: signalExists,
  });
  return {
    hypha: 'quests',
    op: 'priority-audit',
    tenant,
    status: built.status,
    missing: built.missing,
    sourceFile: `.operator/${tenant}.priority-source.json`,
    signalFile: `.operator/${tenant}.priority-signals.json`,
    readinessFile: `.operator/${tenant}.priority-signals.readiness.json`,
    sourceExists,
    signalExists,
    readinessExists,
    currentSignalStatus: typeof currentSignal?.status === 'string'
      ? currentSignal.status
      : currentSignal?.source === SIGNAL_SOURCE
      ? 'ready'
      : null,
    wouldWriteSignal: Boolean(built.policy),
    wouldBlockStaleAuthority: signalExists && built.status === 'blocked',
  };
}

export function prioritySourceTemplate(
  ctx: QuineCtx,
  tenant: string,
  options: PrioritySourceTemplateOptions = {},
): PrioritySourceTemplateResult {
  const openItems = options.openItems ?? [];
  const counts = ownerCounts(openItems);
  const owner = busiestOwner(counts) ?? null;
  const founderTarget = openItems[0]?.id ? String(openItems[0].id) : null;
  const tenantIds = [...new Set((options.tenantIds ?? []).filter(Boolean))];
  const tenantCount = tenantIds.length || 1;
  const generatedAt = options.nowIso ?? new Date().toISOString();
  const template = {
    source: SOURCE_TEMPLATE,
    targetSource: SOURCE_DOCUMENT,
    tenant,
    generatedAt,
    writesAuthority: false,
    instructions: [
      'Copy sourceDocument to .operator/<tenant>.priority-source.json only after every TODO is replaced with real proof.',
      'Do not rename this template file to priority-source.json without reviewing every proof field.',
      'Run quine write quests priority-audit before and after capture.',
    ],
    context: {
      tenantCount,
      suggestedFounderTarget: founderTarget,
      suggestedOwner: owner,
      openItems: openItems.slice(0, 5).map((item) => ({
        id: item.id,
        title: item.title,
        owner: item.owner,
        status: item.status,
        priority: item.priority,
      })),
    },
    sourceDocument: {
      source: SOURCE_DOCUMENT,
      founderPreference: {
        targetId: founderTarget ?? 'TODO-gate-item-id',
        weight: null,
        proof: 'TODO founder preference proof',
      },
      ownerCapacity: {
        owner: owner ?? 'TODO-owner',
        capacity: null,
        proof: 'TODO owner capacity proof',
      },
      economicRisk: {
        amount: null,
        currency: 'TODO-currency',
        risk: 'TODO-low|medium|high|critical',
        proof: 'TODO economic amount/currency/risk proof',
      },
      teamAvailability: {
        available: null,
        required: null,
        proof: 'TODO team availability proof',
      },
      memberRevocation: {
        revoked: null,
        proof: 'TODO member revocation proof',
      },
      crossTenantUrgency: {
        score: null,
        proof: 'TODO cross-tenant urgency proof',
      },
    },
  };
  const templatePath = prioritySourceTemplatePath(ctx, tenant);
  if (options.writeTemplate) writeJsonAtomic(templatePath, template);
  return {
    hypha: 'quests',
    op: 'priority-template',
    tenant,
    status: 'template',
    sourceFile: `.operator/${tenant}.priority-source.json`,
    templateFile: `.operator/${tenant}.priority-source.template.json`,
    signalFile: `.operator/${tenant}.priority-signals.json`,
    written: !!options.writeTemplate,
    writesAuthority: false,
    suggestedFounderTarget: founderTarget,
    suggestedOwner: owner,
    openItems: openItems.length,
    tenantCount,
    template,
  };
}

export function capturePrioritySource(
  ctx: QuineCtx,
  tenant: string,
  input: PrioritySourceCaptureInput,
  options: PrioritySourceCaptureOptions = {},
): PrioritySourceCaptureResult {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const sourcePath = prioritySourcePath(ctx, tenant);
  const signalPath = prioritySignalsPath(ctx, tenant);
  const readinessPath = priorityReadinessPath(ctx, tenant);
  const missing = captureMissing(input);
  if (missing.length > 0) {
    if (existsSync(signalPath)) {
      writeJsonAtomic(signalPath, readinessPolicy(nowIso, missing, true, tenant));
    }
    if (options.writeReadiness !== false) {
      writeJsonAtomic(readinessPath, {
        source: READINESS_SOURCE,
        tenant,
        status: 'rejected',
        generatedAt: nowIso,
        sourceFile: `.operator/${tenant}.priority-source.json`,
        signalFile: existsSync(signalPath) ? `.operator/${tenant}.priority-signals.json` : null,
        missing,
      });
    }
    return {
      hypha: 'quests',
      op: 'priority-source',
      tenant,
      status: 'rejected',
      missing,
      sourceFile: null,
      signalFile: existsSync(signalPath) ? `.operator/${tenant}.priority-signals.json` : null,
      readinessFile: options.writeReadiness === false ? null : `.operator/${tenant}.priority-signals.readiness.json`,
    };
  }

  writeJsonAtomic(sourcePath, sourceFromCapture(input, nowIso));
  const priority = refreshPrioritySignals(ctx, tenant, options);
  return {
    hypha: 'quests',
    op: 'priority-source',
    tenant,
    status: 'captured',
    missing: [],
    sourceFile: `.operator/${tenant}.priority-source.json`,
    signalFile: priority.signalFile,
    readinessFile: priority.readinessFile,
    priority,
  };
}

export function refreshPrioritySignals(
  ctx: QuineCtx,
  tenant: string,
  options: PrioritySignalRefreshOptions = {},
): PrioritySignalRefreshResult {
  const sourcePath = prioritySourcePath(ctx, tenant);
  const signalPath = prioritySignalsPath(ctx, tenant);
  const readinessPath = priorityReadinessPath(ctx, tenant);
  const source = readJson(sourcePath) as PrioritySignalSourceDocument | undefined;
  const built = buildPrioritySignals(source, {
    ...options,
    tenant,
    existingPolicyFile: existsSync(signalPath),
  });
  const readiness = {
    source: READINESS_SOURCE,
    tenant,
    status: built.status,
    generatedAt: options.nowIso ?? new Date().toISOString(),
    sourceFile: `.operator/${tenant}.priority-source.json`,
    signalFile: built.policy ? `.operator/${tenant}.priority-signals.json` : null,
    missing: built.missing,
  };

  if (built.policy) writeJsonAtomic(signalPath, built.policy);
  if (options.writeReadiness !== false) writeJsonAtomic(readinessPath, readiness);

  return {
    hypha: 'quests',
    op: 'priority-signals',
    tenant,
    status: built.status,
    missing: built.missing,
    signalFile: built.policy ? `.operator/${tenant}.priority-signals.json` : null,
    readinessFile: options.writeReadiness === false ? null : `.operator/${tenant}.priority-signals.readiness.json`,
    ...(built.signals ? { signals: built.signals } : {}),
  };
}
