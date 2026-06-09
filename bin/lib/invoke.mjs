// Cambium — the service-invocation layer (I2).
//
// Turns a planned pipeline stage into a REAL call to its organ — fail-closed on spend.
// The conductor calls organs THROUGH this. Nothing here spawns a process: the actual
// spawn is an INJECTED `runner`, so this module is pure/testable and a refused stage
// physically cannot start a process. Constitution #4 (approval-gated risk) lives in gateStage.

import { join } from 'node:path';

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
  const value = input || adapter.input_default || '';
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
  const { registry, adapters, cambiumRoot, env = {}, tenant, input, execute = false, approve = null, runner } = ctx;
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
