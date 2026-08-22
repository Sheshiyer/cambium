#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileDocumentationInventory,
  renderDocumentationInventoryJson,
  renderDocumentationInventoryMarkdown,
  validateDocumentationInventory,
} from './documentation-inventory.mjs';
import { buildDocumentationInventorySources } from './documentation-inventory-sources.mjs';

const modulePath = fileURLToPath(import.meta.url);
const defaultRepositoryRoot = realpathSync(path.resolve(path.dirname(modulePath), '..'));
const REVISION_TEXT = /^[A-Za-z0-9][A-Za-z0-9._/@{}^~:+-]{0,199}$/;
const FORMATS = new Set(['json', 'markdown']);

function usage(message) {
  throw new TypeError(message ?? 'usage: generate-documentation-inventory.mjs --source-revision REV --format (json|markdown)');
}

function oneValue(argv, index, argument) {
  const value = argv[index + 1];
  if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
    usage(`${argument} requires one argument`);
  }
  return value;
}

export function parseDocumentationInventoryArguments(argv, { repositoryRoot = defaultRepositoryRoot } = {}) {
  if (!Array.isArray(argv)) throw new TypeError('arguments must be an array');
  const options = { repositoryRoot, sourceRevision: null, format: null };
  let rootSeen = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--source-revision') {
      if (options.sourceRevision !== null) usage('--source-revision must be supplied exactly once');
      options.sourceRevision = oneValue(argv, index, argument);
      index += 1;
      continue;
    }
    if (argument === '--format') {
      if (options.format !== null) usage('--format must be supplied exactly once');
      options.format = oneValue(argv, index, argument);
      index += 1;
      continue;
    }
    if (argument === '--root') {
      if (rootSeen) usage('--root must be supplied at most once');
      options.repositoryRoot = oneValue(argv, index, argument);
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
  if (options.format === null) usage('--format is required');
  if (!FORMATS.has(options.format)) usage('--format must be exactly json or markdown');
  if (typeof options.repositoryRoot !== 'string' || !path.isAbsolute(options.repositoryRoot)) {
    usage('--root must be an absolute test repository path');
  }
  return options;
}

export function buildDocumentationInventory({ repositoryRoot, sourceRevision }) {
  const sources = buildDocumentationInventorySources({ repositoryRoot, sourceRevision });
  return validateDocumentationInventory(compileDocumentationInventory(sources));
}

export function generateDocumentationInventoryRepresentation(options) {
  if (options?.format !== 'json' && options?.format !== 'markdown') {
    throw new TypeError('format must be exactly json or markdown');
  }
  const inventory = buildDocumentationInventory(options);
  const output = options.format === 'json'
    ? renderDocumentationInventoryJson(inventory)
    : renderDocumentationInventoryMarkdown(inventory);
  return { inventory, output };
}

function safeDiagnostic(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/Git revision read failed|resolve exactly once to a full commit SHA/i.test(message)) {
    return 'source revision could not be resolved to one commit';
  }
  if (/ENOENT|ENOTDIR|repositoryRoot|repository root|realpath/i.test(message)) {
    return 'repository root is invalid';
  }
  return message
    .replace(/(?:\/(?:Users|Volumes|private|tmp|var|home)(?:\/[^\s:]+)+)/gi, '<redacted-path>')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer <redacted>')
    .replace(/\b(?:api[_-]?key|credential|secret|token)[=:][^\s]+/gi, '$1=<redacted>')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 300);
}

export function runDocumentationInventoryCli(argv, io = process) {
  const options = parseDocumentationInventoryArguments(argv);
  const { output } = generateDocumentationInventoryRepresentation(options);
  io.stdout.write(output);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(modulePath)) {
  try {
    runDocumentationInventoryCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${safeDiagnostic(error)}\n`);
    process.exitCode = 1;
  }
}

