export type TasteCategory = "prompts" | "techniques" | "media-refs";

export type ComposeTarget = "image" | "video" | "ui" | "copy";

export interface ComposeHit {
  id: string;
  score: number;
  category: TasteCategory | string;
  slug: string;
  author: string;
  title: string;
  r2_key?: string;
  body: string;
}

export interface PromptAsset {
  kind: "reference" | "source" | "model" | "pipeline";
  label: string;
  url?: string;
  from: string;
}

export interface ComposedPack {
  intent: string;
  target: ComposeTarget;
  paste_ready_prompt: string;
  operator_notes: string;
  assets: PromptAsset[];
  sources: Array<{
    slug: string;
    category: string;
    score: number;
    author: string;
    title: string;
    r2_key?: string;
  }>;
}

const MODEL_NAMES = [
  "Kling",
  "Kling 3.0",
  "Nano Banana",
  "Nano Banana Pro",
  "Flux",
  "FLUX",
  "Midjourney",
  "Runway",
  "Veo",
  "Sora",
  "Higgsfield",
  "Flora",
  "Luma",
  "Pika",
  "Hailuo",
  "Seedance",
  "Wan",
  "Imagen",
];

function section(blob: string, heading: string): string {
  const re = new RegExp(
    `(?:^|\\n)${heading}\\s*:?\\s*\\n([\\s\\S]*?)(?=\\n(?:Camera|Action|Prompt|## |---)\\b|$)`,
    "i"
  );
  const m = blob.match(re);
  return m ? m[1].trim() : "";
}

