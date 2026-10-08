import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRenderBudget } from './render-budget.ts';

test('ordinary desktop and phone retain bounded native detail', () => {
  const phone = calculateRenderBudget(320, 740, 3, true), desktop = calculateRenderBudget(1164, 655, 2, false);
  assert.equal(phone.pixelRatio, 1.2); assert.equal(phone.backbufferPixels, 384 * 888);
  assert.equal(desktop.pixelRatio, 1.5); assert.ok(desktop.backbufferPixels <= 2_000_000);
});
test('4K, ultrawide and very tall views obey the actual integer framebuffer cap', () => {
  for (const [width, height] of [[3840, 2160], [7680, 2160], [1080, 2340], [1, 1_000_000], [10000, 10000]]) {
    for (const mobile of [false, true]) {
      const budget = calculateRenderBudget(width, height, 4, mobile), actual = Math.floor(budget.width * budget.pixelRatio) * Math.floor(budget.height * budget.pixelRatio);
      assert.equal(budget.backbufferPixels, actual); assert.ok(actual > 0 && actual <= (mobile ? 1_000_000 : 2_000_000));
      assert.ok(budget.pixelRatio > 0 && budget.pixelRatio <= (mobile ? 1.2 : 1.5));
    }
  }
  assert.ok(calculateRenderBudget(3840, 2160, 2, false).pixelRatio < 1);
});
test('invalid dimensions/DPR and rounding cannot allocate an unbounded or empty framebuffer', () => {
  for (const width of [NaN, Infinity, -100, 0, .1, 31.99, Number.MAX_VALUE]) for (const height of [NaN, -5, 1, 740.01, 100000]) {
    const b = calculateRenderBudget(width, height, NaN, true);
    assert.ok(Number.isInteger(b.width) && Number.isInteger(b.height)); assert.ok(Number.isFinite(b.pixelRatio));
    assert.ok(b.backbufferPixels > 0 && b.backbufferPixels <= 1_000_000);
  }
});
