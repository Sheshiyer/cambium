#!/usr/bin/env node
// Standalone-product audit: catch private local paths, account/payment exports,
// and live deployment defaults before they enter release-facing code.

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveQuestsWranglerProfile } from './quests-wrangler-profile.mjs';

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

const privatePatterns = [
  { name: 'private macOS user path', pattern: /\/Users\/sheshnarayaniyer\b/ },
  { name: 'private project volume path', pattern: /\/Volumes\/madara\b/ },
  { name: 'private Thoughtseed env path', pattern: /thoughtseed-paperclip\/\.env/ },
  { name: 'personal email', pattern: /[A-Z0-9._%+-]+@(icloud|gmail)\.com/i },
  { name: 'Stripe live session id', pattern: /cs_live_[A-Za-z0-9]+/ },
  { name: 'raw private user UUID from exports', pattern: new RegExp('d00e212d-3726-4b83-b68c-' + 'ab661d0bd0db', 'i') },
];

const liveDeploymentAuthorityFiles = new Set([
  'docs/architecture/contracts/cambium-cloudflare-resource-map.v1.json',
  'docs/superpowers/specs/2026-08-31-labs-consolidation-design.md',
  'scripts/quests-wrangler-profile.mjs',
  'scripts/quests-wrangler-profile.test.mjs',
  'workers/quests/DEPLOY.md',
  'workers/quests/DEPLOY-LABS.md',
  // Exact value-free Labs reconciliation overlay; no new deployment owner.
  'workers/quests/wrangler.labs.live-inherit.jsonc',
]);

export function isAllowedLiveDeploymentEvidencePath(file) {
  return liveDeploymentAuthorityFiles.has(file)
    || /^(README\.md|ISA\.md|VERSIONS\.md|\.planning\/|docs\/plans\/|docs\/archive\/|docs\/diagrams\/|docs\/evidence\/|workers\/quests\/src\/(page|handler|handler\.test|live-proof-readiness|live-proof-readiness\.test|visual-fixtures)\.(ts|mjs)$|bin\/quine\/hyphae\/(quests|quests\.test|skills)\.ts$)/.test(file);
}

const liveDefaultPatterns = [
  {
    name: 'live Thoughtseed URL in product code/config',
    pattern: /curious\.thoughtseed\.space/,
    allowed: isAllowedLiveDeploymentEvidencePath,
  },
  {
    name: 'checked-in founder Telegram ids',
    pattern: new RegExp(['137' + '1522080', '926' + '168615', '157' + '1615655'].join('|')),
  },
];

// Operating-fabric release surface: the production compiler/handler/scene
// modules plus their integration and readiness proof. If any of these go
// missing from the tracked tree, promotion must fail closed rather than
// silently auditing a smaller surface.
const requiredOperatingFabricFiles = [
  'workers/quests/src/mission-fabric.ts',
  'workers/quests/src/handler.ts',
  'workers/quests/src/page/operating-fabric/canopy.ts',
  'workers/quests/src/page/operating-fabric/inspect-sheet.ts',
  'workers/quests/src/mission-fabric-integration.test.ts',
  'workers/quests/src/live-proof-readiness.test.ts',
];

export function auditValueFreeLabsOverlay(text) {
  try {
    const config=JSON.parse(text);
    const owner=resolveQuestsWranglerProfile({profile:'labs-production',operation:'read'});
    const bindings=config.unsafe?.bindings;
    const allowed=new Set(['name','main','account_id','compatibility_date','compatibility_flags','routes','triggers','unsafe','logpush','observability','workers_dev','preview_urls']);
    if (Object.keys(config).some(key=>!allowed.has(key)) || config.name!==owner.workerName || config.account_id!==owner.accountId
      || config.main!=='src/index.ts' || config.routes?.length!==1 || config.routes[0].pattern!==owner.route || config.routes[0].custom_domain!==true
      || Object.keys(config.unsafe || {}).some(key=>key!=='bindings') || !Array.isArray(bindings) || bindings.length!==47
      || new Set(bindings.map(b=>b.name)).size!==47 || bindings.some(b=>b.type!=='inherit' || !/^[A-Z][A-Z0-9_]{0,100}$/.test(b.name)
        || JSON.stringify(Object.keys(b).sort())!==JSON.stringify(['name','type']))) return ['reviewed Labs overlay must remain exact-owner and value-free with 47 unique inherited bindings'];
    return [];
  } catch { return ['reviewed Labs overlay is invalid or its canonical owner cannot be resolved']; }
}

export function runStandaloneAudit() {
  const files = candidateFiles()
    .filter(Boolean)
    .filter((file) => !file.startsWith('docs/plans/assets/'))
    .filter((file) => !file.startsWith('apps/cambium-r3f/public/assets/'))
    .filter((file) => file !== 'workers/quests/wrangler.labs.jsonc')
    .filter((file) => !file.endsWith('VERSIONS.md'));

  const failures = [];
  for (const required of requiredOperatingFabricFiles) {
    if (!files.includes(required)) {
      failures.push(`${required}: operating-fabric proof surface missing from tracked tree`);
    }
  }
  for (const file of files) {
    let text = '';
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (file === 'workers/quests/wrangler.labs.live-inherit.jsonc') failures.push(...auditValueFreeLabsOverlay(text));
    for (const rule of privatePatterns) {
      if (rule.pattern.test(text)) failures.push(`${file}: ${rule.name}`);
    }
    for (const rule of liveDefaultPatterns) {
      const allowed = typeof rule.allowed === 'function' ? rule.allowed(file) : (rule.allowed?.test(file) ?? false);
      if (rule.pattern.test(text) && !allowed) failures.push(`${file}: ${rule.name}`);
    }
  }

  if (failures.length) {
    console.error('standalone audit failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    return 1;
  }

  console.log(`standalone audit passed (${files.length} publishable files checked)`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runStandaloneAudit();
}
