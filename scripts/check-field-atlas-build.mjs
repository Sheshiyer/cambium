#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const [bundlePath, metadataPath] = process.argv.slice(2);
if (!bundlePath || !metadataPath) throw new Error('usage: node scripts/check-field-atlas-build.mjs BUNDLE METAFILE');
const bundle = readFileSync(bundlePath, 'utf8');
const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
const forbiddenInputs = /(?:^|\/)page\/(?:retired\.ts|scaffold\.ts|styles\/.*|operating-fabric\/.*|client\/(?:core|boot|data|scene-engine|sheet|signed-action)\.ts|components\/(?:retired-curious-world|mission-control|gallery)\.ts)$/;
assert.deepEqual(Object.keys(metadata.inputs).filter(path => forbiddenInputs.test(path)), [], 'retired UI modules must not enter the Worker build graph');
for (const marker of ['MissionControlShell', 'RootNav', 'data-root-scene', 'function renderMissionControl', 'function renderCommands', 'function renderStory', 'id="operating-fabric"', 'curious-world-launch']) {
  assert.ok(!bundle.includes(marker), `retired UI marker entered the Worker bundle: ${marker}`);
}
for (const marker of ['CuriousPocketWorld', 'CuriousGateBridge', 'CuriousReadBridge', 'Field Atlas']) assert.ok(bundle.includes(marker), `maintained world missing: ${marker}`);
console.log(JSON.stringify({schema:'cambium.field-atlas-build-check.v1',retiredUiInputs:0,retiredUiMarkers:0,worldAndBridgesPresent:true,workerBytes:Buffer.byteLength(bundle)}));
