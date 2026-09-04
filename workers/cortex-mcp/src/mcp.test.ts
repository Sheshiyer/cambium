import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCapabilityHit } from './capability-hits.ts';
import { ORGAN_ATLAS } from './organ-atlas.ts';

test('organ-atlas: contains all 5 Cambium and 6 Temperance organs', () => {
  const ids = Object.keys(ORGAN_ATLAS);
  assert.equal(ids.length, 11);
  assert.ok(ORGAN_ATLAS['cambium.taste']);
  assert.ok(ORGAN_ATLAS['cambium.will']);
  assert.ok(ORGAN_ATLAS['cambium.hands']);
  assert.ok(ORGAN_ATLAS['cambium.genesis']);
  assert.ok(ORGAN_ATLAS['cambium.cortex']);
  assert.ok(ORGAN_ATLAS['temperance.vestibule']);
  assert.ok(ORGAN_ATLAS['temperance.adytum']);
  assert.ok(ORGAN_ATLAS['temperance.nutrix']);
  assert.ok(ORGAN_ATLAS['temperance.auspex']);
  assert.ok(ORGAN_ATLAS['temperance.circulator']);
  assert.ok(ORGAN_ATLAS['temperance.praeceptor']);
});

test('capability-hits: score >= 0.68 with topic match returns rendered card', () => {
  const res = evaluateCapabilityHit({
    taskFingerprint: 'fp-123',
    taskSummary: 'Evaluate brand resonance for luxury aesthetic',
    topicKey: 'digests',
    candidateCapabilityId: 'cambium.taste',
    relevance: 0.9,
    freshness: 0.8,
    readiness: 0.9,
    ownerMatch: 0.8,
    novelty: 0.7,
    evidenceQuality: 0.8,
  });

  assert.equal(res.eligible, true);
  assert.ok(res.score >= 0.68);
  assert.ok(res.card);
  assert.equal(res.card?.header, 'CAPABILITY HIT');
  assert.match(res.card?.whyRelevant || '', /match score/);
});

test('capability-hits: score < 0.68 returns silence refusal', () => {
  const res = evaluateCapabilityHit({
    taskFingerprint: 'fp-456',
    taskSummary: 'Irrelevant background task',
    topicKey: 'digests',
    candidateCapabilityId: 'cambium.taste',
    relevance: 0.1,
    freshness: 0.1,
    readiness: 0.2,
    ownerMatch: 0.2,
    novelty: 0.1,
    evidenceQuality: 0.1,
  });

  assert.equal(res.eligible, false);
  assert.ok(res.score < 0.68);
  assert.equal(res.refusalReason, 'score_below_threshold_silence_preferred');
  assert.equal(res.card, undefined);
});

test('capability-hits: topic mismatch returns refusal even with high score', () => {
  const res = evaluateCapabilityHit({
    taskFingerprint: 'fp-789',
    taskSummary: 'Evaluate brand resonance',
    topicKey: 'calendar', // Taste only routes to digests, dev
    candidateCapabilityId: 'cambium.taste',
    relevance: 1.0,
    freshness: 1.0,
    readiness: 1.0,
    ownerMatch: 1.0,
    novelty: 1.0,
    evidenceQuality: 1.0,
  });

  assert.equal(res.eligible, false);
  assert.match(res.refusalReason || '', /topic_mismatch/);
});

import { composePack } from "./taste-compose.ts";

test("taste-compose: builds paste-ready prompt and assets from mixed blobs", () => {
  const pack = composePack("luxury dark product jar, slow zoom", "video", [
    {
      id: "a",
      score: 0.8,
      category: "media-refs",
      slug: "jar-zoom",
      author: "@oggii_0",
      title: "jar",
      body: "Nano Banana Pro + Kling 3.0\n\nPrompt: Use the uploaded image as the exact visual reference.\n\nCamera:\nTop-down camera slowly zooms in.\n\nAction:\nThe jar remains still.\n\nhttps://x.com/oggii_0/status/1",
    },
    {
      id: "b",
      score: 0.7,
      category: "techniques",
      slug: "flora-pipe",
      author: "@Motion_Viz",
      title: "pipeline",
      body: "the pipeline: Flora (base) → Texture Match → product placement\nhttps://example.com/flora",
    },
  ]);
  assert.match(pack.paste_ready_prompt, /luxury dark product jar/);
  assert.match(pack.paste_ready_prompt, /uploaded image|visual reference/i);
  assert.ok(pack.assets.some((a) => a.kind === "model" && /Kling|Nano Banana/i.test(a.label)));
  assert.ok(pack.assets.some((a) => a.url && a.url.includes("x.com")));
  assert.equal(pack.sources.length, 2);
});
