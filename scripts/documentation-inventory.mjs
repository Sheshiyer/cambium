import { createHash } from 'node:crypto';
import path from 'node:path';

export const DOCUMENTATION_INVENTORY_SCHEMA = 'cambium.documentation-inventory.v1';
export const DOCUMENTATION_INVENTORY_AUTHORITY = 'read_only';
export const DOCUMENTATION_LIFECYCLE_CLASSES = Object.freeze([
  'canonical',
  'derived',
  'historical',
  'evidentiary',
  'local-only',
]);

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const CONTENT_KINDS = new Set(['text', 'binary']);
const DISPOSITIONS = new Set([
  'retain-current',
  'retain-derived',
  'retain-history',
  'retain-evidence',
  'retain-local-boundary',
]);
const FORBIDDEN_KEYS = new Set([
  'archive', 'command', 'credential', 'credentials', 'delete', 'dispatch', 'externalize',
  'move', 'output', 'outputFile', 'promptBody', 'provider', 'providerStack', 'queue',
  'relocate', 'requestBody', 'responseBody', 'runtime', 'scheduler', 'sessionId', 'write',
]);
const PRIVATE_TEXT = /(?:\/(?:Users|Volumes)\/|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|Bearer\s+[A-Za-z0-9._~-]{8,}|\b(?:api[_-]?key|credential|secret|token)[=:][^\s]+)/i;

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertRecord(value, label) {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
}

function assertClosed(value, allowed, label) {
  assertRecord(value, label);
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !(key in value));
  if (extras.length > 0) throw new TypeError(`${label} contains forbidden field(s): ${extras.join(', ')}`);
  if (missing.length > 0) throw new TypeError(`${label} is missing field(s): ${missing.join(', ')}`);
}

function rejectForbiddenDeep(value, label = 'documentation inventory') {
  if (Array.isArray(value)) {
    value.forEach((entry) => rejectForbiddenDeep(entry, label));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new TypeError(`${label} contains forbidden field ${key}`);
    rejectForbiddenDeep(nested, `${label}.${key}`);
  }
}

