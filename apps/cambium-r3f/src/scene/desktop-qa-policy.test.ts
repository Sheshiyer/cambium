import assert from 'node:assert/strict';
import test from 'node:test';
import { cambiumQaPolicy, isDesktopReviewViewport } from './desktop-qa-policy.ts';

test('desktop QA policy is laptop and Electron oriented', () => {
  assert.equal(cambiumQaPolicy.electronReadiness.targetShell, 'electron-macos-laptop');
  assert.equal(cambiumQaPolicy.electronReadiness.routeMode, 'hash-route-scene-states');
  assert.deepEqual(cambiumQaPolicy.electronReadiness.inputs, ['keyboard', 'mouse', 'trackpad']);
  assert.ok(cambiumQaPolicy.desktopViewports.every((viewport) => viewport.width >= 1280 && viewport.height >= 800));
});

test('visual acceptance policy contains durable gates instead of milestone status', () => {
  assert.equal('status' in cambiumQaPolicy.visualAcceptancePolicy, false);
  assert.equal(cambiumQaPolicy.visualAcceptancePolicy.reviewer, 'human');
  assert.equal(cambiumQaPolicy.visualAcceptancePolicy.browserVisualE2E, 'recommended-not-release-blocking');
  assert.equal(cambiumQaPolicy.visualAcceptancePolicy.acceptanceMode, 'automated-gates-plus-human-reference-review');
  assert.deepEqual(cambiumQaPolicy.visualAcceptancePolicy.automatedGates, ['npm run r3f:test', 'npm run r3f:build']);
  assert.ok(cambiumQaPolicy.visualAcceptancePolicy.explicitNonGoals.includes('Playwright visual e2e as the final flow judge'));
});

test('desktop viewport helper rejects mobile-sized review as out of scope', () => {
  assert.equal(isDesktopReviewViewport(1440, 900), true);
  assert.equal(isDesktopReviewViewport(1512, 982), true);
  assert.equal(isDesktopReviewViewport(390, 844), false);
  assert.equal(isDesktopReviewViewport(1024, 768), false);
});
