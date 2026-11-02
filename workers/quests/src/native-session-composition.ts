// Native session composition for the quests handler.
//
// The session factory stays explicit and absent by default: nothing here reads
// env, wrangler, or a secret. Callers pass a reviewed NativeSessionHost. A
// native bearer is resolved only for the routes this packet owns (session,
// founder gate, mission fabric, launch). Every other path that presents the
// native realm is refused before any browser or Telegram lookup.

import {
  NATIVE_SESSION_PATHS,
  resolveNativeSession,
  type NativeSessionHost,
  type NativeSessionResolution,
  type NativeSessionScope,
} from './native-session.ts';
import { NATIVE_LAUNCH_PATHS, type NativeLaunchHost, type NativeLaunchScope } from './native-launch.ts';

export const NATIVE_SESSION_ROUTES: ReadonlySet<string> = new Set(Object.values(NATIVE_SESSION_PATHS));
export const NATIVE_COMPOSED_ROUTES: ReadonlySet<string> = new Set([
  ...NATIVE_SESSION_ROUTES,
  ...Object.values(NATIVE_LAUNCH_PATHS),
  '/v1/founder/proposal',
  '/v1/founder/decision',
  '/v1/founder/status',
  '/v1/founder/renew',
]);

const NATIVE_REALM = /\b(?:cns1|cnc1)_/;

export interface NativeRequestParts {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
}

/** True when Authorization claims the native credential realm. */
export function nativeRealmPresented(headers: Record<string, string>): boolean {
  return NATIVE_REALM.test(headers.authorization ?? '');
}

/** Mission fabric GET for one exact tenant, or null. */
export function nativeMissionFabricTenant(path: string): string | null {
  const match = /^\/v1\/mission-fabric\/([a-z][a-z0-9-]{1,63})$/.exec(path.split('?')[0]);
  return match ? match[1] : null;
}

export function nativeComposedPath(path: string): boolean {
  const route = path.split('?')[0];
  return NATIVE_COMPOSED_ROUTES.has(route) || nativeMissionFabricTenant(route) !== null;
}

/**
 * Request URL for a native route. The host header is authoritative only when
 * it is the reviewed owner origin. A missing or different host is refused
 * before the session store is read. The Origin header is copied and never
 * used as identity.
 */
export function nativeRequestUrl(
  req: NativeRequestParts,
  ownerOrigin: string | undefined,
): { url: string } | { error: 'invalid_request' } {
  const route = req.path.split('?')[0];
  const query = req.path.includes('?') ? req.path.slice(req.path.indexOf('?')) : '';
  if (!ownerOrigin) return { error: 'invalid_request' };
  let owner: URL;
  try { owner = new URL(ownerOrigin); } catch { return { error: 'invalid_request' }; }
  const host = (req.headers.host ?? '').trim().toLowerCase();
  if (!host || host !== owner.host.toLowerCase()) return { error: 'invalid_request' };
  return { url: `${owner.origin}${route}${query}` };
}

export function nativeWebRequest(req: NativeRequestParts, url: string): Request {
  return new Request(url, {
    method: req.method,
    headers: req.headers,
    ...(req.body !== undefined && req.method !== 'GET' && req.method !== 'HEAD' ? { body: req.body } : {}),
  });
}

/** Copy status, no-store/referrer headers and a redirect Location. */
export async function nativeHttpResponse(response: Response): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => { headers[key] = value; });
  return { status: response.status, headers, body: await response.text() };
}

/** Browser, Plexus and Telegram credential aliases that the session resolver does not list itself. */
export function nativeMixedAlias(headers: Record<string, string>): boolean {
  return ['telegram-init-data', 'x-telegram-init-data', 'cf-access-jwt-assertion', 'x-principal', 'x-cambium-founder-web']
    .some(name => (headers[name] ?? '').trim() !== '') || /(?:^|;\s*)CF_Authorization=/.test(headers.cookie ?? '');
}

export async function resolveComposedNativeSession(
  req: NativeRequestParts,
  host: NativeSessionHost | undefined,
): Promise<NativeSessionResolution | { kind: 'refused'; status: number; error: 'invalid_request' | 'mixed_credentials' }> {
  if (!host) return { kind: 'refused', response: nativeUnavailable('native_session_unconfigured') };
  if (nativeMixedAlias(req.headers)) return { kind: 'refused', status: 400, error: 'mixed_credentials' };
  const built = nativeRequestUrl(req, host.deps.ownerOrigin);
  if ('error' in built) return { kind: 'refused', status: 400, error: 'invalid_request' };
  return resolveNativeSession(nativeWebRequest(req, built.url), host);
}

function nativeUnavailable(error: 'native_session_unconfigured'): Response {
  return new Response(JSON.stringify({ contractVersion: 'cambium.native-session.v1', error }), {
    status: 503,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', pragma: 'no-cache', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' },
  });
}

/** Launch verifier: native bearer only. Non-native callers keep the host verifier. */
export function composeNativeLaunchHost(
  launch: NativeLaunchHost | undefined,
  session: NativeSessionHost | undefined,
): NativeLaunchHost | undefined {
  if (!launch) return undefined;
  return {
    ...launch,
    verify: async (request: Request): Promise<NativeLaunchScope | null> => {
      const authorization = request.headers.get('authorization') ?? '';
      if (!NATIVE_REALM.test(authorization)) return launch.verify(request);
      if (!session) return null;
      if (nativeMixedAlias(Object.fromEntries(request.headers))) return null;
      const resolved = await resolveNativeSession(request, session);
      if (resolved.kind !== 'native') return null;
      return { tenantId: resolved.scope.tenantId, principalId: resolved.scope.founderId };
    },
  };
}

export function nativeFounderBinding(scope: NativeSessionScope): string {
  return JSON.stringify([{ founderId: scope.founderId, tenantId: scope.tenantId }]);
}

