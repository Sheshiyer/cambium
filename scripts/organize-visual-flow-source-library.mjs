#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const checkOnly = process.argv.includes("--check");
const repositoryRoot = resolve(import.meta.dirname, "..");
const visualRoot = join(repositoryRoot, "docs/assets/visual-flow");
const destinationRoot = join(visualRoot, "source-library");

const entries = [
  ["0059", "telegram-mini-app/boards/component-glyph-state-board-desktop-v1.png", "telegram-mini-app", "state-board", null, "desktop"],
  ["0060", "telegram-mini-app/screens/mission-control-state-stack-mobile-v1.png", "telegram-mini-app", "mission-control-screen", null, "mobile"],
  ["0061", "telegram-mini-app/motion/mission-control-motion-storyboard-mobile-v1.png", "telegram-mini-app", "motion-storyboard", null, "mobile"],
  ["0062", "telegram-mini-app/boards/cambium-atlas-source-v1.png", "telegram-mini-app", "atlas-board", null, "source"],
  ["0063", "telegram-mini-app/boards/cambium-design-system-source-v1.png", "telegram-mini-app", "design-system-board", null, "source"],
  ["0064", "telegram-mini-app/screens/commands-mobile-v1.png", "telegram-mini-app", "commands-screen", null, "mobile-v1"],
  ["0065", "telegram-mini-app/screens/commands-mobile-v2.png", "telegram-mini-app", "commands-screen", null, "mobile-v2"],
  ["0066", "telegram-mini-app/screens/component-glyph-state-board-mobile-v1.png", "telegram-mini-app", "state-board-screen", null, "mobile-v1"],
  ["0067", "telegram-mini-app/screens/component-glyph-state-board-mobile-v2.png", "telegram-mini-app", "state-board-screen", null, "mobile-v2"],
  ["0068", "telegram-mini-app/screens/component-glyph-state-board-mobile-v3.png", "telegram-mini-app", "state-board-screen", null, "mobile-v3"],

  ["1065", "r3f/mesh-turntables/genesis/alpha-v1.png", "r3f", "mesh-turntable", "organ:genesis", "alpha"],
  ["1066", "r3f/mesh-turntables/genesis/back-v1.png", "r3f", "mesh-turntable", "organ:genesis", "back"],
  ["1067", "r3f/mesh-turntables/genesis/front-v1.png", "r3f", "mesh-turntable", "organ:genesis", "front"],
  ["1068", "r3f/mesh-turntables/genesis/left-v1.png", "r3f", "mesh-turntable", "organ:genesis", "left"],
  ["1069", "r3f/mesh-turntables/genesis/right-v1.png", "r3f", "mesh-turntable", "organ:genesis", "right"],
  ["1070", "r3f/mesh-turntables/genesis/front-duplicate-v1.png", "r3f", "mesh-turntable", "organ:genesis", "front-duplicate", "1067"],
  ["1071", "r3f/mesh-turntables/rail-arc/perspective-v1.png", "r3f", "mesh-turntable", "component:rail-arc", "perspective"],
  ["1072", "r3f/mesh-turntables/rail-arc/alpha-v1.png", "r3f", "mesh-turntable", "component:rail-arc", "alpha"],
  ["1073", "r3f/mesh-turntables/rail-arc/back-v1.png", "r3f", "mesh-turntable", "component:rail-arc", "back"],
  ["1074", "r3f/mesh-turntables/rail-arc/front-v1.png", "r3f", "mesh-turntable", "component:rail-arc", "front"],
  ["1075", "r3f/mesh-turntables/rail-arc/left-v1.png", "r3f", "mesh-turntable", "component:rail-arc", "left"],
  ["1076", "r3f/mesh-turntables/rail-arc/right-v1.png", "r3f", "mesh-turntable", "component:rail-arc", "right"],
  ["1077", "r3f/mesh-turntables/rail-arc/front-duplicate-v1.png", "r3f", "mesh-turntable", "component:rail-arc", "front-duplicate", "1074"],

  ["1078", "r3f/organs/genesis/semantic-specimen-v1.png", "r3f", "semantic-specimen", "organ:genesis", "primary"],
  ["1079", "r3f/components/rail-arc/semantic-specimen-v1.png", "r3f", "semantic-component", "component:rail-arc", "primary"],
  ["1080", "r3f/unresolved-models/unresolved-model-01/preview-v1.png", "r3f", "unresolved-model", null, "preview"],
  ["1081", "r3f/unresolved-models/unresolved-model-02/preview-v1.png", "r3f", "unresolved-model", null, "preview"],
  ["1082", "r3f/unresolved-models/unresolved-model-03/preview-v1.png", "r3f", "unresolved-model", null, "preview"],
  ["1083", "r3f/unresolved-models/unresolved-model-04/preview-v1.png", "r3f", "unresolved-model", null, "preview"],
  ["1084", "r3f/unresolved-models/unresolved-model-05/preview-v1.png", "r3f", "unresolved-model", null, "preview"],
  ["1085", "r3f/brand/favicon-v1.svg", "r3f", "brand-mark", null, "favicon"],
  ["1086", "r3f/product-pages/taste-island-v1.png", "r3f", "product-page", "organ:taste", "island-page"],
  ["1087", "r3f/contact-sheets/semantic-specimens-v1.png", "r3f", "contact-sheet", null, "semantic-specimens"],
  ["1088", "r3f/organs/hands/build-semantic-specimen-v1.png", "r3f", "semantic-specimen", "organ:hands", "build-source"],
  ["1089", "r3f/components/control-dial/semantic-specimen-v1.png", "r3f", "semantic-component", "component:control-dial", "primary"],
  ["1090", "r3f/organs/cortex/semantic-specimen-v1.png", "r3f", "semantic-specimen", "organ:cortex", "primary"],
  ["1091", "r3f/components/emitter-node/semantic-specimen-v1.png", "r3f", "semantic-component", "component:emitter-node", "primary"],
  ["1092", "r3f/organs/genesis/semantic-specimen-duplicate-v1.png", "r3f", "semantic-specimen", "organ:genesis", "duplicate", "1078"],
  ["1093", "r3f/organs/will/ops-semantic-specimen-v1.png", "r3f", "semantic-specimen", "organ:will", "ops-source"],
  ["1094", "r3f/components/process-beacon/semantic-specimen-v1.png", "r3f", "semantic-component", "component:process-beacon", "primary"],
  ["1095", "r3f/components/rail-arc/semantic-specimen-duplicate-v1.png", "r3f", "semantic-component", "component:rail-arc", "duplicate", "1079"],
  ["1096", "r3f/components/signal-packet/semantic-specimen-v1.png", "r3f", "semantic-component", "component:signal-packet", "primary"],
  ["1097", "r3f/organs/taste/semantic-specimen-v1.png", "r3f", "semantic-specimen", "organ:taste", "primary"],
  ["1098", "r3f/components/visualization-lens/semantic-specimen-v1.png", "r3f", "semantic-component", "component:visualization-lens", "primary"],
  ["1099", "r3f/contact-sheets/mesh-turntables-v1.png", "r3f", "contact-sheet", null, "mesh-turntables"],
  ["1100", "r3f/organs/will/ops-source-semantic-specimen-v1.png", "r3f", "semantic-specimen", "organ:will", "ops-source-alternate"]
].map(([number, destination, family, category, semanticOwner, variation, duplicateNumber = null]) => ({
  sourceId: `CVF-SRC-${number}`,
  number,
  destination,
  family,
  category,
  semanticOwner,
  variation,
  duplicateOf: duplicateNumber ? `CVF-SRC-${duplicateNumber}` : null
}));

