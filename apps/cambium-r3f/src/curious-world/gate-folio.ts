// Founder Gate view model for the Field Atlas. Pure helpers over the sanitized
// snapshot the host page supplies. The world never signs, sees credentials or
// touches the network: it can only ask the host's existing founder-verified
// /api/gate signer to act on a proposal it is displaying.

export type GateKind = 'approve-goal-graph' | 'reject-goal-graph';
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
  receivedAt: string; approvalExpiresAt: string; consequence: string; reversibility: string;
  inspect: GateInspect | null; expired: boolean; canApprove: boolean; canReject: boolean;
  blockedReason: string; signing: boolean;
}
export interface GateSnapshot {
  state: 'checking' | 'read' | 'held'; signer: 'telegram' | 'none'; label: string;
  proposals: readonly GateProposal[];
}
export interface GateSignResult { ok: boolean; outcome: string; message: string }
export interface GateBridge {
  getGateState?: () => unknown;
  subscribeGate?: (listener: (snapshot: unknown) => void) => () => void;
  signGate?: (kind: GateKind, changeDigest: string) => Promise<GateSignResult>;
}

export const HELD_GATE: GateSnapshot = Object.freeze({
  state: 'held', signer: 'none', label: 'Gate read unavailable · nothing can be signed', proposals: Object.freeze([]),
});

const DIGEST = /^(?:sha256:)?[a-f0-9]{64}$/;
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '');
const nullable = (value: unknown): string | null => (typeof value === 'string' ? value.slice(0, 240) : null);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

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
  const signer = value.signer === 'telegram' ? 'telegram' : 'none';
  const proposals = value.proposals.filter((item): item is Record<string, unknown> =>
    record(item) && typeof item.changeDigest === 'string' && DIGEST.test(item.changeDigest)).slice(0, 25)
    .map((item): GateProposal => {
      const changeDigest = String(item.changeDigest);
      const inspect = inspectOf(item.inspect, changeDigest);
      const open = signer === 'telegram' && state === 'read' && item.signing !== true && !!inspect?.consistent;
      return {
        changeDigest, nodeId: text(item.nodeId, 160), title: text(item.title, 160) || 'Goal proposal',
        summary: text(item.summary, 240), sourceRef: text(item.sourceRef, 160), receivedAt: text(item.receivedAt, 64),
        approvalExpiresAt: text(item.approvalExpiresAt, 64), consequence: text(item.consequence, 300),
        reversibility: text(item.reversibility, 300), inspect, expired: item.expired === true,
        canApprove: open && item.canApprove === true && item.expired !== true,
        canReject: open && item.canReject === true,
        blockedReason: text(item.blockedReason, 200), signing: item.signing === true,
      };
    });
  return { state, signer, label: text(value.label, 120) || HELD_GATE.label, proposals };
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
  if (snapshot.signer !== 'telegram') return { enabled: false, reason: 'Read-only here. Open Curious inside Telegram to sign.' };
  const enabled = kind === 'approve-goal-graph' ? proposal.canApprove : proposal.canReject;
  return { enabled, reason: enabled ? '' : proposal.blockedReason || 'Signing is closed for this proposal.' };
}
