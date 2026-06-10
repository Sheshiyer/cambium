// Cambium operator · quests — tests for the quest fold + panel (M4 / W1).
// The core invariant under test: NO FAKE PROGRESS — empty inputs derive zero
// complete quests, and every status carries evidence derived from the inputs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUEST_LINE, questLedger } from './quests.ts';
import type { QuestInputs } from './quests.ts';
import { renderQuestLog } from './panel.ts';

/** Inputs shaped like the REAL cambium tenant after its live first session. */
function cambiumLike(): QuestInputs {
  return {
    onboarding: { stepIndex: 20, drivesActivated: [1, 4, 7, 2, 3, 5, 6, 8], noesisMoments: 3 },
    world: {
      version: 20,
      artifacts: {
        seed: 'Transforming raw ideas into autonomous, on-brand businesses.',
        positioning: 'We automate the venture creation process.',
        cta: 'Launch',
      },
      log: [
        '#2 onb-02-vision → macro · setpoint moved (evidence + gate)',
        '#3 onb-03-seed → micro · tweak applied (reversible · no setpoint move)',
        '#8 onb-08-booster → meso · reroll (no setpoint move)',
        '#9 onb-09-meet-icp → meso · reroll (no setpoint move)',
        '#15 onb-15-error-or-intent → meso · reroll (no setpoint move)',
        '#17 onb-17-viability → heartbeat · viability sweep',
      ],
    },
    cortexCount: 1,
    tenants: ['cambium', 'thoughtseed'],
    isolationSuite: false,
  };
}

test('quests · the line is seven arcs in dependency order', () => {
  assert.equal(QUEST_LINE.length, 7);
  assert.deepEqual(QUEST_LINE.map((q) => q.arc), ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);
});

test('quests · NO FAKE PROGRESS — empty inputs derive zero complete', () => {
  const L = questLedger({});
  assert.equal(L.completed, 0);
  assert.equal(L.rows[0].status, 'active');                       // the frontier is quest I
  for (const row of L.rows.slice(1)) assert.equal(row.status, 'locked');
  for (const row of L.rows) assert.ok(row.evidence.length > 0, `${row.quest.id} has evidence`);
});

test('quests · arc I completes from a real onboarding shape', () => {
  const L = questLedger({ onboarding: { stepIndex: 20, drivesActivated: [1, 2, 3, 4, 5, 6, 7, 8], noesisMoments: 3 } });
  assert.equal(L.rows[0].status, 'complete');
  assert.match(L.rows[0].evidence, /20\/20 steps · 8\/8 drives · noesis 3/);
  assert.equal(L.rows[1].status, 'active');                       // frontier advances to II
});

test('quests · arc I stays incomplete on a partial session', () => {
  const L = questLedger({ onboarding: { stepIndex: 12, drivesActivated: [1, 2, 3], noesisMoments: 1 } });
  assert.equal(L.rows[0].status, 'active');
  assert.match(L.rows[0].evidence, /12\/20 steps/);
});

test('quests · arc II requires placeholder-free artifacts', () => {
  const withPlaceholders = questLedger({
    world: { version: 6, artifacts: { seed: 'real', positioning: '<accepted, or one founder edit>', cta: '<one word>' }, log: [] },
  });
  const ii = withPlaceholders.rows[1];
  assert.notEqual(ii.status, 'complete');
  assert.match(ii.evidence, /positioning, cta unclaimed/);
});

test('quests · arc IV needs all three lanes', () => {
  const noMacro = questLedger({
    world: { version: 3, artifacts: {}, log: ['x → micro · tweak', 'y → meso · reroll'] },
  });
  const iv = noMacro.rows[3];
  assert.notEqual(iv.status, 'complete');
  assert.match(iv.evidence, /micro ×1 · meso ×1 · macro ×0/);
});

test('quests · arc VI is honest about an unreachable cortex', () => {
  const L = questLedger({});
  assert.equal(L.rows[5].evidence, 'cortex unreachable');
});

test('quests · arc VII stays open while the isolation suite is pending', () => {
  const L = questLedger(cambiumLike());
  const vii = L.rows[6];
  assert.notEqual(vii.status, 'complete');
  assert.match(vii.evidence, /2 gardens · isolation suite pending/);
});

test('quests · the real cambium shape lands on the true frontier', () => {
  const L = questLedger(cambiumLike());
  assert.equal(L.completed, 6);                                   // I..VI complete
  assert.equal(L.current?.id, 'many-gardens');                    // you are here: VII
  assert.equal(L.rows[6].status, 'active');
});

test('quests · the fold is pure — same inputs, same ledger', () => {
  const a = JSON.stringify(questLedger(cambiumLike()));
  const b = JSON.stringify(questLedger(cambiumLike()));
  assert.equal(a, b);
});

test('panel · renders marker, evidence, progress, and you-are-here', () => {
  const lines: string[] = [];
  renderQuestLog(questLedger(cambiumLike()), 'cambium', (s) => lines.push(s));
  const text = lines.join('\n');
  assert.match(text, /Quest Log · the infinite game/);
  assert.match(text, /tenant: cambium/);
  assert.match(text, /I {4}The Calling {9}✓/);
  assert.match(text, /progress {2}[█·]+ 6\/7 quests/);
  assert.match(text, /you are here → VII · Many Gardens/);
  assert.match(text, /no fake progress/);
});

test('panel · empty world renders the frontier at quest I', () => {
  const lines: string[] = [];
  renderQuestLog(questLedger({}), 'fresh', (s) => lines.push(s));
  const text = lines.join('\n');
  assert.match(text, /0\/7 quests/);
  assert.match(text, /you are here → I · The Calling/);
});
