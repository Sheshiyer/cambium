import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { buildDocumentationInventorySources } from './documentation-inventory-sources.mjs';
import { canonicalText, digestText, selectIntentGraphContent } from './intent-graph.mjs';
import { redactReviewedHandoffForDigest, selectTemperanceFlowContent } from './temperance-flow.mjs';

export const DETERMINISTIC_SAFETY_SCHEMA = 'cambium.deterministic-safety.v1';
export const DETERMINISTIC_SAFETY_AUTHORITY = 'read_only';
export const DETERMINISTIC_SAFETY_GATES = Object.freeze(['SAFE-01', 'SAFE-02', 'SAFE-03']);

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/;
const GIT_OBJECT_ID = /^[0-9a-f]{40,64}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const UNIX_USER_ROOT = ['/', 'Users/'].join('');
const UNIX_VOLUME_ROOT = ['/', 'Volumes/'].join('');
const PROMPT_BODY_TOKEN = ['prompt', 'Body='].join('');
const REQUEST_BODY_TOKEN = ['request', 'Body='].join('');
const RESPONSE_BODY_TOKEN = ['response', 'Body='].join('');
const FOLDED_PARAGRAPH_MIN = 80;
const ANCHOR_PATHS = new Set(['VISION.md', 'MISSION.md']);
const ALLOWED_CLAIMANTS = new Set(['ISA.md', '.planning/STATE.md']);
const D05_SURFACES = Object.freeze([
  'docs/architecture/intent-graph.v1.json',
  'docs/architecture/intent-graph.md',
  'docs/architecture/temperance-flow.v1.json',
  'docs/architecture/temperance-flow.md',
  'PROJECT.md',
  'README.md',
  'docs/README.md',
  'docs/doctrine/README.md',
  'docs/LIFECYCLE.md',
  '.planning/README.md',
  'INFINITE-GAME.md',
]);
const EXTRA_SAFE02_SURFACES = Object.freeze(['.temperance/project.json']);
const GENERATED_PROJECTIONS = Object.freeze([
  'docs/architecture/intent-graph.v1.json',
  'docs/architecture/intent-graph.md',
  'docs/architecture/temperance-flow.v1.json',
  'docs/architecture/temperance-flow.md',
]);
const ILLEGAL_ROLES = new Set(['sole_operational_writer', 'planning authority', 'goal-setting']);
const RALPH_WRITER_FIELDS = new Set(['queue', 'dispatch', 'selfCertified']);
const LOCKED_PHRASES = ['source of record', 'planning authority', 'goal-setting'];
const FORBIDDEN_RECEIPT_KEYS = new Set([
  'write', 'fix', 'output', 'outputFile', 'queue', 'dispatch', 'command', 'relocate', 'delete',
]);
const RECEIPT_KEYS = [
  'schema',
  'projectionAuthority',
  'sourceRevision',
  'entryCount',
  'corpusPaths',
  'rootMemoryTracked',
  'hits',
  'sourceSetDigest',
  'safetyDigest',
];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareBytes(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function sameArray(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value)
    .sort(compareBytes)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(',')}}`;
}

function digestObject(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function assertRecord(value, label) {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
}

function assertClosed(value, allowed, label) {
  assertRecord(value, label);
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !(key in value));
  if (extras.length > 0) throw new TypeError(`${label} contains forbidden field(s): ${extras.join(', ')}`);
  if (missing.length > 0) throw new TypeError(`${label} is missing field(s): ${missing.join(', ')}`);
}

function rejectForbiddenDeep(value, label = 'deterministic safety receipt') {
  if (Array.isArray(value)) {
    value.forEach((entry) => rejectForbiddenDeep(entry, label));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_RECEIPT_KEYS.has(key)) throw new TypeError(`${label} contains forbidden field ${key}`);
    rejectForbiddenDeep(nested, `${label}.${key}`);
  }
}

function repositoryRoot(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw new TypeError('repositoryRoot must be an absolute directory path');
  }
  const resolved = realpathSync(value);
  if (!statSync(resolved).isDirectory()) throw new TypeError('repositoryRoot must resolve to a directory');
  return resolved;
}

function runGit(root, args, { encoding = 'utf8' } = {}) {
  const result = spawnSync('/usr/bin/git', [
    '--no-replace-objects',
    '--no-optional-locks',
    '-C', root,
    ...args,
  ], {
    encoding: encoding === null ? null : encoding,
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' },
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const diagnostic = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : result.stderr;
    const bounded = String(diagnostic || 'Git object lookup failed').trim().split(/\r?\n/, 1)[0].slice(0, 240);
    throw new TypeError(`Git revision read failed: ${bounded}`);
  }
  return result.stdout;
}

function gitExists(root, sha, relativePath) {
  const result = spawnSync('/usr/bin/git', [
    '--no-replace-objects',
    '--no-optional-locks',
    '-C', root,
    'cat-file', '-e', `${sha}:${relativePath}`,
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' },
  });
  return result.status === 0;
}

function parseTree(raw) {
  const records = [];
  for (const record of String(raw).split('\0').filter(Boolean)) {
    const separator = record.indexOf('\t');
    if (separator < 0) throw new TypeError('Git tree record is malformed');
    const [mode, type, objectId] = record.slice(0, separator).split(' ');
    const relativePath = record.slice(separator + 1);
    if (!/^\d{6}$/.test(mode) || !['blob', 'tree', 'commit'].includes(type) || !GIT_OBJECT_ID.test(objectId)) {
      throw new TypeError(`Git tree metadata is invalid for ${relativePath}`);
    }
    records.push({ mode, type, objectId, path: relativePath });
  }
  return records;
}

function enumerateCorpusPaths(root, sha) {
  const rootTree = parseTree(runGit(root, ['ls-tree', '-z', '--full-tree', sha]));
  const scopedTree = parseTree(runGit(root, ['ls-tree', '-r', '-z', '--full-tree', sha, '--', 'docs', '.planning']));
  return [
    ...rootTree.filter((entry) => entry.type === 'blob' && !entry.path.includes('/') && entry.path.endsWith('.md')),
    ...scopedTree.filter((entry) => entry.type === 'blob'),
  ]
    .map((entry) => entry.path)
    .sort(compareBytes);
}

function contentKind(value) {
  if (value.includes(0)) return 'binary';
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(value);
    return 'text';
  } catch {
    return 'binary';
  }
}

function decodeText(buffer) {
  return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
}

function foldText(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isAtxHeadingLine(line) {
  return /^#{1,6}\s+\S/.test(line.trim());
}

function isLinkOnlyLine(line) {
  const stripped = line.trim().replace(/^[-*+]\s+/, '');
  return /^\[[^\]]*\]\([^)]+\)$/.test(stripped) || /^\[[^\]]*\]:\s*\S+$/.test(stripped);
}

function extractDoctrineParagraphs(raw) {
  const paragraphs = [];
  for (const block of canonicalText(raw).split(/\n{2,}/)) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (lines.every(isAtxHeadingLine)) continue;
    const kept = lines.filter((line) => !isAtxHeadingLine(line) && !isLinkOnlyLine(line));
    if (kept.length === 0) continue;
    const folded = foldText(kept.join(' '));
    if (folded.length < FOLDED_PARAGRAPH_MIN) continue;
    paragraphs.push(folded);
  }
  return paragraphs;
}

function foldBodyForMatch(raw) {
  const kept = canonicalText(raw)
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return false;
      if (isAtxHeadingLine(trimmed) || isLinkOnlyLine(trimmed)) return false;
      return true;
    });
  return foldText(kept.join(' '));
}

function fail(gate, relativePath, detail = '') {
  const suffix = detail ? ` ${detail}` : '';
  throw new TypeError(`${gate}: ${relativePath}${suffix}`);
}

function scanSafe01(blobs) {
  const anchors = new Map();
  for (const pathName of ANCHOR_PATHS) {
    const blob = blobs.get(pathName);
    if (!blob || blob.contentKind !== 'text') {
      throw new TypeError(`SAFE-01: missing text anchor ${pathName}`);
    }
    anchors.set(pathName, extractDoctrineParagraphs(blob.text));
  }
  for (const [relativePath, blob] of blobs) {
    if (ANCHOR_PATHS.has(relativePath) || blob.contentKind !== 'text') continue;
    const folded = foldBodyForMatch(blob.text);
    for (const [anchorPath, paragraphs] of anchors) {
      for (const paragraph of paragraphs) {
        if (folded.includes(paragraph)) fail('SAFE-01', relativePath, `copied ${anchorPath} paragraph`);
      }
    }
  }
}

function parseJsonIfPossible(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function claimSourceOfTruth(value) {
  if (typeof value !== 'string') return false;
  return /\bISA(?:\.md)?\b|\bGSD\b/i.test(value);
}

function scanJsonAuthority(value, relativePath) {
  if (Array.isArray(value)) {
    value.forEach((entry) => scanJsonAuthority(entry, relativePath));
    return;
  }
  if (!isRecord(value)) return;
  if ('projectionAuthority' in value && value.projectionAuthority !== DETERMINISTIC_SAFETY_AUTHORITY) {
    fail('SAFE-02', relativePath, 'projectionAuthority must remain read_only');
  }
  if ('role' in value && ILLEGAL_ROLES.has(value.role)) {
    fail('SAFE-02', relativePath, `illegal role ${value.role}`);
  }
  if ('active_planner' in value && value.active_planner !== 'isa' && value.active_planner !== 'gsd') {
    fail('SAFE-02', relativePath, 'active_planner must be isa, gsd, or omitted');
  }
  if ('sourceOfTruth' in value && claimSourceOfTruth(value.sourceOfTruth)) {
    fail('SAFE-02', relativePath, 'sourceOfTruth claims ISA/GSD');
  }
  if (value.schema === 'cambium.ralph-iteration.v1'
      || [...RALPH_WRITER_FIELDS].some((field) => field in value)) {
    if ([...RALPH_WRITER_FIELDS].some((field) => field in value)) {
      fail('SAFE-02', relativePath, 'Ralph writer fields are forbidden');
    }
  }
  for (const nested of Object.values(value)) scanJsonAuthority(nested, relativePath);
}

function isDenialLine(line) {
  return /\b(?:never|not|no|cannot|don't|does not|do not)\b.{0,80}\b(?:planning authority|source of record|goal-setting)\b/i.test(line)
    || /\b(?:planning authority|source of record|goal-setting)\b.{0,80}\b(?:never|not granted|is not|are not)\b/i.test(line);
}

function isLegendLine(line) {
  return /`gsd_planning`/.test(line) || /gsd_planning/.test(line);
}

function isAttributedLine(line) {
  return /ISA\.md/.test(line) || /\.planning\/STATE\.md/.test(line) || /\.planning\//.test(line) || /\bGSD\b/.test(line);
}

function isSelfClaimLine(line) {
  return /this (?:file|manifest|projection|overlay|document).{0,80}(?:is|owns|claims).{0,80}(?:planning authority|source of record|goal-setting)/i.test(line)
    || /this file is the planning authority/i.test(line);
}

function scanProseAuthority(text, relativePath) {
  for (const line of String(text).split(/\r?\n/)) {
    const lower = line.toLowerCase();
    if (!LOCKED_PHRASES.some((phrase) => lower.includes(phrase))) continue;
    if (isDenialLine(line) || isLegendLine(line) || isAttributedLine(line)) continue;
    if (isSelfClaimLine(line) || LOCKED_PHRASES.some((phrase) => lower.includes(phrase))) {
      fail('SAFE-02', relativePath, 'unattributed or self-claimed authority phrase');
    }
  }
}

function scanSafe02(root, sha, blobs) {
  const surfaces = [...D05_SURFACES, ...EXTRA_SAFE02_SURFACES];
  for (const relativePath of surfaces) {
    if (ALLOWED_CLAIMANTS.has(relativePath)) continue;
    let text = null;
    if (blobs.has(relativePath) && blobs.get(relativePath).contentKind === 'text') {
      text = blobs.get(relativePath).text;
    } else if (EXTRA_SAFE02_SURFACES.includes(relativePath) && gitExists(root, sha, relativePath)) {
      const body = runGit(root, ['show', `${sha}:${relativePath}`], { encoding: null });
      if (contentKind(body) !== 'text') continue;
      text = decodeText(body);
    } else {
      continue;
    }
    const parsed = parseJsonIfPossible(text);
    if (parsed !== null) scanJsonAuthority(parsed, relativePath);
    scanProseAuthority(text, relativePath);
  }
}

function showText(root, sha, relativePath) {
  const body = runGit(root, ['show', `${sha}:${relativePath}`], { encoding: null });
  if (contentKind(body) !== 'text') fail('SAFE-03', relativePath, 'source blob is not text');
  return decodeText(body);
}

function checkDeclaredDigest(root, sha, source, label) {
  if (!isRecord(source) || typeof source.path !== 'string' || typeof source.selector !== 'string' || typeof source.digest !== 'string') {
    return;
  }
  const identity = `${source.path}#${source.selector}`;
  if (!DIGEST.test(source.digest)) fail('SAFE-03', identity, 'recorded digest is invalid');
  let selected;
  try {
    selected = label === 'temperance'
      ? selectTemperanceFlowContent(showText(root, sha, source.path), source.selector)
      : selectIntentGraphContent(showText(root, sha, source.path), source.selector);
  } catch (error) {
    fail('SAFE-03', identity, error instanceof Error ? error.message : 'selector recompute failed');
  }
  const digestable = source.kind === 'reviewed_handoff'
    ? redactReviewedHandoffForDigest(selected)
    : selected;
  if (digestText(digestable) !== source.digest) fail('SAFE-03', identity, 'recorded digest does not match');
}

