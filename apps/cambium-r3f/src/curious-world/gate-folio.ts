import { normalizeGateDecision, type GateRecordedDecision } from './gate-decision.ts';
// Founder Gate view model for the Field Atlas. Pure helpers over the sanitized
// snapshot the host page supplies. The world never signs, sees credentials or
// touches the network: it can only ask the host's existing founder-verified
// /api/gate signer to act on a proposal it is displaying.

import { goalGraphPathSegments, type GoalGraphPathSegment, type GoalGraphPathStage } from '../../../../shared/goal-graph-placement.ts';

export type GateKind = 'approve-goal-graph' | 'reject-goal-graph';
export type GateLandmarkId = 'gate' | 'hands' | 'launch-lead';
export interface GatePlacement { landmarkId: GateLandmarkId; districtId: 'purpose' | 'plant' | 'growth' }
export interface GatePath {
  changeDigest: string; title: string; decision: 'approved' | 'rejected'; decidedAt: string;
  reached: GoalGraphPathStage | null; placement: GatePlacement;
}
export type GateBeaconState = 'signing' | 'expiring' | 'pending' | 'expired';
export interface GateBeacon { landmarkId: GateLandmarkId; state: GateBeaconState; count: number }
export interface GateAdmissionEntry { key: string; value: string | null }
export interface GateInspect {
  changeDigest: string; nodeId: string;
  workObjectId: string | null; workObjectKind: string | null; pinnedLoadoutId: string | null;
  executionAdmission: readonly GateAdmissionEntry[];
  admissionState: 'exact' | 'absent' | 'invalid';
  consistent: boolean; issues: readonly string[];
}
export interface GateProposal {
  changeDigest: string; nodeId: string; title: string; summary: string; sourceRef: string;
  canonicalReview?: string | null; canRenew?: boolean; renewOnly?: boolean;
  receivedAt: string; approvalExpiresAt: string; consequence: string; reversibility: string;
  inspect: GateInspect | null; expired: boolean; canApprove: boolean; canReject: boolean;
  blockedReason: string; signing: boolean; placement: GatePlacement;
}
export interface GateSnapshot {
  state: 'checking' | 'read' | 'held'; signer: 'telegram' | 'access' | 'none'; label: string;
  proposals: readonly GateProposal[]; paths: readonly GatePath[]; decisions?: readonly GateRecordedDecision[];
}
export interface GateSignResult { ok: boolean; outcome: string; message: string; decision?: GateRecordedDecision }
export interface GateBridge {
  getGateState?: () => unknown;
  subscribeGate?: (listener: (snapshot: unknown) => void) => () => void;
  readDecision?: (changeDigest: string) => Promise<GateSignResult>;
  reviewGate?: (changeDigest: string) => Promise<GateSignResult>;
  renewGate?: (changeDigest: string) => Promise<GateSignResult & { changeDigest?: string }>;
  signGate?: (kind: GateKind, changeDigest: string) => Promise<GateSignResult>;
}

export const HELD_GATE: GateSnapshot = Object.freeze({
  state: 'held', signer: 'none', label: 'Gate read unavailable · nothing can be signed', proposals: Object.freeze([]), paths: Object.freeze([]), decisions: Object.freeze([]),
});

const PLACES: Readonly<Record<GateLandmarkId, GatePlacement['districtId']>> = Object.freeze({ gate: 'purpose', hands: 'plant', 'launch-lead': 'growth' });
const STAGES: readonly GoalGraphPathStage[] = ['committed', 'directive-queued', 'runner-claimed', 'receipt', 'learning'];
export const GATE_PLACE_NAMES: Readonly<Record<GateLandmarkId, string>> = Object.freeze({
  gate: 'Purpose · Gate', hands: 'Plant · Hands', 'launch-lead': 'Growth · Launch Lead',
});
/** Expiring soon: inside the last five minutes of the approval window. */
export const GATE_EXPIRING_MS = 5 * 60 * 1000;

const DIGEST = /^(?:sha256:)?[a-f0-9]{64}$/;
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '');
const nullable = (value: unknown): string | null => (typeof value === 'string' ? value.slice(0, 240) : null);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function placementOf(value: unknown): GatePlacement {
  const id = record(value) && typeof value.landmarkId === 'string' && Object.hasOwn(PLACES, value.landmarkId)
    ? value.landmarkId as GateLandmarkId : 'gate';
  return { landmarkId: id, districtId: PLACES[id] };
}

