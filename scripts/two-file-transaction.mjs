import { createHash, randomBytes } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const JOURNAL_SCHEMA = 'cambium.paired-publication-transaction.v1';
const TRANSACTION_ID = /^txn-[0-9]+-[0-9]+-[a-f0-9]{12}$/;

const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    throw new TypeError(`${label} must use the closed schema`);
  }
}

function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length !== 2) throw new TypeError('publication transaction requires exactly two outputs');
  const normalized = entries.map(({ target, bytes, validate }) => {
    if (typeof target !== 'string' || !path.isAbsolute(target) || typeof bytes !== 'string'
        || (validate !== undefined && typeof validate !== 'function')) {
      throw new TypeError('publication entries require absolute targets, text bytes, and optional validators');
    }
    return { target: path.resolve(target), bytes, validate };
  });
  if (new Set(normalized.map(({ target }) => target)).size !== 2
      || new Set(normalized.map(({ target }) => path.dirname(target))).size !== 1) {
    throw new TypeError('paired publication outputs must be distinct files in one directory');
  }
  return normalized;
}

function transactionPaths(entries, transactionId) {
  return entries.map(({ target }, index) => ({
    target,
    staged: path.join(path.dirname(target), `.${path.basename(target)}.${transactionId}-${index}.stage`),
    backup: path.join(path.dirname(target), `.${path.basename(target)}.${transactionId}-${index}.backup`),
  }));
}

function journalPath(entries) {
  const names = entries.map(({ target }) => path.basename(target)).sort().join('.');
  return path.join(path.dirname(entries[0].target), `.${names}.publication-transaction.json`);
}

function syncDirectory(directory) {
  const descriptor = openSync(directory, 'r');
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function removeDurably(pathname) {
  if (!existsSync(pathname)) return;
  unlinkSync(pathname);
  syncDirectory(path.dirname(pathname));
}

function renameDurably(from, to, rename = renameSync) {
  rename(from, to);
  syncDirectory(path.dirname(to));
}

function stageDurably(pathname, bytes) {
  const descriptor = openSync(pathname, 'wx', 0o600);
  try {
    writeFileSync(descriptor, bytes, 'utf8');
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  syncDirectory(path.dirname(pathname));
}

function writeJournal(pathname, value) {
  const temporary = `${pathname}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  const descriptor = openSync(temporary, 'wx', 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameDurably(temporary, pathname);
}

function readJournal(pathname, entries) {
  const metadata = lstatSync(pathname);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new TypeError('paired publication journal must be a regular file');
  let value;
  try { value = JSON.parse(readFileSync(pathname, 'utf8')); } catch { throw new TypeError('paired publication journal is malformed'); }
  exactKeys(value, ['schema', 'transactionId', 'entries'], 'paired publication journal');
  if (value.schema !== JOURNAL_SCHEMA || !TRANSACTION_ID.test(value.transactionId) || !Array.isArray(value.entries) || value.entries.length !== 2) {
    throw new TypeError('paired publication journal identity is invalid');
  }
  for (const [index, recorded] of value.entries.entries()) {
    exactKeys(recorded, ['target', 'existed', 'priorDigest', 'nextDigest'], `paired publication journal entry ${index}`);
    if (recorded.target !== entries[index].target || typeof recorded.existed !== 'boolean'
        || (recorded.existed ? !/^sha256:[a-f0-9]{64}$/.test(recorded.priorDigest) : recorded.priorDigest !== null)
        || !/^sha256:[a-f0-9]{64}$/.test(recorded.nextDigest)) {
      throw new TypeError('paired publication journal is not bound to the requested output pair');
    }
  }
  return value;
}

function fileDigest(pathname) {
  return existsSync(pathname) ? digest(readFileSync(pathname)) : null;
}

function cleanupTransaction(pathname, transaction) {
  const paths = transactionPaths(transaction.entries, transaction.transactionId);
  for (const entry of paths) {
    removeDurably(entry.staged);
    removeDurably(entry.backup);
  }
  removeDurably(pathname);
}

export function recoverFilePair(rawEntries, options = {}) {
  const entries = validateEntries(rawEntries);
  const pathname = journalPath(entries);
  if (!existsSync(pathname)) return Object.freeze({ status: 'none' });
  const transaction = readJournal(pathname, entries);
  const paths = transactionPaths(entries, transaction.transactionId);
  const allPublished = transaction.entries.every(({ nextDigest }, index) => fileDigest(paths[index].target) === nextDigest);
  if (allPublished) {
    cleanupTransaction(pathname, transaction);
    return Object.freeze({ status: 'committed' });
  }

  const rename = options.rename ?? renameSync;
  for (let index = paths.length - 1; index >= 0; index -= 1) {
    const entry = paths[index];
    const recorded = transaction.entries[index];
    if (existsSync(entry.backup)) {
      removeDurably(entry.target);
      renameDurably(entry.backup, entry.target, rename);
    } else if (recorded.existed) {
      if (fileDigest(entry.target) !== recorded.priorDigest) {
        throw new TypeError('paired publication cannot recover a missing or changed prior output');
      }
    } else {
      removeDurably(entry.target);
    }
  }
  for (const [index, recorded] of transaction.entries.entries()) {
    const restored = fileDigest(paths[index].target);
    if ((recorded.existed && restored !== recorded.priorDigest) || (!recorded.existed && restored !== null)) {
      throw new TypeError('paired publication recovery did not restore the complete prior pair');
    }
  }
  cleanupTransaction(pathname, transaction);
  return Object.freeze({ status: 'rolled_back' });
}

export function publishFilePair(rawEntries, options = {}) {
  const entries = validateEntries(rawEntries);
  recoverFilePair(entries, options);
  const transactionId = `txn-${process.pid}-${Date.now()}-${randomBytes(6).toString('hex')}`;
  const pathname = journalPath(entries);
  const paths = transactionPaths(entries, transactionId);
  const transaction = {
    schema: JOURNAL_SCHEMA,
    transactionId,
    entries: entries.map(({ target, bytes }) => ({
      target,
      existed: existsSync(target),
      priorDigest: fileDigest(target),
      nextDigest: digest(Buffer.from(bytes, 'utf8')),
    })),
  };
  writeJournal(pathname, transaction);
  try {
    for (const [index, entry] of entries.entries()) {
      stageDurably(paths[index].staged, entry.bytes);
      const stagedBytes = readFileSync(paths[index].staged, 'utf8');
      if (stagedBytes !== entry.bytes) throw new TypeError('staged output bytes changed before publication');
      entry.validate?.(stagedBytes);
    }
    const rename = options.rename ?? renameSync;
    for (const [index, recorded] of transaction.entries.entries()) {
      if (recorded.existed) renameDurably(paths[index].target, paths[index].backup, rename);
    }
    for (const entry of paths) renameDurably(entry.staged, entry.target, rename);
    if (!transaction.entries.every(({ nextDigest }, index) => fileDigest(paths[index].target) === nextDigest)) {
      throw new TypeError('published output bytes differ from the durable transaction journal');
    }
    cleanupTransaction(pathname, transaction);
  } catch (publishError) {
    try {
      recoverFilePair(entries, options);
    } catch (recoveryError) {
      throw new AggregateError([publishError, recoveryError], `paired publication failed and recovery remains pending: ${publishError.message}; ${recoveryError.message}`);
    }
    throw publishError;
  }
}
