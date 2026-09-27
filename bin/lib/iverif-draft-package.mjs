import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGenesisContract } from '../../scripts/meristem-genesis-contract.mjs';
import { parseMarketLocale } from './marketing-orchestration.mjs';

export const EXPLEE_PROJECT_ID = 16763;
export const EXPLEE_CAMPAIGN_ID = 45711;
export const DRAFT_PACKAGE_SCHEMA = 'cambium.iverif.draft-package.v1';

const DEFAULT_BRAND_DIR = 'brands/iverif';
const DEFAULT_MARKET = 'fr-FR';
const FIXTURE_REL = join('bin', 'fixtures', 'meristem-v2-iverif');

const BLOCKED_CLAIM_PATTERNS = [
  { id: 'unique-ai-platform', pattern: /only ai[- ]powered|seule plateforme.*ia/i, reason: 'Public uniqueness claim lacks source-linked proof' },
  { id: 'compliance-cert', pattern: /iso\s*27001|soc\s*2|gdpr certified|certifi\w*\s+rgpd/i, reason: 'Compliance certification claims are blocked without evidence' },
  { id: 'performance-sla', pattern: /99\.9\s*%|<5\s*min|<200\s*ms|<2\s*%/i, reason: 'Performance/SLA numerics are blocked without direct evidence' },
  { id: 'd1-admission', pattern: /admitted\.current\s*=\s*true|d1\s+admission\s+complete/i, reason: 'D1 residual stands; do not fabricate admission' },
  { id: 'explee-mutation', pattern: /explee\s+post|mutation_enabled\s*:\s*true|live\s+outreach/i, reason: 'Explee mutation remains disabled for Path A draft-only' },
];

