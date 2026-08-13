// cambium-quests · miniapp page chunk — Inspect scene: proof map, wake/senses/lanes/policy, branch map, audit panels
// P2-W3 rebuild (T-023/T-024): ProofList rows render founder-readable labels (frozen/06 §2.1), group
// summaries trimmed to the frozen/06 §1.6 I2–I6 canon (≤8-word details, `proof · packets · freshness ·
// evidence` maphead, `Proof links` section, `no action requests` empty token, `Open proof` button),
// branch-map read model rendered visually (T-024: glyph rows + SignalRail from served sheet rows; proof
// digests stay mono in the sheet; 503 → blocked row, 404 → EMPTY panel), story beat provenance absorbed
// into the evidence group (frozen/06 §1.5 S5 final), copy affordance deleted (frozen/05 §4.1 — the proof
// summary renders as mono values, never a Copy button). Raw routes/schemas stay HERE only (T-023).
// Data contract: docs/architecture/contracts/scenes/inspect.json (fixtures: scenes/fixtures/inspect.fixture.json).
// Assembly order: page/index.ts.
import { CAMBIUM_LANES, CAMBIUM_SENSES, CAMBIUM_VISUAL_RAILS, CAMBIUM_VISUAL_STAGES, CAMBIUM_WAKE_STEPS } from '../../../../../shared/cambium-visual-contract.ts';

