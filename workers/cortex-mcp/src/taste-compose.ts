export type TasteCategory = "prompts" | "techniques" | "media-refs";
export type ComposeTarget = "image" | "video" | "ui" | "copy";

export interface ComposeHit {
  id: string;
  score: number;
  category: string;
  slug: string;
  author: string;
  title: string;
  r2_key?: string;
  body: string;
  video_url?: string;
  image_url?: string;
  source?: "taste" | "motionsites";
}

export interface SkillSpoke {
  name: string;
  cluster: string;
  description: string;
  when?: string;
}

export interface PromptAsset {
  kind: "hero_video" | "hero_image" | "reference" | "source" | "model" | "pipeline";
  label: string;
  url?: string;
  from: string;
}

export interface ExtractedSkill {
  name: string;
  why: string;
}

export interface StructuredPack {
  intent: string;
  target: ComposeTarget;
  retrieval_metadata: {
    scope: string;
    category: string;
    brand_archetype: string;
    motion_style: string;
    visual_treatment: string[];
  };
  build_brief: string;
  brand_system: {
    voice: string;
    headline_direction: string;
    cta_direction: string;
    visual_direction: string;
  };
  tech_contract: {
    framework: string;
    language: string;
    styling_system: string;
    motion: string;
  };
  asset_plan: {
    hero_assets: PromptAsset[];
    section_assets: PromptAsset[];
  };
  skills_extracted: ExtractedSkill[];
  paste_ready_prompt: string;
  operator_notes: string;
  taste_lineage: Array<{ slug: string; category: string; score: number; author: string }>;
  sources: Array<{
    slug: string;
    category: string;
    score: number;
    author: string;
    title: string;
    r2_key?: string;
    source?: string;
  }>;
}

export const DEFAULT_SKILLS: SkillSpoke[] = [
  { name: "motionskin", cluster: "design", description: "Reskin MotionSites templates 1:1 structure/motion; swap skin (type, palette, copy, assets)." },
  { name: "design-core", cluster: "design", description: "Research-first design cortex: lock direction, ledger, anti-slop gate." },
  { name: "grokfilm", cluster: "design", description: "Named cinema techniques as prompt clauses for stills and video." },
  { name: "brandmint", cluster: "design", description: "Brand identity orchestration: strategy, visual assets, campaign copy." },
  { name: "scroll-world", cluster: "design", description: "Scroll-scrubbed cinematic 3D-world landing pages." },
  { name: "openbrand", cluster: "design", description: "Extract brand tokens from a URL." },
  { name: "refero-design", cluster: "design", description: "Research-first UI references before generating pixels." },
  { name: "ui-ux-pro-max", cluster: "design", description: "Design-intelligence lookups for palettes, type, charts per stack." },
  { name: "taste-skill", cluster: "design", description: "Senior engineering taste rules and performance bar." },
  { name: "stitch-design-taste", cluster: "design", description: "Emit enforceable DESIGN.md spec." },
  { name: "react-bits-pro", cluster: "design", description: "Premium catalog components and motion blocks." },
  { name: "motion-foundations", cluster: "creative-frontend", description: "Shared motion foundations and reduced-motion baseline." },
  { name: "web-motion-library", cluster: "creative-frontend", description: "Hero video, hover, Magic UI animated components." },
  { name: "remotion", cluster: "creative-frontend", description: "Programmatic React video rendering." },
  { name: "astro-gsap-scrolltrigger", cluster: "creative-frontend", description: "GSAP ScrollTrigger on Astro pages." },
  { name: "prompt-optimizer", cluster: "ai-agents-meta", description: "Optimize prompts; match skills; advisory only." },
];

const MODEL_NAMES = [
  "Kling", "Kling 3.0", "Nano Banana", "Nano Banana Pro", "Flux", "FLUX",
  "Midjourney", "Runway", "Veo", "Sora", "Higgsfield", "Flora", "Luma",
  "Pika", "Hailuo", "Seedance", "Imagen",
];

