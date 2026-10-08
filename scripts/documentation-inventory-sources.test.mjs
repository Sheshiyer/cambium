import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildDocumentationInventorySources,
  parseGitBlobBatch,
  visitGitBlobObjects,
} from './documentation-inventory-sources.mjs';

const objectId = (body, algorithm = 'sha1') => createHash(algorithm)
  .update(`blob ${body.length}\0`).update(body).digest('hex');
const digest = (body) => createHash('sha256').update(body).digest('hex');
const packet = (body, id = objectId(body)) => Buffer.concat([
  Buffer.from(`${id} blob ${body.length}\n`), body, Buffer.from('\n'),
]);

function git(root, args, input) {
  const result = spawnSync('/usr/bin/git', ['--no-replace-objects', '--no-optional-locks', '-C', root, ...args], {
    input,
    encoding: null,
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_CONFIG_NOSYSTEM: '1' },
    maxBuffer: 256 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr?.toString('utf8'));
  return result.stdout;
}

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'cambium-blob-batch-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.name', 'Fixture']);
  git(root, ['config', 'user.email', 'fixture@example.invalid']);
  mkdirSync(path.join(root, 'docs'));
  writeFileSync(path.join(root, 'README.md'), '# Root fixture\n');
  const bodies = {
    'docs/binary.dat': Buffer.from([0, 255, 10, 13, 128, 1]),
    'docs/empty.md': Buffer.alloc(0),
    'docs/lines.md': Buffer.from('First\nSecond\n\n'),
  };
  for (const [relativePath, body] of Object.entries(bodies)) writeFileSync(path.join(root, relativePath), body);
  git(root, ['add', '--', '.']);
  git(root, ['commit', '--quiet', '-m', 'fixture']);
  const revision = git(root, ['rev-parse', 'HEAD']).toString('utf8').trim();
  return { root, bodies, revision };
}

test('blob batch preserves binary framing, empty blobs, duplicates, and both Git hash formats', () => {
  const bodies = [Buffer.from([0, 255, 10, 13, 128]), Buffer.alloc(0), Buffer.from('多\nlines\n')];
  for (const algorithm of ['sha1', 'sha256']) {
    const ordered = [...bodies, bodies[0]];
    const ids = ordered.map((body) => objectId(body, algorithm));
    assert.deepEqual(parseGitBlobBatch(Buffer.concat(ordered.map((body, index) => packet(body, ids[index]))), ids), ordered);
  }
  assert.deepEqual(parseGitBlobBatch(Buffer.alloc(0), []), []);
});

test('blob batch rejects missing, non-blob, mismatched and malformed identities and byte counts', () => {
  const body = Buffer.from('bounded fixture\n');
  const id = objectId(body);
  for (const header of [
    `${id} missing`, `${id} tree ${body.length}`, `${'0'.repeat(40)} blob ${body.length}`,
    `${id} blob 01`, `${id} blob -1`, `${id} blob 1.2`, `${id} blob 9007199254740992`,
    `${id} blob ${256 * 1024 * 1024 + 1}`, `${id} blob ${body.length} extra`,
  ]) assert.throws(() => parseGitBlobBatch(Buffer.concat([Buffer.from(`${header}\n`), body, Buffer.from('\n')]), [id]), /Git blob batch/);
  const malformedHeader = packet(body);
  malformedHeader[0] |= 128;
  assert.throws(() => parseGitBlobBatch(malformedHeader, [id]), /identity/);
  for (const ids of [null, [null], Array(1), ['HEAD'], [`${id}\n`], ['a'.repeat(41)], ['a'.repeat(63)]]) {
    assert.throws(() => parseGitBlobBatch(packet(body), ids), /exact object identities/);
  }
  assert.throws(() => parseGitBlobBatch('text', [id]), /must be bytes/);
});

