import type { QuestLedger } from './quests.ts';

export type OperatorPolicyStatus = 'ready' | 'blocked';
export type OperatorPolicySource = 'operator-policy';

export const OPERATOR_POLICY_RULES_VERSION = 'operator-policy@v1.4';

export interface PolicyStance {
  status: string;
  label: string | null;
  dominant: string | null;
  sampleSize: number;
  minimum: number;
  gap?: string;
}

export interface PolicySkillRow {
  id: string;
  tier: string;
  tierLabel: string;
  sampleSize: number;
  gap?: string;
}

export interface PolicySkills {
  source: string;
  rows: PolicySkillRow[];
  gap?: string;
}

export interface PolicyGateItem {
  id: string;
  title: string;
  status: string;
  owner?: string;
  updatedAt?: string;
  evidence?: string;
  approveConsequence?: string;
  rerollConsequence?: string;
  reversibility?: string;
  idempotencyHint?: string;
  priority?: {
    source: string;
    risk: string;
    dependency: string;
    score?: number;
    reasons?: string[];
  };
}

export interface PolicyPrioritySignals {
  source: 'operator-priority-signals@v1';
  founderPreference: {
    targetId: string;
    weight: number;
    proof: string;
  };
  ownerLoad: {
    owner: string;
    openItems: number;
    capacity: number;
    proof: string;
  };
  economicRisk: {
    amount: number;
    currency: string;
    risk: 'low' | 'medium' | 'high' | 'critical';
    proof: string;
  };
  teamAvailability: {
    available: number;
    required: number;
    proof: string;
  };
  memberRevocation: {
    revoked: boolean;
    proof: string;
  };
  crossTenantUrgency: {
    score: number;
    tenants: number;
    proof: string;
  };
}

export interface OperatorPolicyEnvelope {
  source: OperatorPolicySource;
  status: OperatorPolicyStatus;
  action: string | null;
  title: string;
  detail: string;
  blockers: string[];
  cautions: string[];
  requiredSignals: string[];
  rulesVersion: typeof OPERATOR_POLICY_RULES_VERSION;
  gap?: string;
}

export interface OperatorPolicyInput {
  ledger: QuestLedger;
  stance: PolicyStance;
  skills: PolicySkills;
  gateItems?: PolicyGateItem[];
  prioritySignals?: PolicyPrioritySignals;
}

const requiredSignals = [
  'active quest frontier',
  'tenant stance sample',
  'skill registry tier',
] as const;

const gateRequiredSignals = [
  'gate item evidence',
  'gate consequences',
  'gate idempotency',
  'gate queue priority',
  'gate risk signal',
  'gate dependency signal',
] as const;

const priorityRequiredSignals = [
  'founder preference signal',
  'owner capacity signal',
  'economic amount/currency risk',
  'team availability signal',
  'member revocation signal',
  'cross-tenant urgency score',
] as const;

function rankedSkills(skills: PolicySkills): PolicySkillRow[] {
  const rank = (tier: string): number => tier === 'production' ? 2 : tier === 'reliable' ? 1 : 0;
  return [...skills.rows]
    .filter((skill) => rank(skill.tier) > 0)
    .sort((a, b) => rank(b.tier) - rank(a.tier) || b.sampleSize - a.sampleSize || a.id.localeCompare(b.id));
}

function gateItemReady(item: PolicyGateItem): boolean {
  return Boolean(
    item.id &&
    item.title &&
    item.evidence &&
    item.approveConsequence &&
    item.rerollConsequence &&
    item.reversibility &&
    item.idempotencyHint &&
    item.priority?.source &&
    item.priority.risk &&
    item.priority.dependency
  );
}

function gateStatusRank(status: string): { rank: number; band: string } {
  const normalized = status.toLowerCase().replace(/[\s_-]+/g, '-');
  if (/(blocked|stuck|needs-founder|needs-review)/.test(normalized)) return { rank: 4, band: 'blocked' };
  if (/(pending|waiting|review|approval|requested)/.test(normalized)) return { rank: 3, band: 'waiting' };
  if (/(open|active|in-progress|todo|doing)/.test(normalized)) return { rank: 2, band: 'open' };
  return { rank: 1, band: 'unranked' };
}

