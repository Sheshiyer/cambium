// Headless Chrome viewport proof for the Telegram mini app visual surface.
// This deliberately uses the real PAGE export and local HTTP routes so the
// screenshots exercise the same inline app script the Worker serves.

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PAGE } from './page.ts';
import { FRESH_ECOSYSTEM_VISUAL_FIXTURE, IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE, NO_FAKE_PROGRESS_VISUAL_FIXTURE } from './visual-fixtures.ts';
import { loadBranchStories } from '../../../bin/quine/hyphae/branch-stories.ts';
import { buildMissionFabricProjection } from './mission-fabric.ts';
import { FABRIC_SOURCE_FIXTURE } from './mission-fabric-fixture.ts';
import { ORGAN_UPDATE_PLAN } from './organ-update-delivery.ts';
import {
  PORTFOLIO_CATALOG,
  buildPortfolioJoinReport,
  portfolioPairDigest,
} from './portfolio-catalog.ts';

function playwrightHeadlessShellCandidates() {
  const cacheDir = join(homedir(), 'Library', 'Caches', 'ms-playwright');
  try {
    return readdirSync(cacheDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('chromium_headless_shell-'))
      .map((entry) => join(cacheDir, entry.name, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'))
      .filter((path) => existsSync(path))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  } catch {
    return [];
  }
}

const DEFAULT_BROWSER_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Arc.app/Contents/MacOS/Arc',
  ...playwrightHeadlessShellCandidates(),
];
const explicitChrome = String(process.env.CHROME_BIN || '').trim();
const BROWSER_CANDIDATES = explicitChrome
  ? [explicitChrome]
  : DEFAULT_BROWSER_CANDIDATES.filter((path) => existsSync(path));
const CHROME = BROWSER_CANDIDATES[0] || DEFAULT_BROWSER_CANDIDATES[0];
const CDP_TIMEOUT_MS = Number(process.env.CDP_TIMEOUT_MS || 30_000);
const CDP_PROBE_TIMEOUT_MS = Number(process.env.CDP_PROBE_TIMEOUT_MS || 3_500);
const CDP_OPERATION_TIMEOUT_MS = Number(process.env.CDP_OPERATION_TIMEOUT_MS || 15_000);
const argv = new Set(process.argv.slice(2));
const DIAGNOSE_BROWSER = argv.has('--diagnose-browser');
const MOBILE_CONTRACT_ONLY = argv.has('--mobile-contract');
const INCLUDE_HEADED_BROWSER_PROBE = argv.has('--include-headed-browser-probe') || process.env.INCLUDE_HEADED_BROWSER_PROBE === '1';
const PROOF_PATH_FILTER = String(process.env.TG_VIEWPORT_PROOF_FILTER || '').trim();
export function shouldWriteCanonicalViewportArtifacts(proofPathFilter, mobileContractOnly = false) {
  return String(proofPathFilter || '').trim().length === 0 && mobileContractOnly !== true;
}
const WRITE_CANONICAL_PROOF_ARTIFACTS = shouldWriteCanonicalViewportArtifacts(PROOF_PATH_FILTER, MOBILE_CONTRACT_ONLY);
let activeBrowser = CHROME;
let activeBrowserMode = 'headless-new';

const outDir = resolve('docs/plans/assets/tg-miniapp-viewport-proof');
const diagnosticsDir = resolve('.artifacts/tg-miniapp-viewport');
export function viewportProofArtifactDirectory({ proofPathFilter = '', mobileContractOnly = false } = {}) {
  return shouldWriteCanonicalViewportArtifacts(proofPathFilter, mobileContractOnly)
    ? outDir
    : join(diagnosticsDir, 'captures');
}

export function isDirectInvocation(argvEntry = process.argv[1], moduleUrl = import.meta.url) {
  if (!argvEntry) return false;
  const modulePath = fileURLToPath(moduleUrl);
  return resolve(argvEntry) === modulePath
    || basename(resolve(argvEntry)) === basename(modulePath);
}
const viewport = { width: 390, height: 844 };
const proofPage = PAGE.replace('https://telegram.org/js/telegram-web-app.js', '/telegram-web-app.js');
const PAGE_SOURCE_SHA256 = createHash('sha256').update(PAGE).digest('hex');
const VIEWPORT_PROOF_MANIFEST_SCHEMA = 'cambium.tg-viewport-proof-manifest.v1';
const REDACTED_PROOF_SECRET_PATTERN = /(query_id=|auth_date=|tgWebAppData|QUESTS_PUSH_TOKEN|Bearer\s+|secret-hash|secret-signature)/i;

function missionContainmentAssertion(width) {
  return `(() => {
    const scenes = [...document.querySelectorAll('.scene')];
    const activeTab = document.querySelector('.root-tab.on');
    const activeIndex = Number(String(activeTab?.id || 'tb0').replace('tb', '')) || 0;
    const scene = scenes[activeIndex];
    const card = document.querySelector('.mc-mission-card');
    const branches = document.querySelector('.mc-branch-rail');
    const questline = document.querySelector('.mc-timeline, .mc-questline');
    const proofRows = [...document.querySelectorAll('[data-mission-proof-row]')];
    const branchAllowlist = scene ? [...scene.querySelectorAll('[data-horizontal-scroll="branch-rail"]')] : [];
    const isAllowlisted = (node) => Boolean(node.closest('[data-horizontal-scroll="branch-rail"]'));
    const isVisible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
    };
    const horizontalScrollers = scene ? [...scene.querySelectorAll('*')].filter((node) => {
      const style = getComputedStyle(node);
      return node.scrollWidth > node.clientWidth + 1 && /^(auto|scroll)$/.test(style.overflowX);
    }) : [];
    const sceneRect = scene?.getBoundingClientRect();
    const boundaryLeft = Math.max(0, sceneRect?.left || 0);
    const boundaryRight = Math.min(window.innerWidth, sceneRect?.right || window.innerWidth);
    const overflowOffenders = scene ? [...scene.querySelectorAll('*')].filter((node) => {
      if (isAllowlisted(node) || !isVisible(node)) return false;
      const rect = node.getBoundingClientRect();
      return rect.left < boundaryLeft - 1 || rect.right > boundaryRight + 1;
    }) : [];
    const inactiveSceneIntersections = scenes.filter((node, index) => {
      if (index === activeIndex) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 1 && rect.right > .5 && rect.left < window.innerWidth - .5;
    });
    const compactActionRows = scene ? [...scene.querySelectorAll('[data-component="MissionToolLink"], [data-component="BranchLoopControls"]')] : [];
    const compactActionsDoNotOverlap = compactActionRows.every((row) => {
      const button = row.querySelector('button');
      const copy = [...row.children].find((node) => node !== button);
      if (!button || !copy) return false;
      const a = button.getBoundingClientRect();
      const b = copy.getBoundingClientRect();
      return a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1;
    });
    const questlineStyle = questline ? getComputedStyle(questline) : null;
    const checks = {
      viewport: Math.abs(window.innerWidth - ${width}) <= 1,
      documentViewport: Math.abs(document.body.clientWidth - window.innerWidth) <= 1 && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1,
      sceneContained: Boolean(scene) && scene.scrollWidth <= scene.clientWidth + 1,
      cardContained: Boolean(card) && card.scrollWidth <= card.clientWidth + 1,
      branchRailContained: Boolean(branches) && branches.getBoundingClientRect().left >= boundaryLeft - 1 && branches.getBoundingClientRect().right <= boundaryRight + 1,
      branchRailAllowlisted: branchAllowlist.length === 1 && branchAllowlist[0] === branches,
      branchRailOnlyHorizontalScroller: Boolean(branches) && branches.scrollWidth > branches.clientWidth + 1 && horizontalScrollers.every(isAllowlisted),
      questlineContained: Boolean(questline) && questline.getBoundingClientRect().left >= boundaryLeft - 1 && questline.getBoundingClientRect().right <= boundaryRight + 1,
      questlineIntrinsicFit: Boolean(questline) && questline.scrollWidth <= questline.clientWidth + 1,
      questlineNoHorizontalGesture: Boolean(questlineStyle) && !/^(auto|scroll)$/.test(questlineStyle.overflowX) && !questlineStyle.touchAction.split(/\\s+/).includes('pan-x'),
      branchTabs: Boolean(branches) && branches.getAttribute('role') === 'tablist' && Boolean(branches.querySelector('[role="tab"][aria-selected="true"]')),
      proofButtons: proofRows.length > 0 && proofRows.every((row) => row.tagName === 'BUTTON'),
      labelsBounded: [...document.querySelectorAll('.mc-timeline-station b, .mc-questline-row b')].every((label) => label.scrollWidth <= label.clientWidth + 1 || getComputedStyle(label).webkitLineClamp === '2'),
      activeSceneDescendantsContained: overflowOffenders.length === 0,
      settledSceneIsolated: inactiveSceneIntersections.length === 0,
      compactActionsDoNotOverlap,
    };
    const describe = (node) => node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') + (node.classList.length ? '.' + [...node.classList].join('.') : '');
    return {
      ok:Object.values(checks).every(Boolean),
      checks,
      diagnostics:{
        questline:questline ? { clientWidth:questline.clientWidth, scrollWidth:questline.scrollWidth, overflowX:questlineStyle.overflowX, touchAction:questlineStyle.touchAction } : null,
        horizontalScrollers:horizontalScrollers.map(describe),
        overflowOffenders:overflowOffenders.map(describe),
        inactiveSceneIntersections:inactiveSceneIntersections.map(describe),
      },
    };
  })()`;
}

function inspectPanePreparation(pane, disclosureTitle) {
  return `(() => {
    const tab = document.querySelector('[data-inspect-pane-select="${pane}"]');
    if (!tab) throw new Error('missing Inspect ${pane} tab');
    if (tab.getAttribute('aria-selected') !== 'true') tab.click();
    const active = document.querySelector('[data-inspect-pane="${pane}"].is-active');
    if (!active) throw new Error('Inspect ${pane} pane did not activate');
    const details = [...active.querySelectorAll('details')].find((node) => node.querySelector('summary')?.textContent.includes(${JSON.stringify(disclosureTitle)}));
    if (!details) throw new Error('missing Inspect disclosure ${disclosureTitle}');
    details.open = true;
  })()`;
}

function inspectContainmentAssertion(pane, width) {
  return `(() => {
    const scene = document.querySelectorAll('.scene')[4];
    const active = document.querySelector('[data-inspect-pane="${pane}"].is-active');
    const summary = document.querySelector('[data-component="InspectProofSummaryAction"]');
    const switcher = document.querySelector('[data-component="InspectPaneSwitcher"]');
    const frontierMapBadges = [...document.querySelectorAll('.maphead .mapbadge[data-ecosystem-target="r3f"]')];
    const proofDetailsButtons = [...document.querySelectorAll('[data-component="InspectProofSummaryAction"] [data-inspect-summary="1"]')];
    const frontierMapBadge = frontierMapBadges.length === 1 ? frontierMapBadges[0] : null;
    const openProofDetails = proofDetailsButtons.length === 1 ? proofDetailsButtons[0] : null;
    const checks = {
      viewport: Math.abs(window.innerWidth - ${width}) <= 1,
      bodyViewport: Math.abs(document.body.clientWidth - window.innerWidth) <= 1,
      rootContained: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1,
      sceneContained: Boolean(scene) && scene.scrollWidth <= scene.clientWidth + 1,
      paneActive: Boolean(active),
      paneContained: Boolean(active) && active.scrollWidth <= active.clientWidth + 1,
      summaryContained: Boolean(summary) && summary.scrollWidth <= summary.clientWidth + 1,
      switcherContained: Boolean(switcher) && switcher.scrollWidth <= switcher.clientWidth + 1,
      groupRowsContained: Boolean(active) && [...active.querySelectorAll('.inspect-group')].every((row) => row.scrollWidth <= row.clientWidth + 1),
      frontierMapBadgeUnique: frontierMapBadges.length === 1,
      proofDetailsButtonUnique: proofDetailsButtons.length === 1,
      frontierMapBadgeHeight: Boolean(frontierMapBadge) && frontierMapBadge.getBoundingClientRect().height >= 44,
      openProofDetailsHeight: Boolean(openProofDetails) && openProofDetails.getBoundingClientRect().height >= 44,
    };
    return { ok:Object.values(checks).every(Boolean), checks };
  })()`;
}

function redactProofFixtureValue(value) {
  if (typeof value === 'string') return value.replaceAll('QUESTS_PUSH_TOKEN', '[redacted worker credential]');
  if (Array.isArray(value)) return value.map(redactProofFixtureValue);
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactProofFixtureValue(entry)]));
  return value;
}

