#!/usr/bin/env node
/**
 * Local checker for the cambium.taste-hands.v0.1 experiment.
 * It does not render a viewport, write a gate, or enable a publish path.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA = 'cambium.taste-hands.v0.1';
const HELD_PROOF = { status: 'candidate-held', viewport: 'held', screenshot_touch: 'held' };
const KINDS = new Set(['repo', 'supplied', 'inferred']);
const PATH_OK = /^[A-Za-z0-9_./-]+$/;

export function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) throw new Error('frontmatter must open with ---');
  const end = markdown.indexOf('\n---\n', 4);
  if (end < 0) throw new Error('frontmatter must close with ---');
  return { data: parseYaml(markdown.slice(4, end)), body: markdown.slice(end + 5) };
}

export function parseYaml(src) {
  const lines = [];
  for (const raw of src.split('\n')) {
    if (raw.includes('\t')) throw new Error('tabs are not allowed in experiment YAML');
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    const indent = raw.match(/^ */)[0].length;
    if (indent % 2) throw new Error(`odd indent: ${raw}`);
    lines.push({ indent, text: raw.trim() });
  }
  let i = 0;
  function parseBlock(indent) {
    if (i >= lines.length || lines[i].indent < indent) return {};
    if (lines[i].indent === indent && lines[i].text.startsWith('- ')) return parseList(indent);
    return parseMap(indent);
  }
  function parseList(indent) {
    const list = [];
    while (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith('- ')) {
      const text = lines[i].text.slice(2).trim();
      i++;
      if (!text) {
        list.push(parseBlock(indent + 2));
        continue;
      }
      const keyed = splitKey(text);
      if (!keyed) {
        list.push(parseScalar(text));
        continue;
      }
      const item = {};
      if (keyed.rest) item[keyed.key] = parseScalar(keyed.rest);
      else item[keyed.key] = parseBlock(indent + 4);
      if (i < lines.length && lines[i].indent === indent + 2 && !lines[i].text.startsWith('- ')) {
        Object.assign(item, parseMap(indent + 2));
      }
      list.push(item);
    }
    return list;
  }
  function parseMap(indent) {
    const obj = {};
    while (i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith('- ')) {
      const keyed = splitKey(lines[i].text);
      if (!keyed) throw new Error(`expected key: ${lines[i].text}`);
      i++;
      obj[keyed.key] = keyed.rest ? parseScalar(keyed.rest) : parseBlock(indent + 2);
    }
    return obj;
  }
  return parseBlock(0);
}

function splitKey(text) {
  const colon = text.indexOf(':');
  if (colon < 0) return null;
  return { key: text.slice(0, colon).trim(), rest: text.slice(colon + 1).trim() };
}

function parseScalar(raw) {
  if (raw === '[]') return [];
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (/^-?\d+\.\d+$/.test(raw)) return Number(raw);
  if (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2) return raw.slice(1, -1);
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) return raw.slice(1, -1).replace(/\\"/g, '"');
  return raw;
}

