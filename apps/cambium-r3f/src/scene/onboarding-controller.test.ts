import assert from 'node:assert/strict';
import test from 'node:test';
import { browserTourStorage, hasCompletedTour, recordTourCompletion, tourIndex, ONBOARDING_STORAGE_KEY } from './onboarding-controller.ts';

test('absent, malformed, older and forged completion stays open', () => {
  for (const value of [null, '', '{', 'null', 'true', '[]', '{}', '{"version":0,"completed":true}', '{"version":1,"completed":"true"}']) {
    assert.equal(hasCompletedTour({ getItem: () => value, setItem() {} }), false);
  }
  assert.equal(hasCompletedTour(), false);
});
test('completion persists only a versioned reading preference', () => {
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
  assert.equal(recordTourCompletion(storage), true);
  assert.equal(hasCompletedTour(storage), true);
  assert.deepEqual(JSON.parse(entries.get(ONBOARDING_STORAGE_KEY)!), { version: 1, completed: true });
});
test('blocked reads, writes and missing storage never throw', () => {
  const storage = { getItem(): never { throw Error('blocked'); }, setItem(): never { throw Error('quota'); } };
  assert.equal(hasCompletedTour(storage), false);
  assert.equal(recordTourCompletion(storage), false);
  assert.equal(recordTourCompletion(), false);
  assert.equal(browserTourStorage(), undefined);
});
test('step bounds handle empty, shrinking and invalid tours', () => {
  assert.equal(tourIndex(8, 3), 2);
  assert.equal(tourIndex(-1, 3), 0);
  assert.equal(tourIndex(2, 0), 0);
  assert.equal(tourIndex(NaN, 3), 0);
  assert.equal(tourIndex(1.7, 3), 1);
});
