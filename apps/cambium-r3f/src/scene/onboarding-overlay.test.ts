import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = readFileSync(new URL('./OnboardingOverlay.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./onboarding.css', import.meta.url), 'utf8');
test('mount interface preserves optional verified role and separates dismiss from completion', () => {
  assert.match(source, /role\?: OnboardingRole/);
  assert.match(source, /export function useOnboardingTour/);
  assert.match(source, /dismiss: \(\) => setOpen\(false\)/);
  assert.match(source, /complete:.*recordTourCompletion/);
  assert.match(source, /replay:.*setReplayKey/);
});
test('tour labels local preview, evidence and authority boundaries', () => {
  for (const phrase of ['LOCAL PREVIEW', 'READ-ONLY TOUR', 'grants no operational authority', 'missing evidence stays held', 'A target is not an achievement', 'ADMITTED, PINNED, EXECUTED and LEARNED']) assert.ok(source.includes(phrase), phrase);
  assert.doesNotMatch(source, /live telemetry|Your seat is read-only/);
});
test('keyboard interception, focus containment and cleanup are declared', () => {
  assert.match(source, /stopImmediatePropagation/);
  for (const type of ['keydown', 'keyup']) {
    assert.ok(source.includes(`addEventListener('${type}', onKey, true)`));
    assert.ok(source.includes(`removeEventListener('${type}', onKey, true)`));
  }
  assert.match(source, /event.key === 'Tab'/);
  assert.match(source, /event.key === 'Escape'/);
  assert.match(source, /previous\?\.isConnected/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /addEventListener\('focusin', keepFocus\)/);
});
test('responsive styling supports reduced motion without inherited global button styles', () => {
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /100dvh/);
  assert.match(css, /flex-wrap: wrap/);
  assert.match(css, /focus-visible/);
});
test('overlay performs no network, provider or operational mutation', () => {
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage\.setItem|dispatchAction/);
});
