import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { buildGenesisContract } from '../scripts/meristem-genesis-contract.mjs';

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
    assert.equal(payload.brand_system.foundation.data.brand_essence, 'coherent system');
    assert.equal(payload.copy_system.landing_page.data.hero.headline, 'Digital Wilderness');
    assert.equal(payload.visual_system.asset_manifest.validation.all_paths_exist, true);
    assert.equal(evidence.status, 'pass');
    assert.equal(evidence.requiredGroups.join(','), 'brand_system,copy_system,visual_system');
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
