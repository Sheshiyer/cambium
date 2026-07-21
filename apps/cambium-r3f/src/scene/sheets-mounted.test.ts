import test from 'node:test';
import assert from 'node:assert/strict';
import { MINI_APP_MAP_SUBSECTIONS } from '../../../../shared/mini-app-surface-contract.ts';
import {
  HUD_MODES,
  WORKFORCE_SHEET_ROWS,
  islandSheetRows,
  subsectionSheetRows,
} from './scene-data.ts';
import type { SceneSheetProps } from './SceneSheet.tsx';

test('mode pill model has exactly 3 modes', () => {
  assert.equal(HUD_MODES.length, 3);
  assert.deepEqual([...HUD_MODES], ['map', 'sheets', 'workforce']);
});

test('subsection browser covers all 21 contract subsections', () => {
  assert.equal(MINI_APP_MAP_SUBSECTIONS.length, 21);
  for (const subsection of MINI_APP_MAP_SUBSECTIONS) {
    const props: SceneSheetProps = {
      title: subsection.id.toUpperCase(),
      kicker: `MAP · ${subsection.target.toUpperCase()}`,
      rows: subsectionSheetRows(subsection),
    };
    assert.ok(props.rows.some((row) => row.id === subsection.id), `browser entry covers ${subsection.id}`);
    assert.ok(props.rows.some((row) => row.value === subsection.source), `source row present for ${subsection.id}`);
  }
});

test('islandSheetRows returns >=3 hydrated rows for each island screen', () => {
  const islands = ['island-genesis', 'island-taste', 'island-build', 'island-ops', 'island-cortex'];
  for (const screenId of islands) {
    const rows = islandSheetRows(screenId);
    assert.ok(rows.length >= 3, `${screenId} returns >=3 rows, got ${rows.length}`);
    for (const row of rows) {
      assert.ok(row.label.length > 0, `${screenId} row ${row.id} has a non-empty label`);
      assert.ok(row.value.length > 0, `${screenId} row ${row.id} has a non-empty value`);
    }
  }
});

test('workforce placeholder sheet honestly references the C4 identity plan', () => {
  const text = WORKFORCE_SHEET_ROWS.map((row) => `${row.label} ${row.value}`).join(' ');
  assert.match(text, /identity wiring pending/);
  assert.match(text, /ui-prune-constellation-convergence\.md C4/);
});
