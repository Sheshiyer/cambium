#!/usr/bin/env node
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileIntentGraph, renderIntentGraphMarkdown } from './intent-graph.mjs';
import { buildIntentGraphSources } from './intent-graph-sources.mjs';

const scriptRoot = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

function usage(message) {
  if (message) throw new TypeError(message);
  throw new TypeError('usage: generate-intent-graph.mjs (--write|--check|--json) [--root PATH] [--json-output PATH] [--markdown-output PATH]');
}

function parseArguments(argv) {
  const options = {
    mode: null,
    root: scriptRoot,
    jsonOutput: 'docs/architecture/intent-graph.v1.json',
    markdownOutput: 'docs/architecture/intent-graph.md',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (['--write', '--check', '--json'].includes(argument)) {
      if (options.mode) usage('exactly one of --write, --check, or --json is required');
      options.mode = argument.slice(2);
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) usage(`${argument} requires one path argument`);
    if (argument === '--root') options.root = value;
    else if (argument === '--json-output') options.jsonOutput = value;
    else if (argument === '--markdown-output') options.markdownOutput = value;
    else usage(`unknown argument ${argument}`);
    index += 1;
  }
  if (!options.mode) usage();
  options.root = realpathSync(path.resolve(options.root));
  return options;
}

function insideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
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

function sourceTuples(graph) {
  const tuples = [];
  for (const node of graph?.nodes ?? []) {
    if (node?.source) tuples.push(node.source);
    for (const anchor of node?.anchorReferences ?? []) tuples.push({ ...anchor, selector: 'whole-file' });
  }
  for (const edge of graph?.edges ?? []) if (edge?.source) tuples.push(edge.source);
  const byIdentity = new Map();
  for (const tuple of tuples) {
    if (typeof tuple.path === 'string' && typeof tuple.selector === 'string' && typeof tuple.digest === 'string') {
      byIdentity.set(`${tuple.path}#${tuple.selector}`, tuple.digest);
    }
  }
  return byIdentity;
}

function sourceDriftDiagnostics(expected, actual) {
  const expectedSources = sourceTuples(expected);
  const actualSources = sourceTuples(actual);
  return [...expectedSources.entries()]
    .filter(([identity, digest]) => actualSources.get(identity) !== digest)
    .map(([identity]) => `source changed: ${identity}`);
}

function checkFile(root, pathname, expectedBytes, graph, { json }) {
  const relativePath = repositoryRelative(root, pathname);
  if (!existsSync(pathname)) return [`missing generated output: ${relativePath}`];
  const actualBytes = readFileSync(pathname, 'utf8');
  if (actualBytes === expectedBytes) return [];
  const diagnostics = [`stale generated output: ${relativePath}`];
  if (json) {
    try {
      diagnostics.push(...sourceDriftDiagnostics(graph, JSON.parse(actualBytes)));
    } catch {
      // A malformed or hand-edited projection is already identified as stale.
    }
  }
  return diagnostics;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const jsonOutput = containedOutput(options.root, options.jsonOutput, 'JSON output');
  const markdownOutput = containedOutput(options.root, options.markdownOutput, 'Markdown output');
  const model = buildIntentGraphSources(options.root);
  const graph = compileIntentGraph({ repositoryRoot: options.root, ...model });
  const json = `${JSON.stringify(graph, null, 2)}\n`;
  const markdown = renderIntentGraphMarkdown(graph);

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
    ...checkFile(options.root, jsonOutput, json, graph, { json: true }),
    ...checkFile(options.root, markdownOutput, markdown, graph, { json: false }),
  ];
  if (diagnostics.length > 0) {
    throw new TypeError(diagnostics.join('\n'));
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
