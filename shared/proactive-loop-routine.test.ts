import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PROACTIVE_LOOP_PLAN_SCHEMA,
  THOUGHTSEED_CHAT_ID,
  compileProactiveLoopPlan,
} from './proactive-loop-routine.ts';

test('proactive plan is schedule-armed but never sends network or writes graph', () => {
  const plan = compileProactiveLoopPlan({
    observedAt: '2026-08-11T12:00:00.000Z',
  });
  assert.equal(plan.schema, PROACTIVE_LOOP_PLAN_SCHEMA);
  assert.equal(plan.scheduleArmed, true);
  assert.equal(plan.eventDriven, true);
  assert.equal(plan.networkSend, false);
  assert.equal(plan.writesGoalGraph, false);
  assert.equal(plan.autonomousMutation, false);
  assert.equal(plan.questAdmissionProposal.writesGoalGraph, false);
  assert.ok(plan.planDigest.startsWith('sha256:'));
  assert.equal(plan.miniApp.schema, 'cambium.proactive-loop-miniapp.v1');
  assert.equal(plan.miniApp.ladder.length, 9);
  assert.match(plan.miniApp.authorityNote, /Not D1 admission/);
});

test('held stages produce Hermes delivery intents on Thoughtseed topics', () => {
  const plan = compileProactiveLoopPlan({ observedAt: '2026-08-11T12:00:00.000Z' });
  assert.ok(plan.deliveries.length >= 1, 'expected at least one held-stage delivery');
  for (const d of plan.deliveries) {
    assert.equal(d.chatId, THOUGHTSEED_CHAT_ID);
    assert.equal(d.networkSend, false);
    assert.equal(d.writesGoalGraph, false);
    assert.ok(d.threadId > 0);
    assert.ok(d.messageText.includes('Fitcheck'));
    assert.equal(d.topicAssignment.chatId, THOUGHTSEED_CHAT_ID);
    assert.equal(d.topicAssignment.threadId, d.threadId);
  }
  // no more than one delivery per topic
  const keys = plan.deliveries.map((d) => d.topicKey);
  assert.equal(keys.length, new Set(keys).size);
});

test('external admission evidence reduces held noise without inventing TG spam on pass-only', () => {
  const cleared = compileProactiveLoopPlan({
    observedAt: '2026-08-11T12:00:00.000Z',
    evidence: {
      d1TaskReadback: true,
      loadoutPinned: true,
      hermesReceipt: true,
      foldbackProposal: true,
      missionFabricHonest: true,
    },
  });
  assert.ok(cleared.loopResults.every((r) => r.exit !== 'failed'));
  assert.ok(cleared.miniApp.passedCount >= 4);
});

test('founder operational clearance clears held stages without claiming D1 write', () => {
  const plan = compileProactiveLoopPlan({
    observedAt: '2026-08-11T12:00:00.000Z',
    evidence: { founderAuthorizedAdmission: true },
  });
  assert.equal(plan.writesGoalGraph, false);
  assert.equal(plan.networkSend, false);
  assert.equal(plan.miniApp.heldCount, 0);
  assert.equal(plan.deliveries.length, 0);
  assert.ok(plan.miniApp.passedCount >= 8);
});

test('notify cooldown suppresses repeat stage+exit+topic deliveries', () => {
  const first = compileProactiveLoopPlan({ observedAt: '2026-08-11T12:00:00.000Z' });
  assert.ok(first.deliveries.length >= 1);
  const state = {
    schema: 'cambium.proactive-loop-notify-state.v1' as const,
    tenantId: 'cambium',
    updatedAt: '2026-08-11T12:00:00.000Z',
    byKey: Object.fromEntries(
      first.deliveries.map((d) => [
        `${d.stage}:${d.exit}:${d.topicKey}`,
        { lastAt: '2026-08-11T12:00:00.000Z', deliveryId: d.deliveryId, title: d.title },
      ]),
    ),
  };
  const second = compileProactiveLoopPlan({
    observedAt: '2026-08-11T13:00:00.000Z',
    notifyState: state,
  });
  assert.equal(second.deliveries.length, 0);
  assert.ok(second.suppressedNotify.length >= 1);
});