function promptBlock(blob: string): string {
  const labeled = blob.match(/(?:^|\n)Prompt:\s*([\s\S]+?)(?=\n(?:Camera:|Action:|## |---)|$)/i);
  if (labeled) return labeled[1].trim();
  const fence = blob.match(/```(?:text|prompt|md)?\n([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  return "";
}

function urls(blob: string): string[] {
  const found = blob.match(/https?:\/\/[^\s)>\]]+/g) || [];
  const clean = found
    .map((u) => u.replace(/[.,;]+$/, ""))
    .filter((u) => !u.includes("t.co/") && !u.includes("x.com/i/"));
  return Array.from(new Set(clean)).slice(0, 8);
}

function modelsMentioned(blob: string): string[] {
  const hits: string[] = [];
  for (const name of MODEL_NAMES) {
    if (blob.toLowerCase().includes(name.toLowerCase()) && !hits.includes(name)) hits.push(name);
  }
  return hits;
}

function pipelineNotes(blob: string): string {
  const pipe = blob.match(/the pipeline:\s*([\s\S]{0,400})/i);
  if (pipe) return pipe[1].split("\n")[0].trim();
  const steps = blob.match(/(?:^|\n)(?:\d+\.|[-*]) .+(?:\n(?:\d+\.|[-*]) .+){1,6}/);
  return steps ? steps[0].trim() : "";
}

function firstParagraph(blob: string): string {
  const noFm = blob.replace(/^---[\s\S]*?---\s*/g, "").replace(/^# .+\n+/, "");
  const para = noFm.split(/\n\n+/).map((p) => p.trim()).find((p) => p.length > 40 && !p.startsWith("##"));
  return para ? para.replace(/\n/g, " ").slice(0, 600) : "";
}

export function extractFromBlob(hit: ComposeHit) {
  const prompt = promptBlock(hit.body);
  const camera = section(hit.body, "Camera");
  const action = section(hit.body, "Action");
  return {
    prompt,
    camera,
    action,
    pipeline: pipelineNotes(hit.body),
    urls: urls(hit.body),
    models: modelsMentioned(hit.body),
    summary: firstParagraph(hit.body),
  };
}

function assemblePasteReady(intent: string, target: ComposeTarget, extracts: ReturnType<typeof extractFromBlob>[], hits: ComposeHit[]): string {
  const bestPrompt = extracts.find((e) => e.prompt.length > 40)?.prompt || "";
  const cameras = extracts.map((e) => e.camera).filter(Boolean);
  const actions = extracts.map((e) => e.action).filter(Boolean);
  const models = Array.from(new Set(extracts.flatMap((e) => e.models)));

  const lines: string[] = [];
  lines.push(intent.trim().replace(/\s+/g, " "));
  if (bestPrompt) {
    lines.push("");
    lines.push(bestPrompt);
  } else {
    const summaries = extracts.map((e) => e.summary).filter((s) => s.length > 50).slice(0, 2);
    if (summaries.length) {
      lines.push("");
      lines.push(summaries.join(" "));
    }
  }
  if (target === "video" || cameras.length || actions.length) {
    if (cameras[0]) {
      lines.push("");
      lines.push("Camera: " + cameras[0].replace(/\n+/g, " "));
    }
    if (actions[0]) {
      lines.push("Action: " + actions[0].replace(/\n+/g, " "));
    }
  }
  lines.push("");
  lines.push("Constraints: no watermark, no UI chrome, no extra text overlay, keep subject identity and palette consistent with the reference.");
  if (models.length) lines.push("Stack cues: " + models.join(", ") + ".");
  const authors = hits.filter((h) => h.author && h.author !== "unknown").map((h) => h.author);
  if (authors.length) lines.push("Taste lineage: " + Array.from(new Set(authors)).slice(0, 4).join(", ") + ".");
  return lines.join("\n").trim();
}

export function composePack(intent: string, target: ComposeTarget, hits: ComposeHit[]): ComposedPack {
  const extracts = hits.map(extractFromBlob);
  const assets: PromptAsset[] = [];

  hits.forEach((hit, i) => {
    const ex = extracts[i];
    for (const url of ex.urls) {
      assets.push({
        kind: url.includes("x.com") || url.includes("twitter.com") ? "source" : "reference",
        label: hit.title || hit.slug,
        url,
        from: hit.slug,
      });
    }
    for (const model of ex.models) {
      if (!assets.some((a) => a.kind === "model" && a.label === model)) {
        assets.push({ kind: "model", label: model, from: hit.slug });
      }
    }
    if (ex.pipeline) {
      assets.push({ kind: "pipeline", label: ex.pipeline.slice(0, 180), from: hit.slug });
    }
  });

  const techniqueBits = hits
    .filter((h) => h.category === "techniques")
    .map((h, idx) => {
      const i = hits.indexOf(h);
      const pipe = extracts[i]?.pipeline || extracts[i]?.summary;
      return pipe ? `- ${h.author || h.slug}: ${pipe.slice(0, 280)}` : "";
    })
    .filter(Boolean);

  const operator_notes = [
    techniqueBits.length ? "## Technique (operator — do not dump raw into the generator)" : "",
    ...techniqueBits,
    "",
    "## How to use",
    "1. Paste `paste_ready_prompt` into the image/video model.",
    "2. Attach any `assets` marked reference if you have the still.",
    "3. Follow pipeline notes only as production steps, not as prompt text.",
  ]
    .filter((l) => l !== undefined)
    .join("\n")
    .trim();

  return {
    intent,
    target,
    paste_ready_prompt: assemblePasteReady(intent, target, extracts, hits),
    operator_notes,
    assets: assets.slice(0, 16),
    sources: hits.map((h) => ({
      slug: h.slug,
      category: String(h.category),
      score: h.score,
      author: h.author,
      title: h.title,
      r2_key: h.r2_key,
    })),
  };
}

export function renderPackMarkdown(pack: ComposedPack): string {
  const assetLines = pack.assets.map((a) => {
    if (a.url) return `- [${a.kind}] ${a.label} — ${a.url}`;
    return `- [${a.kind}] ${a.label}`;
  });
  const sourceLines = pack.sources.map(
    (s) => `- ${s.category} · ${s.slug} · score ${s.score.toFixed(3)} · ${s.author}`
  );
  return [
    "# Taste Cortex prompt pack",
    "",
    `Intent: ${pack.intent}`,
    `Target: ${pack.target}`,
    "",
    "## Paste-ready prompt",
    "",
    pack.paste_ready_prompt,
    "",
    pack.operator_notes,
    "",
    "## Assets",
    assetLines.length ? assetLines.join("\n") : "- none extracted",
    "",
    "## Sources",
    sourceLines.join("\n"),
  ].join("\n");
}
