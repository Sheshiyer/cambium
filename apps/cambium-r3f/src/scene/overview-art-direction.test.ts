import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sceneSource = readFileSync(new URL('./CambiumScene.tsx', import.meta.url), 'utf8');
const hudSource = readFileSync(new URL('./SceneHud.tsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('overview route renders a dedicated reference art layer', () => {
  assert.match(sceneSource, /ReferenceOverviewGlyph/);
  assert.match(sceneSource, /ReferenceRailNetwork/);
  assert.match(sceneSource, /OverviewWorldStatus/);
  assert.match(sceneSource, /variant=\{isReferenceOverview \? 'reference-overview' : 'standard'\}/);
});

test('overview route reduces DOM chrome instead of adding more cards', () => {
  assert.match(hudSource, /isReferenceOverview \? null : \(/);
  assert.match(hudSource, /route-dock--overview/);
  assert.match(hudSource, /operator-strip--overview/);
  assert.match(cssSource, /\.route-dock--overview/);
  assert.match(cssSource, /\.operator-strip--overview/);
});
