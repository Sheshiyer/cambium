import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export const INTENT_GRAPH_SCHEMA = 'cambium.intent-graph-projection.v1';
export const INTENT_GRAPH_PROJECTION_AUTHORITY = 'read_only';

export const INTENT_GRAPH_NODE_KINDS = Object.freeze([
  'vision', 'mission', 'goal', 'task', 'evidence', 'learning', 'overlay', 'gate',
]);
export const INTENT_GRAPH_SOURCE_AUTHORITIES = Object.freeze([
  'vision_anchor', 'repository_mission', 'isa_acceptance', 'gsd_planning',
  'verification_evidence', 'historical_learning', 'derived_reference',
]);
export const INTENT_GRAPH_LIFECYCLES = Object.freeze([
  'enduring', 'renewable', 'finite', 'planned', 'verified', 'historical', 'derived', 'gated',
]);
export const INTENT_GRAPH_COMPLETION_STATES = Object.freeze([
  'not_applicable', 'pending', 'satisfied', 'blocked', 'stopped', 'retired',
]);
export const INTENT_GRAPH_APPROVAL_STATES = Object.freeze([
  'not_required', 'required', 'approved', 'denied',
]);
export const INTENT_GRAPH_FRESHNESS_STATES = Object.freeze(['fresh', 'stale', 'missing']);
export const INTENT_GRAPH_STOP_CONDITION_KINDS = Object.freeze([
  'none', 'external_verification', 'approval_boundary', 'mission_review', 'finite_goal',
]);
export const INTENT_GRAPH_EDGE_KINDS = Object.freeze([
  'directs', 'scopes', 'decomposes', 'proves', 'produces',
  'closes', 'renews', 'informs', 'references', 'gates',
]);

export const INTENT_GRAPH_DIRECTION_MATRIX = Object.freeze([
  Object.freeze({ from: 'vision', kind: 'directs', to: Object.freeze(['mission']) }),
  Object.freeze({ from: 'mission', kind: 'scopes', to: Object.freeze(['goal']) }),
  Object.freeze({ from: 'goal', kind: 'decomposes', to: Object.freeze(['task']) }),
  Object.freeze({ from: 'task', kind: 'proves', to: Object.freeze(['evidence']) }),
  Object.freeze({ from: 'evidence', kind: 'produces', to: Object.freeze(['learning']) }),
  Object.freeze({ from: 'evidence', kind: 'closes', to: Object.freeze(['goal']) }),
  Object.freeze({ from: 'gate', kind: 'renews', to: Object.freeze(['goal']) }),
  Object.freeze({ from: 'learning', kind: 'informs', to: Object.freeze(['gate']) }),
  Object.freeze({ from: 'overlay', kind: 'references', to: Object.freeze(['vision', 'mission']) }),
  Object.freeze({ from: 'gate', kind: 'gates', to: Object.freeze(['goal', 'task']) }),
]);

// Short aliases make the closed vocabularies convenient for source-model authors.
export const NODE_KINDS = INTENT_GRAPH_NODE_KINDS;
export const SOURCE_AUTHORITIES = INTENT_GRAPH_SOURCE_AUTHORITIES;
export const LIFECYCLES = INTENT_GRAPH_LIFECYCLES;
export const COMPLETION_STATES = INTENT_GRAPH_COMPLETION_STATES;
export const APPROVAL_STATES = INTENT_GRAPH_APPROVAL_STATES;
export const FRESHNESS_STATES = INTENT_GRAPH_FRESHNESS_STATES;
export const STOP_CONDITION_KINDS = INTENT_GRAPH_STOP_CONDITION_KINDS;
export const EDGE_KINDS = INTENT_GRAPH_EDGE_KINDS;
export const EDGE_DIRECTION_MATRIX = INTENT_GRAPH_DIRECTION_MATRIX;

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const NODE_ID = /^intent_[a-f0-9]{64}$/;
const EDGE_ID = /^intent_edge_[a-f0-9]{64}$/;
const MAX_NODES = 4096;
const MAX_EDGES = 16384;
const GENERATED_PATHS = new Set([
  'docs/architecture/intent-graph.v1.json',
  'docs/architecture/intent-graph.md',
]);
const KIND_AUTHORITIES = Object.freeze({
  vision: new Set(['vision_anchor']),
  mission: new Set(['repository_mission']),
  goal: new Set(['isa_acceptance', 'gsd_planning']),
  task: new Set(['gsd_planning']),
  evidence: new Set(['verification_evidence']),
  learning: new Set(['verification_evidence', 'historical_learning']),
  overlay: new Set(['derived_reference']),
  gate: new Set(['isa_acceptance']),
});
const KIND_LIFECYCLES = Object.freeze({
  vision: new Set(['enduring']),
  mission: new Set(['renewable']),
  goal: new Set(['finite']),
  task: new Set(['planned']),
  evidence: new Set(['verified']),
  learning: new Set(['verified', 'historical']),
  overlay: new Set(['derived']),
  gate: new Set(['gated']),
});

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

