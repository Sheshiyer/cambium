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
    tenants: ['demo-org', 'sample-studio'],
    isolationSuite: false,
  };
}

test('quests · the line is seventeen arcs in dependency order (Paperclip org adds VIII–IX; Bridge adds X–XVII)', () => {
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
  assert.equal(L.rows[7].status, 'locked');                       // VIII locked until Paperclip feeds
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

test('quests · arc VIII is honest when Paperclip is unreachable', () => {
  const L = questLedger(cambiumLike());
  assert.equal(L.rows[7].status, 'locked');
  assert.match(L.rows[7].evidence, /Paperclip org unreachable/);
});

test('quests · arc VIII completes from real Paperclip activity', () => {
  const L = questLedger({ ...cambiumLike(), isolationSuite: true, paperclip: { reachable: true, agents: 6, issuesDone: 0, issuesOpen: 2, agentErrors: 6, pendingApprovals: 0 } });
  assert.equal(L.rows[7].status, 'complete');
  assert.match(L.rows[7].evidence, /6 agents · 0 done · 2 open · 6 errors/);
  assert.equal(L.rows[8].status, 'active');                       // frontier advances to IX
});

test('quests · arc IX shows open items awaiting first founder decision', () => {
  const L = questLedger({ ...cambiumLike(), isolationSuite: true, paperclip: { reachable: true, agents: 6, issuesDone: 0, issuesOpen: 2 } });
  assert.equal(L.rows[8].status, 'active');
  assert.match(L.rows[8].evidence, /2 items awaiting first founder decision/);
});

test('quests · arc IX completes when at least one handoff is resolved', () => {
  const L = questLedger({ ...cambiumLike(), isolationSuite: true, paperclip: { reachable: true, agents: 6, issuesDone: 1, issuesOpen: 0 } });
  assert.equal(L.rows[8].status, 'complete');
  assert.match(L.rows[8].evidence, /1 handoff resolved through Hermes\/Paperclip/);
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

test('founder.json gains newly-completed arcs after a root-tenant push (pure reducer)', async () => {
  const { reconcileFounder } = await import('../../quine/hyphae/quests.ts');
  const before = { completedArcs: ['the-calling'], derivedFrom: 'cambium', derivedAt: '2026-06-10T00:00:00Z' };
  const ledger = {
    rows: [
      { quest: { id: 'the-calling' }, status: 'complete' },
      { quest: { id: 'first-mint' }, status: 'complete' },
      { quest: { id: 'taste-resonance' }, status: 'active' },
    ],
  };
  const after = reconcileFounder(before, ledger as any, 'cambium', '2026-06-16T00:00:00Z');
  assert.deepEqual(after.completedArcs.sort(), ['first-mint', 'the-calling']);
  assert.equal(after.derivedFrom, 'cambium');
  assert.equal(after.derivedAt, '2026-06-16T00:00:00Z');
});

test('quests visual envelope derives wake, lanes, skills, and npc gaps from real inputs', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  fs.mkdirSync(path.join(tmp, '.operator'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.operator', 'acme.skills.json'), JSON.stringify([{
    skill_id: 'cambium-ship-gate',
    status: 'validated',
    telemetry: {
      uses: 3,
      successes: 2,
      failures: 1,
      scenarios: [{ ts: 1, ok: true }, { ts: 2, ok: true }, { ts: 3, ok: false, note: 'late proof' }],
      gotchas: ['late proof'],
      amendments: [],
    },
    updated: 3,
  }]));

  const inputs: QuestInputs = {
    world: {
      version: 1,
      artifacts: {},
      log: [
        '#1 onb-01-call → micro · tune copy',
        '#2 onb-02-vision → macro · reposition',
        '#3 onb-03-seed → noesis · founder insight',
      ],
    },
    founder: { completedArcs: ['the-calling', 'first-mint'] },
  };
  const ledger = questLedger(inputs);
  const { buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');
  const visual = buildVisualEnvelope(
    { root: tmp } as any,
    'acme',
    inputs,
    ledger,
    { source: 'test', derivedAt: '2026-06-22T00:00:00.000Z' },
  );

  assert.equal(visual.wake.steps.find((step) => step.id === 'ingest')?.status, 'proved');
  assert.equal(visual.wake.steps.find((step) => step.id === 'ingest')?.source, 'quest-envelope');
  assert.match(visual.wake.steps.find((step) => step.id === 'ingest')?.proof ?? '', /quest envelope source test/);
  assert.equal(visual.wake.steps.find((step) => step.id === 'persist')?.source, 'freshness');
  assert.ok(visual.wake.steps.find((step) => step.id === 'act')?.evidence.length);
  assert.equal(visual.lanes.source, 'world.log');
  assert.equal(visual.lanes.counts.micro, 1);
  assert.equal(visual.lanes.counts.macro, 1);
  assert.equal(visual.lanes.counts.noesis, 1);
  assert.equal(visual.senses.source, 'quest-ledger-envelope@v1');
  assert.equal(visual.senses.rows.length, 4);
  assert.equal(visual.senses.rows.find((sense) => sense.id === 'signal')?.on, true);
  assert.match(visual.senses.rows.find((sense) => sense.id === 'signal')?.proof ?? '', /Calling|Mint|Taste|Loop|Viability|Memory|Many Gardens|Living Org/);
  assert.equal(visual.senses.rows.find((sense) => sense.id === 'memory')?.on, false);
  assert.match(visual.senses.rows.find((sense) => sense.id === 'memory')?.gap ?? '', /no served cortex evidence/);
  assert.equal(visual.senses.rows.find((sense) => sense.id === 'risk')?.on, true);
  assert.match(visual.senses.rows.find((sense) => sense.id === 'risk')?.proof ?? '', /pending|missing|unreachable|locked/i);
  assert.equal(visual.insights.source, 'quest-ledger-evidence@v1');
  assert.equal(visual.insights.status, 'ready');
  assert.ok(visual.insights.rows.some((row) => row.origin === 'active-frontier' && row.state === 'wait'));
  assert.ok(visual.insights.rows.every((row) => row.proof && row.source === 'quest-ledger'));
  assert.equal(visual.stance.status, 'insufficient');
  assert.equal(visual.stance.sampleSize, 3);
  assert.match(visual.stance.gap ?? '', /need 6 tenant events/);
  assert.equal(visual.skills.source, 'skill-registry');
  assert.equal(visual.skills.rows[0].id, 'cambium-ship-gate');
  assert.equal(visual.skills.rows[0].successRate, 0.67);
  assert.equal(visual.skills.rows[0].tier, 'reliable');
  assert.equal(visual.skills.rows[0].tierLabel, 'RELIABLE');
  assert.equal(visual.skills.rows[0].sampleSize, 3);
  assert.equal(visual.skills.rows[0].minimum, 3);
  assert.equal(visual.skills.rows[0].recentRate, 0.67);
  assert.equal(visual.skills.rows[0].recentWindow, 3);
  assert.equal(visual.skills.rows[0].promotion.status, 'observe');
  assert.match(visual.skills.rows[0].promotion.detail, /needs 5 healthy uses/);
  assert.equal(visual.policy.source, 'operator-policy');
  assert.equal(visual.policy.status, 'blocked');
  assert.equal(visual.policy.action, null);
  assert.equal(visual.policy.title, 'POLICY GAP');
  assert.equal(visual.policy.rulesVersion, 'operator-policy@v1.4');
  assert.match(visual.policy.gap ?? '', /need 6 tenant events/);
  assert.doesNotMatch(visual.policy.blockers.join(' · '), /founder approval policy/);
  const miraGap = visual.npc.relationships.find((rel) => rel.id === 'mira');
  const founderNpc = visual.npc.relationships.find((rel) => rel.id === 'founder-npc');
  assert.equal(miraGap?.status, 'missing');
  assert.equal(miraGap?.stage?.id, 'missing');
  assert.match(miraGap?.proof ?? '', /no tenant cortex memories served/);
  assert.deepEqual(miraGap?.events, []);
  assert.equal(founderNpc?.status, 'inferred');
  assert.equal(founderNpc?.stage?.id, 'founder-backed');
  assert.equal(founderNpc?.events?.[0]?.source, 'founder-arcs');
  assert.equal(visual.social.source, 'coordination-evidence@v1');
  assert.equal(visual.social.status, 'gap');
  assert.equal(visual.social.scope, 'tenant-handoff-only');
  assert.equal(visual.social.rows[0].id, 'social-gap');
  assert.match(visual.social.rows[0].detail, /no tenant-scoped bridge or handoff evidence served/);
  assert.equal(visual.decisionContext.source, 'decision-context@v1');
  assert.equal(visual.decisionContext.status, 'ready');
  assert.equal(visual.decisionContext.served, 0);
  assert.equal(visual.decisionContext.gaps, 6);
  assert.equal(visual.decisionContext.rows.length, 6);
  assert.equal(visual.decisionContext.rows.find((row) => row.id === 'founder-preference')?.state, 'gap');
  assert.equal(visual.decisionContext.rows.find((row) => row.id === 'owner-load')?.state, 'gap');
  assert.doesNotMatch(
    [visual.policy.action, visual.policy.detail, ...visual.policy.blockers, ...visual.policy.requiredSignals].join(' · '),
    /founder preference|owner load|economic risk|team availability|member revocation|cross-tenant urgency/i,
  );
  assert.equal(visual.sideQuests.source, 'pure-trigger-predicates');
  assert.equal(visual.sideQuests.status, 'ready');
  assert.deepEqual(
    visual.sideQuests.rows.map((row) => row.id),
    ['wake-proof', 'stance-sample', 'policy-unblock', 'mira-evidence'],
  );
  assert.match(visual.sideQuests.rows.find((row) => row.id === 'wake-proof')?.proof ?? '', /viability/);
  assert.equal(visual.sideQuests.rows.find((row) => row.id === 'wake-proof')?.owner, 'operator');
  assert.equal(visual.sideQuests.rows.find((row) => row.id === 'wake-proof')?.action.kind, 'refresh');
  assert.equal(visual.sideQuests.rows.find((row) => row.id === 'wake-proof')?.lifetime.scope, 'until-next-refresh');
  assert.match(visual.sideQuests.rows.find((row) => row.id === 'wake-proof')?.completion.proof ?? '', /wake steps/);
  assert.ok(visual.sideQuests.rows.every((row) => row.owner && row.action.label && row.lifetime.detail && row.completion.proof));
  assert.doesNotMatch(visual.sideQuests.rows.map((row) => row.detail).join(' · '), /reward|bonus|level up/i);
});

test('quests visual envelope lets evidence-complete gate review outrank generic frontier work', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  fs.mkdirSync(path.join(tmp, '.operator'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.operator', 'acme.skills.json'), JSON.stringify([
    {
      skill_id: 'cambium-ship-gate',
      status: 'validated',
      telemetry: {
        uses: 5,
        successes: 5,
        failures: 0,
        scenarios: [{ ts: 1, ok: true }, { ts: 2, ok: true }, { ts: 3, ok: true }, { ts: 4, ok: true }, { ts: 5, ok: true }],
        gotchas: [],
        amendments: [],
      },
      updated: 5,
    },
  ]));

  const inputs: QuestInputs = {
    world: {
      version: 1,
      artifacts: {},
      log: [
        '#1 step → micro · tune',
        '#2 step → micro · tune',
        '#3 step → micro · tune',
        '#4 step → meso · reroll',
        '#5 step → macro · reposition',
        '#6 step → noesis · insight',
      ],
    },
  };
  const { buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');
  const visual = buildVisualEnvelope(
    { root: tmp } as any,
    'acme',
    inputs,
    questLedger(inputs),
    {
      source: 'test',
      derivedAt: '2026-06-22T00:00:00.000Z',
      openItems: [
        {
          id: 'THO-8',
          title: 'Open build follow-up',
          status: 'open',
          owner: 'Paperclip',
          updatedAt: '2026-06-22T01:00:00.000Z',
          evidence: 'THO-8 is open · owner Paperclip · updated 2026-06-22T01:00:00.000Z',
          consequence: 'founder decision changes Paperclip handling for THO-8',
          approveConsequence: 'approve THO-8 for Paperclip execution',
          rerollConsequence: 'reroll THO-8 and request revision before execution',
          reversibility: 'queued action can be superseded until consumed; reroll keeps the item open',
          idempotencyHint: 'THO-8:open:2026-06-22T01:00:00.000Z',
          priority: {
            source: 'paperclip-priority@v1',
            risk: 'medium',
            dependency: 'none',
            score: 2,
            reasons: ['title needs follow-up attention', 'no dependency keyword served'],
          },
        },
        {
          id: 'THO-9',
          title: 'Review launch copy',
          status: 'blocked',
          owner: 'Mathis',
          updatedAt: '2026-06-22T00:00:00.000Z',
          evidence: 'THO-9 is blocked · owner Mathis · updated 2026-06-22T00:00:00.000Z',
          consequence: 'founder decision changes Paperclip handling for THO-9',
          approveConsequence: 'approve THO-9 for Paperclip execution',
          rerollConsequence: 'reroll THO-9 and request revision before execution',
          reversibility: 'queued action can be superseded until consumed; reroll keeps the item open',
          idempotencyHint: 'THO-9:blocked:2026-06-22T00:00:00.000Z',
          priority: {
            source: 'paperclip-priority@v1',
            risk: 'critical',
            dependency: 'blocks-delivery',
            score: 24,
            reasons: ['status/title indicates blocked or critical risk', 'item can block delivery or founder handoff'],
          },
        },
      ],
    },
  );

  assert.equal(visual.policy.status, 'ready');
  assert.equal(visual.policy.rulesVersion, 'operator-policy@v1.4');
  assert.match(visual.policy.action ?? '', /Review gate item THO-9: Review launch copy/);
  assert.match(visual.policy.detail, /critical risk · blocks-delivery dependency/);
  assert.match(visual.policy.detail, /2 gate items ranked/);
  assert.doesNotMatch(visual.policy.action ?? '', /^Advance /);
  assert.deepEqual(visual.policy.requiredSignals, ['gate item evidence', 'gate consequences', 'gate idempotency', 'gate queue priority', 'gate risk signal', 'gate dependency signal']);
  assert.match(visual.policy.cautions.join(' · '), /signed Gate flow/);
  assert.equal(visual.senses.rows.find((sense) => sense.id === 'risk')?.on, true);
  assert.match(visual.senses.rows.find((sense) => sense.id === 'risk')?.proof ?? '', /THO-9|critical risk|blocks-delivery/);
  assert.equal(visual.social.status, 'ready');
  assert.equal(visual.social.rows.find((row) => row.id === 'handoff-queue')?.source, 'paperclip-open-items');
  assert.match(visual.social.rows.find((row) => row.id === 'handoff-queue')?.detail ?? '', /2 open tenant handoffs awaiting founder review/);
  assert.match(visual.social.rows.find((row) => row.id === 'handoff-queue')?.proof ?? '', /THO-8: open · owner Paperclip/);
  assert.doesNotMatch(visual.social.rows.map((row) => row.detail).join(' · '), /leaderboard|social proof|follower|rank/i);
  const ownerLoad = visual.decisionContext.rows.find((row) => row.id === 'owner-load');
  assert.equal(ownerLoad?.state, 'served');
  assert.equal(ownerLoad?.source, 'paperclip-open-items');
  assert.match(ownerLoad?.detail ?? '', /Mathis 1 · Paperclip 1/);
  assert.match(ownerLoad?.proof ?? '', /THO-8: owner Paperclip · THO-9: owner Mathis/);
  assert.equal(visual.decisionContext.rows.find((row) => row.id === 'economic-risk')?.state, 'gap');
  assert.doesNotMatch(
    [visual.policy.action, visual.policy.detail, ...visual.policy.cautions, ...visual.policy.requiredSignals].join(' · '),
    /owner load|founder preference|economic risk|team availability|member revocation|cross-tenant urgency/i,
  );
  assert.equal(visual.skills.rows[0].promotion.status, 'founder-review');
  assert.equal(visual.skills.rows[0].promotion.requiredApproval, true);
  assert.match(visual.skills.rows[0].promotion.detail, /founder approval required/);
  assert.ok(visual.sideQuests.rows.some((row) => row.id === 'gate-review' && /2 open handoffs/.test(row.detail)));
  assert.ok(visual.sideQuests.rows.some((row) => row.id === 'skill-promotion-review' && /cambium-ship-gate/.test(row.detail)));
  assert.equal(visual.sideQuests.rows.find((row) => row.id === 'gate-review')?.owner, 'founder');
  assert.equal(visual.sideQuests.rows.find((row) => row.id === 'gate-review')?.completion.kind, 'queue-consumed');
  assert.equal(visual.sideQuests.rows.find((row) => row.id === 'skill-promotion-review')?.action.kind, 'founder-review');
});

test('quests visual envelope serves project and tenant decision context without making it policy authority', async () => {
  const fs = await import('node:fs');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  const inputs: QuestInputs = {
    tenants: ['acme', 'beta'],
    project: {
      briefStatus: 'accepted',
      contractExists: true,
      depositReceived: false,
    },
  };
  const { buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');
  const visual = buildVisualEnvelope(
    { root: tmp } as any,
    'acme',
    inputs,
    questLedger(inputs),
    { source: 'test', derivedAt: '2026-06-22T00:00:00.000Z' },
  );

  const economic = visual.decisionContext.rows.find((row) => row.id === 'economic-risk');
  const urgency = visual.decisionContext.rows.find((row) => row.id === 'cross-tenant-urgency');
  assert.equal(visual.decisionContext.source, 'decision-context@v1');
  assert.equal(visual.decisionContext.served, 1);
  assert.equal(visual.decisionContext.gaps, 5);
  assert.equal(economic?.state, 'served');
  assert.equal(economic?.source, 'project-evidence');
  assert.equal(economic?.scope, 'project-only');
  assert.match(economic?.detail ?? '', /brief accepted · contract signed · deposit pending · amount not served/);
  assert.match(economic?.proof ?? '', /no amount\/currency risk score/);
  assert.equal(urgency?.state, 'gap');
  assert.equal(urgency?.source, 'tenant-registry');
  assert.equal(urgency?.scope, 'cross-tenant');
  assert.match(urgency?.detail ?? '', /2 tenants registered; urgency scores not served/);
  assert.doesNotMatch(
    [visual.policy.action, visual.policy.detail, ...visual.policy.blockers, ...visual.policy.requiredSignals].join(' · '),
    /brief accepted|contract signed|deposit pending|tenant urgency|cross-tenant urgency|economic risk/i,
  );
});

test('quests visual envelope promotes only explicit priority signals into operator policy', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  fs.mkdirSync(path.join(tmp, '.operator'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.operator', 'acme.skills.json'), JSON.stringify([
    {
      skill_id: 'cambium-ship-gate',
      status: 'production',
      telemetry: {
        uses: 5,
        successes: 5,
        failures: 0,
        scenarios: [{ ts: 1, ok: true }, { ts: 2, ok: true }, { ts: 3, ok: true }, { ts: 4, ok: true }, { ts: 5, ok: true }],
        gotchas: [],
        amendments: [],
      },
      updated: 5,
    },
  ]));
  const prioritySignals: QuestInputs['prioritySignals'] = {
    source: 'operator-priority-signals@v1',
    founderPreference: { targetId: 'THO-10', weight: 10, proof: 'founder ranked THO-10 first' },
    ownerLoad: { owner: 'Mathis', openItems: 3, capacity: 2, proof: 'Mathis has three open handoffs and capacity two' },
    economicRisk: { amount: 12000, currency: 'USD', risk: 'high', proof: 'USD 12000 contract has deposit risk' },
    teamAvailability: { available: 1, required: 2, proof: 'one reviewer available for two-reviewer gate' },
    memberRevocation: { revoked: false, proof: 'revocation ledger clear' },
    crossTenantUrgency: { score: 4, tenants: 3, proof: 'three tenants have active queues' },
  };
  const inputs: QuestInputs = {
    prioritySignals,
    world: {
      version: 1,
      artifacts: {},
      log: [
        '#1 step → micro · tune',
        '#2 step → micro · tune',
        '#3 step → micro · tune',
        '#4 step → micro · tune',
        '#5 step → meso · reroll',
        '#6 step → macro · reposition',
      ],
    },
  };
  const { buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');
  const visual = buildVisualEnvelope(
    { root: tmp } as any,
    'acme',
    inputs,
    questLedger(inputs),
    {
      source: 'test',
      derivedAt: '2026-06-22T00:00:00.000Z',
      openItems: [
        {
          id: 'THO-9',
          title: 'Older blocked founder review',
          status: 'blocked',
          owner: 'Mathis',
          updatedAt: '2026-06-21T23:00:00.000Z',
          evidence: 'THO-9 is blocked · owner Mathis · updated 2026-06-21T23:00:00.000Z',
          consequence: 'founder decision changes Paperclip handling for THO-9',
          approveConsequence: 'approve THO-9 for Paperclip execution',
          rerollConsequence: 'reroll THO-9 and request revision before execution',
          reversibility: 'queued action can be superseded until consumed',
          idempotencyHint: 'THO-9:blocked:2026-06-21T23:00:00.000Z',
          priority: { source: 'paperclip-priority@v1', risk: 'critical', dependency: 'blocks-delivery', score: 24, reasons: ['critical risk'] },
        },
        {
          id: 'THO-10',
          title: 'Founder preferred delivery gate',
          status: 'blocked',
          owner: 'Paperclip',
          updatedAt: '2026-06-22T02:00:00.000Z',
          evidence: 'THO-10 is blocked · owner Paperclip · updated 2026-06-22T02:00:00.000Z',
          consequence: 'founder decision changes Paperclip handling for THO-10',
          approveConsequence: 'approve THO-10 for Paperclip execution',
          rerollConsequence: 'reroll THO-10 and request revision before execution',
          reversibility: 'queued action can be superseded until consumed',
          idempotencyHint: 'THO-10:blocked:2026-06-22T02:00:00.000Z',
          priority: { source: 'paperclip-priority@v1', risk: 'high', dependency: 'blocks-delivery', score: 23, reasons: ['high risk'] },
        },
      ],
    },
  );

  assert.equal(visual.policy.rulesVersion, 'operator-policy@v1.4');
  assert.equal(visual.policy.status, 'ready');
  assert.match(visual.policy.action ?? '', /THO-10: Founder preferred delivery gate/);
  assert.match(visual.policy.detail, /priority signals/);
  assert.ok(visual.policy.requiredSignals.includes('founder preference signal'));
  assert.match(visual.policy.cautions.join(' · '), /founder preference THO-10/);
  assert.equal(visual.decisionContext.served, 6);
  assert.equal(visual.decisionContext.gaps, 0);
  assert.equal(visual.decisionContext.rows.find((row) => row.id === 'founder-preference')?.source, 'operator-priority-signals');
  assert.match(visual.decisionContext.rows.find((row) => row.id === 'economic-risk')?.detail ?? '', /USD 12000/);
  assert.match(visual.decisionContext.rows.find((row) => row.id === 'cross-tenant-urgency')?.detail ?? '', /score 4/);
});

test('gatherQuestInputs reads explicit operator priority signals from tenant state', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  fs.mkdirSync(path.join(tmp, '.operator'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.operator', 'acme.priority-signals.json'), JSON.stringify({
    source: 'operator-priority-signals@v1',
    founderPreference: { targetId: 'THO-10', weight: 10, proof: 'founder ranked THO-10 first' },
    ownerLoad: { owner: 'Mathis', openItems: 3, capacity: 2, proof: 'Mathis over capacity' },
    economicRisk: { amount: 12000, currency: 'USD', risk: 'high', proof: 'amount and currency served' },
    teamAvailability: { available: 1, required: 2, proof: 'availability roster served' },
    memberRevocation: { revoked: false, proof: 'revocation ledger clear' },
    crossTenantUrgency: { score: 4, tenants: 3, proof: 'urgency score served' },
  }, null, 2));

  const { gatherQuestInputs } = await import('../../quine/hyphae/quests.ts');
  const inputs = gatherQuestInputs({ root: tmp } as any, 'acme');
  assert.equal(inputs.prioritySignals?.source, 'operator-priority-signals@v1');
  assert.equal(inputs.prioritySignals?.founderPreference.targetId, 'THO-10');
  assert.equal(inputs.prioritySignals?.economicRisk.currency, 'USD');
});

