// cambium-quests · mini-app surface RBAC tests (node:test, like everything beside it).
//
// Pins the server-side envelope-filtering rules in rbac.ts: role ceilings on
// the interaction ladder, consultant per-subsection allow-lists, expiry, and
// the absence-not-disabled contract (disallowed surface is omitted, and inputs
// are never mutated). Precedence: view kinds (sheet, external-proof) are
// allow-listable for consultants; action kinds (chat-command, signed-action)
// always yield to the ceiling, allow-list or not.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MINI_APP_MAP_SUBSECTIONS,
  MINI_APP_SCENE_IDS,
  MINI_APP_SECTIONS,
  OPERATING_FABRIC_SCENE_IDS,
  type MiniAppMapSubsection,
} from './mini-app-surface-contract.ts';
import {
  filterSections,
  filterSubsections,
  isConsultantVisible,
  permits,
  type Principal,
} from './rbac.ts';

const NOW = new Date('2026-07-21T12:00:00.000Z');

const makePrincipal = (overrides: Partial<Principal> = {}): Principal => ({
  id: 'p-1',
  tenant: 'thoughtseed',
  role: 'founder',
  allow: [],
  createdBy: 'p-0',
  ...overrides,
});

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
};

test('permits orders the ladder against each role ceiling', () => {
  assert.equal(permits('read-only', 'consultant'), true);
  assert.equal(permits('external-proof', 'consultant'), false);
  assert.equal(permits('sheet', 'consultant'), false);

  assert.equal(permits('chat-command', 'team'), true);
  assert.equal(permits('sheet', 'team'), true);
  assert.equal(permits('signed-action', 'team'), false);

  assert.equal(permits('signed-action', 'founder'), true);
});

test('founder sees all 24 map subsections unchanged', () => {
  const out = filterSubsections(MINI_APP_MAP_SUBSECTIONS, makePrincipal(), NOW);
  assert.equal(out.length, 24);
  assert.deepEqual(out, MINI_APP_MAP_SUBSECTIONS);
});

test('consultant with empty allow-list gets zero subsections', () => {
  const out = filterSubsections(
    MINI_APP_MAP_SUBSECTIONS,
    makePrincipal({ role: 'consultant', allow: [] }),
    NOW,
  );
  assert.deepEqual(out, []);
});

test('consultant keep an allow-listed read-only-primary subsection', () => {
  const fixtures: MiniAppMapSubsection[] = [
    { id: 'lanes', target: 'quine', interactions: { primary: 'read-only' }, source: 'fixture' },
    { id: 'wake', target: 'quine', interactions: { primary: 'read-only' }, source: 'fixture' },
  ];
  const out = filterSubsections(
    fixtures,
    makePrincipal({ role: 'consultant', allow: ['lanes'] }),
    NOW,
  );
  assert.deepEqual(out, [fixtures[0]]);
});

test('allow-list grants consultants visibility to sheet-primary subsections', () => {
  // A sheet is a viewing surface: allow-listed consultants see it even though
  // 'sheet' exceeds their ceiling. The ceiling still strips action controls.
  const out = filterSubsections(
    MINI_APP_MAP_SUBSECTIONS,
    makePrincipal({ role: 'consultant', allow: ['lanes'] }),
    NOW,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]?.id, 'lanes');
  assert.equal(out[0]?.interactions.primary, 'sheet');
});

test('ceiling still wins for action kinds: signed-action-primary items stay hidden', () => {
  const fixtures: MiniAppMapSubsection[] = [
    { id: 'danger', target: 'quine', interactions: { primary: 'signed-action' }, source: 'fixture' },
  ];
  const out = filterSubsections(
    fixtures,
    makePrincipal({ role: 'consultant', allow: ['danger'] }),
    NOW,
  );
  assert.deepEqual(out, []);
});

test('isConsultantVisible reflects role plus allow-list', () => {
  const consultant = makePrincipal({ role: 'consultant', allow: ['lanes'] });
  assert.equal(isConsultantVisible(consultant, 'lanes'), true);
  assert.equal(isConsultantVisible(consultant, 'wake'), false);
  assert.equal(isConsultantVisible(makePrincipal({ role: 'team', allow: ['lanes'] }), 'lanes'), false);
});

