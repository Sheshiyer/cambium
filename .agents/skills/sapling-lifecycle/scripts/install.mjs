#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COMMANDS = ['review', 'new', 'run', 'graph', 'draft', 'grow', 'learn', 'status'];
const OWNER = 'cambium-sapling-lifecycle-v1';
const PACK = '.agents/skills/sapling-lifecycle';
const hash = (body) => createHash('sha256').update(body).digest('hex');
const sourceDefault = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

function files(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    const name = join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`source symlink refused: ${name}`);
    return entry.isDirectory() ? files(root, name) : [name];
  }).sort();
}

function sourceDigest(sourceRoot) {
  const root = join(sourceRoot, PACK);
  if (!existsSync(join(root, 'SKILL.md'))) throw new Error('source skill is missing');
  return hash(files(root).map((path) => `${path}\0${hash(readFileSync(join(root, path)))}`).join('\n'));
}

function relativeSafe(path) {
  return typeof path === 'string' && path && !isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`) && !path.split(/[\\/]/).includes('..');
}

function ownedPath(path) {
  return /^\.(?:codex\/prompts|claude\/commands|config\/opencode\/command|grok\/commands)\/sapling-(?:review|new|run|graph|draft|grow|learn|status)\.md$/.test(path) || path === '.codex/skills/sapling-lifecycle/SKILL.md' || /^\.grok\/workflows\/(?:sapling-product-loop|brand-case-loop|cambium-social-thread|search-stack-run)\.rhai$/.test(path);
}

function noSymlinks(path, home) {
  let current = resolve(path);
  const bound = resolve(home);
  while (true) {
    if (existsSync(current) || (() => { try { lstatSync(current); return true; } catch { return false; } })()) {
      if (lstatSync(current).isSymbolicLink()) throw new Error(`symlink destination refused: ${relative(bound, current)}`);
    }
    if (current === bound) break;
    const parent = dirname(current);
    if (parent === current) throw new Error('destination escaped home');
    current = parent;
  }
}

function readManifest(path) {
  if (!existsSync(path)) return null;
  if (lstatSync(path).isSymbolicLink()) throw new Error('manifest symlink refused');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  if (manifest.owner !== OWNER || !Array.isArray(manifest.artifacts)) throw new Error('invalid ownership manifest');
  for (const row of manifest.artifacts) if (!relativeSafe(row.path) || !ownedPath(row.path) || !/^[a-f0-9]{64}$/.test(row.digest)) throw new Error('invalid owned artifact');
  return manifest;
}

function atomicWrite(path, body) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.sapling-${process.pid}.tmp`;
  writeFileSync(tmp, body, { flag: 'wx', mode: 0o600 });
  renameSync(tmp, path);
}

function wrappers(sourceRoot, digest, options) {
  const entry = join(sourceRoot, PACK, 'SKILL.md');
  const roots = { sourceRoot, ...(options.vaultRoot ? { vaultRoot: resolve(options.vaultRoot) } : {}), ...(options.clustersRoot ? { clustersRoot: resolve(options.clustersRoot) } : {}) };
  const rows = [];
  for (const [client, directory] of [['codex', '.codex/prompts'], ['claude', '.claude/commands'], ['opencode', '.config/opencode/command'], ['grok', '.grok/commands']]) {
    for (const command of COMMANDS) {
      const body = `---\ndescription: "Sapling lifecycle: ${command}"\nargument-hint: "<product> [step or channel]"\n---\n\n<!-- managed-by: ${OWNER}; source-sha256: ${digest} -->\n# /sapling-${command}\n\nRead and follow the canonical skill at ${JSON.stringify(entry)}.\nLocal root bindings (read locations, not authority): ${JSON.stringify(roots)}.\nInvoke its **${command}** operation with these user arguments, preserving them as data:\n\n\`$ARGUMENTS\`\n\nClient: ${client}. No shell interpolation of arguments. A named command does not grant publication, scheduling, spend, admission, or deployment authority.\nRefresh evidence first; a generic run requests a step selection. Never silently repeat a completed external action.\n`;
      rows.push({ path: `${directory}/sapling-${command}.md`, body });
    }
  }
  rows.push({ path: '.codex/skills/sapling-lifecycle/SKILL.md', body: `---\nname: sapling-lifecycle\ndescription: Review, prepare, and resume new or existing product lifecycles using Cambium's shared workflows and evidence gates.\n---\n\n<!-- managed-by: ${OWNER}; source-sha256: ${digest} -->\n# Sapling Lifecycle\n\nRead and follow ${JSON.stringify(entry)}. The canonical source stays in Cambium.\nLocal root bindings (read locations, not authority): ${JSON.stringify(roots)}.\nPass the requested operation and product to that skill. Review evidence before one selected authorized step.\n` });
  return rows;
}

