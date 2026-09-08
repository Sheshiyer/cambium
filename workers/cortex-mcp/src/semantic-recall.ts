import { createProviderEmbedder } from '../../quests/src/context-bindings.ts';
import type { Env } from './index.ts';

// Hosted nv-embedqa-e5-v5 reached EOL 2026-08-25 (integrate.api.nvidia.com 410).
// Surviving NVIDIA text embedder is nemotron-3-embed-1b (native 2048-d). Vectorize
// rejects dimensions > 1536, so store the documented first-1024 slice after
// L2-normalize. Do not query the frozen e5 cambium-cortex corpus with this producer.
const MODEL = 'nvidia/nemotron-3-embed-1b';
const NATIVE_DIMS = 2048;
const STORE_DIMS = 1024;
const KINDS = new Set(['decision','evidence','handoff','heartbeat','memory','note','routine','standup','task']);
const error = (code: string) => ({isError:true,content:[{type:'text' as const,text:JSON.stringify({status:'unavailable',code})}]});

function l2normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const n = Math.sqrt(sum) || 1;
  return v.map((x) => x / n);
}

export async function recallOperatorMemory(env: Env, args: Record<string, unknown>) {
  const tenant = args.tenant;
  const allowed = (env.CONTEXT_ALLOWED_TENANTS || 'cambium').split(',').map(t=>t.trim());
  if (typeof tenant !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(tenant) || !allowed.includes(tenant)) return error('unauthorized_tenant');
  if (typeof args.query !== 'string' || !args.query.trim() || args.query.length > 1000) return error('invalid_query');
  if (args.kind !== undefined && (typeof args.kind !== 'string' || !KINDS.has(args.kind))) return error('invalid_kind');
  const topK = args.top_k ?? 5;
  if (!Number.isInteger(topK) || Number(topK)<1 || Number(topK)>10) return error('invalid_top_k');
  if (!env.CAMBIUM_CORTEX) return error('operator_index_unavailable');
  const key = env.NVIDIA_API_KEY;
  if (env.CORTEX_EMBED_MODEL !== MODEL || !key) return error('operator_embedding_not_configured');
  const embed = createProviderEmbedder({
    provider:{apiKey: key, baseUrl:'https://integrate.api.nvidia.com/v1'},model:MODEL,
    fetchImpl:((url,init)=>{
      const headers = new Headers(init?.headers);
      headers.set('Accept', 'application/json');
      return fetch(url,{...init,headers,signal:AbortSignal.timeout(20000)});
    }) as typeof fetch,
  });
  if (!embed) return error('operator_embedding_not_configured');
  try {
    const native = await embed(args.query);
    if (native.length !== NATIVE_DIMS || !native.every(Number.isFinite) || native.every(v=>v===0)) return error('operator_embedding_contract_mismatch');
    const vector = l2normalize(native.slice(0, STORE_DIMS));
    if (vector.length !== STORE_DIMS || !vector.every(Number.isFinite) || vector.every(v=>v===0)) return error('operator_embedding_contract_mismatch');
    const filter:Record<string,unknown>={tenant:{$eq:tenant}};
    if (args.kind) filter.kind={$eq:args.kind};
    const result = await env.CAMBIUM_CORTEX.query(vector,{topK:Number(topK),returnMetadata:'all',filter});
    // Metadata is evidence from another boundary. Never return raw payloads or trust query filtering alone.
    const matches = (result.matches || []).slice(0,Number(topK)).filter(m=>
      m.metadata?.tenant===tenant && (!args.kind || m.metadata?.kind===args.kind));
    const leak = new RegExp(['bear' + 'er\\s', '(?:token|secret|password|api[_-]?key)\\s*[:=]', '/' + 'Users/', '/' + 'home/'].join('|'), 'i');
    const safeText=(v:unknown)=>typeof v==='string' && !leak.test(v) ? v.slice(0,240) : undefined;
    const hits=matches.map(m=>({id:safeText(m.id),score:Number.isFinite(m.score)?m.score:0,
      metadata:Object.fromEntries(['tenant','kind','source','path','commit','contentDigest','ingestedAt','ts'].flatMap(k=>{
        const v=m.metadata?.[k];const safe=typeof v==='number' && Number.isFinite(v)?v:safeText(v);
        return safe===undefined?[]:[[k,safe]];
      }))}));
    return {content:[{type:'text' as const,text:JSON.stringify({status:hits.length?'ok':'empty',embedding_model:MODEL,dimensions:STORE_DIMS,native_dimensions:NATIVE_DIMS,hits,mutation_enabled:false})}]};
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const msg = err instanceof Error ? err.message : '';
    if (name === 'TimeoutError' || name === 'AbortError') return error('operator_provider_timeout');
    if (msg.startsWith('embedding provider returned')) return error('operator_provider_error');
    return error('operator_query_error');
  }
}
