import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const html = await readFile(path.join(root, 'bundle.html'), 'utf8')

assert.match(html, /<meta name="thoughtseed-artifact" content="portfolio-workbench@v2; offline; proposal-only"/)
assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'"/)
assert.match(html, /thoughtseed\.portfolio-workbench\.v2/)
assert.doesNotMatch(html, /<script[^>]+src=/i)
assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/i)
assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|WebSocket\(|sendBeacon\(|api\.telegram\.org|<form/i)

console.log(`standalone audit ok · one offline HTML · ${Buffer.byteLength(html)} bytes · zero egress primitives`)
