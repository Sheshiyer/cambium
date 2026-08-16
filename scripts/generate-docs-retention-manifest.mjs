#!/usr/bin/env node

/** Generate a tracked-files-only, non-destructive docs/plans retention manifest. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const rootReal = fs.realpathSync(root);
const textExtensions = new Set(['.md', '.json', '.js', '.mjs', '.ts', '.tsx', '.html', '.css', '.yml', '.yaml']);

function readOptionValue(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function normalizeRepoPath(file) {
  return file.split(path.sep).join('/');
}

function ensureRepoContained(filePath, label) {
  if (filePath === rootReal || filePath.startsWith(`${rootReal}${path.sep}`)) return;
  throw new Error(`${label} must stay within the repository: ${label === 'output path' ? output : filePath}`);
}

function rejectExistingOutputSymlink(outputPath, outputLabel) {
  try {
    if (fs.lstatSync(outputPath).isSymbolicLink()) {
      throw new Error(`output path must not be a symbolic link: ${outputLabel}`);
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
}

function resolveGuardedOutputPath(outputLabel) {
  const outputPath = path.resolve(root, outputLabel);
  rejectExistingOutputSymlink(outputPath, outputLabel);

  const outputDir = path.dirname(outputPath);
  let outputDirReal;
  try {
    outputDirReal = fs.realpathSync(outputDir);
  } catch (error) {
    throw new Error(`output directory must already exist within the repository: ${outputLabel}`);
  }

  const guardedOutputPath = path.resolve(outputDirReal, path.basename(outputPath));
  ensureRepoContained(guardedOutputPath, 'output path');
  return { outputPath, guardedOutputPath };
}

function runGit(args, encoding = 'utf8') {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding,
      maxBuffer: 512 * 1024 * 1024,
    });
  } catch (error) {
    const detail = error?.stderr?.toString?.().trim() || error.message;
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }
}

function listHeadFiles(...scopes) {
  return runGit(['ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', ...scopes])
    .split('\0')
    .filter(Boolean)
    .sort();
}

const headBlobCache = new Map();

function readHeadBlob(file) {
  if (!headBlobCache.has(file)) {
    headBlobCache.set(file, runGit(['show', `HEAD:${file}`], null));
  }
  return headBlobCache.get(file);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isTextFile(file) {
  return textExtensions.has(path.extname(file).toLowerCase());
}

function referencesFile(source, body, target) {
  if (source === target) return false;
  const relative = path.posix.relative(path.posix.dirname(source), target);
  return body.includes(target) || body.includes(relative) || body.includes(`./${relative}`);
}

function kindOf(file) {
  if (file.includes('/product-branches/')) return 'branch-packet';
  if (file.endsWith('.json')) return 'manifest';
  if (file.endsWith('.md')) return 'plan';
  return 'screenshot';
}

const canonicalOutput = '.planning/2026-08-10-documentation-retention-manifest.per-file.v1.json';
const canonicalAggregate = '.planning/2026-08-10-documentation-retention-manifest.v1.json';
const canonicalInventory = '.planning/2026-08-10-documentation-retention-inventory.md';
const output = readOptionValue('--out', canonicalOutput);
const checkOnly = process.argv.includes('--check');
if (process.argv.includes('--generated-at')) {
  throw new Error('--generated-at is not supported; inventoryAsOfCommitDate is derived from HEAD');
}
const { outputPath, guardedOutputPath } = resolveGuardedOutputPath(output);
const outputRepoPaths = new Set([
  normalizeRepoPath(path.relative(root, outputPath)),
  normalizeRepoPath(path.relative(root, guardedOutputPath)),
]);
outputRepoPaths.add(canonicalAggregate);
outputRepoPaths.add(canonicalInventory);
const headFiles = listHeadFiles();
const inventoryAsOfCommitDate = runGit(['show', '-s', '--format=%cs', 'HEAD']).trim();
if (!/^\d{4}-\d{2}-\d{2}$/.test(inventoryAsOfCommitDate)) {
  throw new Error(`HEAD commit date must use YYYY-MM-DD: ${inventoryAsOfCommitDate}`);
}
const tracked = listHeadFiles('docs/plans');
const corpus = headFiles
  .filter((file) => isTextFile(file) && !outputRepoPaths.has(file))
  .map((file) => ({ file, body: readHeadBlob(file).toString('utf8') }));
const duplicateCount = new Map();

for (const file of tracked) {
  const hash = sha256(readHeadBlob(file));
  duplicateCount.set(hash, (duplicateCount.get(hash) || 0) + 1);
}

const entries = tracked.map((file) => {
  const blob = readHeadBlob(file);
  const hash = sha256(blob);
  const inbound = corpus
    .filter(({ file: source, body }) => referencesFile(source, body, file))
    .map(({ file: source }) => source)
    .sort();
  const hashRefs = corpus
    .filter(({ file: source, body }) => source !== file && body.includes(hash))
    .map(({ file: source }) => source)
    .sort();
  const integrityLink = inbound.length && hashRefs.length ? 'both'
    : inbound.length ? 'path-only'
      : hashRefs.length ? 'hash-only'
        : 'none';
  const duplicate = duplicateCount.get(hash) > 1;
  const retentionClass = file.includes('/product-branches/')
    ? 'retain-active'
    : duplicate || (file.includes('/assets/') && !inbound.length)
      ? 'review-required'
      : file.includes('/assets/')
        ? 'retain-proof'
        : 'retain-historical';

  return {
    path: file,
    bytes: blob.length,
    sha256: hash,
    gitTracked: true,
    kind: kindOf(file),
    inboundReferences: {
      count: inbound.length,
      samplePaths: inbound.slice(0, 20),
      truncated: inbound.length > 20,
    },
    integrityLink,
    retentionClass,
    restorationMethod: 'Git history',
    decision: 'retain',
    ...(duplicate ? { duplicateSha256Group: true } : {}),
  };
});

const manifest = {
  schema: 'cambium.docs-retention.per-file.v1',
  status: 'reviewed-inventory',
  decisionOriginDate: '2026-08-10',
  inventoryAsOfRevision: 'HEAD',
  inventoryAsOfCommitDate,
  scopeRoot: 'docs/plans',
  decision: 'no-relocation-or-deletion',
  entryCount: entries.length,
  entries,
  safeguards: ['tracked-files-only', 'no-reference-bodies', 'no-automatic-deletion-or-externalization', 'duplicate-groups-remain-review-required'],
};

const perFileContent = `${JSON.stringify(manifest, null, 2)}\n`;
const sumBytes = (selected) => selected.reduce((sum, entry) => sum + entry.bytes, 0);
const byExtension = (extension) => entries.filter((entry) => entry.path.endsWith(extension));
const assets = entries.filter((entry) => entry.path.includes('/assets/'));
const markdown = byExtension('.md');
const json = byExtension('.json');
const png = byExtension('.png');

function replaceInventoryHeader(source) {
  const start = '<!-- retention-inventory:head:start -->';
  const end = '<!-- retention-inventory:head:end -->';
  const totalBytes = sumBytes(entries);
  const pngBytes = sumBytes(png);
  const block = `${start}
# Documentation retention inventory — current HEAD inventory

**Status:** evidence-safe inventory complete; no cleanup approved
**Decision origin:** 2026-08-10 retention review
**Inventory basis:** exact committed \`HEAD\` tree and blobs
**Inventory as of HEAD commit date:** \`${inventoryAsOfCommitDate}\`
**Scope:** \`docs/\` and \`.planning/\` only
**Method:** deterministic size, type, checksum, and inbound-reference generation plus release-gated consistency verification

## Decision

Do not delete, move, merge, externalize, or auto-deduplicate any documentation asset in this pass. The only exact duplicate found has distinct evidence names and active test/manifest references. The primary result is a bounded retention proposal for owner review.

## Footprint

| Surface | Evidence | Interpretation |
| --- | --- | --- |
| \`docs/plans/\` | ${entries.length} files, ${totalBytes.toLocaleString('en-US')} bytes (${(totalBytes / 1048576).toFixed(2)} MiB) | dominant historical/proof payload measured from HEAD |
| \`docs/plans/assets/\` | ${assets.length} files, ${sumBytes(assets).toLocaleString('en-US')} bytes (${(sumBytes(assets) / 1048576).toFixed(2)} MiB) | generated/reference proof assets |
| PNG files | ${png.length} files, ${pngBytes.toLocaleString('en-US')} bytes (${(pngBytes / totalBytes * 100).toFixed(2)}% of \`docs/plans\`) | primary future retention-review surface |
| Markdown files | ${markdown.length} files, ${sumBytes(markdown).toLocaleString('en-US')} bytes | low-cost decision/history context |
| JSON files | ${json.length} files, ${sumBytes(json).toLocaleString('en-US')} bytes | manifests and structured proof context |

Largest asset families are the Telegram Mini App viewport proof, Cambium R3F screenshots, Cambium R3F game-engine realignment, Telegram Mini App mission-control references, and constellation UI references.
${end}`;

  const hasStart = source.includes(start);
  const hasEnd = source.includes(end);
  if (hasStart !== hasEnd) {
    throw new Error(`inventory template has an incomplete generated header boundary: ${canonicalInventory}`);
  }

  let updated;
  if (hasStart) {
    updated = source.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
  } else {
    updated = source.replace(/^# Documentation retention inventory[^\n]*\n[\s\S]*?(?=## Reference safety findings)/, `${block}\n\n`);
    if (updated === source) {
      throw new Error(`inventory template is missing its generated header boundary: ${canonicalInventory}`);
    }
  }
  return updated.replace(
    /  "generatedAt": "ISO-8601",?/,
    '  "decisionOriginDate": "2026-08-10",\n  "inventoryAsOfRevision": "HEAD",\n  "inventoryAsOfCommitDate": "YYYY-MM-DD",',
  );
}

function renderAggregate(source) {
  let aggregate;
  try {
    aggregate = JSON.parse(source);
  } catch (error) {
    throw new Error(`HEAD aggregate receipt must be valid JSON: ${canonicalAggregate}`);
  }
  delete aggregate.generatedAt;
  aggregate.decisionOriginDate = '2026-08-10';
  aggregate.inventoryAsOfRevision = 'HEAD';
  aggregate.inventoryAsOfCommitDate = inventoryAsOfCommitDate;
  aggregate.entryCount = entries.length;

  const lookup = new Map(aggregate.entries.map((entry) => [entry.path, entry]));
  lookup.get('docs/plans/**/*.md').bytes = sumBytes(markdown);
  lookup.get('docs/plans/**/*.json').bytes = sumBytes(json);
  lookup.get('docs/plans/assets/**').bytes = sumBytes(assets);
  for (const target of [
    'docs/plans/assets/tg-miniapp-viewport-proof/mission-actions-mobile.png',
    'docs/plans/assets/tg-miniapp-viewport-proof/mission-utilities-mobile.png',
  ]) {
    const sourceEntry = entries.find((entry) => entry.path === target);
    const aggregateEntry = lookup.get(target);
    if (!sourceEntry && !aggregateEntry) continue;
    if (!sourceEntry || !aggregateEntry) throw new Error(`aggregate receipt is inconsistent for required entry: ${target}`);
    aggregateEntry.bytes = sourceEntry.bytes;
    aggregateEntry.sha256 = sourceEntry.sha256;
  }
  return `${JSON.stringify(aggregate, null, 2)}\n`;
}

