import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const html = await readFile(path.join(root, 'bundle.html'), 'utf8')

for (const marker of [
  'Portfolio Workbench',
  'Plan the portfolio',
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
  '43630e6e65dfa78cd5c5e486b389308a8dede9d7bda012b400f4976107cdb309',
]) {
  assert.ok(html.includes(marker), `missing standalone contract marker: ${marker}`)
}

for (const retiredMarker of ['Start project ingestion']) {
  assert.ok(!html.includes(retiredMarker), `retired active-UI marker still present: ${retiredMarker}`)
}

console.log('hosted artifact smoke ok · Thoughtseed planning, Founder Gate intent, and receipt markers present')
