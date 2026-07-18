const EXACT_STAGES = Object.freeze([
  'discover',
  'capture',
  'enrich',
  'understand',
  'create',
  'engage',
]);
const AUTHORITY_PRIMITIVES = Object.freeze([
  'approval',
  'fencing',
  'lease',
  'receipt',
  'task',
]);
const NON_AUTHORITATIVE_PLANES = Object.freeze([
  'capability',
  'hermes',
  'provider',
]);
const AUTHORITY_CONTRACTS = Object.freeze({
  task: 'action_request@1.0.0',
  lease: 'writer_lease@1.0.0',
  fencing: 'writer_lease@1.0.0',
  approval: 'approval_decision@1.0.0',
  receipt: 'operator_receipt@1.0.0',
});
const ENGAGE_ENTRY_REQUIREMENTS = Object.freeze([
  'current suppression state',
  'exact action approval',
  'writer lease',
  'current fencing token',
]);
const ENGAGE_AUTHORITY_CONTRACTS = Object.freeze([
  'approval_decision@1.0.0',
  'writer_lease@1.0.0',
]);
const CONTRACT_PATTERN = /^([a-z][a-z0-9_]*)@(\d+\.\d+\.\d+)$/;
const KNOWN_CONTRACT_VERSIONS = new Set(['1.0.0']);

