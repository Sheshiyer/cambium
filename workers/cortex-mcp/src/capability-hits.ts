import { ORGAN_ATLAS } from './organ-atlas.ts';

export interface EvaluationInput {
  taskFingerprint: string;
  taskSummary: string;
  topicKey: 'hermes' | 'digests' | 'dev' | 'inbox' | 'calendar' | 'agent_ops' | 'alerts' | 'clients' | 'adytum';
  candidateCapabilityId: string;
  relevance: number;      // 0..1
  freshness: number;      // 0..1
  readiness: number;      // 0..1
  ownerMatch: number;     // 0..1
  novelty: number;        // 0..1
  evidenceQuality: number;// 0..1
}

export interface CapabilityHitResult {
  eligible: boolean;
  score: number;
  threshold: number;
  refusalReason?: string;
  card?: {
    header: string;
    task: string;
    canDoNow: string[];
    whyRelevant: string;
    next: string;
    boundary: string;
    evidence: string;
    provenance: string;
  };
}

export function evaluateCapabilityHit(input: EvaluationInput): CapabilityHitResult {
  const organ = ORGAN_ATLAS[input.candidateCapabilityId];
  if (!organ) {
    return {
      eligible: false,
      score: 0,
      threshold: 0.68,
      refusalReason: `unknown_capability: ${input.candidateCapabilityId}`,
    };
  }

  // Formula from telegram-capability-hit-system.v1.json:
  // 0.35 relevance + 0.20 freshness + 0.15 readiness + 0.15 ownerMatch + 0.10 novelty + 0.05 evidenceQuality
  const score =
    0.35 * Math.min(1, Math.max(0, input.relevance)) +
    0.20 * Math.min(1, Math.max(0, input.freshness)) +
    0.15 * Math.min(1, Math.max(0, input.readiness)) +
    0.15 * Math.min(1, Math.max(0, input.ownerMatch)) +
    0.10 * Math.min(1, Math.max(0, input.novelty)) +
    0.05 * Math.min(1, Math.max(0, input.evidenceQuality));

  const THRESHOLD = 0.68;

  if (score < THRESHOLD) {
    return {
      eligible: false,
      score: Number(score.toFixed(3)),
      threshold: THRESHOLD,
      refusalReason: 'score_below_threshold_silence_preferred',
    };
  }

  // Topic alignment check
  if (!organ.telegramTopics.includes(input.topicKey)) {
    return {
      eligible: false,
      score: Number(score.toFixed(3)),
      threshold: THRESHOLD,
      refusalReason: `topic_mismatch: organ ${organ.name} prefers [${organ.telegramTopics.join(', ')}], requested ${input.topicKey}`,
    };
  }

  return {
    eligible: true,
    score: Number(score.toFixed(3)),
    threshold: THRESHOLD,
    card: {
      header: 'CAPABILITY HIT',
      task: input.taskSummary,
      canDoNow: organ.canDo.slice(0, 3),
      whyRelevant: `Selected ${organ.name} with match score ${score.toFixed(3)} based on active evidence.`,
      next: `Bounded read or inspection via /ts-* or manual founder review.`,
      boundary: organ.boundary,
      evidence: `Observed fresh inputs; topic aligned with ${input.topicKey}.`,
      provenance: `task:${input.taskFingerprint} · organ:${organ.id} · schema:thoughtseed.telegram-capability-hit-system.v1`,
    },
  };
}
