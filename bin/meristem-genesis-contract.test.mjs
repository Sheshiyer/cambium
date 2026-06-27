import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildGenesisContract } from '../scripts/meristem-genesis-contract.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/meristem-genesis-contract.mjs', import.meta.url));

const EXPECTED_BRAND_SYSTEM_KEYS = [
  'foundation',
  'buyer_persona',
  'competitor_analysis',
  'value_proposition',
  'product_positioning',
  'voice_and_tone',
  'brand_story'
];

const EXPECTED_COPY_SYSTEM_KEYS = [
  'messaging_framework',
  'landing_page',
  'welcome_email_sequence',
  'prelaunch_email_sequence',
  'launch_email_sequence',
  'ad_creative',
  'press_release',
  'product_description'
];

const EXPECTED_VISUAL_SYSTEM_KEYS = [
  'color_palette',
  'typography',
  'logo_concept',
  'visual_language',
  'lifestyle_photography',
  'product_photography',
  'hero_images',
  'brand_illustrations',
  'icon_system',
  'pattern_library',
  'social_media_assets',
  'asset_manifest'
];

const OUTPUTS = {
  'brand-foundation': { brand_essence: 'coherent system' },
  'buyer-persona': { primary_persona: 'system-carrying founder' },
  'competitor-analysis': { wedge: 'handoff-first studio' },
  'value-proposition': { promise: 'one coherent loop' },
  'product-positioning': { position: 'systems studio' },
  'voice-and-tone': { tone_words: ['clear', 'calm'] },
  'brand-story': { arc: 'requirement to handoff' },
  'messaging-framework': { pillars: ['coherence', 'handoff'] },
  'landing-page-copy': { hero: { headline: 'Digital Wilderness' } },
  'welcome-email-sequence': { emails: 5 },
  'prelaunch-email-sequence': { emails: 4 },
  'launch-email-sequence': { emails: 4 },
  'ad-creative-copy': { variants: 12 },
  'press-release': { title: 'Thoughtseed launches' },
  'product-description': { description: 'systems studio package' },
  'color-palette': { colors: ['#1A237E', '#00897B'] },
  'typography': { display: 'Tyros Pro' },
  'logo-concept': { guidance: 'use existing mark' },
  'visual-language': { theme: 'Digital Wilderness' },
  'lifestyle-photography': { shots: 2 },
  'product-photography': { shots: 2 },
  'hero-images': { shots: 3 },
  'brand-illustrations': { images: 2 },
  'icon-system': { sheet: 'icons-01-sheet.png' },
  'pattern-library': { patterns: 2 },
  'social-media-assets': { assets: 3 }
};

const EXPECTED_CONSUMED_SKILLS = Object.keys(OUTPUTS);

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function createMeristemFixture({ missingOutput, statusOverride, manifestValid = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'meristem-contract-'));
  const brandDir = join(root, 'brands', 'thoughtseed');
  const outputsDir = join(brandDir, '.brandmint', 'outputs');

  for (const [skill, data] of Object.entries(OUTPUTS)) {
    if (skill === missingOutput) continue;
    writeJson(join(outputsDir, `${skill}.json`), {
      skill,
      cluster: 'fixture',
      wave: 1,
      timestamp: '2026-06-27T00:00:00Z',
      status: statusOverride?.skill === skill ? statusOverride.status : 'complete',
      version: '1.0.0',
      data
    });
  }

  writeJson(join(brandDir, '.brandmint', 'asset-manifest.json'), {
    user_provided_assets: [{ id: 'logo-primary', path: './assets/logo.png', exists: true }],
    generated_assets: [{ id: 'hero-image-v1', path: './generated/hero-v1.png', exists: true }],
    validation: {
      all_paths_exist: manifestValid,
      missing_paths: manifestValid ? [] : ['./generated/missing.png'],
      user_count: 1,
      generated_count: 1
    }
  });

  return root;
}

