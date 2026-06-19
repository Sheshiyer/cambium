// Cambium operator · tenancy — the identity contract (M3/C1, issue #20).
// One operator, many ventures starts with a clean identity contract: tenant ids
// are portable org slugs — kebab-case, lowercase, NEVER minted ad-hoc. The
// registry derives from worlds that already exist
// (registration-from-reality); inventing an id here is a contract violation by design.
// This module is also the single PATH AUTHORITY for per-tenant state (C2 leans on it).

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface Tenant {
  id: string;            // portable org slug — never invented here
  vision: string;
  mission: string;
  brand?: { label: string };
  business?: { runwayDays: number };
  createdAt: string;     // ISO — when the tenant entered the registry
}

/** Portable org slug rule: lowercase kebab — letters/digits, single hyphens, no edges. */
export const TENANT_ID_RULE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export class TenantIdError extends Error {
  constructor(id: string, reason: string) {
    super(
      `invalid tenant id "${id}": ${reason}. ` +
      'Tenant ids follow the portable org slug rule (lowercase kebab-case, e.g. "demo-org") ' +
      'and are NEVER invented ad-hoc — an identity adapter or existing world must mint them first.',
    );
    this.name = 'TenantIdError';
  }
}

export function validateTenantId(id: string): string {
  if (typeof id !== 'string' || id.length === 0) throw new TenantIdError(String(id), 'empty');
  if (id !== id.toLowerCase()) throw new TenantIdError(id, 'uppercase is not slug-legal');
  if (/\s/.test(id)) throw new TenantIdError(id, 'whitespace is not slug-legal');
  if (id.includes('--')) throw new TenantIdError(id, 'double hyphens are not slug-legal');
  if (!TENANT_ID_RULE.test(id)) throw new TenantIdError(id, 'fails the slug pattern');
  return id;
}

// ── Path authority (C2 leans on these — ONE place derives tenant paths) ──

export const registryPath = (root: string): string => join(root, '.operator', 'tenants.json');
export const worldPath = (root: string, tenant: string): string =>
  join(root, '.operator', `${validateTenantId(tenant)}.world.json`);
export const onboardingPath = (root: string, tenant: string): string =>
  join(root, '.operator', `${validateTenantId(tenant)}.onboarding.json`);
export const skillsPath = (root: string, tenant: string): string =>
  join(root, '.operator', `${validateTenantId(tenant)}.skills.json`);
export const cortexDir = (root: string, tenant: string): string =>
  join(root, 'cortex', validateTenantId(tenant));
export const contractPath = (root: string, tenant: string, group: string): string =>
  join(cortexDir(root, tenant), 'contracts', `${group}.json`);
export const deviationsPath = (root: string, tenant: string): string =>
  join(cortexDir(root, tenant), 'deviations.jsonl');

// ── Registry ──────────────────────────────────────────────────────────────

export function loadRegistry(root: string): Tenant[] {
  const p = registryPath(root);
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, 'utf8')) as Tenant[];
}

function saveRegistry(root: string, tenants: Tenant[]): void {
  mkdirSync(join(root, '.operator'), { recursive: true });
  writeFileSync(registryPath(root), JSON.stringify(tenants, null, 2));
}

export function listTenants(root: string): string[] {
  return loadRegistry(root).map((t) => t.id);
}

export function getTenant(root: string, id: string): Tenant | null {
  validateTenantId(id);
  return loadRegistry(root).find((t) => t.id === id) ?? null;
}

/** Register a tenant. The id must be slug-legal AND must correspond to a world that
 *  exists on disk unless `allowNew` is set by a caller that minted the slug through an identity adapter. */
export function registerTenant(
  root: string,
  tenant: Omit<Tenant, 'createdAt'> & { createdAt?: string },
  opts: { allowNew?: boolean } = {},
): Tenant {
  validateTenantId(tenant.id);
  const registry = loadRegistry(root);
  if (registry.some((t) => t.id === tenant.id)) {
    throw new TenantIdError(tenant.id, 'already registered');
  }
  if (!opts.allowNew && !existsSync(worldPath(root, tenant.id))) {
    throw new TenantIdError(
      tenant.id,
      'no world exists for this id and allowNew was not set — ids come from an identity adapter, not from thin air',
    );
  }
  const entry: Tenant = { createdAt: new Date().toISOString(), ...tenant } as Tenant;
  registry.push(entry);
  saveRegistry(root, registry);
  return entry;
}

/** Validate against the registry: id must be slug-legal AND registered. */
export function requireTenant(root: string, id: string): Tenant {
  const tenant = getTenant(root, id);
  if (!tenant) {
    throw new TenantIdError(id, 'not in the registry (.operator/tenants.json) — register from a real world first');
  }
  return tenant;
}

/** Registration-from-reality: derive the registry from worlds that already exist on
 *  disk (skips _-prefixed smoke artifacts). Never invents — only records what is. */
export function ensureRegistry(root: string): Tenant[] {
  const existing = loadRegistry(root);
  if (existing.length > 0) return existing;
  const opDir = join(root, '.operator');
  if (!existsSync(opDir)) return [];
  const derived: Tenant[] = [];
  for (const file of readdirSync(opDir)) {
    const m = file.match(/^(.+)\.world\.json$/);
    if (!m || m[1].startsWith('_')) continue;
    try {
      validateTenantId(m[1]);
      const w = JSON.parse(readFileSync(join(opDir, file), 'utf8'));
      derived.push({
        id: m[1],
        vision: w.vision ?? '',
        mission: w.mission ?? 'pursue the vision now',
        brand: w.brand?.label ? { label: w.brand.label } : undefined,
        business: w.business?.runwayDays ? { runwayDays: w.business.runwayDays } : undefined,
        createdAt: new Date().toISOString(),
      });
    } catch { /* non-slug or unreadable world — not a tenant */ }
  }
  if (derived.length > 0) saveRegistry(root, derived);
  return derived;
}
