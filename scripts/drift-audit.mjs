#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PUBLIC_ACTION_REQUEST_KEYS = new Set([
  'schema', 'id', 'tenantId', 'status', 'branchId', 'branchLabel', 'projectId',
  'projectName', 'questId', 'topic', 'title', 'summary', 'why', 'source',
  'redaction', 'createdAt', 'updatedAt', 'selectedOptionId', 'next', 'evidence',
  'consequence', 'approveConsequence', 'rerollConsequence', 'reversibility',
  'idempotencyHint', 'owner', 'priority', 'options', 'receipts',
]);

const FORBIDDEN_ACTIVE_INSTRUCTION_PATTERNS = [
  [/\b(?:open|reopen|go to|from)\s+(?:the\s+)?Telegram\s+(?:card|message)\s+\d{3,}\b/i, 'fixed Telegram message'],
  [/\b(?:close and reopen|tap Confirm signed exactly once|reply here with tapped)\b/i, 'fixed ActionRequest state'],
];

function rootPath(value) {
  if (value instanceof URL) return fileURLToPath(value);
  return resolve(String(value));
}

async function readOptional(path) {
  try { return await readFile(path, 'utf8'); } catch { return null; }
}

async function walkMarkdown(directory) {
  if (!existsSync(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walkMarkdown(path);
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
  }));
  return nested.flat();
}

export function auditActionRequestFixtureRows(rows) {
  const failures = [];
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== 'object') {
      failures.push(`ActionRequest fixture row ${index} is not an object`);
      continue;
    }
    for (const key of ['telegram', 'receiptExpectation']) {
      if (key in row) failures.push(`ActionRequest fixture row ${index} contains noncanonical field ${key}`);
    }
    for (const key of Object.keys(row)) {
      if (!PUBLIC_ACTION_REQUEST_KEYS.has(key) && key !== 'telegram' && key !== 'receiptExpectation') {
        failures.push(`ActionRequest fixture row ${index} contains unknown public field ${key}`);
      }
    }
  }
  return failures;
}

export function auditOperationalMarkdown(path, text) {
  if (/Lifecycle:\s*historical;\s*non-operational/i.test(text)) return [];
  const failures = [];
  for (const [pattern, label] of FORBIDDEN_ACTIVE_INSTRUCTION_PATTERNS) {
    if (pattern.test(text)) failures.push(`${path} contains ${label} instruction`);
  }
  if (/^\s*[-*]\s+\[ \]/m.test(text)) failures.push(`${path} contains an unchecked operational checklist`);
  return failures;
}

export async function auditViewportProofArtifact(proofDir, proof) {
  if (!proof || typeof proof.path !== 'string' || !proof.path.endsWith('.png')) return [];
  if (!/^[a-f0-9]{64}$/.test(String(proof.sha256 || ''))) {
    return [`viewport proof manifest lacks a SHA-256 digest for ${proof.path}`];
  }
  let bytes;
  try {
    bytes = await readFile(join(proofDir, proof.path));
  } catch {
    return [`viewport proof PNG is missing for ${proof.path}`];
  }
  const digest = createHash('sha256').update(bytes).digest('hex');
  return digest === proof.sha256 ? [] : [`viewport proof PNG digest mismatch for ${proof.path}`];
}

