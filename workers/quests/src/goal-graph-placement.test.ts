import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GATE_PLACEMENT,
  GOAL_GRAPH_PATH_STAGES,
  GOAL_GRAPH_PLACEMENT_ROWS,
  goalGraphPathSegments,
  resolveGoalGraphPlacement,
} from '../../../shared/goal-graph-placement.ts';
import { GOAL_GRAPH_LOADOUT_AUTHORITY } from './goal-graph-loadout-registry.ts';
import { SYSTEM_ATLAS } from '../../../shared/cambium-system-atlas.ts';

const REGISTERED = ['loadout:wtfmedia-source-audit', 'loadout:parkarea-source-audit', 'loadout:relovo-source-audit', 'loadout:fitcheck-launch', 'loadout:iverif-observer'];

test('placement · every registered loadout has exactly one reviewed row', () => {
  for (const loadoutId of REGISTERED) assert.ok(GOAL_GRAPH_LOADOUT_AUTHORITY.resolve(loadoutId), `${loadoutId} is registered`);
  const rows = GOAL_GRAPH_PLACEMENT_ROWS.map((row) => row.loadoutId);
  assert.deepEqual([...rows].sort(), [...REGISTERED].sort());
  assert.equal(new Set(rows).size, rows.length);
});

test('placement · source audits live at Plant/Hands and Fitcheck launch at Growth/Launch Lead', () => {
  assert.deepEqual(resolveGoalGraphPlacement('loadout:relovo-source-audit', true), {
    schema: 'cambium.goal-graph-placement.v1', landmarkId: 'hands', districtId: 'plant', basis: 'loadout',
  });
  assert.equal(resolveGoalGraphPlacement('loadout:wtfmedia-source-audit', true).landmarkId, 'hands');
  assert.deepEqual(resolveGoalGraphPlacement('loadout:fitcheck-launch', true), {
    schema: 'cambium.goal-graph-placement.v1', landmarkId: 'launch-lead', districtId: 'growth', basis: 'loadout',
  });
});

test('placement · unauthorized, unmapped, unknown or missing loadouts stay at the Gate', () => {
  assert.deepEqual(resolveGoalGraphPlacement('loadout:relovo-source-audit', false), GATE_PLACEMENT);
  assert.deepEqual(resolveGoalGraphPlacement('loadout:iverif-observer', true), GATE_PLACEMENT);
  assert.deepEqual(resolveGoalGraphPlacement('loadout:not-registered', true), GATE_PLACEMENT);
  assert.deepEqual(resolveGoalGraphPlacement(null, true), GATE_PLACEMENT);
});

test('placement · every landmark and path edge exists in the system atlas', () => {
  const ids = new Set([...SYSTEM_ATLAS.organs, ...SYSTEM_ATLAS.systems, ...SYSTEM_ATLAS.desks].map((item: { id: string }) => item.id));
  for (const row of GOAL_GRAPH_PLACEMENT_ROWS) assert.ok(ids.has(row.landmarkId), row.landmarkId);
  for (const stage of GOAL_GRAPH_PATH_STAGES) {
    assert.ok(ids.has(stage.from), stage.from);
    assert.ok(ids.has(stage.to), stage.to);
  }
});

test('path · segments light in order up to the proven stage; rejection lights Gate to D1 only', () => {
  assert.deepEqual(goalGraphPathSegments('approved', null), []);
  assert.deepEqual(goalGraphPathSegments('approved', 'committed'), [{ stage: 'committed', from: 'gate', to: 'd1' }]);
  assert.deepEqual(goalGraphPathSegments('approved', 'receipt').map((item) => item.stage), ['committed', 'directive-queued', 'runner-claimed', 'receipt']);
  assert.deepEqual(goalGraphPathSegments('rejected', 'receipt'), [{ stage: 'rejected', from: 'gate', to: 'd1' }]);
});
