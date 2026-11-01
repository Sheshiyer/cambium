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
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { resolveQuestsWranglerProfile } from './quests-wrangler-profile.mjs';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(MODULE_DIR, '..');
export const RESOURCE_MAP_PATH = join(
  REPOSITORY_ROOT,
  'docs/architecture/contracts/cambium-cloudflare-resource-map.v1.json',
);

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

export const INVENTORY_OPERATIONS = Object.freeze(['list', 'head', 'get']);

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
// Preflight — resource-map + profile resolution, no remote R2 calls
// ---------------------------------------------------------------------------

/**
 * Load and validate the checked-in Cloudflare resource map against the
 * hard-coded approved prefix table used by the collector.
 *
 * @param {string} [resourceMapPath]
 * @returns {object}
 */
export function loadResourceMap(resourceMapPath = RESOURCE_MAP_PATH) {
  const map = JSON.parse(readFileSync(resourceMapPath, 'utf8'));
  if (map.schema !== 'cambium.cloudflare-resource-map.v1') {
    throw new Error('unexpected_resource_map_schema');
  }
  if (!Array.isArray(map.reconciliation?.approved_prefixes)) {
    throw new Error('resource_map_missing_approved_prefixes');
  }

  for (const expected of APPROVED_PREFIXES) {
    if (!map.reconciliation.approved_prefixes.includes(expected.prefix)) {
      throw new Error(`resource_map_missing_prefix_${expected.binding.toLowerCase()}`);
    }
    const productionBucket = map.production?.r2?.[expected.binding]?.bucket;
    const legacyBucket = map.legacy_source?.r2?.[expected.binding]?.bucket;
    if (productionBucket !== expected.bucket) {
      throw new Error(`resource_map_production_bucket_mismatch_${expected.binding.toLowerCase()}`);
    }
    if (legacyBucket !== expected.bucket) {
      throw new Error(`resource_map_legacy_bucket_mismatch_${expected.binding.toLowerCase()}`);
    }
  }

  return map;
}

function summarizeProfile(resolved) {
  return {
    profile: resolved.profile,
    wranglerProfile: resolved.wranglerProfile,
    config: resolved.config,
    accountId: resolved.accountId,
    workerName: resolved.workerName,
    route: resolved.route,
    accessTeamDomain: resolved.accessTeamDomain,
    sourceMode: resolved.sourceMode,
    allowedOperations: [...resolved.allowedOperations],
  };
}

/**
 * Build the non-secret Phase 9 inventory preflight from the resource map and
 * fail-closed profile resolver. Performs no rclone, Wrangler remote, or R2
 * network calls and never inspects credentials.
 *
 * @param {object} [options]
 * @param {string} [options.resourceMapPath]
 * @param {(args: { profile: string, operation: string }) => object} [options.resolveProfile]
 * @param {string} [options.preparedAt]
 * @returns {object}
 */
