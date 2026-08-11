import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  QUEST_ARC_SPINE,
  QUEST_ARC_TEMPLATES,
  QUEST_GRAPH_TEMPLATES_SCHEMA,
  compileQuestGraphAdmissionProposal,
  questGraphTemplatesManifest,
} from './quest-graph-templates.ts';

const QUESTLOG_IDS = [
  'the-calling',
  'first-mint',
  'taste-resonance',
  'the-loop',
  'viability',
  'memory',
  'many-gardens',
] as const;

test('quest templates cover arcs I–VII with QUESTLOG ids', () => {
  assert.equal(QUEST_ARC_TEMPLATES.length, 7);
  assert.deepEqual(
    QUEST_ARC_TEMPLATES.map((a) => a.questId),
    [...QUESTLOG_IDS],
  );
  assert.deepEqual(
    QUEST_ARC_TEMPLATES.map((a) => a.arc),
    ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'],
  );
  assert.equal(questGraphTemplatesManifest().schema, QUEST_GRAPH_TEMPLATES_SCHEMA);
  assert.equal(questGraphTemplatesManifest().writesGoalGraph, false);
});

test('every template refuses live Goal Graph writes', () => {
  for (const a of QUEST_ARC_TEMPLATES) {
    assert.equal(a.writesGoalGraph, false);
    assert.ok(a.nodes.length >= 1);
    assert.ok(a.admissionGate.length > 0);
  }
  assert.equal(QUEST_ARC_SPINE.length, 6);
});

test('many-gardens is the only graph-form arc among I–VII', () => {
  const forms = Object.fromEntries(QUEST_ARC_TEMPLATES.map((a) => [a.questId, a.form]));
  assert.equal(forms['many-gardens'], 'graph');
  for (const id of QUESTLOG_IDS.slice(0, 6)) {
    assert.equal(forms[id], 'loop');
  }
});

test('admission proposal is template-only and requires founder gate + CAS', () => {
  const proposal = compileQuestGraphAdmissionProposal({
    tenant: 'cambium',
    actor: 'founder',
    sourceRef: 'test://quest-graph-templates',
    arcs: ['I', 'VII'],
  });
  assert.equal(proposal.schema, 'cambium.quest-graph-admission-proposal.v1');
  assert.equal(proposal.writesGoalGraph, false);
  assert.deepEqual(proposal.requires, ['founder-gate', 'd1-cas']);
  assert.ok(proposal.nodes.some((n) => n.questId === 'the-calling'));
  assert.ok(proposal.nodes.some((n) => n.questId === 'many-gardens'));
  assert.ok(proposal.nodes.every((n) => n.status === 'template-only'));
  assert.match(proposal.note, /never auto-write/i);
});
