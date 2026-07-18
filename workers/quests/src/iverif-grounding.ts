export type IVerifClaimStatus = 'hypothesis' | 'blocked' | 'verified';

export interface IVerifClaim {
  id: string;
  category: string;
  statement: string;
  status: IVerifClaimStatus;
  reason: string;
  sourcePaths: readonly string[];
}

const IVERIF_SOURCE_ROOT = 'iverif/wiki-output';

export const IVERIF_GROUNDING = {
  schema: 'cambium.iverif-grounding.v1',
  snapshot: {
    version: '2026-07-16',
    digestAlgorithm: 'sha256',
    digest: '61eb4fc915b4b50b73a1ac7eeee7d425abf8f4f55d332089933d230993fa113e',
    digestInput: 'newline-delimited "<portable source path> <sha256>" records in listed order',
    sourceRoot: IVERIF_SOURCE_ROOT,
    sources: [
      {
        path: `${IVERIF_SOURCE_ROOT}/audience/primary-persona.md`,
        digest: 'adb770a4305efbbc233466cdc75e9fe2ed645295bbc663d4fa63058694391b86',
        sourceEvidence: 'frontmatter source list is empty',
      },
      {
        path: `${IVERIF_SOURCE_ROOT}/audience/secondary-personas.md`,
        digest: '771e5792573207f969bed377c8f9773bbef7fb318477c693790491f8822de692',
        sourceEvidence: 'frontmatter source list is empty',
      },
      {
        path: `${IVERIF_SOURCE_ROOT}/product/overview.md`,
        digest: '75bbdf012a8b2c8b388143290c1a1dcbc5978c58cd81103fb04fcc41f257048e',
        sourceEvidence: 'frontmatter source list is empty',
      },
      {
        path: `${IVERIF_SOURCE_ROOT}/product/features.md`,
        digest: 'e4f53c87257bd7c90ff02fd7f2d2fe29b9141caf925c8daad78afbbdc4cfcfd9',
        sourceEvidence: 'frontmatter source list is empty',
      },
      {
        path: `${IVERIF_SOURCE_ROOT}/brand/voice-tone.md`,
        digest: 'ebf0866099b50c4b5aae71b631614bd0a7ca8d21eaa576b1402b673b7b987a84',
        sourceEvidence: 'frontmatter source list is empty',
      },
      {
        path: `${IVERIF_SOURCE_ROOT}/marketing/campaign-copy.md`,
        digest: 'b82836cdee117b866c4acefeff6e28c2b2492cce97d988156ac019e3a337fc52',
        sourceEvidence: 'frontmatter source list is empty',
      },
      {
        path: `${IVERIF_SOURCE_ROOT}/marketing/email-templates.md`,
        digest: '8ea620c7a99901a2e1381b2676556b87c7c7d01efc8befd591cbff7d11eca4ce',
        sourceEvidence: 'page reports no source outputs were available',
      },
    ],
  },
  binding: {
    productId: 'iverif',
    cambiumBranch: 'iverif',
    expleeProjectId: 16_763,
    expleeCampaignId: 45_711,
    telegramTopic: 'clients',
    telegramThreadId: '804',
  },
  policy: {
    promotionState: 'proof-only',
    providerMode: 'observe-only',
    allowedProviderMethods: ['GET'],
    providerMutationEnabled: false,
    outreachDispatchEnabled: false,
    sendEligible: false,
    liveCampaignDrift: true,
    oneWriterState: 'unproven',
    reason: 'Live campaign activity exists while product promotion and customer contact remain blocked.',
  },
  audience: {
    campaign: 'Public Agencies',
    persona: 'Regulatory Auditor / Programme Administrator',
    sourceStatus: 'hypothesis',
    problemFrame: 'Manual dossier exceptions and the evidence trail used to defend review decisions.',
    discoveryCta: 'Route me to whoever reviews manual dossier exceptions and their supporting evidence trail.',
  },
  baseline: {
    observedAt: '2026-07-16',
    source: 'direct Explee read observation',
    sends: 2_921,
    replies: 17,
    replyRatePercent: 0.6,
    hotLeads: 6,
    spendUsdCents: 8_763,
    poolUsed: 2_779,
    poolTotal: 2_887,
    classifiedReplies: 0,
    classificationRequired: 17,
  },
  claims: [
    {
      id: 'manual-exception-review-pain',
      category: 'discovery',
      statement: 'Public-agency reviewers have a material manual-exception and review-trail problem.',
      status: 'hypothesis',
      reason: 'The wiki describes dossier and audit pressure, but its source list is empty.',
      sourcePaths: [`${IVERIF_SOURCE_ROOT}/audience/secondary-personas.md`],
    },
    {
      id: 'defensible-review-trail-resonance',
      category: 'discovery',
      statement: 'Defensible review-trail framing will produce more qualified replies than rejection framing.',
      status: 'hypothesis',
      reason: 'This is the single campaign variable to test, not an established product outcome.',
      sourcePaths: [
        `${IVERIF_SOURCE_ROOT}/audience/secondary-personas.md`,
        `${IVERIF_SOURCE_ROOT}/product/features.md`,
        `${IVERIF_SOURCE_ROOT}/brand/voice-tone.md`,
      ],
    },
    {
      id: 'performance-claims',
      category: 'performance',
      statement: 'Error reduction, processing speed, accuracy, uptime, and API latency claims.',
      status: 'blocked',
      reason: 'No direct benchmark or production evidence is linked.',
      sourcePaths: [
        `${IVERIF_SOURCE_ROOT}/product/overview.md`,
        `${IVERIF_SOURCE_ROOT}/product/features.md`,
      ],
    },
    {
      id: 'certification-claims',
      category: 'certification',
      statement: 'GDPR, ISO, SOC, SAML/SSO, residency, security, or accreditation claims.',
      status: 'blocked',
      reason: 'No certification or control evidence is linked.',
      sourcePaths: [`${IVERIF_SOURCE_ROOT}/product/features.md`],
    },
    {
      id: 'customer-proof-claims',
      category: 'customer-proof',
      statement: 'Implementation by leading operators or regulatory bodies and resulting outcomes.',
      status: 'blocked',
      reason: 'The campaign copy provides no customer identity, receipt, or source.',
      sourcePaths: [`${IVERIF_SOURCE_ROOT}/marketing/campaign-copy.md`],
    },
    {
      id: 'programme-support-claims',
      category: 'programme',
      statement: 'CEE, BEG, ECO4, or other programme rules are fully supported.',
      status: 'blocked',
      reason: 'No rule corpus, test receipt, or operator validation is linked.',
      sourcePaths: [`${IVERIF_SOURCE_ROOT}/product/features.md`],
    },
    {
      id: 'onboarding-claims',
      category: 'onboarding',
      statement: 'Operators process real dossiers within one week.',
      status: 'blocked',
      reason: 'No implementation record or dated onboarding evidence is linked.',
      sourcePaths: [
        `${IVERIF_SOURCE_ROOT}/product/overview.md`,
        `${IVERIF_SOURCE_ROOT}/marketing/campaign-copy.md`,
      ],
    },
    {
      id: 'market-statistic-claims',
      category: 'market-statistic',
      statement: 'Dossier volumes, rejection rates, backlog duration, and market-wide operating metrics.',
      status: 'blocked',
      reason: 'Persona figures are unsourced and cannot be represented as market facts.',
      sourcePaths: [`${IVERIF_SOURCE_ROOT}/audience/primary-persona.md`],
    },
    {
      id: 'superlative-claims',
      category: 'superlative',
      statement: 'Only, leading, complete, audit-ready, or catches-everything positioning.',
      status: 'blocked',
      reason: 'No comparative or completeness proof is linked.',
      sourcePaths: [
        `${IVERIF_SOURCE_ROOT}/product/overview.md`,
        `${IVERIF_SOURCE_ROOT}/marketing/campaign-copy.md`,
      ],
    },
    {
      id: 'compliance-guarantee-claims',
      category: 'compliance-guarantee',
      statement: 'Validation ensures compliance, passes audits, or guarantees regulatory acceptance.',
      status: 'blocked',
      reason: 'No legal, regulatory, product, or customer evidence supports a guarantee.',
      sourcePaths: [
        `${IVERIF_SOURCE_ROOT}/product/overview.md`,
        `${IVERIF_SOURCE_ROOT}/marketing/campaign-copy.md`,
      ],
    },
  ] satisfies readonly IVerifClaim[],
  experiment: {
    id: 'iverif-public-agencies-review-trail-v1',
    variableCount: 1,
    variable: 'discovery-framing',
    control: 'Operator workload and dossier-rejection framing.',
    treatment: 'Manual exception review and defensible review-trail discovery framing.',
    hypothesis: 'The treatment increases classified qualified replies without introducing a product claim.',
    primaryMetric: 'classified qualified reply rate',
    guardrailMetrics: ['negative reply rate', 'unsupported-claim incidence', 'routing accuracy'],
    prerequisites: [
      'Classify all 17 existing replies before declaring a baseline or winner.',
      'Prove one-writer ownership and reconcile live auto-reply state.',
      'Obtain operator approval before any campaign change or dispatch.',
    ],
    observationThreshold: {
      minimumTreatmentSends: 100,
      minimumDays: 7,
      winnerRequires: 'Both thresholds and complete reply classification; no winner is declared by reply rate alone.',
    },
    stopConditions: [
      'Any treatment message contains a blocked product claim.',
      'Any privacy, consent, routing, or recipient-scope concern is reported.',
      'Provider ownership or auto-reply state becomes ambiguous.',
      'Reply classification is incomplete at the observation threshold.',
    ],
  },
} as const;

export function getIVerifClaimsByStatus(status: IVerifClaimStatus): readonly IVerifClaim[] {
  return IVERIF_GROUNDING.claims.filter((claim) => claim.status === status);
}
