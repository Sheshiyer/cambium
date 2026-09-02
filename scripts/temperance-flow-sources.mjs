import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export const MANIFEST_VERIFICATION_SCHEMA = 'temperance.manifest-verification.v1';
export const MANIFEST_VERIFICATION_ISSUER = 'temperance-manifest-bridge';
export const MANIFEST_VERIFICATION_AUDIENCE = 'cambium-temperance-flow';

const PHASE_DIR = '.planning/phases/05-ralph-and-temperance-flow-projection';
const PLAN_PATHS = [
  `${PHASE_DIR}/05-01-PLAN.md`,
  `${PHASE_DIR}/05-02-PLAN.md`,
  `${PHASE_DIR}/05-03-PLAN.md`,
];
const SUMMARY_PATHS = PLAN_PATHS.map((value) => value.replace('-PLAN.md', '-SUMMARY.md'));
const INTENT_GRAPH_PATH = 'docs/architecture/intent-graph.v1.json';
const FLOW_OUTPUTS = new Set([
  'docs/architecture/temperance-flow.v1.json',
  'docs/architecture/temperance-flow.md',
]);
const REVIEW_OUTPUTS = new Set([
  `${PHASE_DIR}/05-REVIEW.md`,
  `${PHASE_DIR}/05-REVIEW-FIX.md`,
]);
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SAFE_REFERENCE = /^(?:manifest|temperance):[A-Za-z0-9._:/-]+$/;
const SAFE_POINTER = /^(?:manifest|temperance):[A-Za-z0-9._:/-]+$/;
const SECRET_TEXT = /(?:\/Users\/|\/Volumes\/|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|Bearer\s+\S+|\b(?:api[_-]?key|credential|secret|token)[=:][^\s]+)/i;
const replayDigests = new Map();

function canonicalText(value) {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
}

function digestText(value) {
  return `sha256:${createHash('sha256').update(canonicalText(value), 'utf8').digest('hex')}`;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertClosed(value, keys, label) {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
  const extras = Object.keys(value).filter((key) => !keys.includes(key));
  const missing = keys.filter((key) => !(key in value));
  if (extras.length > 0) throw new TypeError(`${label} contains forbidden field(s): ${extras.join(', ')}`);
  if (missing.length > 0) throw new TypeError(`${label} is missing field(s): ${missing.join(', ')}`);
}

function safeText(value, label) {
  if (!nonEmpty(value) || SECRET_TEXT.test(value)) throw new TypeError(`${label} must be non-empty and redacted`);
  return value;
}

function normalizeRelativePath(value) {
  if (!nonEmpty(value) || path.isAbsolute(value) || value.includes('\\') || value.includes('\0')) {
    throw new TypeError('declared source path must be repository-relative POSIX text');
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === '..' || normalized.startsWith('../') || FLOW_OUTPUTS.has(normalized)) {
    throw new TypeError(`source path ${value} is outside the declared source boundary`);
  }
  return normalized;
}

function createReader(repositoryRoot) {
  const root = realpathSync(repositoryRoot);
  if (!statSync(root).isDirectory()) throw new TypeError('repository root must be a directory');
  const read = (relativePath) => {
    const normalized = normalizeRelativePath(relativePath);
    const lexical = path.join(root, ...normalized.split('/'));
    if (!existsSync(lexical)) throw new TypeError(`source ${normalized} is missing`);
    const actual = realpathSync(lexical);
    const relative = path.relative(root, actual);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !statSync(actual).isFile()) {
      throw new TypeError(`source ${normalized} escapes the repository root`);
    }
    return canonicalText(readFileSync(actual, 'utf8'));
  };
  return { root, read };
}

function exactlyOne(matches, label) {
  if (matches.length !== 1) throw new TypeError(`${label} must resolve exactly once; received ${matches.length}`);
  return canonicalText(matches[0]);
}

