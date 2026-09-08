import { createProviderEmbedder } from '../../quests/src/context-bindings.ts';
import type { Env } from './index.ts';

// Must match the producer in bin/operator/embed.ts; a dimension-only replacement is not parity.
const MODEL = 'nvidia/nv-embedqa-e5-v5';
const KINDS = new Set(['decision','evidence','handoff','heartbeat','memory','note','routine','standup','task']);
const error = (code: string) => ({isError:true,content:[{type:'text' as const,text:JSON.stringify({status:'unavailable',code})}]});

export async function recallOperatorMemory(env: Env, args: Record<string, unknown>) {
  const tenant = args.tenant;
  const allowed = (env.CONTEXT_ALLOWED_TENANTS || 'cambium').split(',').map(t=>t.trim());
  if (typeof tenant !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(tenant) || !allowed.includes(tenant)) return error('unauthorized_tenant');
  if (typeof args.query !== 'string' || !args.query.trim() || args.query.length > 1000) return error('invalid_query');
  if (args.kind !== undefined && (typeof args.kind !== 'string' || !KINDS.has(args.kind))) return error('invalid_kind');
  const topK = args.top_k ?? 5;
  if (!Number.isInteger(topK) || Number(topK)<1 || Number(topK)>10) return error('invalid_top_k');
  if (!env.CAMBIUM_CORTEX) return error('operator_index_unavailable');
  if (env.CORTEX_EMBED_MODEL !== MODEL || !env.NVIDIA_API_KEY) return error('operator_embedding_not_configured');
  const embed = createProviderEmbedder({
    provider:{apiKey:env.NVIDIA_API_KEY,baseUrl:'https://integrate.api.nvidia.com/v1'},model:MODEL,
    fetchImpl:((url,init)=>fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(8000)})) as typeof fetch,
  });
  if (!embed) return error('operator_embedding_not_configured');
  try {
    const vector = await embed(args.query);
    if (vector.length !== 1024 || !vector.every(Number.isFinite) || vector.every(v=>v===0)) return error('operator_embedding_contract_mismatch');
    const filter:Record<string,unknown>={tenant:{$eq:tenant}};
    if (args.kind) filter.kind={$eq:args.kind};
    const result = await env.CAMBIUM_CORTEX.query(vector,{topK:Number(topK),returnMetadata:'all',filter});
    // Metadata is evidence from another boundary. Never return raw payloads or trust query filtering alone.
    const matches = (result.matches || []).slice(0,Number(topK)).filter(m=>
      m.metadata?.tenant===tenant && (!args.kind || m.metadata?.kind===args.kind));
    const safeText=(v:unknown)=>typeof v==='string' && !/(?:bearer\s|(?:token|secret|password|api[_-]?key)\s*[:=]|\/(?:Users|home)\/)/i.test(v) ? v.slice(0,240) : undefined;
    const hits=matches.map(m=>({id:safeText(m.id),score:Number.isFinite(m.score)?m.score:0,
      metadata:Object.fromEntries(['tenant','kind','source','path','commit','contentDigest','ingestedAt','ts'].flatMap(k=>{
        const v=m.metadata?.[k];const safe=typeof v==='number' && Number.isFinite(v)?v:safeText(v);
        return safe===undefined?[]:[[k,safe]];
      }))}));
    return {content:[{type:'text' as const,text:JSON.stringify({status:hits.length?'ok':'empty',embedding_model:MODEL,dimensions:1024,hits,mutation_enabled:false})}]};
  } catch { return error('operator_provider_error'); }
}