export function buildInventoryPreflight({
  resourceMapPath = RESOURCE_MAP_PATH,
  resolveProfile = resolveQuestsWranglerProfile,
  preparedAt = new Date().toISOString(),
} = {}) {
  const map = loadResourceMap(resourceMapPath);
  const legacySource = resolveProfile({ profile: 'legacy-source', operation: 'read' });
  const labsProduction = resolveProfile({ profile: 'labs-production', operation: 'read' });

  if (legacySource.accountId !== map.legacy_source.account_id) {
    throw new Error('legacy_account_mismatch');
  }
  if (labsProduction.accountId !== map.production.account_id) {
    throw new Error('labs_account_mismatch');
  }
  if (legacySource.wranglerProfile !== map.legacy_source.profile) {
    throw new Error('legacy_profile_mismatch');
  }
  if (labsProduction.wranglerProfile !== map.production.profile) {
    throw new Error('labs_profile_mismatch');
  }

  const scopes = [];
  for (const prefix of APPROVED_PREFIXES) {
    for (const side of [
      {
        role: 'legacy-source',
        profile: legacySource,
        strategy: map.legacy_source.r2[prefix.binding].strategy,
      },
      {
        role: 'labs-production',
        profile: labsProduction,
        strategy: map.production.r2[prefix.binding].strategy,
      },
    ]) {
      scopes.push({
        role: side.role,
        profileAlias: side.profile.profile,
        wranglerProfile: side.profile.wranglerProfile,
        accountId: side.profile.accountId,
        config: side.profile.config,
        binding: prefix.binding,
        bucket: prefix.bucket,
        prefix: prefix.prefix,
        r2Strategy: side.strategy,
        permittedOperations: [...INVENTORY_OPERATIONS],
      });
    }
  }

  if (scopes.length !== 4) {
    throw new Error('expected_four_inventory_scopes');
  }

  return {
    schema: 'cambium.cloudflare-r2-inventory-preflight.v1',
    version: 1,
    status: 'preflight-ready-awaiting-owner-read-authorization',
    preparedAt,
    resourceMap: {
      path: 'docs/architecture/contracts/cambium-cloudflare-resource-map.v1.json',
      schema: map.schema,
      tenant: map.tenant,
    },
    reconciliation: {
      approvedPrefixes: [...map.reconciliation.approved_prefixes],
      matched: map.reconciliation.matched,
      targetNewer: map.reconciliation.target_newer,
      sourceOnly: map.reconciliation.source_only,
      digestConflict: map.reconciliation.digest_conflict,
      bulkCopy: map.reconciliation.bulk_copy,
    },
    profiles: {
      'legacy-source': summarizeProfile(legacySource),
      'labs-production': summarizeProfile(labsProduction),
    },
    inventoryOperations: [...INVENTORY_OPERATIONS],
    scopes,
    requirements: {
      'INV-01': 'held',
      'CLASS-01': 'held',
    },
    authorization: {
      requiredDecision: 'approve-scoped-read',
      artifactSchema: 'cambium.phase9.owner-read-authorization.v1',
      artifactPath:
        '.planning/phases/09-source-inventory-and-classification/09-01-OWNER-AUTHORIZATION.json',
      note: 'This preflight is not inventory authorization and performs no authenticated R2 reads.',
    },
    exclusions: [
      'no-object-copy',
      'no-object-delete',
      'no-worker-deploy',
      'no-dns-access-tunnel-mutation',
      'no-d1-kv-vectorize-mutation',
      'no-bucket-root-listing',
      'no-unapproved-prefix',
    ],
  };
}

/**
 * Write a durable preflight JSON document.
 *
 * @param {object} options
 * @param {object} [options.preflight]
 * @param {string} options.outputPath
 * @returns {object}
 */
export function writeInventoryPreflight({
  preflight = buildInventoryPreflight(),
  outputPath,
}) {
  if (!outputPath) throw new Error('missing_output_path');
  writeFileSync(outputPath, `${JSON.stringify(preflight, null, 2)}\n`, 'utf8');
  return preflight;
}

function scopeKey(scope) {
  return [
    scope.role,
    scope.profileAlias,
    scope.wranglerProfile,
    scope.accountId,
    scope.binding,
    scope.bucket,
    scope.prefix,
  ].join('|');
}

/**
 * Validate a one-run owner authorization artifact against the current
 * resource-map/profile preflight. Affirmative decisions only.
 *
 * @param {object} options
 * @param {string|object} options.authorization
 * @param {object} [options.preflight]
 * @returns {object} normalized authorization
 */
