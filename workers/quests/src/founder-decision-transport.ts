import { validFounderRenewalInput, type FounderRenewalInput } from './founder-renewal.ts';
import { founderDecision, founderConfirmation } from './founder-decision.ts';
import type { FounderContext, FounderDecision, FounderDecisionDeps } from './founder-decision.ts';

const inputSchema = {
  type: 'object', additionalProperties: false,
  required: ['proposalId','version','changeDigest','nonce','expiresAt','decision','confirmation'],
  properties: { proposalId: {type:'string'}, version: {type:'integer',minimum:1}, changeDigest: {type:'string'},
    nonce: {type:'string'}, expiresAt: {type:'string'}, decision: {type:'string',enum:['approved','rejected']}, confirmation: {type:'string'} },
};
export const FOUNDER_DECISION_TOOLS = [
  { inputSchema, name: 'decide_founder_proposal', description: 'Record one exact informed founder decision in the canonical ledger.' },
  { inputSchema, name: 'get_founder_proposal_decision', description: 'Read the canonical founder decision; never writes.' },
] as const;
export interface FounderTransportHost extends Omit<FounderDecisionDeps, 'authenticate'> {
  /** Verify request credentials and resolve server-owned founder/tenant binding. No dev fallback. */
  authenticateRequest(request: Request): Promise<FounderContext | null>;
  readProposal(id: string, renewal?: boolean): ReturnType<FounderDecisionDeps['readProposal']>;
  renewProposal?(input: FounderRenewalInput): Promise<Record<string, unknown>>;
}
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
/** Canonical proposal review, decision and status routes. No binding means closed. */
export async function founderDecisionHttp(request: Request, host?: FounderTransportHost): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (!['/v1/founder/proposal', '/v1/founder/decision', '/v1/founder/status', '/v1/founder/renew'].includes(path)) return reply(404, { error: 'not_found' });
  if (!host) return reply(503, { error: 'founder_host_unconfigured', message: 'Configure verified Access/Plexus identity, explicit founder/tenant bindings and the D1 proposal host before using Founder Gate.' });
  if (request.method !== 'POST') return reply(405, { error: 'post_required' });
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return reply(415, { error: 'json_required' });
  const body = await request.clone().text();
  if (new TextEncoder().encode(body).length > 8192) return reply(413, { error: 'input_too_large' });
  let input: FounderDecision;
  try { input = JSON.parse(body); } catch { return reply(400, { error: 'invalid_json' }); }
  try {
    if (path.endsWith('/renew')) {
      if (!validFounderRenewalInput(input)) return reply(400, { status: 'invalid', writerAuthority: false });
      const context = await host.authenticateRequest(request);
      if (!context) return reply(401, { status: 'unauthorized', writerAuthority: false });
      if (!host.renewProposal) return reply(503, { status: 'unknown', writerAuthority: false });
      const result = await host.renewProposal(input);
      return reply(['renewed','duplicate'].includes(String(result.status)) ? 200 : result.status === 'forbidden' ? 403 : result.status === 'unknown' ? 503 : 409, result);
    }
    if (path.endsWith('/proposal')) {
      if (!input || typeof input !== 'object' || Array.isArray(input)
          || Object.keys(input).length !== 1 || typeof input.proposalId !== 'string') return reply(400, { status: 'invalid' });
      const context = await host.authenticateRequest(request);
      if (!context) return reply(401, { status: 'unauthorized' });
      const p = await host.readProposal(input.proposalId, true);
      if (!p || p.id !== input.proposalId || p.tenantId !== context.tenantId || p.founderId !== context.founderId) return reply(403, { status: 'forbidden' });
      return reply(200, { status: 'review', proposal: { proposalId: p.id, tenantId: p.tenantId, version: p.version,
        changeDigest: p.changeSet.changeDigest, nonce: p.nonce, expiresAt: p.expiresAt, summary: p.summary, review: p.review },
        approveConfirmation: founderConfirmation(p, 'approved'), rejectConfirmation: founderConfirmation(p, 'rejected'), writerAuthority: false });
    }
    const result = await founderDecision({ ...host, authenticate: () => host.authenticateRequest(request) }, input, path.endsWith('/status'));
    const status = result.status === 'unauthorized' ? 401 : result.status === 'forbidden' ? 403
      : result.status === 'unknown' ? 503 : ['approved','rejected','pending'].includes(result.status) ? 200 : 409;
    return reply(status, result);
  } catch { return reply(503, { status: 'unknown', retry: 'status_only' }); }
}
/** MCP caller identity comes from the host request, never from tool arguments or a shared bearer alone. */
export async function founderDecisionTool(name: string, args: unknown, request: Request, host?: FounderTransportHost) {
  if (!FOUNDER_DECISION_TOOLS.some(tool => tool.name === name)) return reply(404, { error: 'unknown_tool' });
  return founderDecisionHttp(new Request(new URL(name === 'decide_founder_proposal' ? '/v1/founder/decision' : '/v1/founder/status', request.url), {
    method: 'POST', headers: { ...Object.fromEntries(request.headers), 'content-type': 'application/json' }, body: JSON.stringify(args),
  }), host);
}