function cambiumRootFromModule() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function writeText(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`);
}

function writeJson(file, value) {
  writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readOptionalText(file) {
  if (!existsSync(file)) return null;
  return readFileSync(file, 'utf8');
}

function evidenceLedgerPath(brandRoot) {
  return join(brandRoot, 'research', 'EVIDENCE-LEDGER.md');
}

function brandLooksReady(brandRoot) {
  return existsSync(evidenceLedgerPath(brandRoot))
    && (existsSync(join(brandRoot, 'wiki')) || existsSync(join(brandRoot, 'strategy', 'MDS.md')));
}

/**
 * Prefer live meristem brand tree; fall back to committed fixture when W7 is still landing.
 */
export function resolveMeristemBrandSources({
  meristemRoot,
  brandDir = DEFAULT_BRAND_DIR,
  cambiumRoot = cambiumRootFromModule(),
} = {}) {
  if (!meristemRoot) throw new Error('missing required option: meristemRoot');
  const root = resolve(meristemRoot);
  const preferredBrandRoot = resolve(root, brandDir);
  if (brandLooksReady(preferredBrandRoot)) {
    return {
      meristemRoot: root,
      brandDir,
      brandRoot: preferredBrandRoot,
      source: 'meristem',
      fixtureFallback: false,
      note: null,
    };
  }

  const fixtureRoot = resolve(cambiumRoot, FIXTURE_REL);
  if (!brandLooksReady(fixtureRoot)) {
    throw new Error(
      `meristem brand unavailable at ${preferredBrandRoot} and fixture missing at ${fixtureRoot}`,
    );
  }
  return {
    meristemRoot: fixtureRoot,
    brandDir: '.',
    brandRoot: fixtureRoot,
    source: 'fixture',
    fixtureFallback: true,
    note: `W7 meristem path unavailable (${preferredBrandRoot}); using ${relative(cambiumRoot, fixtureRoot) || FIXTURE_REL}`,
  };
}

function parseEvidenceLedger(text, relativePath) {
  const sections = { verified: [], proof_points: [], blocked: [] };
  let current = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (/^##\s+(Verified|Public-source facts|First-party product facts|FR competitor observations)\b/i.test(line)) {
      current = 'verified';
      continue;
    }
    if (/^##\s+(Proof Points|Working hypotheses|Claim classes|Rules for all downstream work)\b/i.test(line)) {
      current = 'proof_points';
      continue;
    }
    if (/^##\s+(Blocked|Prohibited public claims)\b/i.test(line)) {
      current = 'blocked';
      continue;
    }
    if (/^##\s+/.test(line)) { current = null; continue; }
    if (!current) continue;

    // Markdown table rows: | ID | Finding | ... |
    if (line.startsWith('|')) {
      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      if (cells.length >= 2 && !/^[-:]+$/.test(cells[0]) && cells[0].toLowerCase() !== 'id' && cells[0].toLowerCase() !== 'class') {
        const finding = cells[1];
        if (finding && finding.toLowerCase() !== 'finding' && finding.toLowerCase() !== 'observation' && finding.toLowerCase() !== 'meaning') {
          sections[current].push(`${cells[0]}: ${finding}`);
        }
      }
      continue;
    }

    if (!(line.startsWith('-') || /^\d+\./.test(line))) continue;
    const item = line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
    if (item) sections[current].push(item);
  }
  return {
    path: relativePath,
    ...sections,
  };
}

function readLandingPageCopy(brandRoot) {
  const file = join(brandRoot, '.brandmint', 'outputs', 'landing-page-copy.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function frCopyFromSources({ payload, market, brandRoot }) {
  const slots = payload?.copy_system?.copy_slots || {};
  const brandName = payload?.brand_system?.brand_name || 'iverif';
  const landing = readLandingPageCopy(brandRoot);
  const hero = landing?.data?.hero || {};
  const solution = landing?.data?.solution || {};
  const programmes = landing?.data?.programmes;
  const proofPoints = Array.isArray(slots.proof_points) && slots.proof_points.length
    ? slots.proof_points
    : [
      'Domaine FR: iverif.fr (wiki secondaire iverif.io)',
      'Programmes: CEE, Primes Énergie (FR GTM), plus Conto Termico / BEG / ECO4 / MOVES III',
      'Path A: Explee draft-only — aucun POST',
    ];
  return {
    locale: `${market.language}-${market.region}`,
    brand_name: brandName,
    domain: 'iverif.fr',
    wiki_domain: 'iverif.io',
    programmes: ['CEE', 'Primes Énergie'],
    hero_headline: hero.headline
      || 'Arrêtez de perdre des dossiers CEE pour des erreurs évitables.',
    hero_subhead: hero.subhead
      || 'iverif valide les pièces et champs de vos dossiers d’aides énergie avant dépôt — CEE / Primes Énergie, règles de programme, piste d’audit.',
    cta_primary: hero.cta_button || 'Demander une démo FR',
    cta_secondary: 'Consulter le registre de preuves',
    offer_text: solution.body
      || hero.product_pitch
      || slots.offer_text
      || 'Validation documentaire IA pour opérateurs CEE / Primes Énergie sur iverif.fr.',
    proof_points: proofPoints,
    source_slots: {
      hero_headline: hero.headline || slots.hero_headline || null,
      hero_subhead: hero.subhead || slots.hero_subhead || null,
      cta_primary: hero.cta_button || slots.cta_primary || null,
      cta_secondary: slots.cta_secondary || null,
      programmes: programmes || null,
    },
  };
}

function scanBlockedClaims(texts) {
  const haystack = texts.filter(Boolean).join('\n');
  return BLOCKED_CLAIM_PATTERNS
    .filter(({ pattern }) => pattern.test(haystack))
    .map(({ id, reason }) => ({ id, status: 'blocked', reason }));
}

function evidenceReceipt(ledger, concept, lines = []) {
  return {
    ledger_path: ledger.path,
    concept,
    lines: lines.length ? lines : ledger[concept] || [],
  };
}

function buildTasteReport({ market, frCopy, ledger, genesis, sourceMeta }) {
  const candidateTexts = [
    frCopy.hero_headline,
    frCopy.hero_subhead,
    frCopy.offer_text,
    genesis.payload?.brand_system?.positioning,
    ...(frCopy.proof_points || []),
    ...(ledger.verified || []),
    ...(ledger.blocked || []),
  ];
  const flagged = scanBlockedClaims(candidateTexts);
  // Always surface residual D1 + mutation rails even if copy is clean.
  const residualRails = [
    {
      id: 'd1-residual',
      status: 'blocked',
      reason: 'admitted.current must remain false; D1 CAS / Mini App Gate residual stands',
    },
    {
      id: 'explee-read-only',
      status: 'blocked',
      reason: 'lead-adapters Explee stays active_read_only with mutation_enabled false; never POST',
    },
  ];
  const blocked_claims = [...flagged, ...residualRails]
    .filter((item, index, arr) => arr.findIndex((other) => other.id === item.id) === index);

  return {
    schema: 'cambium.iverif.taste-report.v1',
    market,
    mode: 'draft-only',
    source: sourceMeta.source,
    fixture_fallback: sourceMeta.fixtureFallback,
    fr_copy: frCopy,
    evidence: {
      verified: ledger.verified,
      proof_points: ledger.proof_points,
      blocked: ledger.blocked,
      ledger_path: ledger.path,
    },
    blocked_claims,
    admitted: { current: false },
    mutation_enabled: false,
    activation: 'active_read_only',
    verdict: blocked_claims.length ? 'draft_with_blocked_claims' : 'draft_ok',
  };
}

function buildLandingHtml({ frCopy, receipt }) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${frCopy.brand_name} — brouillon FR | iverif.fr</title>
  <meta name="robots" content="noindex,nofollow" />
</head>
<body data-draft-only="true" data-mutation-enabled="false" data-domain="iverif.fr">
  <main>
    <p class="eyebrow">iverif.fr · CEE / Primes Énergie · brouillon Path A</p>
    <h1>${frCopy.hero_headline}</h1>
    <p>${frCopy.hero_subhead}</p>
    <p><strong>${frCopy.cta_primary}</strong> · <em>${frCopy.cta_secondary}</em></p>
    <ul>
${(frCopy.proof_points || []).map((point) => `      <li>${point}</li>`).join('\n')}
    </ul>
  </main>
  <!-- evidence_receipt:${JSON.stringify(receipt)} -->
</body>
</html>
`;
}

