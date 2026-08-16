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

function readHeadGeneratedAt(outputRepoPaths, headFileSet) {
  const outputRepoPath = [...outputRepoPaths].find((file) => headFileSet.has(file));
  if (!outputRepoPath) return null;

  let existing;
  try {
    existing = JSON.parse(readHeadBlob(outputRepoPath).toString('utf8'));
  } catch (error) {
    throw new Error(`HEAD output must be valid JSON to preserve generatedAt: ${outputRepoPath}`);
  }
  return typeof existing.generatedAt === 'string' ? existing.generatedAt : null;
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

const output = readOptionValue('--out', '.planning/2026-08-10-documentation-retention-manifest.per-file.v1.json');
const { outputPath, guardedOutputPath } = resolveGuardedOutputPath(output);
const outputRepoPaths = new Set([
  normalizeRepoPath(path.relative(root, outputPath)),
  normalizeRepoPath(path.relative(root, guardedOutputPath)),
]);
const headFiles = listHeadFiles();
const headFileSet = new Set(headFiles);
const generatedAt = readOptionValue('--generated-at')
  ?? readHeadGeneratedAt(outputRepoPaths, headFileSet)
  ?? new Date().toISOString().slice(0, 10);
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
  generatedAt,
  scopeRoot: 'docs/plans',
  decision: 'no-relocation-or-deletion',
  entryCount: entries.length,
  entries,
  safeguards: ['tracked-files-only', 'no-reference-bodies', 'no-automatic-deletion-or-externalization', 'duplicate-groups-remain-review-required'],
};

fs.writeFileSync(guardedOutputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${output}: ${entries.length} entries`);