export function contrastRatio(a, b) {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function extractVisualTokens(source) {
  const colorsBlock = source.match(/const brandColors = \{([\s\S]*?)\} as const;/);
  if (!colorsBlock) throw new Error('brandColors block missing');
  const colors = {};
  for (const match of colorsBlock[1].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) colors[match[1]] = match[2].toUpperCase();
  const alphaBlock = source.match(/alpha:\s*\{([\s\S]*?)\},/);
  const alpha = {};
  for (const match of alphaBlock[1].matchAll(/(\w+):\s*([0-9.]+)/g)) alpha[match[1]] = Number(match[2]);
  const display = source.match(/display:\s*'([^']+)'/)[1];
  const body = source.match(/body:\s*'([^']+)'/)[1];
  const mono = source.match(/mono:\s*'([^']+)'/)[1];
  const motion = {
    orbitSeconds: Number(source.match(/orbitSeconds:\s*(\d+)/)[1]),
    packetSeconds: Number(source.match(/packetSeconds:\s*(\d+)/)[1]),
    reducedMotionQuery: source.match(/reducedMotionQuery:\s*'([^']+)'/)[1],
    allowedProperties: [...source.match(/allowedProperties:\s*\[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map((item) => item[1]),
  };
  const glyphs = {};
  for (const match of source.matchAll(/(\w+):\s*\{\s*glyph:\s*'([^']+)',\s*coolshapeIntent:\s*'([^']+)'\s*\}/g)) {
    glyphs[match[1]] = { glyph: match[2], coolshapeIntent: match[3] };
  }
  const materialsBlock = source.match(/materials:\s*\{([\s\S]*?)\n  \},/);
  const materials = {};
  for (const match of materialsBlock[1].matchAll(/(\w+):\s*\{([^}]*)\}/g)) {
    const fields = {};
    for (const field of match[2].matchAll(/(\w+):\s*(brandColors\.(\w+)|[0-9.]+)/g)) {
      fields[field[1]] = field[3] || Number(field[2]);
    }
    materials[match[1]] = fields;
  }
  return { colors, alpha, type: { display, body, mono }, motion, glyphs, materials };
}

function leaves(node, path, out) {
  if (node === null || typeof node !== 'object') {
    out.push(path);
    return;
  }
  if (Array.isArray(node)) {
    if (node.length === 0 || typeof node[0] !== 'object') out.push(path);
    else node.forEach((item, index) => leaves(item, `${path}[${index}]`, out));
    return;
  }
  const keys = Object.keys(node);
  if (!keys.length) out.push(path);
  for (const key of keys) leaves(node[key], path ? `${path}.${key}` : key, out);
}

function covered(path, fields) {
  return fields.some((field) => path === field || path.startsWith(`${field}.`) || path.startsWith(`${field}[`));
}

function walkKeys(node, visit) {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    visit(key, value);
    walkKeys(value, visit);
  }
}

function requiredRatio(role) {
  if (role.kind === 'effect') return null;
  if (role.kind === 'non-text') return 3;
  const large = role.size_px >= 24 || (role.weight >= 700 && role.size_px >= 19);
  return large ? 3 : 4.5;
}

function hexOf(tokens, path) {
  if (path === 'none') return null;
  const [group, name] = path.split('.');
  const value = tokens[group]?.[name];
  if (typeof value !== 'string' || !value.startsWith('#')) throw new Error(`not a color token: ${path}`);
  return value.toUpperCase();
}