export function validateOwnerAuthorization({
  authorization,
  preflight = buildInventoryPreflight(),
}) {
  const auth =
    typeof authorization === 'string'
      ? JSON.parse(readFileSync(authorization, 'utf8'))
      : authorization;

  if (!auth || typeof auth !== 'object') throw new Error('authorization_missing');
  if (auth.schema !== 'cambium.phase9.owner-read-authorization.v1') {
    throw new Error('authorization_schema_mismatch');
  }
  if (auth.decision !== 'approve-scoped-read') {
    throw new Error('authorization_not_affirmative');
  }
  if (auth.scope !== 'one-run') throw new Error('authorization_scope_mismatch');
  if (!Array.isArray(auth.inventoryOperations) || auth.inventoryOperations.length !== 3) {
    throw new Error('authorization_operations_mismatch');
  }
  for (const operation of INVENTORY_OPERATIONS) {
    if (!auth.inventoryOperations.includes(operation)) {
      throw new Error('authorization_operations_mismatch');
    }
  }
  if (!Array.isArray(auth.scopes) || auth.scopes.length !== 4) {
    throw new Error('authorization_scope_count_mismatch');
  }

  const expected = new Map(preflight.scopes.map((scope) => [scopeKey(scope), scope]));
  for (const scope of auth.scopes) {
    const key = scopeKey(scope);
    if (!expected.has(key)) throw new Error('authorization_scope_mismatch');
    expected.delete(key);
  }
  if (expected.size !== 0) throw new Error('authorization_scope_incomplete');

  return auth;
}

/**
 * Probe whether local tooling can attempt authenticated R2 reads.
 * Never prints secrets or redacted rclone config bodies.
 *
 * @param {object} [options]
 * @param {(command: string) => boolean} [options.hasCommand]
 * @returns {{ ready: boolean, blocker?: string, tools: object }}
 */
export function probeRuntimeAuthAvailability({
  hasCommand = (command) => {
    const result = spawnSync('bash', ['-lc', `command -v ${command}`], {
      encoding: 'utf8',
    });
    return result.status === 0 && Boolean(result.stdout?.trim());
  },
} = {}) {
  const tools = {
    rclone: hasCommand('rclone'),
    r2Crypt: hasCommand('r2-crypt'),
    wrangler: hasCommand('wrangler'),
  };

  if (!tools.rclone && !tools.r2Crypt && !tools.wrangler) {
    return {
      ready: false,
      blocker: 'runtime_auth_unavailable',
      tools,
    };
  }

  // Presence of a CLI binary is not runtime auth proof; a later successful
  // exact-prefix read is required. This probe only clears the hard-missing
  // tooling case so --run can fail closed before constructing remote calls.
  return {
    ready: true,
    tools,
  };
}

/**
 * Execute the authorized inventory run gate. Validates owner authorization,
 * refuses repository-path private dirs, and fails closed when runtime auth
 * tooling is unavailable. Does not invent a success receipt from a blocker.
 *
 * @param {object} options
 * @param {string} options.ownerAuthorizationPath
 * @param {string} options.privateDir
 * @param {string} [options.summaryPath]
 * @param {object} [options.preflight]
 * @param {typeof probeRuntimeAuthAvailability} [options.probeRuntime]
 * @returns {object}
 */
