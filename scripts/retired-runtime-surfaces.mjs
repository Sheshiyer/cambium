#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const RETIRED_SURFACE = ['multi', 'ca'].join('');
const RETIRED_DISPLAY = ['Multi', 'CA'].join('');
const EXCLUDED_DIRECTORIES = new Set([
  '.artifacts', '.git', '.wrangler', 'coverage', 'dist', 'node_modules', 'playwright-report', 'test-results',
]);
const HISTORICAL_FILES = new Set([
  'VERSIONS.md',
  'docs/plans/2026-06-10-curios-self-ecosystem-map.md',
  'docs/plans/2026-06-11-next-map.md',
  'docs/plans/2026-06-16-followons.md',
  'docs/plans/2026-06-19-standalone-fractal-tapestry-integration-plan.md',
  'docs/plans/2026-06-25-cambium-hermes-skill-loadout-contract.md',
  'docs/plans/2026-06-29-branch-story-adapter-miniapp-plan.md',
]);
const BINARY_EXTENSIONS = new Set([
  '.7z', '.avif', '.bin', '.br', '.bz2', '.db', '.eot', '.gif', '.gz', '.ico', '.jpeg', '.jpg', '.mp3',
  '.mp4', '.otf', '.pdf', '.png', '.sqlite', '.sqlite3', '.tar', '.tgz', '.ttf', '.webm', '.webp', '.woff',
  '.woff2', '.zip',
]);

const RETIREMENT_RECORDS = new Map([
  [
    'README.md',
    new Set([`| **M5 · Historical ${RETIRED_DISPLAY} Wiring (retired)** ([#28+](https://github.com/Sheshiyer/cambium/milestone/5)) | 🗄️ historical — Phase R, G, Q, and bridge writers were delivered on 2026-06-16. The runtime was later retired in favor of Paperclip/Hermes; this row preserves release history and is not a callable surface. |`]),
  ],
  [
    'bin/quine/hyphae/growth-journal.ts',
    new Set([`{ id: '${RETIRED_SURFACE}', status: 'retired', guard: 'superseded by Thoughtseed Paperclip/Hermes bridge' },`]),
  ],
  [
    'bin/quine/hyphae/growth-journal.test.ts',
    new Set([`assert.deepEqual(saved.surfaces.retired.map((surface: any) => surface.id), ['teamforge', '${RETIRED_SURFACE}']);`]),
  ],
]);

function normalize(path) {
  return path.split(sep).join('/').replace(/^\.\//, '');
}

function pathSegments(path) {
  return normalize(path).split('/').filter(Boolean);
}

function isExcludedPath(path) {
  const normalized = normalize(path);
  const segments = pathSegments(normalized);
  if (HISTORICAL_FILES.has(normalized)) return true;
  return segments.some((segment) => EXCLUDED_DIRECTORIES.has(segment));
}

function isBinaryPath(path) {
  const lower = path.toLowerCase();
  return [...BINARY_EXTENSIONS].some((extension) => lower.endsWith(extension));
}

function walkFiles(root, directory = '') {
  const start = join(root, directory);
  if (!existsSync(start)) return [];
  const files = [];
  for (const entry of readdirSync(start)) {
    const relativePath = normalize(join(directory, entry));
    if (isExcludedPath(relativePath)) continue;
    const full = join(root, relativePath);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walkFiles(root, relativePath));
    else if (stat.isFile()) files.push(relativePath);
  }
  return files;
}

function repositoryFiles(root) {
  const result = spawnSync(
    'git',
    ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  if (result.status !== 0) return walkFiles(root);
  return result.stdout.split('\0').filter(Boolean).map(normalize);
}

function activeFiles(root) {
  return [...new Set(repositoryFiles(root))]
    .filter((file) => existsSync(join(root, file)))
    .filter((file) => !isExcludedPath(file))
    .filter((file) => !isBinaryPath(file));
}

function isAlphaNumeric(character) {
  return typeof character === 'string' && /^[A-Za-z0-9]$/.test(character);
}

function containsRetiredToken(value) {
  const lower = value.toLowerCase();
  let offset = 0;
  while (offset < lower.length) {
    const index = lower.indexOf(RETIRED_SURFACE, offset);
    if (index === -1) return false;

    const before = value[index - 1];
    const start = value[index];
    const after = value[index + RETIRED_SURFACE.length];
    const afterNext = value[index + RETIRED_SURFACE.length + 1];
    const startsCamelWord = isAlphaNumeric(before) && /[a-z0-9]/.test(before) && /[A-Z]/.test(start);
    const endsBeforeCamelWord = /[A-Z]/.test(after ?? '') && /[a-z]/.test(afterNext ?? '');
    const beforeBoundary = !isAlphaNumeric(before) || startsCamelWord;
    const afterBoundary = !isAlphaNumeric(after) || endsBeforeCamelWord;
    if (beforeBoundary && afterBoundary) return true;
    offset = index + 1;
  }
  return false;
}

function isAllowedRetirementRecord(file, line) {
  return RETIREMENT_RECORDS.get(file)?.has(line.trim()) ?? false;
}

function isProbablyBinary(content) {
  return content.subarray(0, 8000).includes(0);
}

export function findRetiredRuntimeViolations(root = process.cwd()) {
  const repoRoot = resolve(root);
  const failures = [];
  for (const file of activeFiles(repoRoot)) {
    if (containsRetiredToken(file)) {
      failures.push(`${file}: retired runtime filename is forbidden`);
    }

    let content;
    try {
      content = readFileSync(join(repoRoot, file));
    } catch {
      continue;
    }
    if (isProbablyBinary(content)) continue;

    for (const [index, line] of content.toString('utf8').split('\n').entries()) {
      if (!containsRetiredToken(line)) continue;
      if (isAllowedRetirementRecord(file, line)) continue;
      failures.push(`${file}:${index + 1}: retired runtime vocabulary is forbidden on active surfaces`);
    }
  }
  return failures;
}

export function runRetiredRuntimeGuard(root = process.cwd()) {
  const failures = findRetiredRuntimeViolations(root);
  if (failures.length) {
    console.error('retired runtime guard failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    return 1;
  }
  console.log('retired runtime guard passed: active source and configuration remain retirement-safe');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runRetiredRuntimeGuard();
}
