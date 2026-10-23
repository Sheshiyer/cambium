/** A separate embedding space for redacted Hermes execution receipts. Never legacy fallback. */
import { createProviderEmbedder } from './context-bindings.ts';
import type { EmbeddingProviderConfigLike, VectorizeIndexLike } from './context-bindings.ts';
import type { CortexIngestionDeps } from './cortex-ingestion.ts';
import type { D1DatabaseLike } from './index.ts';

export const HERMES_RECEIPTS_V2_ROUTE = '/v1/context/hermes-receipts';
export const HERMES_RECEIPTS_V2_SPACE = {
  id: 'nvidia-nemotron-3-embed-1b-2048-hermes-receipts-v2',
  provider: 'nvidia',
  model: 'nvidia/nemotron-3-embed-1b',
  dimensions: 2048,
  index: 'cambium-hermes-receipts-v2',
  metric: 'cosine',
} as const;

export function isHermesTerminalReceipt(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const body = input as Record<string,unknown>;
  const allowed = ['schema','tenant','kind','source','path','content','idempotencyKey'];
  if (Object.keys(body).some(key=>!allowed.includes(key))) return false;
  if (body.schema !== 'thoughtseed.cortex-ingestion.v1' || body.tenant !== 'cambium'
    || body.kind !== 'evidence' || body.source !== 'hermes-runner'
    || typeof body.path !== 'string' || !/^executions\/exec_[a-f0-9]{32}$/.test(body.path)) return false;
  return body.idempotencyKey === `hermes:${body.path.slice('executions/'.length)}`;
}

export function createHermesReceiptIngestion(args: {
  enabled?: string; provider?: EmbeddingProviderConfigLike;
  vectorIndex?: VectorizeIndexLike; fetchImpl?: typeof fetch;
}): CortexIngestionDeps | undefined {
  if (args.enabled !== 'true' || (!args.vectorIndex?.upsert || !args.vectorIndex?.getByIds)) return undefined;
  const embed = createProviderEmbedder({provider:args.provider,model:HERMES_RECEIPTS_V2_SPACE.model,
    inputType:'passage',requireModelMatch:true,expectedDimensions:HERMES_RECEIPTS_V2_SPACE.dimensions,fetchImpl:args.fetchImpl});
  if (!embed) return undefined;
  return {embed,vectorIndex:args.vectorIndex,embeddingSpace:HERMES_RECEIPTS_V2_SPACE,verifyWrite:true};
}

/** D1's existing terminal execution is the authority, not caller-supplied prose. */
export function createHermesReceiptAuthorizer(db: D1DatabaseLike): (input: unknown)=>Promise<boolean> {
  return async(input)=>{
    if (!isHermesTerminalReceipt(input)) return false;
    const body=input as Record<string,unknown>;
    const executionId=String(body.path).slice('executions/'.length);
    const row=await db.prepare(`
      SELECT e.member_id, e.runner_id, e.directive_id, e.execution_id, e.terminal, e.outcome_status,
             e.input_digest, e.attestation_json, d.directive_json
      FROM bridge_executions e JOIN bridge_directives d ON d.member_id=e.member_id AND d.id=e.directive_id
      WHERE e.execution_id=? AND e.member_id=? AND e.runner_id=? AND e.terminal=1
    `).bind(executionId,'hermes-runner','hermes-ec2-runner-01').first<Record<string,unknown>>();
    if (!row || row.member_id!=='hermes-runner' || row.runner_id!=='hermes-ec2-runner-01'
      || row.execution_id!==executionId || row.terminal!==1 || !['executed','failed'].includes(String(row.outcome_status))) return false;
    let attestation:Record<string,unknown>,directive:Record<string,any>;
    try {attestation=JSON.parse(String(row.attestation_json));directive=JSON.parse(String(row.directive_json));}
    catch {return false;}
    if (directive.tenantId!=='cambium' || directive.payload?.input?.tenantId!=='cambium'
      || directive.payload?.command!=='growth.request.draft' || directive.payload?.target?.memberId!=='hermes-runner'
      || attestation.command!=='growth.request.draft' || attestation.executionId!==executionId
      || attestation.directiveId!==row.directive_id || attestation.runnerId!==row.runner_id
      || attestation.inputDigest!==row.input_digest || attestation.status!==row.outcome_status) return false;
    const expected=[
      '## Hermes terminal execution',
      `Directive ${row.directive_id} reached terminal status ${attestation.status}.`,
      `Execution ${executionId} was recorded by runner ${row.runner_id}.`,
      `Attestation ${attestation.id} finished at ${attestation.finishedAt}.`,
      `Input digest ${attestation.inputDigest}.`,
      ...(attestation.outputDigest ? [`Output digest ${attestation.outputDigest}.`] : []),
      ...(attestation.errorCode ? [`Bounded error code ${attestation.errorCode}.`] : []),
    ].join('\n\n');
    return body.content===expected;
  };
}
