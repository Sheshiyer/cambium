import type { MissionFabricProjectionV1 } from "../../mission-fabric.ts";

const SECRET_RE = /(query_id=|auth_date=|\bhash=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|token=|PRIVATE KEY|\bprompt\s*[:=]|prompt injection)/i;
const ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const MAX_AGENTS = 48;
const MAX_LIST = 24;

function cmp(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function sortIds(ids: string[]): string[] { return [...ids].sort(cmp); }
function uniqSorted(ids: string[]): string[] { return sortIds([...new Set(ids)]); }

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeText(v: unknown): string {
  if (typeof v !== "string") return "unknown";
  const t = v.trim();
  if (!t) return "unknown";
  if (SECRET_RE.test(t)) return "unknown";
  const bounded = t.slice(0, 160);
  return escapeHtml(bounded);
}

function validStatus(s: unknown): string {
  const valid = ["offline", "available", "assigned", "running", "blocked"];
  return typeof s === "string" && valid.includes(s) ? s : "unknown";
}

function validRuntime(r: unknown): string {
  const valid = ["codex", "hermes", "paperclip", "human", "other"];
  return typeof r === "string" && valid.includes(r) ? r : "unknown";
}

function validLastSeen(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (v.length > 160) return null;
  const t = v.trim();
  if (SECRET_RE.test(t)) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(t)) return null;
  const p = Date.parse(t);
  if (!Number.isFinite(p)) return null;
  return t;
}

function isHostileId(raw: string): boolean {
  return raw.includes("-redacted-");
}

