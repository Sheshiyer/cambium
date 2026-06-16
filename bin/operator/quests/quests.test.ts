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

test('quests · the line is seventeen arcs in dependency order (M5 Phase Q adds VIII–IX; Bridge adds X–XVII)', () => {
  assert.equal(QUEST_LINE.length, 17);
  assert.deepEqual(
    QUEST_LINE.map((q) => q.arc),
    ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII']
  );
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
  assert.equal(L.rows[7].status, 'locked');                       // VIII locked until multica feeds
  assert.equal(L.rows[8].status, 'locked');                       // IX locked until VIII opens
  assert.equal(L.rows[9].status, 'locked');                       // X locked
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
  assert.match(text, /progress {2}[█·]+ 6\/17 quests/);
  assert.match(text, /you are here → VII · Many Gardens/);
  assert.match(text, /no fake progress/);
});

test('panel · empty world renders the frontier at quest I', () => {
  const lines: string[] = [];
  renderQuestLog(questLedger({}), 'fresh', (s) => lines.push(s));
  const text = lines.join('\n');
  assert.match(text, /0\/17 quests/);
  assert.match(text, /you are here → I · The Calling/);
});

test('quests · arc VIII is honest when MultiCA is unreachable', () => {
  const L = questLedger(cambiumLike());
  assert.equal(L.rows[7].status, 'locked');
  assert.match(L.rows[7].evidence, /MultiCA gateway unreachable/);
});

test('quests · arc VIII completes from real MultiCA activity', () => {
  const L = questLedger({ ...cambiumLike(), isolationSuite: true, multica: { reachable: true, agents: 6, issuesDone: 0, issuesOpen: 2 } });
  assert.equal(L.rows[7].status, 'complete');
  assert.match(L.rows[7].evidence, /6 agents · 0 done · 2 open/);
  assert.equal(L.rows[8].status, 'active');                       // frontier advances to IX
});

test('quests · arc IX shows open items awaiting first founder decision', () => {
  const L = questLedger({ ...cambiumLike(), isolationSuite: true, multica: { reachable: true, agents: 6, issuesDone: 0, issuesOpen: 2 } });
  assert.equal(L.rows[8].status, 'active');
  assert.match(L.rows[8].evidence, /2 items awaiting first founder decision/);
});

test('quests · arc IX completes when at least one handoff is resolved', () => {
  const L = questLedger({ ...cambiumLike(), isolationSuite: true, multica: { reachable: true, agents: 6, issuesDone: 1, issuesOpen: 0 } });
  assert.equal(L.rows[8].status, 'complete');
  assert.match(L.rows[8].evidence, /1 handoff resolved through the gate/);
});

// M5 Phase Q Bridge — founder inheritance + project arcs X–XVII
test('quests · founder inheritance lets a new tenant skip I–IX', () => {
  const newTenant = questLedger({
    founder: { completedArcs: ['the-calling', 'first-mint', 'taste-resonance', 'the-loop', 'viability', 'memory', 'many-gardens', 'living-org', 'the-gate'] },
    project: { briefStatus: 'draft', contractExists: false, depositReceived: false },
  });
  assert.equal(newTenant.completed, 9);           // I–IX complete via founder
  assert.equal(newTenant.current?.id, 'the-brief'); // frontier is X
  assert.equal(newTenant.rows[9].status, 'active');
  assert.equal(newTenant.rows[10].status, 'locked');
});

test('quests · arc X completes when brief + contract + deposit are all green', () => {
  const L = questLedger({
    founder: { completedArcs: QUEST_LINE.slice(0, 9).map((q) => q.id) },
    project: { briefStatus: 'accepted', contractExists: true, depositReceived: true },
  });
  assert.equal(L.rows[9].status, 'complete');
  assert.equal(L.rows[10].status, 'active');      // frontier advances to XI
  assert.match(L.rows[9].evidence, /brief accepted · contract signed · deposit received/);
});

test('quests · arc X is honest about missing pieces', () => {
  const L = questLedger({
    founder: { completedArcs: QUEST_LINE.slice(0, 9).map((q) => q.id) },
    project: { briefStatus: 'accepted', contractExists: true, depositReceived: false },
  });
  assert.equal(L.rows[9].status, 'active');
  assert.match(L.rows[9].evidence, /deposit pending/);
});