function buildAdsJson({ frCopy, receipt, market }) {
  return {
    schema: 'cambium.iverif.hands.ads.fr.v1',
    market,
    draft_only: true,
    do_not_post: true,
    variants: [
      {
        id: 'fr-public-agencies-draft-1',
        headline: frCopy.hero_headline,
        body: frCopy.hero_subhead,
        cta: frCopy.cta_primary,
      },
      {
        id: 'fr-public-agencies-draft-2',
        headline: 'Contrôles de dossier auditables avant dépôt',
        body: frCopy.offer_text,
        cta: frCopy.cta_secondary,
      },
    ],
    evidence_receipt: receipt,
  };
}

function buildEmailsMjml({ frCopy, receipt }) {
  return `<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text font-size="20px">${frCopy.hero_headline}</mj-text>
        <mj-text>${frCopy.hero_subhead}</mj-text>
        <mj-button>${frCopy.cta_primary}</mj-button>
        <mj-text font-size="12px">Brouillon Path A — ne pas envoyer. evidence_receipt=${JSON.stringify(receipt)}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;
}

function buildPressMd({ frCopy, receipt }) {
  return `# Communiqué (brouillon FR) — ${frCopy.brand_name}

> Path A draft-only. Ne pas publier. mutation_enabled=false. admitted.current=false.

## Accroche
${frCopy.hero_headline}

## Contexte
${frCopy.hero_subhead}

## Offre
${frCopy.offer_text}

## Preuves candidates
${(frCopy.proof_points || []).map((point) => `- ${point}`).join('\n') || '- (aucune)'}

## evidence_receipt
\`\`\`json
${JSON.stringify(receipt, null, 2)}
\`\`\`
`;
}

function buildExpleeDraftPayload({ market, frCopy, receipt }) {
  return {
    schema: 'cambium.iverif.explee-payload.draft.v1',
    filename: 'explee-payload.draft.json',
    do_not_post: true,
    mutation_enabled: false,
    activation: 'active_read_only',
    provider_mode: 'observe-only',
    allowed_methods: ['GET'],
    project_id: EXPLEE_PROJECT_ID,
    campaign_id: EXPLEE_CAMPAIGN_ID,
    campaign_name: 'Public Agencies',
    market,
    admitted: { current: false },
    draft: {
      subject: frCopy.hero_headline,
      body: frCopy.hero_subhead,
      cta: frCopy.cta_primary,
      language: market.language,
    },
    evidence_receipt: receipt,
  };
}

