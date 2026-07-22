import type { StorageLike } from './settings-model.ts';

export interface Principal {
  id: string;
  tenant: string;
  role: 'founder' | 'team' | 'consultant';
  allow: string[];
  createdBy: string;
  expiresAt?: string;
}

export interface Identity {
  principal: Principal;
  via: 'local-founder' | 'invite';
}

export interface RoleBadge {
  label: string;
  tone: string;
}

export const IDENTITY_STORAGE_KEY = 'cambium.identity.v1';

const PRINCIPAL_ROLES: readonly string[] = ['founder', 'team', 'consultant'];
const IDENTITY_VIAS: readonly string[] = ['local-founder', 'invite'];

export interface IdentityStorage extends StorageLike {
  removeItem?(key: string): void;
}

function normalizePrincipal(raw: unknown): Principal | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || !candidate.id) return null;
  if (typeof candidate.tenant !== 'string' || !candidate.tenant) return null;
  if (typeof candidate.role !== 'string' || !PRINCIPAL_ROLES.includes(candidate.role)) return null;
  if (!Array.isArray(candidate.allow) || candidate.allow.some((entry) => typeof entry !== 'string')) return null;
  if (typeof candidate.createdBy !== 'string' || !candidate.createdBy) return null;
  const principal: Principal = {
    id: candidate.id,
    tenant: candidate.tenant,
    role: candidate.role as Principal['role'],
    allow: [...candidate.allow],
    createdBy: candidate.createdBy,
  };
  if (typeof candidate.expiresAt === 'string' && candidate.expiresAt) principal.expiresAt = candidate.expiresAt;
  return principal;
}

export function loadIdentity(storage?: IdentityStorage): Identity | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const principal = normalizePrincipal(parsed.principal);
    if (!principal) return null;
    if (typeof parsed.via !== 'string' || !IDENTITY_VIAS.includes(parsed.via)) return null;
    return { principal, via: parsed.via as Identity['via'] };
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity, storage?: IdentityStorage): void {
  if (!storage) return;
  try {
    storage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    /* storage full or blocked — identity stays in memory */
  }
}

export function clearIdentity(storage?: IdentityStorage): void {
  if (!storage) return;
  try {
    if (typeof storage.removeItem === 'function') storage.removeItem(IDENTITY_STORAGE_KEY);
    else storage.setItem(IDENTITY_STORAGE_KEY, '');
  } catch {
    /* blocked storage — nothing to clear */
  }
}

export function founderIdentity(tenant: string): Identity {
  return {
    principal: {
      id: 'local-founder',
      tenant,
      role: 'founder',
      allow: ['*'],
      createdBy: 'local',
    },
    via: 'local-founder',
  };
}

export function roleBadge(identity: Identity): RoleBadge {
  switch (identity.principal.role) {
    case 'founder':
      return { label: 'FOUNDER · LOCAL', tone: 'signal' };
    case 'team':
      return { label: 'TEAM', tone: 'depth' };
    case 'consultant':
      return { label: 'CONSULTANT · SCOPED', tone: 'mist' };
  }
}

export function identityToPrincipalHeader(identity: Identity): string {
  return JSON.stringify(identity.principal);
}
