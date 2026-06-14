import assert from 'node:assert/strict';
import test from 'node:test';
import { cambiumQaPolicy, isDesktopReviewViewport } from './desktop-qa-policy.ts';

test('desktop QA policy is laptop and Electron oriented', () => {
  assert.equal(cambiumQaPolicy.electronReadiness.targetShell, 'electron-macos-laptop');
  assert.equal(cambiumQaPolicy.electronReadiness.routeMode, 'hash-route-scene-states');
  assert.deepEqual(cambiumQaPolicy.electronReadiness.inputs, ['keyboard', 'mouse', 'trackpad']);
  assert.ok(cambiumQaPolicy.desktopViewports.every((viewport) => viewport.width >= 1280 && viewport.height >= 800));
});

test('visual acceptance waits for user flow feedback instead of browser visual e2e', () => {
  assert.equal(cambiumQaPolicy.visualFeedbackGate.status, 'awaiting-user-flow-feedback');
  assert.equal(cambiumQaPolicy.visualFeedbackGate.reviewer, 'user');
  assert.equal(cambiumQaPolicy.visualFeedbackGate.browserVisualE2E, 'skipped-by-user-request');
  assert.equal(cambiumQaPolicy.visualFeedbackGate.acceptanceMode, 'human-perceptual-flow-review');
  assert.ok(cambiumQaPolicy.visualFeedbackGate.explicitNonGoals.includes('Playwright visual e2e as the final flow judge'));
});

test('desktop viewport helper rejects mobile-sized review as out of scope', () => {
  assert.equal(isDesktopReviewViewport(1440, 900), true);
  assert.equal(isDesktopReviewViewport(1512, 982), true);
  assert.equal(isDesktopReviewViewport(390, 844), false);
  assert.equal(isDesktopReviewViewport(1024, 768), false);
});
