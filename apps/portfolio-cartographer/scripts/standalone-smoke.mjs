import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const html = await readFile(path.join(root, 'bundle.html'), 'utf8')
const repositoryEvidenceSource = await readFile(path.join(root, 'src/repository-evidence.generated.ts'), 'utf8')
const repositoryEvidenceDigest = /REPOSITORY_EVIDENCE_DIGEST = "([0-9a-f]{64})"/.exec(repositoryEvidenceSource)?.[1]
assert.ok(repositoryEvidenceDigest, 'generated repository evidence digest is missing')

for (const marker of [
  'Portfolio Workbench',
  'Plan active portfolio',
  'Catalog totals',
  'Portfolio → TG Mini App linkage',
  'D1 Goal Graph admission',
  'Hermes transport only',
  'Slash commands remain Hermes-plugin-owned',
  'white-labelable',
  'needs-review',
  'this-year',
  'Genesis',
  'Taste',
  'Hands',
  'Will',
  'Cortex',
  'Mini App Gate required',
  'Exceptional signal escalates to Alerts',
  'Save & queue repository review',
  'New Thoughtseed project',
  'Save creation intent',
  'local-founder',
  '/v1/admin/portfolio/actions',
  repositoryEvidenceDigest,
]) {
  assert.ok(html.includes(marker), `missing standalone contract marker: ${marker}`)
}

for (const retiredMarker of ['Start project ingestion']) {
  assert.ok(!html.includes(retiredMarker), `retired active-UI marker still present: ${retiredMarker}`)
}

console.log('hosted artifact smoke ok · active/catalog truth, linkage, Founder Gate intent, and receipt markers present')
