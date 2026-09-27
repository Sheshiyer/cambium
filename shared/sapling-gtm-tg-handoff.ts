/**
 * Sapling GTM Telegram handoff board — pure compiler.
 * Schema: cambium.sapling-gtm-tg-handoff.v1
 *
 * TG topics are the message handoff board between workflows and the
 * self-learning surface. Hermes owns Bot API transport (message_thread_id).
 * This module never calls Telegram itself.
 */

export const SAPLING_GTM_TG_HANDOFF_SCHEMA = 'cambium.sapling-gtm-tg-handoff.v1' as const;

export const GTM_TG_TOPICS = {
  clients: { topicKey: 'clients', topicName: 'Clients', threadId: 9, questId: 'the-handoff' },
  agent_ops: { topicKey: 'agent_ops', topicName: 'Agent Ops', threadId: 7, questId: 'living-org' },
  alerts: { topicKey: 'alerts', topicName: 'Alerts', threadId: 8, questId: 'the-ship-gate' },
  dev: { topicKey: 'dev', topicName: 'Dev', threadId: 4, questId: 'the-build' },
  hermes: { topicKey: 'hermes', topicName: 'Hermes', threadId: 2, questId: 'the-gate' },
} as const;

export type GtmTgTopicKey = keyof typeof GTM_TG_TOPICS;

export type HandoffCardKind =
  | 'workflow-handoff'
  | 'self-learning'
  | 'delivery-activity'
  | 'hygiene-alert';

export interface GtmTgHandoffCard {
  cardId: string;
  kind: HandoffCardKind;
  topicKey: GtmTgTopicKey;
  threadId: number;
  topicName: string;
  questId: string;
  /** Plain-text Telegram body (no parse_mode). */
  text: string;
  liveSend: false;
  transport: 'hermes-bot-api';
}

export interface CompileGtmTgHandoffInput {
  saplingId: string;
  brandPacketRef: string;
  cleanExpleeProjectId: number;
  meristemCampaignId: number;
  meristemCampaignName: string;
  cloneIcpNames: string[];
  autopilotOff: boolean;
  autoReplyOff: boolean;
  ownedEmailStatus: string;
  ownedEmailLiveSend: boolean;
  learningRulesSummary: string[];
  nextProngs: string[];
  workflowPhase?: string;
}

export interface GtmTgHandoffBoard {
  schema: typeof SAPLING_GTM_TG_HANDOFF_SCHEMA;
  saplingId: string;
  compiledAt: string;
  chatId: '-1003942929819';
  role: 'workflow-handoff-and-self-learning-board';
  hermesTransport: 'Bot API sendMessage + message_thread_id on EC2';
  awsSafvrIsSendIdentity: false;
  cards: GtmTgHandoffCard[];
  consumePath: string;
}

export type CompileHandoffResult =
  | { ok: true; board: GtmTgHandoffBoard }
  | { ok: false; errors: string[] };

function cardText(sections: {
  headline: string;
  whatHappened: string;
  why: string;
  route: string;
  status: string;
  proof: string;
  next?: string;
}): string {
  const lines = [
    sections.headline,
    '',
    `What happened: ${sections.whatHappened}`,
    `Why surfacing: ${sections.why}`,
    `Route: ${sections.route}`,
    `Status: ${sections.status}`,
    `Proof boundary: ${sections.proof}`,
  ];
  if (sections.next) lines.push(`NEXT: ${sections.next}`);
  return lines.join('\n');
}

function topicCard(
  kind: HandoffCardKind,
  topicKey: GtmTgTopicKey,
  cardId: string,
  text: string,
): GtmTgHandoffCard {
  const t = GTM_TG_TOPICS[topicKey];
  return {
    cardId,
    kind,
    topicKey,
    threadId: t.threadId,
    topicName: t.topicName,
    questId: t.questId,
    text,
    liveSend: false,
    transport: 'hermes-bot-api',
  };
}

export function hermesGtmHandoffBoardPath(saplingId: string): string {
  const slug = saplingId.replace(/^sapling:/i, '').toLowerCase();
  return `.state/sapling-${slug}/tg-handoff/board.json`;
}