function walkIntentSources(value, visit) {
  if (Array.isArray(value)) {
    value.forEach((entry) => walkIntentSources(entry, visit));
    return;
  }
  if (!isRecord(value)) return;
  if (isRecord(value.source) && typeof value.source.digest === 'string' && typeof value.source.selector === 'string') {
    visit(value.source);
  }
  if (Array.isArray(value.anchorReferences)) {
    for (const anchor of value.anchorReferences) {
      if (isRecord(anchor) && typeof anchor.path === 'string' && typeof anchor.digest === 'string') {
        visit({ path: anchor.path, selector: 'whole-file', digest: anchor.digest });
      }
    }
  }
  for (const nested of Object.values(value)) walkIntentSources(nested, visit);
}

function walkTemperanceSources(value, visit) {
  if (Array.isArray(value)) {
    value.forEach((entry) => walkTemperanceSources(entry, visit));
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.path === 'string' && typeof value.selector === 'string' && typeof value.digest === 'string') {
    visit(value);
  }
  for (const nested of Object.values(value)) walkTemperanceSources(nested, visit);
}

function scanFreshness(root, sha, blobs) {
  const intentJson = blobs.get('docs/architecture/intent-graph.v1.json');
  if (intentJson && intentJson.contentKind === 'text') {
    const parsed = parseJsonIfPossible(intentJson.text);
    if (isRecord(parsed)) {
      walkIntentSources(parsed, (source) => checkDeclaredDigest(root, sha, source, 'intent'));
    }
  }
  const flowJson = blobs.get('docs/architecture/temperance-flow.v1.json');
  if (flowJson && flowJson.contentKind === 'text') {
    const parsed = parseJsonIfPossible(flowJson.text);
    if (isRecord(parsed)) {
      walkTemperanceSources(parsed.references ?? parsed, (source) => checkDeclaredDigest(root, sha, source, 'temperance'));
      const intentRef = parsed.references?.intentGraph;
      if (isRecord(intentRef) && typeof intentRef.path === 'string' && typeof intentRef.digest === 'string') {
        const body = runGit(root, ['show', `${sha}:${intentRef.path}`], { encoding: null });
        if (digestText(decodeText(body)) !== intentRef.digest) {
          fail('SAFE-03', `${intentRef.path}#whole-file`, 'Intent Graph digest does not match');
        }
      }
    }
  }
}