export function executeAuthorizedInventoryRun({
  ownerAuthorizationPath,
  privateDir,
  summaryPath,
  preflight = buildInventoryPreflight(),
  probeRuntime = probeRuntimeAuthAvailability,
}) {
  if (!ownerAuthorizationPath) throw new Error('owner_authorization_required');
  if (!privateDir) throw new Error('private_dir_required');

  const resolvedPrivate = resolve(privateDir);
  const resolvedRepo = resolve(REPOSITORY_ROOT);
  if (
    resolvedPrivate === resolvedRepo
    || resolvedPrivate.startsWith(`${resolvedRepo}/`)
  ) {
    throw new Error('private_dir_inside_repository');
  }

  const authorization = validateOwnerAuthorization({
    authorization: ownerAuthorizationPath,
    preflight,
  });

  const runtime = probeRuntime();
  const runStart = new Date().toISOString();

  if (!runtime.ready) {
    const held = {
      schema: 'cambium.cloudflare-r2-inventory-receipt.v1',
      version: 1,
      status: 'held',
      blocker: runtime.blocker || 'runtime_auth_unavailable',
      runStart,
      runEnd: new Date().toISOString(),
      authorizedScopes: authorization.scopes.length,
      inventoryOperations: [...authorization.inventoryOperations],
      requirements: {
        'INV-01': 'held',
        'CLASS-01': 'held',
      },
      message:
        'Owner authorization accepted. Authenticated inventory blocked because local runtime auth tooling is unavailable.',
      toolsPresent: runtime.tools,
    };
    if (summaryPath) {
      writeFileSync(summaryPath, `${JSON.stringify(held, null, 2)}\n`, 'utf8');
    }
    return held;
  }

  return {
    schema: 'cambium.cloudflare-r2-inventory-receipt.v1',
    version: 1,
    status: 'blocked',
    blocker: 'live_transport_not_wired',
    runStart,
    runEnd: new Date().toISOString(),
    authorizedScopes: authorization.scopes.length,
    requirements: {
      'INV-01': 'held',
      'CLASS-01': 'held',
    },
    message:
      'Owner authorization and runtime tooling probe passed, but live rclone/Worker transport is not wired in this checkout yet.',
    toolsPresent: runtime.tools,
  };
}

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
// CLI entry point
// --preflight writes/prints resource-map scope preparation (no remote calls)
// --run remains blocked until owner authorization exists (Task 2+)
// ---------------------------------------------------------------------------

function parseCliArgs(argv) {
  const values = {
    preflight: false,
    run: false,
    output: null,
    ownerAuthorization: null,
    privateDir: null,
    summary: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--preflight') {
      values.preflight = true;
      continue;
    }
    if (flag === '--run') {
      values.run = true;
      continue;
    }
    if (flag === '--output' && index + 1 < argv.length) {
      values.output = argv[index + 1];
      index += 1;
      continue;
    }
    if (flag === '--owner-authorization' && index + 1 < argv.length) {
      values.ownerAuthorization = argv[index + 1];
      index += 1;
      continue;
    }
    if (flag === '--private-dir' && index + 1 < argv.length) {
      values.privateDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (flag === '--summary' && index + 1 < argv.length) {
      values.summary = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`unknown_flag:${flag}`);
  }
  return values;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    if (args.run) {
      if (!args.ownerAuthorization) {
        console.log(
          JSON.stringify({
            status: 'blocked',
            reason: 'owner_read_authorization_required',
            message:
              'Authenticated --run requires --owner-authorization with approve-scoped-read.',
          }),
        );
        process.exitCode = 2;
      } else {
        const result = executeAuthorizedInventoryRun({
          ownerAuthorizationPath: resolve(args.ownerAuthorization),
          privateDir: args.privateDir || '',
          summaryPath: args.summary ? resolve(args.summary) : undefined,
        });
        console.log(
          JSON.stringify({
            status: result.status,
            blocker: result.blocker || null,
            authorizedScopes: result.authorizedScopes,
            requirements: result.requirements,
          }),
        );
        if (result.status !== 'success') process.exitCode = 2;
      }
    } else if (args.preflight) {
      const outputPath =
        args.output ||
        join(
          REPOSITORY_ROOT,
          'docs/evidence/cambium-cloudflare-r2-inventory-phase-9-preflight.v1.json',
        );
      const preflight = writeInventoryPreflight({ outputPath });
      console.log(
        JSON.stringify({
          status: preflight.status,
          outputPath: outputPath.replace(`${REPOSITORY_ROOT}/`, ''),
          scopeCount: preflight.scopes.length,
          inventoryOperations: preflight.inventoryOperations,
          requirements: preflight.requirements,
        }),
      );
    } else {
      console.log(
        JSON.stringify({
          status: 'phase-9-collector-ready',
          message:
            'Collector library ready. Run --preflight to materialize infra scopes; --run requires owner authorization.',
          approvedPrefixes: APPROVED_PREFIXES.length,
        }),
      );
    }
  } catch (error) {
    console.error(`status=blocked reason=${error.message}`);
    process.exitCode = 1;
  }
}
