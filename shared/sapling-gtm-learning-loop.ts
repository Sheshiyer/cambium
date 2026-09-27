/**
 * Sapling GTM continuous learning loop — pure compiler.
 * Schema: cambium.sapling-gtm-learning-loop.v1
 *
 * Feeds historical Explee learning + live clean-project posture into
 * next-campaign targeting across prongs (Explee | wave@ owned-email | LinkedIn).
 * Never mutates providers. Never arms spend.
 */

export const SAPLING_GTM_LEARNING_LOOP_SCHEMA = 'cambium.sapling-gtm-learning-loop.v1' as const;

export type CampaignLabel =
  | 'money_guzzler'
  | 'mixed_low_yield'
  | 'low_spend_low_yield'
  | 'relative_winner'
  | 'meristem_retarget'
  | 'clone_icp_ban';

export interface HistoricalCampaignLesson {
  campaignId: number;
  name: string;
  label: CampaignLabel;
  spendUsd?: number;
  sent?: number;
  replies?: number;
  replyRate?: number;
  lesson: string;
}

export interface LiveCampaignRow {
  id: number;
  name: string;
  status: string;
  language?: string | null;
  geo?: string | null;
  daily_limit_usd?: number | null;
}

export interface CompileLearningInput {
  saplingId: string;
  cleanExpleeProjectId: number;
  historicalProjectId: number;
  historicalLessons: HistoricalCampaignLesson[];
  liveCampaigns: LiveCampaignRow[];
  meristemTargetCampaignId?: number;
  brandPacketRef: string;
  ownedEmailFrom?: string;
  telegramFoldbackTopic?: string;
}

export interface TargetingRule {
  id: string;
  severity: 'ban' | 'prefer' | 'watch';
  rule: string;
  evidence: string;
}

export interface NextCampaignHypothesis {
  prong: 'A-explee' | 'B-owned-email' | 'C-linkedin';
  name: string;
  language: string;
  geo: string;
  role: string;
  offer: string;
  problem: string;
  negativeIcp: string[];
  gate: string;
}

export interface SaplingGtmLearningReceipt {
  schema: typeof SAPLING_GTM_LEARNING_LOOP_SCHEMA;
  saplingId: string;
  compiledAt: string;
  brandPacketRef: string;
  cleanExpleeProjectId: number;
  historicalProjectId: number;
  live: {
    campaignCount: number;
    meristemTargetPresent: boolean;
    meristemTargetId: number | null;
    cloneIcpNamesStillPresent: string[];
    allListening: boolean;
  };
  targetingRules: TargetingRule[];
  nextHypotheses: NextCampaignHypothesis[];
  foldback: {
    telegramTopic: string;
    cortexNote: string;
    doNotReuseHistoricalStats: true;
    spendApprovedRequired: true;
  };
}

export type CompileLearningResult =
  | { ok: true; receipt: SaplingGtmLearningReceipt }
  | { ok: false; errors: string[] };

const CLONE_NAME_RE =
  /^(Public Agencies|Energy EPC Firms|Energy Consultants|Utility Providers|Subsidy Aggregators|Energy Lenders|RGE Renovation Installers|Research Funding Councils|Grant-Making Foundations|Structural Fund Authorities|National Funding Agencies|Innovation Enterprise Agencies|Education Fund Administrators|Public Agencies South)$/i;

/** Canonical iverif lessons from CAMPAIGN-LEARNING.md (project 16763 historical). */
export const IVERIF_HISTORICAL_LESSONS: HistoricalCampaignLesson[] = [
  {
    campaignId: 45711,
    name: 'Public Agencies',
    label: 'money_guzzler',
    spendUsd: 88.02,
    sent: 2934,
    replies: 19,
    replyRate: 0.006,
    lesson: 'Broad public-agency ICP burns spend; treat as ban for v1 FR CEE wedge.',
  },
  {
    campaignId: 56316,
    name: 'Grant-Making Foundations',
    label: 'relative_winner',
    spendUsd: 8.61,
    sent: 287,
    replies: 5,
    replyRate: 0.017,
    lesson: 'Thin efficiency signal only — not proof to restart; prefer FR délégataire ops ICP instead.',
  },
  {
    campaignId: 45709,
    name: 'Energy Consultants',
    label: 'mixed_low_yield',
    spendUsd: 23.1,
    sent: 770,
    replies: 2,
    replyRate: 0.003,
    lesson: 'Clone AutoGTM ICP names underperform; do not restart as-is on clean project.',
  },
];

