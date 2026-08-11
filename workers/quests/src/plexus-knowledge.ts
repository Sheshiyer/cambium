import type { ContextProviderMetadata, RoutineContextItem, RoutineContextLike, RoutineContextSection } from './context-routes.ts';

interface GatewayDocument { title?: unknown; path?: unknown; fileSha?: unknown; excerpt?: unknown; }
interface GatewayResponse { ok?: unknown; data?: { repository?: unknown; commit?: unknown; documents?: unknown } }
export interface CreatePlexusRoutineContextArgs { url?: string; token?: string; fetchImpl?: typeof fetch; }
const SHA = /^[a-f0-9]{40}$/i;
function text(value: unknown, limit: number): string { return String(value ?? '').replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]').replace(/\s+/g, ' ').trim().slice(0, limit); }
function blocked(reason: string): RoutineContextSection { return { id: 'github-knowledge', title: 'Company knowledge', items: [{ title: 'No verified knowledge signal', summary: `Blocked/no-signal: ${text(reason, 500)}`, signalState: 'blocked-no-signal' }], signalState: 'blocked-no-signal', exactKeyCount: 0, resolvedKeyCount: 0, missingKeyCount: 0 }; }
export function createPlexusRoutineContext({ url, token, fetchImpl = fetch }: CreatePlexusRoutineContextArgs = {}): RoutineContextLike {
  const configured = Boolean(url?.startsWith('https://') && token);
  const metadata: ContextProviderMetadata = { provider: 'plexus-github-app-gateway', source: 'github-private-repository', index: 'thoughtseed-labs', plane: 'github-knowledge-plane', mode: configured ? 'gateway-read' : 'not-configured' };
  return { async getSnapshot({ routine }) {
    // Preserve the established empty, fail-closed surface until the dedicated
    // gateway credential is provisioned; callers get no synthetic knowledge.
    if (!configured || !url || !token) return { sections: [], metadata };
    let response: Response;
    try { const target = new URL(url); target.searchParams.set('routine', routine); response = await fetchImpl(target, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } }); } catch { return { sections: [blocked('Plexus knowledge gateway is unavailable.')], metadata: { ...metadata, mode: 'source-unavailable' } }; }
    if (!response.ok) return { sections: [blocked('Plexus did not authorize or resolve the requested knowledge routine.')], metadata: { ...metadata, mode: 'source-unavailable' } };
    let payload: GatewayResponse; try { payload = await response.json() as GatewayResponse; } catch { return { sections: [blocked('Plexus knowledge gateway returned an invalid response.')], metadata: { ...metadata, mode: 'source-unavailable' } }; }
    const data = payload.ok === true ? payload.data : undefined;
    const repository = typeof data?.repository === 'string' ? data.repository : ''; const commit = typeof data?.commit === 'string' && SHA.test(data.commit) ? data.commit : '';
    if (!repository || !commit || !Array.isArray(data?.documents)) return { sections: [blocked('Plexus knowledge gateway returned unverified provenance.')], metadata: { ...metadata, mode: 'source-unavailable' } };
    const items: RoutineContextItem[] = data.documents.slice(0, 8).flatMap((value) => { const d = value as GatewayDocument; const title = text(d.title, 160); const path = typeof d.path === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$/.test(d.path) && !d.path.includes('..') ? d.path : ''; const fileSha = typeof d.fileSha === 'string' && SHA.test(d.fileSha) ? d.fileSha : ''; const summary = text(d.excerpt, 4000); return title && path && fileSha && summary ? [{ title, summary, sourceKey: `github://${repository}/${path}@${fileSha}`, signalState: 'current' as const }] : []; });
    const section: RoutineContextSection = { id: 'github-knowledge', title: 'Company knowledge', items: items.length ? items : [blocked('No approved knowledge source returned a readable excerpt.').items[0]], signalState: items.length ? 'current' : 'blocked-no-signal', exactKeyCount: data.documents.length, resolvedKeyCount: items.length, missingKeyCount: Math.max(0, data.documents.length - items.length) };
    return { sections: [section], metadata: { ...metadata, source: `github:${repository}@${commit}` } };
  } };
}
