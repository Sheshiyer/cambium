import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

function removeIfPresent(pathname) {
  if (existsSync(pathname)) unlinkSync(pathname);
}

function stage(target, bytes, nonce) {
  const pathname = path.join(path.dirname(target), `.${path.basename(target)}.${nonce}.stage`);
  const descriptor = openSync(pathname, 'wx', 0o600);
  try {
    writeFileSync(descriptor, bytes, 'utf8');
  } finally {
    closeSync(descriptor);
  }
  return pathname;
}

export function publishFilePair(entries, options = {}) {
  if (!Array.isArray(entries) || entries.length !== 2) throw new TypeError('publication transaction requires exactly two outputs');
  const rename = options.rename ?? renameSync;
  const nonce = `txn-${process.pid}-${Date.now()}`;
  const transaction = [];
  try {
    for (const [index, { target, bytes, validate }] of entries.entries()) {
      transaction.push({
        target,
        bytes,
        validate,
        staged: stage(target, bytes, `${nonce}-${index}`),
        backup: `${target}.${nonce}-${index}.backup`,
        existed: existsSync(target),
        published: false,
      });
    }
  } catch (error) {
    for (const entry of transaction) removeIfPresent(entry.staged);
    throw error;
  }
  try {
    for (const entry of transaction) {
      const stagedBytes = readFileSync(entry.staged, 'utf8');
      if (stagedBytes !== entry.bytes) throw new TypeError('staged output bytes changed before publication');
      entry.validate?.(stagedBytes);
    }
    for (const entry of transaction) if (entry.existed) rename(entry.target, entry.backup);
    for (const entry of transaction) {
      rename(entry.staged, entry.target);
      entry.published = true;
    }
    for (const entry of transaction) removeIfPresent(entry.backup);
  } catch (error) {
    for (const entry of [...transaction].reverse()) {
      if (entry.published) removeIfPresent(entry.target);
      if (entry.existed && existsSync(entry.backup)) renameSync(entry.backup, entry.target);
      removeIfPresent(entry.staged);
    }
    throw error;
  } finally {
    for (const entry of transaction) {
      removeIfPresent(entry.staged);
      removeIfPresent(entry.backup);
    }
  }
}
