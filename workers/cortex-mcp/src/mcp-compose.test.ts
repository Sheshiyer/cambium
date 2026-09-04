import { composeStructuredPack, matchSkills } from "./taste-compose.ts";
import test from "node:test";
import assert from "node:assert/strict";

test("taste-compose: structured pack has assets and skills", () => {
  const pack = composeStructuredPack(
    "luxury dark cinematic product hero slow zoom",
    "video",
    [
      {
        id: "a",
        score: 0.8,
        category: "media-refs",
        slug: "jar-zoom",
        author: "@oggii_0",
        title: "jar",
        body: "Prompt: Use the uploaded image as the exact visual reference.\n\nCamera:\nTop-down zoom.\nhttps://x.com/oggii_0/status/1\nKling 3.0",
        source: "taste",
      },
    ],
    [
      {
        id: "solar-energy-hero",
        score: 0.7,
        category: "Hero",
        slug: "solar-energy-hero",
        author: "motionsites",
        title: "Solar Energy Hero",
        body: "Build a single-page React hero with fullscreen background video.",
        video_url: "https://stream.mux.com/demo.m3u8",
        source: "motionsites",
      },
    ]
  );
  assert.match(pack.paste_ready_prompt, /luxury dark cinematic/);
  assert.ok(pack.asset_plan.hero_assets.some((a) => a.url && a.url.includes("mux.com")));
  assert.ok(pack.skills_extracted.some((s) => s.name === "grokfilm" || s.name === "design-core"));
  assert.ok(pack.build_brief.length > 20);
});

test("taste-compose: ui target prefers motionskin", () => {
  const skills = matchSkills("reskin a MotionSites wealth hero landing page", "ui");
  assert.ok(skills.some((s) => s.name === "motionskin"));
});

test("taste-compose: grokfilm techniques and section plan injected", () => {
  const pack = composeStructuredPack(
    "luxury dark cinematic top-down product still",
    "image",
    [
      {
        id: "a",
        score: 0.8,
        category: "media-refs",
        slug: "jar-zoom",
        author: "@oggii_0",
        title: "jar",
        body: "Prompt: Top-down product still.\nhttps://x.com/x/1",
        source: "taste",
      },
    ],
    [
      {
        id: "luxury-hero",
        score: 0.7,
        category: "Hero",
        slug: "luxury-hero",
        author: "motionsites",
        title: "Luxury Hero",
        body: "SECTION: hero\nPurpose: Primary value prop\nLayout: Full viewport\nCopy slots:\n- headline\n- cta\nAssets required:\n- hero_video\nInteractions:\n- scroll_reveal",
        video_url: "https://stream.mux.com/demo.m3u8",
        source: "motionsites",
      },
    ],
    [],
    [
      { name: "Aerial Shot", category: "Camera", mood: "Cinematic", slug: "aerial-shot", clause: "Aerial Shot: An aerial shot is a shot taken from an elevated vantage point." },
      { name: "Top-Down", category: "Camera", mood: "Cinematic", slug: "top-down", clause: "Top-Down: Shot from directly above the subject." },
    ]
  );
  assert.ok(pack.grokfilm_techniques.length >= 1);
  assert.ok(pack.section_plan.length >= 1);
  assert.ok(pack.section_plan[0].copy_slots.includes("headline"));
  assert.ok(pack.skills_extracted.some((s) => s.name === "grokfilm"));
  assert.match(pack.paste_ready_prompt, /Top-Down|Aerial Shot/);
});
