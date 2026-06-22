// Cambium operator · skills — founder-approved production promotion.
// Pure readiness logic shared by the visual envelope and the operator consumer, so
// "FOUNDER REVIEW" and "apply this decision" cannot drift apart.

import type { SkillRecord } from './forge.ts';
import { DECLINE_MIN_USES, DECLINE_WINDOW, isDeclining, recentRate, successRate } from './telemetry.ts';

export const SKILL_PRODUCTION_RATE = 0.8;

export interface SkillProductionReadiness {
  ready: boolean;
  reason: string;
  uses: number;
  lifetimeRate: number;
  recentRate: number;
  recentWindow: number;
  requiredUses: number;
  requiredRate: number;
}

export function skillProductionTelemetry(skill: SkillRecord): SkillProductionReadiness {
  const lifetimeRate = successRate(skill);
  const recent = recentRate(skill);
  const common = {
    uses: skill.telemetry.uses,
    lifetimeRate,
    recentRate: recent.rate,
    recentWindow: recent.n,
    requiredUses: DECLINE_WINDOW,
    requiredRate: SKILL_PRODUCTION_RATE,
  };
  if (skill.telemetry.uses < DECLINE_WINDOW) {
    return { ...common, ready: false, reason: `need ${DECLINE_WINDOW} uses; found ${skill.telemetry.uses}` };
  }
  if (recent.n < DECLINE_MIN_USES) {
    return { ...common, ready: false, reason: `need ${DECLINE_MIN_USES} recent uses; found ${recent.n}` };
  }
  if (isDeclining(skill)) {
    return { ...common, ready: false, reason: `recent success ${Math.round(recent.rate * 100)}% is declining` };
  }
  if (lifetimeRate < SKILL_PRODUCTION_RATE) {
    return { ...common, ready: false, reason: `lifetime success ${Math.round(lifetimeRate * 100)}% below ${Math.round(SKILL_PRODUCTION_RATE * 100)}%` };
  }
  if (recent.rate < SKILL_PRODUCTION_RATE) {
    return { ...common, ready: false, reason: `recent success ${Math.round(recent.rate * 100)}% below ${Math.round(SKILL_PRODUCTION_RATE * 100)}%` };
  }
  return { ...common, ready: true, reason: 'production-grade telemetry' };
}

export function hasProductionGradeTelemetry(skill: SkillRecord): boolean {
  return skillProductionTelemetry(skill).ready;
}

export function skillProductionReadiness(skill: SkillRecord): SkillProductionReadiness {
  const telemetry = skillProductionTelemetry(skill);
  if (skill.status !== 'validated') {
    return { ...telemetry, ready: false, reason: `status ${skill.status} is not validated` };
  }
  return telemetry;
}
