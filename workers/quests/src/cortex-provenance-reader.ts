/** Internal read projection of committed D1 authority; caller owns authentication. */
import type { GoalGraphStoreLike } from './goal-graph-store.ts';
import { sha256 } from './goal-graph/identity.ts';

type ReaderStore = Pick<GoalGraphStoreLike, 'readHead' | 'readNodes'>;
const digest = /^sha256:[a-f0-9]{64}$/;
const id = /^goal_[A-Za-z0-9._:-]{1,200}$/;
const reply = (code: string, status: number) => Response.json({ error: code }, { status });

/** Only call after service authentication; authorizedTenants comes from verified policy, never request JSON. */
export async function handleCortexProvenanceRead(request: Request, store: ReaderStore,
  authorizedTenants: ReadonlySet<string>, now = Date.now()): Promise<Response> {
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/read') return reply('not_found', 404);
  if (Number(request.headers.get('content-length') || 0) > 4096) return reply('body_too_large', 413);
  let input: Record<string, unknown>;
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    if (reader) { try { for (;;) { const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 4096) { await reader.cancel(); return reply('body_too_large', 413); }
      chunks.push(part.value);
    } } finally { reader.releaseLock(); } }
    const joined = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(joined);
    input = JSON.parse(raw);
    if (!input || Array.isArray(input) || typeof input !== 'object') return reply('bad_input', 400);
  } catch { return reply('bad_input', 400); }
  if (Object.keys(input).some(k => !['tenant', 'node_kind', 'node_id', 'graph_version', 'max_bytes'].includes(k))) return reply('bad_input', 400);
  if (typeof input.tenant !== 'string' || !/^[a-z][a-z0-9-]{1,63}$/.test(input.tenant)) return reply('bad_tenant', 400);
  if (!authorizedTenants.has(input.tenant)) return reply('unauthorized_tenant', 403);
  // A Goal Graph projection cannot impersonate repository mission/ISA authority.
  if (input.node_kind !== 'd1_task') return reply('unsupported_node_kind', 422);
  if (typeof input.node_id !== 'string' || !id.test(input.node_id) || input.node_id.includes('..') || input.node_id.includes('//')) return reply('bad_node_id', 400);
  const maxBytes = input.max_bytes ?? 16384;
  if (!Number.isInteger(maxBytes) || Number(maxBytes) < 1 || Number(maxBytes) > 65536) return reply('bad_max_bytes', 400);
  if (input.graph_version !== undefined && (typeof input.graph_version !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.graph_version))) return reply('bad_graph_version', 400);
  try {
    const head = await store.readHead(input.tenant);
    if (!head || head.tenantId !== input.tenant) return reply('not_found', 404);
    const nodes = await store.readNodes(input.tenant);
    const after = await store.readHead(input.tenant);
    if (!after || after.tenantId !== input.tenant || after.graphDigest !== head.graphDigest || after.graphVersion !== head.graphVersion) return reply('graph_changed', 409);
    if (input.graph_version !== undefined && input.graph_version !== String(head.graphVersion)) return reply('graph_version_mismatch', 409);
    const node = nodes.find(n => n.nodeId === input.node_id && n.tenantId === input.tenant);
    if (!node || !head.nodeIds.includes(node.nodeId)) return reply('not_found', 404);
    if (!/^[a-f0-9]{64}$/.test(head.graphDigest) || !digest.test(node.sourceDigest) || !Number.isSafeInteger(head.graphVersion) || head.graphVersion < 0
      || !Number.isSafeInteger(node.graphVersion) || node.graphVersion < 0 || node.graphVersion > head.graphVersion || !['draft','active','blocked','paused','retired'].includes(node.status)) return reply('invalid_authority_record', 503);
    // No source prose, arbitrary metadata, owner identity or source paths leave D1.
    const body = { node_id: node.nodeId, status: node.status, graph_version: head.graphVersion,
      graph_digest: head.graphDigest, source_digest: node.sourceDigest };
    if (new TextEncoder().encode(JSON.stringify(body)).length > Number(maxBytes)) return reply('body_too_large', 413);
    const observed = new Date(now).toISOString();
    return Response.json({ schema: 'cambium.provenance_source.v1', tenant: input.tenant, node_kind: 'd1_task', node_id: node.nodeId,
      source_authority: 'd1', source_reference: `d1:goal_graph:${node.nodeId}`, source_version: head.graphDigest,
      graph_version: String(head.graphVersion), observed_at: observed, stale_after: new Date(now + 60_000).toISOString(),
      content_digest: `sha256:${sha256(body)}`, omissions: [{ field: 'body.details', reason: 'bounded_identity_projection' }], body });
  } catch { return reply('authority_unavailable', 503); }
}