test('quests visual envelope keeps skill labor tiers conservative under sparse or declining telemetry', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  fs.mkdirSync(path.join(tmp, '.operator'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.operator', 'acme.skills.json'), JSON.stringify([
    {
      skill_id: 'cambium-declining-proof',
      status: 'validated',
      telemetry: {
        uses: 3,
        successes: 1,
        failures: 2,
        scenarios: [{ ts: 1, ok: true }, { ts: 2, ok: false, note: 'missing receipt' }, { ts: 3, ok: false, note: 'late proof' }],
        gotchas: ['missing receipt', 'late proof'],
        amendments: [],
      },
      updated: 3,
    },
    {
      skill_id: 'cambium-new-labor',
      status: 'candidate',
      telemetry: {
        uses: 1,
        successes: 1,
        failures: 0,
        scenarios: [{ ts: 4, ok: true }],
        gotchas: [],
        amendments: [],
      },
      updated: 4,
    },
  ]));

  const { buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');
  const visual = buildVisualEnvelope(
    { root: tmp } as any,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-22T00:00:00.000Z' },
  );
  const declining = visual.skills.rows.find((skill) => skill.id === 'cambium-declining-proof');
  const unproven = visual.skills.rows.find((skill) => skill.id === 'cambium-new-labor');

  assert.equal(declining?.tier, 'declining');
  assert.equal(declining?.tierLabel, 'DECLINING');
  assert.equal(declining?.declining, true);
  assert.equal(declining?.recentRate, 0.33);
  assert.match(declining?.gap ?? '', /below 50%/);
  assert.equal(unproven?.tier, 'unproven');
  assert.equal(unproven?.tierLabel, 'UNPROVEN');
  assert.equal(unproven?.sampleSize, 1);
  assert.match(unproven?.gap ?? '', /need 3 uses/);
  assert.equal(unproven?.promotion.status, 'blocked');
  assert.equal(declining?.promotion.status, 'blocked');
});

