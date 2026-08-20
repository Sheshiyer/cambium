#!/usr/bin/env node
import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderDocumentationInventoryJson,
  renderDocumentationInventoryMarkdown,
  validateDocumentationInventory,
} from './documentation-inventory.mjs';
import { generateDocumentationInventoryRepresentation } from './generate-documentation-inventory.mjs';

const modulePath = fileURLToPath(import.meta.url);
const defaultRepositoryRoot = realpathSync(path.resolve(path.dirname(modulePath), '..'));
const REVISION_TEXT = /^[A-Za-z0-9][A-Za-z0-9._/@{}^~:+-]{0,199}$/;

function usage(message) {
  throw new TypeError(message ?? 'usage: check-documentation-inventory.mjs --source-revision REV');
}

function nextValue(argv, index, argument) {
  const value = argv[index + 1];
  if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) usage(`${argument} requires one argument`);
  return value;
}

export function parseDocumentationInventoryCheckArguments(argv, { repositoryRoot = defaultRepositoryRoot } = {}) {
  if (!Array.isArray(argv)) throw new TypeError('arguments must be an array');
  const options = { repositoryRoot, sourceRevision: null };
  let rootSeen = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--source-revision') {
      if (options.sourceRevision !== null) usage('--source-revision must be supplied exactly once');
      options.sourceRevision = nextValue(argv, index, argument);
      index += 1;
      continue;
    }
    if (argument === '--root') {
      if (rootSeen) usage('--root must be supplied at most once');
      options.repositoryRoot = nextValue(argv, index, argument);
      rootSeen = true;
      index += 1;
      continue;
    }
    usage(`unknown or forbidden argument ${String(argument).slice(0, 80)}`);
  }
  if (options.sourceRevision === null) usage('--source-revision is required');
  if (!REVISION_TEXT.test(options.sourceRevision) || path.isAbsolute(options.sourceRevision)) {
    usage('--source-revision must be bounded revision text');
  }
  if (typeof options.repositoryRoot !== 'string' || !path.isAbsolute(options.repositoryRoot)) {
    usage('--root must be an absolute test repository path');
  }
  return options;
}

function entryIdentity(entry) {
  return {
    path: entry.path,
    lifecycle: entry.lifecycle,
    canonicalAnchors: entry.canonicalAnchors,
    exception: entry.exception,
  };
}

function sharedIdentity(inventory) {
  return {
    sourceRevision: inventory.sourceRevision,
    schema: inventory.schema,
    projectionAuthority: inventory.projectionAuthority,
    sourceSetDigest: inventory.sourceSetDigest,
    inventoryDigest: inventory.inventoryDigest,
    entryCount: inventory.entries.length,
    entries: inventory.entries.map(entryIdentity),
    lifecycleClasses: inventory.lifecycleClasses,
    rootMemory: inventory.rootMemory,
  };
}

function validateGenerated(result, format) {
  if (typeof result !== 'object' || result === null || typeof result.output !== 'string') {
    throw new TypeError(`${format} generator returned an invalid result`);
  }
  const inventory = validateDocumentationInventory(result.inventory);
  return { inventory, output: result.output };
}

export function checkDocumentationInventory({
  repositoryRoot,
  sourceRevision,
  generate = generateDocumentationInventoryRepresentation,
}) {
  if (typeof generate !== 'function') throw new TypeError('generate must be a function');
  const request = { repositoryRoot, sourceRevision };
  const jsonOne = validateGenerated(generate({ ...request, format: 'json' }), 'JSON');
  const jsonTwo = validateGenerated(generate({ ...request, format: 'json' }), 'JSON');
  if (jsonOne.output !== jsonTwo.output) throw new TypeError('JSON output is nondeterministic');
  const markdownOne = validateGenerated(generate({ ...request, format: 'markdown' }), 'Markdown');
  const markdownTwo = validateGenerated(generate({ ...request, format: 'markdown' }), 'Markdown');
  if (markdownOne.output !== markdownTwo.output) throw new TypeError('Markdown output is nondeterministic');

  let parsed;
  try {
    parsed = validateDocumentationInventory(JSON.parse(jsonOne.output));
  } catch (error) {
    throw new TypeError(`JSON output is not one valid inventory: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (jsonOne.output !== renderDocumentationInventoryJson(parsed)) throw new TypeError('JSON output is not the canonical inventory representation');
  for (const candidate of [jsonOne.inventory, jsonTwo.inventory, markdownOne.inventory, markdownTwo.inventory]) {
    assert.deepEqual(sharedIdentity(candidate), sharedIdentity(parsed), 'JSON/Markdown shared inventory identity parity failed');
  }
  if (markdownOne.output !== renderDocumentationInventoryMarkdown(parsed)) {
    throw new TypeError('Markdown output parity failed for inventoryDigest, entries, lifecycle, anchors, or exceptions');
  }
  return {
    sourceRevision: parsed.sourceRevision,
    inventoryDigest: parsed.inventoryDigest,
    entryCount: parsed.entries.length,
  };
}

function safeDiagnostic(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/Git revision read failed|resolve exactly once to a full commit SHA/i.test(message)) {
    return 'source revision could not be resolved to one commit';
  }
  if (/ENOENT|ENOTDIR|repositoryRoot|repository root|realpath/i.test(message)) return 'repository root is invalid';
  return message
    .replace(/(?:\/(?:Users|Volumes|private|tmp|var|home)(?:\/[^\s:]+)+)/gi, '<redacted-path>')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer <redacted>')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 300);
}

export function runDocumentationInventoryCheckCli(argv, io = process) {
  const options = parseDocumentationInventoryCheckArguments(argv);
  const result = checkDocumentationInventory(options);
  io.stdout.write(`documentation inventory check passed: ${result.sourceRevision} ${result.inventoryDigest} entries=${result.entryCount}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(modulePath)) {
  try {
    runDocumentationInventoryCheckCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${safeDiagnostic(error)}\n`);
    process.exitCode = 1;
  }
}

