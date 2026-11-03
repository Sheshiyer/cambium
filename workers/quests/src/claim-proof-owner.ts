import type { FabricNode, FabricEdge } from './mission-fabric.ts';
import type { GoalGraphNode } from './goal-graph/types.ts';
import { CLAIM_POLICY, CLAIM_POLICY_DIGEST, CLAIM_ACCEPTANCE_SCHEMA, CLAIM_ARTIFACT_INPUT_PATH, CLAIM_FOUNDER_INPUT_PATH, claimAcceptancePolicyHash, claimDigest, canonicalClaimJson, parseClaimProofInput, validateClaimArtifact, type ClaimProofArtifact, type ClaimProofInput } from '../../../shared/iverif-claim-proof.ts';
import type { GoalGraphD1DatabaseLike } from './goal-graph-store.ts';
import type { HandlerDeps } from './handler.ts';
import type { R2BucketLike } from './context-bindings.ts';
import type { NativeLaunchHost, NativeLaunchScope } from './native-launch.ts';
import { d1NativeLaunchStore } from './native-launch-d1.ts';
import { claimInputFromNode, readPinnedDirection } from './direction-execution.ts';
import { sha256 } from './goal-graph/identity.ts';

const artifactKey = (directiveId: string) => `claim-proof/cambium/artifacts/${directiveId}.json`;
const id=/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
type StoredArtifact = {schema:'cambium.iverif.stored-claim-proof.v1';directiveId:string;executionId:string;input:ClaimProofInput;artifact:ClaimProofArtifact;digest:string};
export interface ClaimProofOwner {
  launchHost: NativeLaunchHost;
  admit(scope: NativeLaunchScope, proposalId: string, reauthorize:()=>Promise<boolean>): Promise<{admissionRef:string;workId:string}>;
  verifyDirective(memberId:string,directiveId:string,input:ClaimProofInput):Promise<boolean>;
  result(scope: NativeLaunchScope, admissionRef:string): Promise<Record<string,unknown>>;
  putArtifact(directiveId:string,executionId:string,input:ClaimProofInput,artifact:unknown): Promise<{digest:string;duplicate:boolean}>;
  prepareAcceptance(scope:NativeLaunchScope,admissionRef:string,operationId:string):Promise<Record<string,unknown>>;
  acceptanceProof(proposalId:string):Promise<Record<string,unknown>>;
  acceptancePackage(proposalId:string):Promise<{input:ClaimProofInput;artifact:ClaimProofArtifact;proof:Record<string,unknown>}>;
  recordAcceptance(proposalId:string,envelope:unknown):Promise<{accepted:true;receiptDigest:string;artifactDigest:string}>;
  facts(tenantId:string,nodes:readonly GoalGraphNode[],graphVersion:number):Promise<{nodes:FabricNode[];edges:FabricEdge[];taskStates:Record<string,{status:'complete'|'verifying';receiptId:string}>}>;
  readArtifact(directiveId:string): Promise<StoredArtifact|null>;
}

