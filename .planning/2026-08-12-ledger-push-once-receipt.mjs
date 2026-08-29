const TENANT = 'cambium'
const BASE_URL = 'https://cambium-quests.sheshnarayan-iyer.workers.dev'
const TARGET_URL = `${BASE_URL}/internal/ledger/${TENANT}`

const nativeFetch = globalThis.fetch
const nativeLog = console.log
let postCount = 0

let resolveReceipt
let rejectReceipt
const receiptPromise = new Promise((resolve, reject) => {
  resolveReceipt = resolve
  rejectReceipt = reject
})

let resolveCli
const cliPromise = new Promise((resolve) => {
  resolveCli = resolve
})

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url
  const method = String(init.method ?? input?.method ?? 'GET').toUpperCase()
  const isLedgerPost = method === 'POST' && url === TARGET_URL
  if (isLedgerPost) {
    postCount += 1
    if (postCount > 1) throw new Error('second ledger POST refused')
  }

  try {
    const response = await nativeFetch(input, init)
    if (isLedgerPost) {
      const clone = response.clone()
      const contentType = clone.headers.get('content-type') ?? ''
      const body = contentType.toLowerCase().includes('application/json')
        ? await clone.json().catch(() => null)
        : null
      resolveReceipt({ status: clone.status, contentType, body })
    }
    return response
  } catch (error) {
    if (isLedgerPost) rejectReceipt(error)
    throw error
  }
}

console.log = (...args) => {
  nativeLog(...args)
  if (args.length !== 1 || typeof args[0] !== 'string') return
  try {
    const parsed = JSON.parse(args[0])
    if (parsed?.hypha === 'quests' && typeof parsed.pushed === 'boolean') resolveCli(parsed)
  } catch {
    // Non-JSON diagnostic output is never treated as the Quine result.
  }
}

process.argv = [
  process.execPath,
  'bin/quine/quine.ts',
  'write',
  'quests',
  'push',
  '--tenant',
  TENANT,
  '--url',
  BASE_URL,
]

let timeoutId
const timeout = new Promise((_, reject) => {
  timeoutId = setTimeout(() => reject(new Error('one-shot receipt capture timed out')), 120_000)
})

try {
  await import(`../bin/quine/quine.ts?one-shot=${Date.now()}`)
  const [worker, cli] = await Promise.race([
    Promise.all([receiptPromise, cliPromise]),
    timeout,
  ])
  const receiptKeys = worker.body && typeof worker.body === 'object'
    ? Object.keys(worker.body).sort()
    : []
  const exactReceipt = worker.status === 200
    && worker.contentType.toLowerCase().includes('application/json')
    && receiptKeys.join(',') === 'bytes,derivedAt,ok,tenant'
    && worker.body.ok === true
    && worker.body.tenant === TENANT
    && typeof worker.body.bytes === 'number'
    && typeof worker.body.derivedAt === 'string'
    && postCount === 1
    && cli.pushed === true
    && cli.status === worker.status
    && cli.tenant === worker.body.tenant
    && cli.derivedAt === worker.body.derivedAt
    && cli.bytes === worker.body.bytes

  nativeLog(JSON.stringify({
    schema: 'cambium.ledger-push-one-shot-capture.v1',
    target: TARGET_URL,
    postCount,
    workerStatus: worker.status,
    workerContentType: worker.contentType,
    exactWorkerReceipt: worker.body,
    cliResult: cli,
    accepted: exactReceipt,
  }, null, 2))
  if (!exactReceipt) process.exitCode = 1
} finally {
  clearTimeout(timeoutId)
  globalThis.fetch = nativeFetch
  console.log = nativeLog
}
