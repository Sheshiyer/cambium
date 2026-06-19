#!/usr/bin/env node
// Standalone-product audit: catch private local paths, account/payment exports,
// and live deployment defaults before they enter release-facing code.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const tracked = spawnSync('git', ['ls-files'], { encoding: 'utf8' });
if (tracked.status !== 0) {
  process.stderr.write(tracked.stderr || 'git ls-files failed\n');
  process.exit(tracked.status || 1);
}

const files = tracked.stdout
  .split('\n')
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
  { name: 'raw private user UUID from exports', pattern: /d00e212d-3726-4b83-b68c-ab661d0bd0db/i },
];

const liveDefaultPatterns = [
  {
    name: 'live Thoughtseed URL in product code/config',
    pattern: /curious\.thoughtseed\.space/,
    allowed: /^(README\.md|VERSIONS\.md|docs\/plans\/|workers\/quests\/src\/page\.ts$)/,
  },
  {
    name: 'checked-in founder Telegram ids',
    pattern: /(1371522080|926168615|1571615655)/,
    allowed: /^workers\/quests\/src\/handler\.test\.ts$/,
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
    if (rule.pattern.test(text) && !rule.allowed.test(file)) failures.push(`${file}: ${rule.name}`);
  }
}

if (failures.length) {
  console.error('standalone audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`standalone audit passed (${files.length} tracked files checked)`);
