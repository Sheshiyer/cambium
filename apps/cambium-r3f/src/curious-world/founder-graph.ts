import type { GateBridge } from './gate-folio.ts';

type GraphNode = Record<string, any> & { nodeId: string; parentNodeId: string | null; workObjectId: string };
export interface FounderGraph { head: { graphVersion: number; graphDigest: string }; rootId: string; nodes: GraphNode[]; edges: Array<{ kind: string; fromId: string; toId: string }>; decisions: Record<string, any>[]; servedAt: string; evidenceTrust: string }
export interface FounderGraphState { data: FounderGraph | null; selected: string; busy: boolean; message: string }
export const FOUNDER_PRODUCTS = [ ['sapling:lumen-bar', 'LumenBar'], ['program:temperance-hermes', 'Temperance Engine'] ] as const;

/** Validate the served read boundary; never substitute local/demo nodes. */
export function normalizeFounderGraph(value: any): FounderGraph {
  if (!value || value.schema !== 'cambium.founder.bookkeeping-graph.v1' || value.origin !== 'd1'
    || value.tenantId !== 'cambium' || value.canonicalReadback !== true || value.writerAuthority !== false
    || value.executionGranted !== false || !Number.isInteger(value.head?.graphVersion)
    || typeof value.head?.graphDigest !== 'string' || typeof value.rootId !== 'string'
    || !Array.isArray(value.nodes) || value.nodes.length > 1000 || !Array.isArray(value.edges)
    || !Array.isArray(value.decisions) || typeof value.servedAt !== 'string') throw new Error('Canonical graph read is unavailable.');
  const nodes = value.nodes as GraphNode[];
  const ids = new Set(nodes.map(n => n?.nodeId));
  if (ids.size !== nodes.length || nodes.some(n => !n || typeof n.nodeId !== 'string' || !n.nodeId
    || n.tenantId !== 'cambium' || n.namespace !== 'founder-bookkeeping' || n.pinnedLoadoutId !== null
    || !FOUNDER_PRODUCTS.some(([id]) => id === n.workObjectId)
    || (n.parentNodeId !== value.rootId && (typeof n.parentNodeId !== 'string' || !ids.has(n.parentNodeId))))) throw new Error('Canonical graph contains an invalid bookkeeping branch.');
  const byId = new Map(nodes.map(n => [n.nodeId, n]));
  for (const node of nodes) {
    const seen = new Set<string>(); let current: GraphNode | undefined = node;
    while (current) {
      if (seen.has(current.nodeId)) throw new Error('Canonical graph containment is cyclic.');
      seen.add(current.nodeId); current = byId.get(current.parentNodeId!);
    }
  }
  if (value.edges.some((e: any) => !e || e.kind !== 'contains' || !ids.has(e.toId)
    || (e.fromId !== value.rootId && !ids.has(e.fromId)) || byId.get(e.toId)?.parentNodeId !== e.fromId)) throw new Error('Canonical containment links do not match the nodes.');
  if (value.decisions.some((d: any) => d?.kind !== 'd1-bookkeeping-decision' || d.canonicalReadback !== true
    || !['approved', 'rejected'].includes(d.decision))) throw new Error('Canonical decision read is unconfirmed.');
  return value as FounderGraph;
}

export function founderProductNodes(graph: FounderGraph, selected: string): GraphNode[] {
  return graph.nodes.filter(n => n.workObjectId === selected);
}
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag); if (text !== undefined) el.textContent = text; return el;
}

