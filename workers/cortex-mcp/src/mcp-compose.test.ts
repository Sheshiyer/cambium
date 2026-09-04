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
