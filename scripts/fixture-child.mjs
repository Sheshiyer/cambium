import { spawn } from 'node:child_process';

/** Test-only child ownership. Capture completion at spawn, including failed
 * spawns and signal exits; callers must stop before removing their fixtures. */
export function startFixtureChild(command, args) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let closed = false, stdout = '', stderr = '', error = null;
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.once('error', cause => { error = cause.message; stderr += cause.message; });
  const done = new Promise(resolve => child.once('close', (code, signal) => {
    closed = true;
    resolve({ code, signal, stdout, stderr, error });
  }));
  return { child, done, async stop(timeoutMs = 2500) {
    if (!closed) child.kill('SIGKILL');
    let timer;
    try {
      await Promise.race([done, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Fixture child shutdown is unconfirmed; preserve its fixture')), timeoutMs);
      })]);
    } finally { clearTimeout(timer); }
  } };
}
