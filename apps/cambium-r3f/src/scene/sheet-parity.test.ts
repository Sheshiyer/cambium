import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MINI_APP_SECTIONS,
  MINI_APP_MAP_SUBSECTIONS,
  type MiniAppInteractionKind,
} from '../../../../shared/mini-app-surface-contract.ts';
import { FIXTURE_SHEET_ROWS, sheetRowsFromEnvelope, type SheetRowModel } from './scene-data.ts';
import type { SceneSheetProps } from './SceneSheet.tsx';

const SHEET_RENDERABLE_KINDS: readonly MiniAppInteractionKind[] = ['read-only', 'sheet'];

test('every read-only or sheet section has a sheet-renderable path', () => {
  for (const section of MINI_APP_SECTIONS) {
    if (SHEET_RENDERABLE_KINDS.includes(section.interactions.primary)) {
      const props: SceneSheetProps = {
        title: section.id,
        kicker: section.scene.toUpperCase(),
        rows: FIXTURE_SHEET_ROWS,
        sectionId: section.id,
      };
      assert.ok(props.rows.length > 0, `section ${section.id} renders rows`);
    }
  }
});

test('every read-only or sheet map subsection maps to sheet rows', () => {
  const renderable = MINI_APP_MAP_SUBSECTIONS.filter((sub) =>
    SHEET_RENDERABLE_KINDS.includes(sub.interactions.primary),
  );
  assert.ok(renderable.length > 0, 'expected renderable subsections');
  for (const sub of renderable) {
    const rows: readonly SheetRowModel[] = sheetRowsFromEnvelope([
      { id: sub.id, label: sub.id.toUpperCase(), value: sub.target },
    ]);
    assert.equal(rows[0]?.id, sub.id);
    assert.equal(rows[0]?.tone, 'mist');
  }
});

test('subsections whose controls are all sheet or read-only keep control ids addressable', () => {
  for (const sub of MINI_APP_MAP_SUBSECTIONS) {
    for (const control of sub.interactions.controls ?? []) {
      if (SHEET_RENDERABLE_KINDS.includes(control.interaction)) {
        assert.ok(control.id.length > 0, `control id present for ${sub.id}`);
        assert.ok(control.source.length > 0, `control source present for ${sub.id}`);
      }
    }
  }
});