export async function auditRepository(rootValue = process.cwd()) {
  const root = rootPath(rootValue);
  const failures = [];
  const requireFile = (relative) => {
    if (!existsSync(join(root, relative))) failures.push(`missing canonical file ${relative}`);
  };
  const forbidFile = (relative) => {
    if (existsSync(join(root, relative))) failures.push(`stale or duplicated file remains ${relative}`);
  };

  for (const required of [
    'docs/LIFECYCLE.md',
    'docs/organs/source-snapshot.json',
    'docs/plans/README.md',
    'docs/runbooks/telegram-action-request-lifecycle.md',
    'workers/quests/src/telegram-routing.ts',
  ]) requireFile(required);

  for (const forbidden of [
    'docs/plans/2026-06-30-tg-miniapp-live-proof-unblock-runbook.md',
    'tasks/todo.md',
    'docs/plans/assets/cambium-r3f-game-engine-realignment/github-issues.json',
    'docs/plans/assets/cambium-r3f-game-engine-realignment/github-issues.md',
    'docs/plans/assets/cambium-r3f-game-engine-realignment/tasks.md',
    'docs/plans/assets/tg-miniapp-component-system-swarm/component-foundation-issues.json',
    'docs/plans/assets/tg-miniapp-viewport-proof/failure.json',
    'docs/plans/assets/tg-miniapp-viewport-proof/browser-diagnostics.json',
    'docs/plans/assets/tg-miniapp-live-proof/readiness.json',
    'docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.json',
  ]) forbidFile(forbidden);

  const issueBodies = join(root, 'docs/plans/assets/cambium-r3f-game-engine-realignment/issue-bodies');
  if (existsSync(issueBodies) && (await readdir(issueBodies)).length > 0) failures.push('duplicate M7 issue bodies remain');

  for (const path of await walkMarkdown(join(root, 'docs/runbooks'))) {
    const relative = path.slice(root.length + 1);
    failures.push(...auditOperationalMarkdown(relative, await readFile(path, 'utf8')));
  }

  const currentDocs = [
    'README.md',
    'docs/LIFECYCLE.md',
    'docs/adapters/telegram.md',
    'docs/architecture/contracts/tg-miniapp-ecosystem-contract.md',
    'docs/architecture/contracts/hermes-topic-routing-to-quests.md',
  ];
  for (const relative of currentDocs) {
    const text = await readOptional(join(root, relative));
    if (text !== null) failures.push(...auditOperationalMarkdown(relative, text));
  }

  const fixtureModule = await import(`${pathToFileURL(join(root, 'workers/quests/src/visual-fixtures.ts')).href}?audit=${Date.now()}`);
  failures.push(...auditActionRequestFixtureRows(fixtureModule.IVERIF_ACTION_REQUEST_ROWS || []));
  const viewportModule = await import(`${pathToFileURL(join(root, 'workers/quests/src/visual-viewport-proof.mjs')).href}?audit=${Date.now()}`);
  const queuedFixture = viewportModule.buildQueuedActionRequestFixture();
  failures.push(...auditActionRequestFixtureRows(queuedFixture?.actionRequests?.rows || []));

  const handler = await readOptional(join(root, 'workers/quests/src/handler.ts')) || '';
  if (!/from '\.\/telegram-routing\.ts'/.test(handler)) failures.push('handler does not consume the canonical Telegram routing module');
  if (/const\s+TOPIC_QUEST_ROUTES\s*=|const\s+THOUGHTSEED_TELEGRAM_CHAT_ID\s*=/.test(handler)) failures.push('handler duplicates Telegram routing configuration');

  const routingContract = await readOptional(join(root, 'docs/architecture/contracts/hermes-topic-routing-to-quests.md')) || '';
  if (!/\| Dev \| 862 \|/.test(routingContract)) failures.push('active routing contract does not match pinned Hermes Dev topic 862');
  if (/\| Dev \| 799 \|/.test(routingContract)) failures.push('active routing contract still contains retired Dev topic 799');

  const wrangler = await readOptional(join(root, 'workers/quests/wrangler.jsonc')) || '';
  if (/CAMBIUM_PUBLIC_BASE_URL/.test(wrangler)) failures.push('Wrangler contains dead CAMBIUM_PUBLIC_BASE_URL configuration');

  const releaseScopeText = await readOptional(join(root, 'docs/visual/release-scope.json')) || '{}';
  try {
    const releaseScope = JSON.parse(releaseScopeText);
    if (Array.isArray(releaseScope?.r3f?.issues) || Array.isArray(releaseScope?.r3fGameEngineRealignment?.issues)) {
      failures.push('visual release scope mirrors GitHub issue state');
    }
  } catch {
    failures.push('visual release scope is not valid JSON');
  }

  const qaPolicy = await readOptional(join(root, 'apps/cambium-r3f/src/scene/desktop-qa-policy.ts')) || '';
  if (/awaiting-user-flow-feedback|skipped-by-user-request/.test(qaPolicy)) failures.push('R3F QA policy contains temporal milestone status');

  const proofDir = join(root, 'docs/plans/assets/tg-miniapp-viewport-proof');
  const manifestText = await readOptional(join(proofDir, 'manifest.json'));
  if (!manifestText) {
    failures.push('viewport proof manifest is missing');
  } else {
    try {
      const manifest = JSON.parse(manifestText);
      const expectedPngs = [...new Set((manifest.proofs || []).map((proof) => proof.path).filter((path) => typeof path === 'string' && path.endsWith('.png')))].sort();
      const actualPngs = (await readdir(proofDir)).filter((name) => name.endsWith('.png')).sort();
      if (JSON.stringify(actualPngs) !== JSON.stringify(expectedPngs)) failures.push('viewport proof PNG set does not exactly match manifest.proofs');
      for (const proof of manifest.proofs || []) failures.push(...await auditViewportProofArtifact(proofDir, proof));
      const { PAGE } = await import(`${pathToFileURL(join(root, 'workers/quests/src/page.ts')).href}?audit=${Date.now()}`);
      const digest = createHash('sha256').update(PAGE).digest('hex');
      if (manifest.pageSourceSha256 !== digest) failures.push('viewport proof manifest PAGE digest is stale');
    } catch (error) {
      failures.push(`viewport proof manifest audit failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { ok: failures.length === 0, failures };
}

async function main() {
  const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
  const report = await auditRepository(root);
  if (!report.ok) {
    for (const failure of report.failures) process.stderr.write(`DRIFT: ${failure}\n`);
    process.exit(1);
  }
  process.stdout.write('Drift audit passed.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });
}