export function planInstall(options = {}) {
  const home = resolve(options.home || homedir());
  const sourceRoot = resolve(options.sourceRoot || sourceDefault);
  const currentDigest = sourceDigest(sourceRoot);
  const rows = wrappers(sourceRoot, currentDigest, options);
  if (options.withWorkflows) {
    if (!options.vaultRoot) throw new Error('--with-workflows requires --vault-root');
    const names = options.workflows?.length ? options.workflows : ['sapling-product-loop', 'brand-case-loop', 'cambium-social-thread', 'search-stack-run'];
    for (const name of names) {
      if (!['sapling-product-loop', 'brand-case-loop', 'cambium-social-thread', 'search-stack-run'].includes(name)) throw new Error('unknown workflow name');
      const source = join(resolve(options.vaultRoot), '.grok/workflows', `${name}.rhai`);
      if (!existsSync(source) || lstatSync(source).isSymbolicLink()) throw new Error(`missing regular workflow source: ${name}`);
      const body = readFileSync(source, 'utf8');
      rows.push({ path: `.grok/workflows/${name}.rhai`, body: `// managed-by: ${OWNER}; source: vault:.grok/workflows/${name}.rhai; sha256: ${hash(body)}\n${body}` });
    }
  }
  const manifestPath = join(home, '.local/state/cambium-sapling-lifecycle/install.json');
  noSymlinks(manifestPath, home);
  const previous = readManifest(manifestPath);
  const previousRows = new Map((previous?.artifacts || []).map((row) => [row.path, row]));
  const conflicts = [];
  const artifacts = rows.map((row) => {
    const path = join(home, row.path);
    try { noSymlinks(path, home); } catch (error) { conflicts.push(error.message); return { ...row, digest: hash(row.body), state: 'conflict' }; }
    let state = 'missing';
    if (existsSync(path)) {
      if (!lstatSync(path).isFile()) { conflicts.push(`not a regular file: ${row.path}`); state = 'conflict'; }
      else {
        const actual = hash(readFileSync(path));
        const prior = previousRows.get(row.path);
        if (!prior) { conflicts.push(`unowned destination preserved: ${row.path}`); state = 'conflict'; }
        else if (actual !== prior.digest) { conflicts.push(`modified destination preserved: ${row.path}`); state = 'conflict'; }
        else state = actual === hash(row.body) ? 'unchanged' : 'update';
      }
    }
    return { ...row, digest: hash(row.body), state };
  });
  // Include still-owned optional artifacts in manifests until explicitly uninstalled.
  const desired = new Set(artifacts.map((row) => row.path));
  const retained = (previous?.artifacts || []).filter((row) => !desired.has(row.path));
  const retainedDrift = [];
  for (const row of retained) {
    const path = join(home, row.path);
    try {
      noSymlinks(path, home);
      if (!existsSync(path)) retainedDrift.push({ path: row.path, state: 'missing' });
      else if (!lstatSync(path).isFile() || hash(readFileSync(path)) !== row.digest) { conflicts.push(`modified retained destination preserved: ${row.path}`); retainedDrift.push({ path: row.path, state: 'conflict' }); }
    } catch (error) { conflicts.push(error.message); retainedDrift.push({ path: row.path, state: 'conflict' }); }
  }
  return { home, sourceRoot, sourceDigest: currentDigest, manifestPath, previous, artifacts, retained, retainedDrift, conflicts };
}