export function scoreSurface({ roles, tokens, palette }) {
  let colorDrift = 0;
  let effectDrift = 0;
  let contrastFailures = 0;
  let typeGaps = 0;
  const rows = [];
  for (const role of roles) {
    const ratioNeeded = requiredRatio(role);
    const hex = role.hex ? role.hex.toUpperCase() : role.color ? hexOf(tokens, role.color) : null;
    const against = role.against ? hexOf(tokens, role.against) : role.against_hex?.toUpperCase() ?? null;
    const offPalette = Boolean(hex) && !palette.has(hex);
    if (offPalette && role.kind === 'effect') effectDrift += 1;
    else if (offPalette) colorDrift += 1;
    let ratio = null;
    let pass = true;
    if (ratioNeeded && hex && against) {
      ratio = contrastRatio(hex, against);
      pass = ratio + 1e-9 >= ratioNeeded;
      if (!pass) contrastFailures += 1;
    }
    if (role.type_matches_authority === false || role.type_fallback === true) typeGaps += 1;
    rows.push({
      role: role.role,
      kind: role.kind,
      hex,
      against,
      ratio: ratio === null ? null : Number(ratio.toFixed(2)),
      ratio_needed: ratioNeeded,
      pass,
      off_palette: offPalette,
      type_gap: role.type_matches_authority === false || role.type_fallback === true,
    });
  }
  const drift = colorDrift + effectDrift;
  let adherence = 2;
  if (contrastFailures >= 2) adherence = 1;
  else if (contrastFailures === 1) adherence = 2;
  else if (drift === 0 && typeGaps === 0) adherence = 5;
  else if (drift === 0) adherence = 4;
  else if (drift <= 2) adherence = 3;
  return { color_drift: colorDrift, effect_drift: effectDrift, token_drift: drift, contrast_failures: contrastFailures, type_gaps: typeGaps, adherence, rows };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function push(errors, message) {
  errors.push(message);
}

export function reviewPackets({ contract, example, exampleBody, baseline, visualTokens, css, markup, git }) {
  const errors = [];
  const palette = new Set(Object.values(contract.tokens.color).map((hex) => hex.toUpperCase()));
  if (contract.version !== SCHEMA || example.version !== SCHEMA) push(errors, 'version must be cambium.taste-hands.v0.1');
  if (!/^[0-9a-f]{40}$/.test(contract.source_sha) || example.source_sha !== contract.source_sha) push(errors, 'source_sha must be one 40-character commit');
  if (git.type(contract.source_sha) !== 'commit') push(errors, 'source_sha does not resolve to a commit');
  if (!/^[0-9a-f]{40}$/.test(contract.research_sha)) push(errors, 'research_sha missing');
  else if (!git.ancestor(contract.research_sha, contract.source_sha)) push(errors, 'research_sha is not an ancestor of source_sha');
  if (contract.palette_authority !== 'apps/cambium-r3f/src/scene/visual-tokens.ts') push(errors, 'palette authority must be visual-tokens.ts');

  const extracted = extractVisualTokens(visualTokens);
  for (const group of ['colors', 'alpha', 'motion', 'glyphs', 'materials']) {
    const packetGroup = group === 'colors' ? contract.tokens.color : contract.tokens[group === 'colors' ? 'color' : group];
    if (!same(packetGroup, extracted[group === 'colors' ? 'colors' : group])) push(errors, `tokens.${group === 'colors' ? 'color' : group} drifted from visual-tokens.ts`);
  }
  if (!same(contract.tokens.type, extracted.type)) push(errors, 'tokens.type drifted from visual-tokens.ts');
  if (!same(example.tokens, contract.tokens)) push(errors, 'example tokens must equal the contract tokens');
  for (const key of ['layout', 'components', 'voice', 'do', 'dont', 'gates', 'reference_board', 'owners']) {
    if (!same(example[key], contract[key])) push(errors, `example ${key} must equal the contract`);
  }
  if (!Array.isArray(contract.surface_bindings) || contract.surface_bindings.length !== 0) push(errors, 'contract surface_bindings stay empty; Hands fills the example');
  if (contract.render_proof.status !== HELD_PROOF.status || contract.render_proof.viewport !== 'held' || contract.render_proof.screenshot_touch !== 'held') {
    push(errors, 'contract render_proof must stay candidate-held');
  }

  const expectedGates = {
    claim_review: 'exact',
    phase: 'verify',
    viewport_hold: 'explicit',
    screenshot_touch_hold: 'explicit',
    marketing_create_send_spend_publish: 'disabled',
  };
  if (!same(contract.gates, expectedGates)) push(errors, 'gates changed');

  for (const packet of [contract, example]) {
    walkKeys(packet, (key, value) => {
      if (/publish|send|spend/i.test(key) && !(key === 'marketing_create_send_spend_publish' && value === 'disabled')) {
        push(errors, `forbidden key ${key}`);
      }
    });
    if (!Array.isArray(packet.provenance) || packet.provenance.length === 0) push(errors, 'provenance missing');
    for (const entry of packet.provenance ?? []) {
      if (!entry.field || !entry.source || !KINDS.has(entry.kind)) push(errors, `bad provenance for ${entry.field}`);
    }
    const fields = (packet.provenance ?? []).map((entry) => entry.field);
    const paths = [];
    for (const key of ['tokens', 'layout', 'components', 'voice', 'do', 'dont', 'reference_board', 'gates']) leaves(packet[key], key, paths);
    for (const path of paths) if (!covered(path, fields)) push(errors, `provenance missing for ${path}`);
    for (const ref of packet.reference_board ?? []) {
      if (!PATH_OK.test(ref.ref) || ref.ref.includes('..')) push(errors, `reference path rejected: ${ref.ref}`);
      else if (ref.resolved === true && !git.exists(packet.source_sha, ref.ref)) push(errors, `reference missing at source_sha: ${ref.ref}`);
      else if (ref.resolved !== true && !ref.reason) push(errors, `unresolved reference needs a reason: ${ref.ref}`);
      if (typeof ref.inspected !== 'boolean') push(errors, `reference inspection flag missing: ${ref.ref}`);
    }
    if (packet.render_proof?.viewport !== 'held' || packet.render_proof?.screenshot_touch !== 'held' || packet.render_proof?.status !== 'candidate-held') {
      push(errors, 'render_proof claims held proof was released');
    }
    if (/\b(passed|proved|approved)\b/i.test(packet.render_proof?.method ?? '')) push(errors, 'render_proof method claims a pass');
  }

  const contractFields = new Set(contract.provenance.map((entry) => JSON.stringify(entry)));
  for (const entry of contract.provenance) {
    if (!example.provenance.some((item) => same(item, entry))) push(errors, `example dropped provenance ${entry.field}`);
  }
  for (const entry of example.provenance) {
    if (!contractFields.has(JSON.stringify(entry)) && !['surface_bindings', 'render_proof'].includes(entry.field)) {
      push(errors, `example provenance gained ${entry.field}`);
    }
  }

  if (!example.provenance.some((entry) => entry.field === 'surface_bindings')) push(errors, 'example provenance missing surface_bindings');
  if (!example.provenance.some((entry) => entry.field === 'render_proof')) push(errors, 'example provenance missing render_proof');
  if (typeof example.experiment?.revision_rounds !== 'number') push(errors, 'revision_rounds missing');
  const claims = [...exampleBody.matchAll(/\| ([a-z]+) on ([a-z]+) \| (\d+\.\d{2}) \| (text|fail) \|/g)];
  if (claims.length < 10) push(errors, 'WCAG table missing from the example body');
  const wcag = [];
  for (const claim of claims) {
    const left = contract.tokens.color[claim[1]];
    const right = contract.tokens.color[claim[2]];
    const ratio = contrastRatio(left, right);
    const printed = ratio.toFixed(2);
    const limit = claim[4];
    const ok = printed === claim[3] && (limit === 'text' ? ratio >= 4.5 : ratio < 3);
    if (!ok) push(errors, `WCAG row ${claim[1]} on ${claim[2]} does not match ${printed}`);
    wcag.push({ pair: `${claim[1]} on ${claim[2]}`, ratio: printed, limit, ok });
  }

  if (baseline.surface_id !== 'curious-world.location-readout') push(errors, 'unexpected surface');
  if (baseline.production_edited !== false || example.surface_bindings?.[0]?.production_edited !== false) push(errors, 'surface binding edited production');
  for (const role of baseline.roles) {
    for (const anchor of role.anchors) if (!css.includes(anchor)) push(errors, `baseline anchor missing for ${role.role}: ${anchor}`);
  }
  for (const anchor of baseline.markup_anchors) if (!markup.includes(anchor)) push(errors, `markup anchor missing: ${anchor}`);
  for (const file of [
    'apps/cambium-r3f/src/curious-world/styles.css',
    'apps/cambium-r3f/src/curious-world/index.ts',
    'apps/cambium-r3f/src/curious-world/gate-decision-chamber.ts',
  ]) {
    if (!git.diffEmpty(contract.source_sha, file)) push(errors, `production file differs from source_sha: ${file}`);
  }
  const allowedChange = (path) => path.startsWith('docs/architecture/contracts/taste-hands-v0.1/')
    || path === 'apps/cambium-r3f/src/scene/visual-tokens.ts'
    || path === 'apps/cambium-r3f/src/scene/visual-tokens.test.ts'
    || path === '.project/HANDOFF.md';
  for (const line of git.status()) {
    const path = line.slice(3);
    if (path && !allowedChange(path)) push(errors, `change outside the adoption review: ${path}`);
    if (path.includes('gate-decision') || path.endsWith('curious-world/styles.css')) push(errors, `production surface edited in the adoption review: ${path}`);
  }

  const binding = example.surface_bindings[0];
  if (binding?.surface_id !== baseline.surface_id) push(errors, 'A/B surfaces differ');
  const background = hexOf(contract.tokens, binding.background);
  if (background !== baseline.background.hex.toUpperCase()) push(errors, 'A/B background hex differs');
  const boundRoles = binding.roles.map((role) => ({ ...role, against_hex: background }));
  const baselineRoles = baseline.roles.map((role) => ({ ...role, against_hex: baseline.background.hex }));
  const runA = scoreSurface({ roles: baselineRoles, tokens: contract.tokens, palette });
  const runB = scoreSurface({ roles: boundRoles, tokens: contract.tokens, palette });
  if (!(runB.token_drift < runA.token_drift)) push(errors, 'contract binding did not reduce token drift');

  const uninspected = example.reference_board.filter((ref) => ref.inspected === false).map((ref) => ref.ref);
  const report = {
    schema: 'cambium.taste-hands.experiment-report.v0.1',
    ok: errors.length === 0,
    errors,
    source_sha: contract.source_sha,
    research_sha: contract.research_sha,
    surface_id: baseline.surface_id,
    production_edited: false,
    gates: contract.gates,
    wcag,
    references: {
      count: example.reference_board.length,
      resolved: example.reference_board.filter((ref) => ref.resolved === true).length,
      uninspected,
    },
    revision_rounds: example.experiment.revision_rounds,
    blind_owner_score: null,
    runs: {
      A: { label: 'production location readout, no contract binding', ...runA },
      B: { label: 'same roles bound through surface_bindings', ...runB },
    },
    stop_rules: {
      gate_touch: false,
      publish_path: false,
      viewport_claim: false,
      pass: errors.length === 0,
    },
  };
  return report;
}

function realGit(root) {
  function git(args) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    return result;
  }
  return {
    type(sha) {
      const result = git(['cat-file', '-t', sha]);
      return result.status === 0 ? result.stdout.trim() : '';
    },
    exists(sha, path) {
      return git(['cat-file', '-e', `${sha}:${path}`]).status === 0;
    },
    ancestor(older, newer) {
      return git(['merge-base', '--is-ancestor', older, newer]).status === 0;
    },
    diffEmpty(sha, path) {
      return git(['diff', '--exit-code', sha, '--', path]).status === 0;
    },
    status() {
      const result = git(['status', '--porcelain']);
      return result.stdout.split('\n').filter(Boolean);
    },
  };
}

