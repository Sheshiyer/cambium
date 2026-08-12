import assert from 'node:assert/strict';
import test from 'node:test';

import { COMPONENT_MISSION_CONTROL } from './page/components/mission-control.ts';
import { SCENE_INSPECT } from './page/scenes/inspect.ts';

interface MiniAppQuestHelpers {
  mcStateKind(raw: unknown): string;
  mcOrganMetaForBranch(branch: unknown, mission: unknown): {
    glyph: string;
    label: string;
    state: string;
  };
}

function loadHelpers(): MiniAppQuestHelpers {
  const registry = "const MC_COMPONENT_REGISTRY = { MissionGlyph: ['genesis', 'taste', 'build', 'ops', 'cortex', 'arc', 'proof', 'gate'] };";
  return Function(`${registry}\n${COMPONENT_MISSION_CONTROL}\n${SCENE_INSPECT}\nreturn { mcStateKind, mcOrganMetaForBranch };`)() as MiniAppQuestHelpers;
}

test('Mini App keeps Fitcheck review and external waits non-terminal', () => {
  const { mcStateKind } = loadHelpers();

  assert.equal(mcStateKind('ready-for-review'), 'proof-needed');
  assert.equal(mcStateKind('external-wait'), 'proof-needed');
  assert.equal(mcStateKind('proposed'), 'proof-needed');
  assert.equal(mcStateKind('approved'), 'active');
  assert.equal(mcStateKind('complete'), 'complete');
  assert.equal(mcStateKind('superseded'), 'complete');
});

test('Mini App derives the active organ state from its routed status', () => {
  const { mcOrganMetaForBranch } = loadHelpers();
  const activeOrgan = mcOrganMetaForBranch({
    controls: {
      organRouting: [
        { organ: 'Genesis', currentGate: 'verified, do not regenerate', status: 'verified' },
        { organ: 'Taste', currentGate: 'current projection remains pending', status: 'pending' },
        { organ: 'Will', currentGate: 'blocked until approval', status: 'blocked' },
      ],
    },
  }, null);

  assert.equal(activeOrgan.glyph, 'taste');
  assert.equal(activeOrgan.label, 'Taste');
  assert.equal(activeOrgan.state, 'proof-needed');
});

test('Mini App falls back to current gate wording for legacy organ routes', () => {
  const { mcOrganMetaForBranch } = loadHelpers();
  const activeOrgan = mcOrganMetaForBranch({
    controls: {
      organRouting: [
        { organ: 'Genesis', currentGate: 'verified, do not regenerate' },
        { organ: 'Will', currentGate: 'blocked until outreach approval' },
      ],
    },
  }, null);

  assert.equal(activeOrgan.glyph, 'ops');
  assert.equal(activeOrgan.label, 'Will');
  assert.equal(activeOrgan.state, 'blocked');
});
