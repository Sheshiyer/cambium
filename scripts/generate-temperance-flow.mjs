#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTemperanceFlow, renderTemperanceFlowMarkdown } from './temperance-flow.mjs';
import { buildTemperanceFlowSources, normalizeVerifiedManifestResult } from './temperance-flow-sources.mjs';

const scriptRoot = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const FIXED_MANIFEST_VERIFIER = 'temperance-manifest-verify';

function usage(message) {
  throw new TypeError(message ?? 'usage: generate-temperance-flow.mjs (--write|--check|--json) [--root PATH] [--json-output PATH] [--markdown-output PATH] [--receipt-ref REFERENCE]');
}

function parseArguments(argv) {
  const options = {
    mode: null,
    root: scriptRoot,
    jsonOutput: 'docs/architecture/temperance-flow.v1.json',
    markdownOutput: 'docs/architecture/temperance-flow.md',
    receiptReference: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (['--write', '--check', '--json'].includes(argument)) {
      if (options.mode) usage('exactly one mutually exclusive mode --write, --check, or --json is required');
      options.mode = argument.slice(2);
      continue;
    }
    if (['--receipt-file', '--public-key', '--manifest-endpoint', '--verifier', '--trust-root'].includes(argument)) {
      usage(`${argument} is forbidden; Manifest verification uses the fixed host-owned boundary`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) usage(`${argument} requires one argument`);
    if (argument === '--root') options.root = value;
    else if (argument === '--json-output') options.jsonOutput = value;
    else if (argument === '--markdown-output') options.markdownOutput = value;
    else if (argument === '--receipt-ref') options.receiptReference = value;
    else usage(`unknown argument ${argument}`);
    index += 1;
  }
  if (!options.mode) usage();
  if (options.receiptReference && options.mode !== 'json') usage('--receipt-ref is permitted only with read-only --json inspection');
  options.root = realpathSync(path.resolve(options.root));
  return options;
}

function insideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function nearestExisting(pathname) {
  let current = pathname;
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

function containedOutput(root, configuredPath, label) {
  const lexical = path.resolve(root, configuredPath);
  const outputEntry = lstatSync(lexical, { throwIfNoEntry: false });
  if (outputEntry?.isSymbolicLink()) throw new TypeError(`${label} must not be a symlink`);
  const existing = nearestExisting(path.dirname(lexical));
  const actualExisting = realpathSync(existing);
  const resolved = path.resolve(actualExisting, path.relative(existing, lexical));
  if (!insideRoot(root, resolved)) throw new TypeError(`${label} is outside the repository root`);
  return resolved;
}

function repositoryRelative(root, pathname) {
  return path.relative(root, pathname).split(path.sep).join('/');
}

function atomicWrite(root, target, bytes) {
  const parent = path.dirname(target);
  mkdirSync(parent, { recursive: true });
  const actualParent = realpathSync(parent);
  if (!insideRoot(root, actualParent)) throw new TypeError(`${repositoryRelative(root, target)} escapes the repository root`);
  const temporary = path.join(parent, `.${path.basename(target)}.tmp-${process.pid}-${Date.now()}`);
  let descriptor = null;
  try {
    descriptor = openSync(temporary, 'wx', 0o600);
    writeFileSync(descriptor, bytes, 'utf8');
    closeSync(descriptor);
    descriptor = null;
    renameSync(temporary, target);
  } catch (error) {
    if (descriptor !== null) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}

function sourceTuples(flow) {
  const values = [];
  for (const key of ['isa', 'gsd', 'plan']) if (flow?.references?.[key]) values.push(flow.references[key]);
  values.push(...(flow?.references?.supporting ?? []));
  if (flow?.result?.task?.source) values.push(flow.result.task.source);
  values.push(...(flow?.gates ?? []).map(({ source }) => source), ...(flow?.stops ?? []).map(({ source }) => source));
  return new Map(values.map((value) => [`${value.path}#${value.selector}`, value.digest]));
}

function checkFile(root, pathname, expected, flow, json) {
  const relative = repositoryRelative(root, pathname);
  if (!existsSync(pathname)) return [`missing generated output: ${relative}`];
  const actual = readFileSync(pathname, 'utf8');
  if (actual === expected) return [];
  const diagnostics = [`stale generated output: ${relative}`];
  if (json) {
    try {
      const expectedSources = sourceTuples(flow);
      const actualSources = sourceTuples(JSON.parse(actual));
      for (const [identity, digest] of expectedSources) if (actualSources.get(identity) !== digest) diagnostics.push(`source changed: ${identity}`);
    } catch {
      // Stale or malformed JSON is already a complete diagnostic.
    }
  }
  return diagnostics;
}

function verifyAtFixedManifestBoundary(receiptReference) {
  const result = spawnSync(FIXED_MANIFEST_VERIFIER, ['--json', '--reference', receiptReference], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    throw new TypeError(`fixed host Manifest verifier failed for ${receiptReference}`);
  }
  try { return JSON.parse(result.stdout); } catch { throw new TypeError('fixed host Manifest verifier returned invalid JSON'); }
}

function compile(options) {
  let model = buildTemperanceFlowSources(options.root, { receiptReference: options.receiptReference });
  let flow = compileTemperanceFlow({ repositoryRoot: options.root, ...model });
  if (options.receiptReference) {
    const selected = model.tasks.find(({ status }) => status === 'ready');
    if (!selected) throw new TypeError('host receipt cannot resolve attribution without one dependency-ready task');
    const verified = normalizeVerifiedManifestResult(verifyAtFixedManifestBoundary(options.receiptReference), {
      now: new Date().toISOString(),
      receiptRef: options.receiptReference,
      taskId: selected.id,
      projectionDigest: flow.flowDigest,
      command: selected.command,
      route: { skillCluster: selected.route.skillCluster, combo: selected.route.combo, lane: selected.route.lane },
    });
    model = buildTemperanceFlowSources(options.root, { receiptReference: options.receiptReference, receiptVerification: verified });
    flow = compileTemperanceFlow({ repositoryRoot: options.root, ...model });
  }
  return flow;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const jsonOutput = containedOutput(options.root, options.jsonOutput, 'JSON output');
  const markdownOutput = containedOutput(options.root, options.markdownOutput, 'Markdown output');
  const flow = compile(options);
  const json = `${JSON.stringify(flow, null, 2)}\n`;
  const markdown = renderTemperanceFlowMarkdown(flow);
  if (options.mode === 'json') {
    process.stdout.write(json);
    return;
  }
  if (options.mode === 'write') {
    atomicWrite(options.root, jsonOutput, json);
    atomicWrite(options.root, markdownOutput, markdown);
    process.stdout.write(`wrote ${repositoryRelative(options.root, jsonOutput)} and ${repositoryRelative(options.root, markdownOutput)}\n`);
    return;
  }
  const diagnostics = [
    ...checkFile(options.root, jsonOutput, json, flow, true),
    ...checkFile(options.root, markdownOutput, markdown, flow, false),
  ];
  if (diagnostics.length > 0) throw new TypeError(diagnostics.join('\n'));
}

try { main(); } catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