export function experimentInputs(root) {
  const dir = join(root, 'docs/architecture/contracts/taste-hands-v0.1');
  const exampleMd = readFileSync(join(dir, 'DESIGN.md'), 'utf8');
  const example = parseFrontmatter(exampleMd);
  return {
    contract: parseFrontmatter(readFileSync(join(dir, 'cambium.taste-hands.v0.1.md'), 'utf8')).data,
    example: example.data,
    exampleBody: example.body,
    baseline: JSON.parse(readFileSync(join(dir, 'location-readout.baseline.json'), 'utf8')),
    visualTokens: readFileSync(join(root, 'apps/cambium-r3f/src/scene/visual-tokens.ts'), 'utf8'),
    css: readFileSync(join(root, 'apps/cambium-r3f/src/curious-world/styles.css'), 'utf8'),
    markup: readFileSync(join(root, 'apps/cambium-r3f/src/curious-world/index.ts'), 'utf8'),
    git: realGit(root),
  };
}

export function loadReport(root) {
  return reviewPackets(experimentInputs(root));
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  const report = loadReport(root);
  const destination = join(root, 'docs/architecture/contracts/taste-hands-v0.1/ab-report.json');
  writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, errors: report.errors, token_drift: { A: report.runs.A.token_drift, B: report.runs.B.token_drift }, adherence: { A: report.runs.A.adherence, B: report.runs.B.adherence } }, null, 2));
  if (!report.ok) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