test('quests · arc XI completes when repo + tenant + spec are ready', () => {
  const L = questLedger({
    founder: { completedArcs: QUEST_LINE.slice(0, 9).map((q) => q.id) },
    project: {
      briefStatus: 'accepted', contractExists: true, depositReceived: true,
      repoExists: true, tenantProvisioned: true, specsFrozen: true,
    },
  });
  assert.equal(L.rows[10].status, 'complete');
  assert.equal(L.rows[11].status, 'active');      // frontier advances to XII
});

test('quests · arc XI shows partial scaffold progress', () => {
  const L = questLedger({
    founder: { completedArcs: QUEST_LINE.slice(0, 9).map((q) => q.id) },
    project: {
      briefStatus: 'accepted', contractExists: true, depositReceived: true,
      repoExists: true, tenantProvisioned: false, specsFrozen: false,
    },
  });
  assert.equal(L.rows[10].status, 'active');
  assert.match(L.rows[10].evidence, /repo ready · scaffold in progress/);
});

test('quests · arc XII–XV track build → review → gate → launch', () => {
  const L = questLedger({
    founder: { completedArcs: QUEST_LINE.slice(0, 9).map((q) => q.id) },
    project: {
      briefStatus: 'accepted', contractExists: true, depositReceived: true,
      repoExists: true, tenantProvisioned: true, specsFrozen: true,
      buildCommits: 5, reviewEvents: 2, gateApprovals: 1, deployEvents: 1,
    },
  });
  assert.equal(L.rows[11].status, 'complete');    // XII The Build
  assert.equal(L.rows[12].status, 'complete');    // XIII The Review
  assert.equal(L.rows[13].status, 'complete');    // XIV The Ship Gate
  assert.equal(L.rows[14].status, 'complete');    // XV The Launch
  assert.equal(L.rows[15].status, 'active');      // XVI The Handoff (needs clientSignOff)
});

test('quests · arc XVI completes on client sign-off', () => {
  const L = questLedger({
    founder: { completedArcs: QUEST_LINE.slice(0, 9).map((q) => q.id) },
    project: {
      briefStatus: 'accepted', contractExists: true, depositReceived: true,
      repoExists: true, tenantProvisioned: true, specsFrozen: true,
      buildCommits: 5, reviewEvents: 2, gateApprovals: 1, deployEvents: 1,
      clientSignOff: true,
    },
  });
  assert.equal(L.rows[15].status, 'complete');
  assert.equal(L.rows[16].status, 'active');      // XVII The Garden
});

test('quests · arc XVII completes when lessons minted AND project archived', () => {
  const L = questLedger({
    founder: { completedArcs: QUEST_LINE.slice(0, 9).map((q) => q.id) },
    project: {
      briefStatus: 'accepted', contractExists: true, depositReceived: true,
      repoExists: true, tenantProvisioned: true, specsFrozen: true,
      buildCommits: 5, reviewEvents: 2, gateApprovals: 1, deployEvents: 1,
      clientSignOff: true, lessonsMinted: 3, projectArchived: true,
    },
  });
  assert.equal(L.rows[16].status, 'complete');
  assert.equal(L.current, null);                  // all quests complete
  assert.equal(L.completed, 17);
});

test('quests · arc XVII stays active while project is still live', () => {
  const L = questLedger({
    founder: { completedArcs: QUEST_LINE.slice(0, 9).map((q) => q.id) },
    project: {
      briefStatus: 'accepted', contractExists: true, depositReceived: true,
      repoExists: true, tenantProvisioned: true, specsFrozen: true,
      buildCommits: 5, reviewEvents: 2, gateApprovals: 1, deployEvents: 1,
      clientSignOff: true, lessonsMinted: 2, projectArchived: false,
    },
  });
  assert.equal(L.rows[16].status, 'active');
  assert.match(L.rows[16].evidence, /2 lessons minted · project still active/);
});

test('quine write quests evidence refreshes the project.json file', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  fs.mkdirSync(path.join(tmp, '.operator'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.operator', 'acme.world.json'), JSON.stringify({ version: 1, artifacts: {}, log: [] }));
  const { refreshProjectEvidence } = await import('../../quine/hyphae/project-evidence.ts');
  const ev = refreshProjectEvidence({ root: tmp } as any, 'acme');
  assert.equal(ev.tenantProvisioned, true, 'world.json present ⇒ tenantProvisioned true');
  assert.equal(ev.contractExists, false, 'no vault dir for acme ⇒ contract honestly false');
  const written = JSON.parse(fs.readFileSync(path.join(tmp, '.operator', 'acme.project.json'), 'utf8'));
  assert.equal(written.tenantProvisioned, true);
  assert.equal(written.source, 'project-evidence@v1');
});