function assertRecord(value, label) {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
}

function assertClosedKeys(value, allowed, label) {
  assertRecord(value, label);
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) throw new TypeError(`${label} contains forbidden field(s): ${extras.join(', ')}`);
  const missing = allowed.filter((key) => !(key in value));
  if (missing.length > 0) throw new TypeError(`${label} is missing field(s): ${missing.join(', ')}`);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function canonicalText(value) {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
}

function hexDigest(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function digestText(value) {
  return `sha256:${hexDigest(canonicalText(value))}`;
}

function digestObject(value) {
  return `sha256:${hexDigest(canonicalJson(value))}`;
}

function projectionShaped(value) {
  if (!isRecord(value)) return false;
  if (value.schema === INTENT_GRAPH_SCHEMA || value.schema === 'cambium.goal-graph-projection.v1') return true;
  const marker = typeof value.schema === 'string' ? value.schema.toLowerCase() : '';
  return (marker.includes('intent-graph') || marker.includes('goal-graph')) && marker.includes('projection');
}

function rejectProjectionText(value, label) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return;
  try {
    if (projectionShaped(JSON.parse(trimmed))) {
      throw new TypeError(`${label} is a projection and cannot enter a fresh authority lane`);
    }
  } catch (error) {
    if (error instanceof TypeError) throw error;
  }
}

function normalizeRelativePath(value, label = 'source path') {
  if (!nonEmptyString(value) || path.isAbsolute(value) || value.includes('\\') || value.includes('\0')) {
    throw new TypeError(`${label} must be a safe repository-relative POSIX path`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new TypeError(`${label} must not contain traversal or normalization drift`);
  }
  return normalized;
}

function containedFile(repositoryRoot, relativePath, label = 'source path') {
  const normalized = normalizeRelativePath(relativePath, label);
  let actual;
  try {
    actual = realpathSync(path.join(repositoryRoot, ...normalized.split('/')));
  } catch {
    throw new TypeError(`${label} ${normalized} is missing`);
  }
  const relative = path.relative(repositoryRoot, actual);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new TypeError(`${label} ${normalized} escapes the repository root`);
  }
  if (!statSync(actual).isFile()) throw new TypeError(`${label} ${normalized} must resolve to a file`);
  return { normalized, actual };
}

function validateSourcePolicy(relativePath, selector) {
  if (relativePath === '.planning/STATE.md' || GENERATED_PATHS.has(relativePath)) {
    throw new TypeError(`source path ${relativePath} is excluded from intent graph authority`);
  }
  if (relativePath === '.planning/ROADMAP.md') {
    if (!selector.startsWith('markdown.bold-field:') || !selector.endsWith('#Goal')) {
      throw new TypeError('ROADMAP sources may select only an exact Phase Goal field');
    }
  }
  if (relativePath === 'ISA.md') {
    const allowed = selector === 'frontmatter.task'
      || selector.startsWith('markdown.list-item:');
    if (!allowed) throw new TypeError('ISA sources may select only frontmatter.task or one reviewed gate list item');
  }
}