function frontmatterField(raw, field, relativePath) {
  const lines = canonicalText(raw).split('\n');
  if (lines[0] !== '---') throw new TypeError(`${relativePath} has no frontmatter`);
  const end = lines.indexOf('---', 1);
  if (end < 0) throw new TypeError(`${relativePath} has unterminated frontmatter`);
  const line = exactlyOne(lines.slice(1, end).filter((entry) => entry.startsWith(`${field}:`)), `${relativePath}#frontmatter.${field}`);
  return line.slice(line.indexOf(':') + 1).trim().replace(/^['"]|['"]$/g, '');
}

function frontmatterArray(raw, field) {
  const lines = canonicalText(raw).split('\n');
  const end = lines.indexOf('---', 1);
  const start = lines.slice(1, end).findIndex((entry) => entry.startsWith(`${field}:`));
  if (start < 0) return [];
  const inline = lines[start + 1];
  if (lines[start].includes('[')) {
    return lines[start].slice(lines[start].indexOf('[') + 1, lines[start].lastIndexOf(']')).split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  const values = [];
  for (let index = start + 1; index < end; index += 1) {
    const match = /^\s+-\s+(.+?)\s*$/.exec(lines[index]);
    if (!match) break;
    values.push(match[1]);
  }
  return values;
}

function headingSections(raw, heading) {
  const lines = canonicalText(raw).split('\n');
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index]);
    if (match?.[2] !== heading) continue;
    let end = lines.length - 1;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = /^(#{1,6})\s+/.exec(lines[cursor]);
      if (next && next[1].length <= match[1].length) { end = cursor; break; }
    }
    matches.push(lines.slice(index, end).join('\n'));
  }
  return matches;
}

function select(raw, selector, relativePath) {
  const text = canonicalText(raw);
  if (selector === 'whole-file') return text;
  if (selector.startsWith('frontmatter.')) {
    const field = selector.slice('frontmatter.'.length);
    const lines = text.split('\n');
    const end = lines.indexOf('---', 1);
    return exactlyOne(lines.slice(1, end).filter((line) => line.startsWith(`${field}:`)), `${relativePath}#${selector}`);
  }
  if (selector.startsWith('markdown.heading:')) {
    return exactlyOne(headingSections(text, selector.slice('markdown.heading:'.length)), `${relativePath}#${selector}`);
  }
  if (selector.startsWith('markdown.list-item:')) {
    const prefix = selector.slice('markdown.list-item:'.length);
    return exactlyOne(text.split('\n').filter((line) => line.startsWith(prefix)), `${relativePath}#${selector}`);
  }
  if (selector.startsWith('text.line:')) {
    const prefix = selector.slice('text.line:'.length);
    return exactlyOne(text.split('\n').filter((line) => line.startsWith(prefix)), `${relativePath}#${selector}`);
  }
  if (selector.startsWith('xml.task-name:')) {
    const name = selector.slice('xml.task-name:'.length);
    const matches = [];
    for (const match of text.matchAll(/<task\b[^>]*>[\s\S]*?<\/task>/g)) {
      const names = [...match[0].matchAll(/<name>\s*([^<]+?)\s*<\/name>/g)].map((entry) => entry[1]);
      if (names.length === 1 && names[0] === name) matches.push(match[0]);
    }
    return exactlyOne(matches, `${relativePath}#${selector}`);
  }
  throw new TypeError(`unsupported source selector ${relativePath}#${selector}`);
}

function phase5AcceptanceSelection(raw) {
  const allowed = ['Active Phase 5 acceptance', 'Completed Phase 5 acceptance'];
  const matches = allowed.flatMap((heading) => headingSections(raw, heading).map((content) => ({ heading, content })));
  if (matches.length !== 1) {
    throw new TypeError(`ISA.md Phase 5 acceptance must resolve exactly once as Active or Completed; received ${matches.length}`);
  }
  const phase6Headings = ['Active Phase 6 acceptance', 'Completed Phase 6 acceptance']
    .flatMap((heading) => headingSections(raw, heading));
  if (phase6Headings.length > 1) {
    throw new TypeError(`ISA.md Phase 6 acceptance must resolve at most once; received ${phase6Headings.length}`);
  }
  if (phase6Headings.length === 1 && matches[0].heading !== 'Completed Phase 5 acceptance') {
    throw new TypeError('ISA.md Phase 5 acceptance must be Completed once Phase 6 acceptance exists');
  }
  return {
    selector: `markdown.heading:${matches[0].heading}`,
    content: matches[0].content,
  };
}