export const SCENE_INSPECT = `/* ── inspect — proof, packet, freshness, and system detail ── */
const N1 = (v) => (Math.round(v * 10) / 10);
const STAGES = ${JSON.stringify(CAMBIUM_VISUAL_STAGES)};
const RAILS = ${JSON.stringify(CAMBIUM_VISUAL_RAILS)};
const WAKE_CONTRACT = ${JSON.stringify(CAMBIUM_WAKE_STEPS)};
const SENSE_CONTRACT = ${JSON.stringify(CAMBIUM_SENSES)};
const LANE_CONTRACT = ${JSON.stringify(CAMBIUM_LANES)};
const hasText = (rows, rx) => rows.some(row => rx.test([row.title, row.evidence, row.id, row.arc].join(' ')));
const rowLabel = row => row.arc + ' · ' + row.title;
const stageTitle = id => (STAGES.find(stage => stage.id === id) || { title:id.toUpperCase() }).title;
function completedRows(L){ return L.rows.filter(row => row.status === 'complete'); }
function activeRow(L){ return L.rows.find(row => row.status === 'active'); }
function stageForArc(arc){
  const stage = STAGES.find(s => s.arcs.includes(String(arc)));
  return stage ? stage.id : 'ops';
}
function stageRows(L, stage){
  return L.rows.filter(row => stage.arcs.includes(String(row.arc)));
}
function minutesSince(iso){
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60000)) : null;
}
function wakeSteps(env){
  const L = env.ledger;
  const served = env.wake && Array.isArray(env.wake.steps) ? env.wake.steps : null;
  if (served) {
    return WAKE_CONTRACT.map(step => {
      const row = served.find(s => s && s.id === step.id) || {};
      return {
        ...step,
        done:row.status === 'proved',
        detail:row.detail || row.gap || step.missing,
        proof:row.proof || row.gap || step.missing,
        source:row.source || (env.wake && env.wake.source) || 'missing',
        evidence:Array.isArray(row.evidence) ? row.evidence : [],
        history:row.history || { source:'missing', total:0, status:'none', proof:'no operator wake events served', rows:[] },
      };
    });
  }
  const active = activeRow(L);
  const rows = L.rows || [];
  return WAKE_CONTRACT.map(step => {
    const history = { source:'missing', total:0, status:'none', proof:'no operator wake events served', rows:[] };
    if (step.id === 'ingest') return { ...step, done:!!env.source, detail:env.source || step.missing, proof:env.source ? 'legacy source ' + env.source : step.missing, source:'legacy-local', evidence:[], history };
    if (step.id === 'route') return { ...step, done:!!active || L.completed === L.total, detail:active ? rowLabel(active) : 'all arcs complete', proof:active ? rowLabel(active) : L.completed + '/' + L.total + ' quests complete', source:'legacy-local', evidence:[], history };
    if (step.id === 'act') return { ...step, done:rows.some(row => row.status !== 'locked'), detail:L.completed + '/' + L.total + ' quest rows', proof:rows.filter(row => row.status !== 'locked').length + '/' + L.total + ' active or complete rows', source:'legacy-local', evidence:[], history };
    if (step.id === 'viability') return { ...step, done:hasText(rows, /viability|gate|approval|deposit|deploy|sign.?off|margin/i), detail:hasText(rows, /viability|gate|approval|deposit|deploy|sign.?off|margin/i) ? 'evidence present' : step.missing, proof:step.missing, source:'legacy-local', evidence:[], history };
    if (step.id === 'learn') return { ...step, done:hasText(rows, /memory|cortex|lesson|learn|mint|archive/i), detail:hasText(rows, /memory|cortex|lesson|learn|mint|archive/i) ? 'memory trace' : step.missing, proof:step.missing, source:'legacy-local', evidence:[], history };
    if (step.id === 'persist') return { ...step, done:!!env.derivedAt, detail:env.derivedAt ? 'ledger snapshot' : step.missing, proof:env.derivedAt ? 'derivedAt ' + env.derivedAt : step.missing, source:'legacy-local', evidence:[], history };
    return { ...step, done:false, detail:step.missing, proof:step.missing, source:'legacy-local', evidence:[], history };
  });
}
function renderWake(env){
  return '<div class="wakegrid">' + wakeSteps(env).map((step, i) =>
    '<button type="button" class="wake-step ' + (step.done ? 'done' : 'wait') + '" data-wake="' + i + '"><b>' + esc(step.label) + '</b><span>' + esc(step.detail) + '</span></button>'
  ).join('') + '</div>';
}
function senseEcosystemTarget(id){
  if (id === 'signal') return 'quine';
  if (id === 'memory') return 'cortex';
  if (id === 'risk' || id === 'drift') return 'operator-policy';
  return 'cambium-worker';
}
function senseEmptyDetail(sense){
  return sense.id === 'memory' ? 'no tenant cortex rows served' : sense.empty;
}
function senseCards(env){
  const senseEnv = env.senses || {};
  const served = Array.isArray(senseEnv.rows) ? senseEnv.rows : null;
  if (served) {
    return SENSE_CONTRACT.map(sense => {
      const row = served.find(item => item && item.id === sense.id) || {};
      const evidence = Array.isArray(row.evidence) ? row.evidence : [];
      const empty = senseEmptyDetail(sense);
      return {
        ...sense,
        on:!!row.on,
        detail:row.detail || row.gap || empty,
        proof:row.proof || row.gap || empty,
        source:row.source || senseEnv.source || 'missing',
        target:senseEcosystemTarget(sense.id),
        evidence,
      };
    });
  }
  const L = env.ledger;
  const rows = L.rows || [];
  const active = activeRow(L);
  const cortexRows = rows.filter(row => stageForArc(row.arc) === 'cortex');
  const riskRows = rows.filter(row => row.status === 'locked' || /pending|blocked|missing|unreachable|rejected/i.test(row.evidence || ''));
  const age = minutesSince(env.derivedAt);
  return SENSE_CONTRACT.map(sense => {
    const target = senseEcosystemTarget(sense.id);
    const empty = senseEmptyDetail(sense);
    if (sense.id === 'signal') return { ...sense, on:!!active, detail:active ? rowLabel(active) : empty, source:'legacy-local', target, evidence:[] };
    if (sense.id === 'memory') return { ...sense, on:cortexRows.some(row => row.status !== 'locked'), detail:cortexRows.length ? cortexRows.filter(row => row.status !== 'locked').length + '/' + cortexRows.length + ' cortex rows' : empty, source:'legacy-local', target, evidence:[] };
    if (sense.id === 'risk') return { ...sense, on:riskRows.length > 0, detail:riskRows.length ? riskRows.length + ' locked or pending traces' : empty, source:'legacy-local', target, evidence:[] };
    if (sense.id === 'drift') return { ...sense, on:age === null || age > 360, detail:age === null ? 'freshness missing' : age > 360 ? Math.round(age / 60) + 'h stale' : empty, source:'legacy-local', target, evidence:[] };
    return { ...sense, on:false, detail:empty, source:'legacy-local', target, evidence:[] };
  });
}
function renderSenses(env){
  return '<div class="sensegrid">' + senseCards(env).map(sense =>
    '<button type="button" class="sense ' + (sense.on ? 'on' : '') + '" data-interaction-kind="sheet" data-source="' + esc(sense.source || 'missing') + '" data-sense="' + sense.id + '" data-ecosystem-target="' + esc(sense.target || senseEcosystemTarget(sense.id)) + '"><b>' + esc(sense.title) + '</b>' + esc(sense.detail) + '</button>'
  ).join('') + '</div>';
}
function laneCards(env){
  const laneEnv = env.lanes || {};
  const stance = env.stance || {};
  const counts = laneEnv.counts || {};
  const total = Number(laneEnv.total ?? Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0));
  const sampleSize = Number(stance.sampleSize ?? total ?? 0);
  const ratios = stance.ratios || {};
  return LANE_CONTRACT.map(lane => {
    const n = Number(counts[lane.id] || 0);
    const ratio = n > 0 ? Number(ratios[lane.id] ?? (total ? n / total : 0)) : 0;
    const source = n > 0 ? (laneEnv.source || 'world.log') : 'missing';
    const laneSampleSize = n > 0 ? sampleSize : 0;
    return {
      ...lane,
      on:n > 0,
      detail:n > 0 ? n + ' move' + (n === 1 ? '' : 's') : (laneEnv.gap || lane.empty),
      source,
      count:n,
      ratio,
      sampleSize:laneSampleSize,
      worldLog:n > 0 ? n + ' world.log lane row' + (n === 1 ? '' : 's') : 'missing',
      stanceContribution:n > 0 && stance.status === 'ready'
        ? (Math.round(ratio * 100) + '% of tenant stance sample')
        : 'no stance contribution',
      recommendation:n > 0 ? 'read-only lane evidence; no browser action' : 'no recommendation',
    };
  });
}
function renderLanes(env){
  return '<div class="sensegrid">' + laneCards(env).map(lane =>
    '<button type="button" class="sense ' + (lane.on ? 'on' : '') + '" data-interaction-kind="sheet" data-source="' + esc(lane.source || 'missing') + '" data-lane="' + lane.id + '" data-ecosystem-target="operator-policy"><b>' + esc(lane.title) + '</b>' + esc(lane.detail) + '</button>'
  ).join('') + '</div>';
}
function stanceCard(env){
  const stance = env.stance || {};
  if (stance.status !== 'ready') {
    return {
      state:'wait',
      title:'STANCE GAP',
      detail:stance.gap || 'tenant lane-history rule not served',
    };
  }
  const ratios = stance.ratios || {};
  const ratioText = LANE_CONTRACT.map(lane => lane.title + ' ' + Math.round(Number(ratios[lane.id] || 0) * 100) + '%').join(' · ');
  return {
    state:'ready',
    title:stance.label || 'BALANCED',
    detail:(stance.sampleSize || 0) + '/' + (stance.window || 24) + ' tenant events · ' + ratioText,
  };
}
function renderStance(env){
  const stance = stanceCard(env);
  return '<div class="boxgrid"><button type="button" class="ibox ' + (stance.state === 'ready' ? 'ready' : 'gap') + '" data-stance="1"><b>' + esc(stance.title) + '</b><span>' + esc(stance.detail) + '</span></button></div>';
}
function policyCard(env){
  const policy = env.policy || {};
  const blockers = Array.isArray(policy.blockers) ? policy.blockers : [];
  const cautions = Array.isArray(policy.cautions) ? policy.cautions : [];
  if (policy.status === 'ready' && policy.action) {
    return {
      state:'ready',
      title:policy.title || 'NEXT ACTION',
      detail:String(policy.action) + (policy.detail ? ' · ' + String(policy.detail) : ''),
      blockers,
      cautions,
    };
  }
  return {
    state:'wait',
    title:policy.title || 'POLICY GAP',
    detail:policy.detail || policy.gap || blockers[0] || 'next-action recommendation policy missing',
    blockers,
    cautions,
  };
}
function renderPolicy(env){
  const policy = policyCard(env);
  return '<div class="boxgrid"><button type="button" class="ibox ' + (policy.state === 'ready' ? 'ready' : 'gap') + '" data-policy="1"><b>' + esc(policy.title) + '</b><span>' + esc(policy.detail) + '</span></button></div>';
}
function decisionContextCards(env){
  const ctx = env.decisionContext || {};
  const rows = Array.isArray(ctx.rows) ? ctx.rows : [];
  if (!rows.length) {
    return [{
      title:'DECISION CONTEXT',
      state:'wait',
      detail:ctx.gap || 'advanced priority signals not served',
      proof:'decisionContext.rows missing from visual envelope',
      source:ctx.source || 'missing',
      scope:'tenant-only',
      evidence:[],
    }];
  }
  return rows.slice(0, 6).map(row => ({
    title:String(row.title || row.id || 'decision context').toUpperCase(),
    state:row.state === 'served' ? 'ready' : 'wait',
    detail:row.detail || row.gap || 'decision signal missing',
    proof:row.proof || row.gap || 'proof missing from decision signal row',
    source:row.source || ctx.source || 'missing',
    scope:row.scope || 'tenant-only',
    evidence:Array.isArray(row.evidence) ? row.evidence : [],
  }));
}
function renderDecisionContext(env){
  return '<div class="boxgrid">' + decisionContextCards(env).map((row, i) =>
    '<button type="button" class="ibox decision ' + (row.state === 'ready' ? 'ready' : 'gap') + '" data-decision="' + i + '"><b>' + esc(row.title) + '</b><span>' + esc(row.detail) + '</span></button>'
  ).join('') + '</div>';
}
function sideQuestOverclaimText(value){
  return /\\b(reward|bonus|hidden\\s+quest|leaderboard|rank|social[-\\s]proof)\\b/i.test(String(value || ''));
}
function sideQuestSafeText(value, fallback){
  const text = String(value || '');
  const fallbackText = String(fallback || '');
  const safeFallback = sideQuestOverclaimText(fallbackText) ? 'served side quest field omitted' : fallbackText;
  return sideQuestOverclaimText(text) ? safeFallback : (text || safeFallback);
}
function sideQuestSafeAction(action, fallbackTarget){
  const safe = action || {};
  return {
    kind:safe.kind || 'inspect',
    label:sideQuestSafeText(safe.label, 'Inspect evidence'),
    target:sideQuestSafeText(safe.target, fallbackTarget || 'side quest'),
  };
}
function sideQuestSafeRuntime(runtime, fallbackStatus){
  const safe = runtime || {};
  return {
    source:sideQuestSafeText(safe.source, 'missing'),
    status:sideQuestSafeText(safe.status, fallbackStatus || 'triggered'),
    total:Number(safe.total || 0),
    proof:sideQuestSafeText(safe.proof, 'operator side-quest event proof omitted'),
    rows:Array.isArray(safe.rows) ? safe.rows.map(row => ({
      id:sideQuestSafeText(row && row.id, 'event'),
      status:sideQuestSafeText(row && row.status, 'queued'),
      source:sideQuestSafeText(row && row.source, safe.source || 'missing'),
      detail:sideQuestSafeText(row && row.detail, 'operator event detail omitted'),
      proof:sideQuestSafeText(row && row.proof, 'operator event proof omitted'),
    })) : [],
  };
}
function sideQuestCards(env){
  const side = env.sideQuests || {};
  const rows = Array.isArray(side.rows) ? side.rows : [];
  if (!rows.length) {
    return [{
      title:'SIDE QUESTS',
      state:'wait',
      status:'triggered',
      detail:side.gap || 'side quest triggers not served',
      trigger:'sideQuests.empty',
      proof:'no pure trigger rows served',
      owner:'system',
      action:{ label:'Wait for served triggers', kind:'inspect', target:'sideQuests' },
      lifetime:{ detail:'empty until a fresh visual envelope serves side quest rows' },
      completion:{ proof:'a sideQuests.rows entry is served from a pure trigger predicate' },
      runtime:{ source:'missing', status:'triggered', total:0, proof:'no operator side-quest events served', rows:[] },
    }];
  }
  return rows.slice(0, 6).map(row => {
    const runtime = row.runtime || { source:'missing', status:row.status || 'triggered', total:0, proof:'no operator side-quest events served', rows:[] };
    const status = runtime.status || row.status || 'triggered';
    const id = row.id || row.action?.target || row.title || 'side-quest';
    return {
      id:sideQuestSafeText(id, 'side-quest'),
      title:sideQuestSafeText(String(row.title || row.id || 'side quest').toUpperCase(), 'SERVED TRIGGER'),
      state:status === 'expired' ? 'wait' : 'ready',
      status:sideQuestSafeText(status, 'triggered'),
      detail:sideQuestSafeText(row.detail, 'side quest trigger active'),
      trigger:sideQuestSafeText(row.trigger, 'trigger missing'),
      proof:sideQuestSafeText(row.proof, 'proof missing from side quest row'),
      origin:sideQuestSafeText(row.origin || side.source, 'unknown'),
      owner:sideQuestSafeText(row.owner, 'system'),
      action:sideQuestSafeAction(row.action, 'side-quest'),
      lifetime:{ ...(row.lifetime || {}), detail:sideQuestSafeText(row.lifetime && row.lifetime.detail, 'lifetime not served') },
      completion:{ ...(row.completion || {}), proof:sideQuestSafeText(row.completion && row.completion.proof, 'completion proof not served') },
      runtime:sideQuestSafeRuntime(runtime, status),
    };
  });
}
function renderSideQuests(env){
  return '<div class="boxgrid">' + sideQuestCards(env).map((quest, i) =>
    '<button type="button" class="ibox side ' + (quest.state === 'ready' ? 'ready' : 'gap') + '" data-side="' + i + '"' + (quest.state === 'ready' && ['refresh', 'founder-review', 'collect-evidence'].includes(String(quest.action.kind || '')) ? ' data-signed-action-entrypoint="queue-side-quest"' : '') + '><b>' + esc(quest.title) + '</b><span>' + esc(quest.detail) + '</span></button>'
  ).join('') + '</div>';
}
function socialCards(env){
  const social = env.social || {};
  const rows = Array.isArray(social.rows) ? social.rows : [];
  const overclaimText = value => /\\b(leaderboard|social[-\\s]proof|popularity|rank|follower|viral)\\b/i.test(String(value || ''));
  const safeMeta = (value, fallback) => overclaimText(value) ? fallback : (value || fallback);
  const overclaim = row => overclaimText([
    row && row.title,
    row && row.detail,
    row && row.proof,
    ...(Array.isArray(row && row.evidence) ? row.evidence.flatMap(item => item && typeof item === 'object' ? Object.values(item) : []) : []),
  ].filter(Boolean).join(' '));
  const safeEvidence = row => Array.isArray(row && row.evidence)
    ? row.evidence.filter(item => item && typeof item === 'object' && !overclaimText(Object.values(item).filter(Boolean).join(' '))).map(item => ({
      label:safeMeta(item.label, 'row'),
      status:safeMeta(item.status, 'served'),
      detail:safeMeta(item.detail, ''),
    }))
    : [];
  const safeRows = rows.filter(row => !overclaim(row));
  if (!safeRows.length) {
    return [{
      title:'SOCIAL GAP',
      state:'wait',
      detail:rows.length ? 'coordination rows rejected because they were not tenant handoff evidence' : safeMeta(social.gap, 'no tenant-scoped bridge or handoff evidence served'),
      proof:rows.length ? 'tenant handoff evidence must come from explicit bridge, handoff, or founder gate sources' : 'no coordination rows served',
      source:safeMeta(social.source, 'missing'),
      scope:safeMeta(social.scope, 'tenant-handoff-only'),
      evidence:[],
    }];
  }
  return safeRows.slice(0, 5).map(row => ({
    title:String(row.title || row.id || 'coordination').toUpperCase(),
    state:row.state === 'ready' ? 'ready' : 'wait',
    detail:safeMeta(row.detail || row.gap, 'coordination evidence missing'),
    proof:safeMeta(row.proof || row.gap, 'proof missing from coordination row'),
    source:safeMeta(row.source || social.source, 'coordination-evidence@v1'),
    scope:safeMeta(row.scope || social.scope, 'tenant-handoff-only'),
    evidence:safeEvidence(row),
  }));
}
function renderSocial(env){
  return '<div class="boxgrid">' + socialCards(env).map((row, i) =>
    '<button type="button" class="ibox social ' + (row.state === 'ready' ? 'ready' : 'gap') + '" data-social="' + i + '"><b>' + esc(row.title) + '</b><span>' + esc(row.detail) + '</span></button>'
  ).join('') + '</div>';
}
function liveProofCards(env){
  const proof = env.liveProof || {};
  const rows = Array.isArray(proof.rows) ? proof.rows : [];
  const invariant = proof.invariant || 'Capture commands create redacted receipts; they are proof only after their artifacts validate ready.';
  if (!rows.length) {
    return [{
      title:'LIVE PROOF GAP',
      state:'wait',
      rawState:'gap',
      detail:proof.gap || 'live proof readiness not served',
      proof:'liveProof.rows missing from visual envelope',
      source:proof.source || 'missing',
      writes:'.artifacts/tg-miniapp-live-proof/readiness.json',
      command:'npm run proof:tg-live-readiness',
      prerequisites:[{ label:'readiness.json', status:'blocked', detail:'not served' }],
      privacy:['capture plan is run guidance, not proof'],
      invariant,
    }];
  }
  return rows.slice(0, 3).map(row => {
    const prereqs = Array.isArray(row.prerequisites) ? row.prerequisites : [];
    const rawState = row.state || 'gap';
    const state = rawState === 'complete' || rawState === 'ready' ? 'ready' : rawState === 'ready-to-capture' ? 'capture' : 'wait';
    return {
      title:String(row.title || row.id || 'live proof').toUpperCase(),
      state,
      rawState,
      detail:row.detail || (prereqs.length ? prereqs.filter(item => item.status !== 'ready').length + '/' + prereqs.length + ' prerequisites blocked' : 'capture plan detail missing'),
      proof:row.proof || invariant,
      source:row.source || proof.source || 'missing',
      writes:row.writes || '',
      command:row.command || 'npm run proof:tg-live-readiness',
      prerequisites:prereqs.map((item, i) => ({
        label:item.label || item.id || ('prerequisite ' + (i + 1)),
        status:item.status || item.state || 'blocked',
        detail:item.detail || 'detail missing',
      })),
      privacy:Array.isArray(row.privacy) ? row.privacy : ['redacted receipt required'],
      invariant,
    };
  });
}
function renderLiveProof(env){
  return '<div class="boxgrid">' + liveProofCards(env).map((row, i) =>
    '<button type="button" class="ibox liveproof ' + (row.state === 'ready' ? 'ready' : 'gap') + '" data-live-proof="' + i + '"><b>' + esc(row.title) + '</b><span>' + esc(row.detail) + '</span></button>'
  ).join('') + '</div>';
}
function branchEnvelope(env){
  return env.branchStories || {};
}
function branchRows(env){
  const branchEnv = branchEnvelope(env);
  return Array.isArray(branchEnv.rows) ? branchEnv.rows : [];
}
function branchGaps(branch){
  return Array.isArray(branch && branch.gaps) ? branch.gaps : [];
}
function branchGateForMission(branch, mission){
  const gates = Array.isArray(branch && branch.gates) ? branch.gates : [];
  return gates.find(gate => String(gate.gate || '').toLowerCase() === String(mission && mission.gate || '').toLowerCase()) || null;
}
function branchActiveMission(branch){
  const missions = Array.isArray(branch && branch.missions) ? branch.missions : [];
  return missions.find(mission => {
    const gate = branchGateForMission(branch, mission);
    return !gate || gate.status !== 'verified';
  }) || missions[0] || null;
}
function mcList(value){
  return Array.isArray(value) ? value : [];
}
function mcText(value, fallback){
  const text = String(value == null ? '' : value).trim();
  return text || fallback;
}
function mcShortLabel(value, fallback){
  const text = mcText(value, fallback).replace(/\\s+/g, ' ');
  if (text.length <= 18) return text;
  const words = text.split(' ').filter(Boolean);
  return (words.length >= 2 ? words.slice(0, 2).join(' ') : text.slice(0, 17)).replace(/[.,;:]+$/,'') + '…';
}
function mcBranchId(branch, index){
  return mcText(branch && (branch.branchId || branch.productId || branch.arcId), 'branch-' + (index + 1));
}
function mcMissionState(branch, mission){
  const gate = branchGateForMission(branch, mission);
  const status = mcText((gate && gate.status) || (mission && mission.status), 'pending');
  return mcStateKind(status);
}
function mcOrganSlug(value){
  const text = String(value || '').toLowerCase();
  if (!text) return '';
  if (/genesis|seed|brand|brief|intake/.test(text)) return 'genesis';
  if (/taste|resonance|copy|visual|acceptance|privacy|review/.test(text)) return 'taste';
  if (/build|hands|code|qa|repo|widget|route|claim table|proof table|scaffold/.test(text)) return 'build';
  if (/cortex|memory|lesson|learn|recall/.test(text)) return 'cortex';
  if (/ops|will|hermes|garden|launch|gtm|tenant|publish|rollback|service|outreach|operate/.test(text)) return 'ops';
  return MC_COMPONENT_REGISTRY.MissionGlyph.includes(text) ? text : '';
}
function mcVisualStageFromArc(value){
  const arc = String(value || '').trim();
  if (!/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII)$/.test(arc)) return '';
  return stageForArc(arc);
}
function mcBranchStatusText(branch){
  const source = branch && branch.source ? branch.source : {};
  const freshness = branch && branch.freshness ? branch.freshness : {};
  const promotion = branch && branch.promotion ? branch.promotion : {};
  const controls = branch && branch.controls ? branch.controls : {};
  const ui = controls.ui || {};
  return [
    branch && branch.status,
    branch && branch.currentState,
    source.status,
    source.freshness,
    source.staleReason,
    freshness.status,
    freshness.state,
    freshness.detail,
    promotion.state,
    promotion.currentGate,
    ui.currentFrontier,
  ].filter(Boolean).join(' ');
}
function mcBranchEnvelopeStale(env, branchEnv){
  const text = [branchEnv && branchEnv.status, branchEnv && branchEnv.state, branchEnv && branchEnv.freshness, branchEnv && branchEnv.staleReason, env && env.freshness && env.freshness.state, env && env.freshness && env.freshness.detail].filter(Boolean).join(' ');
  const minutes = minutesSince(env && env.derivedAt);
  return /stale|expired|old|refresh/i.test(text) || (minutes !== null && minutes > 360);
}
function mcOrganMetaForBranch(branch, mission){
  const routes = mcList(branch && branch.controls && branch.controls.organRouting);
  const route = routes.find(row => !/verified|complete|done/i.test(String((row && (row.status || row.currentGate)) || ''))) || routes[0] || null;
  const routed = route && mcOrganSlug(route.organ || route.owner || route.output || route.currentGate);
  const candidates = [
    routed,
    mcOrganSlug(branch && (branch.organ || branch.visualStage || branch.stage)),
    mcOrganSlug(mission && (mission.owner || mission.gate || mission.dispatchTarget || mission.title)),
    mcVisualStageFromArc(branch && branch.arc),
    mcOrganSlug(branch && (branch.arcTitle || branch.role || branch.productId || branch.branchId)),
  ].filter(Boolean);
  const neutral = !candidates.length;
  const glyph = candidates.find(kind => MC_COMPONENT_REGISTRY.MissionGlyph.includes(kind)) || 'arc';
  const label = neutral ? 'Neutral organ' : (route && route.organ ? route.organ : stageTitle(glyph));
  const source = neutral ? 'neutral organ fallback' : (route ? 'organRouting' : (branch && branch.arc ? 'shared visual arc' : 'mission data'));
  return {
    glyph,
    label:mcText(label, stageTitle(glyph)),
    source,
    neutral,
    state:neutral ? 'idle' : mcStateKind(route && (route.status || route.currentGate)),
    detail:neutral ? 'unknown arc; idle visual fallback' : (route ? mcText(route.currentGate || route.proofPath || route.owner, 'organ route pending') : mcText(branch && (branch.arcTitle || branch.role), 'branch organ inferred')),
  };
}
function mcGlyphForQuestStage(stage, index, total){
  const text = [stage && stage.glyph, stage && stage.organ, stage && stage.title, stage && stage.id, stage && stage.status].filter(Boolean).join(' ');
  if (/proof|receipt|evidence/i.test(text)) return 'proof';
  if (/gate|approval|review/i.test(text)) return 'gate';
  const organ = mcOrganSlug(text);
  if (organ) return organ;
  if (index === 0) return 'genesis';
  if (index === total - 1) return 'ops';
  return 'build';
}
function mcKpiState(row){
  const text = [row && row.currentState, row && row.survival, row && row.betterThanSurvival].filter(Boolean).join(' ');
  if (/blocked|missing|not proven|no signal|gap/i.test(text)) return 'proof-needed';
  return mcStateKind(text || 'active');
}
function mcKpiProgress(row){
  const state = mcKpiState(row);
  if (state === 'complete') return 100;
  if (state === 'blocked') return 28;
  if (state === 'proof-needed' || state === 'stale') return 42;
  return 64;
}
function mcUniqueRows(rows){
  const seen = {};
  return rows.filter(row => {
    const key = [row.label, row.source, row.detail].map(item => String(item || '')).join('|');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}
function mcQuestline(branch){
  const served = mcList(branch && branch.questline);
  if (served.length) return served.map((stage, index) => ({
    id:mcText(stage && stage.id, 'stage-' + (index + 1)),
    title:mcText(stage && stage.title, 'Stage ' + (index + 1)),
    status:mcText(stage && stage.status, 'pending'),
    state:mcStateKind(stage && stage.status),
  }));
  const missions = mcList(branch && branch.missions);
  if (missions.length) return missions.map((mission, index) => ({
    id:mcText(mission && mission.missionId, 'mission-' + (index + 1)),
    title:mcText(mission && mission.title, 'Mission ' + (index + 1)),
    status:mcText((branchGateForMission(branch, mission) || {}).status, 'pending'),
    state:mcMissionState(branch, mission),
  }));
  const gates = mcList(branch && branch.gates);
  if (gates.length) return gates.map((gate, index) => ({
    id:mcText(gate && gate.gate, 'gate-' + (index + 1)),
    title:mcText(gate && gate.gate, 'Gate ' + (index + 1)),
    status:mcText(gate && gate.status, 'pending'),
    state:mcStateKind(gate && gate.status),
  }));
  return [{ id:'mission-gap', title:'Mission queue missing', status:'blocked', state:'blocked' }];
}
function mcQuestlineRailState(stage, next){
  const state = mcStateKind((stage && (stage.state || stage.status)) || 'idle');
  const nextState = mcStateKind((next && (next.state || next.status)) || 'idle');
  if (state === 'blocked' || state === 'proof-needed' || state === 'stale') return state;
  if (nextState === 'blocked' || nextState === 'proof-needed' || nextState === 'stale') return nextState;
  if (nextState === 'locked') return 'locked';
  if (state === 'complete' || state === 'active' || state === 'selected') return 'active';
  return nextState || state;
}
function mcBlockers(env, branch){
  const rows = [];
  mcList(branch && branch.gaps).forEach((gap, index) => {
    if (mcStateKind(gap && gap.status) !== 'complete') rows.push({
      id:mcText(gap && gap.id, 'gap-' + (index + 1)),
      label:mcText(gap && gap.detail, 'Branch gap'),
      state:mcStateKind(gap && gap.status),
      source:mcText(gap && gap.source, 'branchStories.gaps'),
    });
  });
  mcList(branch && branch.gates).forEach((gate, index) => {
    if (mcStateKind(gate && gate.status) !== 'complete') rows.push({
      id:'gate-' + (index + 1),
      label:mcText(gate && gate.gate, 'Gate') + ' · ' + mcText(gate && gate.requiredProof, 'required proof missing'),
      state:mcStateKind(gate && gate.status),
      source:'branchStories.gates',
    });
  });
  const approvals = branch && branch.controls ? mcList(branch.controls.approvals) : [];
  approvals.forEach((approval, index) => {
    if (mcStateKind(approval && approval.status) !== 'complete') rows.push({
      id:'approval-' + (index + 1),
      label:mcText((approval && (approval.requiredApproval || approval.failureMode || approval.permission)), 'Founder approval missing'),
      state:mcStateKind(approval && approval.status),
      source:'branch.controls.approvals',
    });
  });
  const policy = policyCard(env);
  if (policy.state !== 'ready') rows.push({
    id:'policy',
    label:policy.detail,
    state:'blocked',
    source:'policy',
  });
  liveProofCards(env).filter(row => row.state !== 'ready').forEach((row, index) => rows.push({
    id:'live-proof-' + (index + 1),
    label:row.title + ' · ' + row.detail,
    state:row.state === 'capture' ? 'proof-needed' : 'blocked',
    source:row.source || 'liveProof',
  }));
  return mcUniqueRows(rows);
}
function mcProofNeeded(branch, mission){
  const gate = branchGateForMission(branch, mission);
  const rows = [];
  const add = (label, source, detail) => {
    const safe = mcText(label, '');
    if (safe) rows.push({ label:safe, source, detail:mcText(detail, safe), state:'proof-needed' });
  };
  add(mission && mission.proofRequired, 'branchStories.missions', mission && mission.title);
  add(gate && gate.requiredProof, 'branchStories.gates', gate && gate.gate);
  mcList(branch && branch.proofPaths).forEach(proof => add(proof && proof.validates, 'branchStories.proofPaths', (proof && (proof.proofId || proof.promotes))));
  return mcUniqueRows(rows.length ? rows : [{ label:'proof requirement missing', source:'branchStories', detail:'mission proof requirement missing', state:'blocked' }]);
}
function mcKpis(branch){
  return mcList(branch && branch.kpis).map((kpi, index) => ({
    id:mcText(kpi && kpi.kpiId, 'kpi-' + (index + 1)),
    label:mcText(kpi && kpi.label, 'KPI ' + (index + 1)),
    currentState:mcText(kpi && kpi.currentState, 'not proven'),
    survival:mcText(kpi && kpi.survival, 'survival threshold missing'),
    betterThanSurvival:mcText(kpi && kpi.betterThanSurvival, 'better-than-survival threshold missing'),
    source:mcText(kpi && kpi.source, 'branchStories.kpis'),
  }));
}
function mcControls(branch){
  const controls = branch && branch.controls ? branch.controls : {};
  return {
    ui:controls.ui || {},
    approvals:mcList(controls.approvals),
    dispatchHints:mcList(controls.dispatchHints),
    policySignals:mcList(controls.policySignals),
    organRouting:mcList(controls.organRouting),
    variableContractPayloads:mcList(controls.variableContractPayloads),
    adapterServiceMap:mcList(controls.adapterServiceMap),
    evidenceLedger:mcList(controls.evidenceLedger),
    autonomyBoundary:mcText(controls.autonomyBoundary, 'proof must fold back before autonomy claims'),
  };
}
function branchLoopEnvelope(env){
  return env && env.branchLoops ? env.branchLoops : { rows: [] };
}
function branchLoopRows(env, branchId){
  const rows = Array.isArray(branchLoopEnvelope(env).rows) ? branchLoopEnvelope(env).rows : [];
  return rows.filter(row => String(row.branchId || row.productId || '') === String(branchId || ''));
}
function mcLoopBoundaryColor(row){
  const color = String((row && row.boundaryColor) || '').toLowerCase();
  if (color === 'green' || color === 'yellow' || color === 'red') return color;
  return 'red';
}
function mcLoopRunMode(row){
  const raw = String((row && row.runMode) || '').toLowerCase();
  if (raw === 'read-only' || raw === 'approval-required' || raw === 'never-alone') return raw;
  const boundaryColor = mcLoopBoundaryColor(row);
  if (boundaryColor === 'green') return 'read-only';
  if (boundaryColor === 'red') return 'never-alone';
  return 'approval-required';
}
function mcBranchControlLoops(branch){
  const controlLoops = mcList(branch && branch.controls && branch.controls.loops);
  if (controlLoops.length) return controlLoops;
  return mcList(branch && branch.loops);
}
function mcLoopCadence(row){
  const cadence = mcText(row && row.cadence, 'manual review');
  if (/\\b(scheduled|autonomous|unattended|cron|automatic|auto-run)\\b/i.test(cadence)) {
    return mcLoopRunMode(row) === 'read-only' ? 'manual review' : 'manual approval required';
  }
  return cadence;
}
function mcLoopViewRow(row){
  return {
    ...row,
    boundaryColor:mcLoopBoundaryColor(row),
    cadence:mcLoopCadence(row),
    runMode:mcLoopRunMode(row),
    title:mcText(row && row.title, mcText(row && row.loopId, 'Loop control')),
    stopRule:mcText(row && row.stopRule, 'stop rule missing'),
  };
}
function mcLoopRowMerge(primary, fallback){
  const merged = { ...(fallback || {}) };
  const source = primary || {};
  Object.keys(source).forEach(key => {
    const value = source[key];
    if (value == null) return;
    if (typeof value === 'string' && value.trim() === '') return;
    merged[key] = value;
  });
  return merged;
}
function mcLoopRows(env, branch, branchId){
  const visualRows = branchLoopRows(env, branchId);
  const fallbackRows = mcBranchControlLoops(branch);
  const usedFallback = new Set();
  const mergedVisualRows = visualRows.map(row => {
    const loopId = mcText(row && row.loopId, '');
    const fallbackIndex = loopId ? fallbackRows.findIndex(loop => mcText(loop && loop.loopId, '') === loopId) : -1;
    if (fallbackIndex >= 0) usedFallback.add(fallbackIndex);
    return mcLoopViewRow(mcLoopRowMerge(row, fallbackIndex >= 0 ? fallbackRows[fallbackIndex] : null));
  });
  const remainingFallbackRows = fallbackRows
    .filter((_, index) => !usedFallback.has(index))
    .map(mcLoopViewRow);
  return mergedVisualRows.concat(remainingFallbackRows);
}
function mcLoopFocusNarrative(rows){
  return rows.length ? rows.map(loop => (loop.title || loop.loopId) + ' · ' + (loop.boundaryColor || 'yellow') + ' · ' + (loop.stopRule || 'stop rule missing')).join(' / ') : 'loop controls missing';
}
function mcLoopState(row){
  if (!row) return 'blocked';
  if (row.boundaryColor === 'green') return 'active';
  if (row.boundaryColor === 'yellow') return 'proof-needed';
  return 'blocked';
}
function buildMissionControlView(env){
  const branchEnv = branchEnvelope(env || {});
  const rows = branchRows(env || {});
  const requested = mcText(MISSION_BRANCH_FOCUS || PARAMS.get('branch'), '');
  const selectedIndex = Math.max(0, rows.findIndex((branch, index) => requested && mcBranchId(branch, index) === requested));
  const branch = rows[selectedIndex] || rows[0] || null;
  const mission = branchActiveMission(branch);
  const promotion = branch && branch.promotion ? branch.promotion : {};
  const controls = mcControls(branch);
  const source = branch && branch.source ? branch.source : {};
  const nextMission = mission ? {
    id:mcText(mission.missionId, 'mission'),
    title:mcText(mission.title, 'Mission title missing'),
    owner:mcText(mission.owner, 'owner missing'),
    gate:mcText(mission.gate, 'gate missing'),
    proofRequired:mcText(mission.proofRequired, 'proof requirement missing'),
    dispatchTarget:mcText(mission.dispatchTarget, 'dispatch target missing'),
    state:mcMissionState(branch, mission),
  } : {
    id:'mission-gap',
    title:'Mission queue missing',
    owner:'operator',
    gate:'branch packet',
    proofRequired:'mission proof requirement missing',
    dispatchTarget:'inspect',
    state:'blocked',
  };
  return {
    source:mcText(branchEnv.source, 'product-branch-packets@v1'),
    stale:mcBranchEnvelopeStale(env || {}, branchEnv),
    staleDetail:mcText(branchEnv.staleReason || (env && env.freshness && env.freshness.detail), 'refresh before decisions; Inspect keeps timestamp and proof detail'),
    selectedBranchId:branch ? mcBranchId(branch, selectedIndex) : requested,
    selectedBranch:branch,
    branches:rows.slice(0, 12).map((row, index) => {
      const active = branchActiveMission(row);
      const organ = mcOrganMetaForBranch(row, active);
      const rawState = branchCardState(row);
      return {
        id:mcBranchId(row, index),
        name:mcText(row && (row.name || row.productId), 'Product Branch'),
        arcTitle:mcText(row && row.arcTitle, 'branch arc'),
        state:organ.neutral ? 'idle' : rawState,
        organ,
        nextMission:active ? mcText(active.title, 'Mission title missing') : 'mission queue missing',
        selected:row === branch,
      };
    }),
    vision:mcText(branch && branch.vision && branch.vision.statement, 'vision statement missing'),
    icp:mcText(branch && branch.icp && branch.icp.primary, 'ICP missing'),
    nextMission,
    questline:branch ? mcQuestline(branch) : [{ id:'branch-gap', title:'Branch packet missing', status:'blocked', state:'blocked' }],
    blockers:mcBlockers(env || {}, branch),
    proofNeeded:mcProofNeeded(branch, mission),
    kpis:mcKpis(branch),
    loops:branch ? mcLoopRows(env || {}, branch, mcBranchId(branch, selectedIndex)) : [],
    promotion:{
      state:mcText(promotion.state, 'proof-only'),
      currentGate:mcText(promotion.currentGate, nextMission.gate || 'proof gate missing'),
      rule:mcText(promotion.rule, 'proof first; no promotion without foldback evidence'),
    },
    activeOrgan:mcOrganMetaForBranch(branch, mission),
    controls,
    inspect:{
      source:mcText(branchEnv.source, 'product-branch-packets@v1'),
      packetFile:mcText(source.packetFile, 'source packet missing'),
      indexFile:mcText(source.indexFile, 'source index missing'),
      schema:mcText(source.schema, 'cambium.product_branch_packet.v1'),
      tenant:mcText(source.tenant, TENANT),
      derivedAt:mcText(env && env.derivedAt, 'derivedAt missing'),
    },
  };
}
function renderBranchArcRail(view){
  if (!view.branches.length) return '';
  return '<div class="mc-branch-rail" role="tablist" aria-label="Product branches" data-horizontal-scroll="branch-rail" data-no-scene-drag="1">' + view.branches.map((branch, index) =>
    '<button type="button" id="mission-branch-tab-' + index + '" role="tab" aria-selected="' + (branch.selected ? 'true' : 'false') + '" aria-controls="mission-branch-panel" tabindex="' + (branch.selected ? '0' : '-1') + '" class="' + mcClass('mc-branch-chip', branch.state, branch.selected ? 'is-selected mc-selected-halo' : '') + '" data-component="BranchArcChip" data-selected-surface="' + (branch.selected ? 'branch-chip' : 'none') + '" data-mission-branch="' + index + '" data-organ-route="' + esc(branch.organ.glyph) + '" data-no-scene-drag="1" data-interaction-kind="tab" data-source="' + esc(view.source) + '">' +
      mcGlyphSvg(branch.organ.glyph, branch.state, { motion: branch.selected ? 'glyphBreathe' : '' }) +
      '<span class="mc-branch-copy"><b>' + esc(branch.name) + '</b><small>' + esc(branch.organ.label + ' organ · ' + branch.nextMission) + '</small></span>' + mcStateToken(branch.state, branch.state) +
    '</button>'
  ).join('') + '</div>';
}
function renderMissionCard(view){
  const mission = view.nextMission;
  const progress = view.questline.length ? Math.round(100 * view.questline.filter(row => row.state === 'complete').length / view.questline.length) : 0;
  const selectedTabIndex = Math.max(0, view.branches.findIndex(branch => branch.selected));
  return '<section id="mission-branch-panel" role="tabpanel" aria-labelledby="mission-branch-tab-' + selectedTabIndex + '" class="' + mcClass('mc-mission-card', mission.state) + '" data-component="MissionCard" data-interaction-kind="sheet" data-source="' + esc(view.source) + '">' +
    '<div class="mc-card-head"><div>' + mcStateToken(mission.state, 'Next Mission') + '<h3>' + esc(mission.title) + '</h3></div>' + mcOrbitProgress({ value:progress, state:mission.state, label:progress + '%' }) + '</div>' +
    '<p>' + esc(view.vision) + '</p>' +
    '<div class="mc-card-meta"><span><b>Owner</b>' + esc(mission.owner) + '</span><span><b>Gate</b>' + esc(mission.gate) + '</span><span><b>Dispatch</b>' + esc(mission.dispatchTarget) + '</span><span><b>Promotion</b>' + esc(view.promotion.state) + '</span></div>' +
    '<div class="mc-branch-texture" data-component="MissionOrganSignal" data-organ-route="' + esc(view.activeOrgan.glyph) + '">' +
      '<span>' + mcGlyphSvg(view.activeOrgan.glyph, mission.state) + '<span><b>Active organ</b><small>' + esc(view.activeOrgan.label + ' · ' + view.activeOrgan.detail) + '</small></span></span>' +
      mcPacketDots(Math.max(3, view.questline.length), mission.state, { mode:'texture' }) +
    '</div>' +
    mcSignalRail({ state:mission.state, packetCount:Math.max(3, view.questline.length) }) +
  '</section>';
}
function renderQuestlineTimeline(view){
  const currentIndex = Math.max(0, view.questline.findIndex(stage => mcStateKind(stage.state || stage.status) !== 'complete'));
  return '<div data-component="QuestlineTimeline"><div class="mc-section-title">Questline</div><div class="mc-questline" role="list" aria-label="Questline stages" data-no-scene-drag="1">' + view.questline.map((stage, index) =>
    '<div class="mc-questline-row" role="listitem" data-questline-stage-state="' + esc(mcStateKind(stage.state || stage.status)) + '"' + (index === currentIndex ? ' aria-current="step"' : '') + '><span>' + mcGlyphSvg(mcGlyphForQuestStage(stage, index, view.questline.length), stage.state) + '</span><b title="' + esc(stage.title) + '">' + esc(mcText(stage.title, 'Stage')) + '</b>' + mcStateToken(stage.state, stage.status) + (index < view.questline.length - 1 ? mcSignalRail({ state:mcQuestlineRailState(stage, view.questline[index + 1]), packetCount:3 }) : '') + '</div>'
  ).join('') + '</div></div>';
}
function renderMissionStateStack(view){
  const selected = view.selectedBranch ? view.selectedBranch.name || view.selectedBranchId || 'Selected branch' : 'Selected branch';
  const blocker = view.blockers[0] || { label:'No blockers served for this branch packet', state:'idle', source:view.source };
  const proof = view.proofNeeded[0] || { label:'Proof requirement missing', state:'proof-needed', detail:view.nextMission.proofRequired };
  const locked = view.questline.find(row => mcStateKind(row.state || row.status) === 'locked') || view.questline[view.questline.length - 1] || { title:'Launch lock', status:'locked', state:'locked' };
  const rows = [
    { glyph:'cortex', state:'selected', title:'Selected', detail:selected + ' · current focus', token:'selected', focus:'selected' },
    { glyph:'gate', state:blocker.state || 'blocked', title:'Blocked by', detail:blocker.label || 'blocker detail missing', token:mcStateKind(blocker.state || 'blocked'), focus:/proof/i.test(blocker.source || blocker.label || '') ? 'proof' : 'gate' },
    { glyph:'proof', state:proof.state || 'proof-needed', title:'Proof needed', detail:proof.label || proof.detail || 'evidence missing', token:'receipt', focus:'proof', orbit:true },
    { glyph:'ops', state:locked.state || locked.status || 'locked', title:'Locked', detail:(locked.title || 'next stage') + ' · on hold', token:mcStateKind(locked.state || locked.status || 'locked'), focus:'selected' },
  ];
  return '<div data-component="MissionStateStack"><div class="mc-section-title">State Stack</div><div class="mc-state-stack">' + rows.map(row =>
    '<button type="button" class="' + mcClass('mc-state-row', row.state, row.state === 'selected' ? 'is-selected mc-selected-halo' : '') + '" data-selected-surface="' + (row.state === 'selected' ? 'mission-state-row' : 'none') + '" data-mission-state-action="' + esc(row.focus) + '" data-interaction-kind="sheet">' +
      mcGlyphSvg(row.glyph, row.state) +
      '<span><b>' + esc(row.title) + '</b><small>' + esc(row.detail) + '</small></span>' +
      (row.orbit ? mcOrbitProgress({ value:42, state:'proof-needed', label:'Proof' }) : mcStateToken(row.state, row.token)) +
    '</button>'
  ).join('') + '</div></div>';
}
function renderMissionStaleNotice(view){
  if (!view.stale) return '';
  return '<section class="mission-stale-notice" data-component="MissionStalePacketState" data-mission-stale="1"><b>Refresh before decisions</b><span>' + esc(view.staleDetail) + '</span></section>';
}
function renderMissionBlockers(view){
  const rows = view.blockers.length ? view.blockers.slice(0, 5) : [{ label:'No blockers served for this branch packet', state:'idle', source:view.source }];
  return '<div><div class="mc-section-title">Blocked by</div><div class="mc-blockers">' + rows.map(row =>
    '<div class="' + mcClass('mc-blocker-row', row.state) + '"><b>' + esc(row.state || 'state') + '</b>' + esc(row.label || 'blocker detail missing') + '</div>'
  ).join('') + '</div></div>';
}
function renderMissionProofNeeded(view){
  return '<div data-component="ProofList"><div class="mc-section-title">Proof needed</div><div class="mc-proof-list">' + view.proofNeeded.slice(0, 5).map(row =>
    '<button type="button" class="' + mcClass('mc-proof-row', row.state) + '" data-mission-proof-row="1" data-interaction-kind="sheet">' + mcGlyphSvg('proof', row.state) + '<span><b>' + esc(row.label) + '</b>' + esc(row.detail || row.source || 'proof detail missing') + '</span><i aria-hidden="true">›</i></button>'
  ).join('') + '</div></div>';
}
function renderMissionKpis(view){
  const rows = view.kpis.length ? view.kpis.slice(0, 4) : [{ label:'KPI missing', currentState:'not proven', survival:'survival threshold missing' }];
  return '<div data-component="KpiPulse"><div class="mc-section-title">KPIs</div><div class="mc-kpis">' + rows.map((row, index) => mcKpiPulse(row, index)).join('') + '</div></div>';
}
function renderMissionActions(view){
  return '<div class="mc-action-row" data-component="GateActionRow">' +
    '<button type="button" data-no-scene-drag="1" data-mission-action="gate" data-interaction-kind="sheet" data-source="' + esc(view.source) + '" data-ecosystem-target="product-branches" aria-label="Review current branch gate">Review Gate</button>' +
    '<button type="button" class="secondary" data-no-scene-drag="1" data-mission-action="proof" data-interaction-kind="sheet" data-source="' + esc(view.source) + '" data-ecosystem-target="product-branches" aria-label="Open current branch proof">Open Proof</button>' +
  '</div>';
}
function renderMissionToolLink(view){
  return '<section class="mission-tool-link" data-component="MissionToolLink" data-source="' + esc(view.source) + '">' +
    '<span><b>Suggested tool</b><small>branch status lives in Tools</small></span>' +
    '<button type="button" data-mission-action="tools" data-no-scene-drag="1">Open Tools</button>' +
  '</section>';
}
function renderMissionLoops(view){
  const rows = view.loops && view.loops.length ? view.loops.slice(0, 3) : [];
  if (!rows.length) return '';
  return '<section class="mission-tool-link" data-component="BranchLoopControls" data-ecosystem-target="branch-loops">' +
    '<span><b>Loop controls</b><small>' + esc(rows.map(row => (row.title || row.loopId) + ' · ' + row.runMode + ' · ' + row.boundaryColor + ' · ' + row.cadence).join(' / ')) + '</small></span>' +
    '<button type="button" class="secondary" data-mission-action="loops" data-no-scene-drag="1" data-interaction-kind="sheet" data-source="' + esc(view.source) + '" data-ecosystem-target="branch-loops">Open controls</button>' +
  '</section>';
}
function tabKeyTargetIndex(event, index, count){
  if (!event || !count) return null;
  let target = null;
  if (event.key === 'ArrowRight') target = (index + 1) % count;
  else if (event.key === 'ArrowLeft') target = (index - 1 + count) % count;
  else if (event.key === 'Home') target = 0;
  else if (event.key === 'End') target = count - 1;
  if (target !== null && typeof event.preventDefault === 'function') event.preventDefault();
  return target;
}
function focusRenderedTab(rootId, selector){
  const tab = $(rootId).querySelector(selector);
  if (!tab || typeof tab.focus !== 'function') return;
  try { tab.focus({ preventScroll:true }); } catch (_) { tab.focus(); }
}
function bindMissionBranchRailTouch(rail){
  if (!rail || rail.dataset.touchDragBound === '1') return;
  rail.dataset.touchDragBound = '1';
  let startX = 0;
  let startScrollLeft = 0;
  let dragging = false;
  rail.addEventListener('touchstart', event => {
    if (!event.touches || event.touches.length !== 1) return;
    dragging = true;
    startX = event.touches[0].clientX;
    startScrollLeft = rail.scrollLeft;
  }, { passive:true });
  rail.addEventListener('touchmove', event => {
    if (!dragging || !event.touches || event.touches.length !== 1) return;
    const delta = startX - event.touches[0].clientX;
    if (Math.abs(delta) < 2) return;
    if (event.cancelable) event.preventDefault();
    rail.scrollLeft = startScrollLeft + delta;
  }, { passive:false });
  const stopDragging = () => { dragging = false; };
  rail.addEventListener('touchend', stopDragging, { passive:true });
  rail.addEventListener('touchcancel', stopDragging, { passive:true });
}
function selectMissionBranch(env, branchIndex, focusSelected){
  const rows = branchRows(env || {});
  const branch = rows[branchIndex];
  if (!branch) return;
  MISSION_BRANCH_FOCUS = mcBranchId(branch, branchIndex);
  renderMissionControl(env);
  const selected = $('stem').querySelector('[data-mission-branch="' + branchIndex + '"]');
  if (selected && typeof selected.scrollIntoView === 'function') selected.scrollIntoView({ block:'nearest', inline:'center', behavior:RM ? 'auto' : 'smooth' });
  if (focusSelected) focusRenderedTab('stem', '[data-mission-branch="' + branchIndex + '"]');
  buzz('light');
}
function renderMissionControl(env){
  const stem = $('stem');
  const view = buildMissionControlView(env);
  stem.classList.add('mission-control');
  if (!view.selectedBranch) {
    stem.innerHTML = '<div class="mission-empty"><b>Mission control is waiting for branch packets.</b><p>Branch arcs appear only after branch packets reach the visual envelope.</p><div class="mc-action-row" data-component="GateActionRow"><button type="button" data-mission-action="refresh">Refresh</button><button type="button" class="secondary" data-mission-action="inspect">Inspect</button></div></div>';
    resetQuestSummary('branch packets waiting', 'inspect source');
    stem.querySelectorAll('[data-mission-action="refresh"]').forEach(el => el.onclick = () => refresh());
    stem.querySelectorAll('[data-mission-action="inspect"]').forEach(el => el.onclick = () => go(4));
    $('fill').style.width = '0%';
    return;
  }
  stem.innerHTML = [
    renderMissionStaleNotice(view),
    renderBranchArcRail(view),
    renderMissionCard(view),
    renderMissionStateStack(view),
    renderMissionActions(view),
    renderQuestlineTimeline(view),
    renderMissionProofNeeded(view),
    renderMissionToolLink(view),
    renderMissionLoops(view),
    renderMissionKpis(view),
  ].join('');
  bindMissionBranchRailTouch(stem.querySelector('.mc-branch-rail'));
  const branchIndex = Math.max(0, branchRows(env).findIndex(branch => branch === view.selectedBranch));
  const pct = view.questline.length ? Math.round(100 * view.questline.filter(row => row.state === 'complete').length / view.questline.length) : 0;
  $('fill').style.width = pct + '%';
  const prog = $('progress');
  prog.textContent = view.branches.length + ' branch arc' + (view.branches.length === 1 ? '' : 's');
  prog.dataset.interactionKind = 'sheet';
  prog.dataset.source = view.source;
  prog.onclick = () => openBranchMissionSheet(env, branchIndex, -1);
  const here = $('here');
  here.textContent = 'next: ' + view.nextMission.title;
  here.dataset.interactionKind = 'sheet';
  here.dataset.source = view.source;
  here.onclick = () => openBranchMissionSheet(env, branchIndex, 0);
  const branchTabs = [...stem.querySelectorAll('[data-mission-branch]')];
  branchTabs.forEach((el, index) => {
    el.onclick = () => selectMissionBranch(env, +el.dataset.missionBranch, true);
    el.onkeydown = event => {
      const target = tabKeyTargetIndex(event, index, branchTabs.length);
      if (target === null) return;
      selectMissionBranch(env, +branchTabs[target].dataset.missionBranch, true);
    };
  });
  stem.querySelectorAll('.mc-mission-card').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0));
  stem.querySelectorAll('[data-mission-action="gate"]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'gate'));
  stem.querySelectorAll('[data-mission-action="proof"]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'proof'));
  stem.querySelectorAll('[data-mission-proof-row]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'proof'));
  stem.querySelectorAll('[data-mission-state-action]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, el.dataset.missionStateAction === 'selected' ? undefined : el.dataset.missionStateAction));
  stem.querySelectorAll('[data-mission-action="tools"]').forEach(el => el.onclick = () => { TOOL_FOCUS = 'ts-status'; TOOL_CONTEXT_BRANCH = view.selectedBranchId || ''; go(2); cmdsDrawn = false; renderCommands(); });
  stem.querySelectorAll('[data-mission-action="loops"]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'loops'));
}
function branchCardState(branch){
  const text = mcBranchStatusText(branch);
  if (/stale|expired|old|refresh/i.test(text)) return 'stale';
  if (/locked|waiting unlock|not unlocked|future/i.test(text)) return 'locked';
  const gaps = branchGaps(branch);
  if (gaps.some(gap => gap.status === 'blocked')) return 'blocked';
  if (gaps.length) return 'proof-needed';
  const gates = mcList(branch && branch.gates);
  if (gates.some(gate => mcStateKind(gate && gate.status) !== 'complete')) return 'proof-needed';
  const promotion = mcText(branch && branch.promotion && branch.promotion.state, '');
  if (/proof-only|organ-service/i.test(promotion)) return 'proof-needed';
  return 'active';
}
function branchCards(env){
  const branchEnv = branchEnvelope(env);
  const rows = branchRows(env);
  if (!rows.length) return [{
    title:'BRANCH GAP',
    state:'wait',
    detail:branchEnv.gap || 'branch packets missing or empty',
    proof:'branchStories.rows missing from visual envelope',
    source:branchEnv.source || 'missing',
    branch:null,
  }];
  return rows.slice(0, 6).map(branch => {
    const mission = branchActiveMission(branch);
    const gaps = branchGaps(branch);
    const blocked = gaps.filter(gap => gap.status === 'blocked').length;
    const current = branch.controls && branch.controls.ui ? branch.controls.ui.currentFrontier : '';
    return {
      title:branch.name || branch.productId || branch.branchId || 'Product Branch',
      state:branchCardState(branch),
      detail:(branch.arcTitle || branch.role || 'branch arc') + (mission ? ' · next move ' + mission.title : '') + (blocked ? ' · ' + blocked + ' blocked gate(s)' : ''),
      proof:gaps.length ? gaps.slice(0, 3).map(gap => gap.detail).join(' · ') : 'branch packet has no reported gaps',
      source:(branch.source && branch.source.packetFile) || branchEnv.source || 'product-branch-packets@v1',
      frontier:current || (branch.promotion && branch.promotion.currentGate) || 'frontier not served',
      branch,
    };
  });
}
function renderBranchArcCard(branch, index){
  const state = branchCardState(branch);
  const mission = branchActiveMission(branch);
  const detail = (branch.arcTitle || branch.role || 'branch arc') + (mission ? ' · ' + mission.title : '');
  return '<button type="button" class="ibox branch ' + (state === 'ready' ? 'ready' : 'gap') + '" data-interaction-kind="sheet" data-source="product-branch-packets@v1" data-branch="' + index + '" data-ecosystem-target="product-branches"><b>' + esc(branch.name || branch.branchId || 'Branch') + '</b><span>' + esc(detail) + '</span></button>';
}
function renderBranchMissionCard(mission, branch, branchIndex, missionIndex){
  const gate = branchGateForMission(branch, mission);
  const status = (gate && gate.status) || 'no-signal';
  const ready = status === 'verified';
  const proof = mission.proofRequired || (gate && gate.requiredProof) || 'proof requirement missing';
  return '<button type="button" class="ibox branch-mission ' + (ready ? 'ready' : 'gap') + '" data-interaction-kind="sheet" data-source="product-branch-packets@v1" data-branch="' + branchIndex + '" data-branch-mission="' + missionIndex + '" data-ecosystem-target="product-branches"><b>' + esc(mission.title || mission.missionId || 'Mission') + '</b><span>' + esc(status + ' gate · ' + proof) + '</span></button>';
}
function renderBranches(env){
  const cards = branchCards(env);
  return '<div class="boxgrid">' + cards.map((card, i) => card.branch
    ? renderBranchArcCard(card.branch, i)
    : '<button type="button" class="ibox branch gap" data-interaction-kind="sheet" data-source="' + esc(card.source || 'missing') + '" data-branch-gap="1" data-ecosystem-target="product-branches"><b>' + esc(card.title) + '</b><span>' + esc(card.detail) + '</span></button>'
  ).join('') + '</div>';
}
function renderBranchMissions(env){
  const rows = branchRows(env);
  if (!rows.length) return renderBranches(env);
  const cards = rows.flatMap((branch, branchIndex) => (Array.isArray(branch.missions) ? branch.missions : []).slice(0, 3).map((mission, missionIndex) => renderBranchMissionCard(mission, branch, branchIndex, missionIndex)));
  return '<div class="boxgrid">' + (cards.length ? cards.join('') : '<button type="button" class="ibox branch gap"><b>MISSION GAP</b><span>branch mission queue missing</span></button>') + '</div>';
}
function renderBranchKpis(env){
  const rows = branchRows(env);
  if (!rows.length) return renderBranches(env);
  const cards = rows.flatMap((branch, branchIndex) => (Array.isArray(branch.kpis) ? branch.kpis : []).slice(0, 2).map((kpi, kpiIndex) =>
    '<button type="button" class="ibox branch-kpi" data-interaction-kind="sheet" data-source="product-branch-packets@v1" data-branch="' + branchIndex + '" data-branch-kpi="' + kpiIndex + '" data-ecosystem-target="product-branches"><b>' + esc(kpi.label || kpi.kpiId || 'KPI') + '</b><span>' + esc((kpi.currentState || 'state missing') + ' · survival ' + (kpi.survival || 'missing')) + '</span></button>'
  ));
  return '<div class="boxgrid">' + (cards.length ? cards.join('') : '<button type="button" class="ibox branch gap"><b>KPI GAP</b><span>branch KPI controls missing</span></button>') + '</div>';
}
function renderBranchGates(env){
  const rows = branchRows(env);
  if (!rows.length) return renderBranches(env);
  const cards = rows.flatMap((branch, branchIndex) => (Array.isArray(branch.gates) ? branch.gates : []).slice(0, 3).map((gate, gateIndex) =>
    '<button type="button" class="ibox branch-gate ' + (gate.status === 'verified' ? 'ready' : '') + '" data-interaction-kind="sheet" data-source="product-branch-packets@v1" data-branch="' + branchIndex + '" data-branch-gate="' + gateIndex + '" data-ecosystem-target="product-branches"><b>' + esc(gate.gate || 'Gate') + '</b><span>' + esc((gate.status || 'no-signal') + ' · ' + (gate.requiredProof || 'required proof missing')) + '</span></button>'
  ));
  return '<div class="boxgrid">' + (cards.length ? cards.join('') : '<button type="button" class="ibox branch gap"><b>GATE GAP</b><span>branch gate ledger missing</span></button>') + '</div>';
}
function renderBranchProof(env){
  const rows = branchRows(env);
  if (!rows.length) return renderBranches(env);
  const cards = rows.flatMap((branch, branchIndex) => (Array.isArray(branch.proofPaths) ? branch.proofPaths : []).slice(0, 3).map((proof, proofIndex) =>
    '<button type="button" class="ibox branch-proof" data-interaction-kind="sheet" data-source="product-branch-packets@v1" data-branch="' + branchIndex + '" data-branch-proof="' + proofIndex + '" data-ecosystem-target="product-branches"><b>' + esc(proof.proofId || 'Proof') + '</b><span>' + esc((proof.validates || 'validation missing') + ' · ' + (proof.promotes || 'promotion rule missing')) + '</span></button>'
  ));
  return '<div class="boxgrid">' + (cards.length ? cards.join('') : '<button type="button" class="ibox branch gap"><b>PROOF GAP</b><span>branch proof foldback missing</span></button>') + '</div>';
}
function branchMissionFocusLabel(focus){
  if (focus === 'gate') return 'branch gate';
  if (focus === 'proof') return 'branch proof';
  if (focus === 'loops') return 'branch loops';
  return 'branch mission';
}
function branchMissionFocusNarrative(branch, mission, gate, controls, focus, loopRows){
  if (focus === 'gate') {
    return 'Review the active gate before this branch can advance: ' + (gate ? ((gate.gate || 'gate') + ' · ' + (gate.status || 'pending') + ' · ' + (gate.requiredProof || 'proof required')) : ((mission && mission.gate) || 'gate missing'));
  }
  if (focus === 'proof') {
    return 'Open the proof requirement for the next branch mission: ' + ((mission && mission.proofRequired) || (gate && gate.requiredProof) || 'proof requirement missing');
  }
  if (focus === 'loops') {
    return mcLoopFocusNarrative(loopRows || []);
  }
  return controls.currentFrontier || (branch.vision && branch.vision.statement) || branch.arcTitle || 'branch frontier missing';
}
function branchSheetGlance(label, value){
  return '<span><b>' + esc(label) + '</b>' + esc(value || 'missing') + '</span>';
}
function branchSheetSection(title, body, fallback){
  const safeBody = body || (fallback ? '<div class="nar">' + esc(fallback) + '</div>' : '');
  return '<section class="branch-sheet-section"><h3>' + esc(title) + '</h3>' + safeBody + '</section>';
}
function branchSheetRow(title, detail, state, source){
  return '<div class="' + mcClass('branch-row', state) + '">' +
    mcStateToken(state, mcStateKind(state)) +
    '<div><b>' + esc(title || 'Item') + '</b><span>' + esc(detail || 'detail missing') + '</span>' +
    (source ? '<small>' + esc(source) + '</small>' : '') + '</div></div>';
}
function branchSheetTimeline(branch){
  const stages = mcQuestline(branch).slice(0, 6);
  return '<div class="branch-sheet-timeline" data-component="QuestlineTimeline">' + stages.map((stage, index) =>
    '<div class="' + mcClass('branch-stage', stage.state) + '">' +
      mcGlyphSvg(mcGlyphForQuestStage(stage, index, stages.length), stage.state) +
      '<div><b>' + esc(stage.title) + '</b><small>' + esc(stage.id || ('stage-' + (index + 1))) + '</small></div>' +
      mcStateToken(stage.state, stage.status) +
    '</div>'
  ).join('') + '</div>';
}
function branchSheetKpis(kpis){
  if (!kpis.length) return '';
  return '<div class="branch-kpi-grid" data-component="KpiPulse">' + kpis.slice(0, 4).map((kpi, i) =>
    '<div class="branch-kpi" data-component="KpiPulse" data-kpi-kind="' + (i === 0 ? 'survival' : 'better-than-survival') + '" data-state="' + esc(mcStateKind(mcKpiState(kpi))) + '">' +
      mcOrbitProgress({ value:mcKpiProgress(kpi), state:mcKpiState(kpi), label:'KPI ' + (i + 1) }) +
      '<span><b>KPI ' + (i + 1) + ' · ' + esc(kpi.label || kpi.kpiId || 'KPI') + '</b>' +
      '<span>' + esc((kpi.currentState || 'state missing') + ' · survival: ' + (kpi.survival || 'missing') + (kpi.betterThanSurvival ? ' · better: ' + kpi.betterThanSurvival : '')) + '</span>' + mcKpiBars(mcKpiProgress(kpi), mcKpiState(kpi)) + '</span>' +
    '</div>'
  ).join('') + '</div>';
}
function branchSheetProofList(branch, mission, proofPaths){
  /* T-023/frozen-06 §2.1: founder-readable ProofList labels — served requirements map through
     mcSceneProofLabel; raw requirement text never renders as a row label. Sources stay in the
     small mono row — Inspect is the only surface allowed to show them (frozen/01 ProofList). */
  const proofNeeded = mcProofNeeded(branch, mission).slice(0, 4).map((row, i) =>
    branchSheetRow('Proof ' + (i + 1) + ' · ' + mcSceneProofLabel(row.label), row.detail, row.state, row.source)
  );
  const proofPathRows = proofPaths.slice(0, 4).map((proof, i) =>
    branchSheetRow('Proof path ' + (i + 1) + ' · ' + mcSceneProofLabel(proof.validates || proof.proofId), 'validates ' + (proof.validates || 'missing') + ' · promotes ' + (proof.promotes || 'missing'), 'proof-needed', 'branchStories.proofPaths')
  );
  return '<div class="branch-row-list" data-component="ProofList">' + proofNeeded.concat(proofPathRows).join('') + '</div>';
}
function branchSheetApprovalList(approvals){
  if (!approvals.length) return '';
  return '<div class="branch-row-list">' + approvals.slice(0, 5).map((approval, i) =>
    branchSheetRow('Permission ' + (i + 1) + ' · ' + (approval.permission || 'permission'), (approval.status || 'pending') + ' · ' + (approval.requiredApproval || approval.failureMode || 'approval proof missing'), approval.status || 'proof-needed', 'branch.controls.approvals')
  ).join('') + '</div>';
}
function branchSheetGapList(gaps){
  if (!gaps.length) return '';
  return '<div class="branch-row-list">' + gaps.slice(0, 6).map((gap, i) =>
    branchSheetRow('Gap ' + (i + 1) + ' · ' + (gap.status || 'pending'), gap.detail || 'gap detail missing', gap.status || 'blocked', gap.source || 'branchStories.gaps')
  ).join('') + '</div>';
}
function branchSheetInspect(branch, branchEnv){
  const source = branch && branch.source ? branch.source : {};
  return '<div class="branch-inspect" data-component="Inspect">' +
    '<b>Branch source</b><span>' + esc(source.packetFile || 'source packet missing') + '</span>' +
    '<b>Index</b><span>' + esc(source.indexFile || 'source index missing') + '</span>' +
    '<b>Schema</b><span>' + esc(source.schema || 'cambium.product_branch_packet.v1') + '</span>' +
    '<b>Envelope</b><span>' + esc((branchEnv && branchEnv.source) || 'product-branch-packets@v1') + '</span>' +
  '</div>';
}
function openBranchMissionSheet(env, branchIndex, missionIndex, focus){
  const branch = branchRows(env)[branchIndex] || branchRows(env)[0];
  if (!branch) {
    const branchEnv = branchEnvelope(env);
    $('sheetBody').innerHTML = '<div class="branch-sheet"><section class="branch-sheet-hero">' +
      '<div class="branch-sheet-head">' + mcGlyphSvg('gate', 'blocked') + '<div><div class="arc">branch gap · missing</div><h2>Branch Gap</h2></div>' + mcStateToken('blocked', 'Missing') + '</div>' +
      '<div class="nar">' + esc(branchEnv.gap || 'branch packets missing or empty') + '</div>' +
      '<div class="branch-claim-guard">' + mcStateToken('blocked', 'Guard') + '<span><b>Proof rule</b>missing branch data cannot render ready work</span></div>' +
      '</section>' + branchSheetInspect({}, branchEnv) + '</div>';
    veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('light'); return;
  }
  const branchEnv = branchEnvelope(env);
  const mission = missionIndex >= 0 && Array.isArray(branch.missions) ? branch.missions[missionIndex] : branchActiveMission(branch);
  const gate = mission ? branchGateForMission(branch, mission) : null;
  const gaps = branchGaps(branch);
  const kpis = Array.isArray(branch.kpis) ? branch.kpis : [];
  const proofPaths = Array.isArray(branch.proofPaths) ? branch.proofPaths : [];
  const approvals = branch.controls && Array.isArray(branch.controls.approvals) ? branch.controls.approvals : [];
  const controls = branch.controls && branch.controls.ui ? branch.controls.ui : {};
  const loopRows = mcLoopRows(env || {}, branch, mcBranchId(branch, branchIndex));
  const focusLabel = branchMissionFocusLabel(focus);
  const missionState = mcMissionState(branch, mission);
  const gateState = gate ? mcStateKind(gate.status) : missionState;
  const focusState = focus === 'gate' ? gateState : focus === 'proof' ? 'proof-needed' : focus === 'loops' ? mcLoopState(loopRows[0]) : missionState;
  const guardCopy = controls.blockedCopy || 'no unsupported launch, approval, or autonomy claim from this sheet';
  $('sheetBody').innerHTML = '<div class="branch-sheet" data-component="BranchMissionSheet">' +
    '<section class="branch-sheet-hero" data-component="MissionCard">' +
      '<div class="branch-sheet-head mc-selected-halo" data-component="SelectedHalo" data-selected-surface="detail-sheet">' + mcGlyphSvg(focus === 'gate' ? 'build' : focus === 'proof' ? 'proof' : 'arc', focusState) +
        '<div><div class="arc">' + esc(focusLabel) + ' · ' + esc(branch.branchId || branch.productId || 'branch') + '</div><h2>' + esc(branch.name || branch.productId || 'Product Branch') + '</h2></div>' +
        mcStateToken(focusState, focus === 'gate' ? 'Review gate' : focus === 'proof' ? 'Proof needed' : focus === 'loops' ? 'Loop control' : 'Selected') + '</div>' +
      '<div class="nar">' + esc(branchMissionFocusNarrative(branch, mission, gate, controls, focus, loopRows)) + '</div>' +
      '<div class="branch-sheet-glance">' +
        branchSheetGlance('Arc', branch.arcTitle || branch.arcId || 'arc missing') +
        branchSheetGlance('Mission', mission ? ((mission.missionId || 'mission') + ' · ' + (mission.title || 'mission title missing')) : 'mission queue missing') +
        branchSheetGlance('Gate', gate ? ((gate.gate || 'gate') + ' · ' + (gate.status || 'pending')) : ((mission && mission.gate) || 'gate missing')) +
        branchSheetGlance('Dispatch', (mission && mission.dispatchTarget) || 'dispatch target missing') +
        branchSheetGlance('Promotion', (branch.promotion && branch.promotion.state) || 'promotion state missing') +
        branchSheetGlance('Proof required', (mission && mission.proofRequired) || (gate && gate.requiredProof) || 'proof requirement missing') +
      '</div>' +
      '<div class="branch-claim-guard">' + mcStateToken('blocked', 'Claim guard') + '<span><b>Claim guard</b>' + esc(guardCopy) + '</span></div>' +
    '</section>' +
    branchSheetSection('Questline', branchSheetTimeline(branch)) +
    branchSheetSection('Proof needed', branchSheetProofList(branch, mission, proofPaths)) +
    branchSheetSection('KPI pulse', branchSheetKpis(kpis), 'No KPI controls served for this packet yet.') +
    branchSheetSection('Permissions', branchSheetApprovalList(approvals), 'No extra founder permission rows served for this branch.') +
    branchSheetSection('Gaps', branchSheetGapList(gaps), 'No branch packet gaps served; proof still has to fold back through the listed paths.') +
    branchSheetInspect(branch, branchEnv) +
  '</div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(gaps.length ? 'light' : 'medium');
}
function auditRow(id, title, state, detail, proof, source){
  return { id, title, state, detail, proof, source };
}
function tapestryTarget(row){
  if (row.id === 'active-organ' || row.id === 'r3f-contract') return 'r3f';
  if (row.id === 'wake-health' || row.id === 'quest-frontier' || row.id === 'freshness-gaps') return 'quine';
  if (row.id === 'skill-mastery' || row.id === 'priority-signals') return 'operator-policy';
  if (row.id === 'mira-relationship' || row.id === 'npc-history' || row.id === 'memory-sense') return 'cortex';
  if (row.id === 'command-state') return 'hermes';
  if (row.id === 'live-proof') return 'live-proof';
  if (row.id === 'coordination-source') return 'paperclip';
  if (row.id === 'decision-context' || row.id === 'founder-stance') return 'operator-policy';
  return 'cambium-worker';
}
function tapestryRows(env){
  const L = env.ledger || env;
  const current = L.current || activeRow(L);
  const activeStage = stageForArc((current && current.arc) || 'XVII');
  const wake = wakeSteps(env.ledger ? env : { ledger:L });
  const wakeDone = wake.filter(step => step.done).length;
  const boxes = insightBoxes(env.ledger ? env : { ledger:L });
  const boxReady = boxes.filter(box => box.state === 'ready').length;
  const skills = skillCards(env.ledger ? env : { ledger:L });
  const skillReady = skills.filter(skill => skill.state === 'ready').length;
  const stance = stanceCard(env.ledger ? env : { ledger:L });
  const npcs = npcCards(env.ledger ? env : { ledger:L });
  const mira = npcs.find(npc => String(npc.title || '').toUpperCase() === 'MIRA') || npcs[0];
  const openItems = gateItemsFromEnvelope(env || {});
  const gateReady = openItems.some(item => (item.evidence || item.detail) && (item.consequence || item.approveConsequence || item.rerollConsequence) && item.reversibility && item.idempotencyHint);
  const commandReady = !!env.commands;
  const memory = senseCards(env.ledger ? env : { ledger:L }).find(sense => sense.id === 'memory');
  const decisions = decisionContextCards(env.ledger ? env : { ledger:L });
  const servedDecisions = decisions.filter(row => row.state === 'ready').length;
  const priorityDecisions = decisions.filter(row => row.state === 'ready' && row.source === 'operator-priority-signals');
  const socials = socialCards(env.ledger ? env : { ledger:L });
  const socialReady = socials.filter(row => row.state === 'ready').length;
  const npcHistory = (mira && mira.history) || {};
  const npcHistoryTotal = Number(npcHistory.total || 0);
  const live = env.liveProof || {};
  const liveRows = liveProofCards(env.ledger ? env : { ledger:L });
  const liveReady = live.status === 'ready' || (live.summary && live.summary.liveProofReady === true);
  const liveSummary = live.summary || {};
  const liveBlocked = Number.isFinite(Number(liveSummary.blocked)) ? Number(liveSummary.blocked) : liveRows.filter(row => row.state !== 'ready').length;
  const liveTotal = Number.isFinite(Number(liveSummary.total)) ? Number(liveSummary.total) : liveRows.length;
  const age = minutesSince(env.derivedAt);
  const fresh = age !== null && age <= 360;
  return [
    auditRow('active-organ', 'ACTIVE ORGAN', current ? 'ready' : 'wait', current ? stageTitle(activeStage) + ' · ' + (current.arc || 'arc') : 'no active quest frontier served', current ? 'stageForArc(' + (current.arc || 'unknown') + ')' : 'ledger.current missing', 'quest-ledger'),
    auditRow('wake-health', 'WAKE HEALTH', wakeDone > 0 ? 'ready' : 'wait', wakeDone + '/' + wake.length + ' wake steps proved', wake.map(step => step.id + ':' + (step.done ? 'proved' : 'missing')).join(' · '), 'wake envelope'),
    auditRow('quest-frontier', 'QUEST FRONTIER', current ? 'ready' : 'wait', current ? (current.arc || 'arc') + ' · ' + (current.title || 'active quest') : 'all arcs complete or frontier missing', current ? (current.id || current.title || 'frontier served') : 'frontier not served', 'quest-ledger'),
    auditRow('evidence-boxes', 'EVIDENCE BOXES', boxReady > 0 ? 'ready' : 'wait', boxReady + '/' + boxes.length + ' boxes ready', boxes.map(box => (box.title || 'box') + ':' + (box.state || 'wait')).join(' · '), 'insights'),
    auditRow('skill-mastery', 'SKILL MASTERY', skillReady > 0 ? 'ready' : 'wait', skillReady + '/' + skills.length + ' skills reliable or better', skills.map(skill => skill.title + ':' + skill.detail).join(' · '), 'skills'),
    auditRow('founder-stance', 'FOUNDER STANCE', stance.state === 'ready' ? 'ready' : 'wait', stance.detail, stance.title, 'tenant stance'),
    auditRow('mira-relationship', 'MIRA RELATIONSHIP', mira && mira.state === 'ready' ? 'ready' : 'wait', (mira && mira.detail) || 'Mira row missing', (mira && mira.proof) || 'relationship proof missing', 'npc'),
    auditRow('gate-consequences', 'GATE CONSEQUENCES', gateReady ? 'ready' : 'wait', gateReady ? openItems.length + ' open item(s) with evidence, consequence, reversibility, and idempotency' : 'no consequence-complete open gate item served', openItems.length ? openItems.slice(0, 3).map(item => item.id + ':' + (item.status || 'open')).join(' · ') : 'openItems empty', 'gate'),
    auditRow('command-state', 'COMMAND STATE', commandReady ? 'ready' : 'wait', commandReady ? 'live command data served' : 'org command data unavailable', commandReady ? 'commands envelope present' : 'env.commands missing', 'commands'),
    auditRow('memory-sense', 'MEMORY SENSE', memory && memory.on ? 'ready' : 'wait', (memory && memory.detail) || 'memory sense missing', (memory && memory.proof) || 'memory proof missing', 'senses'),
    auditRow('decision-context', 'DECISION CONTEXT', servedDecisions > 0 ? 'ready' : 'wait', servedDecisions + '/' + decisions.length + ' decision signals served', decisions.map(row => row.title + ':' + row.state).join(' · '), 'decisionContext'),
    auditRow('priority-signals', 'PRIORITY SIGNALS', priorityDecisions.length > 0 ? 'ready' : 'wait', priorityDecisions.length + '/6 explicit priority signals served', priorityDecisions.length ? priorityDecisions.map(row => row.title + ':' + row.detail).join(' · ') : 'operator-priority-signals@v1 missing or incomplete', 'decisionContext'),
    auditRow('coordination-source', 'COORDINATION SOURCE', socialReady > 0 ? 'ready' : 'wait', socialReady + '/' + socials.length + ' tenant coordination rows ready', socials.map(row => row.title + ':' + row.state).join(' · '), 'social'),
    auditRow('npc-history', 'NPC HISTORY', npcHistoryTotal > 0 ? 'ready' : 'wait', npcHistoryTotal + ' durable Mira/NPC event(s) served', npcHistoryTotal > 0 ? (npcHistory.source || 'operator-npc-events@v1') + ' · ' + Number(npcHistory.contradictions || 0) + ' contradiction(s)' : 'operator-npc-events@v1 missing', 'npc'),
    auditRow('live-proof', 'LIVE PROOF', liveReady ? 'ready' : 'wait', liveReady ? 'live-proof receipts validate ready' : liveBlocked + '/' + liveTotal + ' readiness checks blocked', live.invariant || 'capture plan is guidance, not proof', 'liveProof'),
    auditRow('r3f-contract', 'R3F CONTRACT', 'ready', STAGES.length + ' organs · ' + RAILS.length + ' rails', 'shared visual contract loaded into Telegram map', 'shared/cambium-visual-contract'),
    auditRow('freshness-gaps', 'FRESHNESS GAPS', fresh ? 'ready' : 'wait', age === null ? 'freshness missing' : fresh ? age + 'm since derivation' : Math.round(age / 60) + 'h stale', env.derivedAt || 'derivedAt missing', 'freshness'),
  ];
}
function renderTapestryAudit(env){
  return '<div class="boxgrid">' + tapestryRows(env).map((row, i) =>
    '<button type="button" class="ibox tapestry ' + (row.state === 'ready' ? 'ready' : 'gap') + '" data-tapestry="' + i + '" data-ecosystem-target="' + esc(tapestryTarget(row)) + '"><b>' + esc(row.title) + '</b><span>' + esc(row.detail) + '</span></button>'
  ).join('') + '</div>';
}
function insightBoxes(env){
  const insightEnv = env.insights || {};
  const insightSource = insightEnv.source || 'missing';
  const served = Array.isArray(insightEnv.rows) ? insightEnv.rows : null;
  if (served) {
    if (!served.length) return [{
      title:'NO EVIDENCE BOXES',
      state:'wait',
      detail:insightEnv.gap || 'no quest evidence rows served for insight boxes',
      proof:insightEnv.gap || 'no served insight rows',
      source:insightSource,
      insightSource,
      missingSource:insightSource,
      evidence:[],
    }];
    return served.slice(0, 4).map(row => ({
      title:row.title || row.id || 'evidence box',
      state:row.state || 'wait',
      detail:row.detail || row.gap || row.proof || 'evidence pending',
      proof:row.proof || row.gap || 'proof missing from insight row',
      source:row.source || insightSource,
      insightSource,
      origin:row.origin || 'unknown',
      evidence:Array.isArray(row.evidence) ? row.evidence : [],
    }));
  }
  const L = env.ledger;
  const rows = [...completedRows(L).slice(-3), activeRow(L)].filter(Boolean).slice(-4);
  if (!rows.length) return [{ title:'NO EVIDENCE BOXES', state:'wait', detail:'push a derived ledger before the map can reveal work', proof:'legacy-local inference found no rows', source:'legacy-local', insightSource:'legacy-local', missingSource:'legacy-local', evidence:[] }];
  return rows.map(row => {
    const facet = facetsFrom(row.evidence)[0];
    return { title:rowLabel(row), state:row.status === 'complete' ? 'ready' : 'wait', detail:(facet && facet.label) || row.evidence || 'evidence pending', proof:row.evidence || 'evidence pending', source:'legacy-local', insightSource:'legacy-local', evidence:[] };
  });
}
function renderInsightBoxes(env){
  return '<div class="boxgrid">' + insightBoxes(env).map((box, i) =>
    '<button type="button" class="ibox ' + (box.state === 'ready' ? 'ready' : '') + '" data-box="' + i + '"><b>' + esc(box.title) + '</b><span>' + esc(box.detail) + '</span></button>'
  ).join('') + '</div>';
}
function agentSkillRoles(agent){
  const subsets = agent && agent.roleSubsets && typeof agent.roleSubsets === 'object' ? agent.roleSubsets : {};
  return Object.entries(subsets).map(([roleId, subset]) => {
    const permissions = Array.isArray(subset.permissions) ? subset.permissions.join(', ') : '';
    const commands = Array.isArray(subset.commands) ? subset.commands.join(', ') : '';
    const purpose = subset.purpose || '';
    return { roleId, version: subset.version || '', permissions, commands, purpose };
  });
}
function agentSkillDetail(agent){
  if (!agent) return '';
  const roles = agentSkillRoles(agent);
  const writeCount = Array.isArray(agent.writeCommands) ? agent.writeCommands.length : 0;
  const readCount = Array.isArray(agent.readCommands) ? agent.readCommands.length : 0;
  return (agent.domain || 'skill') + ' · ' + (agent.gameLayer || 'layer') + ' · loadout v' + (agent.version || 'unknown') + ' · ' + roles.length + ' roles · ' + readCount + ' read · ' + writeCount + ' write gated';
}
function skillCards(env){
  const skillEnv = env.skills || {};
  const rows = Array.isArray(skillEnv.rows) ? skillEnv.rows : [];
  const sourcePath = skillEnv.path || skillEnv.sourcePath || ('.operator/' + TENANT + '.skills.json');
  const source = skillEnv.source || 'missing';
  const gapCommand = 'quine write skills forge --tenant ' + TENANT;
  if (!rows.length) return [{
    title:'SKILL LABORS',
    state:'wait',
    detail:skillEnv.gap || 'skill registry missing',
    status:'missing',
    tier:'missing',
    tierLabel:'MISSING',
    uses:0,
    successRateText:'0%',
    recentRateText:'0%',
    sampleMinimum:'0/3 uses',
    promotionStatus:'blocked · NO PROMOTION · skill telemetry missing',
    promotion:{ status:'blocked', label:'NO PROMOTION', detail:'skill telemetry missing', requiredApproval:true },
    source,
    sourcePath,
    registryProof:'missing registry proof; source path is a gap target only',
    gapAction:sourcePath + ' · ' + gapCommand,
    gap:skillEnv.gap || 'skill registry missing',
  }];
  return rows.slice(0, 4).map(skill => {
    const agent = skill.agentSkill || null;
    const pct = Math.round(Number(skill.successRate || 0) * 100);
    const recent = Math.round(Number(skill.recentRate ?? skill.successRate ?? 0) * 100);
    const uses = Number(skill.uses ?? skill.sampleSize ?? 0);
    const sample = Number(skill.sampleSize ?? uses);
    const minimum = Number(skill.minimum ?? 3);
    const tier = String(skill.tier || (skill.declining ? 'declining' : sample < minimum ? 'unproven' : 'learning'));
    const label = String(skill.tierLabel || (tier === 'declining' ? 'DECLINING' : tier === 'unproven' ? 'UNPROVEN' : tier.toUpperCase()));
    const ready = !['unproven', 'declining'].includes(tier);
    const promotion = skill.promotion || {};
    const promotionDetail = promotion.label
      ? ' · promotion: ' + String(promotion.label) + (promotion.detail ? ' · ' + String(promotion.detail) : '')
      : '';
    const detail = (skill.gap
      ? label + ' · ' + skill.gap
      : label + ' · ' + sample + ' uses · ' + pct + '% total · ' + recent + '% recent') + promotionDetail;
    const agentDetail = agent ? agentSkillDetail(agent) : '';
    return {
      title:skill.id,
      state:ready ? 'ready' : 'wait',
      detail:String(skill.status || 'unknown') + ' · ' + (agentDetail || detail),
      status:String(skill.status || 'unknown'),
      tier,
      tierLabel:label,
      uses,
      successRateText:pct + '%',
      recentRateText:recent + '%',
      sampleMinimum:sample + '/' + minimum + ' uses',
      promotionStatus:String(promotion.status || 'blocked') + (promotion.label ? ' · ' + String(promotion.label) : '') + (promotion.requiredApproval ? ' · founder approval required' : ''),
      promotion,
      source,
      sourcePath,
      registryProof:skill.registryProof || sourcePath,
      gapAction:sourcePath + ' · ' + gapCommand,
      gap:skill.gap || '',
      agentSkill:agent,
    };
  });
}
function canQueueSkillPromotion(skill){
  return !!(skill && skill.promotion && skill.promotion.status === 'founder-review' && skill.tier !== 'declining' && skill.status !== 'production');
}
function renderSkills(env){
  return '<div class="boxgrid">' + skillCards(env).map((skill, i) =>
    '<button type="button" class="ibox skill ' + (skill.state === 'ready' ? 'ready' : '') + '" data-skill="' + i + '"' + (canQueueSkillPromotion(skill) ? ' data-signed-action-entrypoint="promote-skill"' : '') + '><b>' + esc(skill.title) + '</b><span>' + esc(skill.detail) + '</span></button>'
  ).join('') + '</div>';
}
function npcCards(env){
  const npcEnv = env.npc || {};
  const rows = Array.isArray(npcEnv.relationships) ? npcEnv.relationships : [];
  const missingStage = { id:'missing', label:'MISSING', detail:'relationship stage not served', confidence:0 };
  const missingAdvice = { status:'blocked', label:'NO ADVICE', detail:'no durable NPC advice event served', proof:'no durable NPC events served', action:{ kind:'collect-evidence', label:'Record NPC evidence', target:'quine write quests npc-event' } };
  const missingHistory = { source:'missing', total:0, contradictions:0, rows:[] };
  if (!rows.length) return [{ title:'MIRA', state:'wait', detail:'MISSING · npc relationship state not served yet', proof:'no relationship rows served', stage:missingStage, events:[], history:missingHistory, advice:missingAdvice, scope:'missing', ecosystemTargets:['cortex', 'operator-npc-events'] }];
  return rows.map(npc => {
    const stage = npc.stage || missingStage;
    const advice = npc.advice || missingAdvice;
    const history = npc.history || missingHistory;
    const id = String(npc.id || 'npc');
    const ecosystemTargets = id === 'founder-npc'
      ? ['quest-ledger', 'operator-npc-events']
      : id === 'mira'
        ? ['cortex', 'operator-npc-events']
        : ['operator-npc-events'];
    return {
      title:id.toUpperCase(),
      state:npc.status === 'inferred' ? 'ready' : 'wait',
      detail:String(stage.label || 'MISSING') + ' · ' + (npc.detail || stage.detail || 'relationship signal missing'),
      proof:npc.proof || npc.detail || 'relationship proof missing',
      stage,
      events:Array.isArray(npc.events) ? npc.events : [],
      history,
      advice,
      scope:npc.scope || 'missing',
      ecosystemTargets,
    };
  });
}
function renderNpc(env){
  return '<div class="boxgrid">' + npcCards(env).map((npc, i) =>
    '<button type="button" class="ibox npc ' + (npc.state === 'ready' ? 'ready' : '') + '" data-npc="' + i + '"><b>' + esc(npc.title) + '</b><span>' + esc(npc.detail) + '</span></button>'
  ).join('') + '</div>';
}
function inspectGroupSummaries(env, L){
  /* frozen/06 §1.6 I2: group summary details ≤ 8 words, flat declaratives. Blocked/idle fallbacks
     keep the exact contract strings (inspect.json dataFields fallbacks). */
  const minutes = minutesSince(env && env.derivedAt);
  const stale = minutes === null || minutes > 360;
  const branchRows = (env && env.branchStories && Array.isArray(env.branchStories.rows)) ? env.branchStories.rows : [];
  const gateRows = gateItemsFromEnvelope(env || {});
  const actionRequests = actionRequestRows(env || {});
  const policyRows = [policyCard(env || { ledger:L })];
  const proofRows = liveProofCards(env || { ledger:L });
  const evidenceRows = insightBoxes(env || { ledger:L });
  const beatCount = inspectStoryBeatRows(env).length;
  const toolCount = CMDS.reduce((sum, group) => sum + group[1].length, 0);
  const proofBlockers = proofRows.filter(row => row.state !== 'ready').length;
  return [
    { id:'freshness', title:'freshness', glyph:'cortex', state:stale ? 'stale' : 'active', detail:stale ? 'stale proof window · refresh first' : 'proof window fresh · refresh after movement' },
    { id:'live-proof', title:'live proof', glyph:'proof', state:proofBlockers ? 'proof-needed' : 'complete', detail:proofBlockers ? String(proofBlockers) + ' blockers need proof' : 'no live blockers' },
    { id:'branch-packets', title:'branch packets', glyph:'arc', state:branchRows.length ? 'active' : 'blocked', detail:branchRows.length ? String(branchRows.length) + ' packets trusted' : 'branch state untrusted until packets arrive' },
    { id:'gates', title:'gates', glyph:'gate', state:gateRows.length ? 'proof-needed' : 'idle', detail:gateRows.length ? String(gateRows.length) + ' decisions waiting' : 'No founder approval is waiting.' },
    { id:'action-requests', title:'action requests', glyph:'gate', state:actionRequests.length ? actionRequestState(actionRequests[0]) : 'idle', detail:actionRequests.length ? String(actionRequests.length) + ' requests projected' : 'none served yet' },
    { id:'policy', title:'policy', glyph:'build', state:policyRows.some(row => row.state === 'gap') ? 'blocked' : 'active', detail:'blocked actions explained first' },
    { id:'tools', title:'tools', glyph:'ops', state:env && env.commands ? 'active' : 'stale', detail:env && env.commands ? String(toolCount) + ' surfaces live' : 'surfaces stale' },
    { id:'rails', title:'rails', glyph:'taste', state:'active', detail:String(RAILS.length) + ' proof rails' },
    { id:'evidence', title:'evidence', glyph:'proof', state:evidenceRows.length || beatCount ? 'active' : 'proof-needed', detail:evidenceRows.length ? String(evidenceRows.length) + ' evidence rows' + (beatCount ? ' · ' + String(beatCount) + ' story beats' : '') : (beatCount ? String(beatCount) + ' story beats' : 'evidence rows missing') },
  ];
}
function inspectSecondaryGroupSummaries(env, L){
  const branchRows = (env && env.branchStories && Array.isArray(env.branchStories.rows)) ? env.branchStories.rows : [];
  return [
    { id:'branch-fixtures', title:'branch fixtures', glyph:'arc', state:branchRows.length ? 'active' : 'proof-needed', detail:'fixtures calibrate layout only' },
    { id:'surface-contract', title:'surface contract', glyph:'cortex', state:'active', detail:'scene coverage and proof links' },
  ];
}
function inspectAllGroupSummaries(env, L){
  return inspectGroupSummaries(env, L).concat(inspectSecondaryGroupSummaries(env, L));
}
function renderInspectGroups(env, L, groupIds){
  const allowed = Array.isArray(groupIds) ? new Set(groupIds) : null;
  const groups = inspectGroupSummaries(env, L).filter(group => !allowed || allowed.has(group.id));
  return '<section class="inspect-groups" data-component="InspectGroupStack">' + groups.map(group =>
    '<button type="button" class="' + mcClass('inspect-group', group.state) + '" data-component="InspectGroup" data-interaction-kind="sheet" data-source="inspect-proof-layer@v1" data-inspect-target="' + esc(group.id) + '" data-inspect-group="' + esc(group.id) + '">' +
      mcGlyphSvg(group.glyph, group.state) +
      '<span><b>' + esc(group.title) + '</b><small>' + esc(group.detail) + '</small></span>' +
      mcStateToken(group.state, mcSceneTokenLabel(group.state)) +
    '</button>'
  ).join('') + '</section>';
}
function renderInspectPaneSwitcher(){
  return '<div class="inspect-pane-switcher" data-component="InspectPaneSwitcher" role="tablist" aria-label="Inspect views">' +
    ['proof','system'].map(pane => '<button type="button" id="inspect-' + pane + '-tab" role="tab" aria-selected="' + (INSPECT_PANE === pane ? 'true' : 'false') + '" aria-controls="inspect-' + pane + '-panel" tabindex="' + (INSPECT_PANE === pane ? '0' : '-1') + '" data-inspect-pane-select="' + pane + '">' + (pane === 'proof' ? 'Proof' : 'System') + '</button>').join('') +
  '</div>';
}
function renderInspectDisclosure(title, body, open){
  return '<details class="inspect-disclosure"' + (open ? ' open' : '') + '><summary>' + esc(title) + '</summary><div class="inspect-disclosure-body">' + body + '</div></details>';
}
function renderInspectSecondaryLinks(env, L){
  return '<section class="inspect-secondary" data-component="InspectSecondaryLinks"><div class="cmdgrp">Proof links</div>' + inspectSecondaryGroupSummaries(env, L).map(group =>
    '<button type="button" class="' + mcClass('inspect-group', group.state, 'is-secondary') + '" data-component="InspectSecondaryLink" data-interaction-kind="sheet" data-source="inspect-proof-layer@v1" data-inspect-target="' + esc(group.id) + '" data-inspect-group="' + esc(group.id) + '">' +
      mcGlyphSvg(group.glyph, group.state) +
      '<span><b>' + esc(group.title) + '</b><small>' + esc(group.detail) + '</small></span>' +
      mcStateToken(group.state, mcSceneTokenLabel(group.state)) +
    '</button>'
  ).join('') + '</section>';
}
function renderActionRequests(env){
  const rows = actionRequestRows(env || {});
  if (!rows.length) return '<div class="boxgrid"><div class="ibox" data-component="ActionRequestEmptyState"><b>no action requests</b><span>none served yet</span></div></div>';
  return '<div class="boxgrid" data-component="ActionRequestProjectionGrid">' + rows.slice(0, 8).map((row, i) =>
    '<button type="button" class="ibox action-request ' + (actionRequestState(row) === 'complete' ? 'ready' : '') + '" data-component="ActionRequestProjectionCard" data-action-request-index="' + i + '" data-action-request-id="' + esc(row.id || '') + '" data-action-request-status="' + esc(row.status || 'proposed') + '" data-ecosystem-target="action-requests">' +
      '<b>' + esc(row.title || row.id || 'ActionRequest') + '</b><span>' + esc((row.branchLabel || row.projectName || row.branchId || 'branch') + ' · ' + (row.status || 'proposed') + ' · ' + (row.next || row.summary || 'founder choice pending')) + '</span>' +
    '</button>'
  ).join('') + '</div>';
}
function openActionRequestBox(env, index){
  const row = actionRequestRows(env || {})[index];
  if (!row) return;
  const receipt = row.receipts && row.receipts.latest ? row.receipts.latest : null;
  $('sheetBody').innerHTML = '<div class="arc">action request · ' + esc(row.branchLabel || row.branchId || 'branch') + '</div><h2>' + esc(row.title || row.id || 'ActionRequest') + '</h2>' +
    '<div class="nar">' + esc(row.summary || row.next || 'ActionRequest summary not served') + '</div>' +
    '<div class="kv"><b>branch</b><span>' + esc(row.branchLabel || row.branchId || 'missing') + '</span><b>quest</b><span>' + esc(row.questId || 'missing') + '</span><b>status</b><span>' + esc(row.status || 'proposed') + '</span><b>why</b><span>' + esc(row.why || 'why not served') + '</span><b>next</b><span>' + esc(row.next || 'founder choice required') + '</span><b>proof</b><span>' + esc(row.evidence || row.summary || 'proof missing') + '</span><b>consequence</b><span>' + esc(row.consequence || 'consequence missing') + '</span><b>reversibility</b><span>' + esc(row.reversibility || 'reversibility missing') + '</span><b>receipt count</b><span>' + esc(row.receipts && row.receipts.count != null ? row.receipts.count : 0) + '</span><b>latest receipt</b><span>' + esc(receipt ? receipt.kind + ' · ' + receipt.text : 'none') + '</span><b>redaction</b><span>no raw initData, callback nonce, bearer token, or Telegram chat id rendered</span><b>source</b><span>' + esc(row.source || 'cambium-action-requests@v1') + '</span></div>' +
    '<div class="gbtns"><button type="button" data-inspect-page-link="gate">Open Gate</button><button type="button" class="reroll" data-inspect-page-link="story">Open Story</button></div>';
  $('sheetBody').querySelectorAll('[data-inspect-page-link]').forEach(el => el.onclick = () => {
    closeSheet();
    go(el.dataset.inspectPageLink === 'gate' ? 1 : 3);
  });
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('light');
}
function inspectGroupDetailRows(id, env, L){
  const live = (env && env.liveProof) || {};
  const branchEnv = branchEnvelope(env || { ledger:L });
  const actionRequests = actionRequestRows(env || {});
  const gateItems = gateItemsFromEnvelope(env || {});
  const rows = {
    freshness:[
      ['stale envelope', FRESHNESS_STATE.stale ? 'yes · refresh before trusting movement' : 'no · current proof window'],
      ['derived at', (env && env.derivedAt) || 'missing'],
      ['threshold', '360 minutes'],
      ['refresh route', REFRESH_ROUTE],
      ['provenance', FRESHNESS_STATE.source || 'missing'],
      ['ignored stale refresh', 'older envelopes never repaint Mission state'],
    ],
    policy:[
      ['policy authority', 'operator policy gates actions; primary pages do not expose debug rules'],
      ['copy containment', 'Mission, Gate, Tools, and Story keep source/schema words out of primary cards'],
      ['proof rule', 'blocked rows keep warning state until evidence resolves'],
      ['promotion ladder', 'prototype -> proof-only -> supervised branch -> founder-approved release'],
    ],
    'live-proof':[
      ['blocked count', String((live.summary && live.summary.blocked) || liveProofCards(env || { ledger:L }).filter(row => row.state !== 'ready').length)],
      ['next action', 'rerun npm run proof:tg-live-readiness after final release SHA and device capture exist'],
      ['ready count', String((live.summary && live.summary.ready) || 0)],
      ['blockers', live.blockers && live.blockers.length ? live.blockers.join(' · ') : 'Telegram initData and device artifact may still be required'],
      ['blocker owner', 'operator captures redacted receipts; Worker validates before any release claim'],
      ['secret redaction', 'receipts must stay redacted; no raw initData or bearer token belongs in screenshots'],
    ],
    'branch-packets':[
      ['Mission readiness', branchRows(env || { ledger:L }).length ? 'Mission has branch packet rows to compare.' : 'Mission lacks branch packet rows and must stay in wait state.'],
      ['missing diagnostics', branchRows(env || { ledger:L }).length ? 'branch rows served' : (branchEnv.gap || 'branch stories missing')],
      ['packet source', branchEnv.source || 'missing'],
      ['schema', (branchEnv.schema || (branchEnv.rows && branchEnv.rows[0] && branchEnv.rows[0].source && branchEnv.rows[0].source.schema)) || 'cambium.product_branch_packet.v1'],
    ],
    'branch-fixtures':[
      ['fixture count', String(branchRows(env || { ledger:L }).length)],
      ['fixture boundary', 'fixtures can calibrate Mission layout but cannot satisfy live proof rows'],
      ['proof handoff', 'Mission links to branch packet sheets; Inspect keeps raw proof available'],
    ],
    gates:[
      ['auth boundary', 'initData checked by Worker before queue write'],
      ['founder approval', String(gateItems.length) + ' founder approval item(s)'],
      ['queue state', String(gateItems.length) + ' open item(s)'],
      ['signed route', '/api/gate/' + TENANT],
      ['idempotency audit', 'Gate sheets show idempotency hints before approve or reroll action'],
      ['redacted auth', 'auth failures describe missing Telegram proof without exposing initData'],
    ],
    'action-requests':[
      ['projection', 'cambium-action-requests@v1 feeds Gate, Story, and Inspect from one redacted list DTO'],
      ['rows', String(actionRequests.length)],
      ['iVerif rows', String(actionRequests.filter(row => row.branchId === 'iverif' || row.projectId === 'iverif').length)],
      ['statuses', actionRequests.length ? actionRequests.map(row => row.id + ':' + row.status).join(' · ') : 'none'],
      ['redaction', 'no raw initData, callback nonce, bearer token, or Telegram chat id is rendered'],
      ['next action', actionRequests[0] ? (actionRequests[0].next || 'founder choice required') : 'serve ActionRequest rows from Cambium'],
    ],
    tools:[
      ['surface availability', CMDDATA ? 'live action surfaces available from live data' : 'live action surfaces unavailable until refresh'],
      ['safe use', 'Tools open read-only sheets; signed decisions stay in Gate'],
      ['tool source', CMDDATA ? 'live command envelope available' : 'live command envelope stale'],
      ['surface semantics', 'five live surfaces: Org status, Services, Agents, Active work, Handoffs'],
      ['handoff actions', 'Approve and Reroll post signed decisions through the gate client'],
    ],
    rails:[
      ['visual envelope', 'shared/cambium-visual-contract.ts'],
      ['organs', String(STAGES.length)],
      ['rails', String(RAILS.length)],
    ],
    evidence:[
      ['evidence rows', String(insightBoxes(env || { ledger:L }).length)],
      ['story beats', String(inspectStoryBeatRows(env).length) + ' served · provenance rows below'],
      ['source containment', 'sources and proof paths are Inspect/sheet detail, not primary app copy'],
      ['mini app surface', 'workers/quests/src/page.ts'],
      ['grouping', 'evidence sheets group source, origin, row source, proof, and served evidence'],
      ['search affordance', 'open the related page first, then return here for proof detail'],
      ['related page trace', 'Story and Tools sheets can route back to Inspect evidence rows'],
    ],
    'surface-contract':[
      ['scene', 'Mission · Gate · Tools · Story · Inspect'],
      ['role', 'five-scene surface contract for the Telegram mini app'],
      ['proof link', 'primary pages route here for packet, blocker, and evidence detail'],
      ['status summary', 'coverage exists; live Telegram readiness still depends on redacted proof receipts'],
    ],
  };
  return rows[id] || [['detail', 'no specific detail rows served']];
}
function renderInspectProofSummary(env, L){
  /* frozen/06 §1.6 I6: 'N blockers · M packets · redacted receipts required' + Open proof —
     the next: clause lives in the sheet (blocker names row), not on the card. */
  const liveRows = liveProofCards(env || { ledger:L });
  const blocked = liveRows.filter(row => row.state !== 'ready').length;
  const branchCount = branchRows(env || { ledger:L }).length;
  const lead = blocked ? blocked + (blocked === 1 ? ' blocker' : ' blockers') : 'no blockers';
  const packets = branchCount + (branchCount === 1 ? ' packet' : ' packets');
  return '<section class="inspect-proof-summary" data-component="InspectProofSummaryAction">' +
    '<b>Proof summary</b><small>' + esc(lead) + ' · ' + esc(packets) + ' · redacted receipts required</small>' +
    '<div class="gbtns"><button type="button" data-inspect-summary="1">Open proof</button></div>' +
  '</section>';
}
function inspectRelatedPage(id){
  if (id === 'tools') return 'Tools';
  if (id === 'gates' || id === 'action-requests') return 'Gate';
  if (id === 'branch-packets' || id === 'branch-fixtures') return 'Mission';
  if (id === 'evidence' || id === 'live-proof' || id === 'surface-contract') return 'Inspect';
  return 'Inspect';
}
function inspectRelatedScene(id){
  const page = inspectRelatedPage(id);
  if (page === 'Mission') return 'mission';
  if (page === 'Gate') return 'gate';
  if (page === 'Tools') return 'tools';
  return 'inspect';
}
/* ── N4 / frozen/06 §1.5 S5 final: story beat provenance lives in the Inspect evidence group.
   The Story beat sheet keeps full text + token + nav only; its retired kv provenance rows render
   here, and the Story Open Proof nav routes into openInspectEvidenceSheet. */
function inspectStoryBeatRows(env){
  const beats = env && Array.isArray(env.beats) ? env.beats : [];
  return beats.length ? beats : (typeof STORY_BEATS !== 'undefined' && Array.isArray(STORY_BEATS) ? STORY_BEATS : []);
}
function inspectEvidenceBeatList(env){
  const beats = inspectStoryBeatRows(env);
  if (!beats.length) return '';
  return '<div class="cmdgrp">story beats</div><div class="inspect-beat-list" data-component="InspectEvidenceBeatList">' + beats.slice(0, 8).map((beat, i) => {
    const group = storyBeatGroup(beat);
    return '<button type="button" class="li" data-inspect-beat="' + i + '"><span class="cname">' + esc(group) + '</span><div class="cdesc">' + esc(mcSceneClamp(beat && beat.text, 12)) + '</div></button>';
  }).join('') + '</div>';
}
function openInspectEvidenceSheet(env, index){
  const safeEnv = env && typeof env === 'object' ? env : { beats:inspectStoryBeatRows(null), ledger:{ rows:[] } };
  const beats = inspectStoryBeatRows(safeEnv);
  const beat = beats[index] || beats[0];
  if (!beat) { openInspectGroupSheet('evidence', safeEnv); return; }
  const lane = beat.lane || (beat.noesis ? 'noesis' : 'beat');
  const group = storyBeatGroup(beat);
  const state = storyBeatState(beat);
  const context = storyBeatContext(group, lane, beat);
  const branch = storyBeatBranch(beat);
  const contextLabel = context === 'mission' ? 'Open Mission' : context === 'gate' ? 'Open Gate' : context === 'tools' ? 'Open Tools' : '';
  $('sheetBody').innerHTML = '<div class="arc">inspect · evidence · ' + esc(group.toLowerCase()) + '</div><h2>Story beat evidence</h2>' +
    '<div class="nar">' + esc(beat.text || 'story beat text missing') + '</div>' +
    '<div class="story-sheet-tokens">' + mcStateToken(state, mcSceneTokenLabel(state)) + '</div>' +
    '<div class="kv"><b>group</b><span>' + esc(group) + '</span><b>lane</b><span>' + esc(lane) + '</span><b>branch</b><span>' + esc(branch || 'unassigned') + '</span><b>source</b><span>' + esc(beat.source || 'mission-story@v1') + '</span><b>proof</b><span>' + esc(beat.proof || beat.evidence || storyBeatProofCue(beat, group)) + '</span><b>context</b><span>' + esc(context) + '</span></div>' +
    '<div class="gbtns">' + (contextLabel ? '<button type="button" data-inspect-beat-nav="' + esc(context) + '" data-inspect-beat-branch="' + esc(branch) + '">' + contextLabel + '</button>' : '') + '<button type="button" class="reroll" data-inspect-beat-nav="story">Open Story</button></div>';
  $('sheetBody').querySelectorAll('[data-inspect-beat-nav]').forEach(el => el.onclick = () => {
    closeSheet();
    const target = el.dataset.inspectBeatNav;
    if (target === 'mission') MISSION_BRANCH_FOCUS = el.dataset.inspectBeatBranch || '';
    go(target === 'mission' ? 0 : target === 'gate' ? 1 : target === 'tools' ? 2 : 3, true);
    if (target === 'tools') { cmdsDrawn = false; renderCommands(); }
  });
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(lane === 'noesis' ? 'medium' : 'light');
}
/* ── T-024: branch-map read model rendered visually. Served sheet rows become glyph + StateToken
   node rows joined by SignalRail connectors; proof digests stay mono inside the sheet (digests
   only — raw graph payloads never render). 503 at the seam → blocked row with a redacted reason;
   404 (no graph head) → EMPTY panel (frozen/04). */
function branchMapView(env){
  const map = env && env.branchMap && typeof env.branchMap === 'object' ? env.branchMap : null;
  const error = env && env.branchMapError && typeof env.branchMapError === 'object' ? env.branchMapError : null;
  if (map && map.projection && map.proof) {
    const sheet = map.sheet && typeof map.sheet === 'object' ? map.sheet : {};
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    return {
      state:'served',
      nodeCount:Math.max(0, Number(map.projection.nodeCount) || 0),
      edgeCount:Math.max(0, Number(map.projection.edgeCount) || 0),
      rowCount:rows.length || Math.max(0, Number(sheet.rows) || 0),
      rows,
      proof:map.proof,
    };
  }
  if (error && Number(error.status) === 404) return { state:'empty' };
  if (error) return { state:'blocked', status:Number(error.status) || 503, reason:(error.body && error.body.error) || 'branch_map_authority_unavailable' };
  return { state:'gap' };
}
function branchMapRowGlyph(row){
  if (row.kind === 'branch') return 'arc';
  if (row.kind === 'receipt') return 'proof';
  if (row.kind === 'gap') return 'gate';
  if (row.kind === 'campaign' || row.kind === 'wiki') return 'cortex';
  if (row.kind === 'organ' && MC_COMPONENT_REGISTRY.MissionGlyph.includes(String(row.organId || ''))) return String(row.organId);
  return 'build';
}
function renderBranchMapNodeRows(view){
  if (!view.rows.length) return '<div class="branch-map-counts" data-component="BranchMapSheetCounts"><span class="branch-map-mono">' + view.rowCount + ' sheet rows</span><span class="branch-map-mono">full rows in sheet</span></div>';
  return '<div class="branch-map-rows" data-component="BranchMapSheetRows">' + view.rows.slice(0, 4).map((row, index) => {
    const state = mcStateKind(row.status || 'active');
    return (index > 0 ? mcSignalRail({ state, packetCount:2 }) : '') +
      '<div class="' + mcClass('branch-map-row', state) + '" data-component="BranchMapNodeRow" data-branch-map-row="' + esc(row.kind || 'node') + '">' +
        mcGlyphSvg(branchMapRowGlyph(row), state) +
        '<span><b>' + esc(mcSceneClamp(row.title || row.id || 'node', 4)) + '</b><small>' + esc(mcText(row.kind, 'node')) + '</small></span>' +
        mcStateToken(state, mcSceneTokenLabel(state)) +
      '</div>';
  }).join('') + '</div>';
}
function renderBranchMapSection(env){
  const view = branchMapView(env);
  if (view.state === 'empty') {
    return '<div class="inspect-pane-section"><div class="inspect-pane-heading">Branch map</div>' +
      '<div class="state" data-component="BranchMapEmptyState" data-interaction-kind="read-only" data-source="cambium.telegram.branch-map-route.v1"><b>No nodes discovered</b><p>Initialize a survey to begin exploring.</p><div class="gbtns"><button type="button" data-branch-map-refresh="1">Refresh</button></div></div></div>';
  }
  const state = view.state === 'served' ? 'complete' : view.state === 'blocked' ? 'blocked' : 'idle';
  const detail = view.state === 'served'
    ? view.nodeCount + ' nodes · ' + view.edgeCount + ' edges'
    : view.state === 'blocked'
      ? 'digest refused at seam · pull to refresh'
      : 'branch map read model not served';
  return '<div class="inspect-pane-section"><div class="inspect-pane-heading">Branch map</div>' +
    '<section class="inspect-groups" data-component="BranchMapSheet" data-branch-map-state="' + esc(view.state) + '">' +
      '<button type="button" class="' + mcClass('inspect-group', state) + '" data-interaction-kind="sheet" data-source="cambium.telegram.branch-map-route.v1" data-inspect-branch-map="1">' +
        mcGlyphSvg('arc', state) +
        '<span><b>branch map</b><small>' + esc(detail) + '</small></span>' +
        mcStateToken(state, mcSceneTokenLabel(state)) +
      '</button>' +
    '</section>' +
    (view.state === 'served' ? renderBranchMapNodeRows(view) : '') +
  '</div>';
}
function openBranchMapSheet(env){
  const view = branchMapView(env);
  if (view.state === 'gap') { openInspectGroupSheet('surface-contract', env); return; }
  if (view.state === 'blocked') {
    $('sheetBody').innerHTML = '<div class="arc">inspect · branch map · blocked</div><h2>Branch map</h2>' +
      '<div class="nar">digest refused at seam · pull to refresh</div>' +
      '<div class="kv"><b>status</b><span>' + esc(String(view.status)) + '</span><b>refusal</b><span>' + esc(view.reason || 'branch_map_authority_unavailable') + '</span><b>redaction</b><span>redacted reason only · raw graph payloads never render</span></div>';
    veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
    return;
  }
  const proof = view.proof || {};
  const digestRows = [
    ['graph digest', proof.graphDigest],
    ['projection digest', proof.projectionDigest],
    ['sheet digest', proof.sheetEnvelopeDigest],
    ['sheet text digest', proof.sheetTextDigest],
    ['proof digest', proof.proofDigest],
  ].filter(([, value]) => value).map(([label, value]) => '<b>' + esc(label) + '</b><span>' + esc(value) + '</span>').join('');
  $('sheetBody').innerHTML = '<div class="arc">inspect · branch map · verified</div><h2>Branch map</h2>' +
    '<div class="nar">' + view.nodeCount + ' nodes · ' + view.edgeCount + ' edges · ' + view.rowCount + ' sheet rows</div>' +
    '<div class="kv"><b>graph version</b><span>' + esc(mcText(proof.graphVersion, 'missing')) + '</span><b>generated at</b><span>' + esc(mcText(proof.generatedAt, 'missing')) + '</span>' + digestRows + '<b>redaction</b><span>digests only · raw graph payloads stay on the worker</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('light');
}
function openInspectGroupSheet(id, env){
  const L = (env && env.ledger) || env || {};
  const group = inspectAllGroupSummaries(env || { ledger:L }, L).find(row => row.id === id) || inspectGroupSummaries(env || { ledger:L }, L)[0];
  const related = inspectRelatedPage(group.id);
  const scene = inspectRelatedScene(group.id);
  $('sheetBody').innerHTML = '<div class="arc">inspect · ' + esc(group.id) + '</div><h2>' + esc(group.title) + '</h2>' +
    '<div class="nar">' + esc(group.detail) + '</div>' +
    '<div class="kv"><b>proof layer</b><span>Inspect keeps proof and architecture details behind the main app flow</span><b>summary</b><span>' + esc(group.detail) + '</span><b>state</b><span>' + esc(mcStateKind(group.state)) + '</span><b>proof</b><span>read-only Inspect sheet; primary pages link back here for evidence</span><b>related page</b><span>' + esc(related) + ' -> Inspect</span>' +
    inspectGroupDetailRows(group.id, env || { ledger:L }, L).map(([label, value]) => '<b>' + esc(label) + '</b><span>' + esc(value) + '</span>').join('') +
    '<b>source</b><span>inspect-proof-layer@v1</span><b>return path</b><span>' + esc(related) + '</span><b>how to use this</b><span>Open the primary page, then return to Inspect for proof detail</span></div>' +
    (group.id === 'evidence' ? inspectEvidenceBeatList(env) : '') +
    '<div class="gbtns"><button type="button" data-inspect-page-link="' + esc(scene) + '">Open related page</button></div>';
  $('sheetBody').querySelectorAll('[data-inspect-beat]').forEach(el => el.onclick = () => openInspectEvidenceSheet(env, +el.dataset.inspectBeat));
  $('sheetBody').querySelectorAll('[data-inspect-page-link]').forEach(el => el.onclick = () => {
    closeSheet();
    const target = el.dataset.inspectPageLink;
    go(target === 'mission' ? 0 : target === 'gate' ? 1 : target === 'tools' ? 2 : 4);
    if (target === 'tools') renderCommands();
  });
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(group.state === 'blocked' || group.state === 'stale' ? 'medium' : 'light');
}
function openInspectSummarySheet(env){
  const L = (env && env.ledger) || env || {};
  const liveRows = liveProofCards(env || { ledger:L });
  const blockedRows = liveRows.filter(row => row.state !== 'ready');
  const blockedBlock = blockedRows.length
    ? '<div class="kv">' + blockedRows.slice(0, 6).map((row, i) => '<b>blocker ' + (i + 1) + '</b><span>' + esc((row.title || row.id || 'readiness row') + ' · ' + (row.detail || row.proof || 'detail missing')) + '</span>').join('') + '</div>'
    : '<div class="nar">no blocked live readiness rows served.</div>';
  const summary = 'Cambium mini app proof summary: ' + branchRows(env || { ledger:L }).length + ' branch packet(s), ' + blockedRows.length + ' live readiness blocker(s), sources stay in Inspect, receipts stay redacted.';
  /* frozen/05 §4.1 bans copy affordances; the summary renders as a mono value inline
     (frozen/06 §1.7 #11 ratified mono values, not copy buttons). */
  $('sheetBody').innerHTML = '<div class="arc">inspect · proof summary</div><h2>Proof Summary</h2>' +
    '<div class="nar">' + esc(summary) + '</div>' +
    '<div class="kv"><b>summary</b><span>' + esc(summary) + '</span><b>surface</b><span>workers/quests/src/page.ts</span><b>blocker names</b><span>' + esc(blockedRows.length ? blockedRows.slice(0, 4).map(row => row.title || row.id || 'readiness row').join(' · ') : 'none') + '</span><b>redaction rule</b><span>no raw initData, bearer token, or secret value in proof artifacts</span></div>' + blockedBlock;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('light');
}
function selectInspectView(env, pane, focusSelected){
  INSPECT_PANE = pane === 'system' ? 'system' : 'proof';
  renderInspect(env);
  if (focusSelected) focusRenderedTab('mapwrap', '[data-inspect-pane-select="' + INSPECT_PANE + '"]');
}
function renderInspect(env){
  const L = env.ledger || env;
  const activeStageId = stageForArc((L.current && L.current.arc) || 'XVII');
  const stageCards = STAGES.map((stage, i) => {
    const rows = stageRows(L, stage);
    const done = rows.filter(row => row.status === 'complete').length;
    const active = stage.id === activeStageId;
    const pct = rows.length ? Math.round(100 * done / rows.length) : 0;
    return '<button type="button" class="stage-card ' + (active ? 'active ' : '') + (done === rows.length && rows.length ? 'done' : '') + '" style="--i:' + i + '" data-stage="' + stage.id + '">' +
      '<span class="stage-glyph">' + esc(stage.glyph) + '</span>' +
      '<span><span class="stage-title">' + esc(stage.title) + '</span><span class="stage-detail">' + esc(stage.detail) + '</span>' +
        '<span class="stagebar"><span style="width:' + pct + '%"></span></span></span>' +
      '<span class="stage-count">' + done + '/' + rows.length + '</span>' +
    '</button>';
  }).join('');
  const railCards = RAILS.map(rail => {
    const hot = rail.from === activeStageId || rail.to === activeStageId;
    return '<button type="button" class="rail ' + (hot ? 'hot' : '') + '" data-interaction-kind="sheet" data-source="shared/cambium-visual-contract" data-rail="' + esc(rail.id || (rail.from + '-' + rail.to)) + '"><b>' + esc(stageTitle(rail.from)) + ' -> ' + esc(stageTitle(rail.to)) + '</b><span>' + esc(rail.label) + '</span></button>';
  }).join('');
  const inspectEnv = env.ledger ? env : { ledger:L };
  const proofPane =
    '<section id="inspect-proof-panel" data-inspect-pane="proof" class="inspect-pane is-active" role="tabpanel" aria-labelledby="inspect-proof-tab">' +
      '<div class="inspect-pane-section"><div class="inspect-pane-heading">Decision readiness</div>' + renderInspectGroups(inspectEnv, L, ['freshness','live-proof','branch-packets','gates','action-requests','policy','evidence']) + '</div>' +
      renderBranchMapSection(inspectEnv) +
      renderInspectDisclosure('Live readiness', '<div class="cmdgrp">live proof</div>' + renderLiveProof(inspectEnv), false) +
      renderInspectDisclosure('Branch evidence', '<div class="cmdgrp">branch packets</div>' + renderBranches(inspectEnv) + '<div class="cmdgrp">missions</div>' + renderBranchMissions(inspectEnv) + '<div class="cmdgrp">KPIs</div>' + renderBranchKpis(inspectEnv), false) +
      renderInspectDisclosure('Decisions and receipts', '<div class="cmdgrp">gates</div>' + renderBranchGates(inspectEnv) + '<div class="cmdgrp">action requests</div>' + renderActionRequests(inspectEnv) + '<div class="cmdgrp">proof paths</div>' + renderBranchProof(inspectEnv), false) +
      renderInspectDisclosure('Evidence rows', '<div class="cmdgrp">evidence</div>' + renderInsightBoxes(inspectEnv), false) +
    '</section>';
  const systemPane =
    '<section id="inspect-system-panel" data-inspect-pane="system" class="inspect-pane is-active" role="tabpanel" aria-labelledby="inspect-system-tab">' +
      '<div class="inspect-pane-section"><div class="inspect-pane-heading">System map</div>' + renderInspectGroups(inspectEnv, L, ['tools','rails']) + '</div>' +
      renderInspectSecondaryLinks(inspectEnv, L) +
      renderInspectDisclosure('Runtime state', '<div class="cmdgrp">freshness</div>' + renderTapestryAudit(inspectEnv) + '<div class="cmdgrp">wake</div>' + renderWake(inspectEnv) + '<div class="cmdgrp">lanes</div>' + renderLanes(inspectEnv) + '<div class="cmdgrp">stance</div>' + renderStance(inspectEnv) + '<div class="cmdgrp">policy</div>' + renderPolicy(inspectEnv) + '<div class="cmdgrp">decision context</div>' + renderDecisionContext(inspectEnv), false) +
      renderInspectDisclosure('Tapestry signals', '<div class="cmdgrp">side quests</div>' + renderSideQuests(inspectEnv) + '<div class="cmdgrp">coordination</div>' + renderSocial(inspectEnv) + '<div class="cmdgrp">senses</div>' + renderSenses(inspectEnv) + '<div class="stagegrid">' + stageCards + '</div><div class="cmdgrp">rails</div><div class="railgrid">' + railCards + '</div>', false) +
      renderInspectDisclosure('Operators', '<div class="cmdgrp">skill labors</div>' + renderSkills(inspectEnv) + '<div class="cmdgrp">companions</div>' + renderNpc(inspectEnv), false) +
    '</section>';
  $('mapwrap').innerHTML =
    '<div class="maphead"><div><h2>Inspect</h2><p>proof · packets · freshness · evidence</p></div>' +
      '<button type="button" class="mapbadge" data-interaction-kind="sheet" data-source="shared/cambium-visual-contract" data-ecosystem-target="r3f">frontier · ' + esc((L.current && L.current.arc) || 'complete') + '</button></div>' +
    renderInspectProofSummary(inspectEnv, L) +
    renderInspectPaneSwitcher() + (INSPECT_PANE === 'system' ? systemPane : proofPane) +
    '<div class="mapnote">Inspect keeps the low-level proof rows out of Mission, Gate, Tools, and Story.</div>';
  const inspectTabs = [...$('mapwrap').querySelectorAll('[data-inspect-pane-select]')];
  inspectTabs.forEach((el, index) => {
    el.onclick = () => selectInspectView(env, el.dataset.inspectPaneSelect, true);
    el.onkeydown = event => {
      const target = tabKeyTargetIndex(event, index, inspectTabs.length);
      if (target === null) return;
      selectInspectView(env, inspectTabs[target].dataset.inspectPaneSelect, true);
    };
  });
  $('mapwrap').querySelectorAll('.mapbadge').forEach(el => el.onclick = () => openMapHeaderSheet(L));
  $('mapwrap').querySelectorAll('[data-inspect-group]').forEach(el => el.onclick = () => openInspectGroupSheet(el.dataset.inspectGroup, env.ledger ? env : { ledger:L }));
  $('mapwrap').querySelectorAll('[data-inspect-summary]').forEach(el => el.onclick = () => openInspectSummarySheet(env.ledger ? env : { ledger:L }));
  $('mapwrap').querySelectorAll('[data-inspect-branch-map]').forEach(el => el.onclick = () => openBranchMapSheet(env.ledger ? env : { ledger:L }));
  $('mapwrap').querySelectorAll('[data-branch-map-refresh]').forEach(el => el.onclick = () => refresh());
  $('mapwrap').querySelectorAll('.rail').forEach(el => el.onclick = () => openRailSheet(el.dataset.rail, L));
  $('mapwrap').querySelectorAll('.stage-card').forEach(el => el.onclick = () => openMapSheet(L, el.dataset.stage));
  $('mapwrap').querySelectorAll('[data-wake]').forEach(el => el.onclick = () => openWakeBox(env.ledger ? env : { ledger:L }, +el.dataset.wake));
  $('mapwrap').querySelectorAll('.sense').forEach(el => el.onclick = () => openSenseSheet(env.ledger ? env : { ledger:L }, el.dataset.sense));
  $('mapwrap').querySelectorAll('[data-lane]').forEach(el => el.onclick = () => openLaneSheet(env.ledger ? env : { ledger:L }, el.dataset.lane));
  $('mapwrap').querySelectorAll('[data-stance]').forEach(el => el.onclick = () => openStanceBox(env.ledger ? env : { ledger:L }));
  $('mapwrap').querySelectorAll('[data-policy]').forEach(el => el.onclick = () => openPolicyBox(env.ledger ? env : { ledger:L }));
  $('mapwrap').querySelectorAll('[data-decision]').forEach(el => el.onclick = () => openDecisionContextBox(env.ledger ? env : { ledger:L }, +el.dataset.decision));
  $('mapwrap').querySelectorAll('[data-tapestry]').forEach(el => el.onclick = () => openTapestryBox(env.ledger ? env : { ledger:L }, +el.dataset.tapestry));
  $('mapwrap').querySelectorAll('[data-live-proof]').forEach(el => el.onclick = () => openLiveProofBox(env.ledger ? env : { ledger:L }, +el.dataset.liveProof));
  $('mapwrap').querySelectorAll('[data-branch-gap]').forEach(el => el.onclick = () => openBranchMissionSheet(env.ledger ? env : { ledger:L }, 0, -1));
  $('mapwrap').querySelectorAll('.ibox.branch[data-branch]').forEach(el => el.onclick = () => openBranchMissionSheet(env.ledger ? env : { ledger:L }, +el.dataset.branch, -1));
  $('mapwrap').querySelectorAll('[data-branch-mission]').forEach(el => el.onclick = () => openBranchMissionSheet(env.ledger ? env : { ledger:L }, +el.dataset.branch, +el.dataset.branchMission));
  $('mapwrap').querySelectorAll('[data-branch-kpi],[data-branch-gate],[data-branch-proof]').forEach(el => el.onclick = () => openBranchMissionSheet(env.ledger ? env : { ledger:L }, +el.dataset.branch, -1));
  $('mapwrap').querySelectorAll('[data-action-request-index]').forEach(el => el.onclick = () => openActionRequestBox(env.ledger ? env : { ledger:L }, +el.dataset.actionRequestIndex));
  $('mapwrap').querySelectorAll('[data-side]').forEach(el => el.onclick = () => openSideQuestBox(env.ledger ? env : { ledger:L }, +el.dataset.side));
  $('mapwrap').querySelectorAll('[data-social]').forEach(el => el.onclick = () => openSocialBox(env.ledger ? env : { ledger:L }, +el.dataset.social));
  $('mapwrap').querySelectorAll('.ibox[data-box]').forEach(el => el.onclick = () => openInsightBox(env.ledger ? env : { ledger:L }, +el.dataset.box));
  $('mapwrap').querySelectorAll('[data-skill]').forEach(el => el.onclick = () => openSkillBox(env.ledger ? env : { ledger:L }, +el.dataset.skill));
  $('mapwrap').querySelectorAll('[data-npc]').forEach(el => el.onclick = () => openNpcBox(env.ledger ? env : { ledger:L }, +el.dataset.npc));
}
function openMapHeaderSheet(L){
  const row = currentQuestRow(L);
  const arc = (row && row.arc) || (L.current && L.current.arc) || 'complete';
  const organId = row ? stageForArc(arc) : 'complete';
  $('sheetBody').innerHTML = '<div class="arc">inspect · active frontier</div><h2>Inspect Header</h2>' +
    '<div class="nar">Inspect exposes source contracts, provenance, and low-level proof detail for the current frontier.</div>' +
    '<div class="kv"><b>active arc</b><span>' + esc(arc) + '</span><b>active organ</b><span>' + esc(row ? stageTitle(organId) : 'all organs complete') + '</span><b>source</b><span>shared/cambium-visual-contract</span><b>quest title</b><span>' + esc((row && row.title) || (L.current && L.current.title) || 'no active quest') + '</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(row ? 'medium' : 'light');
}
function railEcosystemTarget(rail){
  if (rail.lane === 'handoff') return 'paperclip';
  if (rail.lane === 'runner') return 'quine';
  if (rail.lane === 'background-emitter') return 'cortex';
  return 'r3f';
}
function stageEcosystemTarget(stageId){
  if (stageId === 'genesis') return 'genesis';
  if (stageId === 'taste') return 'taste';
  if (stageId === 'build') return 'build';
  if (stageId === 'ops') return 'ops';
  if (stageId === 'cortex') return 'cortex';
  return 'r3f';
}
function openRailSheet(railId, L){
  const rail = RAILS.find(item => item.id === railId) || RAILS.find(item => (item.from + '-' + item.to) === railId) || RAILS[0];
  const row = currentQuestRow(L);
  const activeOrgan = row ? stageForArc(row.arc) : 'complete';
  const hot = row && (rail.from === activeOrgan || rail.to === activeOrgan);
  const target = railEcosystemTarget(rail);
  $('sheetBody').innerHTML = '<div class="arc">rail · ' + esc(rail.id) + '</div><h2>' + esc(stageTitle(rail.from)) + ' -> ' + esc(stageTitle(rail.to)) + '</h2>' +
    '<div class="nar">' + esc(rail.label) + '</div>' +
    '<div class="kv"><b>data rail</b><span>' + esc(rail.id) + '</span><b>source</b><span>shared/cambium-visual-contract.ts</span><b>proof</b><span>shared/cambium-visual-contract.ts</span><b>ecosystem target</b><span>' + esc(target) + '</span><b>from organ</b><span>' + esc(stageTitle(rail.from)) + '</span><b>to organ</b><span>' + esc(stageTitle(rail.to)) + '</span><b>lane</b><span>' + esc(rail.lane || 'missing') + '</span><b>active arc</b><span>' + esc((row && row.arc) || 'complete') + '</span><b>active organ</b><span>' + esc(activeOrgan === 'complete' ? 'complete' : stageTitle(activeOrgan)) + '</span><b>active rail</b><span>' + esc(hot ? 'yes · touches active organ' : 'no · does not touch active organ') + '</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(hot ? 'medium' : 'light');
}
// parse the evidence string into honest facets: "a · b · c" -> chips, "done" if it
// reads as a satisfied count (x/x) or lacks "pending", else "pending".
function facetsFrom(ev){
  return String(ev || '').split('·').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
    const pend = /pending|todo|blocked|missing/i.test(s);
    const done = (m && m[1] === m[2] && +m[2] > 0) || (!pend && !m && /\\b(yes|done|signed|received|true)\\b/i.test(s));
    return { label: s, done: done && !pend };
  });
}
function openMapSheet(L, stageId){
  const stage = STAGES.find(s => s.id === stageId) || STAGES[0];
  const rows = stageRows(L, stage);
  const target = stageEcosystemTarget(stage.id);
  const stageState = rows.length ? (rows.some(row => row.status !== 'complete') ? 'active' : 'complete') : 'idle';
  const stageHeader = '<div class="branch-sheet-head" data-component="VisualStageSheetHeader" data-stage-state="' + esc(stageState) + '">' + mcGlyphSvg(stage.id, stageState) + '<div><div class="arc">inspect stage · ' + esc(stage.id) + '</div><h2>' + esc(stage.title) + '</h2></div>' + mcStateToken(stageState, rows.length ? 'Read-only' : 'No rows') + '</div>';
  const stageMeta = '<div class="kv"><b>organ target</b><span>' + esc(target) + '</span><b>source</b><span>shared/cambium-visual-contract.ts</span><b>interaction</b><span>read-only stage inspection; no signed action is queued from this sheet</span></div>';
  const body = rows.length ? rows.map((row, i) => {
    const facets = facetsFrom(row.evidence);
    return '<div class="li"><span class="cname">' + esc(row.arc) + ' · ' + esc(row.title) + '</span> <span class="cargs">' + esc(row.status) + '</span>' +
      '<div class="facets" style="margin-top:8px">' + (facets.length ? facets.map((f,j) =>
        '<div class="facet ' + (f.done?'done':'pend') + '" style="--i:' + (i + j) + '"><span class="dot"></span>' + esc(f.label) + '</div>').join('') : '<div class="cdesc">' + esc(row.evidence) + '</div>') +
      '</div></div>';
  }).join('') : '<div class="nar">no quest rows currently mapped to this organ. Source: shared/cambium-visual-contract.ts.</div>';
  $('sheetBody').innerHTML = stageHeader + '<div class="nar">' + esc(stage.detail) + '</div>' + stageMeta + body;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function qarg(value){
  return JSON.stringify(String(value || '').replace(/\\s+/g, ' ').trim());
}
function wakeEventCommand(wake, status){
  const step = wake.id || 'step';
  const detail = wake.detail || (status === 'proved' ? 'wake step proved' : 'wake step missing');
  const proof = wake.proof || detail;
  return 'quine write quests wake-event ' + step + ' ' + status + ' --detail ' + qarg(detail) + ' --proof ' + qarg(proof) + ' --target ' + qarg('wake:' + step) + ' --tenant ' + qarg(TENANT);
}
function openWakeBox(env, index){
  const wake = wakeSteps(env)[index] || wakeSteps(env)[0];
  const currentStatus = wake.done ? 'proved' : 'missing';
  const servedEvidence = Array.isArray(wake.evidence) ? wake.evidence : [];
  const history = wake.history || { source:'missing', total:0, status:'none', proof:'no operator wake events served', rows:[] };
  const evidence = servedEvidence.length
    ? '<div class="kv">' + servedEvidence.slice(0, 4).map((item, i) => '<b>evidence ' + (i + 1) + '</b><span>' + esc((item.label || 'row') + ' · ' + (item.status || 'served') + ' · ' + (item.detail || '')) + '</span>').join('') + '</div>'
    : '';
  const wakeActionRows = wake.done
    ? '<b>event command</b><span>' + esc(wakeEventCommand(wake, 'proved')) + '</span>'
    : '<b>side quest target</b><span>wake-proof</span><b>quine command</b><span>' + esc(wakeEventCommand(wake, 'missing')) + '</span>';
  const historyRows = Array.isArray(history.rows) && history.rows.length
    ? '<div class="kv">' + history.rows.slice(0, 4).map((row, i) => '<b>history ' + (i + 1) + '</b><span>' + esc((row.id || 'event') + ' · ' + (row.status || 'missing') + ' · ' + (row.source || history.source || 'missing') + ' · ' + (row.detail || row.proof || 'detail missing')) + '</span>').join('') + '</div>'
    : '<div class="nar">no operator wake events served; this is the latest snapshot, not a historical trace.</div>';
  $('sheetBody').innerHTML = '<div class="arc">wake step · ' + esc(currentStatus) + '</div><h2>' + esc(wake.label) + '</h2>' +
    '<div class="nar">' + esc(wake.detail) + '</div><div class="kv"><b>current status</b><span>' + esc(currentStatus) + '</span><b>source</b><span>' + esc(wake.source || 'missing') + '</span><b>proof</b><span>' + esc(wake.proof || wake.detail) + '</span><b>wake event source</b><span>' + esc(history.source || 'missing') + '</span><b>history count</b><span>' + Number(history.total || 0) + '</span><b>wake history</b><span>' + esc((history.source || 'missing') + ' · ' + (history.status || 'none') + ' · ' + Number(history.total || 0) + ' event(s)') + '</span><b>history proof</b><span>' + esc(history.proof || 'history proof missing') + '</span><b>history relation</b><span>operator wake history is shown separately from the current served status</span>' + wakeActionRows + '</div>' + evidence + historyRows;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(wake.done ? 'medium' : 'light');
}
function openSenseSheet(env, senseId){
  const L = env.ledger;
  const cards = senseCards(env);
  const sense = cards.find(card => card.id === senseId) || cards[0];
  const servedEvidence = Array.isArray(sense.evidence) ? sense.evidence : [];
  let rows = [];
  if (sense.id === 'signal') rows = activeRow(L) ? [activeRow(L)] : [];
  if (sense.id === 'memory') rows = L.rows.filter(row => stageForArc(row.arc) === 'cortex');
  if (sense.id === 'risk') rows = L.rows.filter(row => row.status === 'locked' || /pending|blocked|missing|unreachable|rejected/i.test(row.evidence || ''));
  if (sense.id === 'drift') rows = L.rows.filter(row => row.status === 'active').slice(0, 1);
  const body = servedEvidence.length ? servedEvidence.map((item, i) =>
    '<div class="li"><span class="cname">' + esc(item.label || 'evidence') + '</span> <span class="cargs">' + esc(item.status || sense.source || 'served') + '</span><div class="cdesc">' + esc(item.detail || sense.proof || 'proof missing') + '</div></div>'
  ).join('') : rows.length ? rows.map((row, i) =>
    '<div class="li"><span class="cname">' + esc(rowLabel(row)) + '</span> <span class="cargs">' + esc(row.status) + '</span><div class="cdesc">' + esc(row.evidence) + '</div></div>'
  ).join('') : '<div class="nar">' + esc(sense.proof || 'no rows currently prove this sense; the map keeps this as an explicit gap.') + '</div>';
  $('sheetBody').innerHTML = '<div class="arc">sense · ' + esc(sense.id) + '</div><h2>' + esc(sense.title) + '</h2>' +
    '<div class="nar">' + esc(sense.detail) + '</div><div class="kv"><b>source</b><span>' + esc(sense.source || 'missing') + '</span><b>ecosystem target</b><span>' + esc(sense.target || senseEcosystemTarget(sense.id)) + '</span><b>proof</b><span>' + esc(sense.proof || sense.detail) + '</span></div>' + body;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function openLaneSheet(env, laneId){
  const lane = laneCards(env).find(card => card.id === laneId) || laneCards(env)[0];
  $('sheetBody').innerHTML = '<div class="arc">lane · ' + esc(lane.id) + '</div><h2>' + esc(lane.title) + '</h2>' +
    '<div class="nar">' + esc(lane.detail) + '</div><div class="kv"><b>source</b><span>' + esc(lane.source || 'missing') + '</span><b>world.log</b><span>' + esc(lane.worldLog || 'missing') + '</span><b>count</b><span>' + Number(lane.count || 0) + '</span><b>ratio</b><span>' + Math.round(Number(lane.ratio || 0) * 100) + '%</span><b>sample size</b><span>' + Number(lane.sampleSize || 0) + '</span><b>stance contribution</b><span>' + esc(lane.stanceContribution || 'no stance contribution') + '</span><b>recommendation</b><span>' + esc(lane.recommendation || 'no recommendation') + '</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(lane.on ? 'medium' : 'light');
}
function openStanceBox(env){
  const stance = stanceCard(env);
  $('sheetBody').innerHTML = '<div class="arc">tenant stance · ' + esc(stance.state) + '</div><h2>' + esc(stance.title) + '</h2>' +
    '<div class="nar">' + esc(stance.detail) + '</div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(stance.state === 'ready' ? 'medium' : 'light');
}
function openPolicyBox(env){
  const policy = policyCard(env);
  const blockers = policy.blockers && policy.blockers.length
    ? '<div class="kv">' + policy.blockers.slice(0, 4).map((blocker, i) => '<b>blocker ' + (i + 1) + '</b><span>' + esc(blocker) + '</span>').join('') + '</div>'
    : '';
  const cautions = policy.cautions && policy.cautions.length
    ? '<div class="kv">' + policy.cautions.slice(0, 3).map((caution, i) => '<b>caution ' + (i + 1) + '</b><span>' + esc(caution) + '</span>').join('') + '</div>'
    : '';
  const ladder = '<div class="kv"><b>promotion ladder</b><span>prototype -> proof-only -> supervised branch -> founder-approved release</span><b>release rule</b><span>live-proof blockers must clear before broad release claims</span></div>';
  $('sheetBody').innerHTML = '<div class="arc">next action · ' + esc(policy.state) + '</div><h2>' + esc(policy.title) + '</h2>' +
    '<div class="nar">' + esc(policy.detail) + '</div>' + ladder + blockers + cautions;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(policy.state === 'ready' ? 'medium' : 'light');
}
function openDecisionContextBox(env, index){
  const row = decisionContextCards(env)[index] || decisionContextCards(env)[0];
  const evidence = row.evidence.length
    ? '<div class="kv">' + row.evidence.slice(0, 4).map((item, i) => '<b>evidence ' + (i + 1) + '</b><span>' + esc((item.label || 'row') + ' · ' + (item.status || 'served') + ' · ' + (item.detail || '')) + '</span>').join('') + '</div>'
    : '<div class="nar">no served evidence rows for this decision signal; it remains context, not policy authority.</div>';
  $('sheetBody').innerHTML = '<div class="arc">decision context · ' + esc(row.state) + '</div><h2>' + esc(row.title) + '</h2>' +
    '<div class="nar">' + esc(row.detail) + '</div><div class="kv"><b>source</b><span>' + esc(row.source || 'missing') + '</span><b>scope</b><span>' + esc(row.scope || 'tenant-only') + '</span><b>proof</b><span>' + esc(row.proof || row.detail) + '</span></div>' + evidence;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(row.state === 'ready' ? 'medium' : 'light');
}
function openLiveProofSummaryBox(env){
  const live = env.liveProof || {};
  const rows = liveProofCards(env);
  const summary = live.summary || {};
  const total = Number.isFinite(Number(summary.total)) ? Number(summary.total) : rows.length;
  const ready = Number.isFinite(Number(summary.ready)) ? Number(summary.ready) : rows.filter(row => row.state === 'ready').length;
  const blocked = Number.isFinite(Number(summary.blocked)) ? Number(summary.blocked) : rows.filter(row => row.state !== 'ready').length;
  const liveProofReady = live.status === 'ready' || summary.liveProofReady === true;
  const blockedRows = rows.filter(row => row.state !== 'ready').slice(0, 6);
  const blockedBlock = blockedRows.length
    ? '<div class="kv">' + blockedRows.map((row, i) => '<b>blocked row ' + (i + 1) + '</b><span>' + esc(row.title + ' · ' + row.detail) + '</span>').join('') + '</div>'
    : '<div class="nar">no blocked live-proof rows served.</div>';
  $('sheetBody').innerHTML = '<div class="arc">live proof summary · ' + esc(liveProofReady ? 'ready' : 'blocked') + '</div><h2>Live Proof Summary</h2>' +
    '<div class="nar">' + esc(live.invariant || 'capture plan is guidance, not proof') + '</div>' +
    '<div class="kv"><b>ready</b><span>' + ready + '</span><b>blocked</b><span>' + blocked + '</span><b>total</b><span>' + total + '</span><b>liveProofReady</b><span>' + esc(String(liveProofReady)) + '</span><b>source</b><span>' + esc(live.source || 'missing') + '</span></div>' + blockedBlock;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(liveProofReady ? 'medium' : 'light');
}
function openTapestryBox(env, index){
  const row = tapestryRows(env)[index] || tapestryRows(env)[0];
  if (row.id === 'wake-health') {
    const wake = wakeSteps(env);
    const firstMissing = wake.findIndex(step => !step.done);
    openWakeBox(env, firstMissing >= 0 ? firstMissing : 0);
    return;
  }
  if (row.id === 'evidence-boxes') {
    const boxes = insightBoxes(env);
    const firstWait = boxes.findIndex(box => box.state !== 'ready');
    openInsightBox(env, firstWait >= 0 ? firstWait : 0);
    return;
  }
  if (row.id === 'priority-signals') {
    const decisions = decisionContextCards(env);
    const firstPriority = decisions.findIndex(item => item.source === 'operator-priority-signals');
    openDecisionContextBox(env, firstPriority >= 0 ? firstPriority : 0);
    return;
  }
  if (row.id === 'coordination-source') {
    const socials = socialCards(env);
    const firstReady = socials.findIndex(item => item.state === 'ready');
    openSocialBox(env, firstReady >= 0 ? firstReady : 0);
    return;
  }
  if (row.id === 'npc-history' || row.id === 'mira-relationship') {
    const npcs = npcCards(env);
    const miraIndex = npcs.findIndex(npc => String(npc.title || '').toUpperCase() === 'MIRA');
    openNpcBox(env, miraIndex >= 0 ? miraIndex : 0);
    return;
  }
  if (row.id === 'command-state' && !env.commands) { openCmdSheet('status'); return; }
  if (row.id === 'live-proof') { openLiveProofSummaryBox(env); return; }
  if (row.id === 'decision-context') {
    const firstMissing = decisionContextCards(env).findIndex(item => item.state !== 'ready');
    openDecisionContextBox(env, firstMissing >= 0 ? firstMissing : 0);
    return;
  }
  const freshness = row.id === 'freshness-gaps'
    ? '<b>derivedAt</b><span>' + esc(env.derivedAt || 'missing') + '</span><b>stale threshold</b><span>360 minutes</span><b>refresh command</b><span>quine write quests push --tenant ' + esc(TENANT) + '</span>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">completion definition · ' + esc(row.state) + '</div><h2>' + esc(row.title) + '</h2>' +
    '<div class="nar">' + esc(row.detail) + '</div><div class="kv"><b>source</b><span>' + esc(row.source || 'missing') + '</span><b>ecosystem target</b><span>' + esc(tapestryTarget(row)) + '</span><b>requirement</b><span>' + esc(row.id || 'tapestry-row') + '</span><b>proof</b><span>' + esc(row.proof || row.detail) + '</span>' + freshness + '</div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(row.state === 'ready' ? 'medium' : 'light');
}
function openSideQuestBox(env, index){
  const side = sideQuestCards(env)[index] || sideQuestCards(env)[0];
  const runtime = side.runtime || { source:'missing', status:side.status || 'triggered', total:0, proof:'no operator side-quest events served', rows:[] };
  const canQueue = side.state === 'ready' && ['refresh', 'founder-review', 'collect-evidence'].includes(String(side.action.kind || ''));
  const historyRows = Array.isArray(runtime.rows) && runtime.rows.length
    ? '<div class="kv">' + runtime.rows.slice(0, 4).map((row, i) => '<b>history ' + (i + 1) + '</b><span>' + esc((row.id || 'event') + ' · ' + (row.status || 'queued') + ' · ' + (row.source || runtime.source || 'missing') + ' · ' + (row.detail || row.proof || 'detail missing')) + '</span>').join('') + '</div>'
    : '<div class="nar">no operator side-quest events served; this branch is only a trigger predicate.</div>';
  const action = canQueue
    ? '<div class="gbtns sideq"><button type="button" class="approve" data-queue-side-quest="1">Queue side quest</button></div>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">side quest · ' + esc(side.state) + '</div><h2>' + esc(side.title) + '</h2>' +
    '<div class="nar">' + esc(side.detail) + '</div>' +
    '<div class="kv"><b>owner</b><span>' + esc(side.owner) + '</span><b>action</b><span>' + esc(side.action.label || side.action.kind || 'inspect') + '</span><b>target</b><span>' + esc(side.action.target || 'unknown') + '</span><b>lifetime</b><span>' + esc(side.lifetime.detail || 'lifetime not served') + '</span><b>completion</b><span>' + esc(side.completion.proof || 'completion proof not served') + '</span><b>queue effect</b><span>queued action only; side quest ledger and registry remain unchanged until the operator consumes the queued action</span><b>trigger</b><span>' + esc(side.trigger) + '</span><b>origin</b><span>' + esc(side.origin || 'unknown') + '</span><b>proof</b><span>' + esc(side.proof) + '</span><b>side quest history</b><span>' + esc((runtime.source || 'missing') + ' · ' + (runtime.status || side.status || 'triggered') + ' · ' + Number(runtime.total || 0) + ' event(s)') + '</span><b>history proof</b><span>' + esc(runtime.proof || 'runtime proof missing') + '</span></div>' + action + historyRows;
  const queue = $('sheetBody').querySelector('[data-queue-side-quest]');
  if (queue) queue.onclick = () => sideQuestAct(side, queue);
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(side.state === 'ready' ? 'medium' : 'light');
}
function openSocialBox(env, index){
  const row = socialCards(env)[index] || socialCards(env)[0];
  const evidence = row.evidence.length
    ? '<div class="kv">' + row.evidence.slice(0, 4).map((item, i) => '<b>evidence ' + (i + 1) + '</b><span>' + esc((item.label || 'row') + ' · ' + (item.status || 'served') + ' · ' + (item.detail || '')) + '</span>').join('') + '</div>'
    : '<div class="nar">no coordination evidence rows served; the map keeps this as an explicit gap.</div>';
  $('sheetBody').innerHTML = '<div class="arc">coordination · ' + esc(row.state) + '</div><h2>' + esc(row.title) + '</h2>' +
    '<div class="nar">' + esc(row.detail) + '</div><div class="kv"><b>source</b><span>' + esc(row.source || 'missing') + '</span><b>scope</b><span>' + esc(row.scope || 'tenant-handoff-only') + '</span><b>proof</b><span>' + esc(row.proof || row.detail) + '</span></div>' + evidence;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(row.state === 'ready' ? 'medium' : 'light');
}
function openLiveProofBox(env, index){
  const row = liveProofCards(env)[index] || liveProofCards(env)[0];
  const prereqs = row.prerequisites.length
    ? '<div class="kv">' + row.prerequisites.slice(0, 14).map((item, i) => '<b>prereq ' + (i + 1) + '</b><span>' + esc((item.label || 'prerequisite') + ' · ' + (item.status || 'blocked') + ' · ' + (item.detail || 'detail missing')) + '</span>').join('') + '</div>'
    : '<div class="nar">no prerequisites served; run the readiness command before capture.</div>';
  const privacy = row.privacy.length
    ? '<div class="kv">' + row.privacy.slice(0, 5).map((item, i) => '<b>privacy ' + (i + 1) + '</b><span>' + esc(item) + '</span>').join('') + '</div>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">capture plan · not proof · ' + esc(row.rawState || row.state) + '</div><h2>' + esc(row.title) + '</h2>' +
    '<div class="nar">' + esc(row.detail) + '</div><div class="kv"><b>source</b><span>' + esc(row.source || 'missing') + '</span><b>writes</b><span>' + esc(row.writes || 'receipt path missing') + '</span><b>command</b><span>' + esc(row.command || 'npm run proof:tg-live-readiness') + '</span><b>invariant</b><span>' + esc(row.invariant || 'Capture commands create redacted receipts; they are proof only after their artifacts validate ready.') + '</span><b>proof rule</b><span>' + esc(row.proof || row.detail) + '</span></div>' + prereqs + privacy;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(row.state === 'ready' ? 'medium' : 'light');
}
function openInsightBox(env, index){
  const box = insightBoxes(env)[index] || insightBoxes(env)[0];
  const servedEvidence = Array.isArray(box.evidence) ? box.evidence : [];
  const evidence = servedEvidence.length
    ? '<div class="kv">' + servedEvidence.slice(0, 4).map((item, i) => '<b>evidence ' + (i + 1) + '</b><span>' + esc((item.label || 'row') + ' · ' + (item.status || 'served') + ' · ' + (item.detail || '')) + '</span>').join('') + '</div>'
    : '';
  const rowSource = box.source && box.source !== box.insightSource
    ? '<b>row source</b><span>' + esc(box.source) + '</span>'
    : '';
  const missingSource = box.state === 'ready'
    ? ''
    : '<b>missing insight source</b><span>' + esc(box.missingSource || box.insightSource || box.source || 'missing') + '</span>';
  const relatedTrace = '<b>related page trace</b><span>Story beat -> Inspect evidence sheet -> source row</span><b>search affordance</b><span>Use the evidence title and source label to find this row in the release packet</span>';
  $('sheetBody').innerHTML = '<div class="arc">evidence box · ' + esc(box.state) + '</div><h2>' + esc(box.title) + '</h2>' +
    '<div class="nar">' + esc(box.detail) + '</div><div class="kv"><b>source</b><span>' + esc(box.insightSource || box.source || 'missing') + '</span>' + rowSource + '<b>origin</b><span>' + esc(box.origin || 'unknown') + '</span><b>proof</b><span>' + esc(box.proof || box.detail) + '</span>' + relatedTrace + missingSource + '</div>' + evidence;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(box.state === 'ready' ? 'medium' : 'light');
}
function openSkillBox(env, index){
  const skill = skillCards(env)[index] || skillCards(env)[0];
  const agent = skill.agentSkill || null;
  const canPromote = canQueueSkillPromotion(skill);
  const consequence = canPromote ? skillPromotionConsequence(skill) : 'no production change from this sheet; skill registry remains the authority';
  const reversibility = canPromote ? skillPromotionReversibility() : 'no queued action is created; refresh the registry through quine write skills';
  const idempotencyKey = canPromote ? skillPromotionIdempotency(skill) : 'not queued';
  const founderApproval = canPromote
    ? 'required before production; operator consumer re-checks telemetry'
    : (skill.promotion && skill.promotion.requiredApproval ? 'blocked until telemetry is production-ready; founder approval is still required before production' : 'not required for this read-only state');
  const gap = skill.state === 'wait'
    ? '<div class="nar">gap action · ' + esc(skill.gapAction || ('.operator/' + TENANT + '.skills.json · quine write skills forge --tenant ' + TENANT)) + '</div>'
    : '';
  const caution = skill.tier === 'declining'
    ? '<div class="nar">caution · declining skills cannot be promoted from the mini app; record new successful uses before founder review.</div>'
    : '';
  const readOnly = !canPromote
    ? '<div class="nar">read-only · skill registry remains the authority; no founder review is queued from this state.</div>'
    : '';
  const action = canPromote
    ? '<div class="gbtns promote"><button type="button" class="approve" data-promote-skill="1">Queue founder review</button></div>'
    : '';
  const loadout = agent ? renderAgentSkillLoadout(agent) : '';
  $('sheetBody').innerHTML = '<div class="arc">skill labor · ' + esc(skill.state) + '</div><h2>' + esc(skill.title) + '</h2>' +
    '<div class="nar">' + esc(skill.detail) + '</div><div class="kv"><b>status</b><span>' + esc(skill.status || 'unknown') + '</span><b>tier</b><span>' + esc(skill.tierLabel || skill.tier || 'missing') + '</span><b>uses</b><span>' + esc(skill.uses ?? 0) + '</span><b>success rate</b><span>' + esc(skill.successRateText || '0%') + '</span><b>recent rate</b><span>' + esc(skill.recentRateText || '0%') + '</span><b>sample minimum</b><span>' + esc(skill.sampleMinimum || '0/3 uses') + '</span><b>promotion status</b><span>' + esc(skill.promotionStatus || 'blocked') + '</span><b>source path</b><span>' + esc(skill.sourcePath || ('.operator/' + TENANT + '.skills.json')) + '</span><b>registry proof</b><span>' + esc(skill.registryProof || skill.sourcePath || ('.operator/' + TENANT + '.skills.json')) + '</span></div>' + loadout + '<div class="kv"><b>consequence</b><span>' + esc(consequence) + '</span><b>reversibility</b><span>' + esc(reversibility) + '</span><b>idempotency key</b><span>' + esc(idempotencyKey) + '</span><b>founder approval</b><span>' + esc(founderApproval) + '</span></div>' + gap + caution + readOnly + action;
  const promote = $('sheetBody').querySelector('[data-promote-skill]');
  if (promote) promote.onclick = () => skillPromotionAct(skill, promote);
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(skill.state === 'ready' ? 'medium' : 'light');
}
function renderAgentSkillLoadout(agent){
  const roles = agentSkillRoles(agent);
  const actionGroups = Array.isArray(agent.actionGroups) && agent.actionGroups.length
    ? '<div class="kv">' + agent.actionGroups.slice(0, 6).map(group => '<b>' + esc(group.label || group.id) + '</b><span>' + esc((group.state || 'future') + ' · ' + (Array.isArray(group.actionIds) ? group.actionIds.join(', ') : '') + (group.purpose ? ' · ' + group.purpose : '')) + '</span>').join('') + '</div>'
    : '';
  const roleRows = roles.length
    ? '<div class="kv">' + roles.slice(0, 8).map(role => '<b>' + esc(role.roleId) + '</b><span>v' + esc(role.version || 'unknown') + ' · ' + esc(role.permissions || 'no permissions') + ' · ' + esc(role.commands || 'no commands') + (role.purpose ? ' · ' + esc(role.purpose) : '') + '</span>').join('') + '</div>'
    : '<div class="nar">no role subsets served for this agent skill.</div>';
  const boundaries = Array.isArray(agent.boundaries) && agent.boundaries.length
    ? '<div class="kv">' + agent.boundaries.slice(0, 5).map((boundary, i) => '<b>boundary ' + (i + 1) + '</b><span>' + esc(boundary) + '</span>').join('') + '</div>'
    : '';
  return '<div class="kv"><b>domain</b><span>' + esc(agent.domain || 'unknown') + '</span><b>game layer</b><span>' + esc(agent.gameLayer || 'unknown') + '</span><b>loadout version</b><span>' + esc(agent.version || 'unknown') + '</span><b>skill id</b><span>' + esc(agent.skillId || 'unknown') + '</span><b>mini app area</b><span>' + esc(agent.miniAppArea || 'skills') + '</span><b>registry target</b><span>' + esc(agent.registryTarget || '.operator/<tenant>.skills.json') + '</span><b>invocations</b><span>' + esc(Array.isArray(agent.invocationKinds) ? agent.invocationKinds.join(', ') : 'none') + '</span><b>branches</b><span>' + esc(Array.isArray(agent.branches) ? agent.branches.join(', ') : 'none') + '</span><b>read commands</b><span>' + esc(Array.isArray(agent.readCommands) ? agent.readCommands.join(', ') : 'none') + '</span><b>write commands</b><span>' + esc(Array.isArray(agent.writeCommands) ? agent.writeCommands.join(', ') : 'none') + '</span></div>' + actionGroups + roleRows + boundaries;
}
function openNpcBox(env, index){
  const npc = npcCards(env)[index] || npcCards(env)[0];
  const stage = npc.stage || { id:'missing', label:'MISSING', detail:'relationship stage not served', confidence:0 };
  const advice = npc.advice || { status:'blocked', label:'NO ADVICE', detail:'no durable NPC advice event served', proof:'no durable NPC events served', action:{ kind:'collect-evidence', label:'Record NPC evidence', target:'quine write quests npc-event' } };
  const history = npc.history || { source:'missing', total:0, contradictions:0, rows:[] };
  const confidence = Math.round(Number(stage.confidence || 0) * 100);
  const adviceAction = advice.action || { kind:'collect-evidence', label:'Record NPC evidence', target:'quine write quests npc-event' };
  const events = Array.isArray(npc.events) && npc.events.length
    ? '<div class="kv">' + npc.events.slice(0, 4).map((event, i) => '<b>event ' + (i + 1) + '</b><span>' + esc((event.id || 'event') + ' · ' + (event.kind || 'unknown') + ' · ' + (event.source || 'missing') + ' · ' + (event.detail || 'detail missing')) + '</span>').join('') + '</div>'
    : '<div class="nar">no relationship events served; the companion remains an explicit evidence gap.</div>';
  const contradictionBlock = Number(history.contradictions || 0) > 0
    ? '<div class="nar">advice is blocked by contradiction; review target ' + esc(adviceAction.target || 'npc') + '</div>'
    : '';
  const adviceBlock = '<div class="kv"><b>advice</b><span>' + esc((advice.label || 'NO ADVICE') + ' · ' + (advice.detail || 'no durable NPC advice event served')) + '</span><b>advice proof</b><span>' + esc(advice.proof || 'advice proof missing') + '</span><b>advice action</b><span>' + esc((adviceAction.kind || 'review') + ' · ' + (adviceAction.label || 'Review') + ' · ' + (adviceAction.target || 'npc')) + '</span><b>review target</b><span>' + esc(adviceAction.target || 'npc') + '</span></div>';
  const historyRows = Array.isArray(history.rows) && history.rows.length
    ? '<div class="kv">' + history.rows.slice(0, 4).map((row, i) => '<b>history ' + (i + 1) + '</b><span>' + esc((row.id || 'event') + ' · ' + (row.kind || 'note') + ' · ' + (row.source || history.source || 'missing') + ' · ' + (row.detail || row.evidence || 'detail missing')) + '</span>').join('') + '</div>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">companion · ' + esc(npc.state) + '</div><h2>' + esc(npc.title) + '</h2>' +
    '<div class="nar">' + esc(npc.detail) + '</div><div class="kv"><b>stage</b><span>' + esc((stage.label || 'MISSING') + ' · ' + (stage.detail || 'relationship stage not served') + ' · ' + confidence + '% confidence') + '</span><b>ecosystem targets</b><span>' + esc((npc.ecosystemTargets || ['operator-npc-events']).join(' · ')) + '</span><b>scope</b><span>' + esc(npc.scope || 'missing') + '</span><b>proof</b><span>' + esc(npc.proof || npc.detail) + '</span><b>event count</b><span>' + esc(Number(history.total || 0)) + '</span><b>contradiction count</b><span>' + esc(Number(history.contradictions || 0)) + '</span><b>history</b><span>' + esc((history.source || 'missing') + ' · ' + Number(history.total || 0) + ' event(s) · ' + Number(history.contradictions || 0) + ' contradiction(s)') + '</span></div>' + adviceBlock + contradictionBlock + events + historyRows;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(npc.state === 'ready' ? 'medium' : 'light');
}

`;