function validateSelectorSyntax(selector) {
  if (!nonEmptyString(selector)) throw new TypeError('source selector must be a non-empty string');
  if (selector === 'whole-file') return;
  if (selector.startsWith('markdown.heading:') && nonEmptyString(selector.slice('markdown.heading:'.length))) return;
  if (selector.startsWith('markdown.bold-field:')) {
    const spec = selector.slice('markdown.bold-field:'.length);
    const separator = spec.lastIndexOf('#');
    if (separator > 0 && separator < spec.length - 1) return;
  }
  if (/^frontmatter\.[A-Za-z][A-Za-z0-9_-]*$/.test(selector)) return;
  if (selector.startsWith('markdown.list-item:') && nonEmptyString(selector.slice('markdown.list-item:'.length))) return;
  if (selector.startsWith('xml.task-name:') && nonEmptyString(selector.slice('xml.task-name:'.length))) return;
  throw new TypeError(`unknown or unsafe selector ${selector}`);
}

function exactMatch(matches, selector) {
  if (matches.length !== 1) {
    throw new TypeError(`selector ${selector} must resolve exactly once; received ${matches.length} matches`);
  }
  return canonicalText(matches[0]);
}

function headingSections(text, heading) {
  const lines = canonicalText(text).split('\n');
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index]);
    if (match && match[2] === heading) starts.push({ index, level: match[1].length });
  }
  return starts.map(({ index, level }) => {
    let end = lines.length - 1;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = /^(#{1,6})\s+/.exec(lines[cursor]);
      if (next && next[1].length <= level) {
        end = cursor;
        break;
      }
    }
    return lines.slice(index, end).join('\n');
  });
}

function selectContent(raw, selector) {
  validateSelectorSyntax(selector);
  const text = canonicalText(raw);
  if (selector === 'whole-file') return text;

  if (selector.startsWith('markdown.heading:')) {
    const heading = selector.slice('markdown.heading:'.length);
    if (!nonEmptyString(heading)) throw new TypeError('Markdown heading selector must name an exact heading');
    return exactMatch(headingSections(text, heading), selector);
  }

  if (selector.startsWith('markdown.bold-field:')) {
    const spec = selector.slice('markdown.bold-field:'.length);
    const separator = spec.lastIndexOf('#');
    if (separator <= 0 || separator === spec.length - 1) throw new TypeError('bold-field selector must name a heading and field');
    const heading = spec.slice(0, separator);
    const field = spec.slice(separator + 1);
    const sections = headingSections(text, heading);
    const matches = [];
    for (const section of sections) {
      for (const line of section.split('\n')) {
        const match = /^\*\*([^*]+)\*\*:\s*(.*?)\s*$/.exec(line);
        if (match && match[1] === field) matches.push(line);
      }
    }
    return exactMatch(matches, selector);
  }

  if (selector.startsWith('frontmatter.')) {
    const field = selector.slice('frontmatter.'.length);
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(field)) throw new TypeError('frontmatter selector has an unsafe field');
    const lines = text.split('\n');
    if (lines[0] !== '---') throw new TypeError('frontmatter selector requires opening ---');
    const end = lines.indexOf('---', 1);
    if (end < 0) throw new TypeError('frontmatter selector requires closing ---');
    return exactMatch(lines.slice(1, end).filter((line) => line.startsWith(`${field}:`)), selector);
  }

  if (selector.startsWith('markdown.list-item:')) {
    const prefix = selector.slice('markdown.list-item:'.length);
    if (!nonEmptyString(prefix)) throw new TypeError('list-item selector must have a non-empty exact prefix');
    return exactMatch(text.split('\n').filter((line) => line.startsWith(prefix)), selector);
  }

  if (selector.startsWith('xml.task-name:')) {
    const name = selector.slice('xml.task-name:'.length);
    if (!nonEmptyString(name)) throw new TypeError('XML task selector must have an exact name');
    const matches = [];
    for (const match of text.matchAll(/<task\b[^>]*>[\s\S]*?<\/task>/g)) {
      const names = [...match[0].matchAll(/<name>\s*([^<]+?)\s*<\/name>/g)].map((entry) => entry[1]);
      if (names.length === 1 && names[0] === name) matches.push(match[0]);
    }
    return exactMatch(matches, selector);
  }

  throw new TypeError(`unknown or unsafe selector ${selector}`);
}

