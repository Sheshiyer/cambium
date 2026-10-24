import { founderDecision } from './founder-decision.ts';
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
}
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
/** Register under /v1/founder/decision and /v1/founder/status. No binding means closed. */
export async function founderDecisionHttp(request: Request, host?: FounderTransportHost): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (!['/v1/founder/decision', '/v1/founder/status'].includes(path)) return reply(404, { error: 'not_found' });
  if (!host) return reply(503, { error: 'founder_host_unconfigured' });
  if (request.method !== 'POST') return reply(405, { error: 'post_required' });
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return reply(415, { error: 'json_required' });
  const body = await request.text();
  if (new TextEncoder().encode(body).length > 8192) return reply(413, { error: 'input_too_large' });
  let input: FounderDecision;
  try { input = JSON.parse(body); } catch { return reply(400, { error: 'invalid_json' }); }
  try {
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