function assertCurrent(filePath, expected) {
  const actual = fs.readFileSync(filePath, 'utf8');
  if (actual !== expected) throw new Error(`retention receipt is stale; regenerate before release: ${normalizeRepoPath(path.relative(root, filePath))}`);
}

const canonicalMode = normalizeRepoPath(path.relative(root, guardedOutputPath)) === canonicalOutput
  && headFiles.includes(canonicalAggregate)
  && headFiles.includes(canonicalInventory);
if (!canonicalMode) {
  if (checkOnly) assertCurrent(guardedOutputPath, perFileContent);
  else fs.writeFileSync(guardedOutputPath, perFileContent);
  console.log(`${output}: ${entries.length} entries${checkOnly ? ' verified' : ''}`);
} else {
  const aggregatePath = resolveGuardedOutputPath(canonicalAggregate).guardedOutputPath;
  const inventoryPath = resolveGuardedOutputPath(canonicalInventory).guardedOutputPath;
  const aggregateContent = renderAggregate(readHeadBlob(canonicalAggregate).toString('utf8'));
  const inventoryContent = replaceInventoryHeader(readHeadBlob(canonicalInventory).toString('utf8'));
  if (checkOnly) {
    assertCurrent(guardedOutputPath, perFileContent);
    assertCurrent(aggregatePath, aggregateContent);
    assertCurrent(inventoryPath, inventoryContent);
  } else {
    fs.writeFileSync(guardedOutputPath, perFileContent);
    fs.writeFileSync(aggregatePath, aggregateContent);
    fs.writeFileSync(inventoryPath, inventoryContent);
  }
  console.log(`retention receipts: ${entries.length} HEAD entries${checkOnly ? ' verified' : ''}`);
}