function resolveSelection(repositoryRoot, source, { authorityRequired }) {
  const allowed = authorityRequired
    ? ['path', 'authority', 'selector', 'digest']
    : ['path', 'selector', 'digest'];
  assertClosedKeys(source, allowed, 'source provenance');
  const { normalized, actual } = containedFile(repositoryRoot, source.path);
  validateSourcePolicy(normalized, source.selector);
  if (!DIGEST.test(source.digest)) throw new TypeError(`source ${normalized} must declare a lowercase SHA-256 digest`);
  const selected = selectContent(readFileSync(actual, 'utf8'), source.selector);
  rejectProjectionText(selected, `source ${normalized}#${source.selector}`);
  const actualDigest = digestText(selected);
  if (actualDigest !== source.digest) {
    throw new TypeError(`source digest mismatch for ${normalized}#${source.selector}`);
  }
  return {
    selected,
    provenance: authorityRequired
      ? { path: normalized, authority: source.authority, selector: source.selector, digest: actualDigest }
      : { path: normalized, selector: source.selector, digest: actualDigest },
  };
}

function validateStopCondition(repositoryRoot, value) {
  assertClosedKeys(value, ['kind', 'sourcePath', 'selector', 'satisfied'], 'stop condition');
  if (!INTENT_GRAPH_STOP_CONDITION_KINDS.includes(value.kind)) throw new TypeError('stop condition kind is invalid');
  if (typeof value.satisfied !== 'boolean') throw new TypeError('stop condition satisfied must be boolean');
  if (value.kind === 'none') {
    if (value.sourcePath !== null || value.selector !== null) {
      throw new TypeError('none stop condition must have null sourcePath and selector');
    }
    return { ...value };
  }
  if (!nonEmptyString(value.sourcePath) || !nonEmptyString(value.selector)) {
    throw new TypeError('source-backed stop condition requires sourcePath and selector');
  }
  const { normalized, actual } = containedFile(repositoryRoot, value.sourcePath, 'stop condition sourcePath');
  validateSourcePolicy(normalized, value.selector);
  selectContent(readFileSync(actual, 'utf8'), value.selector);
  return { kind: value.kind, sourcePath: normalized, selector: value.selector, satisfied: value.satisfied };
}

function validateState(value, repositoryRoot = null) {
  assertClosedKeys(value, ['completion', 'approval', 'freshness', 'blockedReason', 'stopCondition'], 'node state');
  if (!INTENT_GRAPH_COMPLETION_STATES.includes(value.completion)) throw new TypeError('node state completion is invalid');
  if (!INTENT_GRAPH_APPROVAL_STATES.includes(value.approval)) throw new TypeError('node state approval is invalid');
  if (!INTENT_GRAPH_FRESHNESS_STATES.includes(value.freshness)) throw new TypeError('node state freshness is invalid');
  const blocked = value.completion === 'blocked';
  if (blocked !== nonEmptyString(value.blockedReason)) {
    throw new TypeError('blocked completion requires one blockedReason and non-blocked completion requires null');
  }
  if (!blocked && value.blockedReason !== null) throw new TypeError('non-blocked node must have null blockedReason');
  const stop = repositoryRoot
    ? validateStopCondition(repositoryRoot, value.stopCondition)
    : validateProjectionStopCondition(value.stopCondition);
  if (blocked && stop.satisfied) throw new TypeError('blocked node cannot have a satisfied stop condition');
  if (value.completion === 'satisfied') {
    if (value.freshness !== 'fresh') throw new TypeError('satisfied completion requires fresh provenance');
    if (!['not_required', 'approved'].includes(value.approval)) throw new TypeError('satisfied completion requires approval clearance');
  }
  if (value.approval === 'denied' && value.completion === 'satisfied') {
    throw new TypeError('denied approval cannot be represented as satisfied');
  }
  return { completion: value.completion, approval: value.approval, freshness: value.freshness, blockedReason: value.blockedReason, stopCondition: stop };
}