const sha256 = (filePath) => createHash("sha256").update(readFileSync(filePath)).digest("hex");
const dimensions = (filePath) => {
  const [width, height] = execFileSync("magick", ["identify", "-format", "%w\t%h", filePath], { encoding: "utf8" }).trim().split("\t").map(Number);
  return { width, height };
};
const locateSource = (number) => {
  const matches = execFileSync("find", [visualRoot, "-maxdepth", "1", "-type", "f", "-name", `${number}--*`], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  if (matches.length !== 1) throw new Error(`Expected one numbered source for ${number}, found ${matches.length}`);
  return matches[0];
};

const mapped = entries.map((entry) => {
  const sourceFile = locateSource(entry.number);
  const destinationFile = join(destinationRoot, entry.destination);
  const sourceHash = sha256(sourceFile);

  if (checkOnly) {
    if (!existsSync(destinationFile)) throw new Error(`Missing organized asset: ${entry.destination}`);
  } else {
    mkdirSync(dirname(destinationFile), { recursive: true });
    copyFileSync(sourceFile, destinationFile);
  }

  if (sha256(destinationFile) !== sourceHash) throw new Error(`Hash mismatch: ${entry.sourceId}`);

  return {
    ...entry,
    originalFilename: sourceFile.slice(visualRoot.length + 1),
    organizedPath: entry.destination,
    sha256: sourceHash,
    dimensions: dimensions(sourceFile),
    authority: "reference-only",
    identityConfidence: entry.category === "unresolved-model" ? "unresolved" : entry.semanticOwner ? "explicit-name-or-adaptation-lineage" : "category-only"
  };
});

for (const entry of mapped.filter((item) => item.duplicateOf)) {
  const original = mapped.find((item) => item.sourceId === entry.duplicateOf);
  if (!original || original.sha256 !== entry.sha256) throw new Error(`Invalid duplicate relation: ${entry.sourceId}`);
}

const map = {
  schema: "thoughtseed.cambium.visual-flow-source-library.v1",
  generatedOn: "2026-09-12",
  policy: "non-destructive organized aliases; numbered originals remain source evidence",
  counts: {
    sourceAssets: mapped.length,
    telegramMiniApp: mapped.filter((item) => item.family === "telegram-mini-app").length,
    r3f: mapped.filter((item) => item.family === "r3f").length,
    duplicateAssets: mapped.filter((item) => item.duplicateOf).length,
    unresolvedModels: mapped.filter((item) => item.category === "unresolved-model").length,
    excludedMetadataFiles: 1
  },
  exclusions: [{ path: ".DS_Store", reason: "Finder metadata; not a visual asset" }],
  naming: {
    pattern: "{family}/{category-or-owner}/{descriptive-variation}-v1.{ext}",
    canonicalIdentity: "sourceId and originalFilename remain authoritative; organizedPath is a discovery alias"
  },
  assets: mapped
};

const table = (items) => [
  "| Source | Organized path | Role | Owner | Variation | Duplicate |",
  "|---|---|---|---|---|---|",
  ...items.map((item) => `| ${item.sourceId} | [${item.organizedPath}](${item.organizedPath}) | ${item.category} | ${item.semanticOwner ?? "unassigned"} | ${item.variation} | ${item.duplicateOf ?? "—"} |`)
].join("\n");

const readme = `# Cambium visual-flow source library

This directory provides organized, renamed aliases for the 46 visual assets that remain at the parent \`visual-flow/\` level under their original numbered filenames. The originals are preserved as source evidence; this library is the navigable view.

## Inventory

- ${map.counts.sourceAssets} mapped visual assets: ${map.counts.telegramMiniApp} Telegram Mini App and ${map.counts.r3f} R3F.
- ${map.counts.duplicateAssets} explicit duplicate files preserved.
- ${map.counts.unresolvedModels} unnamed R3F previews remain unresolved rather than being assigned speculative organ identities.
- Finder \`.DS_Store\` metadata is excluded.

## Organ lineage references

Explicitly named or established adaptations are segregated under Genesis, Hands/Build, Cortex, Will/Ops, and Taste. Mesh turntable views for Genesis and Rail Arc are stored separately from semantic specimens. Reusable specimens remain components, not organ identities.

## Telegram Mini App

${table(mapped.filter((item) => item.family === "telegram-mini-app"))}

## R3F organ and product lineage

${table(mapped.filter((item) => item.family === "r3f" && item.semanticOwner?.startsWith("organ:")))}

## R3F components and mesh turntables

${table(mapped.filter((item) => item.family === "r3f" && item.semanticOwner?.startsWith("component:")))}

## R3F unresolved models, brand, and contact sheets

${table(mapped.filter((item) => item.family === "r3f" && !item.semanticOwner))}

## Authority boundary

These files are reference-only. A named source may inform an explicit adaptation, but it does not establish runtime truth, completion, provider health, or action authority. See [SOURCE-ASSET-MAP.v1.json](SOURCE-ASSET-MAP.v1.json) for dimensions, hashes, duplicate relations, and confidence labels.
`;

const serializedMap = `${JSON.stringify(map, null, 2)}\n`;
const mapPath = join(destinationRoot, "SOURCE-ASSET-MAP.v1.json");
const readmePath = join(destinationRoot, "README.md");

if (checkOnly) {
  if (readFileSync(mapPath, "utf8") !== serializedMap) throw new Error("SOURCE-ASSET-MAP.v1.json is stale");
  if (readFileSync(readmePath, "utf8") !== readme) throw new Error("README.md is stale");
} else {
  mkdirSync(destinationRoot, { recursive: true });
  writeFileSync(mapPath, serializedMap);
  writeFileSync(readmePath, readme);
}

console.log(JSON.stringify({
  mode: checkOnly ? "check" : "write",
  destination: relative(repositoryRoot, destinationRoot),
  counts: map.counts
}, null, 2));