function hasPrivacyLeak(text) {
  if (text.includes(UNIX_USER_ROOT) || text.includes(UNIX_VOLUME_ROOT)) return true;
  if (text.includes(PROMPT_BODY_TOKEN) || text.includes(REQUEST_BODY_TOKEN) || text.includes(RESPONSE_BODY_TOKEN)) return true;
  if (/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/.test(text)) return true;
  if (/\bBearer\s+[A-Za-z0-9._~-]{8,}/.test(text)) return true;
  if (/\bnativeSessionId\s*[:=]/.test(text)) return true;
  return false;
}

function scanPrivacy(blobs) {
  for (const relativePath of GENERATED_PROJECTIONS) {
    const blob = blobs.get(relativePath);
    if (!blob || blob.contentKind !== 'text') continue;
    if (hasPrivacyLeak(blob.text)) fail('SAFE-03', relativePath, 'privacy token');
  }
}

export function validateDeterministicSafetyReceipt(value) {
  rejectForbiddenDeep(value);
  assertClosed(value, RECEIPT_KEYS, 'deterministic safety receipt');
  if (value.schema !== DETERMINISTIC_SAFETY_SCHEMA) {
    throw new TypeError(`schema must equal ${DETERMINISTIC_SAFETY_SCHEMA}`);
  }
  if (value.projectionAuthority !== DETERMINISTIC_SAFETY_AUTHORITY) {
    throw new TypeError('deterministic safety authority must remain read_only');
  }
  if (!FULL_COMMIT_SHA.test(value.sourceRevision)) {
    throw new TypeError('sourceRevision must be a full lowercase 40-hex commit SHA');
  }
  if (!Number.isSafeInteger(value.entryCount) || value.entryCount < 0) {
    throw new TypeError('entryCount must be a non-negative integer');
  }
  if (!Array.isArray(value.corpusPaths) || !sameArray(value.corpusPaths, [...value.corpusPaths].sort(compareBytes))) {
    throw new TypeError('corpusPaths must be a bytewise-sorted unique array');
  }
  if (value.entryCount !== value.corpusPaths.length) {
    throw new TypeError('entryCount must equal corpusPaths length');
  }
  if (typeof value.rootMemoryTracked !== 'boolean') throw new TypeError('rootMemoryTracked must be boolean');
  if (!Array.isArray(value.hits) || value.hits.length !== 0) {
    throw new TypeError('successful safety receipt must have empty hits');
  }
  if (!DIGEST.test(value.sourceSetDigest) || !DIGEST.test(value.safetyDigest)) {
    throw new TypeError('safety receipt digests are invalid');
  }
  const { safetyDigest: _ignored, ...withoutDigest } = value;
  if (digestObject(withoutDigest) !== value.safetyDigest) {
    throw new TypeError('safetyDigest does not match canonical receipt facts');
  }
  return value;
}