function validateProjectionStopCondition(value) {
  assertClosedKeys(value, ['kind', 'sourcePath', 'selector', 'satisfied'], 'stop condition');
  if (!INTENT_GRAPH_STOP_CONDITION_KINDS.includes(value.kind) || typeof value.satisfied !== 'boolean') {
    throw new TypeError('projection stop condition is invalid');
  }
  if (value.kind === 'none') {
    if (value.sourcePath !== null || value.selector !== null) throw new TypeError('none stop condition must have null source reference');
  } else {
    if (!nonEmptyString(value.sourcePath) || !nonEmptyString(value.selector)) {
      throw new TypeError('source-backed stop condition requires a source reference');
    }
    const sourcePath = normalizeRelativePath(value.sourcePath, 'stop condition sourcePath');
    validateSelectorSyntax(value.selector);
    validateSourcePolicy(sourcePath, value.selector);
    return { ...value, sourcePath };
  }
  return { ...value };
}

function validateKindSemantics(kind, authority, lifecycle) {
  if (!INTENT_GRAPH_NODE_KINDS.includes(kind)) throw new TypeError(`unknown node kind ${kind}`);
  if (!INTENT_GRAPH_SOURCE_AUTHORITIES.includes(authority)) throw new TypeError(`unknown source authority ${authority}`);
  if (!INTENT_GRAPH_LIFECYCLES.includes(lifecycle)) throw new TypeError(`unknown lifecycle ${lifecycle}`);
  if (!KIND_AUTHORITIES[kind].has(authority)) throw new TypeError(`${kind} cannot exercise ${authority} authority`);
  if (!KIND_LIFECYCLES[kind].has(lifecycle)) throw new TypeError(`${kind} cannot use ${lifecycle} lifecycle`);
}

function nodeIdFor(node) {
  return `intent_${hexDigest(canonicalJson({
    kind: node.kind,
    path: node.source.path,
    selector: node.source.selector,
    authority: node.source.authority,
  }))}`;
}

function edgeIdFor(edge) {
  return `intent_edge_${hexDigest(canonicalJson({
    from: edge.from,
    kind: edge.kind,
    to: edge.to,
    sourceSelector: edge.source.selector,
  }))}`;
}

function directionAllowed(fromKind, edgeKind, toKind) {
  return INTENT_GRAPH_DIRECTION_MATRIX.some((row) => row.from === fromKind && row.kind === edgeKind && row.to.includes(toKind));
}

function canonicalSourceSet(nodes, edges) {
  const tuples = [];
  for (const node of nodes) {
    tuples.push({ path: node.source.path, selector: node.source.selector, digest: node.source.digest });
    for (const anchor of node.anchorReferences ?? []) {
      tuples.push({ path: anchor.path, selector: 'whole-file', digest: anchor.digest });
    }
  }
  for (const edge of edges) tuples.push({ path: edge.source.path, selector: edge.source.selector, digest: edge.source.digest });
  const unique = new Map(tuples.map((tuple) => [canonicalJson(tuple), tuple]));
  return [...unique.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, tuple]) => tuple);
}

function compileAnchorReferences(repositoryRoot, value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 2) {
    throw new TypeError('overlay must declare one or two canonical anchor references');
  }
  const references = value.map((reference) => {
    assertClosedKeys(reference, ['path', 'digest'], 'overlay anchor reference');
    if (!['VISION.md', 'MISSION.md'].includes(reference.path)) {
      throw new TypeError('overlay anchor must point directly to VISION.md or MISSION.md');
    }
    if (!DIGEST.test(reference.digest)) throw new TypeError('overlay anchor requires a lowercase SHA-256 digest');
    const { actual } = containedFile(repositoryRoot, reference.path, 'overlay anchor path');
    const actualDigest = digestText(readFileSync(actual, 'utf8'));
    if (actualDigest !== reference.digest) throw new TypeError(`overlay anchor digest mismatch for ${reference.path}`);
    return { path: reference.path, digest: actualDigest };
  }).sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(references.map(({ path: pathname }) => pathname)).size !== references.length) {
    throw new TypeError('overlay anchor references must be unique');
  }
  return references;
}