/** Display only: the bridge performs the existing authenticated GET. */
export function founderGraphView(bridge: GateBridge, state: FounderGraphState): HTMLElement {
  const section = node('section'); section.className = 'cw-founder-graph'; section.setAttribute('aria-label', 'Committed lifecycle graph');
  function render() {
    section.replaceChildren(node('h3', 'Committed lifecycle graph'));
    const read = node('button', state.busy ? 'Reading canonical graph…' : state.data ? 'Refresh committed graph' : 'Read committed graph');
    read.type = 'button'; read.className = 'cw-link'; read.disabled = state.busy;
    const status = node('p', state.message); status.setAttribute('role', 'status');
    read.addEventListener('click', async () => {
      if (state.busy || !bridge.readGraph) return;
      state.busy = true; state.message = 'Reading the current canonical head…'; render();
      try { state.data = normalizeFounderGraph(await bridge.readGraph()); state.message = 'Current D1 graph read. Founder decisions are shown separately from execution or publication.'; }
      catch { state.data = null; state.message = 'The canonical graph read is held. No cached or local graph is being shown.'; }
      finally { state.busy = false; render(); }
    });
    section.append(read, status);
    const graph = state.data; if (!graph) return;
    section.append(node('p', `Head ${graph.head.graphVersion} · read ${graph.servedAt} · ${graph.nodes.length} bookkeeping nodes`));
    if (graph.evidenceTrust) section.append(node('p', String(graph.evidenceTrust)));
    const label = node('label', 'Product lifecycle'); const select = node('select'); select.id = 'cw-founder-graph-product'; label.htmlFor = select.id;
    for (const [id, name] of FOUNDER_PRODUCTS) { const option = node('option', name); option.value = id; select.append(option); }
    select.value = state.selected;
    select.addEventListener('change', () => { state.selected = select.value; render(); section.querySelector('select')?.focus(); });
    section.append(label, select);
    const visible = founderProductNodes(graph, state.selected); const selectedIds = new Set(visible.map(n => n.nodeId));
    const all = new Map(graph.nodes.map(n => [n.nodeId, n]));
    section.append(node('p', `${visible.length} nodes in this product. Expand a branch to follow its work and recorded planning prerequisites.`));
    function branch(item: GraphNode): HTMLElement {
      const details = node('details'); details.dataset.cwDisclosure = 'graph-' + item.nodeId;
      details.className = 'cw-graph-node';
      details.append(node('summary', `${item.metadata?.label || item.desiredState || item.nodeId} · ${item.status}`));
      const fields = node('dl');
      for (const [key, title] of [['desiredState','Desired state'],['currentState','Current state'],['nextAction','Next action'],['waitCondition','Waiting for'],['proofRequired','Proof required'],['reviewAt','Review at'],['owner','Owner'],['scope','Scale']]) {
        if (item[key] !== null && item[key] !== undefined && item[key] !== '') fields.append(node('dt', title), node('dd', String(item[key])));
      }
      details.append(fields);
      const prerequisites = String(item.metadata?.prerequisiteIds || '').split(',').map(x => x.trim()).filter(Boolean);
      if (prerequisites.length) {
        details.append(node('p', 'Recorded planning prerequisites (no execution grant):'));
        const list = node('ul');
        for (const id of prerequisites) { const target = all.get(id); list.append(node('li', target ? String(target.metadata?.label || target.desiredState || id) : `${id} · outside this served slice`)); }
        details.append(list);
      }
      for (const [key, title] of [['historicalState','Historical observation'],['evidenceRef','Source observation'],['evidenceDigest','Source digest']]) {
        if (item.metadata?.[key]) details.append(node('p', `${title}: ${item.metadata[key]}`));
      }
      details.append(node('small', item.nodeId));
      for (const child of visible.filter(n => n.parentNodeId === item.nodeId)) details.append(branch(child));
      return details;
    }
    for (const item of visible.filter(n => !selectedIds.has(n.parentNodeId!))) section.append(branch(item));
    if (!visible.length) section.append(node('p', 'No committed bookkeeping nodes for this product in the served head.'));
    const decisions = node('details'); decisions.dataset.cwDisclosure = 'graph-decisions';
    decisions.append(node('summary', `Recorded founder decisions (${graph.decisions.length})`));
    decisions.append(node('p', 'These are graph bookkeeping decisions, not platform publishing or execution receipts.'));
    for (const d of graph.decisions) decisions.append(node('p', `${d.decision} · ${d.decidedAt} · graph ${d.graphVersion} · ${d.changeDigest}`));
    section.append(decisions);
    const exact = node('details'); exact.dataset.cwDisclosure = 'graph-exact'; exact.append(node('summary', 'Exact canonical graph data'));
    const pre = node('pre', JSON.stringify(graph, null, 2)); exact.append(pre); section.append(exact);
  }
  render(); return section;
}
