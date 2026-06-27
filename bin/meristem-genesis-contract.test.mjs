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
  'brand_id',
  'brand_name',
  'category',
  'audience',
  'positioning',
  'promise',
  'differentiators',
  'voice_principles'
];

const EXPECTED_COPY_SYSTEM_KEYS = ['copy_slots', 'tone_notes'];
const EXPECTED_COPY_SLOT_KEYS = [
  'hero_headline',
  'hero_subhead',
  'cta_primary',
  'cta_secondary',
  'proof_points',
  'offer_text'
];
const EXPECTED_VISUAL_SYSTEM_KEYS = [
  'palette',
  'typography',
  'imagery_direction',
  'logo_usage',
  'composition_motifs',
  'anti_patterns',
  'asset_manifest'
];

const OUTPUTS = {
  'brand-foundation': {
    brand_essence: 'coherent system',
    mission: {
      breakdown: {
        audience: 'system-carrying founders'
      }
    }
  },
  'buyer-persona': {
    cbbe: { salience: { product_category: 'systems studio' } },
    demographics: { occupation: 'founder-operator' }
  },
  'competitor-analysis': { wedge: 'handoff-first studio' },
  'value-proposition': {
    differentiators: ['one coherent loop', 'handoff-first proof'],
    statements: { core: 'one coherent system' }
  },
  'product-positioning': {
    cbbe: { salience: { product_category: 'systems studio' } },
    positioning_statement: 'Thoughtseed turns requirements into coherent systems.',
    points_of_difference: ['requirement-to-handoff loop']
  },
  'voice-and-tone': {
    language_guidelines: { use: ['clear', 'calm'] },
    channel_calibration: { website_hero: 'spare and concrete' },
    tone_variations: { sales: { adjustment: 'lead with the requirement' } },
    voice_prompt_template: 'Use grounded, exact language.'
  },
  'brand-story': { arc: 'requirement to handoff' },
  'messaging-framework': {
    brand_promise: 'One coherent system from requirement to handoff.',
    headline: 'Digital Wilderness',
    proof_points: ['Proof stays close to the claim.']
  },
  'landing-page-copy': {
    hero: {
      headline: 'Digital Wilderness',
      subhead: 'Build the system, not just the story.',
      cta_button: 'Bring the requirement.',
      product_pitch: 'One studio carries the loop.'
    },
    final_cta: { cta_button: 'Start the handoff.' },
    proof: { proof_points: ['Shipped systems across disciplines.'] }
  },
  'welcome-email-sequence': { emails: 5 },
  'prelaunch-email-sequence': { emails: 4 },
  'launch-email-sequence': { emails: 4 },
  'ad-creative-copy': { variants: 12 },
  'press-release': { title: 'Thoughtseed launches' },
  'product-description': { description: 'systems studio package' },
  'color-palette': {
    palette: {
      primary: { hex: '#1A237E' },
      accent: { hex: '#00897B' }
    }
  },
  'typography': {
    typefaces: {
      display: { name: 'Tyros Pro' },
      body: { name: 'SubjectivitySerif' }
    },
    rationale: { type_direction: 'editorial systems studio' }
  },
  'logo-concept': {
    usage_specs: { do: ['Use the canonical asset files.'] },
    logo_type: { primary: 'wordmark + symbol' }
  },
  'visual-language': {
    essence: 'Disciplined engineering meets organic emergence.',
    photography: { style: 'editorial documentary' },
    composition_bias: { principles: ['asymmetric, grid-aware layouts'] },
    forbidden_visuals: ['generic SaaS gradients']
  },
  'lifestyle-photography': { shots: 2 },
  'product-photography': { shots: 2 },
  'hero-images': { shots: 3 },
  'brand-illustrations': { images: 2 },
  'icon-system': { sheet: 'icons-01-sheet.png' },
  'pattern-library': { patterns: 2 },
  'social-media-assets': { assets: 3 }
};

const EXPECTED_CONSUMED_SKILLS = Object.keys(OUTPUTS);