export function renderWorkforce(projection: MissionFabricProjectionV1): string {
  const nodes: any[] = Array.isArray((projection as any)?.nodes) ? (projection as any).nodes : [];
  const edges: any[] = Array.isArray((projection as any)?.edges) ? (projection as any).edges : [];
  const gaps: any[] = Array.isArray((projection as any)?.gaps) ? (projection as any).gaps : [];

  if (nodes.length > 512 || edges.length > 1024 || gaps.length > 128) {
    return `<div data-component="FabricWorkforce"><p class="note">Proposal flow deferred to Task 11</p><p class="projection-state">unknown</p></div>`;
  }

  function idOf(kind: string, value: any): string | null {
    if (!value) return null;
    switch (kind) {
      case "agent": return typeof value.agentId === "string" ? value.agentId : null;
      case "task": return typeof value.taskId === "string" ? value.taskId : null;
      case "run": return typeof value.runId === "string" ? value.runId : null;
      case "skill-cluster": return typeof value.clusterId === "string" ? value.clusterId : null;
      default: return null;
    }
  }

  function agentCompare(v: any): string {
    const role = safeText(v.role);
    const runtime = validRuntime(v.runtime);
    const status = validStatus(v.status);
    const active = Array.isArray(v.activeTaskIds) ? uniqSorted(v.activeTaskIds.filter((x: any) => typeof x === "string")) : [];
    const perm = safeText(v.permissionProfile);
    const lastSeen = validLastSeen(v.lastSeenAt) ?? "";
    return JSON.stringify([role, runtime, status, active, perm, lastSeen]);
  }
  function taskCompare(_v: any): string { return ""; }
  function runCompare(_v: any): string { return ""; }
  function clusterCompare(v: any): string {
    const skills = Array.isArray(v.skillIds) ? uniqSorted(v.skillIds.filter((x: any) => typeof x === "string")) : [];
    const elig = Array.isArray(v.eligibleAgentIds) ? uniqSorted(v.eligibleAgentIds.filter((x: any) => typeof x === "string")) : [];
    return JSON.stringify([skills, elig]);
  }

  const groups = new Map<string, { kind: string; id: string; best: string; value: any }>();
  const kindsHandled = ["agent", "task", "run", "skill-cluster"];

  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const kind = node.kind;
    if (!kindsHandled.includes(kind)) continue;
    const value = node.value;
    const id = idOf(kind, value);
    if (id === null) continue;
    const key = kind + "\u0000" + id;
    let compare: string;
    if (kind === "agent") compare = agentCompare(value);
    else if (kind === "task") compare = taskCompare(value);
    else if (kind === "run") compare = runCompare(value);
    else compare = clusterCompare(value);
    const existing = groups.get(key);
    if (!existing || cmp(compare, existing.best) < 0) {
      groups.set(key, { kind, id, best: compare, value });
    }
  }

  const byKindId = new Map<string, any>();
  for (const g of groups.values()) byKindId.set(g.kind + "\u0000" + g.id, g.value);

  function resolves(kind: string, id: string): boolean { return byKindId.has(kind + "\u0000" + id); }

  // public identity ordinals per kind
  const rawIdsByKind: Record<string, string[]> = { agent: [], task: [], run: [], "skill-cluster": [] };
  for (const g of groups.values()) rawIdsByKind[g.kind].push(g.id);
  for (const k of Object.keys(rawIdsByKind)) rawIdsByKind[k] = sortIds(rawIdsByKind[k]);

  function publicId(kind: string, id: string): string {
    if (ID_RE.test(id) && !isHostileId(id) && !SECRET_RE.test(id)) return id;
    const ord = rawIdsByKind[kind].indexOf(id);
    return `${kind}-redacted-${ord}`;
  }

  // edges
  const agentToTasks = new Map<string, Set<string>>();
  const runToAgents = new Map<string, string[]>();
  const taskToClusters = new Map<string, Set<string>>();

  for (const e of edges) {
    if (!e || typeof e !== "object") continue;
    const { kind, fromId, toId } = e;
    if (typeof fromId !== "string" || typeof toId !== "string") continue;
    if (kind === "assigned-to") {
      if (resolves("task", fromId) && resolves("agent", toId)) {
        if (!agentToTasks.has(toId)) agentToTasks.set(toId, new Set());
        agentToTasks.get(toId)!.add(fromId);
      }
    } else if (kind === "executes") {
      if (resolves("agent", fromId) && resolves("run", toId)) {
        if (!runToAgents.has(toId)) runToAgents.set(toId, []);
        runToAgents.get(toId)!.push(fromId);
      }
    } else if (kind === "requires-cluster") {
      if (resolves("task", fromId) && resolves("skill-cluster", toId)) {
        if (!taskToClusters.has(fromId)) taskToClusters.set(fromId, new Set());
        taskToClusters.get(fromId)!.add(toId);
      }
    }
  }

  const runChosenAgent = new Map<string, string>();
  for (const [runId, agentIds] of runToAgents) {
    const sorted = sortIds(agentIds);
    runChosenAgent.set(runId, sorted[0]);
  }

  // gaps dedup
  type GapRec = { gapId: string; kind: string; subjectId: string; detail: string };
  const gapKeySet = new Set<string>();
  const validGaps: GapRec[] = [];
  for (const g of gaps) {
    if (!g || typeof g !== "object") continue;
    const gapId = safeText(g.gapId);
    const kind = safeText(g.kind);
    const subjectId = typeof g.subjectId === "string" ? g.subjectId : "unknown";
    const detail = safeText(g.detail);
    const key = JSON.stringify([gapId, kind, subjectId, detail]);
    if (gapKeySet.has(key)) continue;
    gapKeySet.add(key);
    validGaps.push({ gapId, kind, subjectId, detail });
  }
  validGaps.sort((a, b) => cmp(JSON.stringify(a), JSON.stringify(b)));

  const allCanonicalAgentIds = uniqSorted(rawIdsByKind.agent);
  const allAgentIds = allCanonicalAgentIds.slice(0, MAX_AGENTS);

  const attachedGapKeys = new Set<string>();
  const cards: string[] = [];

  for (const agentId of allAgentIds) {
    const value = byKindId.get("agent\u0000" + agentId);
    const role = safeText(value.role);
    const runtime = validRuntime(value.runtime);
    const status = validStatus(value.status);
    const perm = safeText(value.permissionProfile);
    const lastSeenRaw = validLastSeen(value.lastSeenAt);
    const lastSeenText = lastSeenRaw ? safeText(lastSeenRaw) : "unknown";
    const freshness = lastSeenRaw ? "observed" : "unknown";

    const declared = Array.isArray(value.activeTaskIds) ? value.activeTaskIds.filter((t: any) => typeof t === "string" && resolves("task", t)) : [];
    const edgeTasks = agentToTasks.has(agentId) ? [...agentToTasks.get(agentId)!] : [];
    const declaredSet = new Set(declared);
    const edgeSet = new Set(edgeTasks);
    const currentTasks = uniqSorted([...declaredSet, ...edgeSet]);

    let contradiction = false;
    if (declaredSet.size !== edgeSet.size) contradiction = true;
    else for (const t of declaredSet) if (!edgeSet.has(t)) { contradiction = true; break; }

    const runIds: string[] = [];
    for (const [runId, chosen] of runChosenAgent) if (chosen === agentId) runIds.push(runId);
    const sortedRunIds = sortIds(runIds);

    // capability clusters
    const capClusters: string[] = [];
    for (const cid of rawIdsByKind["skill-cluster"]) {
      const cv = byKindId.get("skill-cluster\u0000" + cid);
      const elig = Array.isArray(cv.eligibleAgentIds) ? cv.eligibleAgentIds : [];
      if (elig.includes(agentId)) capClusters.push(cid);
    }
    const capSet = new Set(capClusters);

    // demand clusters: from current tasks' requires-cluster edges
    const demandSet = new Set<string>();
    for (const t of currentTasks) {
      if (taskToClusters.has(t)) for (const c of taskToClusters.get(t)!) demandSet.add(c);
    }
    const demandIds = sortIds([...demandSet]);
    const covered = [...demandSet].filter((c) => capSet.has(c)).length;
    const required = demandSet.size;
    const load = currentTasks.length;

    const skillLabels: string[] = [];
    for (const cid of capClusters) {
      const cv = byKindId.get("skill-cluster\u0000" + cid);
      if (Array.isArray(cv.skillIds)) for (const s of cv.skillIds) if (typeof s === "string") skillLabels.push(s);
    }
    const allSkillLabels = uniqSorted(skillLabels);
    const skillLabelsSorted = allSkillLabels.slice(0, MAX_LIST);

    // attach gaps
    const scopeIds = new Set<string>([agentId, ...currentTasks, ...sortedRunIds, ...capClusters, ...demandIds]);
    const attached: GapRec[] = [];
    for (const g of validGaps) {
      if (scopeIds.has(g.subjectId)) {
        attached.push(g);
        attachedGapKeys.add(JSON.stringify([g.gapId, g.kind, g.subjectId, g.detail]));
      }
    }
    attached.sort((a, b) => cmp(JSON.stringify(a), JSON.stringify(b)));
    const attachedBounded = attached.slice(0, MAX_LIST);

    const taskLabels = currentTasks.slice(0, MAX_LIST).map((t) => publicId("task", t));
    const runLabels = sortedRunIds.slice(0, MAX_LIST).map((r) => publicId("run", r));
    const taskText = taskLabels.length
      ? taskLabels.map(escapeHtml).join(", ") + (currentTasks.length > taskLabels.length ? `, +${currentTasks.length - taskLabels.length} more` : "")
      : "unknown";
    const runText = runLabels.length
      ? runLabels.map(escapeHtml).join(", ") + (sortedRunIds.length > runLabels.length ? `, +${sortedRunIds.length - runLabels.length} more` : "")
      : "unknown";
    const skillText = skillLabelsSorted.length
      ? skillLabelsSorted.map(escapeHtml).join(", ") + (allSkillLabels.length > skillLabelsSorted.length ? `, +${allSkillLabels.length - skillLabelsSorted.length} more` : "")
      : "unknown";

    const gapHtml = attachedBounded.length
      ? `<ul class="gaps">${attachedBounded.map((g) => `<li>${g.kind}: ${g.detail}</li>`).join("")}${attached.length > attachedBounded.length ? `<li>+${attached.length - attachedBounded.length} more gaps</li>` : ""}</ul>`
      : `<p class="gaps">unknown</p>`;

    const contradictionHtml = contradiction
      ? `<p class="assignment-contradiction">assignment-contradiction</p>`
      : "";

    cards.push(`<div class="agent-card" data-agent-id="${escapeHtml(publicId("agent", agentId))}">
<h3>${escapeHtml(publicId("agent", agentId))}</h3>
<p class="role">Role: ${role}</p>
<p class="runtime">Runtime: ${runtime}</p>
<p class="status">Status: ${status}</p>
<p class="permission">Permission profile: ${perm}</p>
<p class="lastseen">Last seen: ${lastSeenText}</p>
<p class="freshness">Source freshness: ${freshness}</p>
<p class="load">Load: ${load}</p>
<p class="coverage">Coverage: ${required === 0 ? "unknown" : `${covered}/${required}`}</p>
<p class="tasks">Tasks: ${taskText}</p>
<p class="runs">Runs: ${runText}</p>
<p class="skills">Skills: ${skillText}</p>
${contradictionHtml}
${gapHtml}
</div>`);
  }

  const allUnscoped = validGaps.filter((g) => !attachedGapKeys.has(JSON.stringify([g.gapId, g.kind, g.subjectId, g.detail])));
  const unscoped = allUnscoped.slice(0, MAX_LIST);
  const unscopedHtml = unscoped.length
    ? `<ul class="unscoped-gaps">${unscoped.map((g) => `<li>${g.kind}: ${g.detail}</li>`).join("")}${allUnscoped.length > unscoped.length ? `<li>+${allUnscoped.length - unscoped.length} more gaps</li>` : ""}</ul>`
    : `<p class="unscoped-gaps">unknown</p>`;
  const agentOverflowHtml = allCanonicalAgentIds.length > allAgentIds.length
    ? `<p class="agent-overflow">showing ${allAgentIds.length} of ${allCanonicalAgentIds.length} agents</p>`
    : "";

  return `<div data-component="FabricWorkforce">
<p class="note">Proposal flow deferred to Task 11</p>
<section class="agents">${cards.join("")}</section>
${agentOverflowHtml}
<section class="unscoped">${unscopedHtml}</section>
</div>`;
}

