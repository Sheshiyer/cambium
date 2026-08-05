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
  '93b90ed7cee268ac7ee87321a88efefced7980349658cf3c640657a71c361281',
]) {
  assert.ok(html.includes(marker), `missing standalone contract marker: ${marker}`)
}

console.log('standalone smoke ok · planning, provenance, horizons, organs, Gate, Alerts, and receipt markers present')