function pathOf(value: unknown): GatePath | null {
  if (!record(value) || typeof value.changeDigest !== 'string' || !DIGEST.test(value.changeDigest)) return null;
  if (value.decision !== 'approved' && value.decision !== 'rejected') return null;
  const reached = value.reached === null ? null : STAGES.includes(value.reached as GoalGraphPathStage) ? value.reached as GoalGraphPathStage : undefined;
  if (reached === undefined) return null;
  return { changeDigest: value.changeDigest, title: text(value.title, 160) || 'Goal proposal', decision: value.decision,
    decidedAt: text(value.decidedAt, 64), reached, placement: placementOf(value.placement) };
}

function inspectOf(value: unknown, changeDigest: string): GateInspect | null {
  if (!record(value) || value.changeDigest !== changeDigest || !Array.isArray(value.executionAdmission)) return null;
  const executionAdmission = value.executionAdmission
    .filter((entry): entry is Record<string, unknown> => record(entry) && typeof entry.key === 'string' && entry.key.startsWith('executionAdmission'))
    .slice(0, 16).map((entry) => ({ key: text(entry.key, 64), value: nullable(entry.value) }));
  const issues = Array.isArray(value.issues) ? value.issues.filter((issue): issue is string => typeof issue === 'string').slice(0, 8) : [];
  return {
    changeDigest, nodeId: text(value.nodeId, 160),
    workObjectId: nullable(value.workObjectId), workObjectKind: nullable(value.workObjectKind), pinnedLoadoutId: nullable(value.pinnedLoadoutId),
    executionAdmission,
    admissionState: value.admissionState === 'exact' || value.admissionState === 'absent' ? value.admissionState : 'invalid',
    consistent: value.consistent === true && issues.length === 0, issues,
  };
}

/** Defensive copy of the host snapshot; anything malformed holds the Gate closed. */
export function normalizeGateSnapshot(value: unknown): GateSnapshot {
  if (!record(value) || !Array.isArray(value.proposals)) return HELD_GATE;
  const state = value.state === 'read' || value.state === 'checking' ? value.state : 'held';
  const signer = value.signer === 'telegram' || value.signer === 'access' ? value.signer : 'none';
  const proposals = value.proposals.filter((item): item is Record<string, unknown> =>
    record(item) && typeof item.changeDigest === 'string' && DIGEST.test(item.changeDigest)).slice(0, 25)
    .map((item): GateProposal => {
      const changeDigest = String(item.changeDigest);
      const inspect = inspectOf(item.inspect, changeDigest);
      const open = signer !== 'none' && state === 'read' && item.signing !== true && item.renewOnly !== true && !!inspect?.consistent
        && (signer !== 'access' || (typeof item.canonicalReview === 'string' && item.canonicalReview.length > 0));
      return {
        changeDigest, nodeId: text(item.nodeId, 160), title: text(item.title, 160) || 'Goal proposal',
        summary: text(item.summary, 240), sourceRef: text(item.sourceRef, 160), receivedAt: text(item.receivedAt, 64),
        approvalExpiresAt: text(item.approvalExpiresAt, 64), consequence: text(item.consequence, 300),
        reversibility: text(item.reversibility, 300), inspect, expired: item.expired === true,
        canApprove: open && item.canApprove === true && item.expired !== true,
        canReject: open && item.canReject === true && item.expired !== true,
        canonicalReview: typeof item.canonicalReview === 'string' ? item.canonicalReview : null,
        renewOnly: item.renewOnly === true,
        canRenew: signer === 'access' && state === 'read' && item.canRenew === true && item.signing !== true,
        blockedReason: text(item.blockedReason, 200), signing: item.signing === true,
        placement: placementOf(item.placement),
      };
    });
  const paths = state === 'read' && Array.isArray(value.paths)
    ? value.paths.map(pathOf).filter((item): item is GatePath => !!item).slice(0, 8) : [];
  const decisions = Array.isArray(value.decisions) ? value.decisions.map(normalizeGateDecision).filter((v): v is GateRecordedDecision => v !== null).slice(-8) : [];
  const recordedDigests = new Set(decisions.map(decision => decision.receipt.changeDigest));
  const pending = proposals.filter(proposal => !recordedDigests.has(proposal.changeDigest));
  return { state, signer, label: text(value.label, 120) || HELD_GATE.label, proposals: pending, paths, decisions };
}

/** Pending proposals whose subject landmark is `landmarkId`. */
export function gateProposalsAt(snapshot: GateSnapshot, landmarkId: string): readonly GateProposal[] {
  return snapshot.state === 'read' ? snapshot.proposals.filter((proposal) => proposal.placement.landmarkId === landmarkId) : [];
}