export function install(options = {}) {
  const mode = options.mode || 'dry-run';
  if (!['dry-run', 'install', 'check', 'uninstall'].includes(mode)) throw new Error('unknown installer mode');
  if (mode === 'uninstall') return uninstall(options);
  const plan = planInstall(options);
  const drift = [...plan.artifacts.filter((row) => row.state !== 'unchanged').map(({ path, state }) => ({ path, state })), ...plan.retainedDrift];
  if (plan.previous && plan.previous.source_digest !== plan.sourceDigest) drift.push({ path: 'canonical source', state: 'source-drift' });
  const result = { mode, ok: plan.conflicts.length === 0 && (mode !== 'check' || drift.length === 0), source_digest: plan.sourceDigest, artifacts: plan.artifacts.map(({ path, state, digest }) => ({ path, state, digest })), conflicts: plan.conflicts, drift };
  if (mode !== 'install' || !result.ok) return result;
  for (const row of plan.artifacts) if (row.state !== 'unchanged') atomicWrite(join(plan.home, row.path), row.body);
  const manifest = { owner: OWNER, version: 1, source_root: plan.sourceRoot, source_digest: plan.sourceDigest, artifacts: [...plan.artifacts.map(({ path, digest }) => ({ path, digest })), ...plan.retained] };
  atomicWrite(plan.manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return { ...result, installed: plan.artifacts.length };
}

export function uninstall(options = {}) {
  const home = resolve(options.home || homedir());
  const manifestPath = join(home, '.local/state/cambium-sapling-lifecycle/install.json');
  noSymlinks(manifestPath, home);
  const manifest = readManifest(manifestPath);
  if (!manifest) return { mode: 'uninstall', ok: true, removed: [], preserved: [] };
  const removed = [];
  const preserved = [];
  for (const row of manifest.artifacts) {
    const path = join(home, row.path);
    try {
      noSymlinks(path, home);
      if (!existsSync(path)) continue;
      if (!lstatSync(path).isFile() || hash(readFileSync(path)) !== row.digest) { preserved.push(row); continue; }
      unlinkSync(path);
      removed.push(row.path);
    } catch { preserved.push(row); }
  }
  if (preserved.length) atomicWrite(manifestPath, JSON.stringify({ ...manifest, artifacts: preserved }, null, 2) + '\n');
  else unlinkSync(manifestPath);
  return { mode: 'uninstall', ok: preserved.length === 0, removed, preserved: preserved.map((row) => row.path) };
}

export function parseArgs(argv) {
  const options = { mode: 'dry-run' };
  const flags = { '--home': 'home', '--source-root': 'sourceRoot', '--vault-root': 'vaultRoot', '--clusters-root': 'clustersRoot' };
  if (argv[0] && !argv[0].startsWith('--')) options.mode = argv.shift();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--with-workflows') options.withWorkflows = true;
    else if (argv[i] === '--workflow') { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('--workflow requires a name'); options.workflows ||= []; options.workflows.push(argv[++i]); options.withWorkflows = true; }
    else if (flags[argv[i]]) { const key = flags[argv[i]]; if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${argv[i]} requires a value`); options[key] = argv[++i]; }
    else if (argv[i] === '--help') options.help = true;
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log('node install.mjs [dry-run|install|check|uninstall] [--home PATH] [--source-root PATH] [--vault-root PATH --with-workflows | --workflow NAME] [--clusters-root PATH]');
    else { const result = install(options); console.log(JSON.stringify(result, null, 2)); if (!result.ok) process.exitCode = 1; }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
