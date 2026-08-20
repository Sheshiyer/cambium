#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileDeterministicSafety,
  validateDeterministicSafetyReceipt,
} from './deterministic-safety.mjs';

const modulePath = fileURLToPath(import.meta.url);
const defaultRepositoryRoot = realpathSync(path.resolve(path.dirname(modulePath), '..'));
const REVISION_TEXT = /^[A-Za-z0-9][A-Za-z0-9._/@{}^~:+-]{0,199}$/;

function usage(message) {
  throw new TypeError(message ?? 'usage: check-deterministic-safety.mjs --source-revision REV');
}

function nextValue(argv, index, argument) {
  const value = argv[index + 1];
  if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
    usage(`${argument} requires one argument`);
  }
  return value;
}

export function parseDeterministicSafetyCheckArguments(argv, { repositoryRoot = defaultRepositoryRoot } = {}) {
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

export function checkDeterministicSafety({ repositoryRoot, sourceRevision }) {
  const receipt = compileDeterministicSafety({ repositoryRoot, sourceRevision });
  return validateDeterministicSafetyReceipt(receipt);
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
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 300);
}

export function runDeterministicSafetyCheckCli(argv, io = process) {
  const options = parseDeterministicSafetyCheckArguments(argv);
  const result = checkDeterministicSafety(options);
  io.stdout.write(
    `deterministic safety check passed: ${result.sourceRevision} ${result.safetyDigest} entries=${result.entryCount}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(modulePath)) {
  try {
    runDeterministicSafetyCheckCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${safeDiagnostic(error)}\n`);
    process.exitCode = 1;
  }
}