function buildCortexReceipt({
  ts,
  market,
  sourceMeta,
  ledger,
  outRoot,
  written,
  taste,
}) {
  return `# Cortex receipt — iverif draft package

- schema: ${DRAFT_PACKAGE_SCHEMA}
- run_id: run-${ts}
- market: ${market.language}-${market.region}
- source: ${sourceMeta.source}
- fixture_fallback: ${sourceMeta.fixtureFallback}
- note: ${sourceMeta.note || 'none'}
- out_root: ${outRoot}
- admitted.current: false
- mutation_enabled: false
- do_not_post: true
- explee project: ${EXPLEE_PROJECT_ID}
- explee campaign: ${EXPLEE_CAMPAIGN_ID}
- taste_verdict: ${taste.verdict}

## Evidence ledger link
- path: ${ledger.path}
- verified_count: ${ledger.verified.length}
- proof_points_count: ${ledger.proof_points.length}
- blocked_count: ${ledger.blocked.length}

### Verified
${ledger.verified.map((line) => `- ${line}`).join('\n') || '- (none)'}

### Blocked
${ledger.blocked.map((line) => `- ${line}`).join('\n') || '- (none)'}

## Written artifacts
${written.map((path) => `- ${path}`).join('\n')}
`;
}

/**
 * Cambium Hands organ tooling — Path A draft package writer.
 * Consumes Meristem brand packet (not AutoGTM defaults).
 * Routes via Will/adapters later; never POSTs to Explee; never flips admitted.current.
 * Not a standalone skill — invoke through Cambium compose / explee-master + growth-content.
 */
export function writeIverifDraftPackage({
  meristemRoot,
  brandDir = DEFAULT_BRAND_DIR,
  marketLocale = DEFAULT_MARKET,
  cambiumRoot = cambiumRootFromModule(),
  outRoot,
  now = new Date(),
  network = null,
} = {}) {
  if (typeof network === 'function') {
    // Injected sentinel for tests; draft writer must never call it.
  }

  const market = parseMarketLocale(marketLocale);
  const sourceMeta = resolveMeristemBrandSources({ meristemRoot, brandDir, cambiumRoot });
  let genesis;
  try {
    genesis = buildGenesisContract({
      meristemRoot: sourceMeta.meristemRoot,
      brandDir: sourceMeta.brandDir,
      mode: 'MERISTEM_V2',
    });
  } catch (error) {
    const outputsDir = join(sourceMeta.brandRoot, '.brandmint', 'outputs');
    if (!existsSync(outputsDir)) throw error;
    genesis = buildGenesisContract({
      meristemRoot: sourceMeta.meristemRoot,
      brandDir: sourceMeta.brandDir,
      mode: 'MERISTEM_V1',
    });
    sourceMeta.note = `${sourceMeta.note || ''} | MERISTEM_V2 failed (${error.message}); fell back to MERISTEM_V1 outputs`.trim();
  }

  const ledgerRel = relative(sourceMeta.brandRoot, evidenceLedgerPath(sourceMeta.brandRoot))
    || 'research/EVIDENCE-LEDGER.md';
  const ledger = parseEvidenceLedger(
    readOptionalText(evidenceLedgerPath(sourceMeta.brandRoot)),
    ledgerRel,
  );

  const targetRoot = resolve(outRoot || join(cambiumRoot, '.state', 'iverif'));
  const ts = now.toISOString().replace(/[:.]/g, '-');
  const frCopy = frCopyFromSources({
    payload: genesis.payload,
    market,
    brandRoot: sourceMeta.brandRoot,
  });
  const taste = buildTasteReport({ market, frCopy, ledger, genesis, sourceMeta });

  const verifiedOrProof = ledger.verified.length ? ledger.verified : ledger.proof_points;
  const landingReceipt = evidenceReceipt(ledger, ledger.verified.length ? 'verified' : 'proof_points', verifiedOrProof.slice(0, 3));
  const adsReceipt = evidenceReceipt(ledger, 'proof_points', (ledger.proof_points.length ? ledger.proof_points : verifiedOrProof).slice(0, 3));
  const emailReceipt = evidenceReceipt(ledger, ledger.verified.length ? 'verified' : 'proof_points', verifiedOrProof.slice(0, 2));
  const pressReceipt = evidenceReceipt(ledger, 'blocked', (ledger.blocked.length ? ledger.blocked : verifiedOrProof).slice(0, 3));
  const willReceipt = evidenceReceipt(ledger, 'blocked', ledger.blocked.length ? ledger.blocked : [
    'No fabricated D1 admission evidence',
    'No Explee POST / explee-write / mutation_enabled true',
  ]);

  const paths = {
    genesis: join(targetRoot, 'genesis-contract.json'),
    taste: join(targetRoot, 'taste-report.json'),
    landing: join(targetRoot, 'hands', 'landing.fr.html'),
    ads: join(targetRoot, 'hands', 'ads.fr.json'),
    emails: join(targetRoot, 'hands', 'emails.fr.mjml'),
    press: join(targetRoot, 'hands', 'press.fr.md'),
    will: join(targetRoot, 'will', 'explee-payload.draft.json'),
    cortex: join(targetRoot, 'cortex', `run-${ts}.md`),
  };

  const genesisDocument = {
    schema: 'cambium.iverif.genesis-contract.v1',
    mode: genesis.evidence.mode,
    market,
    admitted: { current: false },
    mutation_enabled: false,
    source: sourceMeta,
    payload: genesis.payload,
    evidence: genesis.evidence,
  };

  writeJson(paths.genesis, genesisDocument);
  writeJson(paths.taste, taste);
  writeText(paths.landing, buildLandingHtml({ frCopy, receipt: landingReceipt }));
  writeJson(paths.ads, buildAdsJson({ frCopy, receipt: adsReceipt, market }));
  writeText(paths.emails, buildEmailsMjml({ frCopy, receipt: emailReceipt }));
  writeText(paths.press, buildPressMd({ frCopy, receipt: pressReceipt }));
  writeJson(paths.will, buildExpleeDraftPayload({ market, frCopy, receipt: willReceipt }));

  const written = Object.values(paths).map((file) => relative(targetRoot, file));
  writeText(paths.cortex, buildCortexReceipt({
    ts,
    market,
    sourceMeta,
    ledger,
    outRoot: targetRoot,
    written,
    taste,
  }));

  if (typeof network === 'function') {
    // Explicit non-call: keep network_calls at 0 for offline proof.
  }

  return {
    schema: DRAFT_PACKAGE_SCHEMA,
    outRoot: targetRoot,
    market,
    source: sourceMeta,
    admitted: { current: false },
    mutation_enabled: false,
    do_not_post: true,
    network_calls: 0,
    project_id: EXPLEE_PROJECT_ID,
    campaign_id: EXPLEE_CAMPAIGN_ID,
    paths,
    written,
    taste_verdict: taste.verdict,
    run_id: `run-${ts}`,
  };
}