test('buildGenesisContract maps meristem outputs into Cambium Genesis groups', () => {
  const root = createMeristemFixture();
  try {
    const { payload, evidence } = buildGenesisContract({ meristemRoot: root });

    assert.deepEqual(Object.keys(payload), ['brand_system', 'copy_system', 'visual_system']);
    assert.deepEqual(Object.keys(payload.brand_system), EXPECTED_BRAND_SYSTEM_KEYS);
    assert.deepEqual(Object.keys(payload.copy_system), EXPECTED_COPY_SYSTEM_KEYS);
    assert.deepEqual(Object.keys(payload.visual_system), EXPECTED_VISUAL_SYSTEM_KEYS);
    assert.equal(payload.brand_system.foundation.data.brand_essence, 'coherent system');
    assert.equal(payload.copy_system.landing_page.data.hero.headline, 'Digital Wilderness');
    assert.equal(payload.visual_system.asset_manifest.validation.all_paths_exist, true);
    assert.equal(evidence.status, 'pass');
    assert.equal(evidence.requiredGroups.join(','), 'brand_system,copy_system,visual_system');
    assert.equal(evidence.consumedSkillCount, EXPECTED_CONSUMED_SKILLS.length);
    assert.deepEqual(evidence.consumedSkills, EXPECTED_CONSUMED_SKILLS);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildGenesisContract accepts normal brands/thoughtseed brandDir', () => {
  const root = createMeristemFixture();
  try {
    const { payload, evidence } = buildGenesisContract({
      meristemRoot: root,
      brandDir: 'brands/thoughtseed'
    });

    assert.deepEqual(Object.keys(payload), ['brand_system', 'copy_system', 'visual_system']);
    assert.equal(evidence.brandDir, 'brands/thoughtseed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildGenesisContract rejects brandDir that escapes meristemRoot', () => {
  const root = createMeristemFixture();
  try {
    assert.throws(
      () => buildGenesisContract({ meristemRoot: root, brandDir: '../thoughtseed' }),
      /brandDir escapes meristem root: \.\.\/thoughtseed/
    );
    assert.throws(
      () => buildGenesisContract({ meristemRoot: root, brandDir: tmpdir() }),
      /brandDir escapes meristem root: /
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildGenesisContract fails closed when a required output is missing', () => {
  const root = createMeristemFixture({ missingOutput: 'brand-foundation' });
  try {
    assert.throws(
      () => buildGenesisContract({ meristemRoot: root }),
      /missing required meristem output: brand-foundation\.json/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildGenesisContract fails closed when an output status is incomplete', () => {
  const root = createMeristemFixture({
    statusOverride: { skill: 'voice-and-tone', status: 'partial' }
  });
  try {
    assert.throws(
      () => buildGenesisContract({ meristemRoot: root }),
      /voice-and-tone\.json status is "partial"; expected "complete"/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildGenesisContract fails closed when an output JSON file is malformed', () => {
  const root = createMeristemFixture();
  try {
    writeFileSync(
      join(root, 'brands', 'thoughtseed', '.brandmint', 'outputs', 'brand-foundation.json'),
      '{not-json\n'
    );
    assert.throws(
      () => buildGenesisContract({ meristemRoot: root }),
      /invalid JSON in .*brand-foundation\.json/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildGenesisContract fails closed when the asset manifest is missing', () => {
  const root = createMeristemFixture();
  try {
    rmSync(join(root, 'brands', 'thoughtseed', '.brandmint', 'asset-manifest.json'), {
      force: true
    });
    assert.throws(
      () => buildGenesisContract({ meristemRoot: root }),
      /missing required meristem asset manifest: \.brandmint\/asset-manifest\.json/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildGenesisContract fails closed when asset manifest paths are missing', () => {
  const root = createMeristemFixture({ manifestValid: false });
  try {
    assert.throws(
      () => buildGenesisContract({ meristemRoot: root }),
      /asset manifest reports missing paths: \.\/generated\/missing\.png/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI writes payload and evidence files with --out and --evidence-out', () => {
  const root = createMeristemFixture();
  const runDir = mkdtempSync(join(tmpdir(), 'meristem-contract-cli-'));
  try {
    const out = join(runDir, 'nested', 'payload.json');
    const evidenceOut = join(runDir, 'evidence', 'contract.json');
    const result = spawnSync(process.execPath, [
      SCRIPT,
      '--meristem-root',
      root,
      '--out',
      out,
      '--evidence-out',
      evidenceOut
    ], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    const payload = JSON.parse(readFileSync(out, 'utf8'));
    const evidence = JSON.parse(readFileSync(evidenceOut, 'utf8'));
    assert.deepEqual(Object.keys(payload), ['brand_system', 'copy_system', 'visual_system']);
    assert.equal(payload.visual_system.asset_manifest.validation.all_paths_exist, true);
    assert.equal(evidence.status, 'pass');
    assert.equal(evidence.consumedSkillCount, EXPECTED_CONSUMED_SKILLS.length);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('CLI rejects value flags without values with usage-style errors', () => {
  const root = createMeristemFixture();
  try {
    for (const flag of ['--meristem-root', '--brand-dir', '--out', '--evidence-out']) {
      const argv = flag === '--meristem-root'
        ? [SCRIPT, flag]
        : [SCRIPT, '--meristem-root', root, flag];
      const result = spawnSync(process.execPath, argv, { encoding: 'utf8' });

      assert.notEqual(result.status, 0, flag);
      assert.equal(result.stdout, '', flag);
      assert.match(result.stderr, new RegExp(`${flag} expects a value`), flag);
      assert.match(result.stderr, /usage: node scripts\/meristem-genesis-contract\.mjs/, flag);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
