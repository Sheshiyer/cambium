import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SAPLING_GTM_TG_HANDOFF_SCHEMA,
  compileSaplingGtmTgHandoff,
  hermesGtmHandoffBoardPath,
} from './sapling-gtm-tg-handoff.ts';

test('compiles TG handoff board onto clients + agent_ops (+ alerts when clones)', () => {
  const result = compileSaplingGtmTgHandoff({
    saplingId: 'sapling:iverif',
    brandPacketRef: 'meristem/brands/iverif',
    cleanExpleeProjectId: 35674,
    meristemCampaignId: 159036,
    meristemCampaignName: 'FR CEE — Délégataires & ops (Meristem)',
    cloneIcpNames: ['Energy EPC Firms', 'Energy Consultants'],
    autopilotOff: true,
    autoReplyOff: true,
    ownedEmailStatus: 'queued_for_hermes',
    ownedEmailLiveSend: false,
    learningRulesSummary: [
      'Ban clone ICPs',
      'Prefer Meristem FR wedge',
      'Fan to wave@ + LinkedIn',
    ],
    nextProngs: ['A-explee', 'B-owned-email', 'C-linkedin'],
    workflowPhase: 'verify→learn→handoff',
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.board.schema, SAPLING_GTM_TG_HANDOFF_SCHEMA);
  assert.equal(result.board.chatId, '-1003942929819');
  assert.equal(result.board.awsSafvrIsSendIdentity, false);
  assert.equal(
    hermesGtmHandoffBoardPath('sapling:iverif'),
    '.state/sapling-iverif/tg-handoff/board.json',
  );
  const topics = result.board.cards.map((c) => c.topicKey);
  assert.ok(topics.includes('clients'));
  assert.ok(topics.includes('agent_ops'));
  assert.ok(topics.includes('alerts'));
  assert.ok(result.board.cards.every((c) => c.liveSend === false));
  assert.ok(result.board.cards.every((c) => c.text.includes('What happened:')));
  assert.ok(result.board.cards.some((c) => c.kind === 'self-learning'));
  assert.ok(result.board.cards.some((c) => c.kind === 'workflow-handoff'));
});
