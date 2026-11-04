import { verifiedDirectionResult } from './direction-execution-owner.ts';
import type { HandlerDeps, SimpleRequest, SimpleResponse } from './handler.ts';
import { resolveComposedNativeSession } from './native-session-composition.ts';
import { makeGoalGraphHead } from './goal-graph/compiler.ts';
import { GOAL_GRAPH_LOADOUT_AUTHORITY } from './goal-graph-loadout-registry.ts';
import { CAMBIUM_CODE_PILOT_PATCH_BASE64, CAMBIUM_CODE_PILOT_BASE, CAMBIUM_CODE_PILOT_PATCH_DIGEST } from './cambium-code-pilot-input.ts';
import { patchDigest, parseCambiumPatchPolicy, type CambiumPatchPolicy } from '../../../shared/cambium-patch-contract.ts';
import { buildDirectionExecutionProposal, directionExecutionTaskReview, validDirectionExecutionRequest, DIRECTION_EXECUTION_INTENT, type DirectionExecutionRequest } from './direction-execution-review.ts';
import type { d1DirectionAdmissionStore } from './direction-execution-d1.ts';

export interface CambiumPilotHost {
  policy: CambiumPatchPolicy;
  runnerMemberId: string;
  admissions: ReturnType<typeof d1DirectionAdmissionStore>;
}
export interface DirectionExecutionCallbacks {
  replay(scope: { tenantId: string; principal: string }, directionId: string, input: DirectionExecutionRequest): Promise<SimpleResponse | null>;
  persist(proposal: ReturnType<typeof buildDirectionExecutionProposal>, input: DirectionExecutionRequest): Promise<SimpleResponse>;
  readTask(tenant: string, digest: string): Promise<Record<string, unknown> | null>;
}
const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' };
const reply = (status: number, body: unknown): SimpleResponse => ({ status, headers: HEADERS, body: JSON.stringify(body) });
const fail = (status: number, error: string) => reply(status, { error, writerAuthority: false, executionGranted: false });
export function isDirectionExecutionRoute(path: string): boolean {
  return /^\/v1\/directions\/[^/]+\/[^/]+\/(?:execution-review|proposal)$/.test(path)
    || /^\/v1\/direction-executions\/[^/]+\/(?:admit|[A-Za-z0-9._:-]+\/result)$/.test(path);
}
/** Policy parsing does not activate a runner or authorize any job. */
export function parseCambiumPilotPolicy(raw: string | undefined): CambiumPatchPolicy | null {
  try {
    const p = parseCambiumPatchPolicy(JSON.parse(raw ?? 'null'));
    return p && p.baseCommit === CAMBIUM_CODE_PILOT_BASE && p.patchDigest === CAMBIUM_CODE_PILOT_PATCH_DIGEST ? p : null;
  } catch { return null; }
}
export async function directionExecutionHttp(req: SimpleRequest, deps: HandlerDeps, callbacks: DirectionExecutionCallbacks): Promise<SimpleResponse> {
  const reviewPath = /^\/v1\/directions\/([a-z][a-z0-9-]{1,63})\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})\/(execution-review|proposal)$/.exec(req.path);
  const admitPath = /^\/v1\/direction-executions\/([a-z][a-z0-9-]{1,63})\/admit$/.exec(req.path);
  const resultPath = /^\/v1\/direction-executions\/([a-z][a-z0-9-]{1,63})\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})\/result$/.exec(req.path);
  if (!reviewPath && !admitPath && !resultPath) return fail(400, 'invalid_request');
  const mode = resultPath ? 'result' : reviewPath?.[3] ?? 'admit', tenant = (reviewPath ?? admitPath ?? resultPath)![1];
  if (req.method !== (mode === 'execution-review' || mode === 'result' ? 'GET' : 'POST')) return fail(405, 'method_not_allowed');
  if (['cookie','x-api-key','x-auth-token','x-access-token','proxy-authorization'].some(key => (req.headers[key] ?? '').trim())) return fail(400, 'mixed_credentials');
  const resolved = await resolveComposedNativeSession(req, deps.nativeSessionHost);
  if (resolved.kind !== 'native') return fail(resolved.kind === 'refused'
    ? ('status' in resolved ? resolved.status : resolved.response.status) : 401, 'native_session_required');
  if (resolved.scope.tenantId !== tenant || tenant !== 'cambium') return fail(403, 'tenant_mismatch');
  const scope = { tenantId: tenant, principal: resolved.scope.founderId };
  const reauthorize = async () => {
    const current = await resolveComposedNativeSession(req, deps.nativeSessionHost);
    return current.kind === 'native' && current.tokenDigest === resolved.tokenDigest
      && current.scope.tenantId === scope.tenantId && current.scope.founderId === scope.principal
      && current.scope.clientId === resolved.scope.clientId;
  };
  if (mode === 'result') {
    if (!deps.directionAdmissionStore || !deps.executionStore?.readTerminalAttestation) return fail(503, 'coding_results_unavailable');
    try {
      const bound = await deps.directionAdmissionStore.readByRequest({tenantId:tenant,principalId:scope.principal},resultPath![2]);
      if (!bound) return fail(404,'coding_request_not_found');
      const review = bound.record.review;
      const attestation = await deps.executionStore.readTerminalAttestation(review.runnerMemberId,review.directiveId);
      const result = attestation ? verifiedDirectionResult(attestation,review) : null;
      if (attestation && (attestation.directiveId !== review.directiveId || attestation.inputDigest !== review.inputDigest
        || attestation.idempotencyKey !== review.idempotencyKey || attestation.command !== 'cambium.patch.verify'
        || (attestation.status === 'executed' && !result))) return fail(503,'coding_result_unconfirmed');
      if (!await reauthorize()) return fail(401,'native_session_required');
      return reply(200,{schema:'cambium.direction-result.v1',...scope,requestId:bound.requestId,attemptId:bound.attemptId,
        directionId:review.direction.id,directionRevision:review.direction.revision,title:review.direction.title,
        workObjectId:'sapling:cambium',inputDigest:review.inputDigest,policyDigest:patchDigest(review.policy),
        state:result?.status ?? (attestation?.status === 'failed' ? 'failed' : 'pending'),
        result,outputDigest:result ? attestation!.outputDigest : null,
        acceptance:'review-required',externalActions:'none'});
    } catch { return fail(503,'coding_result_unconfirmed'); }
  }
  let raw: unknown;
  if (req.method === 'POST') {
    if (!req.body || Buffer.byteLength(req.body, 'utf8') > 4096) return fail(400, 'invalid_request');
    try { raw = JSON.parse(req.body); } catch { return fail(400, 'invalid_request'); }
  }
  if (mode === 'proposal') {
    if (!validDirectionExecutionRequest(raw)) return fail(400, 'invalid_request');
    // Resolve original replies before any source/policy check, never recompile a lost reply.
    try {
      const replay = await callbacks.replay(scope, reviewPath![2], raw);
      if (replay) return replay;
    } catch { return fail(503, 'direction_proposal_unconfirmed'); }
  }
  const pilot = deps.cambiumPilot;
  if (!pilot || !deps.goalGraphStore || !deps.sharedDirectionStore || !deps.sharedSignalStore) return fail(503, 'direction_execution_unconfigured');
  try {
    const graph = deps.goalGraphStore;
    const head = await graph.readHead(tenant), nodes = await graph.readNodes(tenant), again = await graph.readHead(tenant);
    if (!head || !again || head.graphDigest !== again.graphDigest || head.graphVersion !== again.graphVersion
        || makeGoalGraphHead(tenant, nodes, head.graphVersion, head.committedAt).graphDigest !== head.graphDigest) return fail(503, 'graph_read_unconfirmed');
    if (mode === 'admit') {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).sort().join(',') !== 'proposalId,schema'
          || (raw as any).schema !== 'cambium.direction-admit.v1' || typeof (raw as any).proposalId !== 'string') return fail(400, 'invalid_request');
      const match = /^cambium:([a-f0-9]{64})$/.exec((raw as any).proposalId);
      if (!match) return fail(400, 'invalid_request');
      const task = await callbacks.readTask(tenant, match[1]);
      const review = task && directionExecutionTaskReview(task);
      if (!task || !review || review.principal !== scope.principal) return fail(404, 'proposal_not_found');
      if (head.graphVersion !== review.input.approvedGraphVersion || patchDigest(pilot.policy) !== patchDigest(review.policy)) return fail(409, 'approved_sources_changed');
      if (!deps.nativeLaunchHost?.owner.supports('hermes-remote', 'launch')) return fail(503, 'execution_owner_unavailable');
      const result = await pilot.admissions.admit({ scope: { tenantId: tenant, principalId: scope.principal }, task,
        expectedHeadDigest: head.graphDigest, policyDigest: patchDigest(pilot.policy), now: (deps.now ?? (() => new Date().toISOString()))(), authorize: reauthorize });
      if (!result.record) return fail(409, 'admission_sources_changed');
      const available = await deps.nativeLaunchHost.store.readAdmission({ tenantId: tenant, principalId: scope.principal },
        result.record.admissionRef, (deps.now ?? (() => new Date().toISOString()))());
      if (!available) return fail(503, 'admission_read_unconfirmed');
      if (available.hold && available.hold !== 'admission_consumed') return fail(409, 'admission_sources_changed');
      return reply(200, { schema: 'cambium.direction-admission.v1', ...scope, proposalId: (raw as any).proposalId,
        admissionRef: result.record.admissionRef, workObjectId: 'sapling:cambium', expiresAt: result.record.expiresAt,
        status: result.status, launchReady: available.hold === null, consumed: available.hold === 'admission_consumed',
        admissionGranted: true, launched: false });
    }
    const direction = await deps.sharedDirectionStore.read(scope, reviewPath![2]);
    if (!direction) return fail(404, 'direction_not_found');
    const input: DirectionExecutionRequest = mode === 'proposal' ? raw as DirectionExecutionRequest
      : { schema: DIRECTION_EXECUTION_INTENT, operationId: 'read-only-preview', directionRevision: direction.revision,
          expectedHeadDigest: head.graphDigest, policyDigest: patchDigest(pilot.policy) };
    const signals = [];
    for (const pin of direction.signalPins) {
      const signal = await deps.sharedSignalStore.read(scope, pin.id);
      if (!signal) return fail(409, 'signal_changed');
      signals.push(signal);
    }
    const proposed = buildDirectionExecutionProposal({ scope, request: input, direction, signals, head, nodes,
      policy: pilot.policy, patchBase64: CAMBIUM_CODE_PILOT_PATCH_BASE64, runnerMemberId: pilot.runnerMemberId,
      now: (deps.now ?? (() => new Date().toISOString()))(), loadoutAuthority: GOAL_GRAPH_LOADOUT_AUTHORITY });
    if (!await reauthorize()) return fail(403, 'authorization_changed');
    if (mode === 'proposal') return callbacks.persist(proposed, input);
    return reply(200, { schema: 'cambium.direction-execution-preview.v1', ...scope, directionId: direction.id,
      directionRevision: direction.revision, expectedHeadDigest: head.graphDigest, policyDigest: patchDigest(pilot.policy),
      summary: { objective: direction.title, artifact: 'Two-file shared-signal title validation patch and test evidence',
        baseCommit: pilot.policy.baseCommit, patchDigest: pilot.policy.patchDigest, allowedPaths: pilot.policy.allowedPaths,
        check: pilot.policy.testCommand.join(' '), timeoutSeconds: pilot.policy.limits.timeoutSeconds,
        modelPool: pilot.policy.modelPool, acceptance: pilot.policy.acceptance, externalActions: pilot.policy.externalActions },
      writerAuthority: false, executionGranted: false });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (['direction_changed','direction_head_changed','graph_changed','work_join_changed','signal_changed','signal_set_changed','execution_already_proposed'].includes(code)) return fail(409, code);
    if (code === 'authorization_changed') return fail(403, code);
    return fail(503, 'direction_execution_unavailable');
  }
}
