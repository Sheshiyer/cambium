#!/usr/bin/env node
// Standalone-product audit: catch private local paths, account/payment exports,
// and live deployment defaults before they enter release-facing code.

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const skipDirs = new Set([
  '.git',
  '.operator',
  '.wrangler',
  '.codegraph',
  'cortex',
  'dist',
  'node_modules',
  '__pycache__',
  'motionsites-export',
]);

function walkFiles(dir = '.', prefix = '') {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (prefix === '' && skipDirs.has(entry)) continue;
    if (entry === '.DS_Store') continue;
    const rel = prefix ? `${prefix}/${entry}` : entry;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkFiles(full, rel));
    } else if (stat.isFile()) {
      files.push(rel);
    }
  }
  return files;
}

function candidateFiles() {
  const tracked = spawnSync('git', ['ls-files'], { encoding: 'utf8' });
  if (tracked.status !== 0) return walkFiles();

  const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' });
  if (untracked.status !== 0) {
    process.stderr.write(untracked.stderr || 'git ls-files --others failed\n');
    process.exit(untracked.status || 1);
  }

  return tracked.stdout.concat(untracked.stdout).split('\n').filter(Boolean);
}

const files = candidateFiles()
  .filter(Boolean)
  .filter((file) => !file.startsWith('docs/plans/assets/'))
  .filter((file) => !file.startsWith('apps/cambium-r3f/public/assets/'))
  .filter((file) => !file.endsWith('VERSIONS.md'));

const privatePatterns = [
  { name: 'private macOS user path', pattern: /\/Users\/sheshnarayaniyer\b/ },
  { name: 'private project volume path', pattern: /\/Volumes\/madara\b/ },
  { name: 'private Thoughtseed env path', pattern: /thoughtseed-paperclip\/\.env/ },
  { name: 'personal email', pattern: /[A-Z0-9._%+-]+@(icloud|gmail)\.com/i },
  { name: 'Stripe live session id', pattern: /cs_live_[A-Za-z0-9]+/ },
  { name: 'raw private user UUID from exports', pattern: new RegExp('d00e212d-3726-4b83-b68c-' + 'ab661d0bd0db', 'i') },
];

const liveDefaultPatterns = [
  {
    name: 'live Thoughtseed URL in product code/config',
    pattern: /curious\.thoughtseed\.space/,
    allowed: /^(README\.md|VERSIONS\.md|docs\/plans\/|workers\/quests\/src\/page\.ts$)/,
  },
  {
    name: 'checked-in founder Telegram ids',
    pattern: new RegExp(['137' + '1522080', '926' + '168615', '157' + '1615655'].join('|')),
  },
];

const failures = [];
for (const file of files) {
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const rule of privatePatterns) {
    if (rule.pattern.test(text)) failures.push(`${file}: ${rule.name}`);
  }
  for (const rule of liveDefaultPatterns) {
    if (rule.pattern.test(text) && !(rule.allowed?.test(file) ?? false)) failures.push(`${file}: ${rule.name}`);
  }
}

if (failures.length) {
  console.error('standalone audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`standalone audit passed (${files.length} publishable files checked)`);
