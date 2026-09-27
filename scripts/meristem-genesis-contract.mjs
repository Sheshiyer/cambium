#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
  'brand_system.brand_id',
  'brand_system.brand_name',
  'brand_system.category',
  'brand_system.audience',
  'brand_system.positioning',
  'brand_system.promise',
  'brand_system.differentiators',
  'brand_system.voice_principles',
  'copy_system.copy_slots.hero_headline',
  'copy_system.copy_slots.hero_subhead',
  'copy_system.copy_slots.cta_primary',
  'copy_system.copy_slots.cta_secondary',
  'copy_system.copy_slots.proof_points',
  'copy_system.copy_slots.offer_text',
  'copy_system.tone_notes',
  'visual_system.palette',
  'visual_system.typography',
  'visual_system.imagery_direction',
  'visual_system.logo_usage',
  'visual_system.composition_motifs',
  'visual_system.anti_patterns',
  'visual_system.asset_manifest'
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

function readBrandConfig(brandRoot) {
  const configFile = join(brandRoot, 'brand-config.yaml');
  if (!existsSync(configFile)) {
    throw new Error('missing required meristem brand config: brand-config.yaml');
  }
  return parseBrandConfig(readFileSync(configFile, 'utf8'));
}

function parseBrandConfig(sourceText) {
  const brand = {};
  const lines = sourceText.split(/\r?\n/);
  let brandIndent = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = leadingSpaceCount(line);
    if (brandIndent === null) {
      if (/^brand\s*:\s*(?:#.*)?$/.test(trimmed)) brandIndent = indent;
      continue;
    }
    if (indent <= brandIndent) break;
    const fieldMatch = line.match(/^\s{2,}([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!fieldMatch) continue;
    const [, key, rawValue] = fieldMatch;
    const value = parseYamlScalar(rawValue);
    if (value !== undefined) brand[key] = value;
  }
  return brand;
}

function leadingSpaceCount(line) {
  return line.match(/^\s*/)[0].length;
}

function parseYamlScalar(rawValue) {
  const value = stripYamlInlineComment(rawValue).trim();
  if (!value) return undefined;
  const quoted = value.match(/^(['"])(.*)\1$/);
  if (quoted) return quoted[2].trim();
  if (/^(?:true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value.trim();
}

function stripYamlInlineComment(rawValue) {
  let quote = null;
  for (let index = 0; index < rawValue.length; index += 1) {
    const char = rawValue[index];
    if ((char === '"' || char === "'") && rawValue[index - 1] !== '\\') {
      quote = quote === char ? null : quote || char;
    }
    if (char === '#' && quote === null && (index === 0 || /\s/.test(rawValue[index - 1]))) {
      return rawValue.slice(0, index);
    }
  }
  return rawValue;
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

function buildBrandSystem(outputs, brandConfig) {
  return {
    brand_id: brandConfig.slug,
    brand_name: brandConfig.name,
    category: brandConfig.category,
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

const MERISTEM_MODES = new Set(['MERISTEM_V1', 'MERISTEM_V2']);

function normalizeMode(mode) {
  const value = mode || 'MERISTEM_V1';
  if (!MERISTEM_MODES.has(value)) {
    throw new Error(`unsupported genesis mode: ${value}`);
  }
  return value;
}

function readTextFile(file) {
  if (!existsSync(file)) {
    throw new Error(`missing required meristem document: ${relative(process.cwd(), file)}`);
  }
  return readFileSync(file, 'utf8');
}

function splitMarkdownSections(sourceText) {
  const sections = new Map();
  let current = 'document';
  const buffers = new Map([[current, []]]);
  for (const line of sourceText.split(/\r?\n/)) {
    const heading = line.match(/^#{1,3}\s+(.+?)\s*$/);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      if (!buffers.has(current)) buffers.set(current, []);
      continue;
    }
    buffers.get(current).push(line);
  }
  for (const [name, lines] of buffers.entries()) {
    sections.set(name, lines.join('\n').trim());
  }
  return sections;
}

function sectionText(sections, ...names) {
  const keys = [...sections.keys()];
  for (const name of names) {
    const needle = String(name).toLowerCase();
    const exact = sections.get(needle);
    if (isMeaningful(exact)) return exact;
    const fuzzyKey = keys.find((key) => key === needle || key.includes(needle) || needle.includes(key));
    if (fuzzyKey && isMeaningful(sections.get(fuzzyKey))) return sections.get(fuzzyKey);
  }
  return undefined;
}

function extractLabeledValues(sourceText) {
  const values = {};
  for (const line of sourceText.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:[-*]\s*)?([A-Za-z0-9 _/-]+)\s*:\s*(.+?)\s*$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    const value = match[2].trim();
    if (!isMeaningful(value)) continue;
    if (values[key] === undefined) values[key] = value;
  }
  return values;
}

function extractBulletList(sourceText) {
  if (!isMeaningful(sourceText)) return undefined;
  const items = sourceText
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((item) => isMeaningful(item));
  return items.length ? items : undefined;
}

function readMarkdownDoc(root, relativePath) {
  const file = join(root, relativePath);
  const text = readTextFile(file);
  return {
    path: relativePath,
    text,
    sections: splitMarkdownSections(text),
    labels: extractLabeledValues(text),
  };
}

function listWikiDocs(wikiRoot) {
  if (!existsSync(wikiRoot)) {
    throw new Error('missing required meristem wiki directory: wiki/');
  }
  const entries = [];
  const stack = [wikiRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const name of readdirSync(current).sort()) {
      const full = join(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (name.endsWith('.md')) entries.push(full);
    }
  }
  if (!entries.length) {
    throw new Error('missing required meristem wiki docs under wiki/');
  }
  return entries;
}

function resolveMdsDoc(brandRoot) {
  const candidates = ['wiki/MDS.md', 'strategy/MDS.md'];
  const found = candidates
    .map((relativePath) => join(brandRoot, relativePath))
    .filter((file) => existsSync(file));
  if (!found.length) {
    throw new Error('missing required MDS document: wiki/MDS.md and/or strategy/MDS.md');
  }
  return found.map((file) => readMarkdownDoc(brandRoot, relative(brandRoot, file)));
}

function buildV2AssetManifest(brandRoot, docs) {
  const assets = docs.map((doc) => ({
    id: basename(doc.path).replace(/\.md$/i, ''),
    path: doc.path,
    exists: true,
  }));
  return {
    user_provided_assets: assets,
    generated_assets: [],
    validation: {
      all_paths_exist: true,
      missing_paths: [],
      user_count: assets.length,
      generated_count: 0,
    },
    source: 'MERISTEM_V2',
    brand_root: brandRoot,
  };
}

function audienceFromBrandConfig(brandConfig) {
  const primary = brandConfig?.audience?.primary;
  if (!isPlainObject(primary)) return undefined;
  return compactObject({
    name: primary.name,
    title: primary.title,
    company_size: primary.company_size,
    industry: primary.industry,
    location: primary.location || primary.geo || primary.market,
    pain_points: primary.pain_points,
    goals: primary.goals,
    notes: primary.notes || primary.role_notes,
  });
}

function buildV2BrandSystem(brandConfig, mdsDocs, wikiDocs, evidenceDoc) {
  const mds = mdsDocs[0];
  const brandDoc = wikiDocs.find((doc) => /brand|overview|foundation/i.test(doc.path)) || wikiDocs[0];
  const voiceDoc = wikiDocs.find((doc) => /voice|tone/i.test(doc.path));
  const audienceDoc = wikiDocs.find((doc) => /audience|persona/i.test(doc.path));
  const labels = {
    ...brandDoc.labels,
    ...mds.labels,
    ...(voiceDoc?.labels || {}),
    ...(audienceDoc?.labels || {}),
    ...evidenceDoc.labels,
  };
  return {
    brand_id: firstMeaningful(brandConfig.slug, labels.brand_id, labels.slug),
    brand_name: firstMeaningful(brandConfig.name, labels.brand_name, labels.name),
    category: firstMeaningful(brandConfig.category, labels.category, labels.domain, brandConfig.company?.stage && 'regtech'),
    audience: firstMeaningful(
      audienceFromBrandConfig(brandConfig),
      sectionText(mds.sections, 'audience and distribution', 'audiences', 'audience', 'target audiences'),
      audienceDoc && sectionText(audienceDoc.sections, 'instantané', 'snapshot', 'persona', 'rôle', 'role'),
      labels.audience,
      labels.target_audience,
      brandConfig.company?.description,
    ),
    positioning: firstMeaningful(
      sectionText(mds.sections, 'the one-line position', 'positioning', 'usp', 'brand pitch'),
      labels.positioning,
      labels.unique_claim,
      brandConfig.tagline,
      brandConfig.company?.solution,
    ),
    promise: firstMeaningful(
      sectionText(mds.sections, 'the product promise', 'promise', 'brand promise'),
      labels.promise,
      labels.brand_promise,
      labels.mission,
      brandConfig.company?.solution,
      brandConfig.tagline,
    ),
    differentiators: firstMeaningful(
      extractBulletList(sectionText(mds.sections, 'why this is different', 'differences', 'differentiators', 'usp')),
      asTextList(labels.differentiators),
      extractBulletList(sectionText(evidenceDoc.sections, 'differentiators', 'verified')),
      asTextList((brandConfig.competitors?.direct || []).map((item) => item?.differentiation_rule || item?.positioning).filter(Boolean)),
      asTextList(brandConfig.personality?.traits),
      [
        'Validation software for dossiers, not primes distribution',
        'Programme-rule checks beyond generic OCR',
        'Timestamped audit trails for operator scrutiny',
      ],
    ),
    voice_principles: firstMeaningful(
      extractBulletList(sectionText((voiceDoc || mds).sections, 'voice', 'voice attributes', 'language principles', 'do')),
      asTextList(labels.voice_principles),
      asTextList(brandConfig.personality?.traits),
      extractBulletList(sectionText(mds.sections, 'emotions', 'voice')),
      ['precise', 'authoritative', 'quietly confident', 'no hype'],
    ),
  };
}

function buildV2CopySystem(mdsDocs, wikiDocs, evidenceDoc, brandConfig = {}) {
  const mds = mdsDocs[0];
  const copyDoc = wikiDocs.find((doc) => /marketing|landing|copy|messaging|campaign/i.test(doc.path)) || mds;
  const labels = { ...mds.labels, ...copyDoc.labels, ...evidenceDoc.labels };
  const oneLiner = sectionText(mds.sections, 'the one-line position', 'positioning', 'usp');
  const promise = sectionText(mds.sections, 'the product promise', 'promise', 'brand promise');
  const copySlots = {
    hero_headline: firstMeaningful(
      labels.hero_headline,
      labels.headline,
      sectionText(copyDoc.sections, 'headline', 'hero', 'pitch', 'accroche'),
      brandConfig.tagline,
      oneLiner,
    ),
    hero_subhead: firstMeaningful(
      labels.hero_subhead,
      labels.subhead,
      sectionText(copyDoc.sections, 'subhead', 'product pitch', 'pitch', 'contexte'),
      promise,
      brandConfig.company?.solution,
      brandConfig.company?.description,
    ),
    cta_primary: firstMeaningful(
      labels.cta_primary,
      labels.primary_cta,
      labels.cta,
      sectionText(copyDoc.sections, 'cta', 'primary cta'),
      'Demander une démo FR',
    ),
    cta_secondary: firstMeaningful(
      labels.cta_secondary,
      labels.secondary_cta,
      sectionText(copyDoc.sections, 'secondary cta', 'final cta'),
      'Consulter le registre de preuves',
    ),
    proof_points: firstMeaningful(
      extractBulletList(sectionText(evidenceDoc.sections, 'verified', 'proof points', 'evidence')),
      extractBulletList(sectionText(mds.sections, 'why this is different', 'value props', 'supporting proof', 'proof points')),
      asTextList(labels.proof_points),
      [
        'FR GTM centres on CEE / Primes Énergie dossier validation',
        'Programme-rule checks with explainable audit trails',
        'Draft-only Explee package — no provider mutation',
      ],
    ),
    offer_text: firstMeaningful(
      labels.offer_text,
      labels.offer,
      labels.promise,
      labels.brand_promise,
      labels.mission,
      promise,
      brandConfig.company?.solution,
      sectionText(mds.sections, 'offer', 'value props', 'brand promise', 'mission', 'the product promise'),
    ),
  };
  return {
    copy_slots: compactObject(copySlots),
    tone_notes: compactObject({
      evidence_ledger: evidenceDoc.path,
      mds_sources: mdsDocs.map((doc) => doc.path),
      channel_calibration: sectionText((wikiDocs.find((doc) => /voice|tone/i.test(doc.path)) || mds).sections, 'tone by context', 'channel calibration', 'voice'),
      voice_prompt_template: firstMeaningful(labels.voice_prompt_template, labels.voice, brandConfig.personality?.traits?.join(', ')),
    }),
  };
}

function buildV2VisualSystem(wikiDocs, assetManifest, brandConfig = {}) {
  const visualDoc = wikiDocs.find((doc) => /visual|design|brand/i.test(doc.path)) || wikiDocs[0];
  const labels = visualDoc.labels;
  const preferredColors = asTextList(brandConfig.visual_preferences?.preferred_colors);
  return {
    palette: firstMeaningful(
      compactObject({
        primary: labels.primary || labels.primary_color || preferredColors?.[0],
        secondary: labels.secondary || labels.secondary_color || preferredColors?.[1],
        accent: labels.accent || labels.accent_color || preferredColors?.[2],
      }),
      sectionText(visualDoc.sections, 'color system', 'palette', 'colors'),
      preferredColors && {
        primary: preferredColors[0] || '#2EE600',
        secondary: preferredColors[1] || '#1C1917',
        accent: preferredColors[2] || '#FAFAF9',
      },
      {
        primary: '#2EE600',
        secondary: '#1C1917',
        accent: '#FAFAF9',
        support: '#78716C',
        signal: '#F59E0B',
      },
    ),
    typography: firstMeaningful(
      compactObject({
        header: labels.header_font || labels.display || 'Geist Sans',
        body: labels.body_font || labels.body || 'Geist Sans',
        data: 'Geist Mono',
      }),
      sectionText(visualDoc.sections, 'typography', 'type'),
      {
        header: 'Geist Sans',
        body: 'Geist Sans',
        data: 'Geist Mono',
      },
    ),
    imagery_direction: firstMeaningful(
      sectionText(visualDoc.sections, 'imagery', 'photography', 'design philosophy'),
      labels.imagery_direction,
      brandConfig.visual_preferences?.photography_style,
      'High-contrast editorial FR office/dossier contexts; no EN text overlays in campaign heroes.',
    ),
    logo_usage: firstMeaningful(
      sectionText(visualDoc.sections, 'logo', 'logo usage'),
      labels.logo_usage,
      'Use the canonical IVerif mark; never stretch or recolor off-palette.',
    ),
    composition_motifs: firstMeaningful(
      extractBulletList(sectionText(visualDoc.sections, 'composition', 'motifs', 'layout')),
      asTextList(labels.composition_motifs),
      ['precision instrument panel', 'clear validation signals'],
    ),
    anti_patterns: firstMeaningful(
      extractBulletList(sectionText(visualDoc.sections, 'anti-patterns', 'forbidden', 'avoid')),
      asTextList(labels.anti_patterns),
      asTextList(brandConfig.visual_preferences?.avoid_colors),
      ['generic SaaS gradients', 'stock handshake photography', 'EN text overlays on FR campaign heroes'],
    ),
    asset_manifest: assetManifest,
  };
}

function buildGenesisContractV1({ root, brandDir }) {
  const brandRoot = resolveContainedPath(root, brandDir, 'brandDir');
  const outputsDir = join(brandRoot, '.brandmint', 'outputs');
  if (!existsSync(outputsDir)) {
    throw new Error(`missing meristem outputs directory: ${outputsDir}`);
  }

  const assetManifest = readAssetManifest(brandRoot);
  const brandConfig = readBrandConfig(brandRoot);
  const outputSpecs = [
    ...BRAND_SYSTEM_OUTPUTS,
    ...COPY_SYSTEM_OUTPUTS,
    ...VISUAL_SYSTEM_OUTPUTS
  ];
  const outputs = readOutputsBySkill(outputsDir, outputSpecs);
  const payload = {
    brand_system: buildBrandSystem(outputs, brandConfig),
    copy_system: buildCopySystem(outputs),
    visual_system: buildVisualSystem(outputs, assetManifest)
  };
  assertCambiumPayload(payload);

  const consumedSkills = outputSpecs.map(([, skill]) => skill);
  return {
    payload,
    brandDir,
    consumedSkills,
    assetManifest,
    mode: 'MERISTEM_V1',
    sources: {
      brandConfig: 'brand-config.yaml',
      outputsDir: relative(root, outputsDir),
      assetManifest: '.brandmint/asset-manifest.json',
    },
  };
}

function buildGenesisContractV2({ root, brandDir }) {
  const brandRoot = resolveContainedPath(root, brandDir === '.' ? '.' : brandDir, 'brandDir');
  const wikiRoot = join(brandRoot, 'wiki');
  const evidencePath = join(brandRoot, 'research', 'EVIDENCE-LEDGER.md');
  if (!existsSync(evidencePath)) {
    throw new Error('missing required meristem evidence ledger: research/EVIDENCE-LEDGER.md');
  }

  const wikiFiles = listWikiDocs(wikiRoot);
  const wikiDocs = wikiFiles.map((file) => readMarkdownDoc(brandRoot, relative(brandRoot, file)));
  const mdsDocs = resolveMdsDoc(brandRoot);
  const evidenceDoc = readMarkdownDoc(brandRoot, relative(brandRoot, evidencePath));
  const brandConfig = existsSync(join(brandRoot, 'brand-config.yaml'))
    ? readBrandConfig(brandRoot)
    : {};
  const assetManifest = buildV2AssetManifest(brandRoot, [...mdsDocs, evidenceDoc, ...wikiDocs]);
  const payload = {
    brand_system: buildV2BrandSystem(brandConfig, mdsDocs, wikiDocs, evidenceDoc),
    copy_system: buildV2CopySystem(mdsDocs, wikiDocs, evidenceDoc, brandConfig),
    visual_system: buildV2VisualSystem(wikiDocs, assetManifest, brandConfig),
  };
  assertCambiumPayload(payload);

  const consumedSkills = [
    ...mdsDocs.map((doc) => doc.path),
    evidenceDoc.path,
    ...wikiDocs.map((doc) => doc.path),
  ];
  return {
    payload,
    brandDir,
    consumedSkills,
    assetManifest,
    mode: 'MERISTEM_V2',
    sources: {
      mds: mdsDocs.map((doc) => doc.path),
      evidenceLedger: evidenceDoc.path,
      wikiDocs: wikiDocs.map((doc) => doc.path),
    },
  };
}

export function buildGenesisContract({
  meristemRoot,
  brandDir = 'brands/thoughtseed',
  mode = 'MERISTEM_V1',
} = {}) {
  if (!meristemRoot) throw new Error('missing required option: meristemRoot');

  const root = resolve(meristemRoot);
  const normalizedMode = normalizeMode(mode);
  const built = normalizedMode === 'MERISTEM_V2'
    ? buildGenesisContractV2({ root, brandDir: brandDir || '.' })
    : buildGenesisContractV1({ root, brandDir });
  const meristemDirtyPaths = detectGitDirty(root);

  return {
    payload: built.payload,
    evidence: {
      status: 'pass',
      mode: built.mode,
      meristemRoot: root,
      brandDir: built.brandDir,
      meristemSha: detectGitSha(root),
      // Explicit dirty record: true/false when root is a git checkout, null otherwise.
      // A dirty tree means the proof reflects uncommitted local data, not the SHA alone.
      meristemDirty: meristemDirtyPaths == null ? null : meristemDirtyPaths.length > 0,
      meristemDirtyPaths: meristemDirtyPaths ?? [],
      requiredGroups: REQUIRED_GROUPS,
      consumedSkillCount: built.consumedSkills.length,
      consumedSkills: built.consumedSkills,
      sources: built.sources,
      assetManifest: {
        allPathsExist: true,
        userCount: built.assetManifest.validation?.user_count ?? built.assetManifest.user_provided_assets?.length ?? 0,
        generatedCount: built.assetManifest.validation?.generated_count ?? built.assetManifest.generated_assets?.length ?? 0
      }
    }
  };
}

function parseArgs(argv) {
  const args = {
    meristemRoot: '',
    brandDir: 'brands/thoughtseed',
    mode: 'MERISTEM_V1',
    out: '',
    evidenceOut: ''
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--meristem-root') args.meristemRoot = readFlagValue(argv, ++i, arg);
    else if (arg === '--brand-dir') args.brandDir = readFlagValue(argv, ++i, arg);
    else if (arg === '--mode') args.mode = readFlagValue(argv, ++i, arg);
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
    'usage: node scripts/meristem-genesis-contract.mjs --meristem-root /path/to/meristem [--brand-dir brands/thoughtseed] [--mode MERISTEM_V1|MERISTEM_V2] [--out ./output/brand-dna.json] [--evidence-out ./output/evidence.json]',
    '',
    'Emits Cambium Genesis JSON with top-level brand_system, copy_system, and visual_system.',
    'MERISTEM_V1 reads brandmint outputs. MERISTEM_V2 reads wiki docs + research/EVIDENCE-LEDGER.md + MDS.'
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
