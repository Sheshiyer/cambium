#!/usr/bin/env node

/**
 * Phase 9 Task 1 — Read-only inventory collector and classifier.
 *
 * Collects object metadata for the two approved R2 prefixes via injected
 * clients, computes SHA-256 logical-content digests, and classifies each
 * source/target key pair.  Never calls real Cloudflare or R2; never accepts
 * credentials; never persists object bodies.
 *
 * @module cloudflare-r2-source-inventory
 */

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Approved scope — exactly the two prefixes from the resource map
// ---------------------------------------------------------------------------

export const APPROVED_PREFIXES = Object.freeze([
  Object.freeze({
    binding: 'THOUGHTSEED_VAULT',
    bucket: 'thoughtseed-vault',
    prefix: 'portfolio/thoughtseed/workobjects/',
  }),
  Object.freeze({
    binding: 'CONTEXT_PROJECTIONS',
    bucket: 'thoughtseed-context-projections',
    prefix: 'context/v1/daily-standup-digest/standups/',
  }),
]);

export const CLASSIFICATIONS = Object.freeze({
  IDENTICAL: 'identical',
  TARGET_NEWER: 'target-newer',
  SOURCE_ONLY: 'source-only',
  CONFLICTING: 'conflicting',
  TARGET_ONLY: 'target-only',
  DERIVED_REBUILD: 'derived-rebuild',
  UNRESOLVED: 'unresolved',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 of a readable stream without persisting any bytes.
 * @param {ReadableStream|AsyncIterable} stream
 * @returns {Promise<string>} hex digest
 */
export async function sha256Stream(stream) {
  const hash = createHash('sha256');
  for await (const chunk of stream) {
    hash.update(typeof chunk === 'string' ? chunk : new Uint8Array(chunk));
  }
  return hash.digest('hex');
}

function assertNoWriteOperations(client) {
  for (const forbidden of ['put', 'delete', 'copy', 'createMultipartUpload']) {
    if (typeof client[forbidden] === 'function') {
      throw new Error(
        `Injected client exposes write method "${forbidden}"; inventory clients must be read-only`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// collectPrefixInventory — exhaustive paginated listing + stream hashing
// ---------------------------------------------------------------------------

/**
 * List every object under a single approved prefix using the injected R2
 * client, compute a SHA-256 content digest for each, and return a sorted
 * inventory array.  Fails closed on incomplete pagination, duplicate keys,
 * or metadata drift.
 *
 * @param {object} options
 * @param {object} options.client - Injected R2 client with `list`, `head`, `get` methods.
 * @param {string} options.binding - R2 binding name (for validation).
 * @param {string} options.prefix - Exact approved prefix.
 * @param {number} [options.pageSize=1000] - Page size hint for the list call.
 * @returns {Promise<Map<string, object>>} key → { key, size, lastModified, etag, sha256 }
 */
export async function collectPrefixInventory({
  client,
  binding,
  prefix,
  pageSize = 1000,
}) {
  assertNoWriteOperations(client);

  const approved = APPROVED_PREFIXES.find((p) => p.binding === binding && p.prefix === prefix);
  if (!approved) {
    throw new Error(`Prefix "${prefix}" with binding "${binding}" is not in the approved scope`);
  }

  const inventory = new Map();
  let cursor;
  let pages = 0;
  const MAX_PAGES = 1000; // safety cap

  // Phase 1: paginate the full listing
  while (pages < MAX_PAGES) {
    const page = await client.list({ prefix, cursor, limit: pageSize });

    if (!page || typeof page !== 'object') {
      throw new Error(`list() returned non-object for prefix "${prefix}" page ${pages}`);
    }
    if (!Array.isArray(page.objects)) {
      throw new Error(`list() page ${pages} missing objects array for prefix "${prefix}"`);
    }

    for (const obj of page.objects) {
      if (!obj || typeof obj.key !== 'string') {
        throw new Error(`list() page ${pages} contains object without string key`);
      }
      if (inventory.has(obj.key)) {
        throw new Error(`Duplicate key "${obj.key}" in listing for prefix "${prefix}"`);
      }
      inventory.set(obj.key, {
        key: obj.key,
        size: typeof obj.size === 'number' ? obj.size : null,
        lastModified: obj.lastModified || null,
        etag: obj.etag || null,
        sha256: null, // filled in Phase 2
      });
    }

    pages += 1;

    if (page.truncated === false || page.objects.length === 0) {
      break;
    }
    if (page.cursor == null) {
      throw new Error(
        `list() page ${pages} is truncated but returned no cursor for prefix "${prefix}"`,
      );
    }
    cursor = page.cursor;
  }

  if (pages >= MAX_PAGES) {
    throw new Error(`Exceeded max pagination pages for prefix "${prefix}"`);
  }

  // Phase 2: head + stream-hash every listed object
  for (const [key, record] of inventory) {
    const head = await client.head(key);
    if (!head || typeof head !== 'object') {
      throw new Error(`head() returned non-object for key "${key}"`);
    }

    // Validate head consistency with listing metadata
    if (typeof head.size === 'number' && record.size !== null && head.size !== record.size) {
      throw new Error(
        `Metadata drift for key "${key}": list size ${record.size} vs head size ${head.size}`,
      );
    }
    if (head.etag && record.etag && head.etag !== record.etag) {
      throw new Error(
        `ETag drift for key "${key}": list etag ${record.etag} vs head etag ${head.etag}`,
      );
    }

    // Update from head (authoritative)
    record.size = typeof head.size === 'number' ? head.size : record.size;
    record.lastModified = head.lastModified || record.lastModified;
    record.etag = head.etag || record.etag;

    // Stream-hash logical content
    const obj = await client.get(key);
    if (!obj || !obj.body) {
      throw new Error(`get() returned no body for key "${key}"`);
    }
    record.sha256 = await sha256Stream(obj.body);
  }

  return inventory;
}

// ---------------------------------------------------------------------------
// classifyInventory — compare source and target per key
// ---------------------------------------------------------------------------

/**
 * Classify each exact key pair between a source and target inventory.
 *
 * @param {object} options
 * @param {Map<string, object>} options.sourceInventory
 * @param {Map<string, object>} options.targetInventory
 * @returns {{ classified: Map<string, object>, unresolved: string[] }}
 */
export function classifyInventory({ sourceInventory, targetInventory }) {
  const classified = new Map();
  const unresolved = [];

  const allKeys = new Set([...sourceInventory.keys(), ...targetInventory.keys()]);

  for (const key of allKeys) {
    const source = sourceInventory.get(key);
    const target = targetInventory.get(key);

    if (source && target) {
      if (!source.sha256 || !target.sha256) {
        unresolved.push(key);
        classified.set(key, { key, classification: CLASSIFICATIONS.UNRESOLVED });
        continue;
      }

      if (source.sha256 === target.sha256) {
        classified.set(key, { key, classification: CLASSIFICATIONS.IDENTICAL });
      } else if (
        target.lastModified &&
        source.lastModified &&
        new Date(target.lastModified) > new Date(source.lastModified)
      ) {
        classified.set(key, { key, classification: CLASSIFICATIONS.TARGET_NEWER });
      } else {
        classified.set(key, { key, classification: CLASSIFICATIONS.CONFLICTING });
      }
    } else if (source && !target) {
      classified.set(key, { key, classification: CLASSIFICATIONS.SOURCE_ONLY });
    } else if (!source && target) {
      classified.set(key, { key, classification: CLASSIFICATIONS.TARGET_ONLY });
    }
  }

  return { classified, unresolved };
}

// ---------------------------------------------------------------------------
// writeRedactedReceipt — aggregate-only, no object keys or metadata
// ---------------------------------------------------------------------------

/**
 * Write a redacted durable receipt containing only aggregate counts, scope,
 * timestamps, and an inventory digest.  Never contains object keys, sizes,
 * ETags, per-object digests, or credentials.
 *
 * @param {object} options
 * @param {object} options.classification - Output of classifyInventory.
 * @param {Map<string, object>} options.sourceInventory
 * @param {Map<string, object>} options.targetInventory
 * @param {string} options.outputPath
 * @param {Date} [options.runStart]
 * @param {Date} [options.runEnd]
 * @returns {object} the written receipt
 */
export function writeRedactedReceipt({
  classification,
  sourceInventory,
  targetInventory,
  outputPath,
  runStart = new Date(),
  runEnd = new Date(),
}) {
  // Build a digest of the combined private inventory metadata (not the bytes)
  const metaHash = createHash('sha256');
  for (const [key, rec] of sourceInventory) {
    metaHash.update(`source:${key}:${rec.size ?? ''}:${rec.sha256 ?? ''}`);
  }
  for (const [key, rec] of targetInventory) {
    metaHash.update(`target:${key}:${rec.size ?? ''}:${rec.sha256 ?? ''}`);
  }
  const inventoryDigest = metaHash.digest('hex');

  const totals = {};
  for (const cls of Object.values(CLASSIFICATIONS)) {
    totals[cls] = 0;
  }
  for (const [, entry] of classification.classified) {
    if (totals[entry.classification] !== undefined) {
      totals[entry.classification] += 1;
    }
  }

  const receipt = {
    schema: 'cambium.cloudflare-r2-inventory-receipt.v1',
    version: 1,
    runStart: runStart.toISOString(),
    runEnd: runEnd.toISOString(),
    scopes: APPROVED_PREFIXES.map((p) => ({
      binding: p.binding,
      bucket: p.bucket,
      prefix: p.prefix,
    })),
    sourceObjectCount: sourceInventory.size,
    targetObjectCount: targetInventory.size,
    inventoryDigest,
    classificationTotals: totals,
    unresolvedCount: classification.unresolved.length,
  };

  writeFileSync(outputPath, JSON.stringify(receipt, null, 2) + '\n', 'utf-8');
  return receipt;
}

// ---------------------------------------------------------------------------
// CLI entry point (Phase 9 Task 2+ activates with real auth; Task 1 is
// library + tests only and this CLI is a no-op placeholder)
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  console.log(
    JSON.stringify({
      status: 'phase-9-task-1-placeholder',
      message: 'Collector library ready. Authenticate and invoke with --run for live inventory.',
      approvedPrefixes: APPROVED_PREFIXES.length,
    }),
  );
}
