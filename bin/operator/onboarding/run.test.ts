// Cambium operator · onboarding runner (M1 / A3, issue #11) — smoke tests (out + state injected,
// hermetic tmp stateDir). Run directly: node --test bin/operator/onboarding/run.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runOnboard } from './run.ts';

function capture() {
  const lines: string[] = [];
  return { lines, out: (s: string) => lines.push(s) };
}
const DIR = join(tmpdir(), 'cambium-onboard-test');

test('runner · --auto --restart walks all 20 steps with a counter, ends complete (exit-clean)', async () => {
  const { lines, out } = capture();
  const state = await runOnboard({ auto: true, restart: true, stateDir: DIR, out, tenant: 'auto' });
  assert.equal(state.stepIndex, 20);
  assert.equal(state.world.version, 20);
  for (let n = 1; n <= 20; n++) assert.ok(lines.some((l) => l.includes(`#${n}/20`)), `missing step counter #${n}/20`);
});

test('runner · renders the running drive count + the final Octalysis summary', async () => {
  const { lines, out } = capture();
  const state = await runOnboard({ auto: true, restart: true, stateDir: DIR, out, tenant: 'auto' });
  const text = lines.join('\n');
  assert.match(text, /drives activated:\s+1 2 3 4 5 6 7 8/);
  assert.match(text, /noesis moments:\s+3/);
  assert.match(text, /world version:\s+20/);
  assert.match(text, /the operator goes dormant/);
  assert.equal(state.noesisMoments, 3);
});

test('runner · every lane step renders its routing class flag (micro/meso/macro/heartbeat)', async () => {
  const { lines, out } = capture();
  await runOnboard({ auto: true, restart: true, stateDir: DIR, out, tenant: 'auto' });
  const text = lines.join('\n');
  for (const c of ['[micro', '[meso', '[macro', '[heartbeat']) {
    assert.ok(text.includes(c), `runner never rendered ${c}`);
  }
});

test('noesis (A4) · the held frame renders at EXACTLY 3 beats — and noesis is no longer an inline tag', async () => {
  const { lines, out } = capture();
  await runOnboard({ auto: true, restart: true, stateDir: DIR, out, tenant: 'auto' });
  const frames = lines.filter((l) => l.includes('◆ NOESIS')).length;
  assert.equal(frames, 3, 'exactly three noesis held frames');
  assert.ok(!lines.some((l) => l.includes('[midbrain · noesis]')), 'noesis must be a held frame, not an inline metric tag');
});

test('noesis (A4) · the held frame appears ONLY at #1, #18, #20 (ordinary steps never hold)', async () => {
  const { lines, out } = capture();
  await runOnboard({ auto: true, restart: true, stateDir: DIR, out, tenant: 'auto' });
  const blocks = lines.join('\n').split(/#(\d+)\/20/);
  const noesisSteps: number[] = [];
  for (let i = 1; i < blocks.length; i += 2) {
    if ((blocks[i + 1] ?? '').includes('◆ NOESIS')) noesisSteps.push(Number(blocks[i]));
  }
  assert.deepEqual(noesisSteps.sort((a, b) => a - b), [1, 18, 20]);
});

test('runner · injected input threads founder text into the scripted artifact (CTA at #14)', async () => {
  const { out } = capture();
  let i = 0;
  const input = async () => { i += 1; return i === 14 ? 'Begin.' : ''; };
  const state = await runOnboard({ restart: true, stateDir: DIR, out, input, tenant: 'input' });
  assert.equal(state.world.artifacts.cta, 'Begin.');
  assert.equal(state.stepIndex, 20);
});

test('runner · persists + resumes — a second run without --restart reports complete', async () => {
  const dir = join(tmpdir(), 'cambium-onboard-resume');
  const a = capture();
  await runOnboard({ auto: true, restart: true, stateDir: dir, out: a.out, tenant: 'resume' });
  const b = capture();
  const state = await runOnboard({ auto: true, stateDir: dir, out: b.out, tenant: 'resume' });
  assert.equal(state.stepIndex, 20);
  assert.ok(b.lines.join('\n').includes('already complete'), 'second run should detect the saved complete session');
});
