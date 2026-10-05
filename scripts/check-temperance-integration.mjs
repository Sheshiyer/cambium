import { openSync, readSync, closeSync, fstatSync, constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { types } from 'node:util';

const MAX_BYTES = 16384;
const ERROR = 'Invalid Temperance integration contract';
const CONTRACT = {
  schema: 'cambium.temperance-integration.v1',
  product: { repository: 'github.com/Sheshiyer/temperance_engine', required_by_company: false, company_dependency_required: false },
  integration: { repository: 'github.com/Sheshiyer/noesis-cambium', required: false, plant_id: 'thoughtseed-local', configuration_reference: 'integration:thoughtseed.v1' },
  company: { repository: 'github.com/Sheshiyer/cambium', operational_writer: 'd1-goal-graph', acceptance_owner: 'isa', planning_owner: 'gsd', identity_owner: 'plexus', remote_executor: 'hermes' },
  seams: [
    { id: 'admitted-work', from: 'cambium', to: 'noesis-cambium', effect: 'reference-only', requirements: ['work-object', 'signed-gate', 'scope', 'expiry', 'artifact-contract'] },
    { id: 'verified-result', from: 'noesis-cambium', to: 'cambium', effect: 'reference-only', requirements: ['run-lineage', 'artifact-digest', 'independent-verdict', 'owner-readback'] },
    { id: 'learning-proposal', from: 'noesis-cambium', to: 'cambium', effect: 'proposal-only', requirements: ['source-reference', 'freshness', 'confidence', 'review-owner'] },
  ],
  excluded_plants: ['heyzack-hosted', 'snow-gloves-fleet'],
  effects_authorized: false,
};

function invalid() { throw new Error(ERROR); }

// Inspect own data descriptors before copying: getters, exotic prototypes,
// symbols, cycles and oversized objects cannot become owner metadata.
function snapshot(value, seen = new Set(), budget = { nodes: 0, bytes: 0 }, depth = 0) {
  if (++budget.nodes > 256 || depth > 8) invalid();
  if (typeof value === 'string') {
    budget.bytes += Buffer.byteLength(value);
    if (value.length > 256 || budget.bytes > MAX_BYTES) invalid();
    return value;
  }
  if (typeof value === 'boolean') return value;
  if (!value || typeof value !== 'object' || types.isProxy(value) || seen.has(value)) invalid();
  const array = Array.isArray(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) invalid();
  seen.add(value);
  const keys = Reflect.ownKeys(value);
  if (keys.length > 32 || keys.some(key => typeof key !== 'string')) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result = array ? [] : Object.create(null);
  if (array) {
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > 16 || keys.length !== length + 1) invalid();
    for (let i = 0; i < length; i++) {
      const d = descriptors[String(i)];
      if (!d || !Object.hasOwn(d, 'value') || !d.enumerable) invalid();
      result.push(snapshot(d.value, seen, budget, depth + 1));
    }
  } else {
    for (const key of keys) {
      const d = descriptors[key];
      budget.bytes += Buffer.byteLength(key);
      if (key.length > 64 || budget.bytes > MAX_BYTES || !Object.hasOwn(d, 'value') || !d.enumerable) invalid();
      result[key] = snapshot(d.value, seen, budget, depth + 1);
    }
  }
  seen.delete(value);
  return result;
}

function matches(actual, expected) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) invalid();
    // Arrays are finite sets of declared seams, requirements, or exclusions.
    const index = new Map(actual.map(item => [typeof item === 'object' ? item.id : item, item]));
    if (index.size !== expected.length) invalid();
    for (const item of expected) matches(index.get(typeof item === 'object' ? item.id : item), item);
  } else if (expected && typeof expected === 'object') {
    if (!actual || Array.isArray(actual) || typeof actual !== 'object') invalid();
    const keys = Object.keys(expected);
    if (Object.keys(actual).length !== keys.length || keys.some(key => !Object.hasOwn(actual, key))) invalid();
    for (const key of keys) matches(actual[key], expected[key]);
  } else if (actual !== expected) invalid();
}

/** Validate a source declaration only; success never grants admission or effects. */
export function validateTemperanceIntegration(value) {
  try {
    matches(snapshot(value), CONTRACT);
    return JSON.parse(JSON.stringify(CONTRACT));
  } catch { invalid(); }
}

function main() {
  let fd;
  try {
    if (process.argv.length !== 2) invalid();
    const path = fileURLToPath(new URL('../docs/architecture/contracts/temperance-integration.v1.json', import.meta.url));
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_BYTES) invalid();
    // One bounded read also rejects oversized files without loading them fully.
    const bytes = Buffer.alloc(MAX_BYTES + 1);
    let size = 0;
    while (size < bytes.length) {
      const count = readSync(fd, bytes, size, bytes.length - size, null);
      if (!count) break;
      size += count;
    }
    if (size > MAX_BYTES) invalid();
    const normalized = validateTemperanceIntegration(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size))));
    const digest = `sha256:${createHash('sha256').update(JSON.stringify(normalized)).digest('hex')}`;
    process.stdout.write(`${JSON.stringify({ status: 'configuration-only', effects_authorized: false, digest, metadata: normalized })}\n`);
  } catch {
    process.stderr.write(`${JSON.stringify({ status: 'invalid', error: ERROR })}\n`);
    process.exitCode = 2;
  } finally { if (fd !== undefined) closeSync(fd); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