function validateCompiledNode(node) {
  const allowed = ['id', 'kind', 'source', 'lifecycle', 'state'];
  if (node.kind === 'overlay') allowed.push('anchorReferences');
  assertClosedKeys(node, allowed, 'projection node');
  if (!NODE_ID.test(node.id)) throw new TypeError('projection node ID is invalid');
  assertClosedKeys(node.source, ['path', 'authority', 'selector', 'digest'], 'projection node source');
  normalizeRelativePath(node.source.path);
  validateSelectorSyntax(node.source.selector);
  if (!DIGEST.test(node.source.digest)) throw new TypeError('projection node source is invalid');
  validateSourcePolicy(node.source.path, node.source.selector);
  validateKindSemantics(node.kind, node.source.authority, node.lifecycle);
  validateState(node.state);
  if (node.id !== nodeIdFor(node)) throw new TypeError(`projection node ID mismatch for ${node.id}`);
  if (node.kind === 'overlay') {
    if (!Array.isArray(node.anchorReferences) || node.anchorReferences.length === 0 || node.anchorReferences.length > 2) throw new TypeError('projection overlay requires bounded anchor references');
    let previousPath = null;
    for (const reference of node.anchorReferences) {
      assertClosedKeys(reference, ['path', 'digest'], 'projection overlay anchor');
      if (!['VISION.md', 'MISSION.md'].includes(reference.path) || !DIGEST.test(reference.digest)) {
        throw new TypeError('projection overlay anchor is invalid');
      }
      if (previousPath !== null && previousPath.localeCompare(reference.path) >= 0) {
        throw new TypeError('projection overlay anchors must be unique and sorted');
      }
      previousPath = reference.path;
    }
  }
}

function validateCompiledEdge(edge, nodesById) {
  assertClosedKeys(edge, ['id', 'from', 'kind', 'to', 'source'], 'projection edge');
  if (!EDGE_ID.test(edge.id) || !INTENT_GRAPH_EDGE_KINDS.includes(edge.kind)) throw new TypeError('projection edge identity or kind is invalid');
  assertClosedKeys(edge.source, ['path', 'selector', 'digest'], 'projection edge source');
  normalizeRelativePath(edge.source.path);
  validateSelectorSyntax(edge.source.selector);
  validateSourcePolicy(edge.source.path, edge.source.selector);
  if (!DIGEST.test(edge.source.digest)) throw new TypeError('projection edge source is invalid');
  const from = nodesById.get(edge.from);
  const to = nodesById.get(edge.to);
  if (!from || !to || edge.from === edge.to) throw new TypeError('projection edge has a missing or self endpoint');
  if (!directionAllowed(from.kind, edge.kind, to.kind)) throw new TypeError(`edge ${edge.kind} violates the direction matrix`);
  if (edge.id !== edgeIdFor(edge)) throw new TypeError(`projection edge ID mismatch for ${edge.id}`);
  validateTransitionSemantics(edge, from, to);
}

function validateTransitionSemantics(edge, from, to) {
  if (['closes', 'renews'].includes(edge.kind) && to.lifecycle !== 'finite') {
    throw new TypeError(`${edge.kind} must target a finite goal`);
  }
  if (edge.kind === 'renews') {
    if (from.kind !== 'gate' || from.source.path !== 'ISA.md' || from.source.authority !== 'isa_acceptance') {
      throw new TypeError('renewal may be represented only by one reviewed ISA gate');
    }
  }
  if (from.kind === 'learning' && from.source.authority === 'isa_acceptance') {
    throw new TypeError('learning cannot exercise ISA acceptance authority');
  }
  if (edge.kind === 'references') {
    const reference = from.anchorReferences?.find(({ path: pathname }) => pathname === to.source.path);
    if (!reference) {
      throw new TypeError('overlay references edge must bind a declared canonical anchor path');
    }
  }
}

