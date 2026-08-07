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
  '50ba63b213debb1df57423c4edf97df79f29d5c77875245dbbc45251266902d2',
]) {
  assert.ok(html.includes(marker), `missing standalone contract marker: ${marker}`)
}

for (const retiredMarker of ['Start project ingestion']) {
  assert.ok(!html.includes(retiredMarker), `retired active-UI marker still present: ${retiredMarker}`)
}

console.log('hosted artifact smoke ok · Thoughtseed planning, Founder Gate intent, and receipt markers present')
