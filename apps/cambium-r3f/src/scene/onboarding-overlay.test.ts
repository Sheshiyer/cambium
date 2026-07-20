import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const overlaySource = readFileSync(new URL('./OnboardingOverlay.tsx', import.meta.url), 'utf8');

test('OnboardingOverlay module exposes the overlay component and role tour steps', () => {
  assert.match(overlaySource, /export\s+function\s+OnboardingOverlay/);
  assert.match(overlaySource, /export\s+const\s+ROLE_TOUR_STEPS/);
  assert.match(overlaySource, /onDone\(\).*Escape|Escape.*onDone\(\)/s);
});

test('ROLE_TOUR_STEPS carries at least three fully-populated consultant steps', () => {
  const block = overlaySource.match(
    /export const ROLE_TOUR_STEPS[\s\S]*?=\s*\[([\s\S]*?)\n\];/,
  );
  assert.ok(block, 'ROLE_TOUR_STEPS array literal must be present');

  const body = block[1];
  assert.ok((body.match(/kicker:/g) ?? []).length >= 3, 'expected >= 3 kickers');
  assert.ok((body.match(/title:/g) ?? []).length >= 3, 'expected >= 3 titles');
  assert.ok((body.match(/body:/g) ?? []).length >= 3, 'expected >= 3 bodies');

  assert.ok(!/kicker:\s*''/.test(body), 'every kicker must be non-empty');
  assert.ok(!/title:\s*''/.test(body), 'every title must be non-empty');
  assert.ok(!/body:\s*''/.test(body), 'every body must be non-empty');
});
