// Cambium operator · tenancy — the ADVERSARIAL isolation suite (M3/C4, issue #23).
// The wave gate for multi-tenancy: prove that NO event, vector, deviation, contract,
// or setpoint move leaks across tenants — and that the identity contract rejects
// invented ids (TeamForge slug discipline, vault CLAUDE.md anti-drift rule 1).
// This file's existence is also what flips quest arc VII's isolation evidence.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  validateTenantId, TenantIdError, registerTenant, loadRegistry, listTenants,
  getTenant, requireTenant, ensureRegistry, worldPath, contractPath, deviationsPath,
} from './tenant.ts';
import { createWorld } from './world.ts';
import { wake } from './operator.ts';
import { sqliteCortex } from './cortex-sqlite.ts';
import { tenantScopedStore } from './cortex-memory.ts';
import { localTransport, makeCortex } from '../lib/cortex.mjs';
import type { GameEvent } from './types.ts';

function tmpRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'cambium-m3-'));
  mkdirSync(join(root, '.operator'), { recursive: true });
  return root;
}

function seedWorld(root: string, tenant: string): void {
  writeFileSync(
    worldPath(root, tenant),
    JSON.stringify(createWorld({
      tenant, vision: `${tenant} vision`,
      brand: { setpoint: [0, 0], label: `${tenant} label`, trustRegion: 0.25, coherence: 0.7 },
      business: { runwayDays: 120 },
    })),
  );
}

// ── C1 · identity contract ───────────────────────────────────────────────

test('tenancy · slug rule accepts TeamForge-style ids', () => {
  for (const ok of ['cambium', 'thoughtseed', 'heyzack-x', 'a1', 'park-area-2']) {
    assert.equal(validateTenantId(ok), ok);
  }
});

test('tenancy · uppercase, spaces, and malformed ids are rejected citing the rule', () => {
  for (const bad of ['Cambium', 'two words', 'UPPER', '-edge', 'edge-', 'a--b', '']) {
    assert.throws(() => validateTenantId(bad), (e: Error) => {
      assert.ok(e instanceof TenantIdError);
      assert.match(e.message, /TeamForge slug rule/);
      assert.match(e.message, /NEVER invented/);
      return true;
    }, `expected rejection: "${bad}"`);
  }
});

test('tenancy · registry round-trip: register / list / get', () => {
  const root = tmpRoot();
  seedWorld(root, 'venture-a');
  registerTenant(root, { id: 'venture-a', vision: 'v', mission: 'm' });
  assert.deepEqual(listTenants(root), ['venture-a']);
  assert.equal(getTenant(root, 'venture-a')?.vision, 'v');
  assert.equal(loadRegistry(root)[0].createdAt.length > 0, true);
});

test('tenancy · an INVENTED id (no world, no allowNew) is rejected', () => {
  const root = tmpRoot();
  assert.throws(
    () => registerTenant(root, { id: 'made-up-venture', vision: '', mission: '' }),
    /not from thin air/,
  );
  assert.throws(() => requireTenant(root, 'made-up-venture'), /not in the registry/);
});

test('tenancy · duplicate registration is rejected', () => {
  const root = tmpRoot();
  seedWorld(root, 'venture-a');
  registerTenant(root, { id: 'venture-a', vision: '', mission: '' });
  assert.throws(() => registerTenant(root, { id: 'venture-a', vision: '', mission: '' }), /already registered/);
});

test('tenancy · ensureRegistry derives from real worlds and skips smoke artifacts', () => {
  const root = tmpRoot();
  seedWorld(root, 'venture-a');
  seedWorld(root, 'venture-b');
  writeFileSync(join(root, '.operator', '_vsmoke.world.json'), '{}');
  const derived = ensureRegistry(root);
  assert.deepEqual(derived.map((t) => t.id).sort(), ['venture-a', 'venture-b']);
  assert.ok(!listTenants(root).includes('_vsmoke'));
});

// ── C2 · no cross-tenant bleed (worlds · setpoints · vectors · contracts · deviations) ──

test('isolation · waking tenant A never touches tenant B world (versions + setpoint)', () => {
  const root = tmpRoot();
  seedWorld(root, 'venture-a');
  seedWorld(root, 'venture-b');
  const before = readFileSync(worldPath(root, 'venture-b'), 'utf8');

  const a = JSON.parse(readFileSync(worldPath(root, 'venture-a'), 'utf8'));
  const moves: GameEvent[] = [
    { id: 't1', kind: 'tweak', artifact: { id: 'cta', text: 'go' } },
    { id: 'r1', kind: 'reposition', direction: [0.2, 0.1], evidence: true },
  ];
  let world = a;
  for (const event of moves) ({ world } = wake(world, event, { record: () => {} }));
  writeFileSync(worldPath(root, 'venture-a'), JSON.stringify(world));

  assert.equal(world.version, 2);
  assert.notDeepEqual(world.brand.setpoint, [0, 0], 'A setpoint moved');
  assert.equal(readFileSync(worldPath(root, 'venture-b'), 'utf8'), before, 'B byte-identical');
});

