import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  cambiumFieldProfile,
  createCambiumFieldContours,
  createCambiumFieldGeometry,
  createCambiumFieldSeams,
} from './cambium-field.ts';

test('CambiumField replaces checkerboard substrate with an organic field contract', () => {
  assert.equal(cambiumFieldProfile.checkerboard, false);
  assert.equal(cambiumFieldProfile.role, 'living-fractal-substrate');
  assert.equal(cambiumFieldProfile.symmetry, 'organ-radial');
  assert.ok(cambiumFieldProfile.columns > 40);
  assert.ok(cambiumFieldProfile.rows > 28);
});

test('CambiumField geometry is a dense indexed surface with vertex colors', () => {
  const geometry = createCambiumFieldGeometry('overview');
  assert.ok((geometry.getAttribute('position')?.count ?? 0) > 2000);
  assert.equal(geometry.getAttribute('color')?.count, geometry.getAttribute('position')?.count);
  assert.ok((geometry.index?.count ?? 0) > 12000);
  assert.ok(geometry.boundingSphere?.radius);
});

test('CambiumField exposes organic contour and seam paths instead of square grid lines', () => {
  const contours = createCambiumFieldContours('overview');
  const seams = createCambiumFieldSeams('overview');
  assert.equal(contours.length, cambiumFieldProfile.contourCount);
  assert.equal(seams.length, cambiumFieldProfile.seamCount);
  assert.ok(contours.every((contour) => contour.points.length > 100));
  assert.ok(seams.every((seam) => seam.points.length > 30));
});

test('scene no longer renders a checkerboard grid helper substrate', () => {
  const sceneSource = readFileSync(new URL('../scene/CambiumScene.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(sceneSource, /gridHelper/);
});
