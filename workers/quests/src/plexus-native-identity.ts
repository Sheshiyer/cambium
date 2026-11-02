// Narrow TeamForge/Plexus identity authority for the Cambium native session.
//
// This adapter deliberately does not reuse /v1/whoami. The native session
// needs a current, tenant-scoped role/enrollment check on every sensitive
// transition, while /v1/whoami is an Access/browser session projection.

const IDENTITY_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,239}$/;
const TENANT_ID = /^[a-z][a-z0-9-]{1,63}$/;
const WORKSPACE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const PLEXUS_NATIVE_IDENTITY_CONTRACT = 'plexus.native-identity.v1' as const;

export interface PlexusNativeIdentity {
  contractVersion: typeof PLEXUS_NATIVE_IDENTITY_CONTRACT;
  identityId: string;
  tenantId: string;
  workspaceId: string;
  role: 'admin' | 'employee';
  active: true;
  enrolled: true;
}

export interface PlexusNativeIdentityAuthority {
  lookup(identityId: string): Promise<PlexusNativeIdentity | null>;
  currentRole(founderId: string): Promise<string | null>;
  enrolledTenants(founderId: string): Promise<readonly string[] | null>;
}

export interface PlexusNativeIdentityConfig {
  /** Exact HTTPS base path, e.g. https://plexus-api.../v1/native/identity. */
  url?: string;
  /** Dedicated TeamForge bearer; never the app or internal operator secret. */
  token?: string;
  /** Cambium tenant whose explicit workspace enrollment is being checked. */
  tenantId?: string;
  fetchImpl?: typeof fetch;
}

function validBaseUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    const path = url.pathname.replace(/\/+$/, '');
    if (!path) return null;
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseContract(value: unknown): PlexusNativeIdentity | null {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.data)) return null;
  const data = value.data;
  if (data.contractVersion !== PLEXUS_NATIVE_IDENTITY_CONTRACT
      || typeof data.identityId !== 'string' || !IDENTITY_ID.test(data.identityId)
      || typeof data.tenantId !== 'string' || !TENANT_ID.test(data.tenantId)
      || typeof data.workspaceId !== 'string' || !WORKSPACE_ID.test(data.workspaceId)
      || (data.role !== 'admin' && data.role !== 'employee')
      || data.active !== true || data.enrolled !== true) return null;
  return {
    contractVersion: PLEXUS_NATIVE_IDENTITY_CONTRACT,
    identityId: data.identityId,
    tenantId: data.tenantId,
    workspaceId: data.workspaceId,
    role: data.role,
    active: true,
    enrolled: true,
  };
}

/**
 * Build a fail-closed authority. Invalid or incomplete config returns
 * undefined so createNativeSessionHost keeps the native routes unbound.
 */
export function createPlexusNativeIdentityAuthority(
  config: PlexusNativeIdentityConfig | undefined,
): PlexusNativeIdentityAuthority | undefined {
  const baseUrl = validBaseUrl(config?.url);
  const token = config?.token?.trim();
  const tenantId = config?.tenantId?.trim();
  if (!baseUrl || !token || !tenantId || !TENANT_ID.test(tenantId)) return undefined;
  const fetchImpl = config?.fetchImpl ?? fetch;

  const lookup = async (identityId: string): Promise<PlexusNativeIdentity | null> => {
    if (!IDENTITY_ID.test(identityId)) return null;
    const endpoint = new URL(`${baseUrl}/${encodeURIComponent(identityId)}`);
    endpoint.searchParams.set('tenant_id', tenantId);
    let response: Response;
    try {
      response = await fetchImpl(endpoint.toString(), {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json',
          'cache-control': 'no-store',
        },
      });
    } catch {
      throw new Error('plexus_native_identity_unavailable');
    }
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('plexus_native_identity_unavailable');
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error('plexus_native_identity_invalid_response');
    }
    const parsed = parseContract(payload);
    if (!parsed || parsed.identityId !== identityId || parsed.tenantId !== tenantId) {
      throw new Error('plexus_native_identity_invalid_response');
    }
    return parsed;
  };

  return {
    lookup,
    async currentRole(founderId) {
      const identity = await lookup(founderId);
      return identity?.active && identity.enrolled && identity.role === 'admin' ? 'founder' : null;
    },
    async enrolledTenants(founderId) {
      const identity = await lookup(founderId);
      return identity?.active && identity.enrolled ? [tenantId] : [];
    },
  };
}