export function compileSaplingGtmLearning(
  input: CompileLearningInput,
  nowIso: string = new Date().toISOString(),
): CompileLearningResult {
  const errors: string[] = [];
  if (!/^sapling:[a-z0-9-]+$/i.test(input.saplingId)) {
    errors.push('saplingId must match sapling:<slug>');
  }
  if (!(input.cleanExpleeProjectId > 0)) errors.push('cleanExpleeProjectId required');
  if (!(input.historicalProjectId > 0)) errors.push('historicalProjectId required');
  if (!input.brandPacketRef?.trim()) errors.push('brandPacketRef required');
  if (input.cleanExpleeProjectId === input.historicalProjectId) {
    errors.push('cleanExpleeProjectId must differ from historicalProjectId (no stats reuse)');
  }
  if (errors.length) return { ok: false, errors };

  const live = input.liveCampaigns ?? [];
  const targetId = input.meristemTargetCampaignId ?? null;
  const meristem = targetId == null ? null : live.find((c) => c.id === targetId) ?? null;
  const clones = live.filter((c) => CLONE_NAME_RE.test(c.name) || (targetId != null && c.id !== targetId));

  const rules: TargetingRule[] = [
    {
      id: 'LR-1',
      severity: 'ban',
      rule: 'Do not restart AutoGTM clone ICPs (Public Agencies, Energy Consultants, …) on the clean project.',
      evidence: `live clones still named: ${clones.map((c) => c.name).join(', ') || 'none'}`,
    },
    {
      id: 'LR-2',
      severity: 'ban',
      rule: 'Do not reuse historical project denominators for success claims.',
      evidence: `historicalProjectId=${input.historicalProjectId}; clean=${input.cleanExpleeProjectId}`,
    },
    {
      id: 'LR-3',
      severity: 'prefer',
      rule: 'Prefer FR / France / délégataire-CEE back-office ICP from Meristem packet.',
      evidence: meristem
        ? `meristem campaign ${meristem.id} status=${meristem.status} language=${meristem.language ?? 'n/a'}`
        : 'meristem target not in live list',
    },
    {
      id: 'LR-4',
      severity: 'watch',
      rule: 'Relative winner Grant-Making Foundations is efficiency-only — do not generalize as ICP.',
      evidence: input.historicalLessons
        .filter((l) => l.label === 'relative_winner')
        .map((l) => `${l.name} ${((l.replyRate ?? 0) * 100).toFixed(2)}%`)
        .join('; ') || 'none',
    },
    {
      id: 'LR-5',
      severity: 'prefer',
      rule: 'Fan the same Meristem packet to owned-email (wave@) and LinkedIn FR — Explee is surgical, not exclusive.',
      evidence: `ownedEmailFrom=${input.ownedEmailFrom ?? 'wave@thoughtseed.space'}`,
    },
    {
      id: 'LR-6',
      severity: 'ban',
      rule: 'No spend/start/send without first-response gate + explicit Will approve.',
      evidence: 'spendApprovedRequired=true; Path A draft-only until approve',
    },
  ];

  for (const lesson of input.historicalLessons.filter((l) => l.label === 'money_guzzler')) {
    rules.push({
      id: `LR-G-${lesson.campaignId}`,
      severity: 'ban',
      rule: `Money-guzzler pattern: ${lesson.name}`,
      evidence: lesson.lesson,
    });
  }

  const negativeIcp = [
    'Homeowners or end consumers',
    'Generic public agencies outside energy-subsidy ops',
    'Markets outside France for v1',
    'AutoGTM default Public Agencies ICP',
  ];

  const hypotheses: NextCampaignHypothesis[] = [
    {
      prong: 'A-explee',
      name: 'FR CEE — Délégataires & ops (Meristem)',
      language: 'fr',
      geo: 'France',
      role: 'Operations / back-office managers in French délégataires and energy-subsidy operators',
      offer:
        'Validation documentaire IA pour dossiers CEE / Primes Énergie avant dépôt (contrôles inter-documents + piste d’audit) — iverif.fr',
      problem:
        'Les back-offices croisent 10–20 pièces par dossier; les écarts découverts trop tard coûtent cher et fragilisent l’audit.',
      negativeIcp,
      gate: 'Keep stopped until spend approve; autopilot/auto-reply OFF; UI-archive clones',
    },
    {
      prong: 'B-owned-email',
      name: 'wave@ FR CEE sequence (Will stub → Composio Zoho)',
      language: 'fr-FR',
      geo: 'France',
      role: 'Same Meristem Marie Durand archetype — personal outbound',
      offer: 'Same packet offer; owned mailbox wave@thoughtseed.space',
      problem: 'Same packet problem framing',
      negativeIcp,
      gate: 'compileOwnedEmailWillDispatch liveSend=false until Will approve',
    },
    {
      prong: 'C-linkedin',
      name: 'LinkedIn FR connection + follow-up',
      language: 'fr',
      geo: 'France',
      role: 'Délégataire / CEE ops managers',
      offer: 'Short FR demo ask from Meristem frames',
      problem: 'Late document gaps before dépôt',
      negativeIcp,
      gate: 'Drafts only from outreach-pack; no Explee write',
    },
  ];

  const receipt: SaplingGtmLearningReceipt = {
    schema: SAPLING_GTM_LEARNING_LOOP_SCHEMA,
    saplingId: input.saplingId,
    compiledAt: nowIso,
    brandPacketRef: input.brandPacketRef,
    cleanExpleeProjectId: input.cleanExpleeProjectId,
    historicalProjectId: input.historicalProjectId,
    live: {
      campaignCount: live.length,
      meristemTargetPresent: meristem != null,
      meristemTargetId: meristem?.id ?? null,
      cloneIcpNamesStillPresent: clones.map((c) => c.name),
      allListening: live.length > 0 && live.every((c) => c.status === 'listening'),
    },
    targetingRules: rules,
    nextHypotheses: hypotheses,
    foldback: {
      telegramTopic: input.telegramFoldbackTopic ?? 'clients',
      cortexNote:
        'Fold learning into next Intent: keep FR CEE Meristem wedge; archive/stop clone ICPs; fan packet to wave@ + LinkedIn; never reuse 16763 stats.',
      doNotReuseHistoricalStats: true,
      spendApprovedRequired: true,
    },
  };

  return { ok: true, receipt };
}
