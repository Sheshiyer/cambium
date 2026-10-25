import type { GateProposal } from './gate-folio.ts';
export interface GateDecisionReceipt {
  proposalId:string; tenantId:string; version:number; changeDigest:string; nonce:string; expiresAt:string;
  founderId:string; decision:'approved'|'rejected'; decidedAt:string; channel:'curious'|'telegram'|'plugin'|null;
}
export interface GateRecordedDecision {
  schema:'cambium.gate-recorded-decision.v1'; canonicalReadback:true; receiptDigest:string;
  requestedDecision:'approved'|'rejected'|null; receipt:GateDecisionReceipt; context:GateProposal|null;
}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const digest=(v:unknown):v is string=>typeof v==='string'&&/^(?:sha256:)?[a-f0-9]{64}$/.test(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=1000;
/** Validate typed canonical data. A success-looking message never becomes a record. */
export function normalizeGateDecision(value:unknown):GateRecordedDecision|null {
 if(!record(value)||value.schema!=='cambium.gate-recorded-decision.v1'||value.canonicalReadback!==true
  ||!digest(value.receiptDigest)||(value.requestedDecision!==null&&value.requestedDecision!=='approved'&&value.requestedDecision!=='rejected')||!record(value.receipt))return null;
 const r=value.receipt;
 if(!text(r.tenantId)||!digest(r.changeDigest)||r.proposalId!==`${r.tenantId}:${r.changeDigest}`
  ||!Number.isSafeInteger(r.version)||Number(r.version)<1||!text(r.nonce)||!text(r.founderId)
  ||!text(r.expiresAt)||!Number.isFinite(Date.parse(r.expiresAt))||!text(r.decidedAt)||!Number.isFinite(Date.parse(r.decidedAt))
  ||(r.decision!=='approved'&&r.decision!=='rejected')||(r.channel!==null&&r.channel!=='curious'&&r.channel!=='telegram'&&r.channel!=='plugin'))return null;
 let context:GateProposal|null=null;
 if(value.context!==null){
  if(!record(value.context)||value.context.changeDigest!==r.changeDigest||value.context.approvalExpiresAt!==r.expiresAt
   ||typeof value.context.canonicalReview!=='string'||value.context.canonicalReview.length===0||value.context.canonicalReview.length>1_000_000)return null;
  try{const p=JSON.parse(value.context.canonicalReview);if(p.proposalId!==r.proposalId||p.version!==r.version||p.changeDigest!==r.changeDigest||p.nonce!==r.nonce||p.expiresAt!==r.expiresAt
   ||!p.review||p.review.nodeId!==value.context.nodeId||p.review.tenantId!==r.tenantId
   ||p.review.changeDigest!==r.changeDigest||p.review.approvalNonce!==r.nonce||p.review.approvalExpiresAt!==r.expiresAt
   ||!p.review.founderInspect||p.review.founderInspect.consistent!==true
   ||p.review.founderInspect.changeDigest!==r.changeDigest||p.review.founderInspect.nodeId!==value.context.nodeId)return null;}catch{return null;}
  context=JSON.parse(JSON.stringify(value.context)) as GateProposal;
  context.canApprove=false;context.canReject=false;context.canRenew=false;context.signing=false;
 }
 return {schema:'cambium.gate-recorded-decision.v1',canonicalReadback:true,receiptDigest:value.receiptDigest,requestedDecision:value.requestedDecision as GateRecordedDecision['requestedDecision'],receipt:{...r} as unknown as GateDecisionReceipt,context};
}