function gateTimestamp(item: PolicyGateItem): number {
  const raw = item.updatedAt || item.idempotencyHint || item.evidence || '';
  const iso = raw.match(/\d{4}-\d{2}-\d{2}T[0-9:.]+Z?/);
  const parsed = Date.parse(iso?.[0] ?? raw);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function gateRiskRank(risk: string | undefined): number {
  const normalized = String(risk ?? '').toLowerCase();
  if (normalized === 'critical') return 4;
  if (normalized === 'high') return 3;
  if (normalized === 'medium') return 2;
  if (normalized === 'low') return 1;
  return 0;
}

function gateDependencyRank(dependency: string | undefined): number {
  const normalized = String(dependency ?? '').toLowerCase();
  if (normalized === 'blocks-delivery') return 2;
  if (normalized === 'blocked-by-external') return 1;
  return 0;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function prioritySignalBlockers(signals: PolicyPrioritySignals | undefined): string[] {
  if (!signals) return [];
  const blockers: string[] = [];
  if (signals.source !== 'operator-priority-signals@v1') blockers.push('priority signals source must be operator-priority-signals@v1');
  if (!signals.founderPreference?.targetId || !finiteNumber(signals.founderPreference.weight) || !signals.founderPreference.proof) {
    blockers.push('founder preference signal missing target, weight, or proof');
  }
  if (!signals.ownerLoad?.owner || !finiteNumber(signals.ownerLoad.openItems) || !finiteNumber(signals.ownerLoad.capacity) || !signals.ownerLoad.proof) {
    blockers.push('owner capacity signal missing owner, open item count, capacity, or proof');
  }
  if (!finiteNumber(signals.economicRisk?.amount) || !signals.economicRisk?.currency || !signals.economicRisk?.risk || !signals.economicRisk.proof) {
    blockers.push('economic risk signal missing amount, currency, risk, or proof');
  }
  if (!finiteNumber(signals.teamAvailability?.available) || !finiteNumber(signals.teamAvailability?.required) || !signals.teamAvailability?.proof) {
    blockers.push('team availability signal missing available count, required count, or proof');
  }
  if (typeof signals.memberRevocation?.revoked !== 'boolean' || !signals.memberRevocation.proof) {
    blockers.push('member revocation signal missing boolean state or proof');
  } else if (signals.memberRevocation.revoked) {
    blockers.push('member revocation is active; review access before recommending work');
  }
  if (!finiteNumber(signals.crossTenantUrgency?.score) || !finiteNumber(signals.crossTenantUrgency?.tenants) || !signals.crossTenantUrgency?.proof) {
    blockers.push('cross-tenant urgency signal missing score, tenant count, or proof');
  }
  return blockers;
}

function prioritySignalsReady(signals: PolicyPrioritySignals | undefined): signals is PolicyPrioritySignals {
  return !!signals && prioritySignalBlockers(signals).length === 0;
}

function prioritySignalRank(item: PolicyGateItem, signals: PolicyPrioritySignals | undefined): number {
  if (!prioritySignalsReady(signals)) return 0;
  const founder = item.id === signals.founderPreference.targetId ? signals.founderPreference.weight : 0;
  const ownerOverCapacity = item.owner && item.owner === signals.ownerLoad.owner && signals.ownerLoad.openItems >= signals.ownerLoad.capacity
    ? 2
    : 0;
  const economic = gateRiskRank(signals.economicRisk.risk);
  const availability = signals.teamAvailability.available < signals.teamAvailability.required ? 2 : 0;
  const urgency = Math.max(0, Math.min(5, signals.crossTenantUrgency.score));
  return founder + ownerOverCapacity + economic + availability + urgency;
}

function prioritySignalCautions(signals: PolicyPrioritySignals | undefined): string[] {
  if (!prioritySignalsReady(signals)) return [];
  const cautions = [
    `priority signals served: founder preference ${signals.founderPreference.targetId}, economic ${signals.economicRisk.risk} ${signals.economicRisk.currency} ${signals.economicRisk.amount}`,
  ];
  if (signals.teamAvailability.available < signals.teamAvailability.required) {
    cautions.push(`team availability below required capacity: ${signals.teamAvailability.available}/${signals.teamAvailability.required}`);
  }
  if (signals.ownerLoad.openItems >= signals.ownerLoad.capacity) {
    cautions.push(`owner load at or above capacity: ${signals.ownerLoad.owner} ${signals.ownerLoad.openItems}/${signals.ownerLoad.capacity}`);
  }
  return cautions;
}

function gatePriority(item: PolicyGateItem, signals?: PolicyPrioritySignals): {
  item: PolicyGateItem;
  rank: number;
  band: string;
  riskRank: number;
  dependencyRank: number;
  signalRank: number;
  timestamp: number;
} {
  const status = gateStatusRank(item.status);
  return {
    item,
    ...status,
    riskRank: gateRiskRank(item.priority?.risk),
    dependencyRank: gateDependencyRank(item.priority?.dependency),
    signalRank: prioritySignalRank(item, signals),
    timestamp: gateTimestamp(item),
  };
}

function rankedGateItems(items: PolicyGateItem[], signals?: PolicyPrioritySignals): ReturnType<typeof gatePriority>[] {
  return items
    .filter(gateItemReady)
    .map((item) => gatePriority(item, signals))
    .sort((a, b) =>
      b.rank - a.rank ||
      b.signalRank - a.signalRank ||
      b.dependencyRank - a.dependencyRank ||
      b.riskRank - a.riskRank ||
      a.timestamp - b.timestamp ||
      a.item.id.localeCompare(b.item.id)
    );
}

export function evaluateOperatorPolicy(input: OperatorPolicyInput): OperatorPolicyEnvelope {
  const blockers: string[] = [];
  const priorityBlockers = prioritySignalBlockers(input.prioritySignals);
  const gateItems = input.gateItems ?? [];
  const malformedGateItem = gateItems.find((item) => !gateItemReady(item));
  const prioritizedGateItems = malformedGateItem || priorityBlockers.length > 0
    ? []
    : rankedGateItems(gateItems, input.prioritySignals);
  const priority = prioritizedGateItems[0];
  if (priority) {
    const gateItem = priority.item;
    const rankedDetail = gateItems.length > 1 ? ` · ${gateItems.length} gate items ranked` : '';
    const riskDetail = gateItem.priority
      ? ` · ${gateItem.priority.risk} risk · ${gateItem.priority.dependency} dependency`
      : '';
    const signalDetail = input.prioritySignals ? ` · priority signals ${priority.signalRank}` : '';
    return {
      source: 'operator-policy',
      status: 'ready',
      action: `Review gate item ${gateItem.id}: ${gateItem.title}`,
      title: 'NEXT ACTION',
      detail: `${gateItem.id} · ${gateItem.status} · ${priority.band} queue priority${riskDetail}${signalDetail}${rankedDetail}`,
      blockers: [],
      cautions: ['founder must still choose approve or reroll inside the signed Gate flow', ...prioritySignalCautions(input.prioritySignals)],
      requiredSignals: input.prioritySignals ? [...gateRequiredSignals, ...priorityRequiredSignals] : [...gateRequiredSignals],
      rulesVersion: OPERATOR_POLICY_RULES_VERSION,
    };
  }
  if (malformedGateItem) {
    blockers.push(`gate item ${malformedGateItem.id || 'unknown'} missing evidence, consequences, reversibility, idempotency, risk, or dependency`);
  }
  blockers.push(...priorityBlockers);

  const current = input.ledger.current;
  if (!current) blockers.push('quest frontier missing; all arcs may be complete');

  if (input.stance.status !== 'ready') {
    blockers.push(input.stance.gap ?? 'tenant stance signal is insufficient');
  }

  const readySkills = input.skills.source === 'skill-registry'
    ? rankedSkills(input.skills)
    : [];
  if (input.skills.source !== 'skill-registry') {
    blockers.push(input.skills.gap ?? 'skill registry missing');
  } else if (readySkills.length === 0) {
    blockers.push('no reliable or production skill tier available for routing');
  }

  if (blockers.length > 0) {
    return {
      source: 'operator-policy',
      status: 'blocked',
      action: null,
      title: 'POLICY GAP',
      detail: 'recommendation policy blocked',
      blockers,
      cautions: [],
      requiredSignals: malformedGateItem || priorityBlockers.length > 0
        ? [...gateRequiredSignals, ...(input.prioritySignals ? [...priorityRequiredSignals] : [])]
        : [...requiredSignals],
      rulesVersion: OPERATOR_POLICY_RULES_VERSION,
      gap: blockers[0],
    };
  }

  const skill = readySkills[0];
  const stanceLabel = input.stance.label ?? 'BALANCED';
  const frontier = `${current!.arc} · ${current!.title}`;
  const action = `Advance ${frontier} through ${stanceLabel} using ${skill.id}`;
  const cautions = skill.tier === 'reliable'
    ? ['production promotion still requires founder approval policy']
    : [];

  return {
    source: 'operator-policy',
    status: 'ready',
    action,
    title: 'NEXT ACTION',
    detail: `${frontier} · ${skill.tierLabel} skill · ${stanceLabel}`,
    blockers: [],
    cautions,
    requiredSignals: [...requiredSignals],
    rulesVersion: OPERATOR_POLICY_RULES_VERSION,
  };
}