test('team keeps chat-command controls but loses signed-action controls', () => {
  const out = filterSubsections(MINI_APP_MAP_SUBSECTIONS, makePrincipal({ role: 'team' }), NOW);
  assert.equal(out.length, 24, 'team ceiling keeps every sheet/external-proof primary');

  const sideQuests = out.find((s) => s.id === 'side-quests');
  assert.ok(sideQuests);
  assert.equal(
    sideQuests.interactions.controls?.some((c) => c.id === 'queue-side-quest') ?? false,
    false,
    'signed-action control queue-side-quest stripped for team',
  );

  const skills = out.find((s) => s.id === 'skills');
  assert.ok(skills);
  assert.equal(
    skills.interactions.controls?.some((c) => c.id === 'promote-skill-review') ?? false,
    false,
    'signed-action control promote-skill-review stripped for team',
  );
});

test('team keeps chat-command section controls, drops signed-action-primary sections', () => {
  const out = filterSections(MINI_APP_SECTIONS, makePrincipal({ role: 'team' }), NOW);
  assert.equal(
    out.some((s) => s.id === 'founder-gate'),
    false,
    'founder-gate primary is signed-action, above the team ceiling',
  );

  const toolbelt = out.find((s) => s.id === 'operator-toolbelt');
  assert.ok(toolbelt);
  const controlIds = toolbelt.interactions.controls?.map((c) => c.id) ?? [];
  assert.deepEqual(controlIds, ['live-command-sheet', 'typed-chat-action', 'command-reference']);
});

test('expired principal gets an empty envelope', () => {
  const expired = makePrincipal({ expiresAt: '2026-07-21T11:59:59.000Z' });
  assert.deepEqual(filterSubsections(MINI_APP_MAP_SUBSECTIONS, expired, NOW), []);
  assert.deepEqual(filterSections(MINI_APP_SECTIONS, expired, NOW), []);

  const live = makePrincipal({ expiresAt: '2026-07-21T12:00:00.000Z' });
  assert.equal(
    filterSubsections(MINI_APP_MAP_SUBSECTIONS, live, NOW).length,
    24,
    'expiresAt equal to now is not yet expired',
  );
});

test('inputs are never mutated (deep-frozen fixtures survive filtering)', () => {
  const frozenSubsections = deepFreeze(
    MINI_APP_MAP_SUBSECTIONS.map((s) => ({
      ...s,
      interactions: {
        ...s.interactions,
        secondary: s.interactions.secondary ? [...s.interactions.secondary] : undefined,
        controls: s.interactions.controls ? s.interactions.controls.map((c) => ({ ...c })) : undefined,
      },
    })),
  );
  const frozenSections = deepFreeze(
    MINI_APP_SECTIONS.map((s) => ({
      ...s,
      interactions: {
        ...s.interactions,
        secondary: s.interactions.secondary ? [...s.interactions.secondary] : undefined,
        controls: s.interactions.controls ? s.interactions.controls.map((c) => ({ ...c })) : undefined,
      },
    })),
  );

  const teamOut = filterSubsections(frozenSubsections, makePrincipal({ role: 'team' }), NOW);
  const sideQuests = teamOut.find((s) => s.id === 'side-quests');
  assert.ok(sideQuests);
  assert.notEqual(
    sideQuests,
    frozenSubsections.find((s) => s.id === 'side-quests'),
    'stripped item is a copy, not the frozen input',
  );

  // Must not throw on frozen input, and surviving unstripped items keep identity.
  const founderOut = filterSections(frozenSections, makePrincipal(), NOW);
  assert.deepEqual(founderOut, frozenSections);
});

test('operating fabric rollout keeps legacy scenes and RBAC ceilings governing actions', () => {
  // The additive shell introduces scene ids, not capabilities: contextual
  // actions stay governed by the existing ladder, and the legacy five-scene
  // surface contract is preserved byte-for-byte during rollout.
  assert.deepEqual([...MINI_APP_SCENE_IDS], ['mission', 'gate', 'tools', 'story', 'inspect']);
  assert.deepEqual([...OPERATING_FABRIC_SCENE_IDS], ['canopy', 'mission', 'flow', 'workforce', 'forge']);

  for (const section of MINI_APP_SECTIONS) {
    assert.ok(
      (MINI_APP_SCENE_IDS as readonly string[]).includes(section.scene),
      `legacy section ${section.id} keeps its legacy scene during rollout`,
    );
  }

  const founder = makePrincipal();
  const team = makePrincipal({ role: 'team' });
  assert.equal(permits('signed-action', founder.role), true);
  assert.equal(permits('signed-action', team.role), false);

  const founderGate = MINI_APP_SECTIONS.find((section) => section.id === 'founder-gate');
  assert.ok(founderGate);
  assert.equal(
    filterSections([founderGate], founder, NOW).length,
    1,
    'founder keeps the signed-action founder gate',
  );
  assert.equal(
    filterSections([founderGate], team, NOW).length,
    0,
    'team still loses the signed-action founder gate after the shell lands',
  );
});