test('blob batch rejects truncation, altered content, surplus bytes and extra or missing objects', () => {
  const body = Buffer.from('full original payload\n');
  const id = objectId(body);
  const valid = packet(body);
  for (const bytes of [Buffer.from(id), valid.subarray(0, valid.length - 1), valid.subarray(0, valid.length - 5)]) {
    assert.throws(() => parseGitBlobBatch(bytes, [id]), /truncated|framing/);
  }
  const changed = Buffer.from(valid);
  changed[changed.indexOf(10) + 1] ^= 1;
  assert.throws(() => parseGitBlobBatch(changed, [id]), /content does not match/);
  assert.throws(() => parseGitBlobBatch(Buffer.concat([valid, Buffer.from('extra')]), [id]), /trailing/);
  assert.throws(() => parseGitBlobBatch(Buffer.concat([valid, valid]), [id]), /extra objects/);
  assert.throws(() => parseGitBlobBatch(valid, [id, id]), /truncated/);
});

test('native object batch equals independent committed bytes and ignores dirty files and replacement refs', (t) => {
  const { root, bodies, revision } = fixture(t);
  const paths = Object.keys(bodies);
  const ids = paths.map((relativePath) => git(root, ['rev-parse', `${revision}:${relativePath}`]).toString('utf8').trim());
  const replacement = git(root, ['hash-object', '-w', '--stdin'], Buffer.from('replacement bytes\n')).toString('utf8').trim();
  git(root, ['replace', ids[0], replacement]);
  writeFileSync(path.join(root, paths[0]), Buffer.from('dirty bytes\n'));
  const beforeIndex = digest(readFileSync(path.join(root, '.git/index')));
  const beforeStatus = git(root, ['status', '--porcelain=v1', '-z']);
  const actual = [];
  visitGitBlobObjects(root, [...ids, ids[0]], (body, index) => {
    const relativePath = paths[index % paths.length];
    assert.deepEqual(body, git(root, ['show', `${revision}:${relativePath}`]));
    actual.push(Buffer.from(body));
  });
  assert.deepEqual(actual, [...Object.values(bodies), bodies[paths[0]]]);
  const sources = buildDocumentationInventorySources({ repositoryRoot: root, sourceRevision: revision });
  for (const [relativePath, body] of Object.entries(bodies)) {
    const record = sources.blobs.find((entry) => entry.path === relativePath);
    assert.equal(record.bytes, body.length);
    assert.equal(record.contentDigest, `sha256:${digest(body)}`);
  }
  assert.equal(digest(readFileSync(path.join(root, '.git/index'))), beforeIndex);
  assert.deepEqual(git(root, ['status', '--porcelain=v1', '-z']), beforeStatus);
});

test('native object batch rejects missing objects, tree objects and invalid requests before visiting bytes', (t) => {
  const { root, revision } = fixture(t);
  const tree = git(root, ['rev-parse', `${revision}^{tree}`]).toString('utf8').trim();
  let visits = 0;
  const visit = () => { visits += 1; };
  assert.throws(() => visitGitBlobObjects(root, ['0'.repeat(40)], visit), /missing|non-blob/);
  assert.throws(() => visitGitBlobObjects(root, [tree], visit), /missing|non-blob/);
  assert.throws(() => visitGitBlobObjects(root, ['HEAD'], visit), /exact object identities/);
  assert.throws(() => visitGitBlobObjects(root, [], null), /visitor/);
  visitGitBlobObjects(root, [], visit);
  assert.equal(visits, 0);
});

test('native object batches cross the byte bound without losing order or large blob bytes', (t) => {
  const { root } = fixture(t);
  const large = Buffer.alloc(34 * 1024 * 1024, 10);
  const firstId = git(root, ['hash-object', '-w', '--stdin'], large).toString('utf8').trim();
  large[large.length - 1] = 255;
  const secondId = git(root, ['hash-object', '-w', '--stdin'], large).toString('utf8').trim();
  const expected = [firstId, secondId, firstId];
  const visited = [];
  visitGitBlobObjects(root, expected, (body, index) => {
    assert.equal(body.length, large.length);
    assert.equal(objectId(body), expected[index]);
    visited.push(expected[index]);
  });
  assert.deepEqual(visited, expected);
});
