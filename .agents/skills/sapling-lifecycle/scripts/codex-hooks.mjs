import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Public-safe discovery projection. Never retain commands, local paths, native
 * keys, environment identifiers, or error/warning bodies from the native reply. */
export function summarizeHooks(result, observedAt = new Date().toISOString()) {
  if (!Array.isArray(result?.data) || result.data.length !== 1) throw new Error('Invalid native hook discovery response');
  const entry = result.data[0];
  if (!Array.isArray(entry.hooks) || !Array.isArray(entry.errors) || !Array.isArray(entry.warnings)) throw new Error('Invalid native hook discovery entry');
  const hooks = entry.hooks.map(hook => {
    if (!hook || typeof hook.eventName !== 'string' || !/^[a-zA-Z]{1,80}$/.test(hook.eventName) || typeof hook.enabled !== 'boolean'
        || !['managed', 'trusted', 'untrusted', 'modified'].includes(hook.trustStatus)
        || !['command', 'mcpTool', 'prompt', 'agent'].includes(hook.handlerType)
        || !Number.isSafeInteger(hook.timeoutSec) || hook.timeoutSec < 0
        || typeof hook.source !== 'string' || !/^[a-zA-Z]{1,80}$/.test(hook.source)
        || !/^(?:sha256:)?[a-f0-9]{64}$/.test(hook.currentHash)) throw new Error('Invalid native hook metadata');
    return { event: hook.eventName, enabled: hook.enabled, trust: hook.trustStatus,
      type: hook.handlerType, source: hook.source, timeoutSeconds: hook.timeoutSec, definitionDigest: `sha256:${hook.currentHash.replace(/^sha256:/, '')}` };
  });
  return { schema: 'cambium.codex-hook-inventory.v1', observedAt,
    status: entry.errors.length ? 'unavailable'
      : entry.warnings.length || hooks.some(hook => hook.enabled && !['trusted', 'managed'].includes(hook.trust)) ? 'review-required' : 'discovered',
    hooks, errors: entry.errors.length, warnings: entry.warnings.length,
    evidenceScope: 'native-discovery-only', callbackExecution: 'unobserved', callbackAcceptance: false,
    registrationChanged: false, trustChanged: false };
}

/** Inspect the installed CLI through its existing hooks/list method. No thread
 * is started, no hook is invoked, and this short-lived process is closed here. */
export async function inspectCodexHooks({ cwd = process.cwd(), timeoutMs = 15000, spawnImpl = spawn } = {}) {
  if (process.platform === 'win32') throw new Error('Native hook inventory shutdown is not qualified on Windows');
  // A distinct group confines shutdown to this invocation, including a CLI
  // launcher's descendants. Never inspect or signal another client process.
  const child = spawnImpl('codex', ['app-server', '--listen', 'stdio://'], { cwd, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let closed = false, failure = null, bytes = 0;
  const ended = new Promise(resolve => child.once('close', () => { closed = true; resolve(); }));
  const fail = message => {
    failure ??= new Error(message);
    for (const waiter of pending.values()) waiter.reject(failure);
    pending.clear();
  };
  child.once('error', () => fail('Native Codex discovery could not start'));
  child.once('exit', () => fail('Native Codex discovery exited before its response'));
  child.once('close', () => fail('Native Codex discovery closed before its response'));
  child.stdin.on('error', () => fail('Native Codex discovery input closed'));
  child.stderr.resume();
  child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 2_000_000) fail('Native Codex discovery exceeded its output bound'); });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    if (failure) return;
    let value;
    try { value = JSON.parse(line); } catch { fail('Native Codex discovery returned invalid JSON'); return; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) { fail('Native Codex discovery returned an invalid response'); return; }
    const waiter = pending.get(value.id);
    if (!waiter) return;
    pending.delete(value.id);
    if (value.error || !value.result) waiter.reject(new Error('Native Codex hook discovery is unavailable'));
    else waiter.resolve(value.result);
  });
  const request = (id, method, params) => new Promise((resolve, reject) => {
    if (failure) { reject(failure); return; }
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
  const timer = setTimeout(() => fail('Native Codex hook discovery timed out'), timeoutMs);
  try {
    await request(1, 'initialize', { clientInfo: { name: 'cambium-hook-inventory', version: '1' }, capabilities: { experimentalApi: true } });
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    return summarizeHooks(await request(2, 'hooks/list', { cwds: [resolve(cwd)] }));
  } finally {
    clearTimeout(timer);
    lines.close();
    child.stdin.end();
    const waitForClose = async () => {
      let timer;
      try { await Promise.race([ended, new Promise(resolve => { timer = setTimeout(resolve, 250); })]); }
      finally { clearTimeout(timer); }
    };
    const signalOwnedGroup = signal => {
      try {
        if (Number.isSafeInteger(child.pid) && child.pid > 0) { process.kill(-child.pid, signal); return true; }
        if (!closed) { child.kill(signal); return true; }
        return false;
      } catch (error) {
        if (error.code === 'ESRCH') return false;
        throw new Error('Native Codex discovery shutdown is unconfirmed', { cause: error });
      }
    };
    await waitForClose();
    const signaled = signalOwnedGroup('SIGTERM');
    child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
    if (signaled) {
      await new Promise(resolve => setTimeout(resolve, 250));
      signalOwnedGroup('SIGKILL');
    }
    if (!closed) await waitForClose();
    if (!closed) throw new Error('Native Codex discovery shutdown is unconfirmed');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error('Run from the selected checkout; no flags or installation mode are supported');
    const result = await inspectCodexHooks();
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'discovered') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
