#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, inRoot, mermaid, validateGraph } from './graph.mjs';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const PACKET_DIR = 'docs/plans/product-branches';
export const OPERATIONS = new Set(['review', 'status', 'new', 'run', 'graph', 'draft', 'grow', 'learn']);
const STEPS = ['intake', 'provenance', 'mapping', 'onboarding', 'mission', 'build', 'brand', 'media', 'website', 'release', 'draft', 'growth', 'learning', 'closeout'];

function table(body) {
  return body.split(/\r?\n/).filter((line) => /^\|/.test(line)).map((line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim().replace(/^`|`$/g, '')));
}

function packets(root) {
  const path = join(root, PACKET_DIR, 'index.md');
  if (!existsSync(path)) return [];
  const rows = table(readFileSync(path, 'utf8'));
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(2).map((row) => Object.fromEntries(headers.map((header, i) => [header, row[i] || '']))).filter((row) => row.product_id && row.packet);
}

function safeRead(root, path) {
  const full = resolve(root, path);
  if (!inRoot(full, resolve(root)) || !existsSync(full) || !inRoot(realpathSync(full), realpathSync(root)) || !statSync(full).isFile()) return null;
  const body = readFileSync(full, 'utf8');
  return { path, digest: digest(body), body };
}

function inspectPacket(root, row) {
  if (!row) return { identity: 'candidate', admitted: false, packet: null, gates: [], findings: ['No indexed packet; this product remains a candidate, not a tenant.'] };
  const packet = safeRead(root, `${PACKET_DIR}/${row.packet}`);
  if (!packet) return { identity: row.canonical_work_id, admitted: false, packet: row.packet, gates: [], findings: ['Indexed packet is missing or outside the packet root.'] };
  const gates = (packet.body.split(/^## Gate Ledger\s*$/m)[1] || '').split(/^## /m)[0].trim();
  const held = packet.body.split(/\r?\n/).filter((line) => /\b(held|blocked|pending|no-signal)\b/i.test(line));
  // Retain bounded packet evidence without promoting old prose to live status.
  return { identity: row.canonical_work_id, admitted: false, packet: `${PACKET_DIR}/${row.packet}`, packet_digest: packet.digest, promotion_state: row.promotion_state, current_gate: row.current_gate, gates, held_evidence: held.slice(0, 30), findings: ['Packet observations require owning-source refresh before external action; admission is not established by this report.'] };
}

function inspectCatalog(root, options) {
  const file = safeRead(root, '.agents/skills/sapling-lifecycle/references/catalog.json');
  if (!file) return { components: [], findings: ['Workflow reference catalog is missing.'] };
  const catalog = JSON.parse(file.body);
  const roots = { cambium: root, vault: options.vaultRoot, clusters: options.clustersRoot };
  return { components: (catalog.components || []).map((component) => {
    const ownerRoot = roots[component.source?.root];
    const observed = ownerRoot ? safeRead(resolve(ownerRoot), component.source.path) : null;
    const expected = (component.digest || component.source?.sha256 || '').replace(/^sha256:/, '');
    return { ...component, verification: !ownerRoot ? 'root-unavailable' : !observed ? 'source-missing' : expected && expected !== observed.digest ? 'source-drift' : 'file-observed', observed_digest: observed?.digest || null };
  }), findings: [] };
}

function requireRead(options) {
  if (options.record !== undefined && options.record !== false) throw new Error('record must be false on the read route');
  if (options.approved !== undefined && options.approved !== false) throw new Error('approved must be false on the read route');
}

function localOutput(root, path) {
  const base = resolve(root, '.local/sapling-lifecycle');
  const full = isAbsolute(path) ? resolve(path) : resolve(root, path);
  if (!inRoot(full, base)) throw new Error('output/state must be under .local/sapling-lifecycle');
  let current = full;
  while (current !== root) {
    try { if (lstatSync(current).isSymbolicLink()) throw new Error('output symlink refused'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    current = dirname(current);
  }
  let ancestor = dirname(full);
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  if (!inRoot(realpathSync(ancestor), realpathSync(root))) throw new Error('output symlink escapes repository');
  if (existsSync(full) && (!statSync(full).isFile() || !inRoot(realpathSync(full), realpathSync(root)))) throw new Error('unsafe output file');
  if (existsSync(full) && lstatSync(full).nlink > 1) throw new Error('hardlinked output/state refused');
  return full;
}

function writeLocal(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.sapling-${process.pid}-${Date.now()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    // Replacing the directory entry never follows a hardlink or a final symlink.
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function readState(path, product) {
  if (!existsSync(path)) return { schema: 'cambium.sapling-local-progress.v1', product, steps: [] };
  const state = JSON.parse(readFileSync(path, 'utf8'));
  if (state.schema !== 'cambium.sapling-local-progress.v1' || state.product !== product || !Array.isArray(state.steps)) throw new Error('state does not match product');
  const keys = new Set();
  for (const step of state.steps) {
    if (typeof step.key !== 'string' || keys.has(step.key) || !['prepared', 'completed', 'blocked', 'unknown'].includes(step.status)) throw new Error('invalid or duplicate progress step');
    if (step.status === 'completed' && !step.proof_ref) throw new Error('completed step requires an attributable proof_ref');
    keys.add(step.key);
  }
  return state;
}

export function lifecycle(operation, product, selection, options = {}) {
  options = { ...options, vaultRoot: options.vaultRoot || process.env.THOUGHTSEED_VAULT_ROOT, clustersRoot: options.clustersRoot || process.env.SAPLING_CLUSTERS_ROOT };
  requireRead(options);
  if (!OPERATIONS.has(operation)) throw new Error('unknown lifecycle operation');
  if (typeof product !== 'string' || !/^(?:sapling:)?[a-z0-9][a-z0-9-]{0,63}$/.test(product)) throw new Error('product must be a safe slug or sapling identity');
  if (product === 'all' && !['review', 'status'].includes(operation)) throw new Error('all is supported only for review/status');
  const slug = product.replace(/^sapling:/, '');
  const root = resolve(options.sourceRoot || process.env.CAMBIUM_ROOT || DEFAULT_ROOT);
  const rootsFile = join(root, '.local/sapling-lifecycle/roots.json');
  if (existsSync(rootsFile)) {
    const configured = JSON.parse(readFileSync(rootsFile, 'utf8'));
    options.vaultRoot ||= configured.vaultRoot;
    options.clustersRoot ||= configured.clustersRoot;
  }
  if (!existsSync(join(root, 'PROJECT.md'))) throw new Error('Cambium source root is missing');
  const index = packets(root);
  const selected = product === 'all' ? index.filter((row) => row.branch_kind === 'product') : index.filter((row) => row.product_id === slug || row.canonical_work_id === product);
  const observations = selected.length ? selected.map((row) => inspectPacket(root, row)) : [inspectPacket(root, null)];
  const now = options.now || new Date().toISOString();
  let report = { schema: 'cambium.sapling-review-projection.v1', operation, product, observed_at: now, authority: 'review-projection-only', publishes: false, record: false, external_action_performed: false, observations, status: 'reviewed', next_action: 'Read owning evidence and select one bounded step; unresolved gates remain held.' };
  if (operation === 'status' && options.state) {
    if (product === 'all') throw new Error('a progress state requires one product');
    report.progress = readState(localOutput(root, options.state), product);
    report.next_action = 'Read the recorded proof or blocker before selecting the next step; completed actions are not replayed.';
  }
  if (operation === 'review') report.workflows = inspectCatalog(root, options);
  if (operation === 'new') report = { ...report, status: selected.length ? 'already-indexed' : 'candidate-preparation', seed: { name: slug, work_id_candidate: `sapling:${slug}`, accountable_owner: null, beneficiary: null, need: null, offer: null, app_repository: null, site_repository: null, survival_metric: null }, next_action: 'Complete the seed and provenance; use existing project-intake lifecycle. No identity, repository, mapping receipt, or tenant is created.' };
  if (operation === 'graph') {
    if (!options.graph) report = { ...report, status: 'input-required', next_action: 'Run the existing sapling-product-loop read-only with record=false approved=false, wait for terminal fence, then import its graph with --graph --app-root --site-root.' };
    else {
      const graph = JSON.parse(readFileSync(options.graph, 'utf8'));
      const validated = validateGraph(graph, { appRoot: options.appRoot, siteRoot: options.siteRoot, additionalRoots: [options.vaultRoot, options.brandsRoot].filter(Boolean), record: false, approved: false, now });
      report = { ...report, status: validated.ok ? 'graph-reviewed' : 'graph-refused', graph: validated, diagram: mermaid(validated), next_action: 'Graph is a review projection. Semantic claims and operational admission remain separately verified.' };
    }
  }
  if (operation === 'run') {
    if (!selection) report = { ...report, status: 'selection-required', available_steps: STEPS, next_action: 'Present a recommendation and request one step selection; do not select silently.' };
    else {
      if (!STEPS.includes(selection)) throw new Error(`unsupported step; choose one of ${STEPS.join(', ')}`);
      const key = options.stepKey || `${slug}:${selection}`;
      if (!/^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,127}$/.test(key)) throw new Error('invalid step key');
      const statePath = options.state ? localOutput(root, options.state) : null;
      const state = statePath ? readState(statePath, product) : { steps: [] };
      const existing = state.steps.find((step) => step.key === key);
      if (existing?.status === 'completed') report = { ...report, status: 'already-completed', step_key: key, proof_ref: existing.proof_ref, next_action: 'Read the existing outcome; do not repeat the external action.' };
      else if (existing && ['unknown', 'blocked'].includes(existing.status)) report = { ...report, status: 'held', step_key: key, next_action: 'Resolve the recorded blocker or query the original external action status before any retry.' };
      else {
        report = { ...report, status: 'prepared', selected_step: selection, step_key: key, prepared_steps: 1, next_action: `Load the ${selection} route from the skill, refresh its prerequisites, then handle this one step within the current user request. This helper prepares a brief and executes no external action.` };
        if (statePath && !existing) { state.steps.push({ key, status: 'prepared', prepared_at: now }); writeLocal(statePath, state); }
      }
    }
  }
  if (operation === 'draft') {
    if (!selection || !/^[a-z][a-z0-9-]{0,31}$/.test(selection)) throw new Error('draft requires a channel slug');
    report = { ...report, status: 'draft-brief-ready', channel: selection, next_action: 'Read product proof and brand authority, prepare channel copy, run the claim fence; save externally only when the request authorizes that destination. Scheduling is a separate action.' };
  }
  if (operation === 'grow') report = { ...report, status: 'experiment-brief-ready', next_action: 'Read the existing search-stack and GTM routes, choose one evidence-backed hypothesis and metric, and prepare one experiment. No campaign or send is armed.' };
  if (operation === 'learn') report = { ...report, status: 'learning-review-ready', next_action: 'Read attributable terminal outcomes with existing learning compiler. Propose one lesson and next action; no automatic memory, vault, provider, or operational graph write.' };
  if (options.out) writeLocal(localOutput(root, options.out), report);
  return report;
}

export function parseArgs(argv) {
  const positional = [];
  const options = {};
  const flags = { '--source-root': 'sourceRoot', '--vault-root': 'vaultRoot', '--clusters-root': 'clustersRoot', '--brands-root': 'brandsRoot', '--app-root': 'appRoot', '--site-root': 'siteRoot', '--graph': 'graph', '--out': 'out', '--state': 'state', '--step-key': 'stepKey' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (flags[arg]) { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${arg} requires a value`); options[flags[arg]] = argv[++i]; }
    else if (arg === '--record=false') options.record = false;
    else if (arg === '--approved=false') options.approved = false;
    else if (arg.startsWith('--record') || arg.startsWith('--approved')) throw new Error('read route requires record=false and approved=false');
    else if (arg === '--help') options.help = true;
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else positional.push(arg);
  }
  if (positional.length > 3) throw new Error('at most one step/channel may be selected');
  return { operation: positional[0], product: positional[1], selection: positional[2], options };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    if (parsed.options.help) console.log('node lifecycle.mjs <review|status|new|run|graph|draft|grow|learn> <slug|all> [step|channel] [--source-root PATH] [--vault-root PATH] [--clusters-root PATH] [--graph PATH --app-root PATH --site-root PATH] [--out .local/sapling-lifecycle/REPORT.json] [--state .local/sapling-lifecycle/STATE.json --step-key KEY]');
    else { const report = lifecycle(parsed.operation, parsed.product, parsed.selection, parsed.options); console.log(JSON.stringify(report, null, 2)); if (report.status === 'graph-refused') process.exitCode = 1; }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