export function compileIntentGraph(input) {
  assertRecord(input, 'intent graph input');
  if (projectionShaped(input)) throw new TypeError('projection foldback cannot enter the intent graph authority lane');
  assertClosedKeys(input, ['repositoryRoot', 'nodes', 'edges'], 'intent graph input');
  if (!nonEmptyString(input.repositoryRoot) || !path.isAbsolute(input.repositoryRoot)) {
    throw new TypeError('repositoryRoot must be an absolute path');
  }
  let repositoryRoot;
  try {
    repositoryRoot = realpathSync(input.repositoryRoot);
  } catch {
    throw new TypeError('repositoryRoot must exist');
  }
  if (!statSync(repositoryRoot).isDirectory()) throw new TypeError('repositoryRoot must be a directory');
  if (!Array.isArray(input.nodes) || input.nodes.length > MAX_NODES) throw new TypeError('nodes must be a bounded array');
  if (!Array.isArray(input.edges) || input.edges.length > MAX_EDGES) throw new TypeError('edges must be a bounded array');

  const keyToNode = new Map();
  const idToNode = new Map();
  for (const draft of input.nodes) {
    assertRecord(draft, 'node declaration');
    const allowed = ['key', 'kind', 'source', 'lifecycle', 'state'];
    if (draft.kind === 'overlay') allowed.push('anchorReferences');
    assertClosedKeys(draft, allowed, 'node declaration');
    if (!nonEmptyString(draft.key) || keyToNode.has(draft.key)) throw new TypeError(`duplicate or invalid node key ${draft.key}`);
    const resolved = resolveSelection(repositoryRoot, draft.source, { authorityRequired: true });
    validateKindSemantics(draft.kind, resolved.provenance.authority, draft.lifecycle);
    const node = {
      id: '', kind: draft.kind, source: resolved.provenance, lifecycle: draft.lifecycle,
      state: validateState(draft.state, repositoryRoot),
    };
    if (draft.kind === 'overlay') node.anchorReferences = compileAnchorReferences(repositoryRoot, draft.anchorReferences);
    node.id = nodeIdFor(node);
    if (idToNode.has(node.id)) throw new TypeError(`duplicate semantic node identity ${node.id}`);
    keyToNode.set(draft.key, node);
    idToNode.set(node.id, node);
  }

  const edges = [];
  const edgeIds = new Set();
  for (const draft of input.edges) {
    assertClosedKeys(draft, ['from', 'kind', 'to', 'source'], 'edge declaration');
    if (!INTENT_GRAPH_EDGE_KINDS.includes(draft.kind)) throw new TypeError(`unknown or unlabeled edge kind ${draft.kind}`);
    const from = keyToNode.get(draft.from);
    const to = keyToNode.get(draft.to);
    if (!from || !to) throw new TypeError(`edge ${draft.kind} references a missing endpoint`);
    if (from.id === to.id) throw new TypeError(`edge ${draft.kind} cannot be a self-edge`);
    if (!directionAllowed(from.kind, draft.kind, to.kind)) throw new TypeError(`edge ${draft.kind} violates the direction matrix`);
    const resolved = resolveSelection(repositoryRoot, draft.source, { authorityRequired: false });
    const edge = { id: '', from: from.id, kind: draft.kind, to: to.id, source: resolved.provenance };
    edge.id = edgeIdFor(edge);
    if (edgeIds.has(edge.id)) throw new TypeError(`duplicate semantic edge identity ${edge.id}`);
    validateTransitionSemantics(edge, from, to);
    edgeIds.add(edge.id);
    edges.push(edge);
  }

  const nodes = [...idToNode.values()].sort((left, right) => left.id.localeCompare(right.id));
  edges.sort((left, right) => left.id.localeCompare(right.id));
  const projection = {
    schema: INTENT_GRAPH_SCHEMA,
    projectionAuthority: INTENT_GRAPH_PROJECTION_AUTHORITY,
    sourceSetDigest: digestObject(canonicalSourceSet(nodes, edges)),
    graphDigest: '',
    nodes,
    edges,
  };
  const { graphDigest: _ignored, ...digestable } = projection;
  projection.graphDigest = digestObject(digestable);
  return validateIntentGraphProjection(projection);
}

