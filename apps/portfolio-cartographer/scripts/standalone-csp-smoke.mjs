import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bundle = readFileSync(path.join(root, 'bundle.html'), 'utf8')
function playwrightHeadlessShells() {
  const cache = path.join(homedir(), 'Library', 'Caches', 'ms-playwright')
  try {
    return readdirSync(cache, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('chromium_headless_shell-'))
      .map((entry) => path.join(cache, entry.name, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'))
      .filter((candidate) => existsSync(candidate))
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
  } catch {
    return []
  }
}

const candidates = [
  String(process.env.CHROME_BIN || '').trim(),
  ...playwrightHeadlessShells(),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean)
const chrome = candidates.find((candidate) => existsSync(candidate))
assert.ok(chrome, 'standalone CSP smoke requires a Chromium browser; set CHROME_BIN')

const meta = bundle.match(/<meta http-equiv="Content-Security-Policy" content="[^"]+" \/>/)?.[0]
assert.ok(meta, 'bundle carries the document-enforced CSP meta')
const probe = `<script>
fetch('/csp-probe').then(function () {
  document.documentElement.setAttribute('data-csp-probe', 'allowed');
}).catch(function () {
  document.documentElement.setAttribute('data-csp-probe', 'blocked');
});
</script>`
const instrumented = `<!doctype html><html><head>${meta}</head><body>${probe}</body></html>`

let probeRequests = 0
const server = createServer((request, response) => {
  if (request.url === '/bundle.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(instrumented)
    return
  }
  if (request.url === '/csp-probe') {
    probeRequests += 1
    response.writeHead(204)
    response.end()
    return
  }
  response.writeHead(404)
  response.end('not found')
})

await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})

const address = server.address()
assert.ok(address && typeof address === 'object', 'CSP smoke server has an address')
const profile = mkdtempSync(path.join(tmpdir(), 'portfolio-csp-smoke-'))

try {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(chrome, [
      '--headless=new',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profile}`,
      '--virtual-time-budget=3000',
      '--dump-dom',
      `http://127.0.0.1:${address.port}/bundle.html`,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.once('error', reject)
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Chromium CSP smoke exceeded 15 seconds'))
    }, 15_000)
    child.once('close', (code) => {
      clearTimeout(timeout)
      resolve({ code, stdout, stderr })
    })
  })
  assert.equal(result.code, 0, `Chromium CSP smoke exited cleanly: ${result.stderr.slice(0, 500)}`)
  assert.match(result.stdout, /data-csp-probe="blocked"/, 'document CSP blocks the injected same-origin fetch')
  assert.equal(probeRequests, 0, 'the blocked same-origin fetch never reaches the server')
} finally {
  await new Promise((resolve) => server.close(resolve))
  rmSync(profile, { recursive: true, force: true })
}

console.log('standalone CSP smoke ok · document meta blocks same-origin fetch before network dispatch')
