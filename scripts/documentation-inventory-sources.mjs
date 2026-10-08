import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/;
const GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const INDEX_PATH = 'docs/plans/product-branches/index.md';

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareBytes(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function normalizeRelativePath(value, label = 'tracked path') {
  if (typeof value !== 'string' || value.length === 0 || path.posix.isAbsolute(value)
      || value.includes('\\') || /[\0\r\n\t|`]/.test(value)) {
    throw new TypeError(`${label} must be a safe repository-relative POSIX path`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new TypeError(`${label} must not contain traversal or normalization drift`);
  }
  return normalized;
}

function repositoryRoot(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw new TypeError('repositoryRoot must be an absolute directory path');
  }
  const resolved = realpathSync(value);
  if (!statSync(resolved).isDirectory()) throw new TypeError('repositoryRoot must resolve to a directory');
  return resolved;
}

function runGit(root, args, { encoding = 'utf8', input, maxBuffer = 256 * 1024 * 1024 } = {}) {
  const result = spawnSync('/usr/bin/git', [
    '--no-replace-objects',
    '--no-optional-locks',
    '-C', root,
    ...args,
  ], {
    encoding: encoding === null ? null : encoding,
    input,
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' },
    maxBuffer,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const diagnostic = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : result.stderr;
    const bounded = String(diagnostic || 'Git object lookup failed').trim().split(/\r?\n/, 1)[0].slice(0, 240);
    throw new TypeError(`Git revision read failed: ${bounded}`);
  }
  return result.stdout;
}

function blobHeader(header, expectedObjectId) {
  const match = /^([0-9a-f]{40,64}) blob (0|[1-9][0-9]*)$/.exec(header);
  if (!match || match[1] !== expectedObjectId || !GIT_OBJECT_ID.test(match[1])) {
    throw new TypeError('Git blob batch contains missing, non-blob, or mismatched object identity');
  }
  const bytes = Number(match[2]);
  if (!Number.isSafeInteger(bytes) || bytes > 256 * 1024 * 1024) {
    throw new TypeError('Git blob batch byte count exceeds the bounded object read');
  }
  return bytes;
}

function assertObjectIds(objectIds) {
  if (!Array.isArray(objectIds) || Array.from(objectIds).some((objectId) => typeof objectId !== 'string' || !GIT_OBJECT_ID.test(objectId))) {
    throw new TypeError('Git blob batch requires exact object identities');
  }
}

// Git's batch protocol is length-framed: binary NULs and embedded newlines are
// body bytes, not delimiters. Reject any framing, identity, or content drift.
export function parseGitBlobBatch(output, objectIds) {
  assertObjectIds(objectIds);
  if (!Buffer.isBuffer(output)) throw new TypeError('Git blob batch output must be bytes');
  let cursor = 0;
  const bodies = objectIds.map((objectId) => {
    const end = output.indexOf(10, cursor);
    if (end < 0) throw new TypeError('Git blob batch header is truncated');
    const bytes = blobHeader(output.subarray(cursor, end).toString('utf8'), objectId);
    cursor = end + 1;
    if (cursor + bytes >= output.length || output[cursor + bytes] !== 10) {
      throw new TypeError('Git blob batch body is truncated or has invalid framing');
    }
    const body = output.subarray(cursor, cursor + bytes);
    const actualObjectId = createHash(objectId.length === 40 ? 'sha1' : 'sha256')
      .update(`blob ${bytes}\0`).update(body).digest('hex');
    if (actualObjectId !== objectId) throw new TypeError('Git blob batch content does not match object identity');
    cursor += bytes + 1;
    return body;
  });
  if (cursor !== output.length) throw new TypeError('Git blob batch contains trailing bytes or extra objects');
  return bodies;
}

// Bound normal packets to 64 MiB, with the same 256 MiB per-object ceiling as
// the original individual reads. Visit and discard bodies instead of retaining
// the repository's entire binary documentation corpus in memory.
export function visitGitBlobObjects(root, objectIds, visit) {
  assertObjectIds(objectIds);
  if (typeof visit !== 'function') throw new TypeError('Git blob visitor must be a function');
  if (objectIds.length === 0) return;
  const input = `${objectIds.join('\n')}\n`;
  const metadata = String(runGit(root, ['cat-file', '--batch-check'], { input }));
  const headers = metadata.split('\n');
  if (headers.pop() !== '' || headers.length !== objectIds.length) {
    throw new TypeError('Git blob batch metadata count or framing is invalid');
  }
  const sizes = headers.map((header, index) => blobHeader(header, objectIds[index]));
  for (let start = 0; start < objectIds.length;) {
    let end = start;
    let packetBytes = 0;
    do {
      const nextBytes = sizes[end] + objectIds[end].length + 32;
      if (end > start && packetBytes + nextBytes > 64 * 1024 * 1024) break;
      packetBytes += nextBytes;
      end += 1;
    } while (end < objectIds.length);
    const ids = objectIds.slice(start, end);
    const output = runGit(root, ['cat-file', '--batch'], {
      encoding: null,
      input: `${ids.join('\n')}\n`,
      maxBuffer: Math.max(256 * 1024 * 1024, packetBytes),
    });
    parseGitBlobBatch(output, ids).forEach((body, offset) => visit(body, start + offset));
    start = end;
  }
}

function parseTree(raw) {
  const records = [];
  for (const record of raw.split('\0').filter(Boolean)) {
    const separator = record.indexOf('\t');
    if (separator < 0) throw new TypeError('Git tree record is malformed');
    const [mode, type, objectId] = record.slice(0, separator).split(' ');
    const relativePath = normalizeRelativePath(record.slice(separator + 1));
    if (!/^\d{6}$/.test(mode) || !['blob', 'tree', 'commit'].includes(type) || !GIT_OBJECT_ID.test(objectId)) {
      throw new TypeError(`Git tree metadata is invalid for ${relativePath}`);
    }
    records.push({ mode, type, objectId, path: relativePath });
  }
  return records;
}

function digestBuffer(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function contentKind(value) {
  if (value.includes(0)) return 'binary';
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(value);
    return 'text';
  } catch {
    return 'binary';
  }
}

function indexedPackets(indexBody, corpusPaths) {
  const candidates = new Set();
  const directory = path.posix.dirname(INDEX_PATH);
  const text = indexBody.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('|') && !/^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(line)) {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/g, ''));
      const filename = cells.at(-1);
      if (/^[A-Za-z0-9._-]+\.md$/.test(filename ?? '') && filename !== 'index.md') {
        candidates.add(`${directory}/${filename}`);
      }
    }
    for (const match of line.matchAll(/\]\(([A-Za-z0-9._-]+\.md)\)/g)) {
      if (match[1] !== 'index.md') candidates.add(`${directory}/${match[1]}`);
    }
  }
  const corpus = new Set(corpusPaths);
  return [...candidates].filter((candidate) => corpus.has(candidate)).sort(compareBytes);
}

export function buildDocumentationInventorySources(options) {
  if (!isRecord(options)) throw new TypeError('source adapter options must be an object');
  const allowed = ['repositoryRoot', 'sourceRevision'];
  const extras = Object.keys(options).filter((key) => !allowed.includes(key));
  if (extras.length > 0) throw new TypeError(`source adapter options contain forbidden field(s): ${extras.join(', ')}`);
  if (typeof options.sourceRevision !== 'string' || options.sourceRevision.trim().length === 0) {
    throw new TypeError('sourceRevision is required');
  }
  if (/\s|\0/.test(options.sourceRevision) || options.sourceRevision.length > 200) {
    throw new TypeError('sourceRevision must be bounded revision text');
  }

  const root = repositoryRoot(options.repositoryRoot);
  const resolved = String(runGit(root, ['rev-parse', '--verify', `${options.sourceRevision}^{commit}`])).trim();
  if (!FULL_COMMIT_SHA.test(resolved)) throw new TypeError('sourceRevision must resolve exactly once to a full commit SHA');

  const rootTree = parseTree(String(runGit(root, ['ls-tree', '-z', '--full-tree', resolved])));
  const scopedTree = parseTree(String(runGit(root, ['ls-tree', '-r', '-z', '--full-tree', resolved, '--', 'docs', '.planning'])));
  const memoryTree = parseTree(String(runGit(root, ['ls-tree', '-r', '-z', '--full-tree', resolved, '--', 'MEMORY'])));
  const corpusRecords = [
    ...rootTree.filter((entry) => entry.type === 'blob' && !entry.path.includes('/') && entry.path.endsWith('.md')),
    ...scopedTree.filter((entry) => entry.type === 'blob'),
  ].sort((left, right) => compareBytes(left.path, right.path));
  const corpusPaths = corpusRecords.map(({ path: relativePath }) => relativePath);
  if (new Set(corpusPaths).size !== corpusPaths.length) throw new TypeError('commit-tree corpus contains duplicate path identity');

  const blobs = [];
  let productIndexBody;
  visitGitBlobObjects(root, corpusRecords.map(({ objectId }) => objectId), (body, index) => {
    const entry = corpusRecords[index];
    if (entry.path === INDEX_PATH) productIndexBody = Buffer.from(body);
    blobs.push({
      path: entry.path,
      contentDigest: digestBuffer(body),
      bytes: body.length,
      contentKind: contentKind(body),
    });
  });

  return {
    sourceRevision: resolved,
    corpusPaths,
    rootMemoryTracked: memoryTree.some((entry) => entry.type === 'blob'),
    indexedProductBranchPackets: productIndexBody ? indexedPackets(productIndexBody, corpusPaths) : [],
    blobs,
  };
}