function compareBytes(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort(compareBytes).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digestObject(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function safePath(value, label = 'path') {
  if (typeof value !== 'string' || value.length === 0 || path.posix.isAbsolute(value)
      || value.includes('\\') || /[\0\r\n\t|`]/.test(value)) {
    throw new TypeError(`${label} must be a safe repository-relative POSIX path`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new TypeError(`${label} must not contain traversal or normalization drift`);
  }
  if (PRIVATE_TEXT.test(value)) throw new TypeError(`${label} must not expose private or machine-local text`);
  return normalized;
}

function safeText(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 500 || PRIVATE_TEXT.test(value)) {
    throw new TypeError(`${label} must be bounded, non-empty, and redacted`);
  }
  return value;
}

function sortedUniquePaths(value, label) {
  if (!Array.isArray(value) || value.length > 16384) throw new TypeError(`${label} must be a bounded array`);
  const paths = value.map((entry) => safePath(entry, label));
  const sorted = [...paths].sort(compareBytes);
  if (new Set(sorted).size !== sorted.length) throw new TypeError(`${label} contains duplicate path identity`);
  return sorted;
}

function sameArray(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function lifecycleFor(relativePath, indexedPackets) {
  if (['VISION.md', 'MISSION.md', 'ISA.md', 'AGENTS.md', 'PROJECT.md'].includes(relativePath)) return 'canonical';
  if (relativePath === '.planning/STATE.md' || relativePath === '.planning/PROJECT.md'
      || relativePath === '.planning/ROADMAP.md' || relativePath === '.planning/REQUIREMENTS.md') return 'canonical';
  if (relativePath === 'docs/LIFECYCLE.md' || relativePath.startsWith('docs/runbooks/')
      || relativePath.startsWith('docs/architecture/contracts/') || relativePath === 'docs/memory/boundary.json') return 'canonical';
  if (indexedPackets.has(relativePath)) return 'evidentiary';
  if (relativePath.startsWith('docs/archive/') || relativePath.startsWith('docs/plans/')
      || relativePath.startsWith('.planning/phases/') || /^\.planning\/\d{4}-\d{2}-\d{2}/.test(relativePath)) return 'historical';
  if (relativePath.startsWith('docs/evidence/') || relativePath.includes('/evidence/')
      || /(?:VERIFICATION|SUMMARY|REVIEW)\.md$/.test(relativePath)) return 'evidentiary';
  return 'derived';
}

function purposeFor(relativePath, lifecycle) {
  if (relativePath === 'VISION.md') return 'Enduring repository doctrine anchor.';
  if (relativePath === 'MISSION.md') return 'Renewable repository mission anchor.';
  if (relativePath === 'ISA.md') return 'Approved goal and acceptance source of record.';
  if (relativePath === '.planning/STATE.md') return 'Live finite planning transition.';
  if (relativePath.startsWith('docs/architecture/contracts/')) return 'Bounded architecture or operating contract.';
  if (relativePath.startsWith('docs/runbooks/')) return 'Current bounded operator procedure.';
  if (lifecycle === 'historical') return 'Recoverable implementation history; non-operational by default.';
  if (lifecycle === 'evidentiary') return 'Recoverable proof or source-backed operating evidence.';
  if (lifecycle === 'canonical') return 'Current bounded authority in its declared domain.';
  return 'Derived documentation or navigation material.';
}

function anchorsFor(relativePath, lifecycle) {
  const anchors = new Set(['VISION.md', 'MISSION.md', 'ISA.md']);
  if (relativePath.startsWith('.planning/') || lifecycle === 'historical') anchors.add('.planning/STATE.md');
  if (relativePath.startsWith('docs/')) anchors.add('docs/LIFECYCLE.md');
  return [...anchors].sort(compareBytes);
}

function overlapFor(relativePath, lifecycle) {
  if (relativePath === 'VISION.md' || relativePath === 'MISSION.md' || relativePath === 'ISA.md') return [];
  if (relativePath.startsWith('.planning/')) return ['.planning/STATE.md'];
  if (lifecycle === 'historical' || lifecycle === 'evidentiary') return ['docs/LIFECYCLE.md'];
  return ['docs/README.md'];
}

function dispositionFor(lifecycle) {
  return {
    canonical: 'retain-current',
    derived: 'retain-derived',
    historical: 'retain-history',
    evidentiary: 'retain-evidence',
    'local-only': 'retain-local-boundary',
  }[lifecycle];
}

function canonicalSourceFacts(entries, rootMemory) {
  return {
    rootMemory: { scope: rootMemory.scope, tracked: rootMemory.tracked },
    entries: entries.map(({ path: relativePath, provenance }) => ({ path: relativePath, provenance })),
  };
}

export function compileDocumentationInventory(input) {
  rejectForbiddenDeep(input, 'documentation inventory source model');
  assertClosed(input, ['sourceRevision', 'corpusPaths', 'rootMemoryTracked', 'indexedProductBranchPackets', 'blobs'], 'documentation inventory source model');
  if (!FULL_COMMIT_SHA.test(input.sourceRevision)) throw new TypeError('sourceRevision must be a full lowercase 40-hex commit SHA');
  if (typeof input.rootMemoryTracked !== 'boolean') throw new TypeError('rootMemoryTracked must be boolean');
  const corpusPaths = sortedUniquePaths(input.corpusPaths, 'corpus path');
  const indexedPackets = sortedUniquePaths(input.indexedProductBranchPackets, 'indexed product-branch packet');
  if (!Array.isArray(input.blobs) || input.blobs.length > 16384) throw new TypeError('blobs must be a bounded array');
  const blobs = input.blobs.map((blob) => {
    assertClosed(blob, ['path', 'contentDigest', 'bytes', 'contentKind'], 'source blob');
    const relativePath = safePath(blob.path, 'source blob path');
    if (!DIGEST.test(blob.contentDigest)) throw new TypeError(`source blob digest is invalid for ${relativePath}`);
    if (!Number.isSafeInteger(blob.bytes) || blob.bytes < 0) throw new TypeError(`source blob bytes are invalid for ${relativePath}`);
    if (!CONTENT_KINDS.has(blob.contentKind)) throw new TypeError(`source blob content kind is invalid for ${relativePath}`);
    return { path: relativePath, contentDigest: blob.contentDigest, bytes: blob.bytes, contentKind: blob.contentKind };
  }).sort((left, right) => compareBytes(left.path, right.path));
  if (new Set(blobs.map(({ path: relativePath }) => relativePath)).size !== blobs.length) throw new TypeError('source blobs contain duplicate path identity');
  if (!sameArray(corpusPaths, blobs.map(({ path: relativePath }) => relativePath))) {
    throw new TypeError('source blob path coverage must exactly equal the declared corpus path set');
  }
  if (indexedPackets.some((relativePath) => !corpusPaths.includes(relativePath))) {
    throw new TypeError('indexed product-branch exception must name a corpus path');
  }

  const packetSet = new Set(indexedPackets);
  const entries = blobs.map((blob) => {
    const lifecycle = lifecycleFor(blob.path, packetSet);
    return {
      path: blob.path,
      provenance: {
        sourceRevision: input.sourceRevision,
        contentDigest: blob.contentDigest,
        bytes: blob.bytes,
        contentKind: blob.contentKind,
      },
      presentPurpose: purposeFor(blob.path, lifecycle),
      overlap: overlapFor(blob.path, lifecycle),
      recommendedDisposition: dispositionFor(lifecycle),
      canonicalAnchors: anchorsFor(blob.path, lifecycle),
      lifecycle,
      exception: packetSet.has(blob.path) ? {
        kind: 'indexed-product-branch-packet',
        evidencePath: 'docs/plans/product-branches/index.md',
        directoryDefault: 'historical',
      } : null,
    };
  });
  const rootMemory = {
    scope: 'root MEMORY/',
    tracked: input.rootMemoryTracked,
    lifecycle: 'local-only',
    policy: 'Never inspect ignored or provider-owned runtime memory.',
  };
  const sourceSetDigest = digestObject(canonicalSourceFacts(entries, rootMemory));
  const withoutDigest = {
    schema: DOCUMENTATION_INVENTORY_SCHEMA,
    projectionAuthority: DOCUMENTATION_INVENTORY_AUTHORITY,
    sourceRevision: input.sourceRevision,
    lifecycleClasses: [...DOCUMENTATION_LIFECYCLE_CLASSES],
    rootMemory,
    entries,
    sourceSetDigest,
  };
  return validateDocumentationInventory({ ...withoutDigest, inventoryDigest: digestObject(withoutDigest) });
}

function validatePathArray(value, label) {
  const normalized = sortedUniquePaths(value, label);
  if (!sameArray(value, normalized)) throw new TypeError(`${label} must be bytewise sorted and unique`);
}

function validateEntry(entry, sourceRevision, priorPath) {
  assertClosed(entry, [
    'path', 'provenance', 'presentPurpose', 'overlap', 'recommendedDisposition',
    'canonicalAnchors', 'lifecycle', 'exception',
  ], 'inventory entry');
  const relativePath = safePath(entry.path, 'inventory entry path');
  if (priorPath !== null && compareBytes(priorPath, relativePath) >= 0) throw new TypeError('inventory entry paths must be bytewise sorted and unique');
  assertClosed(entry.provenance, ['sourceRevision', 'contentDigest', 'bytes', 'contentKind'], 'inventory provenance');
  if (entry.provenance.sourceRevision !== sourceRevision || !DIGEST.test(entry.provenance.contentDigest)
      || !Number.isSafeInteger(entry.provenance.bytes) || entry.provenance.bytes < 0
      || !CONTENT_KINDS.has(entry.provenance.contentKind)) throw new TypeError(`inventory provenance is invalid for ${relativePath}`);
  safeText(entry.presentPurpose, 'present purpose');
  validatePathArray(entry.overlap, 'overlap path');
  validatePathArray(entry.canonicalAnchors, 'canonical anchor path');
  if (!DOCUMENTATION_LIFECYCLE_CLASSES.includes(entry.lifecycle)) throw new TypeError('inventory lifecycle is invalid');
  if (!DISPOSITIONS.has(entry.recommendedDisposition) || !entry.recommendedDisposition.startsWith('retain')) {
    throw new TypeError('inventory disposition must remain non-destructive retain guidance');
  }
  if (entry.exception !== null) {
    assertClosed(entry.exception, ['kind', 'evidencePath', 'directoryDefault'], 'inventory exception');
    if (entry.exception.kind !== 'indexed-product-branch-packet'
        || safePath(entry.exception.evidencePath, 'exception evidence path') !== 'docs/plans/product-branches/index.md'
        || entry.exception.directoryDefault !== 'historical' || entry.lifecycle !== 'evidentiary') {
      throw new TypeError('inventory exception must be explicit indexed evidence over a historical default');
    }
  }
  return relativePath;
}

export function validateDocumentationInventory(value) {
  rejectForbiddenDeep(value);
  assertClosed(value, [
    'schema', 'projectionAuthority', 'sourceRevision', 'lifecycleClasses', 'rootMemory',
    'entries', 'sourceSetDigest', 'inventoryDigest',
  ], 'documentation inventory');
  if (value.schema !== DOCUMENTATION_INVENTORY_SCHEMA) throw new TypeError(`schema must equal ${DOCUMENTATION_INVENTORY_SCHEMA}`);
  if (value.projectionAuthority !== DOCUMENTATION_INVENTORY_AUTHORITY) throw new TypeError('documentation inventory authority must remain read_only');
  if (!FULL_COMMIT_SHA.test(value.sourceRevision)) throw new TypeError('documentation inventory sourceRevision must be a full commit SHA');
  if (!sameArray(value.lifecycleClasses, DOCUMENTATION_LIFECYCLE_CLASSES)) throw new TypeError('documentation lifecycle vocabulary is not canonical');
  if (!DIGEST.test(value.sourceSetDigest) || !DIGEST.test(value.inventoryDigest)) throw new TypeError('documentation inventory digests are invalid');
  assertClosed(value.rootMemory, ['scope', 'tracked', 'lifecycle', 'policy'], 'root memory fact');
  if (value.rootMemory.scope !== 'root MEMORY/' || typeof value.rootMemory.tracked !== 'boolean'
      || value.rootMemory.lifecycle !== 'local-only') throw new TypeError('root memory fact is invalid');
  safeText(value.rootMemory.policy, 'root memory policy');
  if (!Array.isArray(value.entries) || value.entries.length > 16384) throw new TypeError('inventory entries must be a bounded array');
  let priorPath = null;
  for (const entry of value.entries) priorPath = validateEntry(entry, value.sourceRevision, priorPath);
  const expectedSourceSet = digestObject(canonicalSourceFacts(value.entries, value.rootMemory));
  if (expectedSourceSet !== value.sourceSetDigest) throw new TypeError('sourceSetDigest does not match inventory provenance');
  const { inventoryDigest: _ignored, ...withoutDigest } = value;
  if (digestObject(withoutDigest) !== value.inventoryDigest) throw new TypeError('inventoryDigest does not match canonical inventory facts');
  return value;
}

export function renderDocumentationInventoryJson(value) {
  return `${JSON.stringify(validateDocumentationInventory(value), null, 2)}\n`;
}

function cell(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function renderDocumentationInventoryMarkdown(value) {
  const inventory = validateDocumentationInventory(value);
  const lines = [
    '# Cambium Documentation Inventory',
    '',
    '> Ephemeral read-only view of one committed tree. This inventory cannot set doctrine, plan work, relocate files, or authorize deletion.',
    '',
    `- Schema: \`${inventory.schema}\``,
    `- Projection authority: \`${inventory.projectionAuthority}\``,
    `- Source revision: \`${inventory.sourceRevision}\``,
    `- Source-set digest: \`${inventory.sourceSetDigest}\``,
    `- Inventory digest: \`${inventory.inventoryDigest}\``,
    `- Root \`MEMORY/\` tracked at this revision: \`${inventory.rootMemory.tracked}\``,
    `- Lifecycle classes: ${inventory.lifecycleClasses.map((entry) => `\`${entry}\``).join(', ')}`,
    '',
    '## Entries',
    '',
    '| Path | Lifecycle | Purpose | Overlap | Recommended disposition | Canonical anchors | Provenance | Exception |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...inventory.entries.map((entry) => {
      const provenance = `${entry.provenance.sourceRevision}:${entry.provenance.contentDigest}:${entry.provenance.bytes}:${entry.provenance.contentKind}`;
      const exception = entry.exception === null ? '—' : `${entry.exception.kind} via ${entry.exception.evidencePath} over ${entry.exception.directoryDefault}`;
      return `| \`${cell(entry.path)}\` | \`${entry.lifecycle}\` | ${cell(entry.presentPurpose)} | ${cell(entry.overlap.join(', '))} | \`${entry.recommendedDisposition}\` | ${cell(entry.canonicalAnchors.join(', '))} | \`${provenance}\` | ${cell(exception)} |`;
    }),
    '',
    'Source bodies, ignored memory, host runtime state, and provider configuration remain outside this readback.',
    '',
  ];
  return lines.join('\n');
}
