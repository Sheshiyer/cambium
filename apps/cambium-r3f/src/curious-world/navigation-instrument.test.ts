import test from 'node:test';
import assert from 'node:assert/strict';
import { projectChartPoint, chartHeading, createInstrumentObserver, INSTRUMENT_INTERVAL_MS } from './navigation-instrument.ts';

test('chart projection retains physical axes and clamps invalid or out-of-world coordinates', () => {
  assert.deepEqual(projectChartPoint({ x: 0, z: 0 }), { x: 120, y: 120 });
  assert.deepEqual(projectChartPoint({ x: 42, z: -42 }), { x: 216, y: 24 });
  assert.deepEqual(projectChartPoint({ x: 99, z: -99 }), { x: 216, y: 24 });
  assert.deepEqual(projectChartPoint({ x: NaN, z: Infinity }, 0), { x: 120, y: 120 });
});

test('movement heading uses the renderer rotation direction and normalizes complete turns', () => {
  assert.equal(chartHeading(0), 0);
  assert.equal(chartHeading(Math.PI / 2), 270);
  assert.equal(chartHeading(-Math.PI / 2), 90);
  assert.equal(chartHeading(Math.PI * 4), 0);
  assert.equal(chartHeading(NaN), 0);
});

test('renderer events coalesce active chart updates but always deliver the final sleeping position', () => {
  const updates: number[] = [];
  const observer = createInstrumentObserver<number>(value => updates.push(value));
  observer.update(1, 0); observer.update(2, 33); observer.update(3, 66); observer.update(4, 125);
  assert.deepEqual(updates, [1, 4]);
  observer.update(5, 140, true);
  assert.deepEqual(updates, [1, 4, 5], 'the last pose cannot be lost behind the chart throttle');
  observer.update(6, NaN, true); observer.dispose(); observer.update(7, 300, true);
  assert.deepEqual(updates, [1, 4, 5], 'nonfinite timestamps and disposed callbacks cannot update the HUD');
});