export function buildQueuedActionRequestFixture() {
  const fixture = redactProofFixtureValue(IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE);
  const pending = fixture.actionRequests.rows.find((row) => row.status === 'needs_signed_confirmation');
  if (!pending) throw new Error('IVerif visual fixture is missing its signed ActionRequest row');
  const queued = {
    ...pending,
    id: 'ar_iverif_w6_live_mrcwmcs3',
    status: 'queued',
    title: 'IVerif: decision needed before action',
    updatedAt: '2026-07-10T11:35:41.833Z',
    next: 'Cambium can consume this queued branch task after operator review',
    evidence: 'AutoGTM by Explee has triggered leads, but post-lead enrichment, outreach, and follow-up loop is not configured yet. Hermes is asking for founder direction before any client-facing send or automated outreach happens.',
    reversibility: 'queued ActionRequest can be superseded until consumed by Cambium',
    priority: {
      ...pending.priority,
      dependency: 'operator-consumption',
      reasons: ['IVerif', 'the-handoff', 'queued'],
    },
    receipts: {
      count: 3,
      latest: {
        at: '2026-07-10T11:35:41.833Z',
        kind: 'gate',
        text: 'Signed confirmation queued: Draft follow-up.',
      },
    },
  };
  fixture.derivedAt = '2026-07-10T11:54:55.071Z';
  fixture.source = 'visual-fixture:iverif-queued-action-request';
  fixture.openItems = [];
  fixture.actionRequests.count = 1;
  fixture.actionRequests.rows = [queued];
  fixture.actionRequests.actionRequests = [queued];
  return fixture;
}

const QUEUED_ACTION_REQUEST_VISUAL_FIXTURE = buildQueuedActionRequestFixture();

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizedClickTargetCount(proof) {
  const value = proof.clickTargetCount ?? proof.clickabilityTargetCount;
  if (value === undefined) return undefined;
  const count = Number(value);
  return Number.isFinite(count) ? count : value;
}

function fixtureForCaptureStep(proof) {
  if (proof.fixture) return proof.fixture;
  return 'no-fake-progress';
}

export function validateViewportProofManifest(manifest) {
  const issues = [];
  if (!isPlainObject(manifest)) return ['manifest must be an object'];
  if (manifest.schema !== VIEWPORT_PROOF_MANIFEST_SCHEMA) issues.push(`manifest.schema must be ${VIEWPORT_PROOF_MANIFEST_SCHEMA}`);
  if (!isNonEmptyString(manifest.generatedAt)) issues.push('manifest.generatedAt must be present');
  if (!/^[a-f0-9]{64}$/.test(String(manifest.pageSourceSha256 || ''))) issues.push('manifest.pageSourceSha256 must be a SHA-256 digest');
  if (!isNonEmptyString(manifest.browserMode)) issues.push('manifest.browserMode must be present');
  if (!isNonEmptyString(manifest.invariant)) issues.push('manifest.invariant must be present');
  if (!Array.isArray(manifest.proofs) || manifest.proofs.length === 0) issues.push('manifest.proofs must include at least one proof');

  const manifestText = JSON.stringify(manifest);
  if (REDACTED_PROOF_SECRET_PATTERN.test(manifestText)) {
    issues.push('manifest must not contain raw Telegram initData, WebView query data, bearer tokens, or proof secrets');
  }

  for (const [index, proof] of Array.isArray(manifest.proofs) ? manifest.proofs.entries() : []) {
    const prefix = `manifest.proofs[${index}]`;
    if (!isPlainObject(proof)) {
      issues.push(`${prefix} must be an object`);
      continue;
    }
    if (!isNonEmptyString(proof.scene)) issues.push(`${prefix}.scene must be present`);
    if (!isNonEmptyString(proof.path)) issues.push(`${prefix}.path must be present`);
    if (!isNonEmptyString(proof.intent)) issues.push(`${prefix}.intent must be present`);
    if (!isNonEmptyString(proof.fixture)) issues.push(`${prefix}.fixture must be present`);
    if ('sha256' in proof && !/^[a-f0-9]{64}$/.test(String(proof.sha256 || ''))) issues.push(`${prefix}.sha256 must be a SHA-256 digest when present`);

    const clickTargetCount = normalizedClickTargetCount(proof);
    if (clickTargetCount !== undefined && (!Number.isInteger(clickTargetCount) || clickTargetCount < 1)) {
      issues.push(`${prefix}.clickTargetCount must be a positive integer when present`);
    }

    if (proof.intent === 'clickability-proof') {
      const sheet = isPlainObject(proof.sheet) ? proof.sheet : {};
      const inPageInteraction = proof.interactionSurface === 'page';
      if (!isNonEmptyString(proof.clickTargetSelector)) issues.push(`${prefix}.clickTargetSelector must be present for clickability proofs`);
      if (!inPageInteraction && !isNonEmptyString(proof.clipSelector) && !isNonEmptyString(sheet.clipSelector)) {
        issues.push(`${prefix}.clipSelector or sheet.clipSelector must be present for clickability proofs`);
      }
      if (inPageInteraction && proof.browserAssertions !== true) issues.push(`${prefix}.browserAssertions must be true for in-page clickability proofs`);
      if (clickTargetCount === undefined) issues.push(`${prefix}.clickTargetCount must be present for clickability proofs`);
    }
  }

  return issues;
}

export function assertViewportProofManifestSchema(manifest) {
  const issues = validateViewportProofManifest(manifest);
  if (issues.length > 0) {
    throw new Error(`Viewport proof manifest schema failed:\n- ${issues.join('\n- ')}`);
  }
}

export function buildViewportProofManifest({
  generatedAt = new Date().toISOString(),
  chrome,
  browserMode,
  browserCandidates,
  viewport,
  proofs,
}) {
  const browserEvidenceLabel = (value) => String(value || '').split('/').filter(Boolean).at(-1) || 'unknown-browser';
  const proofIntentSummary = proofs.reduce((summary, proof) => {
    summary[proof.intent] = (summary[proof.intent] || 0) + 1;
    return summary;
  }, {});

  const manifest = {
    schema: VIEWPORT_PROOF_MANIFEST_SCHEMA,
    generatedAt,
    pageSourceSha256: PAGE_SOURCE_SHA256,
    chrome: browserEvidenceLabel(chrome),
    browserMode,
    browserCandidates: browserCandidates.map(browserEvidenceLabel),
    viewport,
    proofIntentSummary,
    proofs,
    invariant: 'Screenshots use the real PAGE export, local API fixtures, mobile emulation, browser-asserted in-page interaction proof, and a clipped real sheet proof for bottom-sheet actions; queued component proofs additionally use exact-width touch emulation.',
  };
  assertViewportProofManifestSchema(manifest);
  return manifest;
}

