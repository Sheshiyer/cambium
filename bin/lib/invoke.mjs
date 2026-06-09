// Cambium — the service-invocation layer (I2).
//
// Turns a planned pipeline stage into a REAL call to its organ — fail-closed on spend.
// The conductor calls organs THROUGH this. Nothing here spawns a process: the actual
// spawn is an INJECTED `runner`, so this module is pure/testable and a refused stage
// physically cannot start a process. Constitution #4 (approval-gated risk) lives in gateStage.

import { join } from 'node:path';

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function formatProducerHint(stage, group) {
  const producer = stage?.producerByGroup?.[group];
  return producer
    ? `"${group}" should have been produced by upstream stage "${producer}"`
    : `"${group}" must be seeded before stage "${stage?.id || '<stage>'}"`;
}

/**
 * Validate that a stage received every required variable group. Pure + fail-closed.
 * A legacy scalar payload still satisfies a single required group so genesis-style
 * callers that pass one blob/string keep working until they need structured groups.
 */
export function validateStageContract(stage, payload) {
  const required = Array.isArray(stage?.requires) ? stage.requires.filter(Boolean) : [];
  if (!required.length) return payload;
  const isObjectPayload = payload != null && typeof payload === 'object' && !Array.isArray(payload);
  const missing = required.filter((group) => {
    if (isObjectPayload) return !hasOwn(payload, group);
    return !(required.length === 1 && payload != null && payload !== '');
  });
  if (!missing.length) return payload;
  const hints = missing.map((group) => formatProducerHint(stage, group));
  throw new Error(
    `missing required variable groups: ${missing.join(', ')}${hints.length ? `. ${hints.join('; ')}` : ''}`,
  );
}

function seedContractState(stages, adapters, seedInput) {
  if (seedInput != null && typeof seedInput === 'object' && !Array.isArray(seedInput)) {
    return { ...seedInput };
  }
  const first = stages?.[0];
  const required = Array.isArray(first?.requires) ? first.requires.filter(Boolean) : [];
  const initial = seedInput == null || seedInput === ''
    ? adapters?.[first?.organ]?.input_default
    : seedInput;
  if (initial == null || initial === '') return {};
  if (stages?.length === 1 && required.length) {
    return Object.fromEntries(required.map((group) => [group, initial]));
  }
  if (required.length === 1) {
    return { [required[0]]: initial };
  }
  return {};
}

/**
 * Resolve an organ id → the local repo path its command runs in.
 *   1. CAMBIUM_ORGAN_ROOTS env (JSON map keyed by organ id OR repo basename) — the reliable override
 *   2. sibling-dir convention: <cambiumRoot>/../<repo-basename>
 */
export function resolveRoot(organId, { registry, adapters, cambiumRoot, env = {} } = {}) {
  const adapter = adapters?.[organId];
  if (!adapter) throw new Error(`no adapter for organ "${organId}"`);
  const repo = registry?.organs?.[adapter.root_id]?.repo;
  if (!repo) throw new Error(`unknown root organ "${adapter.root_id}" for adapter "${organId}"`);
  const base = repo.split('/').pop();
  let roots = {};
  if (env.CAMBIUM_ORGAN_ROOTS) {
    try { roots = JSON.parse(env.CAMBIUM_ORGAN_ROOTS); } catch { roots = {}; }
  }
  if (roots[organId]) return roots[organId];
  if (roots[base]) return roots[base];
  // adapter.local_dir covers a local dir whose name/casing differs from the repo basename
  // (e.g. repo "skill-clusters" checked out as "Skill-clusters") — required on a case-sensitive FS
  return join(cambiumRoot, '..', adapter.local_dir || base);
}

/**
 * Build the concrete invocation for an adapter. PURE — no spawn, no disk.
 * {tenant} and {input} are substituted; {input} falls back to adapter.input_default.
 */
export function buildInvocation(adapter, { tenant, input, root } = {}) {
  const value = input
    ? (typeof input === 'string' ? input : JSON.stringify(input))
    : adapter.input_default || '';
  const subst = (s) => s.replaceAll('{tenant}', tenant ?? '').replaceAll('{input}', value);
  return {
    cmd: adapter.cmd,
    args: (adapter.args || []).map(subst),
    cwd: root,
    spend: adapter.spend || 'gated',
  };
}

/**
 * The fail-closed spend gate. Decides whether a stage MAY spawn.
 *   - not executing            → never (dry-run default)
 *   - spend: none              → allowed
 *   - spend: gated + approve===organId → allowed
 *   - otherwise                → REFUSED
 */
export function gateStage(organId, adapter, { execute = false, approve = null } = {}) {
  if (!execute) return { allowed: false, dryRun: true, reason: 'dry-run (default) — not executing' };
  const spend = adapter?.spend || 'gated';
  if (spend === 'none') return { allowed: true, reason: 'no-spend stage' };
  // allow-list the spend vocabulary — any UNKNOWN value fails closed (a future
  // tier like "never" must not be spawnable just because it isn't "none")
  if (spend !== 'gated') return { allowed: false, reason: `unknown spend "${spend}" — refused (fail-closed)` };
  if (approve === organId) return { allowed: true, reason: `spend approved for "${organId}"` };
  return { allowed: false, reason: `spend-gated — refused; needs --approve ${organId}` };
}

