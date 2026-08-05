import type { MissionFabricProjectionV1 } from '../../mission-fabric.ts';

const SECRET_RE = /(query_id=|auth_date=|\bhash=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|token=|PRIVATE KEY|\bprompt\s*[:=]|prompt injection)/i;
const BENIGN_ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeText(s: unknown): string {
  if (typeof s !== 'string') return 'unknown';
  const full = s.trim();
  if (full.length === 0) return 'unknown';
  if (SECRET_RE.test(full)) return 'unknown';
  const trimmed = full.slice(0, 160);
  return esc(trimmed);
}

function publicId(kind: string, raw: string, ordinal: number): string {
  if (typeof raw !== 'string' || raw.length === 0) return `${kind}-redacted-${ordinal}`;
  if (SECRET_RE.test(raw)) return `${kind}-redacted-${ordinal}`;
  if (raw.includes('-redacted-')) return `${kind}-redacted-${ordinal}`;
  if (!BENIGN_ID_RE.test(raw)) return `${kind}-redacted-${ordinal}`;
  return esc(raw);
}

function cuSort(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function uniqueSorted(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort(cuSort);
}

const FALLBACK = '<div data-component="FabricForge"><p class="note">Proposal flow deferred to Task 11</p><p class="projection-state">unknown</p></div>';

export function renderForge(projection: MissionFabricProjectionV1): string {
  const nodes: any[] = Array.isArray((projection as any)?.nodes) ? (projection as any).nodes : [];
  const edges: any[] = Array.isArray((projection as any)?.edges) ? (projection as any).edges : [];
  const gaps: any[] = Array.isArray((projection as any)?.gaps) ? (projection as any).gaps : [];

  if (nodes.length > 512 || edges.length > 1024 || gaps.length > 128) {
    return FALLBACK;
  }

  const agentMap = new Map<string, any>();
  const taskMap = new Map<string, any>();
  const clusterMap = new Map<string, any>();

  function normalizeClusterStatus(raw: unknown): string {
    return typeof raw === 'string' && ['inactive', 'available', 'active', 'degraded'].includes(raw) ? raw : 'unknown';
  }
  function evidenceStateFor(sourceRef: unknown): string {
    return typeof sourceRef === 'string'
      && sourceRef.length > 0
      && sourceRef.length <= 160
      && !SECRET_RE.test(sourceRef)
      ? 'recorded'
      : 'unknown';
  }
  function clusterKey(c: any): string {
    const name = safeText(c?.name);
    const status = normalizeClusterStatus(c?.status);
    const skills = uniqueSorted(
      Array.isArray(c?.skillIds)
        ? c.skillIds.filter((skill: unknown) => typeof skill === 'string').map((skill: string) => safeText(skill))
        : [],
    );
    const elig = uniqueSorted(
      Array.isArray(c?.eligibleAgentIds)
        ? c.eligibleAgentIds.filter((agentId: unknown) => typeof agentId === 'string' && agentMap.has(agentId))
        : [],
    );
    return JSON.stringify([name, status, skills, elig, evidenceStateFor(c?.sourceRef)]);
  }

  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue;
    if (n.kind === 'agent' && n.value && typeof n.value.agentId === 'string') {
      const id = n.value.agentId;
      if (!agentMap.has(id)) agentMap.set(id, n.value);
    } else if (n.kind === 'task' && n.value && typeof n.value.taskId === 'string') {
      const id = n.value.taskId;
      if (!taskMap.has(id)) taskMap.set(id, n.value);
    }
  }

  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue;
    if (n.kind === 'skill-cluster' && n.value && typeof n.value.clusterId === 'string') {
      const id = n.value.clusterId;
      const existing = clusterMap.get(id);
      const cand = n.value;
      if (!existing) clusterMap.set(id, cand);
      else {
        const winner = cuSort(clusterKey(cand), clusterKey(existing)) < 0 ? cand : existing;
        clusterMap.set(id, winner);
      }
    }
  }

  // demand edges: task requires-cluster -> cluster
  const demandByCluster = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!e || typeof e !== 'object') continue;
    if (e.kind !== 'requires-cluster') continue;
    const fromId = String(e.fromId ?? '');
    const toId = String(e.toId ?? '');
    if (!taskMap.has(fromId) || !clusterMap.has(toId)) continue;
    if (!demandByCluster.has(toId)) demandByCluster.set(toId, new Set());
    demandByCluster.get(toId)!.add(fromId);
  }

  // gap dedup
  type Gap = { gapId: string; kind: string; subjectId: string; detail: string };
  const seenGap = new Set<string>();
  const dedupedGaps: Gap[] = [];
  for (const g of gaps) {
    if (!g || typeof g !== 'object') continue;
    const gapId = typeof g.gapId === 'string' ? g.gapId.slice(0, 160) : '';
    const kind = safeText(g.kind);
    const subjectId = typeof g.subjectId === 'string' ? g.subjectId : '';
    const detail = safeText(g.detail);
    const key = JSON.stringify([gapId, kind, subjectId, detail]);
    if (seenGap.has(key)) continue;
    seenGap.add(key);
    dedupedGaps.push({ gapId, kind, subjectId, detail });
  }
  dedupedGaps.sort((a, b) => {
    const ka = JSON.stringify([a.gapId, a.kind, a.subjectId, a.detail]);
    const kb = JSON.stringify([b.gapId, b.kind, b.subjectId, b.detail]);
    return cuSort(ka, kb);
  });

  // clusters sorted by clusterId
  const allClusterIds = uniqueSorted(Array.from(clusterMap.keys()));
  const clusterIds = allClusterIds.slice(0, 48);

  const agentIdsSorted = uniqueSorted(Array.from(agentMap.keys()));
  const agentOrdinal = new Map<string, number>();
  agentIdsSorted.forEach((id, i) => agentOrdinal.set(id, i));

  const taskIdsSorted = uniqueSorted(Array.from(taskMap.keys()));
  const taskOrdinal = new Map<string, number>();
  taskIdsSorted.forEach((id, i) => taskOrdinal.set(id, i));

  const clusterOrdinal = new Map<string, number>();
  clusterIds.forEach((id, i) => clusterOrdinal.set(id, i));

  const usedGapKeys = new Set<Gap>();
  const cardsHtml: string[] = [];

  for (const clusterId of clusterIds) {
    const c = clusterMap.get(clusterId);
    const pubClusterId = publicId('skill-cluster', clusterId, clusterOrdinal.get(clusterId) ?? 0);
    const name = safeText(c?.name);
    const status = normalizeClusterStatus(c?.status);

    const eligible = Array.isArray(c?.eligibleAgentIds)
      ? uniqueSorted(c.eligibleAgentIds.filter((value: unknown): value is string => typeof value === 'string'))
      : [];
    const memberPubIds: string[] = [];
    for (const eid of eligible) {
      if (agentMap.has(eid)) {
        memberPubIds.push(publicId('agent', eid, agentOrdinal.get(eid) ?? 0));
      }
    }
    const memberList = memberPubIds.slice(0, 24);
    const memberText = memberList.length
      ? memberList.join(', ') + (memberPubIds.length > memberList.length ? `, +${memberPubIds.length - memberList.length} more` : '')
      : 'none';

    const skillIds = Array.isArray(c?.skillIds)
      ? uniqueSorted(c.skillIds.filter((value: unknown): value is string => typeof value === 'string'))
      : [];
    const skillList = skillIds.slice(0, 24).map(s => safeText(s));
    const skillText = skillList.length
      ? skillList.join(', ') + (skillIds.length > skillList.length ? `, +${skillIds.length - skillList.length} more` : '')
      : 'none';

    const demandSet = demandByCluster.get(clusterId) ?? new Set<string>();
    const demandTaskIds = uniqueSorted(Array.from(demandSet));
    const demandPubIds = demandTaskIds.map(tid => publicId('task', tid, taskOrdinal.get(tid) ?? 0)).slice(0, 24);
    const demandCount = demandTaskIds.length;
    const demandText = demandPubIds.length
      ? demandPubIds.join(', ') + (demandCount > demandPubIds.length ? `, +${demandCount - demandPubIds.length} more` : '')
      : 'none';

    const evidenceState = evidenceStateFor(c?.sourceRef);

    const attachedGaps: Gap[] = [];
    for (const g of dedupedGaps) {
      if (g.subjectId === clusterId || demandTaskIds.includes(g.subjectId)) {
        attachedGaps.push(g);
        usedGapKeys.add(g);
      }
    }
    const shownAttachedGaps = attachedGaps.slice(0, 24);
    const gapItems = shownAttachedGaps.map(g =>
      `<li class="gap"><span class="gap-kind">${g.kind}</span>: <span class="gap-detail">${g.detail}</span></li>`
    ).join('') + (attachedGaps.length > shownAttachedGaps.length ? `<li>+${attachedGaps.length - shownAttachedGaps.length} more gaps</li>` : '');

    cardsHtml.push(`
<div class="cluster-card" data-cluster-id="${pubClusterId}">
  <h3 class="cluster-name">${name}</h3>
  <p class="cluster-id">ID: ${pubClusterId}</p>
  <p class="cluster-status">Status: ${status}</p>
  <p class="cluster-members">Members: ${memberText}</p>
  <p class="cluster-skills">Skills: ${skillText}</p>
  <p class="cluster-demand">Demand tasks (${demandCount}): ${demandText}</p>
  <p class="cluster-evidence">Assignment evidence: ${evidenceState}</p>
  <ul class="cluster-gaps">${gapItems}</ul>
</div>`);
  }

  const allUnscopedGaps = dedupedGaps.filter(g => !usedGapKeys.has(g));
  const unscopedGaps = allUnscopedGaps.slice(0, 24);
  const unscopedHtml = unscopedGaps.map(g =>
    `<li class="gap unscoped"><span class="gap-kind">${g.kind}</span>: <span class="gap-detail">${g.detail}</span></li>`
  ).join('') + (allUnscopedGaps.length > unscopedGaps.length ? `<li>+${allUnscopedGaps.length - unscopedGaps.length} more gaps</li>` : '');
  const clusterOverflowHtml = allClusterIds.length > clusterIds.length
    ? `<p class="cluster-overflow">showing ${clusterIds.length} of ${allClusterIds.length} clusters</p>`
    : '';

  return `<div data-component="FabricForge">
<p class="note">Proposal flow deferred to Task 11</p>
<p class="boundary">Deferred and archived lifecycle are unavailable until canonically projected.</p>
<div class="cluster-cards">${cardsHtml.join('')}</div>
${clusterOverflowHtml}
<ul class="unscoped-gaps">${unscopedHtml}</ul>
</div>`;
}

