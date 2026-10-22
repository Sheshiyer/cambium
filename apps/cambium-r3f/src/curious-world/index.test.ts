import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeJoystick, captureWorldKey } from './index.ts';

test('touch control preserves proportional movement inside its travel radius', () => {
  assert.deepEqual(normalizeJoystick(17, -8.5, 34), { x: 0.5, z: -0.25 });
  assert.deepEqual(normalizeJoystick(0, 0, 34), { x: 0, z: 0 });
});

test('touch control clamps long drags and diagonal speed to a unit direction', () => {
  assert.deepEqual(normalizeJoystick(340, 0, 34), { x: 1, z: 0 });
  const axis = normalizeJoystick(34, -34, 34);
  assert.ok(Math.abs(Math.hypot(axis.x, axis.z) - 1) < 1e-12);
  assert.ok(axis.x > 0 && axis.z < 0);
});

test('invalid touch coordinates and radii stop movement', () => {
  for (const [x, z, radius] of [[NaN, 0, 34], [0, Infinity, 34], [1, 1, 0], [1, 1, -3], [1, 1, NaN]]) {
    assert.deepEqual(normalizeJoystick(x, z, radius), { x: 0, z: 0 });
  }
});

test('game keyboard captures only movement, interaction and escape while it owns focus', () => {
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyE', 'Escape']) {
    assert.equal(captureWorldKey(code, true, false), true, code);
    assert.equal(captureWorldKey(code, false, false), false, `outside focus: ${code}`);
    assert.equal(captureWorldKey(code, true, true), false, `editable target: ${code}`);
  }
});

test('keyboard ownership preserves tab, text shortcuts and unrelated keys', () => {
  for (const code of ['Tab', 'Enter', 'Space', 'KeyC', 'KeyV', 'ControlLeft', 'MetaLeft', '']) {
    assert.equal(captureWorldKey(code, true, false), false, code);
  }
});
