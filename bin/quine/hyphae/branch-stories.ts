import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type {
  BranchAdapterService,
  BranchApproval,
  BranchDispatchHint,
  BranchEvidenceRow,
  BranchGate,
  BranchKpi,
  BranchMission,
  BranchOrganRoute,
  BranchProofPath,
  BranchProofStatus,
  BranchPromotionState,
  BranchQuestStage,
  BranchStoryArc,
  BranchStoryGap,
  BranchVariableContractGroup,
} from '../../operator/quests/branch-stories.ts';
export type { BranchStoryArc, BranchStoryGap } from '../../operator/quests/branch-stories.ts';

interface PacketIndexRow {
  product_id: string;
  name: string;
  role: string;
  promotion_state: string;
  current_gate: string;
  packet: string;
}

const PACKET_DIR = 'docs/plans/product-branches';
const INDEX_FILE = `${PACKET_DIR}/index.md`;
const CONTROL_SECTIONS = [
  'Branch Story Controls',
  'Mission Control Inputs',
  'KPI Control Inputs',
  'Policy / Permission Inputs',
  'Dispatch Inputs',
  'Proof Foldback',
] as const;

const TABLE_SECTIONS = [
  'Product Seed',
  'Organ Routing',
  'Variable Contract Payload',
  'Adapter / Service Map',
  'Evidence Ledger',
  'Gate Ledger',
  ...CONTROL_SECTIONS,
] as const;

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function clean(value: unknown): string {
  return String(value ?? '').trim().replace(/^`|`$/g, '');
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function splitMarkdownRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isSeparatorRow(line: string): boolean {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function parseMarkdownTable(source: string): Array<Record<string, string>> {
  const tableLines = source.split(/\r?\n/).filter((line) => line.trim().startsWith('|'));
  const headerLineIndex = tableLines.findIndex((line, index) => tableLines[index + 1] && isSeparatorRow(tableLines[index + 1]));
  if (headerLineIndex === -1) return [];

  const headers = splitMarkdownRow(tableLines[headerLineIndex]).map(normalizeHeader);
  return tableLines.slice(headerLineIndex + 2)
    .filter((line) => !isSeparatorRow(line))
    .map((line) => {
      const cells = splitMarkdownRow(line);
      return Object.fromEntries(headers.map((header, index) => [header, clean(cells[index])]));
    })
    .filter((row) => Object.values(row).some(Boolean));
}

function sectionHasTableShape(source: string, section: string): boolean {
  const sectionBody = extractSection(source, section);
  if (!sectionBody.trim()) return true;
  const tableLines = sectionBody.split(/\r?\n/).filter((line) => line.trim().startsWith('|'));
  if (tableLines.length === 0) return true;
  return tableLines.some((line, index) => tableLines[index + 1] && isSeparatorRow(tableLines[index + 1]));
}

function parseFrontmatter(source: string): Record<string, string> {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return {};
  const metadata: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) metadata[field[1]] = clean(field[2].replace(/^['"]|['"]$/g, ''));
  }
  return metadata;
}

function extractSection(source: string, section: string): string {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionPattern = new RegExp(`^##\\s+${escaped}\\s*$`, 'm');
  const match = sectionPattern.exec(source);
  if (!match) return '';
  const bodyStart = match.index + match[0].length;
  const remaining = source.slice(bodyStart);
  const nextSection = remaining.search(/^##\s+/m);
  return nextSection === -1 ? remaining : remaining.slice(0, nextSection);
}

function sectionRows(source: string, section: string): Array<Record<string, string>> {
  return parseMarkdownTable(extractSection(source, section));
}

function tableRecord(source: string, section: string, key = 'field', value = 'value'): Record<string, string> {
  return Object.fromEntries(sectionRows(source, section).map((row) => [clean(row[key]), clean(row[value])]).filter(([k]) => k));
}

function controlRecord(source: string): Record<string, string> {
  return Object.fromEntries(sectionRows(source, 'Branch Story Controls')
    .map((row) => [normalizeHeader(clean(row.control)), clean(row.value)])
    .filter(([k]) => k));
}

function slugify(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'branch-arc';
}

function normalizeStatus(value: string): BranchProofStatus {
  const status = clean(value).toLowerCase().replace(/\s+/g, '-');
  if (status === 'verified' || status === 'blocked' || status === 'pending' || status === 'no-signal') return status;
  return 'pending';
}

function normalizePromotionState(value: string): BranchPromotionState {
  const state = clean(value) as BranchPromotionState;
  if (state === 'proof-only' || state === 'supervised-branch' || state === 'autonomous-branch' || state === 'organ-service') return state;
  return 'proof-only';
}

function sectionMissingGaps(source: string, packetFile: string): BranchStoryGap[] {
  return CONTROL_SECTIONS
    .filter((section) => extractSection(source, section).trim().length === 0)
    .map((section) => ({
      id: `missing-${slugify(section)}`,
      status: 'blocked' as const,
      detail: `${section} section is missing`,
      source: packetFile,
    }));
}

function malformedTableGaps(source: string, packetFile: string): BranchStoryGap[] {
  return TABLE_SECTIONS
    .filter((section) => !sectionHasTableShape(source, section))
    .map((section) => ({
      id: `malformed-${slugify(section)}`,
      status: 'blocked' as const,
      detail: `${section} table is malformed or missing a separator row`,
      source: packetFile,
    }));
}

function ledgerGaps(rows: Array<{ status: BranchProofStatus; detail: string; source: string }>): BranchStoryGap[] {
  return rows.flatMap((row, index) => row.status === 'verified'
    ? []
    : [{
        id: `${slugify(row.source)}-${index + 1}`,
        status: row.status,
        detail: row.detail,
        source: row.source,
      }]);
}

function questlineFromSection(source: string): BranchQuestStage[] {
  return extractSection(source, 'Quest Queue').split(/\r?\n/)
    .map((line) => line.match(/^\s*\d+\.\s+(.*)$/)?.[1])
    .filter((line): line is string => !!line)
    .map((title, index) => ({ id: `quest-${index + 1}`, title: clean(title), status: 'queued' }));
}

function promotionRule(source: string): string {
  return extractSection(source, 'Promotion Rule').trim().replace(/\s+/g, ' ');
}

function parseIndex(root: string): PacketIndexRow[] {
  const indexFile = join(root, INDEX_FILE);
  if (!existsSync(indexFile)) return [];
  return parseMarkdownTable(readText(indexFile))
    .filter((row) => row.product_id && row.packet)
    .map((row) => ({
      product_id: row.product_id,
      name: row.name,
      role: row.role,
      promotion_state: row.promotion_state,
      current_gate: row.current_gate,
      packet: row.packet,
    }));
}

function safePacketPath(row: PacketIndexRow): string {
  const packet = clean(row.packet);
  if (!packet || isAbsolute(packet) || packet.includes('..') || packet.includes('\\')) {
    throw new Error(`unsafe product branch packet path for ${row.product_id || 'unknown'}: ${packet || '<missing>'}`);
  }
  return packet;
}

function storyFromPacket(root: string, tenant: string, row: PacketIndexRow): BranchStoryArc {
  const packet = safePacketPath(row);
  const packetFile = join(root, PACKET_DIR, packet);
  const source = existsSync(packetFile) ? readText(packetFile) : '';
  const metadata = parseFrontmatter(source);
  const productId = clean(metadata.product_id || row.product_id);
  const name = clean(metadata.name || row.name || productId);
  const role = clean(metadata.role || row.role);
  const productSeed = tableRecord(source, 'Product Seed');
  const controls = controlRecord(source);
  const arcTitle = controls.arc_title || clean(metadata.current_gate || row.current_gate || name);
  const missions = sectionRows(source, 'Mission Control Inputs').map((mission): BranchMission => ({
    missionId: clean(mission.mission_id),
    title: clean(mission.title),
    type: clean(mission.type),
    owner: clean(mission.owner),
    gate: clean(mission.gate),
    proofRequired: clean(mission.proof_required),
    dispatchTarget: clean(mission.dispatch_target),
  })).filter((mission) => mission.missionId);
  const kpis = sectionRows(source, 'KPI Control Inputs').map((kpi): BranchKpi => ({
    kpiId: clean(kpi.kpi_id),
    label: clean(kpi.label),
    survival: clean(kpi.survival),
    betterThanSurvival: clean(kpi.better_than_survival),
    source: clean(kpi.source),
    currentState: clean(kpi.current_state),
  })).filter((kpi) => kpi.kpiId);
  const gates = sectionRows(source, 'Gate Ledger').map((gate): BranchGate => ({
    gate: clean(gate.gate),
    status: normalizeStatus(gate.status),
    requiredProof: clean(gate.required_proof),
  })).filter((gate) => gate.gate);
  const proofPaths = sectionRows(source, 'Proof Foldback').map((proof): BranchProofPath => ({
    proofId: clean(proof.proof_id),
    sourcePath: clean(proof.source_path),
    validates: clean(proof.validates),
    promotes: clean(proof.promotes),
  })).filter((proof) => proof.proofId);
  const approvals = sectionRows(source, 'Policy / Permission Inputs').map((approval): BranchApproval => ({
    permission: clean(approval.permission),
    status: normalizeStatus(approval.status),
    requiredApproval: clean(approval.required_approval),
    failureMode: clean(approval.failure_mode),
  })).filter((approval) => approval.permission);
  const evidenceLedger = sectionRows(source, 'Evidence Ledger').map((evidence): BranchEvidenceRow => ({
    status: normalizeStatus(evidence.status),
    evidence: clean(evidence.evidence),
  })).filter((evidence) => evidence.evidence);
  const organRouting = sectionRows(source, 'Organ Routing').map((organ): BranchOrganRoute => ({
    organ: clean(organ.organ),
    owner: clean(organ.owner),
    input: clean(organ.input),
    output: clean(organ.output),
    proofPath: clean(organ.proof_path),
    currentGate: clean(organ.current_gate),
  })).filter((organ) => organ.organ);
  const variableContractPayloads = sectionRows(source, 'Variable Contract Payload').map((group): BranchVariableContractGroup => ({
    group: clean(group.group),
    currentSource: clean(group.current_source),
    status: normalizeStatus(group.status),
  })).filter((group) => group.group);
  const adapterServiceMap = sectionRows(source, 'Adapter / Service Map').map((service): BranchAdapterService => ({
    providerRoute: clean(service.provider_route),
    inputs: clean(service.inputs),
    outputs: clean(service.outputs),
    failureModes: clean(service.failure_modes),
    tenantMapping: clean(service.tenant_mapping),
    privacyBoundary: clean(service.privacy_boundary),
  })).filter((service) => service.providerRoute);
  const dispatchHints = sectionRows(source, 'Dispatch Inputs').map((dispatch): BranchDispatchHint => ({
    route: clean(dispatch.route),
    payloadHint: clean(dispatch.payload_hint),
    allowedWhen: clean(dispatch.allowed_when),
    blockedWhen: clean(dispatch.blocked_when),
  })).filter((dispatch) => dispatch.route);

  const currentFrontier = controls.current_frontier || clean(metadata.current_gate || row.current_gate);
  const story: BranchStoryArc = {
    branchId: productId,
    productId,
    name,
    role,
    arcId: `${productId}-${slugify(arcTitle)}`,
    arcTitle,
    vision: { statement: controls.vision || clean(productSeed.one_sentence_seed) },
    icp: { primary: controls.icp || clean(productSeed.target_customer) },
    kpis,
    questline: questlineFromSection(source),
    missions,
    gates,
    proofPaths,
    promotion: {
      state: normalizePromotionState(metadata.promotion_state || row.promotion_state),
      currentGate: clean(metadata.current_gate || row.current_gate),
      rule: promotionRule(source),
    },
    controls: {
      productSeed,
      organRouting,
      variableContractPayloads,
      adapterServiceMap,
      evidenceLedger,
      approvals,
      autonomyBoundary: clean(productSeed.autonomy_boundary || controls.autonomy_boundary),
      dispatchHints,
      policySignals: approvals,
      ui: {
        headline: name,
        currentFrontier,
        missionVerb: missions[0]?.title || questlineFromSection(source)[0]?.title || currentFrontier,
        narrativeVoice: controls.narrative_voice || role || name,
        blockedCopy: controls.anti_claims || `Blocked until ${currentFrontier || 'required proof arrives'}`,
      },
    },
    source: {
      tenant,
      schema: clean(metadata.schema),
      indexFile: INDEX_FILE,
      packetFile: `${PACKET_DIR}/${packet}`,
    },
    gaps: [
      ...sectionMissingGaps(source, `${PACKET_DIR}/${packet}`),
      ...malformedTableGaps(source, `${PACKET_DIR}/${packet}`),
      ...ledgerGaps(evidenceLedger.map((evidence) => ({ status: evidence.status, detail: evidence.evidence, source: 'evidence-ledger' }))),
      ...ledgerGaps(gates.map((gate) => ({ status: gate.status, detail: `${gate.gate}: ${gate.requiredProof}`, source: 'gate-ledger' }))),
      ...ledgerGaps(approvals.map((approval) => ({ status: approval.status, detail: `${approval.permission}: ${approval.failureMode || approval.requiredApproval}`, source: 'policy-permission-inputs' }))),
    ],
  };
  return story;
}

export function loadBranchStories(ctx: { root: string }, tenant: string): BranchStoryArc[] {
  return parseIndex(ctx.root).map((row) => storyFromPacket(ctx.root, tenant, row));
}
