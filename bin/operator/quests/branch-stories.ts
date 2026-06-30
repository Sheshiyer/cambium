export type BranchPromotionState = 'proof-only' | 'supervised-branch' | 'autonomous-branch' | 'organ-service';
export type BranchProofStatus = 'verified' | 'blocked' | 'pending' | 'no-signal';

export interface BranchVision {
  statement: string;
}

export interface BranchIcp {
  primary: string;
}

export interface BranchKpi {
  kpiId: string;
  label: string;
  survival: string;
  betterThanSurvival: string;
  source: string;
  currentState: string;
}

export interface BranchQuestStage {
  id: string;
  title: string;
  status: BranchProofStatus | 'queued';
}

export interface BranchMission {
  missionId: string;
  title: string;
  type: string;
  owner: string;
  gate: string;
  proofRequired: string;
  dispatchTarget: string;
}

export interface BranchGate {
  gate: string;
  status: BranchProofStatus;
  requiredProof: string;
}

export interface BranchProofPath {
  proofId: string;
  sourcePath: string;
  validates: string;
  promotes: string;
}

export interface BranchPromotion {
  state: BranchPromotionState;
  currentGate: string;
  rule: string;
}

export interface BranchOrganRoute {
  organ: string;
  owner: string;
  input: string;
  output: string;
  proofPath: string;
  currentGate: string;
}

export interface BranchVariableContractGroup {
  group: string;
  currentSource: string;
  status: BranchProofStatus;
}

export interface BranchAdapterService {
  providerRoute: string;
  inputs: string;
  outputs: string;
  failureModes: string;
  tenantMapping: string;
  privacyBoundary: string;
}

export interface BranchEvidenceRow {
  status: BranchProofStatus;
  evidence: string;
}

export interface BranchApproval {
  permission: string;
  status: BranchProofStatus;
  requiredApproval: string;
  failureMode: string;
}

export interface BranchDispatchHint {
  route: string;
  payloadHint: string;
  allowedWhen: string;
  blockedWhen: string;
}

export interface BranchPolicySignal {
  permission: string;
  status: BranchProofStatus;
  requiredApproval: string;
  failureMode: string;
}

export interface BranchControlBundle {
  productSeed: Record<string, string>;
  organRouting: BranchOrganRoute[];
  variableContractPayloads: BranchVariableContractGroup[];
  adapterServiceMap: BranchAdapterService[];
  evidenceLedger: BranchEvidenceRow[];
  approvals: BranchApproval[];
  autonomyBoundary: string;
  dispatchHints: BranchDispatchHint[];
  policySignals: BranchPolicySignal[];
  ui: {
    headline: string;
    currentFrontier: string;
    missionVerb: string;
    narrativeVoice: string;
    blockedCopy: string;
  };
}

export interface BranchStorySource {
  tenant: string;
  schema: string;
  indexFile: string;
  packetFile: string;
}

export interface BranchStoryGap {
  id: string;
  status: Exclude<BranchProofStatus, 'verified'>;
  detail: string;
  source: string;
}

export interface BranchStoryArc {
  branchId: string;
  productId: string;
  name: string;
  role: string;
  arcId: string;
  arcTitle: string;
  vision: BranchVision;
  icp: BranchIcp;
  kpis: BranchKpi[];
  questline: BranchQuestStage[];
  missions: BranchMission[];
  gates: BranchGate[];
  proofPaths: BranchProofPath[];
  promotion: BranchPromotion;
  controls: BranchControlBundle;
  source: BranchStorySource;
  gaps: BranchStoryGap[];
}