function mergeOutputData(base, override) {
  if (override === undefined) return base;
  if (!base || typeof base !== 'object' || Array.isArray(base)) return override;
  if (!override || typeof override !== 'object' || Array.isArray(override)) return override;
  return Object.fromEntries(
    Object.keys({ ...base, ...override }).map((key) => [
      key,
      mergeOutputData(base[key], override[key])
    ])
  );
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function createMeristemFixture({
  missingOutput,
  outputOverrides = {},
  statusOverride,
  manifestValid = true
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'meristem-contract-'));
  const brandDir = join(root, 'brands', 'thoughtseed');
  const outputsDir = join(brandDir, '.brandmint', 'outputs');

  for (const [skill, data] of Object.entries(OUTPUTS)) {
    if (skill === missingOutput) continue;
    const outputData = mergeOutputData(data, outputOverrides[skill]);
    writeJson(join(outputsDir, `${skill}.json`), {
      skill,
      cluster: 'fixture',
      wave: 1,
      timestamp: '2026-06-27T00:00:00Z',
      status: statusOverride?.skill === skill ? statusOverride.status : 'complete',
      version: '1.0.0',
      data: outputData
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
    assert.deepEqual(Object.keys(payload.copy_system.copy_slots), EXPECTED_COPY_SLOT_KEYS);
    assert.deepEqual(Object.keys(payload.visual_system), EXPECTED_VISUAL_SYSTEM_KEYS);
    assert.equal(payload.brand_system.brand_id, 'thoughtseed');
    assert.equal(payload.brand_system.brand_name, 'Thoughtseed');
    assert.equal(payload.brand_system.category, 'systems studio');
    assert.equal(payload.brand_system.audience, 'system-carrying founders');
    assert.equal(
      payload.brand_system.positioning,
      'Thoughtseed turns requirements into coherent systems.'
    );
    assert.equal(payload.brand_system.promise, 'One coherent system from requirement to handoff.');
    assert.deepEqual(payload.brand_system.differentiators, [
      'one coherent loop',
      'handoff-first proof'
    ]);
    assert.deepEqual(payload.brand_system.voice_principles, ['clear', 'calm']);
    assert.equal(payload.copy_system.copy_slots.hero_headline, 'Digital Wilderness');
    assert.equal(payload.copy_system.copy_slots.hero_subhead, 'Build the system, not just the story.');
    assert.equal(payload.copy_system.copy_slots.cta_primary, 'Bring the requirement.');
    assert.equal(payload.copy_system.copy_slots.cta_secondary, 'Start the handoff.');
    assert.deepEqual(payload.copy_system.copy_slots.proof_points, [
      'Proof stays close to the claim.'
    ]);
    assert.equal(
      payload.copy_system.copy_slots.offer_text,
      'One coherent system from requirement to handoff.'
    );
    assert.equal(payload.copy_system.tone_notes.channel_calibration.website_hero, 'spare and concrete');
    assert.deepEqual(payload.visual_system.palette.primary, { hex: '#1A237E' });
    assert.equal(payload.visual_system.typography.typefaces.display.name, 'Tyros Pro');
    assert.equal(payload.visual_system.imagery_direction.photography, 'editorial documentary');
    assert.deepEqual(payload.visual_system.logo_usage.do, ['Use the canonical asset files.']);
    assert.deepEqual(payload.visual_system.composition_motifs, [
      'asymmetric, grid-aware layouts'
    ]);
    assert.deepEqual(payload.visual_system.anti_patterns, ['generic SaaS gradients']);
    assert.equal(payload.visual_system.asset_manifest.validation.all_paths_exist, true);
    assert.equal(payload.brand_system.foundation, undefined);
    assert.equal(payload.copy_system.landing_page, undefined);
    assert.equal(payload.visual_system.color_palette, undefined);
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
    assert.equal(payload.brand_system.brand_name, 'Thoughtseed');
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

test('buildGenesisContract fails closed when required mapped positioning is empty', () => {
  const root = createMeristemFixture({
    outputOverrides: {
      'product-positioning': { positioning_statement: '' }
    }
  });
  try {
    assert.throws(
      () => buildGenesisContract({ meristemRoot: root }),
      /missing required Cambium Genesis field: brand_system\.positioning/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildGenesisContract fails closed when required mapped hero headline is empty', () => {
  const root = createMeristemFixture({
    outputOverrides: {
      'messaging-framework': { headline: '' },
      'landing-page-copy': { hero: { headline: '   ' } }
    }
  });
  try {
    assert.throws(
      () => buildGenesisContract({ meristemRoot: root }),
      /missing required Cambium Genesis field: copy_system\.copy_slots\.hero_headline/
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
    assert.equal(payload.brand_system.brand_name, 'Thoughtseed');
    assert.equal(payload.copy_system.copy_slots.hero_headline, 'Digital Wilderness');
    assert.equal(payload.visual_system.imagery_direction.photography, 'editorial documentary');
    assert.equal(payload.brand_system.foundation, undefined);
    assert.equal(payload.copy_system.landing_page, undefined);
    assert.equal(payload.visual_system.color_palette, undefined);
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