export function parseDraftPackageArgs(argv = []) {
  const args = {
    meristemRoot: '',
    brandDir: DEFAULT_BRAND_DIR,
    market: DEFAULT_MARKET,
    outRoot: '',
    cambiumRoot: '',
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--meristem-root') {
      if (!next || next.startsWith('--')) throw new Error('--meristem-root expects a value');
      args.meristemRoot = next;
      i += 1;
    } else if (arg === '--brand-dir') {
      if (!next || next.startsWith('--')) throw new Error('--brand-dir expects a value');
      args.brandDir = next;
      i += 1;
    } else if (arg === '--market') {
      if (!next || next.startsWith('--')) throw new Error('--market expects a locale like fr-FR');
      args.market = next;
      i += 1;
    } else if (arg === '--out-root') {
      if (!next || next.startsWith('--')) throw new Error('--out-root expects a value');
      args.outRoot = next;
      i += 1;
    } else if (arg === '--cambium-root') {
      if (!next || next.startsWith('--')) throw new Error('--cambium-root expects a value');
      args.cambiumRoot = next;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  return args;
}

export function draftPackageUsage() {
  return [
    'usage: node bin/iverif-draft-package.mjs --meristem-root <path> [--brand-dir brands/iverif] [--market fr-FR] [--out-root .state/iverif]',
    '',
    'Path A draft-only Phase 5/6 package writer. Offline. Never POSTs to Explee.',
    'If meristem W7 brand tree is unavailable, falls back to bin/fixtures/meristem-v2-iverif.',
    '',
    'Example (fixture / W7 unavailable):',
    '  node bin/iverif-draft-package.mjs \\',
    '    --meristem-root /abs/path/to/missing-or-live-meristem \\',
    '    --brand-dir brands/iverif \\',
    '    --market fr-FR \\',
    '    --out-root .state/iverif',
  ].join('\n');
}

export function listStateArtifacts(outRoot) {
  if (!existsSync(outRoot)) return [];
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else found.push(relative(outRoot, full));
    }
  };
  walk(outRoot);
  return found.sort();
}
