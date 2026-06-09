import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDeviation, resolveDeviation, buildWhyPrompt, recordDeviation } from './lib/whyhandler.mjs';

const dev = { stage: 'build', reason: 'contract drift: declares json:dispatch-plan but output is not parseable JSON' };

// classify — the one-bit error-vs-intent question (HOMEOSTASIS §7)
test('classifyDeviation defaults to error (fail-closed → reroll toward x*)', () => {
  assert.equal(classifyDeviation(dev, {}).kind, 'error');
});

test('classifyDeviation returns intent when the deviation stage is flagged intentional', () => {
  assert.equal(classifyDeviation(dev, { intent: 'build' }).kind, 'intent');
});

test('classifyDeviation: an intent flag for a DIFFERENT stage does not apply (still error)', () => {
  assert.equal(classifyDeviation(dev, { intent: 'taste' }).kind, 'error');
});

// resolve — error rerolls toward the same x*; intent absorbs Δ into the invariant
test('resolveDeviation: error → reroll toward the same x*', () => {
  assert.equal(resolveDeviation(dev, { kind: 'error' }).action, 'reroll');
});

test('resolveDeviation: intent → absorb the rationale (update x*/contract)', () => {
  const r = resolveDeviation(dev, { kind: 'intent' }, 'the logo should contain a garment');
  assert.equal(r.action, 'absorb');
  assert.equal(r.rationale, 'the logo should contain a garment');
});

// the seam the agent fills via AskUserQuestion
test('buildWhyPrompt returns a structured question with error + intent options', () => {
  const p = buildWhyPrompt(dev);
  assert.match(p.question, /why/i);
  assert.ok(p.options.some((o) => /error/i.test(o.label)));
  assert.ok(p.options.some((o) => /intent/i.test(o.label)));
});

// the learning trace (the cortex-write STUB)
test('recordDeviation emits a parseable jsonl line with ts + stage + action', () => {
  const line = recordDeviation({ ts: '2026-06-09T00:00:00Z', stage: 'build', kind: 'intent', action: 'absorb', rationale: 'r' });
  const obj = JSON.parse(line);
  assert.equal(obj.stage, 'build');
  assert.equal(obj.action, 'absorb');
  assert.equal(obj.ts, '2026-06-09T00:00:00Z');
  assert.ok(!line.includes('\n')); // one line; the CLI adds the newline on append
});