/**
 * Gate a stage, then (only if allowed) invoke it via the injected `runner`.
 * The runner is the ONLY thing that can spawn — inject a fake in tests so nothing real runs.
 * Returns { organId, invocation, gate, spawned, result? } — never throws on a refusal.
 */
export async function runStage(organId, ctx = {}) {
  if (organId && typeof organId === 'object' && !Array.isArray(organId)) {
    ctx = organId;
    organId = ctx.stage?.organ;
  }
  const {
    registry, adapters, cambiumRoot, env = {}, tenant, input, contractPayload = input,
    execute = false, approve = null, runner,
  } = ctx;
  validateStageContract(ctx.stage, contractPayload);
  const adapter = adapters?.[organId];
  if (!adapter) throw new Error(`no adapter for organ "${organId}"`);
  const root = resolveRoot(organId, { registry, adapters, cambiumRoot, env });
  const invocation = buildInvocation(adapter, { tenant, input, root });
  const gate = gateStage(organId, adapter, { execute, approve });
  if (!gate.allowed) {
    return { organId, invocation, gate, spawned: false };
  }
  if (typeof runner !== 'function') throw new Error('runStage: allowed to run but no runner injected');
  const result = await runner(invocation);
  return { organId, invocation, gate, spawned: true, result };
}

// parse JSON from a stdout blob — tolerant of leading banner/log lines. Pure.
function tryJson(s) {
  try { return JSON.parse(s); } catch { /* not pure JSON — retry from the first bracket */ }
  const i = s.search(/[{[]/);
  if (i >= 0) { try { return JSON.parse(s.slice(i)); } catch { /* give up, fall back to raw */ } }
  return undefined;
}

/**
 * The output a stage hands to the next stage along the pipeline. Pure.
 * Honors the adapter's declared `output` contract: a `json:*` stage hands the parsed
 * JSON payload (compacted) — not its banner/log lines — to the next stage; everything
 * else hands its trimmed stdout.
 */
export function extractOutput(adapter, result) {
  const raw = (result?.stdout ?? '').trim();
  if (adapter?.output?.startsWith('json:')) {
    const parsed = tryJson(raw);
    if (parsed !== undefined) return JSON.stringify(parsed);
  }
  return raw;
}

/**
 * Drift detector at a hand-off seam (the first concrete piece of HOMEOSTASIS.md §5–§7).
 * Does a stage's output satisfy its declared `output` contract? A `json:*` stage must
 * emit parseable JSON; a failure is contract drift. Pure + non-fatal — it surfaces the
 * signal (and is the seam the I4 why-handler will hook). Returns { ok, reason? }.
 */
export function verifyOutput(adapter, result) {
  const raw = (result?.stdout ?? '').trim();
  if (adapter?.output?.startsWith('json:') && tryJson(raw) === undefined) {
    return { ok: false, reason: `contract drift: declares ${adapter.output} but output is not parseable JSON` };
  }
  return { ok: true };
}

/**
 * Run a pipeline of stages, threading each stage's output into the NEXT stage's
 * input (the hand-off). A stage that doesn't spawn (gated/refused/no-adapter) or
 * exits non-zero breaks the chain — the next stage falls back to its input_default.
 * The runner is injected, so this is fully testable and a refused stage cannot spawn.
 * @returns per-stage results: { stage, organId, invocation?, gate?, spawned, result?, inputFrom }
 */
export async function runPipeline({
  stages, registry, adapters, cambiumRoot, env = {},
  tenant, execute = false, approve = null, runner, seedInput = null,
} = {}) {
  const results = [];
  let prev = seedInput; // the hand-off carry: the previous stage's output (or the seed for stage 1)
  let contractState = seedContractState(stages, adapters, seedInput);
  const producerByGroup = {};
  for (const stage of stages) {
    if (!adapters?.[stage.organ]) {
      results.push({ stage: stage.id, organId: stage.organ, adapter: false });
      for (const group of stage.produces || []) producerByGroup[group] = stage.id;
      continue; // no adapter → carry is unchanged
    }
    const inputFrom = prev != null && prev !== '' ? 'prev-stage' : 'default';
    const res = await runStage(stage.organ, {
      registry, adapters, cambiumRoot, env, tenant, input: prev, execute, approve, runner,
      contractPayload: contractState,
      stage: { ...stage, producerByGroup },
    });
    res.stage = stage.id;
    res.inputFrom = inputFrom;
    if (res.spawned) res.contract = verifyOutput(adapters[stage.organ], res.result); // drift check at the seam
    results.push(res);
    // only a stage that actually ran AND succeeded feeds the next; else the chain breaks
    prev = res.spawned && res.result && res.result.status === 0
      ? extractOutput(adapters[stage.organ], res.result)
      : null;
    contractState = { ...contractState };
    for (const group of stage.produces || []) contractState[group] = true;
    for (const group of stage.produces || []) producerByGroup[group] = stage.id;
  }
  return results;
}