function sourceReference(reader, relativePath, kind, selector) {
  const raw = reader.read(relativePath);
  return { path: relativePath, kind, selector, digest: digestText(select(raw, selector, relativePath)) };
}

function normalizedHandoffCheckpoint(value) {
  return canonicalText(value)
    .replace(/(`implementation_head` is `)[a-f0-9]{40}(`)/, '$1<reviewed-implementation-head>$2')
    .replace(/^(- Generated (?:flowDigest|sourceSetDigest): )sha256:[a-f0-9]{64}$/gm, '$1<reviewed-generated-digest>');
}

function reviewedHandoffReference(reader, selector, checkpoint) {
  return {
    path: '.project/HANDOFF.md',
    kind: 'reviewed_handoff',
    selector,
    digest: digestText(normalizedHandoffCheckpoint(checkpoint)),
  };
}

function latestImplementationHead(repositoryRoot) {
  if (!existsSync(path.join(repositoryRoot, '.git'))) return null;
  const result = spawnSync('/usr/bin/git', [
    '-C', repositoryRoot, 'log', '-1', '--format=%H', '--', '.',
    ':(exclude).project/HANDOFF.md',
    ...[...FLOW_OUTPUTS, ...REVIEW_OUTPUTS].map((pathname) => `:(exclude)${pathname}`),
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const head = result.status === 0 ? result.stdout.trim() : '';
  return /^[a-f0-9]{40}$/.test(head) ? head : null;
}

function trackedImplementationChanges(repositoryRoot) {
  if (!existsSync(path.join(repositoryRoot, '.git'))) return [];
  const result = spawnSync('/usr/bin/git', [
    '-C', repositoryRoot, 'diff', '--name-only', '--relative', 'HEAD', '--', '.',
    ':(exclude).project/HANDOFF.md',
    ...[...FLOW_OUTPUTS, ...REVIEW_OUTPUTS].map((pathname) => `:(exclude)${pathname}`),
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) return ['<git-diff-unavailable>'];
  return result.stdout.split(/\r?\n/).filter(nonEmpty).sort();
}

function reviewedCheckpointBindings(repositoryRoot, checkpoint, reference) {
  const implementationHead = /`implementation_head` is `([a-f0-9]{40})`/.exec(checkpoint)?.[1] ?? null;
  const flowDigest = /^- Generated flowDigest: (sha256:[a-f0-9]{64})$/m.exec(checkpoint)?.[1] ?? null;
  const sourceSetDigest = /^- Generated sourceSetDigest: (sha256:[a-f0-9]{64})$/m.exec(checkpoint)?.[1] ?? null;
  const currentHead = latestImplementationHead(repositoryRoot);
  if (currentHead === null) return { enforceable: false, matches: true };
  const projectionPath = path.join(repositoryRoot, 'docs/architecture/temperance-flow.v1.json');
  let projection = null;
  try { projection = JSON.parse(readFileSync(projectionPath, 'utf8')); } catch { /* missing or malformed is stale */ }
  return {
    enforceable: true,
    matches: implementationHead === currentHead
      && trackedImplementationChanges(repositoryRoot).length === 0
      && projection?.flowDigest === flowDigest
      && projection?.sourceSetDigest === sourceSetDigest
      && projection?.references?.supporting?.some((candidate) => candidate.path === reference.path
        && candidate.kind === reference.kind && candidate.selector === reference.selector
        && candidate.digest === reference.digest),
  };
}

function parseTasks(raw, relativePath) {
  const tasks = [];
  let index = 0;
  for (const match of canonicalText(raw).matchAll(/<task\b[^>]*>[\s\S]*?<\/task>/g)) {
    const names = [...match[0].matchAll(/<name>\s*([^<]+?)\s*<\/name>/g)].map((entry) => entry[1]);
    if (names.length !== 1) throw new TypeError(`${relativePath} task ${index + 1} must have exactly one name`);
    tasks.push({ index: index + 1, name: names[0] });
    index += 1;
  }
  if (tasks.length === 0) throw new TypeError(`${relativePath} must declare at least one task`);
  return tasks;
}

function phasePlanIdentity(relativePath) {
  const match = /\/05-(\d\d)-PLAN\.md$/.exec(relativePath);
  if (!match) throw new TypeError(`invalid Phase 5 plan path ${relativePath}`);
  return `05-${match[1]}`;
}

function receiptExpectedShape(expected) {
  assertClosed(expected, ['now', 'receiptRef', 'taskId', 'projectionDigest', 'command', 'route'], 'Manifest verification expectation');
  if (!SAFE_REFERENCE.test(expected.receiptRef) || !DIGEST.test(expected.projectionDigest)) throw new TypeError('Manifest expectation is not bound');
  safeText(expected.taskId, 'expected task');
  safeText(expected.command, 'expected command');
  assertClosed(expected.route, ['skillCluster', 'combo', 'lane'], 'expected route');
  const now = Date.parse(expected.now);
  if (!Number.isFinite(now)) throw new TypeError('Manifest expectation now must be an ISO timestamp');
  return now;
}

export function normalizeVerifiedManifestResult(value, expected) {
  assertClosed(value, [
    'schema', 'verified', 'issuer', 'audience', 'issuedAt', 'expiresAt', 'nonce', 'status',
    'receiptRef', 'evidencePointer', 'taskId', 'projectionDigest', 'command', 'route',
    'attribution', 'payloadDigest',
  ], 'Manifest verification result');
  const now = receiptExpectedShape(expected);
  if (value.schema !== MANIFEST_VERIFICATION_SCHEMA || value.verified !== true || value.status !== 'verified') {
    throw new TypeError('Manifest result must be verified under temperance.manifest-verification.v1');
  }
  if (value.issuer !== MANIFEST_VERIFICATION_ISSUER) throw new TypeError('Manifest issuer is not the fixed verifier boundary');
  if (value.audience !== MANIFEST_VERIFICATION_AUDIENCE) throw new TypeError('Manifest audience is not Cambium');
  const issuedAt = Date.parse(value.issuedAt);
  const expiresAt = Date.parse(value.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || issuedAt > now) throw new TypeError('Manifest result is future-dated');
  if (expiresAt <= now || expiresAt <= issuedAt || expiresAt - issuedAt > 60 * 60 * 1000) throw new TypeError('Manifest result is stale or has an unbounded freshness window');
  if (!nonEmpty(value.nonce) || !DIGEST.test(value.payloadDigest)) throw new TypeError('Manifest replay identity or payload digest is invalid');
  if (value.receiptRef !== expected.receiptRef || value.taskId !== expected.taskId
      || value.projectionDigest !== expected.projectionDigest || value.command !== expected.command) {
    throw new TypeError('Manifest result is not bound to the expected receipt, task, projection, and command');
  }
  assertClosed(value.route, ['skillCluster', 'combo', 'lane'], 'Manifest route');
  if (value.route.skillCluster !== expected.route.skillCluster || value.route.combo !== expected.route.combo || value.route.lane !== expected.route.lane) {
    throw new TypeError('Manifest result is not bound to the expected route');
  }
  assertClosed(value.attribution, ['provider', 'model'], 'Manifest attribution');
  const provider = safeText(value.attribution.provider, 'Manifest provider');
  const model = safeText(value.attribution.model, 'Manifest model');
  if (!SAFE_POINTER.test(value.evidencePointer)) throw new TypeError('Manifest evidence pointer must be a bounded opaque reference');
  const priorDigest = replayDigests.get(value.nonce);
  if (priorDigest && priorDigest !== value.payloadDigest) throw new TypeError('Manifest replay conflict for nonce and payload digest');
  replayDigests.set(value.nonce, value.payloadDigest);
  return {
    status: 'verified',
    freshness: 'fresh',
    receiptRef: value.receiptRef,
    taskId: value.taskId,
    command: value.command,
    route: { ...value.route },
    observedAt: new Date(issuedAt).toISOString(),
    ageSeconds: Math.floor((now - issuedAt) / 1000),
    evidencePointer: value.evidencePointer,
    attribution: { provider, model },
  };
}

export function buildTemperanceFlowSources(repositoryRoot, options = {}) {
  const allowed = ['receiptReference', 'receiptVerification'];
  if (!isRecord(options)) throw new TypeError('source adapter options must be an object');
  const extras = Object.keys(options).filter((key) => !allowed.includes(key));
  if (extras.length > 0) throw new TypeError(`source adapter options contain forbidden field(s): ${extras.join(', ')}`);
  const reader = createReader(repositoryRoot);
  const isaRaw = reader.read('ISA.md');
  const stateRaw = reader.read('.planning/STATE.md');
  const handoffRaw = reader.read('.project/HANDOFF.md');
  const goal = frontmatterField(isaRaw, 'task', 'ISA.md');
  const isaGoalSelector = 'frontmatter.task';
  const { selector: isaAcceptanceSelector, content: isaAcceptance } = phase5AcceptanceSelection(isaRaw);
  const isaDecisionSelector = 'markdown.list-item:- 2026-08-19 11:06: refined:';
  const isaDecision = select(isaRaw, isaDecisionSelector, 'ISA.md');
  const isaApproved = ['ISC-1282', 'ISC-1283', 'ISC-1284', 'ISC-1285'].every((id) => new RegExp(`^- \\[(?:x| )\\] ${id}:`, 'm').test(isaAcceptance))
    && /Phase 5 is an authority-resolution projection/.test(isaDecision);
  const nextSection = exactlyOne(headingSections(stateRaw, 'Operator Next Step'), '.planning/STATE.md#Operator Next Step');
  const commands = [...nextSection.matchAll(/`(\/gsd:[^`]+)`/g)].map((entry) => entry[1]);
  const command = commands.length === 1 ? commands[0] : '/gsd:execute-phase 5';
  const transition = /^\/gsd:([a-z-]+)/.exec(command)?.[1]?.replace('-phase', '') ?? 'unknown';
  const statePhaseSelector = 'text.line:Phase:';
  const statePhase = select(stateRaw, statePhaseSelector, '.planning/STATE.md');
  const stateLive = commands.length === 1 && /^Phase: 5 of 7 \(/.test(statePhase);
  const handoffHeadings = [...handoffRaw.matchAll(/^###\s+(.+)$/gm)].map((match) => match[1]);
  // HANDOFF is newest-first. Select the first Phase 5 checkpoint so later
  // phase entries cannot shadow it and newer Phase 5 review fixes supersede
  // older Phase 5 checkpoints without relying on global first-heading order.
  const phase5HandoffHeading = handoffHeadings.find((heading) => (
    /Phase 5 decisions and reviewed planning checkpoint/.test(heading)
  ));
  if (!phase5HandoffHeading) {
    throw new TypeError('.project/HANDOFF.md has no reviewed Phase 5 checkpoint');
  }
  const handoffSelector = `markdown.heading:${phase5HandoffHeading}`;
  const handoffCheckpoint = select(handoffRaw, handoffSelector, '.project/HANDOFF.md');
  const handoffReference = reviewedHandoffReference(reader, handoffSelector, handoffCheckpoint);
  const handoffBindings = reviewedCheckpointBindings(reader.root, handoffCheckpoint, handoffReference);
  const handoffReviewed = /Phase 5 decisions and reviewed planning checkpoint/.test(handoffCheckpoint)
    && !/unreviewed/i.test(phase5HandoffHeading)
    && handoffBindings.matches;

  const planRecords = PLAN_PATHS.map((relativePath, planIndex) => {
    const raw = reader.read(relativePath);
    const identity = phasePlanIdentity(relativePath);
    const summaryPath = SUMMARY_PATHS[planIndex];
    const summaryExists = existsSync(path.join(reader.root, summaryPath));
    const completionSource = summaryExists
      ? sourceReference(reader, summaryPath, 'verification_evidence', 'markdown.heading:Self-Check: PASSED')
      : null;
    const complete = completionSource !== null;
    return {
      relativePath,
      raw,
      identity,
      plan: frontmatterField(raw, 'plan', relativePath).padStart(2, '0'),
      phase: frontmatterField(raw, 'phase', relativePath),
      dependsOn: frontmatterArray(raw, 'depends_on'),
      tasks: parseTasks(raw, relativePath),
      summaryPath,
      completionSource,
      complete,
    };
  });
  const incomplete = planRecords.filter(({ complete }) => !complete);
  const active = incomplete[0] ?? planRecords.at(-1);
  const receiptReference = options.receiptReference ?? null;
  if (receiptReference !== null && !SAFE_REFERENCE.test(receiptReference)) throw new TypeError('receipt reference must be a bounded opaque Manifest reference');

  const activePlanSource = sourceReference(reader, active.relativePath, 'active_plan', 'whole-file');
  const incompleteIdentities = new Set(incomplete.map(({ identity }) => identity));
  const phaseDependencies = [...new Set(incomplete.flatMap(({ dependsOn }) => dependsOn))]
    .filter((identity) => !incompleteIdentities.has(identity));
  const planDependencies = phaseDependencies.map((identity) => {
    const dependency = planRecords.find((candidate) => candidate.identity === identity);
    return { id: `phase5-plan${dependency?.plan ?? identity.slice(3)}`, status: dependency?.complete ? 'complete' : 'pending' };
  });
  const phaseDependenciesSatisfied = planDependencies.every(({ status }) => status === 'complete');
  const phaseUnitName = `Remaining Phase 5 execution (${incomplete.map(({ identity }) => identity).join(', ')})`;
  const tasks = incomplete.length === 0 ? [] : [{
    id: 'phase5-remaining-plans',
    name: phaseUnitName,
    source: activePlanSource,
    status: phaseDependenciesSatisfied && handoffReviewed ? 'ready' : 'pending',
    dependencies: planDependencies,
    command: '/gsd:execute-phase 5',
    route: {
      skillCluster: 'gsd-execute-phase',
      combo: 'te-dispatch-paid',
      lane: 'paid_execution',
      approvalRequired: true,
      receiptRef: receiptReference,
    },
    gates: [
      ...incomplete.map((record) => ({
        kind: 'declared_verification',
        source: sourceReference(reader, record.relativePath, 'verification_evidence', 'whole-file'),
        satisfied: false,
      })),
      { kind: 'approval_boundary', source: activePlanSource, satisfied: false },
    ],
    stop: { kind: 'external_verification', source: activePlanSource, satisfied: false },
  }];

  const intentGraphRaw = reader.read(INTENT_GRAPH_PATH);
  const intentGraph = JSON.parse(intentGraphRaw);
  if (intentGraph.schema !== 'cambium.intent-graph-projection.v1' || !DIGEST.test(intentGraph.graphDigest)) {
    throw new TypeError('Intent Graph reference is malformed');
  }
  const supportingSources = [
    sourceReference(reader, 'ISA.md', 'verification_evidence', isaAcceptanceSelector),
    sourceReference(reader, 'ISA.md', 'verification_evidence', isaDecisionSelector),
    sourceReference(reader, '.planning/STATE.md', 'verification_evidence', statePhaseSelector),
    handoffReference,
    ...incomplete.map((record) => sourceReference(reader, record.relativePath, 'verification_evidence', 'whole-file')),
    ...planRecords.filter(({ completionSource }) => completionSource).map(({ completionSource }) => completionSource),
  ];

  return {
    authorities: {
      isa: {
        source: sourceReference(reader, 'ISA.md', 'isa_goal', isaGoalSelector),
        status: isaApproved ? 'approved' : 'unapproved',
        goal,
      },
      gsd: {
        source: sourceReference(reader, '.planning/STATE.md', 'gsd_state', 'markdown.heading:Operator Next Step'),
        status: stateLive ? 'live' : 'stale',
        phase: '05-ralph-and-temperance-flow-projection',
        transition,
        command,
      },
      plan: {
        source: activePlanSource,
        status: incomplete.length > 0 ? 'active' : 'terminal',
        phase: active.phase,
        plan: active.plan,
      },
    },
    supportingSources,
    intentGraphRef: {
      path: INTENT_GRAPH_PATH,
      schema: intentGraph.schema,
      digest: digestText(intentGraphRaw),
    },
    tasks,
    receiptVerification: options.receiptVerification ?? null,
  };
}
