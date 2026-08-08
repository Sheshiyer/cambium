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
  '18d5efd69376923be383043894124e7cdda27958a5f47aafe4a6db6342afe542',
]) {
  assert.ok(html.includes(marker), `missing standalone contract marker: ${marker}`)
}

for (const retiredMarker of ['Start project ingestion']) {
  assert.ok(!html.includes(retiredMarker), `retired active-UI marker still present: ${retiredMarker}`)
}

console.log('hosted artifact smoke ok · Thoughtseed planning, Founder Gate intent, and receipt markers present')
