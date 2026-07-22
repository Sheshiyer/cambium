import test from 'node:test';
import assert from 'node:assert/strict';
import type { ConfirmActionControl, ConfirmActionSheetProps } from './ConfirmActionSheet.tsx';
import { MINI_APP_MAP_SUBSECTIONS } from '../../../../shared/mini-app-surface-contract.ts';

test('props contract accepts every signed-action control from the surface contract', () => {
  const signedControls: ConfirmActionControl[] = [];
  for (const sub of MINI_APP_MAP_SUBSECTIONS) {
    for (const control of sub.interactions.controls ?? []) {
      if (control.interaction === 'signed-action') {
        signedControls.push({
          id: control.id,
          interaction: control.interaction,
          source: control.source,
          target: control.target,
        });
      }
    }
  }
  assert.ok(signedControls.length >= 2, 'contract carries signed-action controls');
  for (const control of signedControls) {
    const props: ConfirmActionSheetProps = {
      control,
      onConfirm: (id) => assert.equal(id, control.id),
      onCancel: () => {},
    };
    assert.ok(props.control.id.length > 0);
    assert.ok(props.control.source.length > 0);
  }
});

test('control contract requires id, interaction, and source', () => {
  const control: ConfirmActionControl = {
    id: 'queue-side-quest',
    interaction: 'signed-action',
    source: 'side-quest queue action',
  };
  assert.equal(control.target, undefined);
  const withTarget: ConfirmActionControl = { ...control, target: 'quine' };
  assert.equal(withTarget.target, 'quine');
});