export const WORKFORCE_BROWSER_JS = String.raw`
function ofRenderWorkforce(projection) {
  const ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;
  const MAX_AGENTS = 48;
  const MAX_LIST = 24;

  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function sortIds(ids) { return ids.slice().sort(cmp); }
  function uniqSorted(ids) {
    const seen = Object.create(null);
    const out = [];
    for (const id of ids) {
      if (!Object.prototype.hasOwnProperty.call(seen, id)) {
        seen[id] = true;
        out.push(id);
      }
    }
    return sortIds(out);
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeText(v) {
    if (typeof v !== "string") return "unknown";
    const t = v.trim();
    if (!t) return "unknown";
    if (OF_SECRET_MARKER.test(t)) return "unknown";
    const bounded = t.slice(0, 160);
    return escapeHtml(bounded);
  }

  function validStatus(s) {
    const valid = ["offline", "available", "assigned", "running", "blocked"];
    return typeof s === "string" && valid.indexOf(s) !== -1 ? s : "unknown";
  }

  function validRuntime(r) {
    const valid = ["codex", "hermes", "paperclip", "human", "other"];
    return typeof r === "string" && valid.indexOf(r) !== -1 ? r : "unknown";
  }

  function validLastSeen(v) {
    if (typeof v !== "string") return null;
    if (v.length > 160) return null;
    const t = v.trim();
    if (OF_SECRET_MARKER.test(t)) return null;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(t)) return null;
    const p = Date.parse(t);
    if (!Number.isFinite(p)) return null;
    return t;
  }

  function isHostileId(raw) {
    return raw.indexOf("-redacted-") !== -1;
  }

  const nodes = Array.isArray(projection && projection.nodes) ? projection.nodes : [];
  const edges = Array.isArray(projection && projection.edges) ? projection.edges : [];
  const gapsIn = Array.isArray(projection && projection.gaps) ? projection.gaps : [];

  if (nodes.length > 512 || edges.length > 1024 || gapsIn.length > 128) {
    return '<div data-component="FabricWorkforce"><p class="note">Proposal flow deferred to Task 11</p><p class="projection-state">unknown</p></div>';
  }

  function idOf(kind, value) {
    if (!value) return null;
    switch (kind) {
      case "agent": return typeof value.agentId === "string" ? value.agentId : null;
      case "task": return typeof value.taskId === "string" ? value.taskId : null;
      case "run": return typeof value.runId === "string" ? value.runId : null;
      case "skill-cluster": return typeof value.clusterId === "string" ? value.clusterId : null;
      default: return null;
    }
  }

  function agentCompare(v) {
    const role = safeText(v.role);
    const runtime = validRuntime(v.runtime);
    const status = validStatus(v.status);
    const active = Array.isArray(v.activeTaskIds) ? uniqSorted(v.activeTaskIds.filter((x) => typeof x === "string")) : [];
    const perm = safeText(v.permissionProfile);
    const lastSeen = validLastSeen(v.lastSeenAt) || "";
    return JSON.stringify([role, runtime, status, active, perm, lastSeen]);
  }
  function taskCompare(_v) { return ""; }
  function runCompare(_v) { return ""; }
  function clusterCompare(v) {
    const skills = Array.isArray(v.skillIds) ? uniqSorted(v.skillIds.filter((x) => typeof x === "string")) : [];
    const elig = Array.isArray(v.eligibleAgentIds) ? uniqSorted(v.eligibleAgentIds.filter((x) => typeof x === "string")) : [];
    return JSON.stringify([skills, elig]);
  }

  const groups = Object.create(null);
  const kindsHandled = ["agent", "task", "run", "skill-cluster"];

  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const kind = node.kind;
    if (kindsHandled.indexOf(kind) === -1) continue;
    const value = node.value;
    const id = idOf(kind, value);
    if (id === null) continue;
    const key = kind + ":" + id;
    let compare;
    if (kind === "agent") compare = agentCompare(value);
    else if (kind === "task") compare = taskCompare(value);
    else if (kind === "run") compare = runCompare(value);
    else compare = clusterCompare(value);
    const existing = Object.prototype.hasOwnProperty.call(groups, key) ? groups[key] : null;
    if (!existing || cmp(compare, existing.best) < 0) {
      groups[key] = { kind, id, best: compare, value };
    }
  }

  const byKindId = Object.create(null);
  for (const key of Object.keys(groups)) {
    const g = groups[key];
    byKindId[g.kind + ":" + g.id] = g.value;
  }

  function resolves(kind, id) { return Object.prototype.hasOwnProperty.call(byKindId, kind + ":" + id); }

  const rawIdsByKind = { agent: [], task: [], run: [], "skill-cluster": [] };
  for (const key of Object.keys(groups)) {
    const g = groups[key];
    rawIdsByKind[g.kind].push(g.id);
  }
  for (const k of Object.keys(rawIdsByKind)) rawIdsByKind[k] = sortIds(rawIdsByKind[k]);

  function publicId(kind, id) {
    if (ID_RE.test(id) && !isHostileId(id) && !OF_SECRET_MARKER.test(id)) return id;
    const ord = rawIdsByKind[kind].indexOf(id);
    return kind + "-redacted-" + ord;
  }

  const agentToTasks = Object.create(null);
  const runToAgents = Object.create(null);
  const taskToClusters = Object.create(null);

  function addToSetMap(map, key, val) {
    if (!Object.prototype.hasOwnProperty.call(map, key)) map[key] = [];
    if (map[key].indexOf(val) === -1) map[key].push(val);
  }

  for (const e of edges) {
    if (!e || typeof e !== "object") continue;
    const kind = e.kind, fromId = e.fromId, toId = e.toId;
    if (typeof fromId !== "string" || typeof toId !== "string") continue;
    if (kind === "assigned-to") {
      if (resolves("task", fromId) && resolves("agent", toId)) {
        addToSetMap(agentToTasks, toId, fromId);
      }
    } else if (kind === "executes") {
      if (resolves("agent", fromId) && resolves("run", toId)) {
        if (!Object.prototype.hasOwnProperty.call(runToAgents, toId)) runToAgents[toId] = [];
        runToAgents[toId].push(fromId);
      }
    } else if (kind === "requires-cluster") {
      if (resolves("task", fromId) && resolves("skill-cluster", toId)) {
        addToSetMap(taskToClusters, fromId, toId);
      }
    }
  }

  const runChosenAgent = Object.create(null);
  for (const runId of Object.keys(runToAgents)) {
    const sorted = sortIds(runToAgents[runId]);
    runChosenAgent[runId] = sorted[0];
  }

  const gapKeySet = Object.create(null);
  const validGaps = [];
  for (const g of gapsIn) {
    if (!g || typeof g !== "object") continue;
    const gapId = safeText(g.gapId);
    const kind = safeText(g.kind);
    const subjectId = typeof g.subjectId === "string" ? g.subjectId : "unknown";
    const detail = safeText(g.detail);
    const key = JSON.stringify([gapId, kind, subjectId, detail]);
    if (Object.prototype.hasOwnProperty.call(gapKeySet, key)) continue;
    gapKeySet[key] = true;
    validGaps.push({ gapId, kind, subjectId, detail });
  }
  validGaps.sort((a, b) => cmp(JSON.stringify(a), JSON.stringify(b)));

  const allCanonicalAgentIds = uniqSorted(rawIdsByKind.agent);
  const allAgentIds = allCanonicalAgentIds.slice(0, MAX_AGENTS);

  const attachedGapKeys = Object.create(null);
  const cards = [];

  for (const agentId of allAgentIds) {
    const value = byKindId["agent:" + agentId];
    const role = safeText(value.role);
    const runtime = validRuntime(value.runtime);
    const status = validStatus(value.status);
    const perm = safeText(value.permissionProfile);
    const lastSeenRaw = validLastSeen(value.lastSeenAt);
    const lastSeenText = lastSeenRaw ? safeText(lastSeenRaw) : "unknown";
    const freshness = lastSeenRaw ? "observed" : "unknown";

    const declared = Array.isArray(value.activeTaskIds) ? value.activeTaskIds.filter((t) => typeof t === "string" && resolves("task", t)) : [];
    const edgeTasks = Object.prototype.hasOwnProperty.call(agentToTasks, agentId) ? agentToTasks[agentId].slice() : [];

    const declaredUniq = uniqSorted(declared);
    const edgeUniq = uniqSorted(edgeTasks);
    const currentTasks = uniqSorted(declaredUniq.concat(edgeUniq));

    let contradiction = false;
    if (declaredUniq.length !== edgeUniq.length) contradiction = true;
    else {
      for (const t of declaredUniq) {
        if (edgeUniq.indexOf(t) === -1) { contradiction = true; break; }
      }
    }

    const runIds = [];
    for (const runId of Object.keys(runChosenAgent)) {
      if (runChosenAgent[runId] === agentId) runIds.push(runId);
    }
    const sortedRunIds = sortIds(runIds);

    const capClusters = [];
    for (const cid of rawIdsByKind["skill-cluster"]) {
      const cv = byKindId["skill-cluster:" + cid];
      const elig = Array.isArray(cv.eligibleAgentIds) ? cv.eligibleAgentIds : [];
      if (elig.indexOf(agentId) !== -1) capClusters.push(cid);
    }

    const demandSet = Object.create(null);
    for (const t of currentTasks) {
      if (Object.prototype.hasOwnProperty.call(taskToClusters, t)) {
        for (const c of taskToClusters[t]) demandSet[c] = true;
      }
    }
    const demandIds = sortIds(Object.keys(demandSet));
    let covered = 0;
    for (const c of demandIds) {
      if (capClusters.indexOf(c) !== -1) covered++;
    }
    const required = demandIds.length;
    const load = currentTasks.length;

    const skillLabels = [];
    for (const cid of capClusters) {
      const cv = byKindId["skill-cluster:" + cid];
      if (Array.isArray(cv.skillIds)) {
        for (const s of cv.skillIds) if (typeof s === "string") skillLabels.push(s);
      }
    }
    const allSkillLabels = uniqSorted(skillLabels);
    const skillLabelsSorted = allSkillLabels.slice(0, MAX_LIST);

    const scopeIds = Object.create(null);
    scopeIds[agentId] = true;
    for (const t of currentTasks) scopeIds[t] = true;
    for (const r of sortedRunIds) scopeIds[r] = true;
    for (const c of capClusters) scopeIds[c] = true;
    for (const d of demandIds) scopeIds[d] = true;

    const attached = [];
    for (const g of validGaps) {
      if (Object.prototype.hasOwnProperty.call(scopeIds, g.subjectId)) {
        attached.push(g);
        attachedGapKeys[JSON.stringify([g.gapId, g.kind, g.subjectId, g.detail])] = true;
      }
    }
    attached.sort((a, b) => cmp(JSON.stringify(a), JSON.stringify(b)));
    const attachedBounded = attached.slice(0, MAX_LIST);

    const taskLabels = currentTasks.slice(0, MAX_LIST).map((t) => publicId("task", t));
    const runLabels = sortedRunIds.slice(0, MAX_LIST).map((r) => publicId("run", r));
    const taskText = taskLabels.length
      ? taskLabels.map(escapeHtml).join(", ") + (currentTasks.length > taskLabels.length ? ", +" + (currentTasks.length - taskLabels.length) + " more" : "")
      : "unknown";
    const runText = runLabels.length
      ? runLabels.map(escapeHtml).join(", ") + (sortedRunIds.length > runLabels.length ? ", +" + (sortedRunIds.length - runLabels.length) + " more" : "")
      : "unknown";
    const skillText = skillLabelsSorted.length
      ? skillLabelsSorted.map(escapeHtml).join(", ") + (allSkillLabels.length > skillLabelsSorted.length ? ", +" + (allSkillLabels.length - skillLabelsSorted.length) + " more" : "")
      : "unknown";

    const gapHtml = attachedBounded.length
      ? '<ul class="gaps">' + attachedBounded.map((g) => "<li>" + g.kind + ": " + g.detail + "</li>").join("") + (attached.length > attachedBounded.length ? "<li>+" + (attached.length - attachedBounded.length) + " more gaps</li>" : "") + "</ul>"
      : '<p class="gaps">unknown</p>';

    const contradictionHtml = contradiction
      ? '<p class="assignment-contradiction">assignment-contradiction</p>'
      : "";

    const coverageText = (required === 0) ? "unknown" : (covered + "/" + required);

    cards.push('<div class="agent-card" data-agent-id="' + escapeHtml(publicId("agent", agentId)) + '">\n' +
      '<h3>' + escapeHtml(publicId("agent", agentId)) + '</h3>\n' +
      '<p class="role">Role: ' + role + '</p>\n' +
      '<p class="runtime">Runtime: ' + runtime + '</p>\n' +
      '<p class="status">Status: ' + status + '</p>\n' +
      '<p class="permission">Permission profile: ' + perm + '</p>\n' +
      '<p class="lastseen">Last seen: ' + lastSeenText + '</p>\n' +
      '<p class="freshness">Source freshness: ' + freshness + '</p>\n' +
      '<p class="load">Load: ' + load + '</p>\n' +
      '<p class="coverage">Coverage: ' + coverageText + '</p>\n' +
      '<p class="tasks">Tasks: ' + taskText + '</p>\n' +
      '<p class="runs">Runs: ' + runText + '</p>\n' +
      '<p class="skills">Skills: ' + skillText + '</p>\n' +
      contradictionHtml + '\n' +
      gapHtml + '\n' +
      '</div>');
  }

  const allUnscoped = validGaps.filter((g) => !Object.prototype.hasOwnProperty.call(attachedGapKeys, JSON.stringify([g.gapId, g.kind, g.subjectId, g.detail])));
  const unscoped = allUnscoped.slice(0, MAX_LIST);
  const unscopedHtml = unscoped.length
    ? '<ul class="unscoped-gaps">' + unscoped.map((g) => "<li>" + g.kind + ": " + g.detail + "</li>").join("") + (allUnscoped.length > unscoped.length ? "<li>+" + (allUnscoped.length - unscoped.length) + " more gaps</li>" : "") + "</ul>"
    : '<p class="unscoped-gaps">unknown</p>';
  const agentOverflowHtml = allCanonicalAgentIds.length > allAgentIds.length
    ? '<p class="agent-overflow">showing ' + allAgentIds.length + ' of ' + allCanonicalAgentIds.length + ' agents</p>'
    : '';

  return '<div data-component="FabricWorkforce">\n' +
    '<p class="note">Proposal flow deferred to Task 11</p>\n' +
    '<section class="agents">' + cards.join("") + '</section>\n' +
    agentOverflowHtml + '\n' +
    '<section class="unscoped">' + unscopedHtml + '</section>\n' +
    '</div>';
}
`;
