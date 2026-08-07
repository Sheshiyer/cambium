import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const html = await readFile(path.join(root, 'bundle.html'), 'utf8')

assert.match(html, /<meta name="thoughtseed-artifact" content="portfolio-workbench@v4; hosted-admin; r2-receipted"/)
assert.match(html, /<meta name="thoughtseed-portfolio-root-map" content="thoughtseed\.portfolio-root-map\.v1"/)
assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'self'; base-uri 'none'; form-action 'none'"/)
assert.match(html, /thoughtseed\.portfolio-workbench\.v2/)
assert.match(html, /thoughtseed\.portfolio-workbench\.v3/)
assert.doesNotMatch(html, /<script[^>]+src=/i)
assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/i)
assert.match(html, /\/v1\/admin\/portfolio\/actions/)
assert.doesNotMatch(html, /XMLHttpRequest|WebSocket\(|sendBeacon\(|api\.telegram\.org|<form/i)

console.log(`hosted artifact audit ok · one HTML · ${Buffer.byteLength(html)} bytes · same-origin admin action only`)
