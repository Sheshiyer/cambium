/**
 * Sapling multi-prong GTM loop pack — templates for every Cambium sapling.
 * Calibrated on sapling:iverif (2026-09-11). NOT live D1 writes.
 * Schema: cambium.sapling-gtm-loop-pack.v1
 */

export const SAPLING_GTM_LOOP_PACK_SCHEMA = 'cambium.sapling-gtm-loop-pack.v1' as const;

export type SaplingGtmStage =
  | 'bind-identity'
  | 'observe-learn'
  | 'clean-channel'
  | 'compose-drafts'
  | 'hermes-miniapp'
  | 'arm-spend';

export type ProbeStatus = 'pass' | 'fail' | 'held';

export interface SaplingGtmProbeContext {
  saplingId: string;
  meristemBrandDirExists?: boolean;
  productMarketingContextExists?: boolean;
  expleeCleanProjectId?: number | null;
  expleeAutopilotOff?: boolean;
  expleeAutoReplyOff?: boolean;
  brandPacketDrivesCampaignCopy?: boolean;
  autoGtmDefaultsRejected?: boolean;
  handsDraftsExist?: boolean;
  willDoNotPost?: boolean;
  actionRequestBound?: boolean;
  miniAppGateRequiredForSpend?: boolean;
  spendApproved?: boolean;
  campaignStarted?: boolean;
}

export interface SaplingGtmProbe {
  probeId: string;
  title: string;
  check: string;
  evaluate: (ctx: SaplingGtmProbeContext) => { status: ProbeStatus; evidence: string };
}

export interface SaplingGtmLoop {
  loopId: string;
  stage: SaplingGtmStage;
  title: string;
  skillCluster: string;
  hermesProfile: string;
  cambiumOrgan: string;
  telegramTopicHint: string;
  turnCap: number;
  exitRubric: string;
  oneChangeRule: string;
  antiPatterns: string[];
  probes: SaplingGtmProbe[];
}

function held(evidence: string) {
  return { status: 'held' as const, evidence };
}

