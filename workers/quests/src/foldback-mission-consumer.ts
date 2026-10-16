import type {
  HermesExecutionFoldbackReaderLike,
  HermesExecutionFoldbackReadBinding,
} from "./hermes-execution-foldback.ts";
import type { FabricNode, FabricEdge, FabricGap } from "./mission-fabric.ts";

const MAX_REFERENCES = 100;

const EXCLUDED_STATUSES: ReadonlySet<string> = new Set([
  "stopped",
  "cancelled",
  "canceled",
  "expired",
]);

type FoldbackGapCode =
  | "foldback-binding-unmatched"
  | "foldback-receipt-unavailable"
  | "foldback-read-failed"
  | "foldback-projection-invalid"
  | "semantic-acceptance-unavailable";

const GAP_REASONS: Readonly<Record<FoldbackGapCode, string>> = {
  "foldback-binding-unmatched": "Foldback binding did not match an eligible task node.",
  "foldback-receipt-unavailable": "Foldback receipt is unavailable.",
  "foldback-read-failed": "Foldback receipt could not be read.",
  "foldback-projection-invalid": "Foldback receipt projection was invalid.",
  "semantic-acceptance-unavailable":
    "Terminal receipt is prepared evidence only; semantic ISA acceptance is unavailable.",
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function makeGap(code: FoldbackGapCode, nodeId: string | undefined, r2Key: string): FabricGap {
  return { gapId: `${code}:${nodeId ?? 'unknown'}`, kind: code, subjectId: nodeId ?? null,
    detail: GAP_REASONS[code], evidenceRef: null };
}

function findEligibleNode(
  nodes: readonly unknown[],
  binding: UnknownRecord,
  tenantId: string, graphVersion: number,
): boolean {
  const nodeId = str(binding.nodeId);
  const taskId = str(binding.taskId);
  const workObjectId = str(binding.workObjectId);
  const workObjectKind = str(binding.workObjectKind);
  const pinnedLoadoutId = str(binding.pinnedLoadoutId);
  if (!nodeId || !taskId || !workObjectId || !workObjectKind || !pinnedLoadoutId) {
    return false;
  }

  for (const candidate of nodes) {
    if (!isRecord(candidate)) continue;
    if (candidate.tenantId !== tenantId || candidate.graphVersion !== graphVersion || candidate.status !== 'active') continue;
    if (typeof candidate.currentState === 'string' && EXCLUDED_STATUSES.has(candidate.currentState.toLowerCase())) continue;
    const raw = isRecord(candidate.rawD1) ? candidate.rawD1 : candidate;

    const candidateNodeId = str(raw.nodeId) ?? str(candidate.nodeId);
    if (candidateNodeId !== nodeId) continue;

    const externalOrNodeId = str(raw.externalId) ?? candidateNodeId;
    if (externalOrNodeId !== taskId) continue;
    if (str(raw.workObjectId) !== workObjectId) continue;
    if (str(raw.workObjectKind) !== workObjectKind) continue;
    if (str(raw.pinnedLoadoutId) !== pinnedLoadoutId) continue;

    const status = typeof raw.status === "string" ? raw.status.toLowerCase() : undefined;
    if (status !== undefined && EXCLUDED_STATUSES.has(status)) continue;

    return true;
  }
  return false;
}

export async function readFoldbackMissionFacts(args: {
  tenantId: string;
  graphVersion: number;
  nodes: readonly unknown[];
  references: readonly {
    r2Key: string;
    binding: HermesExecutionFoldbackReadBinding;
  }[];
  reader: HermesExecutionFoldbackReaderLike;
  acceptedWorkUnitReadback?: AcceptedWorkUnitReadback;
}): Promise<{ nodes: FabricNode[]; edges: FabricEdge[]; gaps: FabricGap[] }> {
  const { tenantId, graphVersion, nodes, references, reader } = args;

  if (references.length > MAX_REFERENCES) {
    throw new Error("foldback reference limit exceeded");
  }

  const outNodes: FabricNode[] = [];
  const outEdges: FabricEdge[] = [];
  const outGaps: FabricGap[] = [];

  // receiptId -> contentDigest, for exact dedup and conflict detection.
  const seenReceipts = new Map<string, string>();

  for (const reference of references) {
    const { r2Key, binding } = reference;
    if (!isRecord(reference) || !isRecord(binding) || !isRecord(binding.goalGraph)) throw new Error('invalid foldback reference');
    const b = binding as unknown as UnknownRecord;

    // Exact tenant / graph binding; mismatches are hard failures, not gaps.
    if (b.tenantId !== tenantId || b.graphVersion !== graphVersion) {
      throw new Error("foldback binding tenant or graph version mismatch");
    }

    const bindingNodeId = str(binding.goalGraph.nodeId);

    if (!findEligibleNode(nodes, binding.goalGraph as unknown as UnknownRecord, tenantId, graphVersion)) {
      outGaps.push(makeGap("foldback-binding-unmatched", bindingNodeId, r2Key));
      continue;
    }

    let projection: unknown;
    try {
      // The reader is responsible for validating immutable bytes.
      projection = await reader.read(r2Key, binding);
    } catch {
      outGaps.push(makeGap("foldback-read-failed", bindingNodeId, r2Key));
      continue;
    }

    if (projection === null || projection === undefined) {
      outGaps.push(makeGap("foldback-receipt-unavailable", bindingNodeId, r2Key));
      continue;
    }

    if (!isRecord(projection) || !isRecord(projection.node) || !Array.isArray(projection.edges)) {
      outGaps.push(makeGap("foldback-projection-invalid", bindingNodeId, r2Key));
      continue;
    }

    const receipt = isRecord(projection.receipt) ? projection.receipt : undefined;
    const receiptId =
      str(projection.receiptId) ?? str(receipt?.receiptId) ?? str(b.receiptId);
    const contentDigest =
      str(projection.contentDigest) ?? str(receipt?.contentDigest) ?? str(b.contentDigest);

    if (!receiptId || !contentDigest) {
      outGaps.push(makeGap("foldback-projection-invalid", bindingNodeId, r2Key));
      continue;
    }

    const priorDigest = seenReceipts.get(receiptId);
    if (priorDigest !== undefined) {
      if (priorDigest !== contentDigest) {
        throw new Error("foldback receipt content digest conflict");
      }
      // Exact duplicate receipt: already folded back.
      continue;
    }
    seenReceipts.set(receiptId, contentDigest);

    // Only after everything is valid do we push projection output.
    outNodes.push(projection.node as unknown as FabricNode);
    for (const edge of projection.edges) {
      outEdges.push(edge as FabricEdge);
    }

    // A prepared terminal receipt is never semantic ISA acceptance.
    let accepted = false;
    const owner = args.acceptedWorkUnitReadback;
    if (owner?.source === 'owner-readback' && isRecord(receipt?.execution) && projection.nextIntent && projection.cortex) {
      try {
        const unit = await owner.readAcceptedWorkUnit({ taskId: binding.goalGraph.taskId, workObjectId: binding.goalGraph.workObjectId });
        if (unit && unit.schema === 'temperance.accepted-work-unit.v1' && unit.taskAccepted === true
          && unit.wholeLifecycleAccepted === false && unit.productionCambiumAdmission === false
          && ['local-source-verification', 'test-fixture'].includes(unit.domain)
          && unit.binding.taskId === binding.goalGraph.taskId && unit.binding.goalId === binding.goalGraph.nodeId && unit.binding.workObjectId === binding.goalGraph.workObjectId
          && typeof unit.binding.executionInputDigest === 'string' && /^sha256:[0-9a-f]{64}$/.test(unit.binding.executionInputDigest) && unit.binding.executionInputDigest === receipt.execution.inputDigest
          && await receiptDigest(unit) === receipt.execution.terminalProofDigest) {
          const node = projection.node as unknown as FabricNode;
          if (node.kind === 'receipt') node.value.evidenceRefs.push(`accepted-work-unit:${await receiptDigest(unit)}`, `acceptance-contract:${unit.contractId}`, `acceptance-domain:${unit.domain}`);
          accepted = true;
        }
      } catch { /* An unavailable owner never creates acceptance. */ }
    }
    if (!accepted) outGaps.push(makeGap("semantic-acceptance-unavailable", bindingNodeId, r2Key));
  }

  return { nodes: outNodes, edges: outEdges, gaps: outGaps };
}

export interface AcceptedWorkUnitReceipt {
  schema: 'temperance.accepted-work-unit.v1';
  contractId: string;
  binding: { taskId: string; goalId: string; workObjectId: string; executionInputDigest?: string };
  domain: 'local-source-verification' | 'test-fixture';
  taskAccepted: true;
  wholeLifecycleAccepted: false;
  productionCambiumAdmission: false;
  [field: string]: unknown;
}
export interface AcceptedWorkUnitReadback {
  readonly source: 'owner-readback';
  readAcceptedWorkUnit(binding: { taskId: string; workObjectId: string }): Promise<AcceptedWorkUnitReceipt | null>;
}
async function receiptDigest(receipt: AcceptedWorkUnitReceipt): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(receipt)));
  return `sha256:${Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
