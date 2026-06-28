#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BRAND_SYSTEM_OUTPUTS = [
  ['foundation', 'brand-foundation'],
  ['buyer_persona', 'buyer-persona'],
  ['competitor_analysis', 'competitor-analysis'],
  ['value_proposition', 'value-proposition'],
  ['product_positioning', 'product-positioning'],
  ['voice_and_tone', 'voice-and-tone'],
  ['brand_story', 'brand-story']
];

const COPY_SYSTEM_OUTPUTS = [
  ['messaging_framework', 'messaging-framework'],
  ['landing_page', 'landing-page-copy'],
  ['welcome_email_sequence', 'welcome-email-sequence'],
  ['prelaunch_email_sequence', 'prelaunch-email-sequence'],
  ['launch_email_sequence', 'launch-email-sequence'],
  ['ad_creative', 'ad-creative-copy'],
  ['press_release', 'press-release'],
  ['product_description', 'product-description']
];

const VISUAL_SYSTEM_OUTPUTS = [
  ['color_palette', 'color-palette'],
  ['typography', 'typography'],
  ['logo_concept', 'logo-concept'],
  ['visual_language', 'visual-language'],
  ['lifestyle_photography', 'lifestyle-photography'],
  ['product_photography', 'product-photography'],
  ['hero_images', 'hero-images'],
  ['brand_illustrations', 'brand-illustrations'],
  ['icon_system', 'icon-system'],
  ['pattern_library', 'pattern-library'],
  ['social_media_assets', 'social-media-assets']
];

const REQUIRED_GROUPS = ['brand_system', 'copy_system', 'visual_system'];

const REQUIRED_CAMBIUM_FIELDS = [
  'brand_system.brand_name',
  'brand_system.audience',
  'brand_system.positioning',
  'brand_system.promise',
  'brand_system.voice_principles',
  'copy_system.copy_slots.hero_headline',
  'copy_system.copy_slots.hero_subhead',
  'copy_system.copy_slots.cta_primary',
  'visual_system.palette',
  'visual_system.typography',
  'visual_system.imagery_direction',
  'visual_system.logo_usage'
];

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`invalid JSON in ${file}: ${error.message}`);
  }
}

function readCompleteOutput(outputsDir, skill) {
  const file = join(outputsDir, `${skill}.json`);
  if (!existsSync(file)) {
    throw new Error(`missing required meristem output: ${skill}.json`);
  }
  const json = readJson(file);
  if (json.status !== 'complete') {
    throw new Error(`${skill}.json status is "${json.status}"; expected "complete"`);
  }
  return json;
}

function readOutputsBySkill(outputsDir, specs) {
  return Object.fromEntries(specs.map(([, skill]) => [skill, readCompleteOutput(outputsDir, skill)]));
}

function readAssetManifest(brandRoot) {
  const manifestFile = join(brandRoot, '.brandmint', 'asset-manifest.json');
  if (!existsSync(manifestFile)) {
    throw new Error('missing required meristem asset manifest: .brandmint/asset-manifest.json');
  }
  const manifest = readJson(manifestFile);
  const validation = manifest.validation || {};
  if (validation.all_paths_exist !== true) {
    const missing = Array.isArray(validation.missing_paths) ? validation.missing_paths : [];
    throw new Error(`asset manifest reports missing paths: ${missing.join(', ') || 'unknown paths'}`);
  }
  return manifest;
}