export function validateIntentGraphProjection(value) {
  assertClosedKeys(value, ['schema', 'projectionAuthority', 'sourceSetDigest', 'graphDigest', 'nodes', 'edges'], 'intent graph projection');
  if (value.schema !== INTENT_GRAPH_SCHEMA) throw new TypeError(`schema must equal ${INTENT_GRAPH_SCHEMA}`);
  if (value.projectionAuthority !== INTENT_GRAPH_PROJECTION_AUTHORITY) throw new TypeError('intent graph projection must remain read_only');
  if (!DIGEST.test(value.sourceSetDigest) || !DIGEST.test(value.graphDigest)) throw new TypeError('projection digests must be lowercase SHA-256 values');
  if (!Array.isArray(value.nodes) || value.nodes.length > MAX_NODES) throw new TypeError('projection nodes must be a bounded array');
  if (!Array.isArray(value.edges) || value.edges.length > MAX_EDGES) throw new TypeError('projection edges must be a bounded array');
  const nodesById = new Map();
  let previous = null;
  for (const node of value.nodes) {
    validateCompiledNode(node);
    if (nodesById.has(node.id)) throw new TypeError(`duplicate projection node ${node.id}`);
    if (previous !== null && previous.localeCompare(node.id) >= 0) throw new TypeError('projection nodes must be strictly sorted by ID');
    nodesById.set(node.id, node);
    previous = node.id;
  }
  const edgeIds = new Set();
  previous = null;
  for (const edge of value.edges) {
    validateCompiledEdge(edge, nodesById);
    if (edgeIds.has(edge.id)) throw new TypeError(`duplicate projection edge ${edge.id}`);
    if (previous !== null && previous.localeCompare(edge.id) >= 0) throw new TypeError('projection edges must be strictly sorted by ID');
    edgeIds.add(edge.id);
    previous = edge.id;
  }
  const expectedSourceSet = digestObject(canonicalSourceSet(value.nodes, value.edges));
  if (expectedSourceSet !== value.sourceSetDigest) throw new TypeError('sourceSetDigest does not match projection provenance');
  const { graphDigest: _ignored, ...digestable } = value;
  const expectedGraph = digestObject(digestable);
  if (expectedGraph !== value.graphDigest) throw new TypeError('graphDigest does not match the canonical projection');
  return value;
}

function cell(value) {
  if (value === null) return '—';
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function renderIntentGraphMarkdown(value) {
  const graph = validateIntentGraphProjection(value);
  const lines = [
    '# Cambium Intent Graph',
    '',
    '> Read-only projection. This artifact cannot set doctrine, approve work, plan execution, or write the D1 Goal Graph.',
    '',
    `- Schema: \`${graph.schema}\``,
    `- Projection authority: \`${graph.projectionAuthority}\``,
    `- Source-set digest: \`${graph.sourceSetDigest}\``,
    `- Graph digest: \`${graph.graphDigest}\``,
    '',
    '## Authority legend',
    '',
    '| Authority | Meaning |',
    '| --- | --- |',
    '| `vision_anchor` | Root `VISION.md` doctrine |',
    '| `repository_mission` | Root `MISSION.md` renewable doctrine |',
    '| `isa_acceptance` | ISA approved-goal and acceptance authority |',
    '| `gsd_planning` | GSD finite-planning authority |',
    '| `verification_evidence` | Verified repository evidence |',
    '| `historical_learning` | Historical learning reference |',
    '| `derived_reference` | Reference-only overlay |',
    '',
    '## Nodes',
    '',
    '| ID | Kind | Source | Authority | Lifecycle | Completion | Approval | Freshness | Stop | Stop satisfied | Blocked reason | Anchor references |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const node of graph.nodes) {
    const anchors = (node.anchorReferences ?? []).map((reference) => `${reference.path}@${reference.digest}`).join('<br>') || '—';
    lines.push(`| \`${node.id}\` | ${cell(node.kind)} | \`${cell(node.source.path)}#${cell(node.source.selector)}@${node.source.digest}\` | ${cell(node.source.authority)} | ${cell(node.lifecycle)} | ${cell(node.state.completion)} | ${cell(node.state.approval)} | ${cell(node.state.freshness)} | ${cell(node.state.stopCondition.kind)} | ${cell(node.state.stopCondition.satisfied)} | ${cell(node.state.blockedReason)} | ${cell(anchors)} |`);
  }
  lines.push('', '## Edges', '', '| ID | From | Relation | To | Source |', '| --- | --- | --- | --- | --- |');
  for (const edge of graph.edges) {
    lines.push(`| \`${edge.id}\` | \`${edge.from}\` | ${edge.kind} | \`${edge.to}\` | \`${cell(edge.source.path)}#${cell(edge.source.selector)}@${edge.source.digest}\` |`);
  }
  lines.push('', 'The projection contains provenance references and state facts only. Source bodies remain in their owning files.', '');
  return lines.join('\n');
}
