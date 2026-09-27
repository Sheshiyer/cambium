#!/usr/bin/env node

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

const sourceRootArg = process.argv[2];
const checkOnly = process.argv.includes("--check");

if (!sourceRootArg) {
  console.error("Usage: node scripts/export-organ-console-visual-flow.mjs <organ-console-package-root>");
  process.exit(2);
}

const repositoryRoot = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(sourceRootArg);
const destinationRoot = join(repositoryRoot, "docs/assets/visual-flow/organ-console");
const manifestPath = join(sourceRoot, "manifests/generation-manifest.v1.json");
const reviewRoot = join(sourceRoot, "reviews/contact-sheets");

if (!existsSync(manifestPath)) {
  console.error(`Generation manifest not found: ${manifestPath}`);
  process.exit(2);
}

const sha256 = (filePath) => createHash("sha256").update(readFileSync(filePath)).digest("hex");
const kebab = (value) => value
  .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
  .replace(/[^a-zA-Z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .toLowerCase();

const variationByKind = {
  "concept-sheet": "concept",
  "geometry-sheet": "geometry",
  "state-sheet": "state",
  "inspection-sheet": "inspection",
  "usage-non-usage-sheet": "usage",
  "wide-composition": "wide",
  "narrow-composition": "narrow",
  "wide-example": "wide",
  "narrow-example": "narrow"
};

const sourceManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const activeStatuses = new Set(["selected", "generated"]);
const exportedAssets = [];

for (const asset of sourceManifest.assets) {
  const [ownerType, ownerName] = asset.exclusiveOwner.split(":", 2);
  const owner = kebab(ownerName);
  const variation = variationByKind[asset.kind];

  if (!ownerType || !owner || !variation) {
    throw new Error(`Unsupported asset owner or kind: ${asset.assetId}`);
  }

  const exported = activeStatuses.has(asset.status);
  const relativeOutputPath = exported
    ? `${ownerType === "organ" ? "organs" : ownerType === "feature" ? "features" : "views"}/${owner}/${variation}-v1.png`
    : null;

  if (exported) {
    const sourceFile = join(sourceRoot, asset.relativeOutputPath);
    const destinationFile = join(destinationRoot, relativeOutputPath);

    if (!existsSync(sourceFile)) {
      throw new Error(`Accepted source output is missing: ${asset.assetId}`);
    }

    const sourceHash = sha256(sourceFile);
    if (sourceHash !== asset.outputSha256) {
      throw new Error(`Source hash mismatch for ${asset.assetId}: ${sourceHash} != ${asset.outputSha256}`);
    }

    if (checkOnly) {
      if (!existsSync(destinationFile)) {
        throw new Error(`Exported destination is missing: ${asset.assetId}`);
      }
    } else {
      mkdirSync(dirname(destinationFile), { recursive: true });
      copyFileSync(sourceFile, destinationFile);
    }

    if (sha256(destinationFile) !== asset.outputSha256) {
      throw new Error(`Destination hash mismatch after copy: ${asset.assetId}`);
    }
  }

  exportedAssets.push({
    canonicalAssetId: asset.assetId,
    exclusiveOwner: asset.exclusiveOwner,
    ownerType,
    owner,
    variation,
    batch: asset.batch,
    sourceStatus: asset.status,
    reviewStatus: asset.reviewStatus,
    exportStatus: exported ? "exported" : "held",
    relativePath: relativeOutputPath,
    sha256: exported ? asset.outputSha256 : null,
    dimensions: exported ? asset.dimensions : null,
    promptSha256: asset.promptSha256,
    derivesFrom: asset.derivesFrom ?? [],
    blockedBy: exported ? [] : (asset.derivesFrom ?? []).filter((id) => {
      const parent = sourceManifest.assets.find((candidate) => candidate.assetId === id);
      return parent && !activeStatuses.has(parent.status);
    })
  });
}

const reviewFiles = [
  "BATCH-1A-CONCEPTS-V1.png",
  "BATCH-1B-GEOMETRY-V1.png",
  "BATCH-1B-REVIEW-V1.png",
  "BATCH-1B-STATES-V1.png",
  "BATCH-1C-INSPECTION-V1.png",
  "BATCH-1C-NARROW-V1.png",
  "BATCH-1C-REVIEW-V1.png",
  "BATCH-1C-WIDE-V1.png",
  "BATCH-2A-CONCEPTS-V1.png",
  "BATCH-2B-GEOMETRY-V1.png",
  "BATCH-2B-REVIEW-V1.png",
  "BATCH-2B-STATES-V1.png",
  "TSOC-BATCH-3-GEOMETRY-V1.png",
  "TSOC-BATCH-3-NARROW-V1.png",
  "TSOC-BATCH-3-REVIEW-V1.png",
  "TSOC-BATCH-3-STATE-V1.png",
  "TSOC-BATCH-3-USAGE-V1.png",
  "TSOC-BATCH-3-WIDE-V1.png",
  "TSOC-BATCH-4-NARROW-V1.png",
  "TSOC-BATCH-4-REVIEW-V1.png",
  "TSOC-BATCH-4-SELECTED-FEATURE-GEOMETRIES-V1.png",
  "TSOC-BATCH-4-SELECTED-ORGAN-IDENTITIES-V1.png",
  "TSOC-BATCH-4-WIDE-V1.png"
];

const reviews = reviewFiles.map((fileName) => {
  const sourceFile = join(reviewRoot, fileName);
  if (!existsSync(sourceFile)) {
    throw new Error(`Review board is missing: ${sourceFile}`);
  }
  const relativePath = `reviews/${kebab(basename(fileName, ".png"))}.png`;
  const destinationFile = join(destinationRoot, relativePath);
  if (checkOnly) {
    if (!existsSync(destinationFile)) {
      throw new Error(`Exported review board is missing: ${relativePath}`);
    }
  } else {
    mkdirSync(dirname(destinationFile), { recursive: true });
    copyFileSync(sourceFile, destinationFile);
  }
  return { sourceName: fileName, relativePath, sha256: sha256(destinationFile) };
});

const count = (predicate) => exportedAssets.filter(predicate).length;
const exportManifest = {
  schema: "thoughtseed.cambium.organ-console-visual-export.v1",
  generatedOn: "2026-09-12",
  source: {
    package: "Thoughtseed Labs Organ Console live-islands visual production",
    generationManifestSha256: sha256(manifestPath),
    brandLockSha256: sourceManifest.brandLock?.sha256 ?? sourceManifest.assets[0]?.brandLockSha256 ?? null,
    policy: "non-destructive public-safe export; Thoughtseed Labs remains planning authority"
  },
  counts: {
    registered: exportedAssets.length,
    exported: count((asset) => asset.exportStatus === "exported"),
    selected: count((asset) => asset.sourceStatus === "selected"),
    generated: count((asset) => asset.sourceStatus === "generated"),
    held: count((asset) => asset.exportStatus === "held"),
    exportedOrgans: count((asset) => asset.exportStatus === "exported" && asset.ownerType === "organ"),
    exportedFeatures: count((asset) => asset.exportStatus === "exported" && asset.ownerType === "feature"),
    exportedViews: count((asset) => asset.exportStatus === "exported" && asset.ownerType === "view"),
    reviewBoards: reviews.length
  },
  naming: {
    pattern: "{owner-type}/{owner}/{variation}-v1.png",
    ownerTypes: ["organs", "features", "views"],
    canonicalIdentity: "canonicalAssetId remains authoritative; renamed paths are Cambium discovery aliases"
  },
  exclusions: [
    "raw prompt bodies",
    "provider response bodies",
    "machine-local generation paths and session identifiers",
    "rejected drafts",
    "private notes and imported seed corpus",
    "runtime or deployment state"
  ],
  assets: exportedAssets,
  reviews
};

const serializedManifest = `${JSON.stringify(exportManifest, null, 2)}\n`;

const ownersOfType = (type) => [...new Set(exportedAssets.filter((asset) => asset.ownerType === type).map((asset) => asset.owner))].sort();
const statusCell = (type, owner, variation) => {
  const asset = exportedAssets.find((candidate) => candidate.ownerType === type && candidate.owner === owner && candidate.variation === variation);
  if (!asset) return "—";
  if (!asset.relativePath) return `held (${asset.reviewStatus})`;
  return `[${asset.sourceStatus}](${asset.relativePath})`;
};
const table = (type, variations) => {
  const heading = `| ${type === "organ" ? "Organ" : type === "feature" ? "Feature" : "View"} | ${variations.join(" | ")} |`;
  const separator = `| ${["---", ...variations.map(() => "---")].join(" | ")} |`;
  const rows = ownersOfType(type).map((owner) => `| ${owner} | ${variations.map((variation) => statusCell(type, owner, variation)).join(" | ")} |`);
  return [heading, separator, ...rows].join("\n");
};

const readme = `# Organ Console visual-flow export

This directory is the organized Cambium-facing export of the governed Thoughtseed Organ Console visual studies. The source planning package remains authoritative; these renamed paths are stable discovery aliases for design and implementation reference.

## Inventory

- ${exportManifest.counts.registered} canonical asset records mapped.
- ${exportManifest.counts.exported} accepted images exported: ${exportManifest.counts.selected} selected and ${exportManifest.counts.generated} generated.
- ${exportManifest.counts.held} planned, failed, or dependency-held records remain visible in the map without image files.
- ${exportManifest.counts.reviewBoards} review boards exported.
- Existing flat assets in the parent visual-flow directory were preserved unchanged.

## Naming and authority

Files use \`{owner-type}/{owner}/{variation}-v1.png\`. The canonical \`TSOC-*\` ID, exact SHA-256, dimensions, batch, status, prompt hash, and derivation lineage remain in [ASSET-MAP.v1.json](ASSET-MAP.v1.json). Generated media is reference-only and does not itself claim runtime truth, implementation, or approval.

## Organs

${table("organ", ["concept", "geometry", "state", "inspection", "wide", "narrow"])}

## Semantic features

${table("feature", ["geometry", "state", "usage", "wide", "narrow"])}

## Page views

${table("view", ["wide", "narrow"])}

## Review boards

${reviews.map((review) => `- [${review.sourceName}](${review.relativePath})`).join("\n")}

## Deliberate exclusions

Raw prompts, provider responses, machine-local generation paths, rejected drafts, private notes, and imported seed corpora are not copied into Cambium. Flow and Actions remain held on missing owner geometry; Organ Atlas and Plant Health remain held after bounded visual QA failures.
`;

if (checkOnly) {
  if (readFileSync(join(destinationRoot, "ASSET-MAP.v1.json"), "utf8") !== serializedManifest) {
    throw new Error("ASSET-MAP.v1.json is stale; rerun the exporter without --check");
  }
  if (readFileSync(join(destinationRoot, "README.md"), "utf8") !== readme) {
    throw new Error("README.md is stale; rerun the exporter without --check");
  }
} else {
  mkdirSync(destinationRoot, { recursive: true });
  writeFileSync(join(destinationRoot, "ASSET-MAP.v1.json"), serializedManifest);
  writeFileSync(join(destinationRoot, "README.md"), readme);
}

console.log(JSON.stringify({
  destination: relative(repositoryRoot, destinationRoot),
  mode: checkOnly ? "check" : "write",
  counts: exportManifest.counts,
  sourceManifestSha256: exportManifest.source.generationManifestSha256
}, null, 2));