function detectGitSha(meristemRoot) {
  try {
    return execFileSync('git', ['-C', meristemRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

// Repo Gate: the evidence must distinguish reproducible committed data from uncommitted
// local data. Returns the porcelain status lines (capped) when the Meristem checkout is
// dirty, [] when clean, or null when the path is not a git checkout.
function detectGitDirty(meristemRoot) {
  try {
    const out = execFileSync('git', ['-C', meristemRoot, 'status', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return out.split('\n').map((line) => line.trimEnd()).filter(Boolean).slice(0, 50);
  } catch {
    return null;
  }
}

function assertCambiumPayload(payload) {
  const missing = REQUIRED_GROUPS.filter((group) => !Object.prototype.hasOwnProperty.call(payload, group));
  if (missing.length) {
    throw new Error(`missing Cambium Genesis groups: ${missing.join(', ')}`);
  }
  const extra = Object.keys(payload).filter((group) => !REQUIRED_GROUPS.includes(group));
  if (extra.length) {
    throw new Error(`unexpected Cambium Genesis groups: ${extra.join(', ')}`);
  }
  for (const group of REQUIRED_GROUPS) {
    if (!payload[group] || typeof payload[group] !== 'object' || Array.isArray(payload[group])) {
      throw new Error(`${group} must be a non-array object`);
    }
  }
  for (const field of REQUIRED_CAMBIUM_FIELDS) {
    if (!isMeaningful(getPath(payload, field))) {
      throw new Error(`missing required Cambium Genesis field: ${field}`);
    }
  }
}

function getPath(value, path) {
  return path.split('.').reduce((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[key];
  }, value);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isMeaningful(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((item) => isMeaningful(item));
  if (isPlainObject(value)) return Object.values(value).some((item) => isMeaningful(item));
  return true;
}

function firstMeaningful(...values) {
  return values.find((value) => isMeaningful(value));
}

function compactObject(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => isMeaningful(value)));
}

function asTextList(value) {
  if (Array.isArray(value)) return value.filter((item) => isMeaningful(item));
  if (isPlainObject(value)) return Object.values(value).filter((item) => isMeaningful(item));
  return isMeaningful(value) ? [value] : undefined;
}

function data(outputs, skill) {
  return outputs[skill]?.data || {};
}

function source(outputs, skill, path) {
  return getPath(data(outputs, skill), path);
}

function brandNameFromBrandDir(brandDir) {
  const slug = basename(brandDir);
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function buildBrandSystem(outputs, brandDir) {
  const brandId = basename(brandDir);
  return {
    brand_id: brandId,
    brand_name: firstMeaningful(
      source(outputs, 'brand-foundation', 'brand_name'),
      source(outputs, 'brand-foundation', 'name'),
      brandNameFromBrandDir(brandDir)
    ),
    category: firstMeaningful(
      source(outputs, 'product-positioning', 'cbbe.salience.product_category'),
      source(outputs, 'buyer-persona', 'cbbe.salience.product_category')
    ),
    audience: source(outputs, 'brand-foundation', 'mission.breakdown.audience'),
    positioning: source(outputs, 'product-positioning', 'positioning_statement'),
    promise: firstMeaningful(
      source(outputs, 'messaging-framework', 'brand_promise'),
      source(outputs, 'value-proposition', 'statements.core')
    ),
    differentiators: firstMeaningful(
      source(outputs, 'value-proposition', 'differentiators'),
      source(outputs, 'product-positioning', 'points_of_difference')
    ),
    voice_principles: firstMeaningful(
      asTextList(source(outputs, 'voice-and-tone', 'language_guidelines.use')),
      asTextList(source(outputs, 'voice-and-tone', 'voice_attributes')),
      asTextList(source(outputs, 'voice-and-tone', 'tone_words'))
    )
  };
}

function buildCopySystem(outputs) {
  const copySlots = {
    hero_headline: firstMeaningful(
      source(outputs, 'landing-page-copy', 'hero.headline'),
      source(outputs, 'messaging-framework', 'headline')
    ),
    hero_subhead: source(outputs, 'landing-page-copy', 'hero.subhead'),
    cta_primary: source(outputs, 'landing-page-copy', 'hero.cta_button'),
    cta_secondary: firstMeaningful(
      source(outputs, 'landing-page-copy', 'final_cta.cta_button'),
      source(outputs, 'landing-page-copy', 'final_cta.button'),
      source(outputs, 'landing-page-copy', 'cta.secondary')
    ),
    proof_points: firstMeaningful(
      source(outputs, 'messaging-framework', 'proof_points'),
      source(outputs, 'landing-page-copy', 'proof.proof_points')
    ),
    offer_text: firstMeaningful(
      source(outputs, 'messaging-framework', 'brand_promise'),
      source(outputs, 'landing-page-copy', 'hero.product_pitch')
    )
  };

  return {
    copy_slots: compactObject(copySlots),
    tone_notes: compactObject({
      channel_calibration: source(outputs, 'voice-and-tone', 'channel_calibration'),
      tone_variations: source(outputs, 'voice-and-tone', 'tone_variations'),
      voice_prompt_template: source(outputs, 'voice-and-tone', 'voice_prompt_template')
    })
  };
}

function buildVisualSystem(outputs, assetManifest) {
  return {
    palette: source(outputs, 'color-palette', 'palette'),
    typography: compactObject({
      typefaces: source(outputs, 'typography', 'typefaces'),
      type_direction: source(outputs, 'typography', 'rationale.type_direction'),
      rationale: source(outputs, 'typography', 'rationale'),
      hierarchy: source(outputs, 'typography', 'hierarchy'),
      type_scale: source(outputs, 'typography', 'type_scale'),
      implementation: source(outputs, 'typography', 'implementation')
    }),
    imagery_direction: compactObject({
      photography: firstMeaningful(
        source(outputs, 'visual-language', 'photography.style'),
        source(outputs, 'visual-language', 'photography')
      ),
      essence: source(outputs, 'visual-language', 'essence'),
      visual_principles: source(outputs, 'visual-language', 'visual_principles')
    }),
    logo_usage: source(outputs, 'logo-concept', 'usage_specs'),
    composition_motifs: firstMeaningful(
      source(outputs, 'visual-language', 'composition_bias.principles'),
      source(outputs, 'visual-language', 'patterns.type')
    ),
    anti_patterns: source(outputs, 'visual-language', 'forbidden_visuals'),
    asset_manifest: assetManifest
  };
}

function resolveContainedPath(root, input, optionName) {
  if (!input) {
    throw new Error(`missing required option: ${optionName}`);
  }
  const resolved = resolve(root, input);
  const relativePath = relative(root, resolved);
  const contained = relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
  if (!contained) {
    throw new Error(`${optionName} escapes meristem root: ${input}`);
  }
  return resolved;
}

export function buildGenesisContract({ meristemRoot, brandDir = 'brands/thoughtseed' } = {}) {
  if (!meristemRoot) throw new Error('missing required option: meristemRoot');

  const root = resolve(meristemRoot);
  const brandRoot = resolveContainedPath(root, brandDir, 'brandDir');
  const outputsDir = join(brandRoot, '.brandmint', 'outputs');
  if (!existsSync(outputsDir)) {
    throw new Error(`missing meristem outputs directory: ${outputsDir}`);
  }

  const assetManifest = readAssetManifest(brandRoot);
  const outputSpecs = [
    ...BRAND_SYSTEM_OUTPUTS,
    ...COPY_SYSTEM_OUTPUTS,
    ...VISUAL_SYSTEM_OUTPUTS
  ];
  const outputs = readOutputsBySkill(outputsDir, outputSpecs);
  const payload = {
    brand_system: buildBrandSystem(outputs, brandDir),
    copy_system: buildCopySystem(outputs),
    visual_system: buildVisualSystem(outputs, assetManifest)
  };
  assertCambiumPayload(payload);

  const consumedSkills = outputSpecs.map(([, skill]) => skill);
  const meristemDirtyPaths = detectGitDirty(root);

  return {
    payload,
    evidence: {
      status: 'pass',
      meristemRoot: root,
      brandDir,
      meristemSha: detectGitSha(root),
      // Explicit dirty record: true/false when root is a git checkout, null otherwise.
      // A dirty tree means the proof reflects uncommitted local data, not the SHA alone.
      meristemDirty: meristemDirtyPaths == null ? null : meristemDirtyPaths.length > 0,
      meristemDirtyPaths: meristemDirtyPaths ?? [],
      requiredGroups: REQUIRED_GROUPS,
      consumedSkillCount: consumedSkills.length,
      consumedSkills,
      assetManifest: {
        allPathsExist: true,
        userCount: assetManifest.validation?.user_count ?? assetManifest.user_provided_assets?.length ?? 0,
        generatedCount: assetManifest.validation?.generated_count ?? assetManifest.generated_assets?.length ?? 0
      }
    }
  };
}

function parseArgs(argv) {
  const args = {
    meristemRoot: '',
    brandDir: 'brands/thoughtseed',
    out: '',
    evidenceOut: ''
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--meristem-root') args.meristemRoot = readFlagValue(argv, ++i, arg);
    else if (arg === '--brand-dir') args.brandDir = readFlagValue(argv, ++i, arg);
    else if (arg === '--out') args.out = readFlagValue(argv, ++i, arg);
    else if (arg === '--evidence-out') args.evidenceOut = readFlagValue(argv, ++i, arg);
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  return args;
}

function readFlagValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} expects a value\n\n${usage()}`);
  }
  return value;
}

function usage() {
  return [
    'usage: node scripts/meristem-genesis-contract.mjs --meristem-root /path/to/meristem [--brand-dir brands/thoughtseed] [--out /tmp/brand-dna.json] [--evidence-out /tmp/evidence.json]',
    '',
    'Emits Cambium Genesis JSON with top-level brand_system, copy_system, and visual_system.'
  ].join('\n');
}

function writeJsonFile(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  const { payload, evidence } = buildGenesisContract(args);
  if (args.out && args.out !== '-') writeJsonFile(args.out, payload);
  else console.log(JSON.stringify(payload, null, 2));
  if (args.evidenceOut) writeJsonFile(args.evidenceOut, evidence);
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`fail-closed: ${error.message}`);
      process.exit(1);
    }
  );
}
