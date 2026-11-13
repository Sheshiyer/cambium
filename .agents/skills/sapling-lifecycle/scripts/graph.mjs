import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export const STATES = new Set(['shipped', 'draft', 'held', 'gap']);
export const digest = (body) => createHash('sha256').update(body).digest('hex');

export function inRoot(path, root) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

/** Validate an imported graph as evidence, never as operational authority. */
export function validateGraph(graph, options = {}) {
  const errors = [];
  const findings = [];
  const roots = [];
  if (options.record !== undefined && options.record !== false) errors.push('record must be false on the read route');
  if (options.approved !== undefined && options.approved !== false) errors.push('approved must be false on the read route');
  for (const key of ['appRoot', 'siteRoot']) {
    const path = options[key];
    if (!path || !existsSync(path) || !statSync(path).isDirectory()) errors.push(`missing ${key}`);
    else roots.push(realpathSync(path));
  }
  for (const path of options.additionalRoots || []) {
    if (!existsSync(path) || !statSync(path).isDirectory()) errors.push('missing additional evidence root');
    else roots.push(realpathSync(path));
  }
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) return { ok: false, errors: [...errors, 'graph must be an object'], findings, nodes: [], edges: [], confirmed: false };
  if (graph.confirmed !== true) errors.push('fence did not accept this graph');
  if (graph.publishes === true || graph.record === true) errors.push('graph requests publishing or recording');
  const rows = Array.isArray(graph.nodes) ? graph.nodes : graph.packet;
  if (!Array.isArray(rows) || rows.length === 0) errors.push('graph has no nodes');
  const traceProvided = Object.hasOwn(graph, 'traced_nodes');
  const trace = new Map();
  let traceVerified = traceProvided;
  if (!traceProvided) findings.push('Trace provenance unverified: no traced_nodes set was supplied; final packet membership cannot be checked.');
  else if (!Array.isArray(graph.traced_nodes) || graph.traced_nodes.length === 0) {
    errors.push('traced_nodes must be a nonempty array');
    traceVerified = false;
  } else {
    for (const node of graph.traced_nodes) {
      const id = node?.id ?? node?.node_id;
      if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,127}$/.test(id)) { errors.push('invalid traced node identity'); traceVerified = false; continue; }
      if (trace.has(id)) { errors.push(`duplicate traced node ${id}`); traceVerified = false; }
      trace.set(id, node);
    }
  }
  const ids = new Set();
  const nodes = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = row?.id ?? row?.node_id;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,127}$/.test(id)) { errors.push('invalid node identity'); continue; }
    if (ids.has(id)) errors.push(`duplicate node ${id}`);
    ids.add(id);
    if (traceProvided) {
      const original = trace.get(id);
      if (!original) { errors.push(`packet node ${id} absent from traced_nodes`); traceVerified = false; }
      else {
        if (typeof original.evidence !== 'string' || !STATES.has(original.status)) {
          findings.push(`${id}: trace evidence/status incomplete; provenance unverified`);
          traceVerified = false;
        }
        if (original.evidence !== undefined && original.evidence !== row.evidence) { errors.push(`packet evidence substituted for ${id}`); traceVerified = false; }
        if (original.status !== undefined && original.status !== row.status) { errors.push(`packet status substituted for ${id}`); traceVerified = false; }
        if (original.publishes === true) { errors.push(`traced node ${id} requests publishing`); traceVerified = false; }
      }
    }
    if (!STATES.has(row.status)) errors.push(`invalid status for ${id}`);
    if (row.publishes !== false) errors.push(`publishes must be false for ${id}`);
    if (row.verification === 'conflicting' || row.conflicting === true || (Array.isArray(row.claims) && row.claims.some((claim) => claim?.verification === 'conflicting'))) errors.push(`contradictory claims for ${id}`);
    const evidence = row.evidence;
    let verification = 'unverified';
    let sourceDigest = null;
    if (typeof evidence !== 'string' || !evidence.trim()) errors.push(`missing evidence for ${id}`);
    else if (evidence.startsWith('https://')) {
      try {
        const url = new URL(evidence);
        if (url.username || url.password) errors.push(`credential-bearing evidence URL for ${id}`);
        findings.push(`${id}: HTTPS reference requires an attributable opened-page observation; URL alone is unverified`);
      } catch { errors.push(`invalid evidence URL for ${id}`); }
    } else if (!isAbsolute(evidence) || !existsSync(evidence)) errors.push(`missing evidence file for ${id}`);
    else {
      const actual = realpathSync(evidence);
      if (!roots.some((root) => inRoot(actual, root))) errors.push(`out-of-root evidence for ${id}`);
      else if (!statSync(actual).isFile()) errors.push(`evidence must be a file for ${id}`);
      else {
        sourceDigest = digest(readFileSync(actual));
        verification = 'file-observed';
        if (row.source_digest && row.source_digest.replace(/^sha256:/, '') !== sourceDigest) {
          verification = 'stale';
          errors.push(`stale evidence digest for ${id}`);
        }
      }
    }
    // Status and a model fence never independently certify semantic claims.
    nodes.push({ id, status: row.status, evidence, verification, source_digest: sourceDigest, observed_at: options.now || new Date().toISOString(), publishes: false });
  }
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  if (graph.edges !== undefined && !Array.isArray(graph.edges)) errors.push('edges must be an array');
  for (const edge of edges) {
    if (!edge || !ids.has(edge.from_id) || !ids.has(edge.to_id)) errors.push('dangling graph edge');
  }
  return { ok: errors.length === 0, errors, findings, nodes, edges, trace_verified: traceVerified && errors.length === 0, fence_accepted: graph.confirmed === true, confirmed: false, authority: 'review-projection-only' };
}

export function mermaid(report) {
  const lines = ['flowchart LR'];
  const safe = new Map(report.nodes.map((node, index) => [node.id, `n${index}`]));
  for (const node of report.nodes) lines.push(`  ${safe.get(node.id)}["${node.id} · ${node.status} · ${node.verification}"]`);
  for (const edge of report.edges) if (safe.has(edge.from_id) && safe.has(edge.to_id)) lines.push(`  ${safe.get(edge.from_id)} --> ${safe.get(edge.to_id)}`);
  return lines.join('\n') + '\n';
}