test('quests visual envelope only marks production promotion when registry approval already exists', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  fs.mkdirSync(path.join(tmp, '.operator'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.operator', 'acme.skills.json'), JSON.stringify([
    {
      skill_id: 'cambium-founder-review',
      status: 'validated',
      telemetry: {
        uses: 5,
        successes: 5,
        failures: 0,
        scenarios: [{ ts: 1, ok: true }, { ts: 2, ok: true }, { ts: 3, ok: true }, { ts: 4, ok: true }, { ts: 5, ok: true }],
        gotchas: [],
        amendments: [],
      },
      updated: 5,
    },
    {
      skill_id: 'cambium-production-approved',
      status: 'production',
      telemetry: {
        uses: 5,
        successes: 5,
        failures: 0,
        scenarios: [{ ts: 1, ok: true }, { ts: 2, ok: true }, { ts: 3, ok: true }, { ts: 4, ok: true }, { ts: 5, ok: true }],
        gotchas: [],
        amendments: [],
      },
      updated: 4,
    },
  ]));

  const { buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');
  const visual = buildVisualEnvelope(
    { root: tmp } as any,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-22T00:00:00.000Z' },
  );
  const founderReview = visual.skills.rows.find((skill) => skill.id === 'cambium-founder-review');
  const production = visual.skills.rows.find((skill) => skill.id === 'cambium-production-approved');

  assert.equal(founderReview?.tier, 'reliable');
  assert.equal(founderReview?.promotion.status, 'founder-review');
  assert.equal(founderReview?.promotion.requiredApproval, true);
  assert.match(founderReview?.promotion.detail ?? '', /founder approval required/);
  assert.notEqual(founderReview?.tier, 'production');
  assert.equal(production?.tier, 'production');
  assert.equal(production?.promotion.status, 'approved');
  assert.equal(production?.promotion.requiredApproval, false);
});