export function compileSaplingGtmTgHandoff(
  input: CompileGtmTgHandoffInput,
  nowIso: string = new Date().toISOString(),
): CompileHandoffResult {
  const errors: string[] = [];
  if (!/^sapling:[a-z0-9-]+$/i.test(input.saplingId)) {
    errors.push('saplingId must match sapling:<slug>');
  }
  if (!(input.cleanExpleeProjectId > 0)) errors.push('cleanExpleeProjectId required');
  if (errors.length) return { ok: false, errors };

  const phase = input.workflowPhase ?? 'observe-learn→compose→gate';
  const clones = input.cloneIcpNames.length
    ? input.cloneIcpNames.join(', ')
    : 'none';
  const rules = input.learningRulesSummary.slice(0, 5).map((r, i) => `${i + 1}. ${r}`).join(' | ')
    || 'prefer Meristem FR wedge; ban clone ICPs';

  const clientsHandoff = topicCard(
    'workflow-handoff',
    'clients',
    'gtm-handoff-clients',
    cardText({
      headline: `GTM handoff · ${input.saplingId}`,
      whatHappened:
        `Multi-prong pipeline active. Explee clean project ${input.cleanExpleeProjectId}; Meristem wedge campaign ${input.meristemCampaignId} (${input.meristemCampaignName}). Owned-email Will stub status=${input.ownedEmailStatus} liveSend=${input.ownedEmailLiveSend}.`,
      why: 'Clients topic is the primary delivery + workflow message board (quest the-handoff). Workflows hand off here via Hermes.',
      route: `TG clients:9 → Hermes → Cambium organs → prongs ${input.nextProngs.join(' | ') || 'A/B/C'}`,
      status: `phase=${phase}; autopilotOff=${input.autopilotOff}; autoReplyOff=${input.autoReplyOff}; spend=held`,
      proof: `brand=${input.brandPacketRef}; no silent spend; safvr is admin CLI only`,
      next: 'Review learning card on Agent Ops; archive clone ICPs; arm only after explicit approve',
    }),
  );

  const learningCard = topicCard(
    'self-learning',
    'agent_ops',
    'gtm-learning-agent-ops',
    cardText({
      headline: `Cortex learning · ${input.saplingId}`,
      whatHappened: `Continuous learning receipt compiled from historical Explee + live GET. Rules: ${rules}`,
      why: 'Agent Ops is the self-learning / living-org board. Foldback informs next Intent without reusing polluted stats.',
      route: 'Cortex learning → TG agent_ops:7 → next Hands compose from Meristem packet',
      status: 'learning-receipt-ready; do_not_reuse_historical_stats=true',
      proof: 'shared/sapling-gtm-learning-loop.ts + CONTINUOUS-LEARNING-RECEIPT.json',
      next: 'Keep FR CEE Meristem wedge; fan packet to wave@ + LinkedIn; ban Public Agencies pattern',
    }),
  );

  const activityCard = topicCard(
    'delivery-activity',
    'clients',
    'gtm-activity-clients',
    cardText({
      headline: `GTM activity lit · ${input.saplingId}`,
      whatHappened:
        `Delivery surfaces lit for handoff: Explee ${input.meristemCampaignId} (stopped/held), owned-email wave@ stub queued path, LinkedIn FR drafts from packet.`,
      why: 'Activity on this board is the operator-visible pulse between Bind/Route/Verify workflows and Will gates.',
      route: 'Hands drafts → Will first-response (TG|MiniApp|FIFO) → optional arm → foldback here',
      status: 'activity=lit; live_outbound=false',
      proof: 'owned-email-will-adapter liveSend=false; Explee Path A until spend approve',
      next: '/ts-status or approve Will when ready to arm one prong',
    }),
  );

  const cards: GtmTgHandoffCard[] = [clientsHandoff, learningCard, activityCard];

  if (input.cloneIcpNames.length > 0) {
    cards.push(
      topicCard(
        'hygiene-alert',
        'alerts',
        'gtm-hygiene-alerts',
        cardText({
          headline: `Explee hygiene · ${input.saplingId}`,
          whatHappened: `Clone ICP names still present on project ${input.cleanExpleeProjectId}: ${clones}`,
          why: 'Learning ban: do not restart AutoGTM clones. UI-archive for clean denominators.',
          route: 'alerts:8 · the-ship-gate',
          status: 'hygiene-open; spend-held',
          proof: 'live-get-35674-dryrun.json + learning LR-1',
          next: 'UI-archive clones; leave Meristem FR CEE stopped until spend approve',
        }),
      ),
    );
  }

  const board: GtmTgHandoffBoard = {
    schema: SAPLING_GTM_TG_HANDOFF_SCHEMA,
    saplingId: input.saplingId,
    compiledAt: nowIso,
    chatId: '-1003942929819',
    role: 'workflow-handoff-and-self-learning-board',
    hermesTransport: 'Bot API sendMessage + message_thread_id on EC2',
    awsSafvrIsSendIdentity: false,
    cards,
    consumePath: hermesGtmHandoffBoardPath(input.saplingId),
  };

  return { ok: true, board };
}
