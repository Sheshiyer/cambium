import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { inspectCodexHooks, summarizeHooks } from './codex-hooks.mjs';

const hook = { eventName: 'sessionStart', enabled: true, trustStatus: 'trusted', handlerType: 'command',
  source: 'user', timeoutSec: 45, currentHash: 'sha256:' + 'a'.repeat(64),
  sourcePath: '/fixture/private-source', command: 'PRIVATE_COMMAND', key: 'PRIVATE_NATIVE_KEY' };
const reply = () => ({ data: [{ hooks: [hook], errors: [], warnings: [] }] });

function nativeFixture({ silent = false, error = false, invalid = false, response = undefined } = {}) {
  const child = new EventEmitter();
  Object.assign(child, { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
  const calls = [];
  let closed = false;
  const close = () => { if (!closed) { closed = true; child.emit('close', 0); } };
  child.kill = close;
  child.stdin.on('finish', close);
  child.stdin.on('data', chunk => {
    const request = JSON.parse(String(chunk));
    calls.push(request);
    if (silent || !request.id) return;
    queueMicrotask(() => child.stdout.write(response !== undefined ? JSON.stringify(response) + '\n' : invalid ? 'malformed\n' : JSON.stringify(error
      ? { id: request.id, error: { message: 'PRIVATE_NATIVE_ERROR' } }
      : { id: request.id, result: request.id === 1 ? {} : reply() }) + '\n'));
  });
  const spawnImpl = (command, args, options) => {
    assert.equal(command, 'codex');
    assert.deepEqual(args, ['app-server', '--listen', 'stdio://']);
    assert.deepEqual(options.stdio, ['pipe', 'pipe', 'pipe']);
    assert.equal(options.detached, true);
    return child;
  };
  return { spawnImpl, calls, closed: () => closed };
}

test('native inventory requests discovery only and closes its process without starting a thread', async () => {
  const fx = nativeFixture();
  const result = await inspectCodexHooks({ cwd: process.cwd(), spawnImpl: fx.spawnImpl });
  assert.deepEqual(fx.calls.map(call => call.method), ['initialize', 'initialized', 'hooks/list']);
  assert.deepEqual(fx.calls[2].params, { cwds: [process.cwd()] });
  assert.equal(fx.closed(), true);
  assert.equal(result.status, 'discovered');
  assert.equal(result.callbackAcceptance, false);
  assert.equal(result.trustChanged, false);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|\/fixture\/private-source/);
});

test('launcher exit with descendant-held pipes has bounded owned-group shutdown', { skip: process.platform === 'win32' }, async t => {
  let child;
  const spawnImpl = (_command, _args, options) => {
    child = spawn(process.execPath, ['-e', `
      const {spawn}=require('node:child_process');
      spawn(process.execPath,['-e','setTimeout(()=>{},10000)'],{stdio:['ignore',process.stdout,process.stderr]}).unref();
      process.exit(0);
    `], options);
    return child;
  };
  t.after(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } });
  const start = performance.now();
  await assert.rejects(inspectCodexHooks({ spawnImpl, timeoutMs: 300 }), /exited|closed|timed out/);
  assert.ok(performance.now() - start < 2000, 'cleanup must not wait for a descendant-held pipe');
  assert.ok(child.stdout.destroyed && child.stderr.destroyed);
});

test('inventory preserves review holds and removes diagnostic bodies', () => {
  const raw = reply();
  raw.data[0].hooks = [{ ...hook, trustStatus: 'modified' }, { ...hook, enabled: false, trustStatus: 'untrusted' }];
  raw.data[0].warnings.push('PRIVATE_WARNING');
  assert.equal(summarizeHooks(raw).status, 'review-required');
  raw.data[0].errors.push({ message: 'PRIVATE_ERROR', path: '/fixture/private-source' });
  const result = summarizeHooks(raw);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.errors, 1);
  assert.equal(result.warnings, 1);
  assert.equal(result.hooks[0].trust, 'modified');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|\/fixture\/private-source/);
});

test('malformed native metadata cannot acquire a discovery result', () => {
  for (const change of [{ eventName: undefined }, { enabled: 'yes' }, { currentHash: 'PRIVATE_KEY' }, { timeoutSec: -1 }, { trustStatus: 'approved' }]) {
    const raw = reply(); raw.data[0].hooks = [{ ...hook, ...change }];
    assert.throws(() => summarizeHooks(raw), /Invalid native hook metadata/);
  }
  assert.throws(() => summarizeHooks({ data: [] }), /Invalid native hook discovery/);
});

test('native timeout, protocol error, malformed output and start failure close the owned process', async () => {
  for (const options of [{ silent: true }, { error: true }, { invalid: true }, { response: null }, { response: [] }, { response: true }]) {
    const fx = nativeFixture(options);
    await assert.rejects(inspectCodexHooks({ spawnImpl: fx.spawnImpl, timeoutMs: 20 }), /timed out|unavailable|invalid JSON|invalid response/);
    assert.equal(fx.closed(), true);
  }
  const fx = nativeFixture({ silent: true });
  const spawnImpl = (...args) => { const child = fx.spawnImpl(...args); queueMicrotask(() => child.emit('error', new Error('PRIVATE_START_ERROR'))); return child; };
  await assert.rejects(inspectCodexHooks({ spawnImpl }), /could not start/);
  assert.equal(fx.closed(), true);
});
