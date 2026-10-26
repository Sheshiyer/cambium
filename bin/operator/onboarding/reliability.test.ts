import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runOnboard } from './run.ts';
import { initOnboarding, advance, runOnboarding, CHECKPOINT_SCHEMA, SCRIPT_DIGEST } from './session.ts';
import { ONBOARDING_SCRIPT } from './script.ts';

const quiet = () => {};
function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'cambium-reliability-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, path: join(dir, 'test.onboarding.json') };
}

test('evidence labels and simulation holds render at every step, including noesis and completed resume', async t => {
  const { dir } = fixture(t);
  const lines: string[] = [];
  await runOnboard({ auto: true, tenant: 'test', stateDir: dir, out: s => lines.push(s) });
  for (const step of ONBOARDING_SCRIPT) assert.ok(lines.includes(`     evidence: ${step.evidenceState}`));
  assert.equal(lines.filter(s => s.includes('Tutorial simulation —')).length, 20);
  assert.match(lines.join('\n'), /Doctrine = designed; Local = repository contract; Held/);
  lines.length = 0;
  await runOnboard({ auto: true, tenant: 'test', stateDir: dir, out: s => lines.push(s) });
  assert.match(lines.join('\n'), /completion grants no live admission/);
});

test('interruption at noesis pause persists the finished step and resumes without duplicate folds', async t => {
  const { dir, path } = fixture(t);
  await assert.rejects(runOnboard({ tenant: 'test', stateDir: dir, out: quiet, input: async () => { throw new Error('interrupted'); } }), /interrupted/);
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(saved.stepIndex, 1);
  assert.equal(saved.schema, CHECKPOINT_SCHEMA);
  assert.equal(saved.scriptDigest, SCRIPT_DIGEST);
  const resumed = await runOnboard({ auto: true, tenant: 'test', stateDir: dir, out: quiet });
  assert.deepEqual(resumed, runOnboarding({ init: { tenant: 'test' } }).state);
  assert.deepEqual(readdirSync(dir), ['test.onboarding.json']);
});

test('valid legacy progress and founder input survive resume and are upgraded on next save', async t => {
  const { dir, path } = fixture(t);
  let state = initOnboarding({ tenant: 'test' });
  for (let n = 0; n < 14; n++) state = advance(state, { text: 'My reversible change' }).state;
  writeFileSync(path, JSON.stringify(state));
  const result = await runOnboard({ auto: true, tenant: 'test', stateDir: dir, out: quiet });
  assert.equal(result.world.artifacts.cta, 'My reversible change');
  assert.equal(result.world.version, 20);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).schema, CHECKPOINT_SCHEMA);
});

for (const [name, mutate] of Object.entries({
  'tenant mismatch': (s: any) => { s.world.tenant = 'other'; },
  'stale script': (s: any) => { s.schema = CHECKPOINT_SCHEMA; s.scriptDigest = 'stale'; },
  'unknown schema': (s: any) => { s.schema = 'future'; s.scriptDigest = SCRIPT_DIGEST; },
  'invalid cursor': (s: any) => { s.stepIndex = 21; },
  'inconsistent version': (s: any) => { s.world.version = 1; },
  'invalid brand': (s: any) => { s.world.brand.setpoint = ['bad']; },
  'invalid drives': (s: any) => { s.drivesActivated = [9]; },
  'invalid noesis': (s: any) => { s.noesisMoments = 3; },
})) test(`${name} fails closed and preserves original checkpoint bytes`, async t => {
  const { dir, path } = fixture(t);
  const state = initOnboarding({ tenant: 'test' });
  mutate(state);
  const original = JSON.stringify(state);
  writeFileSync(path, original);
  await assert.rejects(runOnboard({ auto: true, tenant: 'test', stateDir: dir, out: quiet }), /checkpoint/);
  assert.equal(readFileSync(path, 'utf8'), original);
  assert.deepEqual(readdirSync(dir), ['test.onboarding.json']);
});

test('corrupt JSON is preserved; explicit restart keeps a byte-identical backup', async t => {
  const { dir, path } = fixture(t);
  writeFileSync(path, '{unfinished');
  await assert.rejects(runOnboard({ auto: true, tenant: 'test', stateDir: dir, out: quiet }), /preserved/);
  assert.equal(readFileSync(path, 'utf8'), '{unfinished');
  await runOnboard({ auto: true, restart: true, tenant: 'test', stateDir: dir, out: quiet });
  const backup = readdirSync(dir).find(s => s.endsWith('.backup'))!;
  assert.equal(readFileSync(join(dir, backup), 'utf8'), '{unfinished');
});

test('unsafe tenant and conflicting seed fail before filesystem writes', async t => {
  const { dir } = fixture(t);
  for (const tenant of ['../escape', '', '/absolute', 'a/b']) {
    await assert.rejects(runOnboard({ auto: true, tenant, stateDir: dir, out: quiet }), /tenant/);
  }
  await assert.rejects(runOnboard({ tenant: 'test', seed: { tenant: 'other' }, stateDir: dir, out: quiet }), /mismatch/);
  assert.deepEqual(readdirSync(dir), []);
});