const sameMembers = (left, right) => (
  left.length === right.length
  && left.every((value) => right.includes(value))
);

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireStringArray(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be a${allowEmpty ? '' : ' non-empty'} string array`);
  }
  if (value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new Error(`${label} must contain only non-empty strings`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`${label} contains duplicate values`);
  }
  return value;
}

function validateContract(contract, where) {
  const match = CONTRACT_PATTERN.exec(contract);
  if (!match) {
    throw new Error(`invalid versioned contract "${contract}" at ${where}`);
  }
  if (!KNOWN_CONTRACT_VERSIONS.has(match[2])) {
    throw new Error(`unknown contract version "${match[2]}" at ${where}`);
  }
}

function validateContracts(contracts, where, options) {
  requireStringArray(contracts, where, options);
  for (const contract of contracts) validateContract(contract, where);
}

function validateAuthority(authority) {
  requireObject(authority, 'authority');
  if (authority.system !== 'cambium' || authority.exclusive_writer !== true) {
    throw new Error('authority must make Cambium the exclusive writer');
  }
  const primitives = requireObject(authority.primitives, 'authority.primitives');
  const keys = Object.keys(primitives).sort();
  if (!sameMembers(keys, AUTHORITY_PRIMITIVES)) {
    throw new Error(`authority primitives must be exactly ${AUTHORITY_PRIMITIVES.join(', ')}`);
  }
  for (const key of AUTHORITY_PRIMITIVES) {
    const primitive = requireObject(primitives[key], `authority primitive "${key}"`);
    if (primitive.owner !== 'cambium') {
      throw new Error(`authority primitive "${key}" must be owned by Cambium`);
    }
    validateContract(primitive.contract, `authority primitive "${key}"`);
    if (primitive.contract !== AUTHORITY_CONTRACTS[key]) {
      throw new Error(`authority primitive "${key}" must bind ${AUTHORITY_CONTRACTS[key]}`);
    }
    if (typeof primitive.rule !== 'string' || primitive.rule.length === 0) {
      throw new Error(`authority primitive "${key}" requires an explicit rule`);
    }
  }
  const planes = requireStringArray(
    authority.non_authoritative_planes,
    'authority.non_authoritative_planes',
  ).slice().sort();
  if (!sameMembers(planes, NON_AUTHORITATIVE_PLANES)) {
    throw new Error('Hermes, provider, and capability planes must remain non-authoritative');
  }
}

function validateNodeShape(node) {
  requireObject(node, 'lead graph node');
  if (node.id !== node.stage || !EXACT_STAGES.includes(node.id)) {
    throw new Error(`node "${node.id}" must map one-to-one to an exact lead stage`);
  }
  if (node.owner !== 'cambium') {
    throw new Error(`node "${node.id}" owner must be Cambium`);
  }
  validateContracts(node.entry_contracts, `node "${node.id}" entry contracts`);
  validateContracts(node.exit_contracts, `node "${node.id}" exit contracts`);

  const eligibility = requireObject(node.eligibility, `node "${node.id}" eligibility`);
  for (const direction of ['entry', 'exit']) {
    const gate = eligibility[direction];
    if (!gate || typeof gate !== 'object' || typeof gate.id !== 'string' || gate.id.length === 0) {
      throw new Error(`node "${node.id}" missing ${direction} eligibility gate`);
    }
    requireStringArray(gate.requires, `node "${node.id}" ${direction} eligibility requirements`);
    if (gate.authority_contracts !== undefined) {
      validateContracts(
        gate.authority_contracts,
        `node "${node.id}" ${direction} authority contracts`,
      );
    }
  }
  if (node.id === 'engage') {
    const entryGate = eligibility.entry;
    if (!sameMembers(entryGate.requires, ENGAGE_ENTRY_REQUIREMENTS)) {
      throw new Error('engage entry eligibility must require suppression, approval, lease, and fencing semantics');
    }
    if (!Array.isArray(entryGate.authority_contracts)
      || !sameMembers(entryGate.authority_contracts, ENGAGE_AUTHORITY_CONTRACTS)
      || !ENGAGE_AUTHORITY_CONTRACTS.every((contract) => node.entry_contracts.includes(contract))) {
      throw new Error('engage entry eligibility must bind approval_decision@1.0.0 and writer_lease@1.0.0 authority contracts');
    }
  }

  const failurePolicy = requireObject(node.failure_policy, `node "${node.id}" failure policy`);
  if (!['fail-closed', 'partial'].includes(failurePolicy.mode)) {
    throw new Error(`node "${node.id}" has an invalid failure mode`);
  }
  if (failurePolicy.reconciliation_required !== true || failurePolicy.no_silent_drop !== true) {
    throw new Error(`node "${node.id}" failure policy must require reconciliation without silent drops`);
  }
  requireStringArray(node.terminal_reachability, `node "${node.id}" terminal reachability`);
}

function assertNoCycles(nodeIds, edges) {
  const adjacency = new Map(nodeIds.map((id) => [id, []]));
  for (const edge of edges) adjacency.get(edge.from).push(edge.to);
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw new Error(`lead operations graph contains a cycle at "${id}"`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of adjacency.get(id)) visit(next);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of nodeIds) visit(id);
}

function reachableFrom(starts, edges) {
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  }
  const reached = new Set(starts);
  const pending = [...starts];
  while (pending.length) {
    const id = pending.pop();
    for (const next of adjacency.get(id) || []) {
      if (!reached.has(next)) {
        reached.add(next);
        pending.push(next);
      }
    }
  }
  return reached;
}

function validateFanOuts(graph, nodeIds) {
  if (!Array.isArray(graph.fan_outs) || graph.fan_outs.length === 0) {
    throw new Error('lead operations graph requires explicit fan-out semantics');
  }
  for (const fanOut of graph.fan_outs) {
    requireObject(fanOut, 'fan-out');
    if (!nodeIds.includes(fanOut.from)) throw new Error(`fan-out has dangling source "${fanOut.from}"`);
    const targets = requireStringArray(fanOut.targets, `fan-out "${fanOut.from}" targets`);
    if (targets.length < 2) throw new Error(`fan-out "${fanOut.from}" requires at least two targets`);
    if (fanOut.mode !== 'independent'
      || fanOut.partial_failure !== 'continue-valid-branches'
      || fanOut.reconciliation !== 'required') {
      throw new Error(`fan-out "${fanOut.from}" must define independent partial-failure reconciliation`);
    }
    for (const target of targets) {
      if (!graph.edges.some((edge) => edge.from === fanOut.from && edge.to === target)) {
        throw new Error(`fan-out "${fanOut.from}" has no edge to "${target}"`);
      }
    }
  }
}

function validateJoins(graph, nodesById) {
  const joins = Array.isArray(graph.joins) ? graph.joins : [];
  for (const node of nodesById.values()) {
    if (graph.entry_nodes.includes(node.id)) continue;
    const incoming = graph.edges.filter((edge) => edge.to === node.id);
    const supplied = new Set([
      ...incoming.flatMap((edge) => edge.contracts),
      ...(node.eligibility?.entry?.authority_contracts || []),
    ]);
    const missing = node.entry_contracts.filter((contract) => !supplied.has(contract));
    if (missing.length) {
      throw new Error(`unsatisfied join for "${node.id}": missing ${missing.join(', ')}`);
    }
    const sources = [...new Set(incoming.map((edge) => edge.from))].sort();
    if (sources.length < 2) continue;
    const join = joins.find((candidate) => candidate.node === node.id);
    if (!join) throw new Error(`unsatisfied join for "${node.id}": join policy missing`);
    const declaredSources = requireStringArray(join.sources, `join "${node.id}" sources`).slice().sort();
    const requiredContracts = requireStringArray(
      join.required_contracts,
      `join "${node.id}" required contracts`,
    );
    if (join.policy !== 'all'
      || !sameMembers(declaredSources, sources)
      || !sameMembers(requiredContracts, node.entry_contracts)) {
      throw new Error(`unsatisfied join for "${node.id}": sources or required contracts drifted`);
    }
  }
}

function validateReconciliation(graph) {
  const reconciliation = requireObject(graph.reconciliation, 'reconciliation');
  if (reconciliation.required !== true
    || reconciliation.on_partial_failure !== 'record-and-reconcile'
    || reconciliation.no_silent_drop !== true) {
    throw new Error('reconciliation is required for every partial failure');
  }
  for (const field of ['record', 'compensation', 'receipt']) {
    validateContract(reconciliation[field], `reconciliation.${field}`);
  }
}

function validateLearningFoldback(graph, nodesById) {
  const foldback = requireObject(graph.learning_foldback, 'learning_foldback');
  if (foldback.source !== 'engage') {
    throw new Error('learning foldback source must be engage');
  }
  if (foldback.contract !== 'derived_learning@1.0.0') {
    throw new Error('learning foldback must use derived_learning@1.0.0');
  }
  if (!nodesById.get('engage')?.exit_contracts.includes(foldback.contract)) {
    throw new Error('learning foldback contract must be produced by engage');
  }
  if (foldback.target !== 'cortex'
    || foldback.mode !== 'derived-only') {
    throw new Error('learning foldback must be derived-only from a lead node to cortex');
  }
  if (foldback.raw_identity !== false) {
    throw new Error('derived-only learning foldback cannot contain raw identity');
  }
  if (foldback.authoritative !== false) {
    throw new Error('derived-only learning foldback cannot be authoritative');
  }
  validateContract(foldback.contract, 'learning_foldback.contract');
  validateContracts(foldback.excluded_contracts, 'learning_foldback.excluded_contracts');
  const identityContracts = [
    'lead_record@1.0.0',
    'provider_observation@1.0.0',
    'source_alias@1.0.0',
    'identity_resolution@1.0.0',
  ];
  if (!identityContracts.every((contract) => foldback.excluded_contracts.includes(contract))) {
    throw new Error('derived-only learning foldback must exclude every raw identity contract');
  }
}

export function referencedLeadOpsContracts(graph) {
  const references = [
    ...Object.values(graph.authority?.primitives || {}).map((primitive) => primitive?.contract),
    ...(graph.nodes || []).flatMap((node) => [
      ...(node.entry_contracts || []),
      ...(node.exit_contracts || []),
    ]),
    ...(graph.edges || []).flatMap((edge) => edge.contracts || []),
    graph.reconciliation?.record,
    graph.reconciliation?.compensation,
    graph.reconciliation?.receipt,
    graph.learning_foldback?.contract,
    ...(graph.learning_foldback?.excluded_contracts || []),
  ].filter((contract) => typeof contract === 'string');
  return [...new Set(references)].sort();
}

/**
 * Validate the versioned lead-operations DAG. Pure: no disk, network, or process I/O.
 * Throws a bounded diagnostic on the first invalid invariant.
 */
export function validateLeadOps(graph, { knownContractIds = null } = {}) {
  requireObject(graph, 'lead operations graph');
  if (graph.id !== 'lead-ops' || graph.version !== '1.0.0') {
    throw new Error('lead operations graph must be lead-ops@1.0.0');
  }
  const catalog = requireObject(graph.contract_catalog, 'contract_catalog');
  if (catalog.id !== 'lead-ecosystem'
    || catalog.version !== '1.0.0'
    || catalog.path !== 'contracts/lead-ecosystem.v1.json') {
    throw new Error('lead operations graph must reference the local lead-ecosystem@1.0.0 catalog');
  }
  requireStringArray(graph.stages, 'lead stages');
  if (!sameMembers(graph.stages, EXACT_STAGES)
    || graph.stages.some((stage, index) => stage !== EXACT_STAGES[index])) {
    throw new Error(`illegal lead stage order; expected ${EXACT_STAGES.join(' -> ')}`);
  }
  if (!sameMembers(graph.entry_nodes || [], ['discover'])) {
    throw new Error('lead operations entry nodes must be exactly discover');
  }
  if (!sameMembers(graph.terminal_nodes || [], ['engage'])) {
    throw new Error('lead operations terminal nodes must be exactly engage');
  }

  validateAuthority(graph.authority);
  if (!Array.isArray(graph.nodes) || graph.nodes.length !== EXACT_STAGES.length) {
    throw new Error('lead operations graph requires one node for each exact stage');
  }
  const nodeIds = graph.nodes.map((node) => node.id);
  if (!sameMembers(nodeIds, EXACT_STAGES) || new Set(nodeIds).size !== nodeIds.length) {
    throw new Error('lead operations node ids must match the six exact stages');
  }
  for (const node of graph.nodes) validateNodeShape(node);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));

  if (!Array.isArray(graph.edges) || graph.edges.length === 0) {
    throw new Error('lead operations graph requires typed edges');
  }
  for (const edge of graph.edges) {
    requireObject(edge, 'lead graph edge');
    if (!nodesById.has(edge.from)) throw new Error(`dangling edge source "${edge.from}"`);
    if (!nodesById.has(edge.to)) throw new Error(`dangling edge target "${edge.to}"`);
    validateContracts(edge.contracts, `edge "${edge.from}" -> "${edge.to}" contracts`, { allowEmpty: true });
  }

  assertNoCycles(nodeIds, graph.edges);
  const order = new Map(EXACT_STAGES.map((stage, index) => [stage, index]));
  for (const edge of graph.edges) {
    if (order.get(edge.from) >= order.get(edge.to)) {
      throw new Error(`illegal lead edge order: ${edge.from} -> ${edge.to}`);
    }
  }

  const outputs = new Map();
  for (const node of graph.nodes) {
    for (const contract of node.exit_contracts) {
      if (outputs.has(contract)) {
        throw new Error(`duplicate output ownership for "${contract}" by "${outputs.get(contract)}" and "${node.id}"`);
      }
      outputs.set(contract, node.id);
    }
  }
  for (const edge of graph.edges) {
    const sourceOutputs = nodesById.get(edge.from).exit_contracts;
    const targetInputs = nodesById.get(edge.to).entry_contracts;
    for (const contract of edge.contracts) {
      if (!sourceOutputs.includes(contract)) {
        throw new Error(`edge ${edge.from} -> ${edge.to} carries output not owned by source: ${contract}`);
      }
      if (!targetInputs.includes(contract)) {
        throw new Error(`edge ${edge.from} -> ${edge.to} carries contract not accepted by target: ${contract}`);
      }
    }
  }

  const reachable = reachableFrom(graph.entry_nodes, graph.edges);
  const unreachable = nodeIds.filter((id) => !reachable.has(id));
  if (unreachable.length) throw new Error(`unreachable lead nodes: ${unreachable.join(', ')}`);
  const reversed = graph.edges.map((edge) => ({ from: edge.to, to: edge.from }));
  const terminalAncestors = reachableFrom(graph.terminal_nodes, reversed);
  const withoutTerminalPath = nodeIds.filter((id) => !terminalAncestors.has(id));
  if (withoutTerminalPath.length) {
    throw new Error(`missing terminal path for lead nodes: ${withoutTerminalPath.join(', ')}`);
  }
  for (const node of graph.nodes) {
    if (!node.terminal_reachability.some((terminal) => graph.terminal_nodes.includes(terminal))) {
      throw new Error(`node "${node.id}" does not declare terminal reachability`);
    }
  }

  validateFanOuts(graph, nodeIds);
  validateJoins(graph, nodesById);
  validateReconciliation(graph);
  validateLearningFoldback(graph, nodesById);

  const referencedContractIds = referencedLeadOpsContracts(graph);
  if (knownContractIds !== null) {
    const known = new Set(knownContractIds);
    const unknown = referencedContractIds.filter((contract) => !known.has(contract));
    if (unknown.length) {
      throw new Error(`unknown graph contract ids: ${unknown.join(', ')}`);
    }
  }

  return {
    id: graph.id,
    version: graph.version,
    stages: [...graph.stages],
    entryNodes: [...graph.entry_nodes],
    terminalNodes: [...graph.terminal_nodes],
    authority: graph.authority,
    fanOuts: graph.fan_outs,
    joins: graph.joins,
    reconciliation: graph.reconciliation,
    learningFoldback: graph.learning_foldback,
    referencedContractIds,
  };
}

export { EXACT_STAGES };