export const FORGE_BROWSER_JS = String.raw`
function ofRenderForge(projection) {
  var BENIGN_ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeText(s) {
    if (typeof s !== 'string') return 'unknown';
    var full = s.trim();
    if (full.length === 0) return 'unknown';
    if (OF_SECRET_MARKER.test(full)) return 'unknown';
    var trimmed = full.slice(0, 160);
    return esc(trimmed);
  }

  function publicId(kind, raw, ordinal) {
    if (typeof raw !== 'string' || raw.length === 0) return kind + '-redacted-' + ordinal;
    if (OF_SECRET_MARKER.test(raw)) return kind + '-redacted-' + ordinal;
    if (raw.indexOf('-redacted-') !== -1) return kind + '-redacted-' + ordinal;
    if (!BENIGN_ID_RE.test(raw)) return kind + '-redacted-' + ordinal;
    return esc(raw);
  }

  function cuSort(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function uniqueSorted(arr) {
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (!Object.prototype.hasOwnProperty.call(seen, v)) {
        seen[v] = true;
        out.push(v);
      }
    }
    out.sort(cuSort);
    return out;
  }

  var FALLBACK = '<div data-component="FabricForge"><p class="note">Proposal flow deferred to Task 11</p><p class="projection-state">unknown</p></div>';

  var nodes = Array.isArray(projection && projection.nodes) ? projection.nodes : [];
  var edges = Array.isArray(projection && projection.edges) ? projection.edges : [];
  var gaps = Array.isArray(projection && projection.gaps) ? projection.gaps : [];

  if (nodes.length > 512 || edges.length > 1024 || gaps.length > 128) {
    return FALLBACK;
  }

  var agentMap = Object.create(null);
  var taskMap = Object.create(null);
  var clusterMap = Object.create(null);

  function normalizeClusterStatus(raw) {
    return typeof raw === 'string' && (raw === 'inactive' || raw === 'available' || raw === 'active' || raw === 'degraded') ? raw : 'unknown';
  }
  function evidenceStateFor(sourceRef) {
    return typeof sourceRef === 'string' && sourceRef.length > 0 && sourceRef.length <= 160 && !OF_SECRET_MARKER.test(sourceRef)
      ? 'recorded'
      : 'unknown';
  }
  function clusterKey(c) {
    var name = safeText(c && c.name);
    var status = normalizeClusterStatus(c && c.status);
    var skillsRaw = Array.isArray(c && c.skillIds) ? c.skillIds : [];
    var skills = [];
    for (var si = 0; si < skillsRaw.length; si++) {
      if (typeof skillsRaw[si] === 'string') skills.push(safeText(skillsRaw[si]));
    }
    skills = uniqueSorted(skills);
    var eligibleRaw = Array.isArray(c && c.eligibleAgentIds) ? c.eligibleAgentIds : [];
    var elig = [];
    for (var eli = 0; eli < eligibleRaw.length; eli++) {
      var eligibleId = eligibleRaw[eli];
      if (typeof eligibleId === 'string' && Object.prototype.hasOwnProperty.call(agentMap, eligibleId)) elig.push(eligibleId);
    }
    elig = uniqueSorted(elig);
    return JSON.stringify([name, status, skills, elig, evidenceStateFor(c && c.sourceRef)]);
  }

  for (var ni = 0; ni < nodes.length; ni++) {
    var n = nodes[ni];
    if (!n || typeof n !== 'object') continue;
    if (n.kind === 'agent' && n.value && typeof n.value.agentId === 'string') {
      var id1 = n.value.agentId;
      if (!Object.prototype.hasOwnProperty.call(agentMap, id1)) agentMap[id1] = n.value;
    } else if (n.kind === 'task' && n.value && typeof n.value.taskId === 'string') {
      var id2 = n.value.taskId;
      if (!Object.prototype.hasOwnProperty.call(taskMap, id2)) taskMap[id2] = n.value;
    }
  }

  for (var nci = 0; nci < nodes.length; nci++) {
    var nc = nodes[nci];
    if (!nc || typeof nc !== 'object') continue;
    if (nc.kind === 'skill-cluster' && nc.value && typeof nc.value.clusterId === 'string') {
      var id3 = nc.value.clusterId;
      var cand3 = nc.value;
      if (!Object.prototype.hasOwnProperty.call(clusterMap, id3)) clusterMap[id3] = cand3;
      else {
        var existing3 = clusterMap[id3];
        var winner3 = cuSort(clusterKey(cand3), clusterKey(existing3)) < 0 ? cand3 : existing3;
        clusterMap[id3] = winner3;
      }
    }
  }

  var demandByCluster = Object.create(null);
  for (var ei = 0; ei < edges.length; ei++) {
    var e = edges[ei];
    if (!e || typeof e !== 'object') continue;
    if (e.kind !== 'requires-cluster') continue;
    var fromId = String(e.fromId !== undefined ? e.fromId : '');
    var toId = String(e.toId !== undefined ? e.toId : '');
    if (!Object.prototype.hasOwnProperty.call(taskMap, fromId)) continue;
    if (!Object.prototype.hasOwnProperty.call(clusterMap, toId)) continue;
    if (!Object.prototype.hasOwnProperty.call(demandByCluster, toId)) demandByCluster[toId] = Object.create(null);
    demandByCluster[toId][fromId] = true;
  }

  var seenGap = Object.create(null);
  var dedupedGaps = [];
  for (var gi = 0; gi < gaps.length; gi++) {
    var g = gaps[gi];
    if (!g || typeof g !== 'object') continue;
    var gapId = typeof g.gapId === 'string' ? g.gapId.slice(0, 160) : '';
    var kind = safeText(g.kind);
    var subjectId = typeof g.subjectId === 'string' ? g.subjectId : '';
    var detail = safeText(g.detail);
    var key = JSON.stringify([gapId, kind, subjectId, detail]);
    if (Object.prototype.hasOwnProperty.call(seenGap, key)) continue;
    seenGap[key] = true;
    dedupedGaps.push({ gapId: gapId, kind: kind, subjectId: subjectId, detail: detail });
  }
  dedupedGaps.sort(function (a, b) {
    var ka = JSON.stringify([a.gapId, a.kind, a.subjectId, a.detail]);
    var kb = JSON.stringify([b.gapId, b.kind, b.subjectId, b.detail]);
    return cuSort(ka, kb);
  });

  var allClusterIds = uniqueSorted(Object.keys(clusterMap));
  var clusterIds = allClusterIds.slice(0, 48);

  var agentIdsSorted = uniqueSorted(Object.keys(agentMap));
  var agentOrdinal = Object.create(null);
  for (var ai = 0; ai < agentIdsSorted.length; ai++) agentOrdinal[agentIdsSorted[ai]] = ai;

  var taskIdsSorted = uniqueSorted(Object.keys(taskMap));
  var taskOrdinal = Object.create(null);
  for (var ti = 0; ti < taskIdsSorted.length; ti++) taskOrdinal[taskIdsSorted[ti]] = ti;

  var clusterOrdinal = Object.create(null);
  for (var ci = 0; ci < clusterIds.length; ci++) clusterOrdinal[clusterIds[ci]] = ci;

  var usedGapFlags = new Array(dedupedGaps.length);
  for (var uf = 0; uf < usedGapFlags.length; uf++) usedGapFlags[uf] = false;

  var cardsHtml = [];

  for (var cidx = 0; cidx < clusterIds.length; cidx++) {
    var clusterId = clusterIds[cidx];
    var c = clusterMap[clusterId];
    var pubClusterId = publicId('skill-cluster', clusterId, Object.prototype.hasOwnProperty.call(clusterOrdinal, clusterId) ? clusterOrdinal[clusterId] : 0);
    var name = safeText(c && c.name);
    var status = normalizeClusterStatus(c && c.status);

    var eligibleRawForCard = Array.isArray(c && c.eligibleAgentIds) ? c.eligibleAgentIds : [];
    var eligible = [];
    for (var erc = 0; erc < eligibleRawForCard.length; erc++) {
      if (typeof eligibleRawForCard[erc] === 'string') eligible.push(eligibleRawForCard[erc]);
    }
    eligible = uniqueSorted(eligible);
    var memberPubIds = [];
    for (var eidx = 0; eidx < eligible.length; eidx++) {
      var eid = eligible[eidx];
      if (Object.prototype.hasOwnProperty.call(agentMap, eid)) {
        memberPubIds.push(publicId('agent', eid, Object.prototype.hasOwnProperty.call(agentOrdinal, eid) ? agentOrdinal[eid] : 0));
      }
    }
    var memberList = memberPubIds.slice(0, 24);
    var memberText = memberList.length
      ? memberList.join(', ') + (memberPubIds.length > memberList.length ? ', +' + (memberPubIds.length - memberList.length) + ' more' : '')
      : 'none';

    var skillIdsRaw = Array.isArray(c && c.skillIds) ? c.skillIds : [];
    var skillIds = [];
    for (var sic = 0; sic < skillIdsRaw.length; sic++) {
      if (typeof skillIdsRaw[sic] === 'string') skillIds.push(skillIdsRaw[sic]);
    }
    skillIds = uniqueSorted(skillIds);
    var skillList = skillIds.slice(0, 24).map(function (s) { return safeText(s); });
    var skillText = skillList.length
      ? skillList.join(', ') + (skillIds.length > skillList.length ? ', +' + (skillIds.length - skillList.length) + ' more' : '')
      : 'none';

    var demandObj = Object.prototype.hasOwnProperty.call(demandByCluster, clusterId) ? demandByCluster[clusterId] : Object.create(null);
    var demandTaskIds = uniqueSorted(Object.keys(demandObj));
    var demandPubIds = demandTaskIds.map(function (tid) {
      return publicId('task', tid, Object.prototype.hasOwnProperty.call(taskOrdinal, tid) ? taskOrdinal[tid] : 0);
    }).slice(0, 24);
    var demandCount = demandTaskIds.length;
    var demandText = demandPubIds.length
      ? demandPubIds.join(', ') + (demandCount > demandPubIds.length ? ', +' + (demandCount - demandPubIds.length) + ' more' : '')
      : 'none';

    var evidenceState = evidenceStateFor(c && c.sourceRef);

    var attachedGaps = [];
    for (var gj = 0; gj < dedupedGaps.length; gj++) {
      var gObj = dedupedGaps[gj];
      if (gObj.subjectId === clusterId || demandTaskIds.indexOf(gObj.subjectId) !== -1) {
        attachedGaps.push(gObj);
        usedGapFlags[gj] = true;
      }
    }
    var shownAttachedGaps = attachedGaps.slice(0, 24);
    var gapItems = shownAttachedGaps.map(function (g) {
      return '<li class="gap"><span class="gap-kind">' + g.kind + '</span>: <span class="gap-detail">' + g.detail + '</span></li>';
    }).join('') + (attachedGaps.length > shownAttachedGaps.length ? '<li>+' + (attachedGaps.length - shownAttachedGaps.length) + ' more gaps</li>' : '');

    cardsHtml.push('\n<div class="cluster-card" data-cluster-id="' + pubClusterId + '">\n  <h3 class="cluster-name">' + name + '</h3>\n  <p class="cluster-id">ID: ' + pubClusterId + '</p>\n  <p class="cluster-status">Status: ' + status + '</p>\n  <p class="cluster-members">Members: ' + memberText + '</p>\n  <p class="cluster-skills">Skills: ' + skillText + '</p>\n  <p class="cluster-demand">Demand tasks (' + demandCount + '): ' + demandText + '</p>\n  <p class="cluster-evidence">Assignment evidence: ' + evidenceState + '</p>\n  <ul class="cluster-gaps">' + gapItems + '</ul>\n</div>');
  }

  var allUnscopedGaps = [];
  for (var gk = 0; gk < dedupedGaps.length; gk++) {
    if (!usedGapFlags[gk]) allUnscopedGaps.push(dedupedGaps[gk]);
  }
  var unscopedGaps = allUnscopedGaps.slice(0, 24);
  var unscopedHtml = unscopedGaps.map(function (g) {
    return '<li class="gap unscoped"><span class="gap-kind">' + g.kind + '</span>: <span class="gap-detail">' + g.detail + '</span></li>';
  }).join('') + (allUnscopedGaps.length > unscopedGaps.length ? '<li>+' + (allUnscopedGaps.length - unscopedGaps.length) + ' more gaps</li>' : '');
  var clusterOverflowHtml = allClusterIds.length > clusterIds.length
    ? '<p class="cluster-overflow">showing ' + clusterIds.length + ' of ' + allClusterIds.length + ' clusters</p>'
    : '';

  return '<div data-component="FabricForge">\n<p class="note">Proposal flow deferred to Task 11</p>\n<p class="boundary">Deferred and archived lifecycle are unavailable until canonically projected.</p>\n<div class="cluster-cards">' + cardsHtml.join('') + '</div>\n' + clusterOverflowHtml + '\n<ul class="unscoped-gaps">' + unscopedHtml + '</ul>\n</div>';
}
`;