function promptBlock(blob: string): string {
  const labeled = blob.match(/(?:^|\n)Prompt:\s*([\s\S]+?)(?=\n(?:Camera:|Action:|## |---)|$)/i);
  if (labeled) return labeled[1].trim();
  const fence = blob.match(/```(?:text|prompt|md)?\n([\s\S]*?)```/i);
  return fence ? fence[1].trim() : "";
}

function section(blob: string, heading: string): string {
  const re = new RegExp(
    `(?:^|\\n)${heading}\\s*:?\\s*\\n([\\s\\S]*?)(?=\\n(?:Camera|Action|Prompt|## |---)\\b|$)`,
    "i"
  );
  const m = blob.match(re);
  return m ? m[1].trim() : "";
}

function urls(blob: string): string[] {
  const found = blob.match(/https?:\/\/[^\s)>\]]+/g) || [];
  return Array.from(
    new Set(
      found
        .map((u) => u.replace(/[.,;]+$/, ""))
        .filter((u) => !u.includes("t.co/"))
    )
  ).slice(0, 8);
}

function modelsMentioned(blob: string): string[] {
  const hits: string[] = [];
  for (const name of MODEL_NAMES) {
    if (blob.toLowerCase().includes(name.toLowerCase()) && !hits.includes(name)) hits.push(name);
  }
  return hits;
}

function firstParagraph(blob: string): string {
  const noFm = blob.replace(/^---[\s\S]*?---\s*/g, "").replace(/^# .+\n+/, "");
  const para = noFm
    .split(/\n\n+/)
    .map((p) => p.trim())
    .find((p) => p.length > 40 && !p.startsWith("##"));
  return para ? para.replace(/\n/g, " ").slice(0, 500) : "";
}

export function matchSkills(intent: string, target: ComposeTarget, extra: SkillSpoke[] = []): ExtractedSkill[] {
  const catalog = [...DEFAULT_SKILLS, ...extra];
  const q = `${intent} ${target}`.toLowerCase();
  const scored = catalog.map((s) => {
    const hay = `${s.name} ${s.cluster} ${s.description} ${s.when || ""}`.toLowerCase();
    let n = 0;
    for (const tok of q.split(/[^a-z0-9+]+/).filter((t) => t.length > 3)) {
      if (hay.includes(tok)) n += 1;
    }
    if (target === "ui" && ["motionskin", "design-core", "brandmint", "react-bits-pro"].includes(s.name)) n += 3;
    if ((target === "video" || target === "image") && ["grokfilm", "remotion", "scroll-world"].includes(s.name)) n += 3;
    if (/\b(reskin|template|landing|website|hero)\b/.test(q) && s.name === "motionskin") n += 5;
    if (/\b(cinematic|camera|film|klng|kling|imagine)\b/.test(q) && s.name === "grokfilm") n += 5;
    if (/\b(scroll.?world|fly.?through)\b/.test(q) && s.name === "scroll-world") n += 5;
    return { s, n };
  });
  scored.sort((a, b) => b.n - a.n);
  const picked = scored.filter((x) => x.n > 0).slice(0, 5);
  const names = new Set(picked.map((x) => x.s.name));
  if (!names.has("design-core")) {
    picked.unshift({ s: catalog.find((c) => c.name === "design-core")!, n: 1 });
  }
  return picked
    .filter((x) => x.s)
    .slice(0, 6)
    .map((x) => ({
      name: x.s.name,
      why: x.s.description.split(".")[0].slice(0, 160),
    }));
}

function archetype(intent: string, ms?: ComposeHit): string {
  const q = intent.toLowerCase();
  if (ms?.category) return String(ms.category);
  if (/luxury|editorial|gold/.test(q)) return "luxury-editorial";
  if (/saas|ai\b/.test(q)) return "saas-ai";
  if (/wealth|fintech|bank/.test(q)) return "fintech";
  if (/real.?estate|property/.test(q)) return "real-estate";
  return "other";
}

function motionStyle(intent: string, target: ComposeTarget): string {
  if (target === "video" || /cinematic|slow zoom|camera/.test(intent.toLowerCase())) return "cinematic";
  if (/playful/.test(intent.toLowerCase())) return "playful";
  if (/dashboard|data/.test(intent.toLowerCase())) return "data-driven";
  return "premium-ui";
}

export function composeStructuredPack(
  intent: string,
  target: ComposeTarget,
  tasteHits: ComposeHit[],
  msHits: ComposeHit[],
  skills: SkillSpoke[] = []
): StructuredPack {
  const ms = msHits[0];
  const all = [...msHits, ...tasteHits];
  const hero: PromptAsset[] = [];
  const extra: PromptAsset[] = [];

  for (const h of all) {
    if (h.video_url) {
      hero.push({ kind: "hero_video", label: h.title || h.slug, url: h.video_url, from: h.slug });
    }
    if (h.image_url) {
      hero.push({ kind: "hero_image", label: h.title || h.slug, url: h.image_url, from: h.slug });
    }
    for (const u of urls(h.body)) {
      const kind = /\.(mp4|webm|m3u8)(\?|$)/i.test(u) || u.includes("stream.mux.com")
        ? "hero_video"
        : /\.(png|jpe?g|webp|gif)(\?|$)/i.test(u)
          ? "hero_image"
          : u.includes("x.com")
            ? "source"
            : "reference";
      const bucket = kind === "source" || kind === "reference" ? extra : hero;
      bucket.push({ kind, label: h.title || h.slug, url: u, from: h.slug });
    }
    for (const model of modelsMentioned(h.body)) {
      extra.push({ kind: "model", label: model, from: h.slug });
    }
  }

  const dedupe = (arr: PromptAsset[]) => {
    const seen = new Set<string>();
    const out: PromptAsset[] = [];
    for (const a of arr) {
      const k = `${a.kind}:${a.url || a.label}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(a);
    }
    return out.slice(0, 10);
  };

  const heroAssets = dedupe(hero);
  const sectionAssets = dedupe(extra);

  const camera = tasteHits.map((h) => section(h.body, "Camera")).find(Boolean) || "";
  const action = tasteHits.map((h) => section(h.body, "Action")).find(Boolean) || "";
  const extractedPrompt = tasteHits.map((h) => promptBlock(h.body)).find((p) => p.length > 40) || "";
  const models = Array.from(new Set(all.flatMap((h) => modelsMentioned(h.body))));

  const brand = intent.match(/for ([A-Z][\w.-]+)/)?.[1] || "the brand";
  const scope = target === "ui" ? "hero / landing page" : target === "video" ? "cinematic product film" : "hero visual";
  const mood = motionStyle(intent, target);
  const build_brief = `Build a ${scope} for a ${archetype(intent, ms)} brand called "${brand}" using React + TypeScript + Tailwind. The experience should feel ${mood}, precise, and non-generic. Structure and motion follow the nearest MotionSites template; only the skin (subject, copy, palette, assets) changes.`;

  const paste =
    target === "ui"
      ? [
          build_brief,
          "",
          ms ? `Nearest template: ${ms.title} (${ms.slug}). Keep its layout hierarchy and motion; reskin to the intent.` : "",
          ms ? firstParagraph(ms.body) : "",
          "",
          "ASSET PLAN:",
          ...heroAssets.map((a) => `- ${a.kind}: ${a.url || a.label}`),
          "",
          "CONSTRAINTS: no AI-slop centered gradient hero; research-first; one visual direction; tokens for color/type/space.",
        ]
          .filter(Boolean)
          .join("\n")
      : [
          intent.trim(),
          "",
          extractedPrompt || (ms ? firstParagraph(ms.body) : ""),
          camera ? `\nCamera: ${camera.replace(/\n+/g, " ")}` : "",
          action ? `Action: ${action.replace(/\n+/g, " ")}` : "",
          "",
          heroAssets[0]?.url ? `Reference asset: ${heroAssets[0].url}` : "",
          "Constraints: no watermark, no UI chrome, no extra text overlay, keep subject identity and palette consistent with the reference.",
          models.length ? `Stack cues: ${models.join(", ")}.` : "",
        ]
          .filter(Boolean)
          .join("\n");

  const skills_extracted = matchSkills(intent, target, skills);

  return {
    intent,
    target,
    retrieval_metadata: {
      scope: target === "ui" ? "page" : "component",
      category: ms?.category || (target === "video" ? "hero" : "other"),
      brand_archetype: archetype(intent, ms),
      motion_style: mood,
      visual_treatment: ["dark-luxury", "video-led", "image-led"].filter((t) =>
        `${intent} ${ms?.body || ""}`.toLowerCase().includes(t.split("-")[0])
      ).length
        ? ["dark-luxury", target === "video" ? "video-led" : "image-led"]
        : [target === "video" ? "video-led" : "image-led"],
    },
    build_brief,
    brand_system: {
      voice: "precise, premium, specific — never generic SaaS",
      headline_direction: intent.slice(0, 120),
      cta_direction: target === "ui" ? "single primary CTA, quiet secondary" : "n/a — generation prompt",
      visual_direction: `${mood}; lock one reference direction from retrieved template/taste lineage`,
    },
    tech_contract: {
      framework: "React",
      language: "TypeScript",
      styling_system: "Tailwind CSS",
      motion: target === "ui" ? "framer-motion + template-native motion" : models[0] || "image/video generator",
    },
    asset_plan: {
      hero_assets: heroAssets,
      section_assets: sectionAssets,
    },
    skills_extracted,
    paste_ready_prompt: paste.trim(),
    operator_notes: [
      "## Motionskin rule",
      "Structure + motion stay 1:1 with the retrieved template. Only skin (type, palette, copy, assets) changes.",
      "",
      "## Skills to run next",
      ...skills_extracted.map((s) => `- ${s.name}: ${s.why}`),
      "",
      "## How to use",
      "1. Paste `paste_ready_prompt` into the generator or coding agent.",
      "2. Attach `asset_plan.hero_assets` as the visual reference.",
      "3. Invoke listed skills rather than improvising a new stack.",
    ].join("\n"),
    taste_lineage: tasteHits.map((h) => ({
      slug: h.slug,
      category: h.category,
      score: h.score,
      author: h.author,
    })),
    sources: all.map((h) => ({
      slug: h.slug,
      category: h.category,
      score: h.score,
      author: h.author,
      title: h.title,
      r2_key: h.r2_key,
      source: h.source,
    })),
  };
}

export function renderPackMarkdown(pack: StructuredPack): string {
  const hero = pack.asset_plan.hero_assets.map((a) => `- ${a.kind}: ${a.url || a.label} (${a.from})`);
  const skills = pack.skills_extracted.map((s) => `- ${s.name} — ${s.why}`);
  const lineage = pack.taste_lineage.map((t) => `- ${t.author} · ${t.slug} · ${t.score.toFixed(3)}`);
  return [
    "# Taste Cortex structured prompt pack",
    "",
    `Intent: ${pack.intent}`,
    `Target: ${pack.target}`,
    `Scope: ${pack.retrieval_metadata.scope} · ${pack.retrieval_metadata.brand_archetype} · ${pack.retrieval_metadata.motion_style}`,
    "",
    "## Build brief",
    pack.build_brief,
    "",
    "## Paste-ready prompt",
    "",
    pack.paste_ready_prompt,
    "",
    "## Asset plan",
    hero.length ? hero.join("\n") : "- none retrieved",
    "",
    "## Skills extracted",
    skills.join("\n"),
    "",
    pack.operator_notes,
    "",
    "## Taste lineage",
    lineage.length ? lineage.join("\n") : "- none",
  ].join("\n");
}

// Back-compat for existing unit test
export function composePack(intent: string, target: ComposeTarget, hits: ComposeHit[]) {
  return composeStructuredPack(intent, target, hits, [], []);
}