test('quests visual envelope preserves Hermes agent skill loadout details', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  fs.mkdirSync(path.join(tmp, '.operator'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.operator', 'acme.skills.json'), JSON.stringify([
    {
      skill_id: 'hermes-github-repo-issue-ops',
      status: 'candidate',
      category: 'governance',
      description: 'USE WHEN manual GitHub issue work is requested. NOT FOR direct branch mutation.',
      trigger_signals: ['/ts-github issue create'],
      required_inputs: [{ name: 'manual command', source: 'telegram', required: true }],
      output_contract: {
        format: 'cambium.skill-registry.agent-skill.v1',
        location: '.operator/<tenant>.skills.json',
        skillId: 'github-repo-issue-ops',
        version: '0.1.0',
        miniAppArea: 'skills',
        registryTarget: '.operator/<tenant>.skills.json',
        readCommands: ['github.repo.inspect', 'github.issue.read'],
        writeCommands: ['github.issue.create', 'github.issue.comment'],
        roleSubsets: {
          engineer: { version: '0.1.0', permissions: ['read', 'write'], commands: ['github.issue.create'] },
          hermes: { version: '0.1.0', permissions: ['read', 'dispatch'], commands: ['github.repo.inspect'] },
        },
        boundaries: ['Write operations require manual command context and audit receipt.'],
      },
      source: { signature: 'github:github-repo-issue-ops:0.1.0', from: 'world-log', occurrences: 1 },
      telemetry: { uses: 0, successes: 0, failures: 0, scenarios: [], gotchas: [], amendments: [] },
      created: 1,
      updated: 1,
    },
  ]));

  const { buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');
  const visual = buildVisualEnvelope(
    { root: tmp } as any,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-25T00:00:00.000Z' },
  );
  const skill = visual.skills.rows.find((row) => row.id === 'hermes-github-repo-issue-ops');

  assert.ok(skill?.agentSkill);
  assert.equal(skill?.agentSkill?.version, '0.1.0');
  assert.deepEqual(skill?.agentSkill?.writeCommands, ['github.issue.create', 'github.issue.comment']);
  assert.deepEqual(skill?.agentSkill?.roleSubsets.engineer.permissions, ['read', 'write']);
  assert.match(skill?.agentSkill?.boundaries[0] ?? '', /manual command context/);
});

