import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('./verify-production-candidate.mjs', import.meta.url), 'utf8')

test('production candidate gate requires exact clean lineage, release, real census, and Worker dry-run', () => {
  assert.match(source, /\['merge-base', '--is-ancestor', baseRef, 'HEAD'\]/)
  assert.match(source, /CAMBIUM_CANDIDATE_COMMIT/)
  assert.match(source, /\['status', '--porcelain'\]/)
  assert.match(source, /\['rev-list', '--count', `\$\{baseRef\}\.\.HEAD`\]/)
  assert.match(source, /scripts\/verify-release\.mjs/)
  assert.match(source, /audit-portfolio-miniapp-linkage\.ts/)
  assert.match(source, /'--projects-root', projectsRoot/)
  assert.match(source, /'--strict'/)
  assert.match(source, /'workers\/quests\/wrangler\.labs\.jsonc'/)
  assert.match(source, /'--dry-run'/)
})
