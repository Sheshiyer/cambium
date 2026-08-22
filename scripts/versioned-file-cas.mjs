import { createHash, randomBytes } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function syncDirectory(directory) {
  const descriptor = openSync(directory, 'r');
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function removeDurably(pathname) {
  if (!existsSync(pathname)) return;
  unlinkSync(pathname);
  syncDirectory(path.dirname(pathname));
}

function ownerAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === 'EPERM'; }
}

async function acquireLock(target, { waitMs = 2_000, staleMs = 30_000 } = {}) {
  if (!Number.isSafeInteger(waitMs) || waitMs < 0 || waitMs > 60_000
      || !Number.isSafeInteger(staleMs) || staleMs < 1_000 || staleMs > 3_600_000) {
    throw new TypeError('versioned CAS lock bounds are invalid');
  }
  const pathname = `${target}.cambium-cas.lock`;
  const deadline = Date.now() + waitMs;
  const token = randomBytes(12).toString('hex');
  while (true) {
    try {
      const descriptor = openSync(pathname, 'wx', 0o600);
      try {
        writeFileSync(descriptor, `${JSON.stringify({ schema: 'cambium.versioned-file-cas-lock.v1', pid: process.pid, token })}\n`, 'utf8');
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
      syncDirectory(path.dirname(pathname));
      return () => {
        let owner;
        try { owner = JSON.parse(readFileSync(pathname, 'utf8')); } catch { throw new TypeError('versioned CAS lock ownership changed'); }
        if (owner.pid !== process.pid || owner.token !== token) throw new TypeError('versioned CAS lock ownership changed');
        removeDurably(pathname);
      };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const metadata = lstatSync(pathname, { throwIfNoEntry: false });
      if (!metadata) continue;
      let owner = null;
      try { owner = JSON.parse(readFileSync(pathname, 'utf8')); } catch { /* malformed locks require bounded stale recovery */ }
      const abandoned = owner !== null && !ownerAlive(owner.pid);
      const expiredMalformed = owner === null && Date.now() - metadata.mtimeMs > staleMs;
      if (abandoned || expiredMalformed) {
        try { removeDurably(pathname); } catch (removeError) { if (removeError?.code !== 'ENOENT') throw removeError; }
        continue;
      }
      if (Date.now() >= deadline) return null;
      await sleep(Math.min(20, Math.max(1, deadline - Date.now())));
    }
  }
}

function versionOf(target, bytes) {
  const metadata = statSync(target, { bigint: true });
  return {
    device: metadata.dev.toString(),
    inode: metadata.ino.toString(),
    size: metadata.size.toString(),
    modifiedNs: metadata.mtimeNs.toString(),
    digest: digest(bytes),
  };
}

function sameVersion(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function durableReplace(target, content) {
  const temporary = `${target}.tmp-${process.pid}-${randomBytes(8).toString('hex')}`;
  const descriptor = openSync(temporary, 'wx', 0o600);
  try {
    writeFileSync(descriptor, content, 'utf8');
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  try {
    renameSync(temporary, target);
    syncDirectory(path.dirname(target));
  } catch (error) {
    try { removeDurably(temporary); } catch { /* retain the original error */ }
    throw error;
  }
}

export async function compareAndSwapTextFile({
  target,
  expectedDigest,
  buildNext,
  isAlreadyApplied = () => false,
  writer = durableReplace,
  lockOptions,
}) {
  if (typeof target !== 'string' || !path.isAbsolute(target) || typeof expectedDigest !== 'string'
      || typeof buildNext !== 'function' || typeof isAlreadyApplied !== 'function' || typeof writer !== 'function') {
    throw new TypeError('versioned CAS request is invalid');
  }
  const release = await acquireLock(target, lockOptions);
  if (release === null) return Object.freeze({ status: 'cas_conflict' });
  try {
    const current = readFileSync(target, 'utf8');
    const version = versionOf(target, current);
    if (isAlreadyApplied(current)) return Object.freeze({ status: 'already_applied' });
    if (version.digest !== expectedDigest) return Object.freeze({ status: 'cas_conflict' });
    const next = await buildNext(current);
    if (typeof next !== 'string') throw new TypeError('versioned CAS builder must return complete text');
    const immediate = readFileSync(target, 'utf8');
    if (!sameVersion(version, versionOf(target, immediate))) return Object.freeze({ status: 'cas_conflict' });
    writer(target, next);
    return Object.freeze({ status: 'applied' });
  } finally {
    release();
  }
}
