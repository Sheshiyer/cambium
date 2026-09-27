import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EXPLEE_CAMPAIGN_ID,
  EXPLEE_PROJECT_ID,
  listStateArtifacts,
  writeIverifDraftPackage,
} from './lib/iverif-draft-package.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAMBIUM_ROOT = join(HERE, '..');
const FIXTURE = join(HERE, 'fixtures', 'meristem-v2-iverif');

function syntheticMeristemBrand() {
  const meristemRoot = mkdtempSync(join(tmpdir(), 'iverif-draft-source-'));
  const brandRoot = join(meristemRoot, 'brands', 'iverif');
  mkdirSync(dirname(brandRoot), { recursive: true });
  cpSync(FIXTURE, brandRoot, { recursive: true });
  return { meristemRoot, brandRoot };
}

test('draft package writer creates Path A draft files offline without network', () => {
  const outRoot = mkdtempSync(join(tmpdir(), 'iverif-draft-package-'));
  let networkCalls = 0;
  const network = async () => {
    networkCalls += 1;
    throw new Error('network sentinel: Explee access is forbidden in draft-only mode');
  };

  try {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (...args) => {
      networkCalls += 1;
      throw new Error(`unexpected fetch: ${String(args[0])}`);
    };

    let result;
    try {
      result = writeIverifDraftPackage({
        meristemRoot: join(CAMBIUM_ROOT, 'missing-meristem-root'),
        brandDir: 'brands/iverif',
        marketLocale: 'fr-FR',
        cambiumRoot: CAMBIUM_ROOT,
        outRoot,
        now: new Date('2026-09-11T12:00:00.000Z'),
        network,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(networkCalls, 0, 'draft writer must never call network or fetch');
    assert.equal(result.network_calls, 0);
    assert.equal(result.mutation_enabled, false);
    assert.equal(result.do_not_post, true);
    assert.deepEqual(result.admitted, { current: false });
    assert.equal(result.project_id, EXPLEE_PROJECT_ID);
    assert.equal(result.campaign_id, EXPLEE_CAMPAIGN_ID);
    assert.equal(result.source.fixtureFallback, true);
    assert.equal(result.source.source, 'fixture');

    const artifacts = listStateArtifacts(outRoot);
    for (const required of [
      'genesis-contract.json',
      'taste-report.json',
      'hands/landing.fr.html',
      'hands/ads.fr.json',
      'hands/emails.fr.mjml',
      'hands/press.fr.md',
      'will/explee-payload.draft.json',
      'cortex/run-2026-09-11T12-00-00-000Z.md',
    ]) {
      assert.ok(artifacts.includes(required), `missing artifact ${required}`);
    }

    const genesis = JSON.parse(readFileSync(join(outRoot, 'genesis-contract.json'), 'utf8'));
    assert.equal(genesis.mode, 'MERISTEM_V2');
    assert.equal(genesis.admitted.current, false);
    assert.equal(genesis.mutation_enabled, false);
    assert.equal(genesis.payload.brand_system.brand_id, 'iverif');

    const taste = JSON.parse(readFileSync(join(outRoot, 'taste-report.json'), 'utf8'));
    assert.equal(taste.market.region, 'FR');
    assert.equal(taste.market.language, 'fr');
    assert.equal(taste.admitted.current, false);
    assert.equal(taste.mutation_enabled, false);
    assert.ok(Array.isArray(taste.blocked_claims));
    assert.ok(taste.blocked_claims.some((claim) => claim.id === 'd1-residual'));
    assert.ok(taste.blocked_claims.some((claim) => claim.id === 'explee-read-only'));
    assert.match(taste.fr_copy.hero_headline, /dossier/i);
    assert.ok(taste.evidence.verified.includes('Brand packet sources exist for IVerif wiki and Brandmint outputs'));
    assert.ok(taste.evidence.proof_points.includes('Source-linked claim review before public compliance claims'));

    const landing = readFileSync(join(outRoot, 'hands', 'landing.fr.html'), 'utf8');
    assert.match(landing, /evidence_receipt/);
    assert.match(landing, /data-mutation-enabled="false"/);

    const ads = JSON.parse(readFileSync(join(outRoot, 'hands', 'ads.fr.json'), 'utf8'));
    assert.equal(ads.do_not_post, true);
    assert.ok(ads.evidence_receipt.ledger_path.includes('EVIDENCE-LEDGER'));

    const emails = readFileSync(join(outRoot, 'hands', 'emails.fr.mjml'), 'utf8');
    assert.match(emails, /evidence_receipt/);
    assert.match(emails, /ne pas envoyer/i);

    const press = readFileSync(join(outRoot, 'hands', 'press.fr.md'), 'utf8');
    assert.match(press, /evidence_receipt/);
    assert.match(press, /admitted\.current=false/);

    const will = JSON.parse(readFileSync(join(outRoot, 'will', 'explee-payload.draft.json'), 'utf8'));
    assert.equal(will.do_not_post, true);
    assert.equal(will.mutation_enabled, false);
    assert.equal(will.project_id, 35674);
    assert.equal(will.campaign_id, 159185);
    const cleanBinding = JSON.parse(readFileSync(join(CAMBIUM_ROOT, 'docs/evidence/2026-09-11-iverif-explee-campaign-learning/playbooks/FR-CEE-CAMPAIGN-TEMPLATE.json'), 'utf8'));
    assert.equal(will.project_id, cleanBinding.projectId);
    assert.equal(will.campaign_id, cleanBinding.campaignId);
    assert.equal(will.activation, 'draft_only');
    assert.match(will.binding_evidence.verification, /historical-source-only/);
    assert.equal(will.admitted.current, false);
    assert.match(will.filename, /draft/);
    assert.ok(Array.isArray(will.allowed_methods));
    assert.deepEqual(will.allowed_methods, ['GET']);

    const cortex = readFileSync(join(outRoot, 'cortex', 'run-2026-09-11T12-00-00-000Z.md'), 'utf8');
    assert.match(cortex, /Evidence ledger link/);
    assert.match(cortex, /research\/EVIDENCE-LEDGER\.md/);
    assert.match(cortex, /admitted\.current: false/);
    assert.match(cortex, /mutation_enabled: false/);
  } finally {
    rmSync(outRoot, { recursive: true, force: true });
  }
});

test('draft package writer reads live fixture meristem root when brand tree exists', () => {
  const outRoot = mkdtempSync(join(tmpdir(), 'iverif-draft-direct-'));
  let networkCalls = 0;
  try {
    const result = writeIverifDraftPackage({
      meristemRoot: FIXTURE,
      brandDir: '.',
      marketLocale: 'fr-FR',
      cambiumRoot: CAMBIUM_ROOT,
      outRoot,
      network: () => {
        networkCalls += 1;
        throw new Error('network sentinel');
      },
    });
    assert.equal(networkCalls, 0);
    assert.equal(result.source.fixtureFallback, false);
    assert.equal(result.source.source, 'meristem');
    assert.equal(result.do_not_post, true);
    assert.equal(result.admitted.current, false);
  } finally {
    rmSync(outRoot, { recursive: true, force: true });
  }
});

test('draft package keeps pending competitor and hypothesis evidence out of verified receipts and escapes markup', () => {
  const { meristemRoot, brandRoot } = syntheticMeristemBrand();
  const outRoot = mkdtempSync(join(tmpdir(), 'iverif-draft-escaped-'));
  try {
    const ledgerPath = join(brandRoot, 'research', 'EVIDENCE-LEDGER.md');
    const baseLedger = readFileSync(ledgerPath, 'utf8');
    writeFileSync(ledgerPath, `${baseLedger.replace(
      '## Proof Points',
      '- Receipt marker --><script>window.receipt = 1</script>\n\n## Proof Points',
    )}

## FR competitor observations
| ID | Observation | Evidence | Limits | Class |
| --- | --- | --- | --- | --- |
| FR-COMP-01 | Competitor positioning needs review | Public landing snapshot | confirmation pending | competitor observation |

## Working hypotheses
- A pending hypothesis must remain unverified
`);

    const brandConfigPath = join(brandRoot, 'brand-config.yaml');
    writeFileSync(
      brandConfigPath,
      readFileSync(brandConfigPath, 'utf8').replace(
        /^  name: .+$/m,
        '  name: "<script>window.brand = 1</script>"',
      ),
    );
    const outputsDir = join(brandRoot, '.brandmint', 'outputs');
    mkdirSync(outputsDir, { recursive: true });
    writeFileSync(join(outputsDir, 'landing-page-copy.json'), `${JSON.stringify({
      data: {
        hero: {
          headline: '<script>window.headline = 1</script>',
          subhead: '<script>window.subhead = 1</script>',
          cta_button: '<mj-raw><script>window.cta = 1</script></mj-raw>',
        },
      },
    })}\n`);

    writeIverifDraftPackage({
      meristemRoot,
      brandDir: 'brands/iverif',
      marketLocale: 'fr-FR',
      cambiumRoot: CAMBIUM_ROOT,
      outRoot,
      now: new Date('2026-09-27T12:00:00.000Z'),
    });

    const taste = JSON.parse(readFileSync(join(outRoot, 'taste-report.json'), 'utf8'));
    const competitor = taste.evidence.observations.find((row) => row.id === 'FR-COMP-01');
    assert.deepEqual(competitor, {
      id: 'FR-COMP-01',
      observation: 'Competitor positioning needs review',
      evidence: 'Public landing snapshot',
      limits: 'confirmation pending',
      limitations: 'confirmation pending',
      class: 'competitor observation',
      provenance: {
        ledger_path: 'research/EVIDENCE-LEDGER.md',
        section: 'FR competitor observations',
      },
      metadata: {
        id: 'FR-COMP-01',
        observation: 'Competitor positioning needs review',
        evidence: 'Public landing snapshot',
        limits: 'confirmation pending',
        class: 'competitor observation',
      },
    });
    assert.equal(taste.evidence.verified.some((line) => /FR-COMP-01|Competitor positioning|pending hypothesis/i.test(line)), false);
    assert.ok(taste.evidence.observations.some((row) => /pending hypothesis/i.test(row.observation)));

    const landing = readFileSync(join(outRoot, 'hands', 'landing.fr.html'), 'utf8');
    const emails = readFileSync(join(outRoot, 'hands', 'emails.fr.mjml'), 'utf8');
    assert.match(landing, /&lt;script&gt;window\.brand = 1&lt;\/script&gt;/);
    assert.match(landing, /&lt;script&gt;window\.headline = 1&lt;\/script&gt;/);
    assert.match(landing, /&lt;mj-raw&gt;&lt;script&gt;window\.cta = 1&lt;\/script&gt;&lt;\/mj-raw&gt;/);
    assert.doesNotMatch(landing, /<script\b|--><script/i);
    assert.match(landing, /<!-- evidence_receipt:[^<>\n]+ -->/);
    assert.doesNotMatch(emails, /<script\b|<mj-raw\b|--><script/i);
    assert.match(emails, /&lt;script&gt;window\.headline = 1&lt;\/script&gt;/);
  } finally {
    rmSync(meristemRoot, { recursive: true, force: true });
    rmSync(outRoot, { recursive: true, force: true });
  }
});