export const VIEWPORT_PROOF_CAPTURE_STEPS = [
  {
    scene: 'mission',
    fixture: 'branch-stories',
    path: 'mission-control-320-mobile.png',
    intent: 'layout-proof',
    sceneIndex: 0,
    exactViewport: true,
    viewport: { width: 320, height: 844 },
    waitFor: "document.querySelector('.mc-mission-card') && document.querySelector('.mc-branch-rail[role=\"tablist\"]') && document.querySelector('.mc-timeline[data-no-scene-drag=\"1\"], .mc-questline[data-no-scene-drag=\"1\"]')",
    assertExpression: missionContainmentAssertion(320),
  },
  {
    scene: 'mission',
    fixture: 'branch-stories',
    path: 'mission-control-mobile.png',
    intent: 'layout-proof',
    sceneIndex: 0,
    exactViewport: true,
    waitFor: "document.querySelector('[data-component=\"MissionControlShell\"]') && document.querySelector('[data-component=\"RootNav\"]') && document.querySelector('.mc-mission-card') && document.body.textContent.includes('Fitcheck') && document.body.textContent.includes('Run authenticated Shopify widget QA')",
    assertExpression: missionContainmentAssertion(390),
  },
  {
    scene: 'mission',
    fixture: 'branch-stories',
    path: 'mission-control-430-mobile.png',
    intent: 'layout-proof',
    sceneIndex: 0,
    exactViewport: true,
    viewport: { width: 430, height: 844 },
    waitFor: "document.querySelector('.mc-mission-card') && document.querySelector('.mc-branch-rail[role=\"tablist\"]') && document.querySelector('.mc-timeline[data-no-scene-drag=\"1\"], .mc-questline[data-no-scene-drag=\"1\"]')",
    assertExpression: missionContainmentAssertion(430),
  },
  {
    scene: 'mission',
    fixture: 'branch-stories',
    path: 'mission-actions-mobile.png',
    intent: 'layout-proof',
    sceneIndex: 0,
    scrollSelector: '[data-component="GateActionRow"]',
    waitFor: "document.querySelector('[data-component=\"MissionStateStack\"]') && document.querySelector('[data-component=\"ProofList\"]') && document.querySelector('[data-component=\"GateActionRow\"]') && document.querySelector('[data-mission-action=\"gate\"]') && document.querySelector('[data-mission-action=\"proof\"]')",
  },
  {
    scene: 'mission',
    fixture: 'branch-stories',
    path: 'mission-utilities-mobile.png',
    intent: 'layout-proof',
    sceneIndex: 0,
    scrollSelector: '[data-component="MissionToolLink"]',
    waitFor: "document.querySelector('[data-component=\"MissionToolLink\"]') && document.querySelector('[data-component=\"BranchLoopControls\"]') && document.querySelector('[data-component=\"KpiPulse\"]')",
    assertExpression: missionContainmentAssertion(390),
  },
  {
    scene: 'components',
    fixture: 'branch-stories',
    path: 'component-glyph-state-board-mobile.png',
    intent: 'layout-proof',
    sceneIndex: 4,
    waitFor: "document.querySelector('[data-component=\"ComponentGallery\"]') && document.querySelector('[data-component=\"ComponentGlyphStateBoard\"]') && document.querySelector('[data-component=\"ComponentStateBoard\"]') && document.querySelector('[data-component=\"ComponentOrbitProgressBoard\"]') && document.querySelector('[data-component=\"ComponentMissionComponentsBoard\"]') && document.querySelector('[data-component=\"ComponentMotionPrimitives\"]') && document.querySelector('[data-component=\"ComponentLegend\"]') && document.body.textContent.includes('Glyph State Board') && document.body.textContent.includes('Orbit Progress')",
  },
  {
    scene: 'components',
    fixture: 'branch-stories',
    path: 'component-mission-components-mobile.png',
    intent: 'layout-proof',
    sceneIndex: 4,
    scrollSelector: '[data-component="ComponentMissionComponentsBoard"]',
    waitFor: "document.querySelector('[data-component=\"ComponentMissionComponentsBoard\"]') && document.body.textContent.includes('Mission Components') && document.body.textContent.includes('GateActionRow')",
  },
  {
    scene: 'components',
    fixture: 'branch-stories',
    path: 'component-motion-legend-mobile.png',
    intent: 'layout-proof',
    sceneIndex: 4,
    scrollSelector: '[data-component="ComponentMotionPrimitives"]',
    waitFor: "document.querySelector('[data-component=\"ComponentMotionPrimitives\"]') && document.querySelector('[data-component=\"ComponentLegend\"]') && document.body.textContent.includes('Motion Primitives') && document.body.textContent.includes('Legend')",
  },
  {
    scene: 'components',
    fixture: 'branch-stories',
    path: 'component-legend-mobile.png',
    intent: 'layout-proof',
    sceneIndex: 4,
    scrollSelector: '[data-component="ComponentLegend"]',
    waitFor: "document.querySelector('[data-component=\"ComponentLegend\"]') && document.body.textContent.includes('Node') && document.body.textContent.includes('Stale')",
  },
  {
    scene: 'mission',
    fixture: 'branch-stories',
    path: 'sheet-mission-review-gate-mobile.png',
    intent: 'clickability-proof',
    sceneIndex: 0,
    waitFor: "document.querySelector('[data-mission-action=\"gate\"]')",
    scrollSelector: '[data-mission-action="gate"]',
    tapTargetSelector: '[data-mission-action="gate"]',
    waitAfterExpression: "document.querySelector('#sheet.on') && document.querySelector('#sheet').textContent.includes('branch gate') && document.querySelector('#sheet').textContent.includes('Fitcheck') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40",
    clickTargetSelector: '[data-mission-action="gate"]',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  {
    scene: 'mission',
    fixture: 'branch-stories',
    path: 'sheet-mission-open-proof-mobile.png',
    intent: 'clickability-proof',
    sceneIndex: 0,
    waitFor: "document.querySelector('[data-mission-action=\"proof\"]')",
    scrollSelector: '[data-mission-action="proof"]',
    tapTargetSelector: '[data-mission-action="proof"]',
    waitAfterExpression: "document.querySelector('#sheet.on') && document.querySelector('#sheet').textContent.includes('branch proof') && document.querySelector('#sheet').textContent.includes('Proof required') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40",
    clickTargetSelector: '[data-mission-action="proof"]',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  {
    scene: 'mission',
    fixture: 'branch-stories',
    path: 'mission-vantyx-selected-mobile.png',
    intent: 'clickability-proof',
    sceneIndex: 0,
    waitFor: "document.querySelector('[data-mission-branch=\"1\"]') && document.body.textContent.includes('Vantyx')",
    touchDragTargetSelector: '.mc-branch-rail',
    touchDragDistance: 96,
    tapTargetSelector: '[data-mission-branch="1"]',
    waitAfterExpression: "!document.querySelector('#sheet.on') && document.querySelector('[data-mission-branch=\"1\"][aria-selected=\"true\"]') && document.querySelector('#mission-branch-panel h3') && document.querySelector('#mission-branch-panel h3').textContent.includes('Create and health-check second tenant')",
    assertExpression: "(() => { const scene=document.querySelectorAll('.scene')[0]; const panel=document.querySelector('#mission-branch-panel'); const selected=document.querySelector('[data-mission-branch=\"1\"]'); const drag=JSON.parse(document.documentElement.dataset.proofTouchDrag || '{}'); const dragIsolated=drag.delta >= 24 && drag.sceneBefore === drag.sceneAfter && drag.sceneAfter === 'tb0' && drag.sheetBefore === false && drag.sheetAfter === false && drag.trackBefore === drag.trackAfter; return { ok:MISSION_BRANCH_FOCUS === 'vantyx' && !document.querySelector('#sheet.on') && document.activeElement === selected && panel && panel.scrollWidth <= panel.clientWidth + 1 && scene && scene.scrollWidth <= scene.clientWidth + 1 && dragIsolated, drag }; })()",
    clickTargetSelector: '[data-mission-branch="1"]',
    clickTargetCount: 1,
  },
  { scene: 'story', fixture: 'fresh', path: 'story-feed-mobile.png', intent: 'layout-proof', sceneIndex: 3, scrollSelector: '#beats', waitFor: "document.querySelector('[data-component=\"StoryDigestCards\"]') && document.querySelector('[data-component=\"StoryBeatCard\"]') && document.querySelector('[data-component=\"StoryPacketRail\"]') && document.body.textContent.includes('New signal')" },
  { scene: 'tools', fixture: 'fresh', path: 'tools-mobile.png', intent: 'layout-proof', sceneIndex: 2, waitFor: "document.querySelector('[data-component=\"ToolActionCard\"]') && document.querySelector('[data-tool-surface=\"handoffs\"]') && document.body.textContent.includes('Org status')" },
  {
    scene: 'tools',
    fixture: 'fresh',
    path: 'sheet-tools-handoff-action-mobile.png',
    intent: 'clickability-proof',
    sceneIndex: 2,
    waitFor: "document.querySelector('[data-tool-surface=\"handoffs\"]')",
    expression: "(() => { const el = document.querySelector('[data-tool-surface=\"handoffs\"]'); if (!el) throw new Error('missing Handoffs surface card'); el.click(); })()",
    waitAfterExpression: "document.querySelector('#sheet.on') && document.querySelector('#sheet [data-component=\"ToolHandoffActionRow\"]') && document.querySelector('#sheet [data-signed-action-entrypoint=\"approve\"]') && document.querySelector('#sheet').textContent.includes('Approve fresh viewport capture')",
    clickTargetSelector: '[data-tool-surface="handoffs"]',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  { scene: 'inspect', path: 'inspect-proof-320-mobile.png', intent: 'layout-proof', sceneIndex: 4, exactViewport: true, viewport: { width: 320, height: 844 }, waitFor: "document.querySelector('[data-inspect-pane=\"proof\"].is-active') && document.querySelector('[data-component=\"InspectProofSummaryAction\"]')", assertExpression: inspectContainmentAssertion('proof', 320) },
  { scene: 'inspect', path: 'inspect-system-overview-mobile.png', intent: 'layout-proof', sceneIndex: 4, waitFor: "document.querySelector('[data-inspect-pane-select=\"system\"]')", expression: "document.querySelector('[data-inspect-pane-select=\"system\"]').click()", waitAfterExpression: "document.querySelector('[data-inspect-pane=\"system\"].is-active') && document.querySelector('[data-inspect-pane-select=\"system\"][aria-selected=\"true\"]') && document.activeElement === document.querySelector('[data-inspect-pane-select=\"system\"]')", assertExpression: inspectContainmentAssertion('system', 390) },
  { scene: 'inspect', path: 'inspect-tapestry-audit-mobile.png', intent: 'layout-proof', sceneIndex: 4, prepareExpression: inspectPanePreparation('system', 'Runtime state'), waitFor: "document.querySelector('[data-component=\"InspectGroupStack\"]') && document.querySelector('[data-inspect-group=\"tools\"]') && document.querySelector('[data-tapestry=\"0\"]')", clickTargetCount: 14 },
  { scene: 'inspect', path: 'inspect-no-fake-progress-mobile.png', intent: 'layout-proof', sceneIndex: 4, prepareExpression: inspectPanePreparation('system', 'Runtime state'), scrollSelector: '[data-wake="0"]' },
  { scene: 'inspect', path: 'inspect-policy-gap-mobile.png', intent: 'layout-proof', sceneIndex: 4, prepareExpression: inspectPanePreparation('system', 'Runtime state'), scrollSelector: '[data-policy]' },
  { scene: 'inspect', path: 'inspect-live-proof-mobile.png', intent: 'layout-proof', sceneIndex: 4, prepareExpression: inspectPanePreparation('proof', 'Live readiness'), scrollSelector: '[data-live-proof="0"]', waitFor: "document.querySelector('[data-live-proof=\"0\"]')" },
  { scene: 'inspect', fixture: 'gate', path: 'inspect-gate-priority-mobile.png', intent: 'layout-proof', sceneIndex: 4, prepareExpression: inspectPanePreparation('system', 'Runtime state'), scrollSelector: '[data-policy]' },
  { scene: 'inspect', fixture: 'skill', path: 'inspect-skill-promotion-mobile.png', intent: 'layout-proof', sceneIndex: 4, prepareExpression: inspectPanePreparation('system', 'Operators'), scrollSelector: '[data-skill="0"]' },
  {
    scene: 'inspect',
    fixture: 'skill',
    path: 'sheet-inspect-skill-promotion-mobile.png',
    intent: 'clickability-proof',
    sceneIndex: 4,
    prepareExpression: inspectPanePreparation('system', 'Operators'),
    scrollSelector: '[data-skill="0"]',
    waitFor: "document.querySelector('[data-skill=\"0\"]')",
    expression: "(() => { const el = document.querySelector('[data-skill=\"0\"]'); if (!el) throw new Error('missing founder-review skill card'); el.click(); })()",
    waitAfterExpression: "document.querySelector('#sheet.on [data-promote-skill]') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40",
    clickTargetSelector: '[data-skill="0"]',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  {
    scene: 'inspect',
    fixture: 'mira',
    path: 'inspect-mira-relationship-mobile.png',
    intent: 'clickability-proof',
    sceneIndex: 4,
    prepareExpression: inspectPanePreparation('system', 'Operators'),
    scrollSelector: '[data-npc="0"]',
    waitFor: "document.querySelector('[data-npc=\"0\"]')",
    expression: "document.querySelector('[data-npc=\"0\"]').click()",
    waitAfterExpression: "document.querySelector('#sheet.on') && document.querySelector('#sheet').textContent.includes('companion · ready') && document.querySelector('#sheet').textContent.includes('MIRA') && document.querySelector('#sheet').textContent.includes('stage')",
    clickTargetSelector: '[data-npc="0"]',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  { scene: 'inspect', fixture: 'mira', path: 'inspect-companions-mobile.png', intent: 'layout-proof', sceneIndex: 4, prepareExpression: inspectPanePreparation('system', 'Operators'), scrollSelector: '[data-npc="0"]' },
  { scene: 'gate', path: 'gate-empty-mobile.png', intent: 'layout-proof', waitFor: "document.querySelector('[data-component=\"MissionControlShell\"]') && document.querySelector('[data-component=\"RootNav\"]') && document.querySelector('[data-component=\"GateEmptyState\"]') && document.body.textContent.includes('no founder decisions waiting')" },
  { scene: 'gate', fixture: 'gate', path: 'gate-consequence-mobile.png', intent: 'layout-proof', waitFor: "document.querySelector('[data-component=\"MissionControlShell\"]') && document.querySelector('[data-component=\"RootNav\"]') && document.querySelector('[data-signed-action-entrypoint=\"approve\"]') && document.body.textContent.includes('THO-9')" },
  { scene: 'gate', fixture: 'action-requests', path: 'gate-iverif-action-request-mobile.png', intent: 'layout-proof', waitFor: "document.querySelector('[data-action-request-id=\"ar_iverif_autogtm_followup_signed\"]') && document.body.textContent.includes('IVerif') && document.body.textContent.includes('needs_signed_confirmation')" },
  {
    scene: 'gate',
    fixture: 'action-request-queued',
    path: 'gate-iverif-queued-proof-mobile.png',
    intent: 'layout-proof',
    exactViewport: true,
    sceneIndex: 1,
    scrollSelector: '[data-action-request-id="ar_iverif_w6_live_mrcwmcs3"]',
    waitFor: `(() => {
      const card = document.querySelector('[data-action-request-id="ar_iverif_w6_live_mrcwmcs3"]');
      const proof = card && card.querySelector('[data-gate-proof="1"]');
      const preview = proof && proof.querySelector('.gate-proof-copy small');
      const queued = card && card.querySelector('[data-component="GateQueuedState"][data-state="queued"]');
      if (!card || !proof || !preview || !queued) return false;
      const scene = card.closest('.scene');
      const proofStyle = getComputedStyle(proof);
      const previewStyle = getComputedStyle(preview);
      const proofRect = proof.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const lineHeight = Number.parseFloat(previewStyle.lineHeight);
      return proof.tagName === 'BUTTON'
        && proofRect.height >= 44
        && proofRect.width >= cardRect.width - 28
        && proofStyle.textAlign === 'left'
        && previewStyle.webkitLineClamp === '2'
        && Number.isFinite(lineHeight)
        && previewRect.height <= lineHeight * 2 + 1
        && card.querySelector('[data-glyph-kind="proof"]')
        && card.querySelector('.gate-proof-open')
        && card.querySelector('[data-gate-detail="1"]')
        && !card.querySelector('[data-signed-action-entrypoint], [data-kind]')
        && card.scrollWidth <= card.clientWidth + 1
        && scene && scene.scrollWidth <= scene.clientWidth + 1
        && Math.abs(window.innerWidth - 390) <= 1
        && Math.abs(window.innerHeight - 844) <= 1
        && window.visualViewport
        && Math.abs(window.visualViewport.width - 390) <= 1
        && Math.abs(window.visualViewport.height - 844) <= 1;
    })()`,
  },
  {
    scene: 'gate',
    fixture: 'action-request-queued',
    path: 'sheet-gate-queued-result-mobile.png',
    intent: 'layout-proof',
    exactViewport: true,
    waitFor: "document.querySelector('[data-action-request-id=\"ar_iverif_w6_live_mrcwmcs3\"]') && document.querySelector('[data-component=\"GateQueuedState\"]')",
    expression: `(() => {
      const item = GATE_ITEMS[0];
      if (!item) throw new Error('missing queued ActionRequest for result sheet proof');
      const result = {
        queued: item.id,
        duplicate: false,
        idempotencyKey: 'confirm-action-request:cambium:ar_iverif_w6_live_mrcwmcs3:draft-follow-up',
        consequence: 'prepare copy and next-step options for approval, with no automatic send',
        reversibility: 'queued ActionRequest can be superseded until consumed by Cambium',
      };
      openGateResultSheet('confirm-action-request', item.id, result, result, item);
    })()`,
    waitAfterExpression: "document.querySelector('#sheet.on .gate-result-actions') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40",
    assertExpression: `(() => {
      const sheet = document.querySelector('#sheet.on');
      const actions = sheet && sheet.querySelector('.gate-result-actions');
      const refresh = actions && actions.querySelector('[data-gate-result-refresh="1"]');
      const mission = actions && actions.querySelector('[data-gate-result-nav="mission"]');
      const inspect = actions && actions.querySelector('[data-gate-result-nav="inspect"]');
      const kv = sheet && sheet.querySelector('.gatekv');
      if (!sheet || !actions || !refresh || !mission || !inspect || !kv) return { ok:false, missing:true };
      const actionsRect = actions.getBoundingClientRect();
      const refreshRect = refresh.getBoundingClientRect();
      const missionRect = mission.getBoundingClientRect();
      const inspectRect = inspect.getBoundingClientRect();
      const idempotency = [...kv.querySelectorAll('span')].find((span) => span.textContent.includes('confirm-action-request'));
      if (!idempotency) return { ok:false, missingIdempotency:true };
      const idempotencyStyle = getComputedStyle(idempotency);
      const checks = {
        refreshStartsAtGrid: Math.abs(refreshRect.left - actionsRect.left) <= 1,
        refreshEndsAtGrid: Math.abs(refreshRect.right - actionsRect.right) <= 1,
        navigationBelowRefresh: missionRect.top > refreshRect.bottom,
        navigationSharesRow: Math.abs(missionRect.top - inspectRect.top) <= 1,
        navigationSharesHeight: Math.abs(missionRect.height - inspectRect.height) <= 1,
        idempotencyWrapPolicy: idempotencyStyle.overflowWrap === 'anywhere' || idempotencyStyle.wordBreak === 'break-word',
        valuesDoNotOverflow: [...kv.querySelectorAll('span')].every((span) => span.scrollWidth <= span.clientWidth + 1),
        sheetDoesNotOverflow: sheet.scrollWidth <= sheet.clientWidth + 1,
        viewportWidthIsMobile: Math.abs(window.innerWidth - 390) <= 1,
        viewportHeightIsMobile: Math.abs(window.innerHeight - 844) <= 1,
        visualViewportIsMobile: Boolean(window.visualViewport)
          && Math.abs(window.visualViewport.width - 390) <= 1
          && Math.abs(window.visualViewport.height - 844) <= 1,
        bodyMatchesViewport: Math.abs(document.body.clientWidth - window.innerWidth) <= 1,
      };
      return {
        ok: Object.values(checks).every(Boolean),
        checks,
        widths: {
          sheetClient:sheet.clientWidth,
          sheetScroll:sheet.scrollWidth,
          viewport:window.innerWidth,
          visualViewport:window.visualViewport && window.visualViewport.width,
          visualScale:window.visualViewport && window.visualViewport.scale,
          screen:window.screen.width,
          outer:window.outerWidth,
          dpr:window.devicePixelRatio,
          document:document.documentElement.scrollWidth,
        },
      };
    })()`,
    clipSelector: '#sheet',
  },
  {
    scene: 'gate',
    fixture: 'action-request-queued',
    path: 'sheet-gate-queued-proof-detail-mobile.png',
    intent: 'clickability-proof',
    exactViewport: true,
    sceneIndex: 1,
    waitFor: "document.querySelector('[data-action-request-id=\"ar_iverif_w6_live_mrcwmcs3\"] [data-gate-proof=\"1\"]')",
    scrollSelector: '[data-action-request-id="ar_iverif_w6_live_mrcwmcs3"]',
    tapTargetSelector: '[data-action-request-id="ar_iverif_w6_live_mrcwmcs3"] [data-gate-proof="1"]',
    waitAfterExpression: "document.querySelector('.root-tab.on') && document.querySelector('.root-tab.on').id === 'tb4' && !document.querySelector('#sheet.on')",
    assertExpression: `(() => {
      const activeTab = document.querySelector('.root-tab.on');
      const scenes = [...document.querySelectorAll('.scene')];
      const inspectScene = scenes[4];
      const inspectVisible = inspectScene && getComputedStyle(inspectScene).display !== 'none';
      return {
        ok: Boolean(activeTab && activeTab.id === 'tb4' && inspectVisible && !document.querySelector('#sheet.on'))
          && Math.abs(window.innerWidth - 390) <= 1
          && Math.abs(window.innerHeight - 844) <= 1
          && Boolean(window.visualViewport)
          && Math.abs(window.visualViewport.width - 390) <= 1
          && Math.abs(window.visualViewport.height - 844) <= 1,
      };
    })()`,
    clickTargetSelector: '[data-action-request-id="ar_iverif_w6_live_mrcwmcs3"] [data-gate-proof="1"]',
    clickTargetCount: 1,
  },
  { scene: 'story', fixture: 'action-requests', path: 'story-iverif-action-request-mobile.png', intent: 'layout-proof', sceneIndex: 3, waitFor: "document.querySelector('[data-ecosystem-target=\"action-requests\"]') && document.querySelector('[data-component=\"StoryBeatCard\"][data-lane=\"action-request\"]')" },
  { scene: 'inspect', fixture: 'action-requests', path: 'inspect-iverif-action-request-mobile.png', intent: 'layout-proof', sceneIndex: 4, prepareExpression: inspectPanePreparation('proof', 'Decisions and receipts'), scrollSelector: '[data-action-request-id=\"ar_iverif_autogtm_followup_signed\"]', waitFor: "document.querySelector('[data-component=\"ActionRequestProjectionCard\"]') && document.body.textContent.includes('action requests')" },
  {
    scene: 'gate',
    fixture: 'action-requests',
    path: 'sheet-gate-confirm-action-request-preflight-mobile.png',
    intent: 'clickability-proof',
    waitFor: "document.querySelector('[data-signed-action-entrypoint=\"confirm-action-request\"]')",
    scrollSelector: '[data-signed-action-entrypoint="confirm-action-request"]',
    expression: "(() => { const el = document.querySelector('[data-signed-action-entrypoint=\"confirm-action-request\"]'); if (!el) throw new Error('missing confirm ActionRequest gate action'); el.click(); })()",
    waitAfterExpression: "document.querySelector('#sheet.on [data-gate-confirm=\"confirm-action-request\"]') && document.querySelector('#sheet').textContent.includes('gate preflight') && document.querySelector('#sheet [data-gate-preflight-inspect=\"1\"]') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40",
    clickTargetSelector: '[data-signed-action-entrypoint="confirm-action-request"]',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  {
    scene: 'gate',
    fixture: 'action-requests',
    path: 'sheet-gate-confirm-action-request-request-sent-mobile.png',
    intent: 'clickability-proof',
    waitFor: "document.querySelector('[data-signed-action-entrypoint=\"confirm-action-request\"]')",
    scrollSelector: '[data-signed-action-entrypoint="confirm-action-request"]',
    expression: "(() => { const entry = document.querySelector('[data-signed-action-entrypoint=\"confirm-action-request\"]'); if (!entry) throw new Error('missing confirm ActionRequest gate action'); entry.click(); })()",
    tapTargetSelector: '[data-gate-confirm="confirm-action-request"]',
    waitAfterExpression: "document.querySelector('#sheet.on [data-gate-confirm=\"confirm-action-request\"][data-gate-submit-state=\"request-sent\"]') && document.querySelector('[data-gate-submit-status=\"request-sent\"]') && document.querySelector('#sheet').textContent.includes('sending…') && document.querySelector('[data-gate-confirm=\"confirm-action-request\"]').textContent.includes('Queueing...')",
    expectedWorkerPostCount: 1,
    clickTargetSelector: '[data-gate-confirm="confirm-action-request"]',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  {
    scene: 'gate',
    fixture: 'gate',
    path: 'sheet-gate-approve-preflight-mobile.png',
    intent: 'clickability-proof',
    waitFor: "document.querySelector('[data-signed-action-entrypoint=\"approve\"]')",
    expression: "(() => { const el = document.querySelector('[data-signed-action-entrypoint=\"approve\"]'); if (!el) throw new Error('missing approve gate action'); el.click(); })()",
    waitAfterExpression: "document.querySelector('#sheet.on [data-gate-confirm=\"approve\"]') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40",
    clickTargetSelector: '[data-signed-action-entrypoint="approve"]',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  {
    scene: 'gate',
    fixture: 'gate',
    path: 'sheet-gate-reroll-preflight-mobile.png',
    intent: 'clickability-proof',
    waitFor: "document.querySelector('[data-signed-action-entrypoint=\"reroll\"]')",
    expression: "(() => { const el = document.querySelector('[data-signed-action-entrypoint=\"reroll\"]'); if (!el) throw new Error('missing reroll gate action'); el.click(); })()",
    waitAfterExpression: "document.querySelector('#sheet.on [data-gate-confirm=\"reroll\"]') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40",
    clickTargetSelector: '[data-signed-action-entrypoint="reroll"]',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  {
    scene: 'operating-canopy',
    fixture: 'operating-fabric',
    path: 'operating-fabric-320-mobile.png',
    intent: 'clickability-proof',
    exactViewport: true,
    viewport: { width: 320, height: 844 },
    waitFor: "document.getElementById('operating-fabric') && document.querySelector('[data-of-tab=\"canopy\"]') && document.querySelector('[data-of-gate-entrypoint]')",
    assertExpression: operatingFabricAllScenesAssertion(320),
    interactionSurface: 'page',
    clickTargetSelector: '#operating-fabric [data-of-tab]',
    clickTargetCount: 5,
  },
  {
    scene: 'operating-mission',
    fixture: 'operating-fabric',
    path: 'operating-fabric-gate-sheet-320-mobile.png',
    intent: 'clickability-proof',
    exactViewport: true,
    viewport: { width: 320, height: 844 },
    prepareWaitFor: "document.getElementById('operating-fabric') && document.querySelector('[data-of-tab=\"mission\"]')",
    prepareExpression: operatingFabricMissionPreparation(),
    waitFor: "document.querySelector('[data-of-scene=\"mission\"]').hidden === false && document.querySelector('[data-of-gate-entrypoint]')",
    tapTargetSelector: '[data-of-gate-entrypoint]',
    waitAfterExpression: "document.querySelector('#sheet.on') && document.querySelector('#sheet [data-gate-cancel=\"1\"]') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40 && document.querySelector('#sheet').getBoundingClientRect().right <= window.innerWidth + 1",
    clickTargetSelector: '[data-of-gate-entrypoint]',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  {
    scene: 'operating-mission',
    fixture: 'operating-fabric',
    path: 'operating-fabric-inspect-sheet-320-mobile.png',
    intent: 'clickability-proof',
    exactViewport: true,
    viewport: { width: 320, height: 844 },
    prepareWaitFor: "document.getElementById('operating-fabric') && document.querySelector('[data-of-tab=\"mission\"]')",
    prepareExpression: operatingFabricMissionPreparation(),
    waitFor: "document.querySelector('[data-of-scene=\"mission\"]').hidden === false && document.querySelector('[data-of-scene=\"mission\"] .of-inspect-btn')",
    tapTargetSelector: '[data-of-scene="mission"] .of-inspect-btn',
    waitAfterExpression: "document.querySelector('#sheet.on [data-of-inspect-back]') && document.querySelector('#sheet.on [data-of-inspect-close]') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40 && document.querySelector('#sheet').getBoundingClientRect().right <= window.innerWidth + 1",
    clickTargetSelector: '[data-of-scene="mission"] .of-inspect-btn',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  {
    scene: 'operating-canopy',
    fixture: 'operating-fabric',
    path: 'operating-fabric-390-mobile.png',
    intent: 'clickability-proof',
    waitFor: "document.getElementById('operating-fabric') && document.querySelector('[data-of-tab=\"canopy\"]') && document.querySelector('[data-of-gate-entrypoint]')",
    assertExpression: operatingFabricAllScenesAssertion(390),
    interactionSurface: 'page',
    clickTargetSelector: '#operating-fabric [data-of-tab]',
    clickTargetCount: 5,
  },
  {
    scene: 'operating-mission',
    fixture: 'operating-fabric',
    path: 'operating-fabric-gate-sheet-390-mobile.png',
    intent: 'clickability-proof',
    prepareWaitFor: "document.getElementById('operating-fabric') && document.querySelector('[data-of-tab=\"mission\"]')",
    prepareExpression: operatingFabricMissionPreparation(),
    waitFor: "document.querySelector('[data-of-scene=\"mission\"]').hidden === false && document.querySelector('[data-of-gate-entrypoint]')",
    tapTargetSelector: '[data-of-gate-entrypoint]',
    waitAfterExpression: "document.querySelector('#sheet.on') && document.querySelector('#sheet [data-gate-cancel=\"1\"]') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40 && document.querySelector('#sheet').getBoundingClientRect().right <= window.innerWidth + 1",
    clickTargetSelector: '[data-of-gate-entrypoint]',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  {
    scene: 'operating-mission',
    fixture: 'operating-fabric',
    path: 'operating-fabric-inspect-sheet-390-mobile.png',
    intent: 'clickability-proof',
    prepareWaitFor: "document.getElementById('operating-fabric') && document.querySelector('[data-of-tab=\"mission\"]')",
    prepareExpression: operatingFabricMissionPreparation(),
    waitFor: "document.querySelector('[data-of-scene=\"mission\"]').hidden === false && document.querySelector('[data-of-scene=\"mission\"] .of-inspect-btn')",
    tapTargetSelector: '[data-of-scene="mission"] .of-inspect-btn',
    waitAfterExpression: "document.querySelector('#sheet.on [data-of-inspect-back]') && document.querySelector('#sheet.on [data-of-inspect-close]') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40 && document.querySelector('#sheet').getBoundingClientRect().right <= window.innerWidth + 1",
    clickTargetSelector: '[data-of-scene="mission"] .of-inspect-btn',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  {
    scene: 'operating-canopy',
    fixture: 'operating-fabric',
    path: 'operating-fabric-430-mobile.png',
    intent: 'clickability-proof',
    exactViewport: true,
    viewport: { width: 430, height: 844 },
    waitFor: "document.getElementById('operating-fabric') && document.querySelector('[data-of-tab=\"canopy\"]') && document.querySelector('[data-of-gate-entrypoint]')",
    assertExpression: operatingFabricAllScenesAssertion(430),
    interactionSurface: 'page',
    clickTargetSelector: '#operating-fabric [data-of-tab]',
    clickTargetCount: 5,
  },
  {
    scene: 'operating-mission',
    fixture: 'operating-fabric',
    path: 'operating-fabric-gate-sheet-430-mobile.png',
    intent: 'clickability-proof',
    exactViewport: true,
    viewport: { width: 430, height: 844 },
    prepareWaitFor: "document.getElementById('operating-fabric') && document.querySelector('[data-of-tab=\"mission\"]')",
    prepareExpression: operatingFabricMissionPreparation(),
    waitFor: "document.querySelector('[data-of-scene=\"mission\"]').hidden === false && document.querySelector('[data-of-gate-entrypoint]')",
    tapTargetSelector: '[data-of-gate-entrypoint]',
    waitAfterExpression: "document.querySelector('#sheet.on') && document.querySelector('#sheet [data-gate-cancel=\"1\"]') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40 && document.querySelector('#sheet').getBoundingClientRect().right <= window.innerWidth + 1",
    clickTargetSelector: '[data-of-gate-entrypoint]',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
  {
    scene: 'operating-mission',
    fixture: 'operating-fabric',
    path: 'operating-fabric-inspect-sheet-430-mobile.png',
    intent: 'clickability-proof',
    exactViewport: true,
    viewport: { width: 430, height: 844 },
    prepareWaitFor: "document.getElementById('operating-fabric') && document.querySelector('[data-of-tab=\"mission\"]')",
    prepareExpression: operatingFabricMissionPreparation(),
    waitFor: "document.querySelector('[data-of-scene=\"mission\"]').hidden === false && document.querySelector('[data-of-scene=\"mission\"] .of-inspect-btn')",
    tapTargetSelector: '[data-of-scene="mission"] .of-inspect-btn',
    waitAfterExpression: "document.querySelector('#sheet.on [data-of-inspect-back]') && document.querySelector('#sheet.on [data-of-inspect-close]') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40 && document.querySelector('#sheet').getBoundingClientRect().right <= window.innerWidth + 1",
    clickTargetSelector: '[data-of-scene="mission"] .of-inspect-btn',
    clickTargetCount: 1,
    clipSelector: '#sheet',
  },
];

export const MOBILE_CONTRACT_PROOF_PATHS = [
  'mission-control-320-mobile.png',
  'mission-control-mobile.png',
  'mission-control-430-mobile.png',
  'mission-utilities-mobile.png',
  'mission-vantyx-selected-mobile.png',
  'sheet-gate-queued-proof-detail-mobile.png',
  'operating-fabric-320-mobile.png',
  'operating-fabric-gate-sheet-320-mobile.png',
  'operating-fabric-inspect-sheet-320-mobile.png',
  'operating-fabric-390-mobile.png',
  'operating-fabric-gate-sheet-390-mobile.png',
  'operating-fabric-inspect-sheet-390-mobile.png',
  'operating-fabric-430-mobile.png',
  'operating-fabric-gate-sheet-430-mobile.png',
  'operating-fabric-inspect-sheet-430-mobile.png',
];

export function selectViewportProofCaptureSteps({ proofPathFilter = '', mobileContractOnly = false } = {}) {
  if (String(proofPathFilter).trim()) {
    return VIEWPORT_PROOF_CAPTURE_STEPS.filter((proof) => proof.path.includes(String(proofPathFilter).trim()));
  }
  if (mobileContractOnly) {
    const paths = new Set(MOBILE_CONTRACT_PROOF_PATHS);
    return VIEWPORT_PROOF_CAPTURE_STEPS.filter((proof) => paths.has(proof.path));
  }
  return VIEWPORT_PROOF_CAPTURE_STEPS;
}

const gateFixture = {
  ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
  openItems: [
    {
      id: 'THO-9',
      title: 'Review launch copy',
      branchId: 'cambium',
      missionId: 'the-ship-gate',
      source: 'Paperclip · paperclip-open-items',
      status: 'blocked',
      owner: 'Mathis',
      updatedAt: '2026-06-22T00:00:00.000Z',
      evidence: 'THO-9 is blocked · owner Mathis · updated 2026-06-22T00:00:00.000Z',
      consequence: 'queue founder decision for THO-9; no Paperclip mutation until consumed',
      approveConsequence: 'queue founder approval for THO-9; no Paperclip mutation until consumed',
      rerollConsequence: 'queue founder reroll request for THO-9; no Paperclip mutation until consumed',
      reversibility: 'queued action can be superseded until consumed; reroll keeps the item open',
      idempotencyHint: 'THO-9:blocked:2026-06-22T00:00:00.000Z',
      priority: {
        source: 'paperclip-priority@v1',
        risk: 'critical',
        dependency: 'blocks-delivery',
        score: 24,
        reasons: ['status/title indicates blocked or critical risk', 'item can block delivery or founder handoff'],
      },
    },
  ],
  policy: {
    source: 'operator-policy',
    status: 'ready',
    action: 'Review gate item THO-9: Review launch copy',
    title: 'NEXT ACTION',
    detail: 'THO-9 · blocked · blocked queue priority · critical risk · blocks-delivery dependency',
    blockers: [],
    cautions: ['founder must still choose approve or reroll inside the signed Gate flow'],
    requiredSignals: ['gate item evidence', 'gate consequences', 'gate idempotency', 'gate queue priority', 'gate risk signal', 'gate dependency signal'],
    rulesVersion: 'operator-policy@v1.4',
  },
  senses: {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE.senses,
    rows: NO_FAKE_PROGRESS_VISUAL_FIXTURE.senses.rows.map((sense) => sense.id === 'risk'
      ? {
          ...sense,
          on: true,
          detail: '16 quest risk traces · 1 gate risk',
          proof: `${sense.proof} · THO-9: critical risk · blocks-delivery dependency`,
          source: 'paperclip-open-items',
          evidence: [
            ...sense.evidence,
            { label: 'THO-9', status: 'blocked', detail: 'critical risk · blocks-delivery dependency' },
          ],
        }
      : sense),
  },
};

const skillFixture = {
  ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
  skills: {
    source: 'skill-registry',
    total: 2,
    rows: [
      {
        id: 'cambium-founder-review',
        status: 'validated',
        uses: 5,
        successes: 5,
        failures: 0,
        successRate: 1,
        declining: false,
        tier: 'reliable',
        tierLabel: 'RELIABLE',
        sampleSize: 5,
        minimum: 3,
        recentRate: 1,
        recentWindow: 5,
        promotion: {
          status: 'founder-review',
          label: 'FOUNDER REVIEW',
          detail: 'eligible for production review; founder approval required',
          requiredApproval: true,
        },
        updated: 5,
      },
      {
        id: 'cambium-production-approved',
        status: 'production',
        uses: 5,
        successes: 5,
        failures: 0,
        successRate: 1,
        declining: false,
        tier: 'production',
        tierLabel: 'PRODUCTION',
        sampleSize: 5,
        minimum: 3,
        recentRate: 1,
        recentWindow: 5,
        promotion: {
          status: 'approved',
          label: 'PRODUCTION',
          detail: 'founder-approved production skill with healthy telemetry',
          requiredApproval: false,
        },
        updated: 4,
      },
    ],
  },
  policy: {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE.policy,
    blockers: ['need 6 tenant events; found 0'],
    gap: 'need 6 tenant events; found 0',
  },
};

const miraFixture = {
  ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
  npc: {
    source: 'cortex-memory',
    relationships: [
      {
        id: 'mira',
        status: 'inferred',
        detail: '1/1 tenant cortex memories mention Mira or ICP signals',
        proof: 'acme:mira:resonance-1: positioning · mira',
        stage: {
          id: 'sighted',
          label: 'SIGHTED',
          detail: 'tenant cortex has one Mira/ICP evidence event',
          confidence: 1,
        },
        events: [
          {
            id: 'acme:mira:resonance-1',
            kind: 'positioning',
            source: 'tenant-cortex-memory',
            detail: 'mira',
            ts: 3,
          },
        ],
        history: {
          source: 'operator-npc-events@v1',
          total: 1,
          contradictions: 0,
          rows: [
            {
              id: 'acme:mira:advice:1',
              kind: 'advice',
              source: 'operator-note',
              detail: 'review Mira positioning before the next founder handoff',
              evidence: 'operator note references acme:mira:resonance-1',
              createdAt: '2026-06-22T00:00:00.000Z',
              advice: {
                detail: 'review Mira positioning before the next founder handoff',
                action: { kind: 'review', label: 'Review Mira positioning', target: 'npc:mira' },
              },
            },
          ],
        },
        advice: {
          status: 'ready',
          label: 'REVIEW ADVICE',
          detail: 'review Mira positioning before the next founder handoff',
          proof: 'operator note references acme:mira:resonance-1',
          action: { kind: 'review', label: 'Review Mira positioning', target: 'npc:mira' },
        },
        sampleSize: 1,
        scope: 'tenant-cortex-only',
        evidence: ['acme:mira:resonance-1', 'positioning'],
      },
      {
        id: 'founder-npc',
        status: 'missing',
        detail: 'founder memory not served yet',
        proof: 'no inherited founder arcs served',
        stage: {
          id: 'missing',
          label: 'MISSING',
          detail: 'no inherited founder arc memory served',
          confidence: 0,
        },
        events: [],
        history: { source: 'missing', total: 0, contradictions: 0, rows: [] },
        advice: {
          status: 'blocked',
          label: 'NO ADVICE',
          detail: 'no durable NPC advice event served',
          proof: 'no durable NPC events served',
          action: { kind: 'collect-evidence', label: 'Record NPC evidence', target: 'quine write quests npc-event founder-npc' },
        },
        sampleSize: 0,
        scope: 'founder-arcs',
      },
    ],
  },
};

function buildBranchStoriesFixture() {
  const rows = loadBranchStories({ root: process.cwd() }, 'cambium');
  const gaps = rows.flatMap((row) => Array.isArray(row.gaps) ? row.gaps : []);
  const activeRow = rows.find((row) => row.promotion.state === 'supervised-branch' || row.promotion.state === 'organ-service') ?? rows[0];
  return {
    ...FRESH_ECOSYSTEM_VISUAL_FIXTURE,
    source: 'visual-fixture:branch-stories',
    derivedAt: new Date().toISOString(),
    branchStories: {
      source: 'product-branch-packets@v1',
      status: gaps.length > 0 ? 'partial' : 'ready',
      total: rows.length,
      active: rows.filter((row) => row.promotion.state !== 'proof-only').length,
      blocked: gaps.filter((gap) => gap.status === 'blocked').length,
      activeBranchId: activeRow?.branchId,
      rows,
      gaps,
    },
  };
}

const branchStoriesFixture = buildBranchStoriesFixture();

// operatingFabricSourceFixture: FABRIC_SOURCE_FIXTURE with its program recast
// as a company program (the fixture ships programKind:'operations'), so the
// synthetic projection proves a sapling AND a company program together.
const operatingFabricSourceFixture = {
  ...FABRIC_SOURCE_FIXTURE,
  tenantId: 'cambium',
  programs: FABRIC_SOURCE_FIXTURE.programs.map((program) => ({ ...program, programKind: 'company', tenantId: 'cambium' })),
};

const OPERATING_FABRIC_PROJECTION = buildMissionFabricProjection(operatingFabricSourceFixture, {
  clock: { now: () => '2026-07-28T09:05:00.000Z' },
  tenantId: 'cambium',
});

const OPERATING_FABRIC_JOIN_REPORT = buildPortfolioJoinReport(
  PORTFOLIO_CATALOG,
  OPERATING_FABRIC_PROJECTION.nodes.filter((node) => node.kind === 'work'),
);

const OPERATING_FABRIC_DELIVERY_ENVELOPE = {
  projection: OPERATING_FABRIC_PROJECTION,
  portfolioCatalog: PORTFOLIO_CATALOG,
  portfolioCatalogSummary: {
    ...PORTFOLIO_CATALOG.summary,
    schema: PORTFOLIO_CATALOG.schema,
    version: PORTFOLIO_CATALOG.version,
    status: PORTFOLIO_CATALOG.status,
    readOnly: PORTFOLIO_CATALOG.readOnly,
    classificationDigest: PORTFOLIO_CATALOG.classificationDigest,
    catalogDigest: PORTFOLIO_CATALOG.catalogDigest,
  },
  portfolioJoinReport: OPERATING_FABRIC_JOIN_REPORT,
  organUpdateDelivery: ORGAN_UPDATE_PLAN,
  delivery: {
    operatingFabricEnabled: true,
    servedAt: '2026-07-28T09:05:00.000Z',
    freshness: 'fresh',
    portfolioPairDigest: portfolioPairDigest(
      OPERATING_FABRIC_PROJECTION.graphDigest,
      PORTFOLIO_CATALOG.catalogDigest,
    ),
  },
};

// operatingFabricQuestsFixture: the /api/quests/cambium envelope used by the
// operating-fabric captures. Extends the branch-stories fixture with a single
// pending goalGraphIntake row so ofFetchGatePendingItem() (client.ts) finds a
// real, valid, not-yet-expired proposal and the Gate entrypoint renders ready.
const operatingFabricQuestsFixture = {
  ...branchStoriesFixture,
  goalGraphIntake: [
    {
      changeDigest: 'a'.repeat(64),
      status: 'pending',
      approvalNonce: 'of-proof-nonce-20260728',
      approvalExpiresAt: '2099-01-01T00:00:00.000Z',
      expectedHeadVersion: 1,
      fence: 7,
      evidence: 'Cambium Operating Fabric program requests approval to advance the goal graph.',
      consequence: 'advance the goal graph to version 2; no external mutation until confirmed',
      reversibility: 'queued approval can be superseded until consumed',
      title: 'Approve goal graph advance',
    },
  ],
};

function operatingFabricAllScenesAssertion(width) {
  const expectedPortfolio = {
    cardCount: PORTFOLIO_CATALOG.summary.total + PORTFOLIO_CATALOG.summary.historicalProducts,
    saplings: String(PORTFOLIO_CATALOG.summary.saplings),
    clients: String(PORTFOLIO_CATALOG.summary.clientBranches),
    programs: String(PORTFOLIO_CATALOG.summary.internalPrograms),
    review: String(PORTFOLIO_CATALOG.summary.classificationReview),
    historical: String(PORTFOLIO_CATALOG.summary.historicalProducts),
  };
  return `(() => {
    const expectedPortfolio = ${JSON.stringify(expectedPortfolio)};
    const root = document.getElementById('operating-fabric');
    if (!root) return { ok:false, missing:'operating-fabric-root' };
    const portfolio = root.querySelector('[data-component="PortfolioCanopy"][data-portfolio-mode="detail"]');
    const portfolioZones = root.querySelectorAll('[data-portfolio-zone]');
    const portfolioCards = root.querySelectorAll('[data-portfolio-card]');
    const portfolioCounts = {
      saplings: root.querySelector('[data-portfolio-count="saplings"]')?.textContent,
      clients: root.querySelector('[data-portfolio-count="clients"]')?.textContent,
      programs: root.querySelector('[data-portfolio-count="programs"]')?.textContent,
      review: root.querySelector('[data-portfolio-count="review"]')?.textContent,
      historical: root.querySelector('[data-portfolio-count="historical"]')?.textContent,
    };
    const fitcheck = root.querySelector('[data-portfolio-id="sapling:fitcheck"]');
    const organPlan = root.querySelector('[data-component="OrganUpdatePlan"][data-organ-mode="detail"]');
    const organCards = root.querySelectorAll('[data-component="OrganUpdatePlan"] [data-organ]');
    const organOk = Boolean(organPlan)
      && organCards.length === 5
      && organPlan.getAttribute('data-organ-mode') === 'detail'
      && organPlan.querySelector('[data-organ-active-state="none"]')
      && organPlan.textContent.includes('Genesis')
      && organPlan.textContent.includes('Inbox')
      && organPlan.textContent.includes('Taste')
      && organPlan.textContent.includes('Digests')
      && organPlan.textContent.includes('Hands')
      && organPlan.textContent.includes('Dev')
      && organPlan.textContent.includes('Will')
      && organPlan.textContent.includes('Clients')
      && organPlan.textContent.includes('Cortex')
      && organPlan.textContent.includes('Agent Ops')
      && organPlan.textContent.includes('No recurring schedule');
    const portfolioOk = Boolean(portfolio)
      && portfolioZones.length === 4
      && portfolioCards.length === expectedPortfolio.cardCount
      && portfolioCounts.saplings === expectedPortfolio.saplings
      && portfolioCounts.clients === expectedPortfolio.clients
      && portfolioCounts.programs === expectedPortfolio.programs
      && portfolioCounts.review === expectedPortfolio.review
      && portfolioCounts.historical === expectedPortfolio.historical
      && Boolean(fitcheck)
      && fitcheck.textContent.includes('cambium')
      && fitcheck.textContent.includes('aliases are display-only');
    const fitcheckFocus = fitcheck?.querySelector('[data-of-open-portfolio="sapling:fitcheck"]');
    if (fitcheckFocus) fitcheckFocus.click();
    const sceneIds = ['canopy', 'mission', 'flow', 'workforce', 'forge'];
    const results = {};
    for (const sceneId of sceneIds) {
      const tab = root.querySelector('[data-of-tab="' + sceneId + '"]');
      if (!tab) { results[sceneId] = { ok:false, missing:'tab' }; continue; }
      tab.focus();
      tab.click();
      const panel = root.querySelector('[data-of-scene="' + sceneId + '"]');
      const otherPanelsHidden = sceneIds
        .filter((other) => other !== sceneId)
        .every((other) => {
          const otherPanel = root.querySelector('[data-of-scene="' + other + '"]');
          return Boolean(otherPanel) && otherPanel.hidden === true;
        });
      const tabsSelectedCorrectly = sceneIds.every((other) => {
        const otherTab = root.querySelector('[data-of-tab="' + other + '"]');
        return Boolean(otherTab) && otherTab.getAttribute('aria-selected') === (other === sceneId ? 'true' : 'false');
      });
      const tabRect = tab.getBoundingClientRect();
      const tabLabel = tab.querySelector('.of-tab-label');
      const tabLabelRect = tabLabel ? tabLabel.getBoundingClientRect() : null;
      const tabLabelContained = Boolean(tabLabel)
        && tabLabel.scrollWidth <= tabLabel.clientWidth + 1
        && Boolean(tabLabelRect)
        && tabLabelRect.left >= tabRect.left - 1
        && tabLabelRect.right <= tabRect.right + 1;
      const inViewport = (rect) => rect.left >= -1 && rect.right <= window.innerWidth + 1;
      const panelRect = panel ? panel.getBoundingClientRect() : null;
      const rootRect = root.getBoundingClientRect();
      const interactiveTargets = [
        tab,
        ...root.querySelectorAll('[data-of-scene="' + sceneId + '"] .of-inspect-btn'),
        ...root.querySelectorAll('[data-of-scene="' + sceneId + '"] [data-of-gate-entrypoint]'),
      ];
      const targetsAtLeast44 = interactiveTargets.every((node) => {
        const rect = node.getBoundingClientRect();
        return rect.height >= 44 && rect.width >= 44;
      });
      const selectedContext = sceneId === 'canopy'
        ? root.querySelector('[data-portfolio-id="sapling:fitcheck"][aria-current="true"]')
        : root.querySelector('[data-portfolio-context="' + sceneId + '"]');
      const selectionPersists = Boolean(selectedContext)
        && selectedContext.textContent.includes('Fitcheck');
      const fitcheckReference = sceneId === 'canopy'
        ? null
        : selectedContext?.querySelector('[data-operational-packet="cambium.fitcheck-golden-path.v1"]');
      const fitcheckSceneTruth = sceneId === 'canopy' || (
        Boolean(fitcheckReference)
        && fitcheckReference.getAttribute('data-fitcheck-scene') === sceneId
        && fitcheckReference.querySelector('[data-operational-authority="packet-plan"]')
        && fitcheckReference.textContent.includes('Supervised branch · not autonomous')
        && !fitcheckReference.textContent.includes('autonomous branch · active')
        && (sceneId !== 'mission' || fitcheckReference.textContent.includes('Qualified merchant demo · pending'))
        && (sceneId !== 'flow' || (
          fitcheckReference.querySelector('[data-fitcheck-stage="admitted"][data-fitcheck-stage-state="held"]')
          && fitcheckReference.querySelector('[data-fitcheck-stage="executed"][data-fitcheck-stage-state="held"]')
          && fitcheckReference.textContent.includes('signed Gate → D1 CAS')
        ))
        && (sceneId !== 'workforce' || fitcheckReference.textContent.includes('not live assignments'))
        && (sceneId !== 'forge' || fitcheckReference.textContent.includes('never substitutes for a pinned loadout'))
      );
      const organContext = sceneId === 'canopy'
        ? organPlan
        : root.querySelector('[data-organ-context="' + sceneId + '"][data-organ-active="none"]');
      const organContextHonest = Boolean(organContext)
        && (sceneId === 'canopy' || organContext.textContent.includes('authoritative receipt'));
      const noBodyOverflow = document.documentElement.scrollWidth <= window.innerWidth + 1
        && document.body.scrollWidth <= window.innerWidth + 1;
      results[sceneId] = {
        ok: Boolean(panel)
          && panel.hidden === false
          && otherPanelsHidden
          && tabsSelectedCorrectly
          && inViewport(tabRect)
          && Boolean(panelRect) && inViewport(panelRect)
          && inViewport(rootRect)
          && noBodyOverflow
          && tabRect.height >= 44
          && tabLabelContained
          && targetsAtLeast44
          && selectionPersists
          && fitcheckSceneTruth
          && organContextHonest,
        panelContained: Boolean(panelRect) && inViewport(panelRect),
        tabLabelContained,
        interactiveCount: interactiveTargets.length,
        selectionPersists,
        fitcheckSceneTruth: Boolean(fitcheckSceneTruth),
        organContextHonest,
      };
    }
    const canopyTab = root.querySelector('[data-of-tab="canopy"]');
    const canopyPanel = root.querySelector('[data-of-scene="canopy"]');
    if (canopyTab && canopyTab.getAttribute('aria-selected') !== 'true') canopyTab.click();
    root.scrollIntoView({ block: 'start', inline: 'nearest' });
    const restoredCanopy = Boolean(canopyTab)
      && canopyTab.getAttribute('aria-selected') === 'true'
      && Boolean(canopyPanel)
      && canopyPanel.hidden === false;
    return {
      ok: Object.values(results).every((entry) => entry.ok === true)
        && portfolioOk
        && organOk
        && restoredCanopy
        && Math.abs(window.innerWidth - ${width}) <= 1
        && document.body.scrollWidth <= window.innerWidth + 1,
      results,
      portfolio: {
        ok: portfolioOk,
        zoneCount: portfolioZones.length,
        cardCount: portfolioCards.length,
        counts: portfolioCounts,
        fitcheck: Boolean(fitcheck),
      },
      organPlan: {
        ok: organOk,
        cardCount: organCards.length,
      },
      restoredCanopy,
    };
  })()`;
}

function operatingFabricMissionPreparation() {
  return `(() => {
    const root = document.getElementById('operating-fabric');
    if (!root) throw new Error('missing operating-fabric root');
    const tab = root.querySelector('[data-of-tab="mission"]');
    if (!tab) throw new Error('missing operating-fabric mission tab');
    if (tab.getAttribute('aria-selected') !== 'true') tab.click();
    const panel = root.querySelector('[data-of-scene="mission"]');
    if (tab.getAttribute('aria-selected') !== 'true') throw new Error('mission tab did not become selected');
    if (!panel || panel.hidden !== false) throw new Error('mission panel did not become visible');
  })()`;
}

function assertBrowserAvailable() {
  if (BROWSER_CANDIDATES.length === 0) {
    throw new Error(`No Chromium-family browser found. Set CHROME_BIN to run this proof. Checked: ${DEFAULT_BROWSER_CANDIDATES.join(', ')}`);
  }
}

function pngSize(path) {
  const bytes = readFileSync(path);
  const signature = bytes.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error(`${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: statSync(path).size };
}

async function withServer(fn) {
  let activeFixture = NO_FAKE_PROGRESS_VISUAL_FIXTURE;
  let gatePostCount = 0;
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const fixture = url.searchParams.get('fixture');
      activeFixture = fixture === 'gate'
        ? gateFixture
        : fixture === 'skill'
          ? skillFixture
          : fixture === 'mira'
            ? miraFixture
            : fixture === 'branch-stories'
              ? branchStoriesFixture
              : fixture === 'action-requests'
                ? IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE
                : fixture === 'action-request-queued'
                  ? QUEUED_ACTION_REQUEST_VISUAL_FIXTURE
                  : fixture === 'fresh'
                    ? FRESH_ECOSYSTEM_VISUAL_FIXTURE
                    : fixture === 'operating-fabric'
                      ? operatingFabricQuestsFixture
                      : NO_FAKE_PROGRESS_VISUAL_FIXTURE;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(proofPage);
      return;
    }
    if (url.pathname === '/telegram-web-app.js') {
      res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' });
      // initData is served nonempty ONLY for operating-fabric captures
      // (scene=operating-*), read from location.search at script-execution
      // time in the page — every legacy capture keeps seeing empty initData
      // and stays inert.
      res.end(
        'window.Telegram={WebApp:{' +
          'get initData(){' +
            'try{return String(new URLSearchParams(location.search).get("scene")||"").indexOf("operating-")===0?"proof-init-data":"";}' +
            'catch(e){return "";}' +
          '},' +
          'initDataUnsafe:{},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},' +
          'HapticFeedback:{impactOccurred(){},notificationOccurred(){}}' +
        '}};',
      );
      return;
    }
    if (url.pathname === '/v1/mission-fabric/cambium') {
      const initData = req.headers['x-telegram-init-data'];
      if (!initData || typeof initData !== 'string') {
        res.writeHead(401, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ error: 'missing x-telegram-init-data' }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(OPERATING_FABRIC_DELIVERY_ENVELOPE));
      return;
    }
    if (url.pathname === '/api/quests/cambium') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(activeFixture));
      return;
    }
    if (url.pathname === '/api/gate/cambium' && req.method === 'POST') {
      gatePostCount += 1;
      setTimeout(() => {
        if (res.destroyed) return;
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({
          queued: 'viewport-proof-action-request',
          duplicate: false,
          idempotencyKey: 'viewport-proof-redacted',
          consequence: 'viewport proof only; no external mutation',
          reversibility: 'viewport proof only; no external mutation',
        }));
      }, 2_000);
      return;
    }
    res.writeHead(204);
    res.end();
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server did not bind to a TCP port');
    await fn(`http://127.0.0.1:${address.port}`, {
      gatePostCount: () => gatePostCount,
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  if (!address || typeof address === 'string') throw new Error('could not allocate a TCP port');
  return address.port;
}

const debuggerHosts = ['127.0.0.1', 'localhost', '[::1]'];
const browserProbeModes = [
  { id: 'headless-new', args: ['--headless=new'] },
  { id: 'headless-old', args: ['--headless'] },
  ...(INCLUDE_HEADED_BROWSER_PROBE ? [{ id: 'headed', args: [] }] : []),
];

function debuggerSocketDiagnostics(port) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
    encoding: 'utf8',
    timeout: 2_000,
  });
  if (result.error) return `cdp listener check failed: ${result.error.message}`;
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  return output ? `cdp listener check:\n${output}` : `cdp listener check: no process is listening on TCP ${port}`;
}

async function waitForDebugger(port, timeoutMs = 30_000, diagnostics = () => '') {
  const start = Date.now();
  const attempts = new Map(debuggerHosts.map((host) => [host, 'not attempted']));
  while (Date.now() - start < timeoutMs) {
    for (const host of debuggerHosts) {
      const endpoint = `http://${host}:${port}/json/list`;
      try {
        const res = await fetch(endpoint, { signal: AbortSignal.timeout(CDP_OPERATION_TIMEOUT_MS) });
        attempts.set(host, `${endpoint} -> HTTP ${res.status}`);
        if (res.ok) return await res.json();
      } catch (error) {
        attempts.set(host, `${endpoint} -> ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const extra = diagnostics();
  throw new Error([
    'Chrome DevTools endpoint did not become ready',
    'debugger probes:',
    ...[...attempts.values()].map((line) => `- ${line}`),
    debuggerSocketDiagnostics(port),
    extra,
  ].filter(Boolean).join('\n'));
}

async function quickDebuggerProbe(port) {
  const probes = [];
  for (const host of debuggerHosts) {
    const endpoint = `http://${host}:${port}/json/list`;
    try {
      const res = await fetch(endpoint);
      probes.push({ endpoint, status: res.status, ok: res.ok });
    } catch (error) {
      probes.push({ endpoint, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return probes;
}

async function probeBrowserDebugging(browser, mode) {
  const profile = mkdtempSync(join(tmpdir(), 'cambium-tg-cdp-probe-'));
  const port = await freePort();
  let stderr = '';
  const child = spawn(browser, [
    ...mode.args,
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--touch-events=enabled',
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-logging=stderr',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr?.on('data', (chunk) => {
    stderr = (stderr + String(chunk)).slice(-1600);
  });
  await new Promise((resolve) => setTimeout(resolve, Number.isFinite(CDP_PROBE_TIMEOUT_MS) && CDP_PROBE_TIMEOUT_MS > 0 ? CDP_PROBE_TIMEOUT_MS : 3_500));
  const listener = debuggerSocketDiagnostics(port);
  const endpointProbes = await quickDebuggerProbe(port);
  const endpointReady = endpointProbes.some((probe) => probe.ok === true);
  const listenerReady = /cdp listener check:\n/.test(listener);
  const result = {
    browser,
    mode: mode.id,
    state: endpointReady ? 'ready' : 'blocked',
    exitCode: child.exitCode,
    listenerReady,
    listener,
    endpointProbes,
    stderr: stderr.trim(),
  };
  await stopBrowserProcess(child);
  rmSync(profile, { recursive: true, force: true });
  return result;
}

async function writeBrowserDiagnosticsArtifact() {
  mkdirSync(diagnosticsDir, { recursive: true });
  const results = [];
  for (const browser of BROWSER_CANDIDATES) {
    for (const mode of browserProbeModes) {
      try {
        results.push(await probeBrowserDebugging(browser, mode));
      } catch (error) {
        results.push({
          browser,
          mode: mode.id,
          state: 'blocked',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  const ready = results.filter((result) => result.state === 'ready').length;
  const artifact = {
    schema: 'cambium.tg-viewport-browser-diagnostics.v1',
    generatedAt: new Date().toISOString(),
    browserCandidates: BROWSER_CANDIDATES,
    probeModes: browserProbeModes.map((mode) => mode.id),
    probeTimeoutMs: Number.isFinite(CDP_PROBE_TIMEOUT_MS) && CDP_PROBE_TIMEOUT_MS > 0 ? CDP_PROBE_TIMEOUT_MS : 3_500,
    summary: {
      ready,
      blocked: results.length - ready,
      total: results.length,
      cdpReady: ready > 0,
    },
    results,
    invariant: 'Browser diagnostics are not layout proof; viewport proof remains blocked until manifest.json is regenerated by a passing screenshot run.',
  };
  writeFileSync(join(diagnosticsDir, 'browser-diagnostics.json'), JSON.stringify(artifact, null, 2) + '\n');
  return artifact;
}

async function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Timed out opening Chrome DevTools WebSocket after ${CDP_OPERATION_TIMEOUT_MS}ms`));
    }, CDP_OPERATION_TIMEOUT_MS);
    ws.addEventListener('open', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    ws.addEventListener('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    }, { once: true });
  });
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data));
    if (!msg.id) return;
    const handlers = pending.get(msg.id);
    if (!handlers) return;
    pending.delete(msg.id);
    if (msg.error) handlers.reject(new Error(JSON.stringify(msg.error)));
    else handlers.resolve(msg.result);
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out waiting for Chrome DevTools ${method} after ${CDP_OPERATION_TIMEOUT_MS}ms`));
        }, CDP_OPERATION_TIMEOUT_MS);
        pending.set(id, {
          resolve(value) {
            clearTimeout(timeout);
            resolve(value);
          },
          reject(error) {
            clearTimeout(timeout);
            reject(error);
          },
        });
      });
    },
    close() {
      ws.close();
    },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const ex = result.exceptionDetails;
    const description = ex.exception?.description || ex.exception?.value || ex.text || 'unknown exception';
    throw new Error(
      `Chrome evaluation failed at line ${ex.lineNumber ?? '?'}:${ex.columnNumber ?? '?'}: ${description}`,
    );
  }
  return result.result?.value;
}

async function waitForExpression(cdp, expression, timeoutMs = 5_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(cdp, `Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

async function tapSelector(cdp, selector) {
  await evaluate(cdp, `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('missing tap selector ${selector}');
    node.scrollIntoView({ block: 'center', inline: 'nearest' });
    const horizontalScroller = node.closest('[data-horizontal-scroll]');
    if (horizontalScroller) {
      const targetLeft = node.offsetLeft - (horizontalScroller.clientWidth - node.offsetWidth) / 2;
      horizontalScroller.scrollTo({ left:Math.max(0, targetLeft), behavior:'auto' });
    }
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const point = await evaluate(cdp, `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('missing tap selector ${selector}');
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) throw new Error('tap selector has empty rect ${selector}');
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      visible:x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight,
      hitTarget:Boolean(hit && (hit === node || node.contains(hit))),
      rect:{ left:rect.left, top:rect.top, width:rect.width, height:rect.height },
      viewport:{ width:window.innerWidth, height:window.innerHeight },
      hit:hit ? hit.tagName + (hit.id ? '#' + hit.id : '') + (hit.className ? '.' + String(hit.className).replace(/\\s+/g,'.') : '') : 'none',
    };
  })()`);
  if (!point.visible || !point.hitTarget) throw new Error(`tap selector is not hittable ${selector}: ${JSON.stringify(point)}`);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'none' });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

export function touchDragNeedsRetry(result, minimumDelta = 24) {
  const delta = Number(result?.delta);
  return !Number.isFinite(delta) || delta < minimumDelta;
}

async function touchDragSelector(cdp, selector, distance = 96) {
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled:true, maxTouchPoints:5 });
  let result;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await evaluate(cdp, `(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node) throw new Error('missing touch-drag selector ${selector}');
      if (node.dataset.proofTouchProbeBound !== '1') {
        node.dataset.proofTouchProbeBound = '1';
        node.dataset.proofTouchStarts = '0';
        node.dataset.proofTouchMoves = '0';
        node.addEventListener('touchstart', (event) => {
          node.dataset.proofTouchStarts = String(Number(node.dataset.proofTouchStarts || 0) + 1);
          node.dataset.proofTouchStartX = String(event.touches?.[0]?.clientX);
        }, { passive:true });
        node.addEventListener('touchmove', (event) => {
          node.dataset.proofTouchMoves = String(Number(node.dataset.proofTouchMoves || 0) + 1);
          node.dataset.proofTouchMoveX = String(event.touches?.[0]?.clientX);
          node.dataset.proofTouchLength = String(event.touches?.length);
        }, { passive:true });
      }
      node.scrollIntoView({ block:'center', inline:'nearest' });
      node.scrollLeft = 0;
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 150 + attempt * 50));
    const before = await evaluate(cdp, `(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      const rect = node.getBoundingClientRect();
      const startX = Math.min(window.innerWidth - 24, rect.right - 24);
      const endX = Math.max(rect.left + 24, startX - ${Number(distance)});
      return {
        startX,
        endX,
        y:rect.top + rect.height / 2,
        scrollLeft:node.scrollLeft,
        scene:document.querySelector('.root-tab.on')?.id || '',
        sheetOpen:Boolean(document.querySelector('#sheet.on')),
        trackTransform:getComputedStyle(document.querySelector('#track')).transform,
        touchStarts:Number(node.dataset.proofTouchStarts || 0),
        touchMoves:Number(node.dataset.proofTouchMoves || 0),
        touchDragBound:node.dataset.touchDragBound || '',
        touchStartX:node.dataset.proofTouchStartX || '',
        touchMoveX:node.dataset.proofTouchMoveX || '',
        touchLength:node.dataset.proofTouchLength || '',
      };
    })()`);
    const point = (x) => ({ x, y:before.y, radiusX:1, radiusY:1, force:1, id:1 });
    await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[point(before.startX)] });
    for (let step = 1; step <= 8; step += 1) {
      const x = before.startX + (before.endX - before.startX) * step / 8;
      await cdp.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[point(x)] });
      await new Promise((resolve) => setTimeout(resolve, 24));
    }
    await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
    await new Promise((resolve) => setTimeout(resolve, 350));
    const after = await evaluate(cdp, `(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      return {
        scrollLeft:node.scrollLeft,
        scene:document.querySelector('.root-tab.on')?.id || '',
        sheetOpen:Boolean(document.querySelector('#sheet.on')),
        trackTransform:getComputedStyle(document.querySelector('#track')).transform,
        touchStarts:Number(node.dataset.proofTouchStarts || 0),
        touchMoves:Number(node.dataset.proofTouchMoves || 0),
        touchDragBound:node.dataset.touchDragBound || '',
        touchStartX:node.dataset.proofTouchStartX || '',
        touchMoveX:node.dataset.proofTouchMoveX || '',
        touchLength:node.dataset.proofTouchLength || '',
      };
    })()`);
    result = {
      attempt,
      beforeScrollLeft:before.scrollLeft,
      afterScrollLeft:after.scrollLeft,
      delta:Math.abs(after.scrollLeft - before.scrollLeft),
      sceneBefore:before.scene,
      sceneAfter:after.scene,
      sheetBefore:before.sheetOpen,
      sheetAfter:after.sheetOpen,
      trackBefore:before.trackTransform,
      trackAfter:after.trackTransform,
      touchStarts:after.touchStarts - before.touchStarts,
      touchMoves:after.touchMoves - before.touchMoves,
      touchDragBound:after.touchDragBound,
      touchStartX:after.touchStartX,
      touchMoveX:after.touchMoveX,
      touchLength:after.touchLength,
    };
    if (!touchDragNeedsRetry(result)) break;
  }
  await evaluate(cdp, `document.documentElement.dataset.proofTouchDrag = ${JSON.stringify(JSON.stringify(result))}; undefined`);
  return result;
}

async function screenshotParams(cdp, options = {}) {
  const params = {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  };
  if (!options.clipSelector) return params;
  const rect = await evaluate(cdp, `(() => {
    const node = document.querySelector(${JSON.stringify(options.clipSelector)});
    if (!node) throw new Error('missing clip selector ${options.clipSelector}');
    const rect = node.getBoundingClientRect();
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  })()`);
  params.captureBeyondViewport = true;
  params.clip = {
    x: Math.max(0, rect.x),
    y: Math.max(0, rect.y),
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    scale: 1,
  };
  return params;
}

async function stopBrowserProcess(browserProcess) {
  if (browserProcess.exitCode === null && !browserProcess.killed) browserProcess.kill('SIGTERM');
  if (browserProcess.exitCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2_000);
    browserProcess.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function captureWithBrowser(browser, mode, url, file, options = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'cambium-tg-proof-'));
  const port = await freePort();
  const captureViewport = { ...viewport, ...(options.viewport || {}) };
  let chromeStderr = '';
  const chrome = spawn(browser, [
    ...mode.args,
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-logging=stderr',
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    `--window-size=${captureViewport.width},${captureViewport.height}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  chrome.stderr?.on('data', (chunk) => {
    chromeStderr = (chromeStderr + String(chunk)).slice(-4000);
  });
  try {
    const targets = await waitForDebugger(port, Number.isFinite(CDP_TIMEOUT_MS) && CDP_TIMEOUT_MS > 0 ? CDP_TIMEOUT_MS : 30_000, () => [
      `browser: ${browser}`,
      `browser mode: ${mode.id}`,
      chrome.exitCode !== null ? `chrome exit code: ${chrome.exitCode}` : '',
      chromeStderr ? `chrome stderr: ${chromeStderr.trim()}` : '',
    ].filter(Boolean).join('\n'));
    const pageTarget = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
    if (!pageTarget) throw new Error('Chrome did not expose a page target');
    const cdp = await cdpClient(pageTarget.webSocketDebuggerUrl);
    try {
      await cdp.send('Page.enable');
      const exactViewport = options.exactViewport === true;
      const mobileMetrics = {
        width: captureViewport.width,
        height: captureViewport.height,
        deviceScaleFactor: 2,
        mobile: !exactViewport,
        ...(exactViewport ? { screenWidth:captureViewport.width, screenHeight:captureViewport.height } : {}),
      };
      await cdp.send('Emulation.setDeviceMetricsOverride', mobileMetrics);
      if (exactViewport) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled:true, maxTouchPoints:5 });
      await cdp.send('Page.navigate', { url });
      await new Promise((resolve) => setTimeout(resolve, 2500));
      if (exactViewport) {
        await cdp.send('Emulation.setDeviceMetricsOverride', mobileMetrics);
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (options.prepareExpression) {
        await waitForExpression(cdp, options.prepareWaitFor || "document.querySelector('[data-component=\"MissionControlShell\"]')");
        await evaluate(cdp, `${options.prepareExpression}; undefined`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (options.waitFor) {
        await waitForExpression(cdp, options.waitFor);
      }
      if (options.scrollSelector) {
        const sceneIndex = Number.isFinite(options.sceneIndex) ? options.sceneIndex : 0;
        const selector = JSON.stringify(options.scrollSelector);
        const offset = Number.isFinite(options.scrollOffset) ? Number(options.scrollOffset) : 16;
        await evaluate(cdp, `(() => {
          const scene = document.querySelectorAll('.scene')[${sceneIndex}];
          if (!scene) throw new Error('missing scene index ${sceneIndex}');
          const node = scene.querySelector(${selector}) || document.querySelector(${selector});
          if (!node) throw new Error('missing scroll selector ' + ${selector});
          const rect = node.getBoundingClientRect();
          const sceneRect = scene.getBoundingClientRect();
          scene.scrollTo(0, Math.max(0, scene.scrollTop + rect.top - sceneRect.top - ${offset}));
        })()`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else if (Number.isFinite(options.scrollTop)) {
        const sceneIndex = Number.isFinite(options.sceneIndex) ? options.sceneIndex : 0;
        await evaluate(cdp, `document.querySelectorAll('.scene')[${sceneIndex}]?.scrollTo(0, ${options.scrollTop}); undefined`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (options.touchDragTargetSelector) {
        await touchDragSelector(cdp, options.touchDragTargetSelector, options.touchDragDistance);
      }
      if (options.expression) {
        await evaluate(cdp, `${options.expression}; undefined`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (options.tapTargetSelector) {
        await tapSelector(cdp, options.tapTargetSelector);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (options.waitAfterExpression) {
        await waitForExpression(cdp, options.waitAfterExpression);
      }
      if (options.assertExpression) {
        const assertion = await evaluate(cdp, options.assertExpression);
        if (assertion !== true && !(assertion && assertion.ok === true)) {
          throw new Error(`Browser assertion failed: ${JSON.stringify(assertion)}`);
        }
      }
      const shot = await cdp.send('Page.captureScreenshot', await screenshotParams(cdp, options));
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
    } finally {
      cdp.close();
    }
  } finally {
    await stopBrowserProcess(chrome);
    rmSync(profile, { recursive: true, force: true });
  }
}

async function capture(url, file, options = {}) {
  const candidates = activeBrowser ? [activeBrowser, ...BROWSER_CANDIDATES.filter((browser) => browser !== activeBrowser)] : BROWSER_CANDIDATES;
  const modes = activeBrowserMode
    ? [browserProbeModes.find((mode) => mode.id === activeBrowserMode), ...browserProbeModes.filter((mode) => mode.id !== activeBrowserMode)].filter(Boolean)
    : browserProbeModes;
  const failures = [];
  for (const browser of candidates) {
    for (const mode of modes) {
      try {
        await captureWithBrowser(browser, mode, url, file, options);
        activeBrowser = browser;
        activeBrowserMode = mode.id;
        return;
      } catch (error) {
        failures.push({ browser, mode: mode.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  throw new Error([
    'No configured browser exposed a Chrome DevTools Protocol endpoint',
    ...failures.map((failure) => `- ${failure.browser} (${failure.mode}): ${failure.error}`),
  ].join('\n'));
}

function writeFailureArtifact(error) {
  try {
    mkdirSync(diagnosticsDir, { recursive: true });
    writeFileSync(join(diagnosticsDir, 'failure.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      browserCandidates: BROWSER_CANDIDATES,
      browserModes: browserProbeModes.map((mode) => mode.id),
      error: error instanceof Error ? error.message : String(error),
      invariant: 'Viewport proof failure artifacts are diagnostics only; existing screenshots remain stale until manifest.json is regenerated by a passing run.',
    }, null, 2) + '\n');
  } catch {
    // Keep the original proof failure visible.
  }
}

async function main() {
if (DIAGNOSE_BROWSER) {
const diagnostics = await writeBrowserDiagnosticsArtifact();
console.log(JSON.stringify(diagnostics, null, 2));
return;
}
assertBrowserAvailable();
const artifactDir = viewportProofArtifactDirectory({
  proofPathFilter:PROOF_PATH_FILTER,
  mobileContractOnly:MOBILE_CONTRACT_ONLY,
});
mkdirSync(artifactDir, { recursive: true });

const proofs = [];
const captureSteps = selectViewportProofCaptureSteps({
  proofPathFilter:PROOF_PATH_FILTER,
  mobileContractOnly:MOBILE_CONTRACT_ONLY,
});
if (captureSteps.length === 0) throw new Error(`No viewport proof path matched ${PROOF_PATH_FILTER}`);
await withServer(async (base, metrics) => {
  for (const [index, proof] of captureSteps.entries()) {
    console.error(`[${index + 1}/${captureSteps.length}] ${proof.path}`);
    const file = join(artifactDir, proof.path);
    const fixture = proof.fixture ? `&fixture=${proof.fixture}` : '';
    const url = `${base}/?tenant=cambium&scene=${proof.scene}${fixture}`;
    try {
      await capture(url, file, proof);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Capture failed for proof.path="${proof.path}": ${message}`);
    }
    const expectedWorkerPostCount = Number(proof.expectedWorkerPostCount);
    const workerPostCount = metrics.gatePostCount();
    if (Number.isFinite(expectedWorkerPostCount) && workerPostCount !== expectedWorkerPostCount) {
      throw new Error(`${proof.path} expected ${expectedWorkerPostCount} Worker POST request(s), received ${workerPostCount}`);
    }
    proofs.push({
      scene: proof.scene,
      fixture: fixtureForCaptureStep(proof),
      url,
      path: proof.path,
      intent: proof.intent,
      viewportMode: proof.exactViewport ? 'exact-width-touch' : 'mobile-emulation',
      viewport: { ...viewport, ...(proof.viewport || {}) },
      ...(isNonEmptyString(proof.assertExpression) ? { browserAssertions: true } : {}),
      ...(proof.intent === 'clickability-proof' ? { interactionSurface: isNonEmptyString(proof.clipSelector) ? 'sheet' : 'page' } : {}),
      ...(Number.isFinite(expectedWorkerPostCount) ? { expectedWorkerPostCount, workerPostCount } : {}),
      ...(isNonEmptyString(proof.clickTargetSelector) ? { clickTargetSelector: proof.clickTargetSelector } : {}),
      ...(Number.isFinite(Number(normalizedClickTargetCount(proof))) ? { clickTargetCount: Number(normalizedClickTargetCount(proof)) } : {}),
      ...(isNonEmptyString(proof.clipSelector)
        ? {
            clipSelector: proof.clipSelector,
            sheet: { clipSelector: proof.clipSelector },
          }
        : {}),
      ...pngSize(file),
      sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),
    });
  }
});

const manifest = buildViewportProofManifest({
  chrome: activeBrowser,
  browserMode: activeBrowserMode,
  browserCandidates: BROWSER_CANDIDATES,
  viewport,
  proofs,
});

if (WRITE_CANONICAL_PROOF_ARTIFACTS) writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
}

if (process.env.CAMBIUM_RUN_VIEWPORT_PROOF === '1' || isDirectInvocation()) {
  main().catch((error) => {
    writeFailureArtifact(error);
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}