export function compileDeterministicSafety(input) {
  assertClosed(input, ['repositoryRoot', 'sourceRevision'], 'deterministic safety input');
  const root = repositoryRoot(input.repositoryRoot);
  const sources = buildDocumentationInventorySources({
    repositoryRoot: root,
    sourceRevision: input.sourceRevision,
  });
  const resolved = sources.sourceRevision;
  if (!FULL_COMMIT_SHA.test(resolved)) {
    throw new TypeError('sourceRevision must resolve exactly once to a full commit SHA');
  }
  const independent = enumerateCorpusPaths(root, resolved);
  if (!sameArray(independent, sources.corpusPaths)) {
    throw new TypeError('SAFE-01: independently enumerated corpusPaths must equal inventory path set');
  }

  const blobs = new Map();
  for (const relativePath of sources.corpusPaths) {
    const body = runGit(root, ['show', `${resolved}:${relativePath}`], { encoding: null });
    const kind = contentKind(body);
    blobs.set(relativePath, {
      contentKind: kind,
      text: kind === 'text' ? decodeText(body) : null,
    });
  }

  scanSafe01(blobs);
  scanSafe02(root, resolved, blobs);
  scanFreshness(root, resolved, blobs);
  scanPrivacy(blobs);

  const withoutDigest = {
    schema: DETERMINISTIC_SAFETY_SCHEMA,
    projectionAuthority: DETERMINISTIC_SAFETY_AUTHORITY,
    sourceRevision: resolved,
    entryCount: sources.corpusPaths.length,
    corpusPaths: [...sources.corpusPaths],
    rootMemoryTracked: sources.rootMemoryTracked,
    hits: [],
    sourceSetDigest: digestObject({
      sourceRevision: resolved,
      corpusPaths: sources.corpusPaths,
      rootMemoryTracked: sources.rootMemoryTracked,
    }),
  };
  return validateDeterministicSafetyReceipt({
    ...withoutDigest,
    safetyDigest: digestObject(withoutDigest),
  });
}
