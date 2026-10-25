import type { GateProposal } from './gate-folio.ts';

export interface MissionDossier {
  verified: boolean;
  scope: 'macro' | 'meso' | 'micro' | 'proof' | null;
  phase: string | null; branch: string | null; organ: string | null;
  owner: string | null; currentState: string | null; desiredState: string | null;
  nextAction: string | null; waitCondition: string | null; proofRequired: boolean | null;
  workObject: { id: string | null; label: string | null; kind: string | null };
  loadout: { id: string | null; label: string | null };
  diff: { created: number; updated: number; removed: number } | null;
  sourceRef: string | null; nodeId: string; changeDigest: string;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): string | null => typeof v === 'string' && v.trim().length > 0 && v.length <= 4000 ? v : null;
const nullableText = (v: unknown): boolean => v === null || text(v) !== null;
const anchor = (v: unknown): string | null => text(v);
function readable(id: string | null): string | null {
  if (!id) return null;
  return id.replace(/^[^:]+:/, '').replace(/[-_:]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
/** A description of the exact reviewed delta, never a claim about live execution. */
export function buildMissionDossier(proposal: GateProposal): MissionDossier {
  const unknown: MissionDossier = {
    verified: false, scope: null, phase: null, branch: null, organ: null, owner: null,
    currentState: null, desiredState: null, nextAction: null, waitCondition: null, proofRequired: null,
    workObject: { id: null, label: null, kind: null }, loadout: { id: null, label: null },
    diff: null, sourceRef: null, nodeId: proposal.nodeId, changeDigest: proposal.changeDigest,
  };
  if (!proposal.canonicalReview || proposal.canonicalReview.length > 1_000_000) return unknown;
  try {
    const p: unknown = JSON.parse(proposal.canonicalReview);
    if (!record(p) || p.changeDigest !== proposal.changeDigest || !record(p.review)
      || !text(p.proposalId) || !Number.isSafeInteger(p.version) || Number(p.version) < 1
      || !text(p.nonce) || p.expiresAt !== proposal.approvalExpiresAt
      || !text(p.expiresAt) || !Number.isFinite(Date.parse(String(p.expiresAt)))) return unknown;
    const r = p.review;
    if (r.schema !== 'cambium.goal-graph-gate-row.v1' || r.kind !== 'goal-graph-intake'
      || r.status !== 'pending' || r.changeDigest !== proposal.changeDigest || r.nodeId !== proposal.nodeId
      || r.approvalNonce !== p.nonce || r.approvalExpiresAt !== p.expiresAt || !record(r.changeSet)) return unknown;
    const c = r.changeSet;
    if (p.proposalId !== `${r.tenantId}:${proposal.changeDigest}`
      || !Number.isSafeInteger(r.graphVersion) || Number(r.graphVersion) < 1
      || r.graphVersion !== c.graphVersion || r.fence !== r.graphVersion
      || r.expectedHeadVersion !== Number(r.graphVersion) - 1) return unknown;
    if (c.changeDigest !== proposal.changeDigest || !Array.isArray(c.nodesToCreate)
      || !Array.isArray(c.nodesToUpdate) || !Array.isArray(c.nodesToRemove)) return unknown;
    const creates = c.nodesToCreate, updates = c.nodesToUpdate, removes = c.nodesToRemove;
    const deltaNode = (n: unknown): n is Record<string, unknown> => record(n) && text(n.nodeId) !== null
      && n.tenantId === c.tenantId && n.tenantId === r.tenantId;
    if (![...creates, ...removes].every(deltaNode)
      || !updates.every((u) => record(u) && text(u.nodeId) !== null && deltaNode(u.before) && deltaNode(u.after)
        && u.nodeId === u.before.nodeId && u.nodeId === u.after.nodeId)) return unknown;
    const nodes = [...creates, ...updates.map((u) => u.after), ...removes];
    const matches = nodes.filter((n) => n.nodeId === proposal.nodeId);
    if (matches.length !== 1) return unknown;
    const n = matches[0];
    if (!['macro', 'meso', 'micro', 'proof'].includes(n.scope) || !text(n.owner)
      || !text(n.currentState) || !text(n.desiredState) || typeof n.proofRequired !== 'boolean'
      || !nullableText(n.nextAction) || !nullableText(n.waitCondition) || !record(n.metadata)
      || !text(n.tenantId) || n.tenantId !== c.tenantId || n.tenantId !== r.tenantId) return unknown;
    const inspect = proposal.inspect;
    if (!inspect || !inspect.consistent || inspect.issues.length || inspect.changeDigest !== proposal.changeDigest
      || inspect.nodeId !== proposal.nodeId || inspect.admissionState === 'invalid'
      || inspect.workObjectId !== anchor(n.workObjectId) || inspect.workObjectKind !== anchor(n.workObjectKind)
      || inspect.pinnedLoadoutId !== anchor(n.pinnedLoadoutId)) return unknown;
    const canonicalInspect = r.founderInspect;
    if (!record(canonicalInspect) || canonicalInspect.changeDigest !== proposal.changeDigest
      || canonicalInspect.nodeId !== proposal.nodeId || canonicalInspect.consistent !== true
      || !Array.isArray(canonicalInspect.issues) || canonicalInspect.issues.length
      || canonicalInspect.workObjectId !== inspect.workObjectId
      || canonicalInspect.workObjectKind !== inspect.workObjectKind
      || canonicalInspect.pinnedLoadoutId !== inspect.pinnedLoadoutId) return unknown;
    const workObjectId = anchor(n.workObjectId), loadoutId = anchor(n.pinnedLoadoutId);
    return {
      ...unknown, verified: true, scope: n.scope, owner: n.owner, currentState: n.currentState,
      desiredState: n.desiredState, nextAction: text(n.nextAction), waitCondition: text(n.waitCondition),
      proofRequired: n.proofRequired, phase: text(n.metadata.phase), branch: text(n.metadata.branch), organ: text(n.metadata.organ),
      workObject: { id: workObjectId, kind: anchor(n.workObjectKind), label: workObjectId ? text(n.metadata.workObjectLabel) ?? readable(workObjectId) : null },
      loadout: { id: loadoutId, label: loadoutId ? text(n.metadata.loadoutLabel) ?? readable(loadoutId) : null },
      diff: { created: creates.length, updated: updates.length, removed: removes.length }, sourceRef: text(r.sourceRef),
    };
  } catch { return unknown; }
}