export const SAPLING_GTM_LOOPS: SaplingGtmLoop[] = [
  {
    loopId: 'sapling-gtm-bind-identity',
    stage: 'bind-identity',
    title: 'BIND — sapling + brand packet',
    skillCluster: 'growth-content / meristem',
    hermesProfile: 'thoughtseed-ceo',
    cambiumOrgan: 'genesis',
    telegramTopicHint: 'clients',
    turnCap: 3,
    exitRubric: 'saplingId set; Meristem brand dir or PMC present',
    oneChangeRule: 'Bind one sapling packet; do not invent tenant.',
    antiPatterns: ['AutoGTM defaults as brief', 'cross-tenant bind'],
    probes: [
      {
        probeId: 'SGTM-BIND-1',
        title: 'Sapling id present',
        check: 'saplingId matches sapling:<slug>',
        evaluate: (ctx) =>
          /^sapling:[a-z0-9-]+$/i.test(ctx.saplingId)
            ? { status: 'pass', evidence: ctx.saplingId }
            : { status: 'fail', evidence: `saplingId=${ctx.saplingId}` },
      },
      {
        probeId: 'SGTM-BIND-2',
        title: 'Brand packet available',
        check: 'meristemBrandDirExists || productMarketingContextExists',
        evaluate: (ctx) => {
          if (ctx.meristemBrandDirExists === true || ctx.productMarketingContextExists === true) {
            return {
              status: 'pass',
              evidence: `meristem=${ctx.meristemBrandDirExists === true}; pmc=${ctx.productMarketingContextExists === true}`,
            };
          }
          return held('brand packet not confirmed');
        },
      },
    ],
  },
  {
    loopId: 'sapling-gtm-observe-learn',
    stage: 'observe-learn',
    title: 'OBSERVE — prior GTM learning, no spend',
    skillCluster: 'explee-master',
    hermesProfile: 'thoughtseed-scientist',
    cambiumOrgan: 'cortex',
    telegramTopicHint: 'clients',
    turnCap: 5,
    exitRubric: 'Learning receipt exists; polluted denominators marked historical',
    oneChangeRule: 'GET-only provider reads; no start/reply.',
    antiPatterns: ['reuse polluted project stats', 'POST to Explee'],
    probes: [
      {
        probeId: 'SGTM-OBS-1',
        title: 'AutoGTM defaults rejected as authority',
        check: 'autoGtmDefaultsRejected === true',
        evaluate: (ctx) =>
          ctx.autoGtmDefaultsRejected === true
            ? { status: 'pass', evidence: 'defaults rejected' }
            : held('defaults-reject flag unset'),
      },
    ],
  },
  {
    loopId: 'sapling-gtm-clean-channel',
    stage: 'clean-channel',
    title: 'CLEAN — Explee container hygiene',
    skillCluster: 'explee-master → explee-product-autogtm',
    hermesProfile: 'thoughtseed-engineer',
    cambiumOrgan: 'hands',
    telegramTopicHint: 'alerts',
    turnCap: 5,
    exitRubric: 'Clean project bound; autopilot/auto-reply off; campaign copy from packet',
    oneChangeRule: 'One project bind or one campaign retarget per turn.',
    antiPatterns: ['restart clone ICPs', 'arm spend here'],
    probes: [
      {
        probeId: 'SGTM-CH-1',
        title: 'Clean Explee project id known',
        check: 'expleeCleanProjectId is positive',
        evaluate: (ctx) =>
          typeof ctx.expleeCleanProjectId === 'number' && ctx.expleeCleanProjectId > 0
            ? { status: 'pass', evidence: `projectId=${ctx.expleeCleanProjectId}` }
            : held('clean project unbound'),
      },
      {
        probeId: 'SGTM-CH-2',
        title: 'Autopilot and auto-reply off',
        check: 'expleeAutopilotOff && expleeAutoReplyOff',
        evaluate: (ctx) => {
          if (ctx.expleeAutopilotOff === true && ctx.expleeAutoReplyOff === true) {
            return { status: 'pass', evidence: 'both off' };
          }
          return held(`autopilotOff=${ctx.expleeAutopilotOff}; autoReplyOff=${ctx.expleeAutoReplyOff}`);
        },
      },
      {
        probeId: 'SGTM-CH-3',
        title: 'Brand packet drives campaign copy',
        check: 'brandPacketDrivesCampaignCopy === true',
        evaluate: (ctx) =>
          ctx.brandPacketDrivesCampaignCopy === true
            ? { status: 'pass', evidence: 'packet authority' }
            : held('packet authority unset'),
      },
    ],
  },
  {
    loopId: 'sapling-gtm-compose-drafts',
    stage: 'compose-drafts',
    title: 'COMPOSE — Hands multi-prong drafts',
    skillCluster: 'marketing-campaign + growth-content',
    hermesProfile: 'thoughtseed-synthesist',
    cambiumOrgan: 'hands',
    telegramTopicHint: 'dev',
    turnCap: 8,
    exitRubric: 'Hands drafts exist; Will marked do_not_post',
    oneChangeRule: 'Draft only; no provider send.',
    antiPatterns: ['Explee-only assumption', 'fabricated proof'],
    probes: [
      {
        probeId: 'SGTM-DR-1',
        title: 'Hands drafts present',
        check: 'handsDraftsExist === true',
        evaluate: (ctx) =>
          ctx.handsDraftsExist === true ? { status: 'pass', evidence: 'drafts present' } : held('no drafts'),
      },
      {
        probeId: 'SGTM-DR-2',
        title: 'Will do_not_post',
        check: 'willDoNotPost === true',
        evaluate: (ctx) =>
          ctx.willDoNotPost === true ? { status: 'pass', evidence: 'do_not_post' } : held('will gate unset'),
      },
    ],
  },
  {
    loopId: 'sapling-gtm-hermes-miniapp',
    stage: 'hermes-miniapp',
    title: 'GATE — Hermes ActionRequest + Mini App',
    skillCluster: 'conductor / quests',
    hermesProfile: 'thoughtseed-ceo',
    cambiumOrgan: 'will',
    telegramTopicHint: 'clients',
    turnCap: 4,
    exitRubric: 'ActionRequest bound; spend paths require Mini App',
    oneChangeRule: 'One ActionRequest transition; no silent spend.',
    antiPatterns: ['callback JSON in TG', 'unsigned high-risk resolve'],
    probes: [
      {
        probeId: 'SGTM-HM-1',
        title: 'ActionRequest bound',
        check: 'actionRequestBound === true',
        evaluate: (ctx) =>
          ctx.actionRequestBound === true ? { status: 'pass', evidence: 'bound' } : held('unbound'),
      },
      {
        probeId: 'SGTM-HM-2',
        title: 'Mini App required for spend',
        check: 'miniAppGateRequiredForSpend === true',
        evaluate: (ctx) =>
          ctx.miniAppGateRequiredForSpend === true
            ? { status: 'pass', evidence: 'mini-app gate on' }
            : held('mini-app gate unset'),
      },
    ],
  },
  {
    loopId: 'sapling-gtm-arm-spend',
    stage: 'arm-spend',
    title: 'ARM — explicit spend only',
    skillCluster: 'explee-master (mutating) / owned-email',
    hermesProfile: 'thoughtseed-ceo',
    cambiumOrgan: 'will',
    telegramTopicHint: 'alerts',
    turnCap: 2,
    exitRubric: 'spendApproved before any start; foldback after',
    oneChangeRule: 'One prong arm per approval.',
    antiPatterns: ['autopilot on by default', 'start without approve'],
    probes: [
      {
        probeId: 'SGTM-ARM-1',
        title: 'No start without spend approve',
        check: 'campaignStarted implies spendApproved',
        evaluate: (ctx) => {
          if (ctx.campaignStarted === true && ctx.spendApproved !== true) {
            return { status: 'fail', evidence: 'started without spendApproved' };
          }
          if (ctx.spendApproved === true) {
            return { status: 'pass', evidence: `spendApproved; started=${ctx.campaignStarted === true}` };
          }
          return held('spend not approved yet');
        },
      },
    ],
  },
];

/** Iverif calibration snapshot for local verify (not live authority). */
export const IVERIF_GTM_LOOP_CONTEXT: SaplingGtmProbeContext = {
  saplingId: 'sapling:iverif',
  meristemBrandDirExists: true,
  productMarketingContextExists: false,
  expleeCleanProjectId: 35674,
  expleeAutopilotOff: true,
  expleeAutoReplyOff: true,
  brandPacketDrivesCampaignCopy: true,
  autoGtmDefaultsRejected: true,
  handsDraftsExist: true,
  willDoNotPost: true,
  actionRequestBound: false,
  miniAppGateRequiredForSpend: true,
  spendApproved: false,
  campaignStarted: false,
};

export function evaluateSaplingGtmLoops(ctx: SaplingGtmProbeContext) {
  return SAPLING_GTM_LOOPS.map((loop) => ({
    loopId: loop.loopId,
    stage: loop.stage,
    results: loop.probes.map((probe) => ({
      probeId: probe.probeId,
      ...probe.evaluate(ctx),
    })),
  }));
}