/** One beacon per landmark with pending decisions, showing its most urgent state. */
export function gateBeacons(snapshot: GateSnapshot, nowMs: number): GateBeacon[] {
  if (snapshot.state !== 'read') return [];
  const rank: Record<GateBeaconState, number> = { signing: 3, expiring: 2, pending: 1, expired: 0 };
  const byLandmark = new Map<GateLandmarkId, GateBeacon>();
  for (const proposal of snapshot.proposals) {
    const expiresAt = Date.parse(proposal.approvalExpiresAt);
    const state: GateBeaconState = proposal.signing ? 'signing'
      : proposal.expired || !Number.isFinite(expiresAt) || expiresAt <= nowMs ? 'expired'
        : expiresAt - nowMs <= GATE_EXPIRING_MS ? 'expiring' : 'pending';
    const id = proposal.placement.landmarkId;
    const current = byLandmark.get(id);
    if (!current) byLandmark.set(id, { landmarkId: id, state, count: 1 });
    else byLandmark.set(id, { landmarkId: id, state: rank[state] > rank[current.state] ? state : current.state, count: current.count + 1 });
  }
  return [...byLandmark.values()];
}

/** Proposals grouped by place for the Gate queue, Gate first, then Plant, then Growth. */
export function gateGroups(snapshot: GateSnapshot): Array<{ landmarkId: GateLandmarkId; name: string; proposals: readonly GateProposal[] }> {
  const order: GateLandmarkId[] = ['gate', 'hands', 'launch-lead'];
  return order.map((landmarkId) => ({ landmarkId, name: GATE_PLACE_NAMES[landmarkId], proposals: gateProposalsAt(snapshot, landmarkId) }))
    .filter((group) => group.proposals.length > 0);
}

/** Segments to light for the most recent founder decision; nothing is lit before live state proves it. */
export function gateTrail(snapshot: GateSnapshot): GoalGraphPathSegment[] {
  const latest = snapshot.state === 'read' ? snapshot.paths[0] : undefined;
  return latest ? goalGraphPathSegments(latest.decision, latest.reached) : [];
}

export function gateCountLabel(snapshot: GateSnapshot): string {
  if (snapshot.state !== 'read') return snapshot.state === 'checking' ? 'checking the Gate' : 'Gate read held';
  const count = snapshot.proposals.length;
  return count === 0 ? 'no pending proposals' : count === 1 ? '1 pending proposal' : `${count} pending proposals`;
}

/** Every row the founder sees before signing: the full digest, anchors and each admission key. */
export function gateInspectRows(proposal: GateProposal): Array<{ label: string; value: string }> {
  const rows = [{ label: 'Change digest', value: proposal.changeDigest }, { label: 'Goal node', value: proposal.nodeId || 'not served' }];
  const inspect = proposal.inspect;
  if (!inspect) return rows;
  rows.push(
    { label: 'workObjectId', value: inspect.workObjectId ?? 'not set' },
    { label: 'workObjectKind', value: inspect.workObjectKind ?? 'not set' },
    { label: 'pinnedLoadoutId', value: inspect.pinnedLoadoutId ?? 'not set' },
    ...inspect.executionAdmission.map((entry) => ({ label: entry.key, value: entry.value ?? 'null' })),
  );
  return rows;
}

export function gateAdmissionSummary(inspect: GateInspect | null): string {
  if (!inspect) return 'Founder Inspect not served. Signing stays closed.';
  if (!inspect.consistent) return 'Inspect found an inconsistency. Signing stays closed.';
  if (inspect.admissionState === 'exact') return `Exact execution admission · ${inspect.executionAdmission.length} keys`;
  if (inspect.admissionState === 'absent') return 'No execution admission on this node';
  return 'Execution admission is malformed and will not admit execution';
}

export function gateActionState(snapshot: GateSnapshot, proposal: GateProposal, kind: GateKind): { enabled: boolean; reason: string } {
  if (snapshot.signer === 'none') return { enabled: false, reason: 'Read-only here. Sign in at /founder, or open Curious inside Telegram, to sign.' };
  if (proposal.renewOnly) return { enabled:false, reason:'This revision is stale. Renew and review the fresh proposal before deciding.' };
  if (proposal.expired) {
    return { enabled: false, reason: 'The approval window has expired. Renew and review the fresh proposal before deciding.' };
  }
  const enabled = kind === 'approve-goal-graph' ? proposal.canApprove : proposal.canReject;
  return { enabled, reason: enabled ? '' : proposal.blockedReason || 'Signing is closed for this proposal.' };
}