test('isolation · two tenants wake independently — versions diverge (C3 acceptance)', () => {
  const root = tmpRoot();
  seedWorld(root, 'venture-a');
  seedWorld(root, 'venture-b');
  const load = (t: string) => JSON.parse(readFileSync(worldPath(root, t), 'utf8'));
  const save = (w: any) => writeFileSync(worldPath(root, w.tenant), JSON.stringify(w));

  let a = load('venture-a');
  for (let i = 0; i < 3; i++) ({ world: a } = wake(a, { id: `a${i}`, kind: 'tweak' }, { record: () => {} }));
  save(a);
  let b = load('venture-b');
  ({ world: b } = wake(b, { id: 'b0', kind: 'tweak' }, { record: () => {} }));
  save(b);

  assert.equal(load('venture-a').version, 3);
  assert.equal(load('venture-b').version, 1);
});

test('isolation · cortex vectors: search under A excludes EVERY B record', async () => {
  const store = sqliteCortex({ path: ':memory:' });
  await store.init();
  const A = tenantScopedStore(store, 'venture-a');
  const B = tenantScopedStore(store, 'venture-b');
  const vec = (seed: number) => Array.from({ length: 8 }, (_, i) => Math.sin(seed + i));

  for (let i = 0; i < 5; i++) await A.upsert({ id: `a-${i}`, kind: 'decision', tenant: 'ignored', vector: vec(i), payload: { i }, ts: i });
  for (let i = 0; i < 5; i++) await B.upsert({ id: `b-${i}`, kind: 'decision', tenant: 'ignored', vector: vec(i), payload: { i }, ts: i });

  const hitsA = await A.search(vec(2), 10);
  assert.ok(hitsA.length > 0, 'A sees its own records');
  assert.ok(hitsA.every((h) => h.record.id.startsWith('a-')), 'A ∩ B = ∅ (no b- ids)');
  assert.ok(hitsA.every((h) => h.record.tenant === 'venture-a'), 'wrapper stamped the tenant');

  // adversarial: even asking FOR tenant B through A's view stays in A
  const sneaky = await A.search(vec(2), 10, { tenant: 'venture-b' } as any);
  assert.ok(sneaky.every((h) => h.record.tenant === 'venture-a'), 'filter override is impossible');
});

test('isolation · contracts are path-isolated per tenant', () => {
  const root = tmpRoot();
  const cortexA = makeCortex(localTransport({ root, tenant: 'venture-a' }));
  cortexA.writeContract('venture-a', 'interaction_plan', { motion: 'fluid' });
  assert.ok(existsSync(contractPath(root, 'venture-a', 'interaction_plan')), 'A contract at A path');
  assert.ok(!existsSync(contractPath(root, 'venture-b', 'interaction_plan')), 'B namespace empty');
  const cortexB = makeCortex(localTransport({ root, tenant: 'venture-b' }));
  assert.equal(cortexB.readContract('venture-b', 'interaction_plan'), null, 'B cannot read A through its own namespace');
});

test('isolation · deviations are path-isolated per tenant', () => {
  const root = tmpRoot();
  const cortexA = makeCortex(localTransport({ root, tenant: 'venture-a' }));
  const cortexB = makeCortex(localTransport({ root, tenant: 'venture-b' }));
  cortexA.writeDeviation(JSON.stringify({ stage: 'build', kind: 'error', action: 'reroll' }));
  cortexA.writeDeviation(JSON.stringify({ stage: 'ship', kind: 'error', action: 'hold' }));
  cortexB.writeDeviation(JSON.stringify({ stage: 'ops', kind: 'intent', action: 'absorb' }));

  const aLines = readFileSync(deviationsPath(root, 'venture-a'), 'utf8').trim().split('\n');
  const bLines = readFileSync(deviationsPath(root, 'venture-b'), 'utf8').trim().split('\n');
  assert.equal(aLines.length, 2);
  assert.equal(bLines.length, 1);
  assert.ok(aLines.every((l) => !l.includes('absorb')), 'A ledger has no B lines');
  assert.ok(bLines.every((l) => l.includes('absorb')), 'B ledger is only B');
});

test('isolation · legacy flat contract stays readable (migration fallback)', () => {
  const root = tmpRoot();
  mkdirSync(join(root, 'cortex', 'contracts'), { recursive: true });
  writeFileSync(join(root, 'cortex', 'contracts', 'venture-a.legacy_group.json'), JSON.stringify({ old: true }));
  const cortexA = makeCortex(localTransport({ root, tenant: 'venture-a' }));
  assert.deepEqual(cortexA.readContract('venture-a', 'legacy_group'), { old: true });
});
