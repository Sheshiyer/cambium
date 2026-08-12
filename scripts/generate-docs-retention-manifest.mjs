#!/usr/bin/env node

/** Generate a tracked-files-only, non-destructive docs/plans retention manifest. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const defaultOutput = '.planning/2026-08-10-documentation-retention-manifest.per-file.v1.json';
const output = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : defaultOutput;
const outputPath = path.relative(root, path.resolve(root, output));
const generatedManifestPaths = new Set([defaultOutput, outputPath]);
const existingGeneratedAt = (() => {
  try {
    const existing = JSON.parse(fs.readFileSync(path.join(root, output), 'utf8'));
    return typeof existing.generatedAt === 'string' ? existing.generatedAt : null;
  } catch {
    return null;
  }
})();
const generatedAt = process.argv.includes('--generated-at')
  ? process.argv[process.argv.indexOf('--generated-at') + 1]
  : existingGeneratedAt || new Date().toISOString().slice(0, 10);
const text = new Set(['.md', '.json', '.js', '.mjs', '.ts', '.tsx', '.html', '.css', '.yml', '.yaml']);
const tracked = execFileSync('git', ['ls-files', '-z', '--', 'docs/plans'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(Boolean).sort();
const textFiles = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter((file) => !generatedManifestPaths.has(file) && text.has(path.extname(file).toLowerCase()));
const readText = (file) => {
  try { return fs.readFileSync(path.join(root, file), 'utf8'); } catch { return ''; }
};
const corpus = textFiles.map((file) => ({ file, body: readText(file) }));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const duplicateCount = new Map();
for (const file of tracked) {
  const hash = sha256(file);
  duplicateCount.set(hash, (duplicateCount.get(hash) || 0) + 1);
}
const kindOf = (file) => {
  if (file.includes('/product-branches/')) return 'branch-packet';
  if (file.endsWith('.json')) return 'manifest';
  if (file.endsWith('.md')) return 'plan';
  return 'screenshot';
};
const entries = tracked.map((file) => {
  const hash = sha256(file);
  const inbound = corpus.filter(({ file: source, body }) => {
    if (source === file) return false;
    const relative = path.relative(path.dirname(source), file);
    return body.includes(file) || body.includes(relative) || body.includes(`./${relative}`);
  }).map(({ file: source }) => source).sort();
  const hashRefs = corpus.filter(({ file: source, body }) => source !== file && body.includes(hash)).map(({ file: source }) => source).sort();
  const integrityLink = inbound.length && hashRefs.length ? 'both' : inbound.length ? 'path-only' : hashRefs.length ? 'hash-only' : 'none';
  const duplicate = duplicateCount.get(hash) > 1;
  const kind = kindOf(file);
  const retentionClass = file.includes('/product-branches/') ? 'retain-active'
    : duplicate || (file.includes('/assets/') && !inbound.length) ? 'review-required'
      : file.includes('/assets/') ? 'retain-proof' : 'retain-historical';
  return {
    path: file,
    bytes: fs.statSync(path.join(root, file)).size,
    sha256: hash,
    gitTracked: true,
    kind,
    inboundReferences: { count: inbound.length, samplePaths: inbound.slice(0, 20), truncated: inbound.length > 20 },
    integrityLink,
    retentionClass,
    restorationMethod: 'Git history',
    decision: 'retain',
    ...(duplicate ? { duplicateSha256Group: true } : {})
  };
});
const manifest = {
  schema: 'cambium.docs-retention.per-file.v1',
  status: 'reviewed-inventory',
  generatedAt,
  scopeRoot: 'docs/plans',
  decision: 'no-relocation-or-deletion',
  entryCount: entries.length,
  entries,
  safeguards: ['tracked-files-only', 'no-reference-bodies', 'no-automatic-deletion-or-externalization', 'duplicate-groups-remain-review-required']
};
fs.writeFileSync(path.join(root, output), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${output}: ${entries.length} entries`);
