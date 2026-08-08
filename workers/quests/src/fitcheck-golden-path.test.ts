import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadBranchStories } from '../../../bin/quine/hyphae/branch-stories.ts';
import { FITCHECK_GOLDEN_PATH } from '../../../shared/fitcheck-golden-path.ts';

test('shared Fitcheck golden path stays exact with the canonical packet', () => {
  const story = loadBranchStories({ root: process.cwd() }, 'cambium')
    .find((candidate) => candidate.canonicalWorkId === FITCHECK_GOLDEN_PATH.identity.workId);

  assert.ok(story);
  assert.equal(story.name, FITCHECK_GOLDEN_PATH.identity.name);
  assert.equal(story.promotion.state, FITCHECK_GOLDEN_PATH.identity.promotionState);
  assert.equal(story.arcTitle, FITCHECK_GOLDEN_PATH.story.arcTitle);
  assert.equal(story.vision.statement, FITCHECK_GOLDEN_PATH.story.vision);
  assert.equal(story.icp.primary, FITCHECK_GOLDEN_PATH.story.icp);
  assert.equal(story.controls.ui.currentFrontier, FITCHECK_GOLDEN_PATH.story.currentFrontier);
  assert.equal(story.controls.ui.blockedCopy, FITCHECK_GOLDEN_PATH.story.antiClaims);
  assert.deepEqual(story.missions, FITCHECK_GOLDEN_PATH.missions);
  assert.deepEqual(story.kpis.map(({ source: _source, ...kpi }) => kpi), FITCHECK_GOLDEN_PATH.kpis);
  assert.deepEqual(story.gates, FITCHECK_GOLDEN_PATH.gates);
  assert.deepEqual(story.proofPaths, FITCHECK_GOLDEN_PATH.proofs);
  assert.deepEqual(
    story.controls.organRouting.slice(0, 5).map((organ) => organ.organ),
    FITCHECK_GOLDEN_PATH.organs.map((organ) => organ.name),
  );
  assert.deepEqual(
    story.controls.organRouting.slice(5).map((organ) => organ.organ),
    FITCHECK_GOLDEN_PATH.supportRails.map((rail) => rail.name),
  );
  assert.equal(story.loops[0]?.loopId, FITCHECK_GOLDEN_PATH.loop.loopId);
  assert.equal(story.loops[0]?.oneChangeRule, FITCHECK_GOLDEN_PATH.loop.oneChangeRule);
  assert.equal(story.source.packetFile, FITCHECK_GOLDEN_PATH.sources.packet);
});

test('shared Fitcheck golden path encodes authority and claim boundaries', () => {
  assert.equal(FITCHECK_GOLDEN_PATH.identity.parentTenant, 'cambium');
  assert.deepEqual(FITCHECK_GOLDEN_PATH.identity.aliases, ['FitCheck', 'getfitcheck']);
  assert.match(FITCHECK_GOLDEN_PATH.identity.autonomyLabel, /not autonomous/);
  assert.equal(FITCHECK_GOLDEN_PATH.authority.packet, 'planning evidence');
  assert.match(FITCHECK_GOLDEN_PATH.authority.runtime, /D1 Goal Graph exact WorkObject anchor/);
  assert.match(FITCHECK_GOLDEN_PATH.authority.proof, /immutable execution receipt/);
  assert.match(FITCHECK_GOLDEN_PATH.authority.nextIntent, /proposal only/);
  assert.equal(FITCHECK_GOLDEN_PATH.runtimeJoin.evidenceStage, 'admitted');
  assert.equal(
    FITCHECK_GOLDEN_PATH.executionLadder.filter(
      (stage) => stage.stage === FITCHECK_GOLDEN_PATH.runtimeJoin.evidenceStage,
    ).length,
    1,
  );
  assert.doesNotMatch(JSON.stringify(FITCHECK_GOLDEN_PATH), /\/Volumes\/|\/Users\/|query_id=|auth_date=|Bearer\s|initData/);
});
