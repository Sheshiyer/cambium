#!/usr/bin/env node

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { spawnSync } from 'node:child_process'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.status !== 0) process.exit(result.status ?? 1)
  return String(result.stdout || '').trim()
}

const projectsRoot = process.env.PROJECTS_ROOT
if (!projectsRoot || !isAbsolute(projectsRoot)) {
  throw new Error('PROJECTS_ROOT must be an absolute path for a production candidate census')
}

const baseRef = process.env.CAMBIUM_RELEASE_BASE_REF || 'origin/main'
const expectedCommit = process.env.CAMBIUM_CANDIDATE_COMMIT
if (!/^[a-f0-9]{40}$/.test(expectedCommit || '')) {
  throw new Error('CAMBIUM_CANDIDATE_COMMIT must be the exact 40-character reviewed commit')
}

run('git', ['rev-parse', '--verify', `${baseRef}^{commit}`])
run('git', ['merge-base', '--is-ancestor', baseRef, 'HEAD'])
const head = run('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
if (head !== expectedCommit) throw new Error(`candidate HEAD ${head} does not match reviewed commit ${expectedCommit}`)
const dirty = run('git', ['status', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
if (dirty) throw new Error('production candidate worktree must be clean')
const commitCount = run('git', ['rev-list', '--count', `${baseRef}..HEAD`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
if (commitCount !== '1') throw new Error(`production candidate must be exactly one commit ahead of ${baseRef}`)
run(process.execPath, ['scripts/verify-release.mjs'])
run(process.execPath, [
  '--experimental-strip-types',
  'scripts/audit-portfolio-miniapp-linkage.ts',
  '--projects-root', projectsRoot,
  '--strict',
])

const bundleDir = mkdtempSync(join(tmpdir(), 'cambium-production-candidate-'))
try {
  run('npx', [
    '--no-install', 'wrangler', 'versions', 'upload',
    '--config', 'workers/quests/wrangler.labs.jsonc',
    '--dry-run', '--outdir', bundleDir,
  ])
} finally {
  rmSync(bundleDir, { recursive: true, force: true })
}

process.stdout.write(`Production candidate ${head} verified against ${baseRef}.\n`)