/** All authority comes from canonical founder decisions and existing durable stores. */
export function createClaimProofOwner(db:GoalGraphD1DatabaseLike,bucket:R2BucketLike,deps:HandlerDeps):ClaimProofOwner {
  const launchStore=d1NativeLaunchStore(db);
  const now=()=>deps.now?.()??new Date().toISOString();
  async function approvedTask(scope:NativeLaunchScope,proposalId:string) {
    if(scope.tenantId!=='cambium'||!/^cambium:(?:sha256:)?[a-f0-9]{64}$/.test(proposalId)||!deps.goalGraphStore?.readDecisionReceipt)throw new Error('approved_task_required');
    const changeDigest=proposalId.slice('cambium:'.length);
    const text=await deps.kv.get(`goal-graph-intake-task:cambium:${changeDigest}`);
    const task=text?JSON.parse(text):null;
    if(!task||task.tenantId!==scope.tenantId||typeof task.approvalNonce!=='string')throw new Error('approved_task_required');
    const decision=await deps.goalGraphStore.readDecisionReceipt(scope.tenantId,changeDigest,task.approvalNonce);
    if(!decision||decision.decision!=='approved'||decision.approver_id!==scope.principalId)throw new Error('approved_task_required');
    return {task,decision,changeDigest};
  }
  async function currentAdmission(scope:NativeLaunchScope,admissionRef:string) {
    if(!/^claim-admission:goal_[a-f0-9]{64}$/.test(admissionRef)||!deps.goalGraphStore)throw new Error('admission_required');
    const nodes=await deps.goalGraphStore.readNodes(scope.tenantId);
    const node=nodes.find(row=>`claim-admission:${row.nodeId}`===admissionRef);
    const input=node?claimInputFromNode(node):null;
    if(!node||!input||node.status!=='active'||node.metadata.executionAdmissionMemberId!==deps.claimProofMemberId)throw new Error('admission_required');
    const pinned=await readPinnedDirection(deps,{tenantId:scope.tenantId,principal:scope.principalId},input.directionId,input.directionRevision);
    if(claimDigest(pinned.direction)!==input.directionDigest)throw new Error('direction_changed');
    return {node,input,head:pinned.head};
  }
  async function readArtifact(directiveId:string):Promise<StoredArtifact|null> {
    if(!id.test(directiveId))throw new Error('invalid_directive');
    const object=await bucket.get(artifactKey(directiveId));if(!object)return null;
    const text=await object.text();if(Buffer.byteLength(text)>CLAIM_POLICY.maxArtifactBytes+8192)throw new Error('artifact_too_large');
    const value:StoredArtifact=JSON.parse(text);
    const input=parseClaimProofInput(value.input);
    if(value.schema!=='cambium.iverif.stored-claim-proof.v1'||value.directiveId!==directiveId||!input||directiveId!==`claim-proof-${claimDigest(input).slice(7,39)}`||!/^exec_[a-f0-9]{32}$/.test(value.executionId)||!validateClaimArtifact(value.artifact,input)||value.digest!==claimDigest(value.artifact))throw new Error('artifact_invalid');
    return value;
  }
  async function acceptanceProof(proposalId:string):Promise<Record<string,unknown>> {
    if(!/^cambium:(?:sha256:)?[a-f0-9]{64}$/.test(proposalId)||!deps.goalGraphStore?.readDecisionReceipt)throw new Error('acceptance_decision_required');
    const changeDigest=proposalId.slice('cambium:'.length),raw=await deps.kv.get(`goal-graph-intake-task:cambium:${changeDigest}`);
    const task=raw?JSON.parse(raw):null;
    if(!task||task.intent?.schema!==CLAIM_ACCEPTANCE_SCHEMA)throw new Error('acceptance_decision_required');
    const decision=await deps.goalGraphStore.readDecisionReceipt('cambium',changeDigest,task.approvalNonce);
    if(!decision||decision.decision!=='approved')throw new Error('acceptance_decision_required');
    const input=parseClaimProofInput(task.intent.input);if(!input)throw new Error('acceptance_input_invalid');
    const nodes=await deps.goalGraphStore.readNodes('cambium'),leaf=nodes.find(node=>node.nodeId===task.nodeId),execution=nodes.find(node=>node.nodeId===task.intent.executionNodeId);
    if(!leaf||leaf.status!=='active'||leaf.namespace!=='founder-claim-acceptance'||leaf.sourceDigest!==task.sourceDigest||!execution||claimDigest(claimInputFromNode(execution))!==claimDigest(input))throw new Error('acceptance_source_changed');
    const reservation=await db.prepare('SELECT input_digest FROM native_launch_requests WHERE tenant_id=? AND principal_id=? AND admission_ref=?')
      .bind('cambium',decision.approver_id,task.intent.admissionRef).first<{input_digest:string}>();
    if(!reservation||reservation.input_digest!==claimDigest(input))throw new Error('acceptance_attempt_mismatch');
    const directiveId=String(execution.metadata.executionAdmissionDirectiveId),artifact=await readArtifact(directiveId);
    const terminal=await db.prepare('SELECT execution_id,attestation_json FROM bridge_executions WHERE member_id=? AND directive_id=? AND input_digest=? AND terminal=1 AND outcome_status=?')
      .bind(deps.claimProofMemberId,directiveId,claimDigest(input),'executed').first<{execution_id:string;attestation_json:string}>();
    if(!artifact||!terminal||terminal.execution_id!==artifact.executionId||artifact.digest!==task.intent.artifactDigest||JSON.parse(terminal.attestation_json).outputDigest!==artifact.digest)throw new Error('acceptance_terminal_proof_required');
    return {schema:'cambium.iverif.founder-acceptance-proof.v1',proposalId,tenantId:'cambium',decision:'approved',changeDigest,nonce:decision.nonce,
      founderDigest:claimDigest(decision.approver_id),decidedAt:decision.decided_at,taskId:input.taskId,goalId:input.goalId,
      executionNodeId:execution.nodeId,inputDigest:claimDigest(input),artifactDigest:artifact.digest,policyDigest:CLAIM_POLICY_DIGEST};
  }
  async function verifyOwnerAcceptance(proposalId:string,envelope:unknown) {
    const proof=await acceptanceProof(proposalId),store=deps.terminalFoldback?.acceptanceStore;
    if(!store)throw new Error('acceptance_owner_unconfigured');
    const verified=await store.verify(envelope),receipt=verified.receipt;
    const hashes=receipt.inputHashes;
    if(!hashes||typeof hashes!=='object'||Array.isArray(hashes))throw new Error('acceptance_input_hashes_required');
    const expected=hashes as Record<string,unknown>;
    if(receipt.binding.workObjectId!=='sapling:iverif'||receipt.binding.taskId!==proof.taskId||receipt.binding.goalId!==proof.goalId
      ||receipt.binding.executionInputDigest!==proof.inputDigest||receipt.policyHash!==claimAcceptancePolicyHash(String(proof.artifactDigest),claimDigest(proof))
      ||expected[CLAIM_ARTIFACT_INPUT_PATH]!==String(proof.artifactDigest).slice(7)||expected[CLAIM_FOUNDER_INPUT_PATH]!==claimDigest(proof).slice(7))throw new Error('acceptance_binding_mismatch');
    return {proof,verified};
  }
  async function acceptedArtifact(artifact:StoredArtifact) {
    const object=await bucket.get(`claim-proof/cambium/acceptance/${artifact.digest.slice(7)}.json`);
    if(!object)return null;
    const raw=JSON.parse(await object.text());
    const value=await verifyOwnerAcceptance(raw.proposalId,raw.envelope);
    if(value.proof.artifactDigest!==artifact.digest||value.proof.inputDigest!==claimDigest(artifact.input))throw new Error('acceptance_artifact_mismatch');
    return value;
  }
  async function resultVerdict(scope:NativeLaunchScope,input:ClaimProofInput,artifactDigest:string) {
    const keys=await deps.kv.list('goal-graph-intake-task:cambium:');
    if(keys.length>256||!deps.goalGraphStore?.readDecisionReceipt)throw new Error('result_verdict_unavailable');
    let latest:{schema:string;proposalId:string;decision:'approved'|'rejected';decidedAt:string;artifactDigest:string;inputDigest:string;canonicalReadback:true}|null=null;
    for(const key of keys) {
      const text=await deps.kv.get(key),task=text?JSON.parse(text):null;
      if(task?.tenantId!==scope.tenantId||task.intent?.schema!==CLAIM_ACCEPTANCE_SCHEMA||task.intent.artifactDigest!==artifactDigest
        ||claimDigest(task.intent.input)!==claimDigest(input)||!task.changeSet||claimDigest(task.intent)!==task.sourceDigest)continue;
      const {changeDigest:_digest,isNoop:_noop,...signedChange}=task.changeSet;
      if(sha256(signedChange)!==String(task.changeDigest).replace(/^sha256:/,'')||task.changeSet.sourceDigest!==task.sourceDigest)continue;
      const decision=await deps.goalGraphStore.readDecisionReceipt(scope.tenantId,task.changeDigest,task.approvalNonce);
      if(!decision||decision.approver_id!==scope.principalId||!['approved','rejected'].includes(decision.decision))continue;
      if(!latest||decision.decided_at>latest.decidedAt)latest={schema:'cambium.iverif.result-verdict.v1',proposalId:`cambium:${task.changeDigest}`,
        decision:decision.decision,decidedAt:decision.decided_at,artifactDigest,inputDigest:claimDigest(input),canonicalReadback:true};
    }
    return latest;
  }
  const owner:ClaimProofOwner={
    launchHost:{verify:async()=>null,store:launchStore,now,
      owner:{supports:(plant,action)=>plant==='hermes-remote'&&action==='launch'&&/^[a-z][a-z0-9-]{1,63}$/.test(deps.claimProofMemberId??'')&&!!deps.bridgeStore&&!!deps.executionStore?.readDirectiveProgress,
        async submit(request) {
          const scope={tenantId:request.tenantId,principalId:request.principalId};
          const {node,input,head}=await currentAdmission(scope,request.capability.admissionRef);
          if(head.graphVersion!==request.capability.graphVersion||claimDigest(input)!==request.capability.inputDigest||request.capability.workId!=='sapling:iverif'||request.capability.loadoutId!==CLAIM_POLICY.loadoutId)throw new Error('admission_pins_changed');
          if(!deps.bridgeStore||!deps.claimProofMemberId)throw new Error('claim_owner_unavailable');
          const directiveId=String(node.metadata.executionAdmissionDirectiveId),idempotencyKey=String(node.metadata.executionAdmissionIdempotencyKey);
          const value={id:directiveId,memberId:deps.claimProofMemberId,tenantId:'thoughtseed',idempotencyKey,
            payload:{type:'native_execution',schema:'thoughtseed.hermes.native_execution.v1',command:CLAIM_POLICY.command,target:{memberId:deps.claimProofMemberId},input},
            expiresAt:request.capability.expiresAt,createdAt:now()};
          await deps.bridgeStore.putDirectiveIfAbsent(deps.claimProofMemberId,directiveId,value);
          const stored=await deps.bridgeStore.getDirective(deps.claimProofMemberId,directiveId);
          if(!stored||stored.idempotencyKey!==idempotencyKey||canonicalClaimJson(stored.payload)!==canonicalClaimJson(value.payload))throw new Error('directive_conflict');
          return {state:'queued',ownerRef:directiveId};
        },
        async read(scope) {
          const row=await db.prepare('SELECT admission_ref FROM native_launch_requests WHERE request_key = ? AND tenant_id = ? AND principal_id = ?')
            .bind(scope.requestKey,scope.tenantId,scope.principalId).first<{admission_ref:string}>();
          if(!row||!deps.goalGraphStore||!deps.claimProofMemberId)return {state:'not_found'};
          const nodes=await deps.goalGraphStore.readNodes(scope.tenantId),node=nodes.find(n=>`claim-admission:${n.nodeId}`===row.admission_ref);
          if(!node||!claimInputFromNode(node))return {state:'refused'};
          const directiveId=String(node.metadata.executionAdmissionDirectiveId);
          const progress=await deps.executionStore?.readDirectiveProgress?.(deps.claimProofMemberId,directiveId);
          return {state:progress?.terminal?(progress.outcome==='executed'?'succeeded':'failed'):progress?.claimed?'running':'queued',ownerRef:directiveId};
        }}},
    async verifyDirective(memberId,directiveId,input) {
      if(memberId!==deps.claimProofMemberId)return false;
      const row=await db.prepare(`SELECT a.tenant_id,a.principal_id,a.admission_ref,a.graph_version
        FROM native_launch_admissions a JOIN native_launch_requests r ON r.tenant_id=a.tenant_id AND r.admission_ref=a.admission_ref
        JOIN goal_graph_heads h ON h.tenant_id=a.tenant_id AND h.graph_version=a.graph_version
        WHERE a.work_id='sapling:iverif' AND a.input_digest=? AND a.status='active' AND a.expires_at>?`)
        .bind(claimDigest(input),now()).first<{tenant_id:string;principal_id:string;admission_ref:string;graph_version:number}>();
      if(!row)return false;
      try{const current=await currentAdmission({tenantId:row.tenant_id,principalId:row.principal_id},row.admission_ref);
        return current.head.graphVersion===row.graph_version&&current.node.metadata.executionAdmissionDirectiveId===directiveId&&claimDigest(current.input)===claimDigest(input);
      }catch{return false;}
    },
    async admit(scope,proposalId,reauthorize) {
      const {task,changeDigest}=await approvedTask(scope,proposalId);
      const input=parseClaimProofInput(task.intent?.input);
      if(!input||!deps.claimProofMemberId||!(task.approvalExpiresAt>now()))throw new Error('admission_review_expired_or_invalid');
      const admissionRef=`claim-admission:${task.nodeId}`;
      const pinned=await currentAdmission(scope,admissionRef);
      if(pinned.head.graphVersion!==task.graphVersion||pinned.node.sourceDigest!==task.sourceDigest||claimDigest(input)!==claimDigest(pinned.input))throw new Error('admission_graph_changed');
      const node=pinned.node;
      // Single conditional insert binds the current head, approved source and
      // direction revision; edit triggers and the reservation guard close races.
      if(!await reauthorize())throw new Error('authorization_changed');
      await db.prepare(`INSERT OR IGNORE INTO native_launch_admissions
        (tenant_id,admission_ref,principal_id,work_id,graph_version,loadout_id,input_digest,execution_plant,supported_action,expires_at,status,recorded_at)
        SELECT ?,?,?,?,?,?,?,'hermes-remote','launch',?,'active',? FROM goal_graph_heads h
        JOIN goal_graph_nodes n ON n.tenant_id=h.tenant_id AND n.node_id=?
        JOIN shared_directions d ON d.tenant_id=n.tenant_id AND d.principal_id=? AND d.direction_id=? AND d.revision=?
        WHERE h.tenant_id=? AND h.graph_digest=? AND h.graph_version=? AND n.source_digest=? AND n.status='active'
        AND EXISTS(SELECT 1 FROM goal_graph_approvals a WHERE a.tenant_id=h.tenant_id AND a.change_digest=? AND a.nonce=? AND a.approver_id=? AND a.decision='approved')
        AND NOT EXISTS(SELECT 1 FROM json_each(d.document,'$.signalPins') pin LEFT JOIN shared_signals s
          ON s.tenant_id=d.tenant_id AND s.principal_id=d.principal_id AND s.signal_id=json_extract(pin.value,'$.id')
          WHERE s.signal_id IS NULL OR s.revision<>json_extract(pin.value,'$.revision'))`)
        .bind(scope.tenantId,admissionRef,scope.principalId,'sapling:iverif',pinned.head.graphVersion,CLAIM_POLICY.loadoutId,claimDigest(input),task.approvalExpiresAt,now(),
          node.nodeId,scope.principalId,input.directionId,input.directionRevision,scope.tenantId,pinned.head.graphDigest,pinned.head.graphVersion,node.sourceDigest,
          changeDigest,task.approvalNonce,scope.principalId).run();
      const read=await launchStore.readAdmission(scope,admissionRef,now());
      if(!read||read.hold||read.admission.inputDigest!==claimDigest(input))throw new Error('admission_not_current');
      return {admissionRef,workId:'sapling:iverif'};
    },
    async putArtifact(directiveId,executionId,input,artifact) {
      if(!validateClaimArtifact(artifact,input)||!bucket.put||directiveId!==`claim-proof-${claimDigest(input).slice(7,39)}`||!/^exec_[a-f0-9]{32}$/.test(executionId))throw new Error('invalid_claim_artifact');
      const value:StoredArtifact={schema:'cambium.iverif.stored-claim-proof.v1',directiveId,executionId,input,artifact,digest:claimDigest(artifact)};
      const text=canonicalClaimJson(value),key=artifactKey(directiveId),existing=await bucket.get(key);
      if(existing){if(await existing.text()!==text)throw new Error('claim_artifact_conflict');return {digest:value.digest,duplicate:true};}
      await bucket.put(key,new TextEncoder().encode(text),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}}).catch(()=>null);
      const saved=await bucket.get(key);if(!saved||await saved.text()!==text)throw new Error('claim_artifact_write_unconfirmed');
      return {digest:value.digest,duplicate:false};
    },readArtifact,
    async prepareAcceptance(scope,admissionRef,operationId) {
      const result=await owner.result(scope,admissionRef);
      if(!result.artifact||result.execution!=='succeeded'||!deps.goalGraphStore)throw new Error('result_not_ready');
      const nodes=await deps.goalGraphStore.readNodes(scope.tenantId),execution=nodes.find(node=>`claim-admission:${node.nodeId}`===admissionRef);
      const input=execution?claimInputFromNode(execution):null,head=await deps.goalGraphStore.readHead(scope.tenantId);
      const again=await deps.goalGraphStore.readHead(scope.tenantId);
      if(!execution||!input||!head||!again||head.graphDigest!==again.graphDigest)throw new Error('acceptance_sources_unavailable');
      const artifact=await readArtifact(String(execution.metadata.executionAdmissionDirectiveId));if(!artifact)throw new Error('result_not_ready');
      return {schema:CLAIM_ACCEPTANCE_SCHEMA,version:1,tenantId:scope.tenantId,clientRequestId:operationId,expectedHeadDigest:head.graphDigest,
        executionNodeId:execution.nodeId,admissionRef,artifactDigest:artifact.digest,input};
    },
    acceptanceProof,
    async acceptancePackage(proposalId) {
      const proof=await acceptanceProof(proposalId);
      const nodes=await deps.goalGraphStore!.readNodes('cambium'),node=nodes.find(row=>row.nodeId===proof.executionNodeId);
      const artifact=node?await readArtifact(String(node.metadata.executionAdmissionDirectiveId)):null;
      if(!artifact||artifact.digest!==proof.artifactDigest)throw new Error('acceptance_artifact_unavailable');
      return {input:artifact.input,artifact:artifact.artifact,proof};
    },
    async recordAcceptance(proposalId,envelope) {
      const {proof,verified}=await verifyOwnerAcceptance(proposalId,envelope),store=deps.terminalFoldback!.acceptanceStore!;
      await store.record(verified);
      const key=`claim-proof/cambium/acceptance/${String(proof.artifactDigest).slice(7)}.json`,text=canonicalClaimJson({schema:'cambium.iverif.claim-acceptance-link.v1',proposalId,envelope:verified});
      const existing=await bucket.get(key);
      if(existing&&await existing.text()!==text)throw new Error('acceptance_link_conflict');
      if(!existing){if(!bucket.put)throw new Error('acceptance_store_unavailable');await bucket.put(key,new TextEncoder().encode(text),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}}).catch(()=>null);}
      const read=await bucket.get(key);if(!read||await read.text()!==text)throw new Error('acceptance_link_unconfirmed');
      return {accepted:true,receiptDigest:verified.receiptDigest,artifactDigest:String(proof.artifactDigest)};
    },
    async facts(tenantId,nodes,graphVersion) {
      const output:{nodes:FabricNode[];edges:FabricEdge[];taskStates:Record<string,{status:'complete'|'verifying';receiptId:string}>}={nodes:[],edges:[],taskStates:{}};
      if(tenantId!=='cambium'||!deps.claimProofMemberId)return output;
      for(const node of nodes) {
        const input=claimInputFromNode(node);if(!input)continue;
        const directiveId=String(node.metadata.executionAdmissionDirectiveId),artifact=await readArtifact(directiveId);if(!artifact)continue;
        const execution=await db.prepare('SELECT execution_id,runner_id,claimed_at,outcome_recorded_at,outcome_status,attestation_json FROM bridge_executions WHERE member_id=? AND directive_id=? AND input_digest=? AND terminal=1')
          .bind(deps.claimProofMemberId,directiveId,claimDigest(input)).first<Record<string,unknown>>();
        if(!execution||execution.outcome_status!=='executed'||typeof execution.attestation_json!=='string')continue;
        const attestation=JSON.parse(execution.attestation_json);if(attestation.outputDigest!==artifact.digest||execution.execution_id!==artifact.executionId)continue;
        let accepted=false;try{const receipt=await acceptedArtifact(artifact);accepted=!!receipt&&nodes.some(row=>row.namespace==='founder-claim-acceptance'&&row.metadata.artifactDigest===artifact.digest&&row.status==='active');}catch{accepted=false;}
        const runId=String(execution.execution_id),receiptId=`claim-result:${artifact.digest.slice(7)}`;
        output.nodes.push({kind:'run',value:{runId,taskId:input.taskId,agentId:String(execution.runner_id),loadoutId:CLAIM_POLICY.loadoutId,
          startedAt:String(execution.claimed_at),terminalAt:String(execution.outcome_recorded_at),status:'complete'}},
          {kind:'receipt',value:{receiptId,runId,taskId:input.taskId,graphVersion,status:accepted?'complete':'reconciliation-required',inputDigest:claimDigest(input),outputDigest:artifact.digest,
            evidenceRefs:[artifactKey(directiveId)],approvalRef:accepted?'founder-and-owner-verified':null,createdAt:String(execution.outcome_recorded_at)}});
        output.edges.push({kind:'produces',fromId:runId,toId:receiptId});
        if(accepted)output.edges.push({kind:'proves',fromId:receiptId,toId:input.taskId},{kind:'informs-next-intent',fromId:receiptId,toId:'sapling:iverif'});
        output.taskStates[input.taskId]={status:accepted?'complete':'verifying',receiptId};
      }
      return output;
    },
    async result(scope,admissionRef) {
      if(!deps.goalGraphStore||!deps.claimProofMemberId)throw new Error('claim_result_unavailable');
      const reserved=await db.prepare('SELECT request_id,attempt_id,input_digest FROM native_launch_requests WHERE tenant_id=? AND principal_id=? AND admission_ref=?')
        .bind(scope.tenantId,scope.principalId,admissionRef).first<{request_id:string;attempt_id:string;input_digest:string}>();
      if(!reserved)throw new Error('claim_request_required');
      const nodes=await deps.goalGraphStore.readNodes(scope.tenantId),node=nodes.find(n=>`claim-admission:${n.nodeId}`===admissionRef);
      const input=node?claimInputFromNode(node):null;
      if(!node||!input||claimDigest(input)!==reserved.input_digest)throw new Error('claim_result_binding_changed');
      const directiveId=String(node.metadata.executionAdmissionDirectiveId),artifact=await readArtifact(directiveId);
      const execution=await db.prepare('SELECT execution_id,terminal,outcome_status,attestation_json FROM bridge_executions WHERE member_id=? AND directive_id=? AND input_digest=?')
        .bind(deps.claimProofMemberId,directiveId,reserved.input_digest).first<{execution_id:string;terminal:number;outcome_status:string;attestation_json:string}>();
      const attestation=execution?JSON.parse(execution.attestation_json):null;
      const ready=!!artifact&&execution?.execution_id===artifact.executionId&&execution?.terminal===1&&execution.outcome_status==='executed'&&attestation?.outputDigest===artifact.digest;
      let acceptance='awaiting-founder-and-owner-review';
      let founderVerdict=ready&&artifact?await resultVerdict(scope,input,artifact.digest):null;
      if(founderVerdict)acceptance=founderVerdict.decision==='rejected'?'rejected':'awaiting-owner-review';
      if(ready&&artifact){try{const accepted=await acceptedArtifact(artifact);if(accepted){acceptance='accepted';founderVerdict={schema:'cambium.iverif.result-verdict.v1',proposalId:String(accepted.proof.proposalId),decision:'approved',decidedAt:String(accepted.proof.decidedAt),artifactDigest:artifact.digest,inputDigest:claimDigest(input),canonicalReadback:true};}}catch{acceptance='review-required';}}
      return {schema:'cambium.iverif.claim-result.v1',tenantId:scope.tenantId,workId:'sapling:iverif',admissionRef,
        requestId:reserved.request_id,attemptId:reserved.attempt_id,taskId:input.taskId,inputDigest:reserved.input_digest,
        execution:execution?.terminal?(execution.outcome_status==='executed'?'succeeded':'failed'):execution?'running':'queued',
        artifact:ready&&artifact?{digest:artifact.digest,markdown:artifact.artifact.files['claims.md'],claimCount:JSON.parse(artifact.artifact.files['claims.json']).length,sourceManifestDigest:artifact.input.sourceManifestDigest}:null,acceptance,founderVerdict,policyDigest:CLAIM_POLICY_DIGEST,productPromotion:false};
    },
  };
  return owner;
}