test('quests visual envelope labels stance only from sufficient tenant lane history', async () => {
  const fs = await import('node:fs');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  const inputs: QuestInputs = {
    world: {
      version: 1,
      artifacts: {},
      log: [
        '#1 step → micro · tune',
        '#2 step → micro · tune',
        '#3 step → micro · tune',
        '#4 step → meso · reroll',
        '#5 step → macro · reposition',
        '#6 step → noesis · insight',
      ],
    },
  };
  const { buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');
  const visual = buildVisualEnvelope(
    { root: tmp } as any,
    'acme',
    inputs,
    questLedger(inputs),
    { source: 'test', derivedAt: '2026-06-22T00:00:00.000Z' },
  );

  assert.equal(visual.stance.source, 'tenant-world.log');
  assert.equal(visual.stance.scope, 'tenant-world-log-only');
  assert.equal(visual.stance.status, 'ready');
  assert.equal(visual.stance.dominant, 'micro');
  assert.equal(visual.stance.label, 'MICRO-LED');
  assert.equal(visual.stance.sampleSize, 6);
  assert.equal(visual.stance.ratios.micro, 0.5);
  assert.equal(visual.policy.status, 'blocked');
  assert.doesNotMatch(visual.policy.blockers.join(' · '), /operator policy does not map stance ratios to actions yet/);
  assert.match(visual.policy.blockers.join(' · '), /skill registry missing/);
});

test('quests visual envelope does not infer stance from inherited founder arcs', async () => {
  const fs = await import('node:fs');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  const inputs: QuestInputs = {
    founder: { completedArcs: QUEST_LINE.slice(0, 9).map((q) => q.id) },
  };
  const { buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');
  const visual = buildVisualEnvelope(
    { root: tmp } as any,
    'client-tenant',
    inputs,
    questLedger(inputs),
    { source: 'test', derivedAt: '2026-06-22T00:00:00.000Z' },
  );

  const founderNpc = visual.npc.relationships.find((rel) => rel.id === 'founder-npc');
  assert.equal(founderNpc?.status, 'inferred');
  assert.equal(founderNpc?.stage?.id, 'founder-backed');
  assert.equal(founderNpc?.events?.[0]?.source, 'founder-arcs');
  assert.equal(visual.stance.status, 'insufficient');
  assert.equal(visual.stance.source, 'missing');
  assert.equal(visual.stance.sampleSize, 0);
  assert.equal(visual.stance.label, null);
});

test('quests visual envelope infers Mira only from tenant-scoped cortex memory evidence', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { DatabaseSync } = await import('node:sqlite');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  fs.mkdirSync(path.join(tmp, '.operator'), { recursive: true });
  const db = new DatabaseSync(path.join(tmp, '.operator', 'cortex.db'));
  try {
    db.exec(`CREATE TABLE memory (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      tenant TEXT NOT NULL,
      vector TEXT NOT NULL,
      payload TEXT NOT NULL,
      ts INTEGER NOT NULL
    );`);
    db.prepare('INSERT INTO memory (id, kind, tenant, vector, payload, ts) VALUES (?, ?, ?, ?, ?, ?)').run(
      'acme:mira:resonance-1',
      'positioning',
      'acme',
      '[]',
      JSON.stringify({ text: 'Mira ICP resonance note: skeptical founder wants owned delivery.' }),
      3,
    );
    db.prepare('INSERT INTO memory (id, kind, tenant, vector, payload, ts) VALUES (?, ?, ?, ?, ?, ?)').run(
      'other:mira:resonance-1',
      'positioning',
      'other',
      '[]',
      JSON.stringify({ text: 'Mira should not leak across tenants.' }),
      4,
    );
  } finally {
    db.close();
  }

  const { buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');
  const visual = buildVisualEnvelope(
    { root: tmp } as any,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-22T00:00:00.000Z' },
  );
  const mira = visual.npc.relationships.find((rel) => rel.id === 'mira');

  assert.equal(visual.npc.source, 'cortex-memory');
  assert.equal(mira?.status, 'inferred');
  assert.equal(mira?.scope, 'tenant-cortex-only');
  assert.equal(mira?.sampleSize, 1);
  assert.equal(mira?.stage?.id, 'sighted');
  assert.equal(mira?.stage?.label, 'SIGHTED');
  assert.match(mira?.proof ?? '', /acme:mira:resonance-1: positioning/);
  assert.equal(mira?.events?.length, 1);
  assert.equal(mira?.events?.[0]?.source, 'tenant-cortex-memory');
  assert.equal(mira?.events?.[0]?.id, 'acme:mira:resonance-1');
  assert.match(mira?.detail ?? '', /1\/1 tenant cortex memories/);
  assert.deepEqual(mira?.evidence, ['acme:mira:resonance-1', 'positioning']);
});

test('quests visual envelope does not infer Mira from another tenant cortex memory', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { DatabaseSync } = await import('node:sqlite');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  fs.mkdirSync(path.join(tmp, '.operator'), { recursive: true });
  const db = new DatabaseSync(path.join(tmp, '.operator', 'cortex.db'));
  try {
    db.exec(`CREATE TABLE memory (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      tenant TEXT NOT NULL,
      vector TEXT NOT NULL,
      payload TEXT NOT NULL,
      ts INTEGER NOT NULL
    );`);
    db.prepare('INSERT INTO memory (id, kind, tenant, vector, payload, ts) VALUES (?, ?, ?, ?, ?, ?)').run(
      'other:mira:resonance-1',
      'positioning',
      'other',
      '[]',
      JSON.stringify({ text: 'Mira ICP memory for another tenant.' }),
      4,
    );
  } finally {
    db.close();
  }

  const { buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');
  const visual = buildVisualEnvelope(
    { root: tmp } as any,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-22T00:00:00.000Z' },
  );
  const mira = visual.npc.relationships.find((rel) => rel.id === 'mira');

  assert.equal(visual.npc.source, 'missing');
  assert.equal(mira?.status, 'missing');
  assert.equal(mira?.scope, 'tenant-cortex-only');
  assert.equal(mira?.sampleSize, 0);
  assert.equal(mira?.stage?.id, 'missing');
  assert.match(mira?.proof ?? '', /no tenant cortex memories served/);
  assert.deepEqual(mira?.events, []);
  assert.match(mira?.detail ?? '', /npc relationship state not served yet/);
});

test('quests npc-event write creates durable advice history for the visual envelope', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  const ctx = { root: tmp, vaultRoot: tmp } as any;
  const { quests, buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');

  const written = await quests.write?.([
    'npc-event',
    'mira',
    'advice',
    '--detail',
    'Mira profile signal from founder positioning review',
    '--evidence',
    'operator note references founder positioning review',
    '--advice',
    'review Mira positioning before the next founder handoff',
    '--target',
    'npc:mira',
    '--tenant',
    'acme',
  ], ctx);
  assert.equal((written as any).op, 'npc-event');
  const lines = fs.readFileSync(path.join(tmp, '.operator', 'acme.npc-events.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]);
  assert.equal(event.schema, 'cambium.npc-event.v1');
  assert.equal(event.tenant, 'acme');
  assert.equal(event.npcId, 'mira');
  assert.equal(event.kind, 'advice');
  assert.equal(event.advice.action.target, 'npc:mira');

  const visual = buildVisualEnvelope(
    ctx,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-22T00:00:00.000Z' },
  );
  const mira = visual.npc.relationships.find((rel) => rel.id === 'mira');
  assert.equal(visual.npc.source, 'operator-npc-events');
  assert.equal(mira?.status, 'inferred');
  assert.equal(mira?.stage?.id, 'sighted');
  assert.equal(mira?.history?.source, 'operator-npc-events@v1');
  assert.equal(mira?.history?.total, 1);
  assert.equal(mira?.advice?.status, 'ready');
  assert.equal(mira?.advice?.label, 'REVIEW ADVICE');
  assert.match(mira?.advice?.detail ?? '', /review Mira positioning/);
  assert.equal(mira?.events?.[0]?.source, 'operator-npc-event');
});

test('quests npc-event contradiction blocks advice and marks the relationship for review', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  const ctx = { root: tmp, vaultRoot: tmp } as any;
  const { quests, buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');

  await quests.write?.([
    'npc-event',
    'mira',
    'advice',
    '--detail',
    'Mira profile signal from founder positioning review',
    '--evidence',
    'operator note references founder positioning review',
    '--advice',
    'review Mira positioning before the next founder handoff',
    '--tenant',
    'acme',
  ], ctx);
  const first = JSON.parse(fs.readFileSync(path.join(tmp, '.operator', 'acme.npc-events.jsonl'), 'utf8').trim());
  await quests.write?.([
    'npc-event',
    'mira',
    'contradiction',
    '--detail',
    'Mira profile signal conflicts with newer founder note',
    '--evidence',
    'newer founder note rejects the previous ICP assumption',
    '--contradicts',
    first.id,
    '--tenant',
    'acme',
  ], ctx);

  const visual = buildVisualEnvelope(
    ctx,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-22T00:00:00.000Z' },
  );
  const mira = visual.npc.relationships.find((rel) => rel.id === 'mira');
  assert.equal(mira?.stage?.id, 'needs-review');
  assert.equal(mira?.advice?.status, 'blocked');
  assert.equal(mira?.advice?.label, 'ADVICE BLOCKED');
  assert.equal(mira?.history?.contradictions, 1);
  assert.match(mira?.proof ?? '', /contradiction/);
});

test('quests npc-event write rejects relationship overclaiming language', async () => {
  const fs = await import('node:fs');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  const { quests } = await import('../../quine/hyphae/quests.ts');
  const out = await quests.write?.([
    'npc-event',
    'mira',
    'note',
    '--detail',
    'Mira is now a trusted advisor',
    '--tenant',
    'acme',
  ], { root: tmp, vaultRoot: tmp } as any);

  assert.match(String(out), /overclaiming language/);
  assert.equal(fs.existsSync(`${tmp}/.operator/acme.npc-events.jsonl`), false);
});

test('quests side-quest ledger queues, completes, and expires visual branches', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  const ctx = { root: tmp, vaultRoot: tmp } as any;
  const { quests, buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');

  const queued = await quests.write?.([
    'side-quest',
    'wake-proof',
    'queued',
    '--detail',
    'operator queued wake evidence refresh',
    '--proof',
    'wake-proof branch assigned from current visual envelope',
    '--created-at',
    '2026-06-22T00:00:00.000Z',
    '--tenant',
    'acme',
  ], ctx);
  assert.equal((queued as any).op, 'side-quest');
  const file = path.join(tmp, '.operator', 'acme.side-quests.jsonl');
  const firstLine = fs.readFileSync(file, 'utf8').trim().split('\n')[0];
  assert.equal(JSON.parse(firstLine).schema, 'cambium.side-quest-event.v1');

  const queuedVisual = buildVisualEnvelope(
    ctx,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-22T01:00:00.000Z' },
  );
  const wakeQueued = queuedVisual.sideQuests.rows.find((row) => row.id === 'wake-proof');
  assert.equal(wakeQueued?.status, 'queued');
  assert.equal(wakeQueued?.runtime?.source, 'operator-side-quests@v1');
  assert.equal(wakeQueued?.runtime?.total, 1);
  assert.match(wakeQueued?.runtime?.proof ?? '', /wake-proof branch assigned/);

  await quests.write?.([
    'side-quest',
    'wake-proof',
    'completed',
    '--detail',
    'operator refreshed wake evidence and pushed the envelope',
    '--proof',
    'quest envelope now carries wake proof rows',
    '--created-at',
    '2026-06-22T01:30:00.000Z',
    '--tenant',
    'acme',
  ], ctx);
  const completedVisual = buildVisualEnvelope(
    ctx,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-22T02:00:00.000Z' },
  );
  const wakeCompleted = completedVisual.sideQuests.rows.find((row) => row.id === 'wake-proof');
  assert.equal(wakeCompleted?.status, 'completed');
  assert.equal(wakeCompleted?.runtime?.total, 2);
  assert.equal(wakeCompleted?.runtime?.latest?.status, 'completed');
  assert.match(wakeCompleted?.detail ?? '', /COMPLETED/);

  await quests.write?.([
    'side-quest',
    'stance-sample',
    'queued',
    '--detail',
    'operator queued tenant lane sample collection',
    '--proof',
    'stance sample branch assigned before the refresh window',
    '--created-at',
    '2026-06-21T00:00:00.000Z',
    '--tenant',
    'acme',
  ], ctx);
  const expiredVisual = buildVisualEnvelope(
    ctx,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-22T00:01:00.000Z' },
  );
  const stanceExpired = expiredVisual.sideQuests.rows.find((row) => row.id === 'stance-sample');
  assert.equal(stanceExpired?.status, 'expired');
  assert.equal(stanceExpired?.runtime?.status, 'expired');
  assert.match(stanceExpired?.runtime?.expiredAt ?? '', /2026-06-21T06:00:00.000Z/);
  assert.match(stanceExpired?.runtime?.proof ?? '', /expired at/);
  assert.doesNotMatch(expiredVisual.sideQuests.rows.map((row) => row.detail).join(' · '), /reward|bonus|level up|leaderboard|social proof/i);
});

test('quests side-quest write rejects reward and social-proof overclaiming', async () => {
  const fs = await import('node:fs');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  const { quests } = await import('../../quine/hyphae/quests.ts');
  const out = await quests.write?.([
    'side-quest',
    'wake-proof',
    'queued',
    '--detail',
    'reward unlocked for the hidden quest',
    '--proof',
    'leaderboard rank improved',
    '--tenant',
    'acme',
  ], { root: tmp, vaultRoot: tmp } as any);

  assert.match(String(out), /overclaiming language/);
  assert.equal(fs.existsSync(`${tmp}/.operator/acme.side-quests.jsonl`), false);
});

test('quests wake-event ledger records history without overriding latest wake state', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  const ctx = { root: tmp, vaultRoot: tmp } as any;
  const { quests, buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');

  const written = await quests.write?.([
    'wake-event',
    'viability',
    'proved',
    '--detail',
    'operator observed margin sweep in refresh loop',
    '--proof',
    'refresh log shows viability sweep completed',
    '--target',
    'wake:viability',
    '--created-at',
    '2026-06-22T00:00:00.000Z',
    '--tenant',
    'acme',
  ], ctx);
  assert.equal((written as any).op, 'wake-event');
  const file = path.join(tmp, '.operator', 'acme.wake-events.jsonl');
  const event = JSON.parse(fs.readFileSync(file, 'utf8').trim());
  assert.equal(event.schema, 'cambium.wake-event.v1');
  assert.equal(event.stepId, 'viability');
  assert.equal(event.status, 'proved');

  const visual = buildVisualEnvelope(
    ctx,
    'acme',
    {},
    questLedger({}),
    { source: 'test', derivedAt: '2026-06-22T00:00:00.000Z' },
  );
  const viability = visual.wake.steps.find((step) => step.id === 'viability');
  assert.equal(viability?.status, 'missing');
  assert.match(viability?.proof ?? '', /no viability/);
  assert.equal(viability?.history?.source, 'operator-wake-events@v1');
  assert.equal(viability?.history?.total, 1);
  assert.equal(viability?.history?.status, 'proved');
  assert.match(viability?.history?.proof ?? '', /viability sweep completed/);
  assert.equal(viability?.history?.latest?.target, 'wake:viability');
});

test('quests wake-event write rejects unknown wake steps', async () => {
  const fs = await import('node:fs');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  const { quests } = await import('../../quine/hyphae/quests.ts');
  const out = await quests.write?.([
    'wake-event',
    'browser-write',
    'proved',
    '--detail',
    'browser wrote a wake event',
    '--proof',
    'bad step',
    '--tenant',
    'acme',
  ], { root: tmp, vaultRoot: tmp } as any);

  assert.match(String(out), /wake-event <ingest\|route\|act\|viability\|learn\|persist>/);
  assert.equal(fs.existsSync(`${tmp}/.operator/acme.wake-events.jsonl`), false);
});

test('quests visual envelope is fail-soft when optional visual sources are missing', async () => {
  const fs = await import('node:fs');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  const { buildVisualEnvelope } = await import('../../quine/hyphae/quests.ts');
  const ledger = questLedger({});
  const visual = buildVisualEnvelope(
    { root: tmp } as any,
    'fresh',
    {},
    ledger,
    { source: 'push', derivedAt: '2026-06-22T00:00:00.000Z' },
  );

  assert.equal(visual.lanes.source, 'missing');
  assert.equal(visual.lanes.total, 0);
  assert.match(visual.lanes.gap ?? '', /lane telemetry/);
  assert.equal(visual.senses.rows.find((sense) => sense.id === 'memory')?.on, false);
  assert.match(visual.senses.rows.find((sense) => sense.id === 'memory')?.gap ?? '', /no served cortex evidence/);
  assert.equal(visual.senses.rows.find((sense) => sense.id === 'risk')?.on, true);
  assert.equal(visual.insights.status, 'ready');
  assert.equal(visual.insights.rows[0]?.origin, 'active-frontier');
  assert.equal(visual.insights.rows[0]?.state, 'wait');
  assert.equal(visual.stance.status, 'insufficient');
  assert.equal(visual.stance.sampleSize, 0);
  assert.equal(visual.skills.source, 'missing');
  assert.match(visual.skills.gap ?? '', /skill registry/);
  assert.equal(visual.policy.status, 'blocked');
  assert.match(visual.policy.blockers.join(' · '), /skill registry missing/);
  assert.equal(visual.wake.steps.find((step) => step.id === 'viability')?.status, 'missing');
  assert.match(visual.wake.steps.find((step) => step.id === 'viability')?.proof ?? '', /no viability/);
  assert.equal(visual.wake.steps.find((step) => step.id === 'viability')?.source, 'missing');
  assert.equal(visual.wake.steps.find((step) => step.id === 'viability')?.history?.source, 'missing');
  assert.equal(visual.wake.steps.find((step) => step.id === 'viability')?.history?.total, 0);
  assert.equal(visual.npc.relationships.every((rel) => rel.status === 'missing'), true);
  assert.equal(visual.sideQuests.status, 'ready');
  assert.ok(visual.sideQuests.rows.some((row) => row.id === 'wake-proof'));
  assert.ok(visual.sideQuests.rows.some((row) => row.id === 'skill-registry'));
  assert.ok(visual.sideQuests.rows.every((row) => row.status === 'triggered'));
  assert.ok(visual.sideQuests.rows.every((row) => row.owner && row.action.target && row.lifetime.staleAfterMinutes > 0 && row.completion.kind));
});

test('reconcileFounder leaves non-root tenants alone (returns null)', async () => {
  const { reconcileFounder } = await import('../../quine/hyphae/quests.ts');
  const out = reconcileFounder({ completedArcs: [], derivedFrom: 'cambium', derivedAt: 'x' }, { rows: [] } as any, 'mathis');
  assert.equal(out, null);
});
