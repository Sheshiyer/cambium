// Public-safe source projection. This is neither Goal Graph nor runtime status.
export type AtlasEvidence = 'source' | 'local' | 'production' | 'held' | 'retired';
export type AtlasLinkKind = 'knowledge' | 'execution' | 'evidence' | 'projection' | 'command';
export interface AtlasConnection {
  from: string; to: string; kind: AtlasLinkKind; label: string;
  source: string; selector: string; basis: 'contract' | 'implementation' | 'conceptual';
}
export interface AtlasOrgan {
  id: string; name: string; family: 'cambium' | 'temperance';
  verb: string; purpose: string; inputs: string[]; outputs: string[];
  boundary: string; source: string; assetId: string; x: number; y: number;
}
const guide = 'docs/explainers/system-field-guide-2026-09-27/product-sources/';
const organ = (id: string, name: string, family: AtlasOrgan['family'], verb: string,
  purpose: string, inputs: string[], outputs: string[], boundary: string,
  chapter: string, x: number, y: number): AtlasOrgan => ({
  id, name, family, verb, purpose, inputs, outputs, boundary,
  source: guide + chapter, assetId: `TSOC-ORG-${id.toUpperCase()}-CONCEPT-V1`, x, y,
});
export const SYSTEM_ATLAS = {
  schema: 'cambium.system-atlas.v1', authority: 'read_only', evidence: 'source' as AtlasEvidence,
  title: 'One living system', reviewDate: '2026-10-07',
  families: [
    { id: 'cambium', name: 'Cambium', detail: 'Finite composition', rule: 'Run · verify · receipt · stop' },
    { id: 'temperance', name: 'Temperance', detail: 'Continuing stewardship', rule: 'Observe · propose · return to a gate' },
  ],
  organs: [
    organ('genesis', 'Genesis', 'cambium', 'Form', 'Turns purpose into a coherent source system.',
      ['Approved brief', 'Source assets'], ['Brand DNA', 'Copy + visual systems'],
      'Generation and publication keep their own scope.', '11-organ-genesis.md', 17, 23),
    organ('taste', 'Taste', 'cambium', 'Judge', 'Tests whether a result fits its declared brief.',
      ['DNA + exemplars', 'Artifact + checks'], ['Quality verdict', 'Reroll or hold'],
      'A quality verdict does not approve delivery.', '12-organ-taste.md', 38, 23),
    organ('hands', 'Hands', 'cambium', 'Make', 'Executes one admitted finite work packet.',
      ['Admitted task', 'Pinned capability'], ['Artifact', 'Verifier handoff'],
      'No self-admission, new permission or silent retry.', '13-organ-hands.md', 59, 23),
    organ('will', 'Will', 'cambium', 'Interpret', 'Turns an artifact into a bounded business proposal.',
      ['Product + DNA', 'Audience + verdict'], ['Review packet', 'Approved delivery handoff'],
      'Interpretation is not permission to publish.', '14-organ-will.md', 80, 23),
    organ('cortex', 'Cortex', 'cambium', 'Remember', 'Retrieves scoped evidence across finite work.',
      ['Redacted receipts', 'Versioned context'], ['Relevant retrieval', 'Next-intent proposal'],
      'No vault dump, merged memory planes or intent mutation.', '15-organ-cortex.md', 49, 48),
    organ('vestibule', 'Vestibule', 'temperance', 'Orient', 'Re-establishes project truth at the threshold.',
      ['Project + phase', 'Prior-session signals'], ['Orientation', 'Source-tagged context'],
      'Read-only orientation; no routing or work-lane claim.', '16-organ-vestibule.md', 11, 78),
    organ('adytum', 'Adytum', 'temperance', 'Consider', 'Reads separate memory planes into a bounded next move.',
      ['Orientation', 'Distinct memory planes'], ['Next-action card', 'Uncertainty or no action'],
      'Never merge planes, write memory or send directly.', '17-organ-adytum.md', 27, 78),
    organ('nutrix', 'Nutrix', 'temperance', 'Learn', 'Distils an execution outcome into redacted learning.',
      ['Session outcome', 'Failures + receipts'], ['Learning signals', 'Reviewable belief seeds'],
      'Exit zero and transport success are not semantic acceptance.', '18-organ-nutrix.md', 43, 78),
    organ('auspex', 'Auspex', 'temperance', 'Probe', 'Reads substrate health and reports an eligible next probe.',
      ['Scoped health evidence', 'Containment contract'], ['Health report', 'Eligibility or hold'],
      'Repair authority is bounded; a probe is not fleet acceptance.', '19-organ-auspex.md', 59, 78),
    organ('circulator', 'Circulator', 'temperance', 'Distil', 'Finds a recurring pattern in dated signals.',
      ['Signals + decisions', 'Health reports'], ['Recommendation digest', 'Flag-change proposal'],
      'Recommendations do not flip flags or activate schedules.', '20-organ-circulator.md', 75, 78),
    organ('praeceptor', 'Praeceptor', 'temperance', 'Teach', 'Proposes better skills and workflows from prior evidence.',
      ['Recent substrate', 'Learning signals'], ['Proposed skills', 'Bounded workflow suggestions'],
      'Proposed output is never auto-promoted.', '21-organ-praeceptor.md', 91, 78),
  ],
  organLinks: [
    { from: "genesis", to: "taste", kind: "knowledge", label: "DNA + brief", source: guide + "12-organ-taste.md", selector: "Reads Genesis intent and relevant Cortex evidence", basis: "contract" },
    { from: "taste", to: "hands", kind: "evidence", label: "verdict + brief", source: guide + "13-organ-hands.md", selector: "Receives Taste constraints and Genesis groups", basis: "contract" },
    { from: "hands", to: "will", kind: "execution", label: "artifact", source: guide + "14-organ-will.md", selector: "uses Hands artifacts", basis: "contract" },
    { from: "genesis", to: "cortex", kind: "knowledge", label: "versioned context", source: guide + "11-organ-genesis.md", selector: "Cortex retains relevant evidence", basis: "contract" },
    { from: "cortex", to: "taste", kind: "knowledge", label: "relevant evidence", source: guide + "12-organ-taste.md", selector: "Reads Genesis intent and relevant Cortex evidence", basis: "contract" },
    { from: "hands", to: "cortex", kind: "evidence", label: "artifact evidence", source: guide + "13-organ-hands.md", selector: "emits artifact evidence to Cortex", basis: "contract" },
    { from: "will", to: "cortex", kind: "evidence", label: "outcome evidence", source: guide + "14-organ-will.md", selector: "returns observations and outcomes to Cortex", basis: "contract" },
    { from: "vestibule", to: "adytum", kind: "projection", label: "orientation", source: guide + "16-organ-vestibule.md", selector: "can feed Adytum’s contextual synthesis", basis: "contract" },
    { from: "cortex", to: "adytum", kind: "knowledge", label: "conceptual evidence reading", source: "docs/architecture/contracts/growth-ecosystem-topology-v1.md", selector: "CX --> A[Adytum, Circulator and Praeceptor proposals]", basis: "conceptual" },
    { from: "hands", to: "nutrix", kind: "evidence", label: "conceptual session outcome", source: "docs/architecture/contracts/growth-ecosystem-topology-v1.md", selector: "R --> N[Nutrix: redacted learning signal]", basis: "conceptual" },
    { from: "nutrix", to: "vestibule", kind: "knowledge", label: "prior learning", source: guide + "18-organ-nutrix.md", selector: "Vestibule reads its signals next session", basis: "contract" },
    { from: "nutrix", to: "circulator", kind: "knowledge", label: "dated learning", source: guide + "20-organ-circulator.md", selector: "Nutrix signals, shadow proposals", basis: "contract" },
    { from: "nutrix", to: "praeceptor", kind: "knowledge", label: "learning signals", source: guide + "21-organ-praeceptor.md", selector: "Learns from Nutrix and Auspex", basis: "contract" },
    { from: "auspex", to: "circulator", kind: "evidence", label: "health reports", source: guide + "19-organ-auspex.md", selector: "produces reports for Circulator and the human operator", basis: "contract" },
    { from: "auspex", to: "praeceptor", kind: "evidence", label: "health + failure signals", source: guide + "21-organ-praeceptor.md", selector: "Learns from Nutrix and Auspex", basis: "contract" },
    { from: "praeceptor", to: "circulator", kind: "knowledge", label: "reviewable proposals", source: guide + "21-organ-praeceptor.md", selector: "offers proposals that Circulator can summarize", basis: "contract" },
  ] as AtlasConnection[],
  systems: [
    { id: 'curious', name: 'Curious', verb: 'Pocket surface', owner: 'Cambium Mini App', source: 'workers/quests/src/page/index.ts' },
    { id: 'access', name: 'Access', verb: 'Verify assertion', owner: 'Cloudflare edge + Worker', source: 'workers/quests/src/lib/access-jwt.ts' },
    { id: 'plexus', name: 'Plexus', verb: 'Resolve active role', owner: 'Human identity + operations', source: 'workers/quests/src/lib/plexus-principal.ts' },
    { id: 'gate', name: 'Gate', verb: 'Signed, bounded choice', owner: 'Founder + version-bound admission', source: 'workers/quests/src/page/client/signed-action.ts' },
    { id: 'd1', name: 'Cambium D1', verb: 'Own admitted intent', owner: 'Goal Graph sole writer', source: 'docs/architecture/goal-graph-operating-model.md' },
    { id: 'fabric', name: 'Mission Fabric', verb: 'Project scoped state', owner: 'Read-only projection', source: 'docs/architecture/cambium-operating-fabric.md' },
    { id: 'hermes', name: 'Hermes', verb: 'Execute + deliver', owner: 'Execution + external channels', source: 'INTEGRATION.md' },
    { id: 'omniroute', name: 'OmniRoute', verb: 'Route inference', owner: 'Model transport within admitted scope', source: 'docs/architecture/contracts/growth-ecosystem-topology-v1.md' },
    { id: 'broker', name: 'Provider broker', verb: 'Broker scoped inference', owner: 'Separate Worker provider authority; installed hop held', source: 'workers/quests/src/handler.ts' },
    { id: 'vault', name: 'Company vault', verb: 'Keep durable prose', owner: 'Private document substrate', source: 'docs/architecture/contracts/growth-ecosystem-topology-v1.md' },
    { id: 'github', name: 'GitHub', verb: 'Keep versioned history', owner: 'Repository history + source transport; vault prose stays separate', source: 'docs/architecture/contracts/system-atlas-v1.md' },
    { id: 'proof', name: 'Receipts', verb: 'Bind attempt to outcome', owner: 'Independent evidence', source: 'docs/architecture/contracts/organ-update-delivery-v1.md' },
    { id: 'speculum', name: 'Speculum', verb: 'Reflect owner evidence', owner: 'Read model; no new authority', source: 'docs/architecture/temperance-flow.md' },
  ],
  systemLinks: [
    {"from": "curious", "to": "access", "kind": "command", "label": "Access read path", "boundary": "Current edge policy needs live readback; this is one supported read path.", "source": "workers/quests/src/lib/access-jwt.ts", "selector": "export async function verifyAccessJwt", "basis": "implementation"},
    {"from": "access", "to": "plexus", "kind": "evidence", "label": "verified identity", "boundary": "Matching active role; email alone is insufficient.", "source": "workers/quests/src/lib/plexus-principal.ts", "selector": "const identity = await verifyAccessJwt(headers, cfg, fetchImpl);", "basis": "implementation"},
    {"from": "plexus", "to": "fabric", "kind": "projection", "label": "founder-scoped read", "boundary": "Founder role and server tenant allowlist must pass; Telegram has its own signed read branch.", "source": "workers/quests/src/handler.ts", "selector": "if (resolved.principal.role !== 'founder') {", "basis": "implementation"},
    {"from": "curious", "to": "fabric", "kind": "command", "label": "signed Telegram read", "boundary": "Only configured founder/viewer IDs and enabled tenants; no Plexus role shortcut.", "source": "workers/quests/src/handler.ts", "selector": "isViewer = viewerIds.includes(auth.userId);", "basis": "implementation"},
    {"from": "curious", "to": "gate", "kind": "command", "label": "Telegram signature", "boundary": "Access session cannot substitute for signed initData.", "source": "docs/architecture/cambium-operating-fabric.md", "selector": "The Mini App submits current Telegram `initData`", "basis": "contract"},
    {"from": "gate", "to": "d1", "kind": "command", "label": "version-bound choice", "boundary": "Fresh gate, digest and compare-and-set checks.", "source": "INTEGRATION.md", "selector": "The Worker's signed Gate and graph-head CAS are the only return path.", "basis": "contract"},
    {"from": "d1", "to": "fabric", "kind": "projection", "label": "read model", "boundary": "Projection never writes intent.", "source": "docs/architecture/goal-graph-operating-model.md", "selector": "versioned receipt-backed projection envelope", "basis": "contract"},
    {"from": "d1", "to": "hermes", "kind": "execution", "label": "admitted directive", "boundary": "Execution remains inside its admitted envelope.", "source": "INTEGRATION.md", "selector": "Hermes executes only an admitted, pinned directive.", "basis": "contract"},
    {"from": "omniroute", "to": "hermes", "kind": "execution", "label": "optional inference plant", "boundary": "Conceptual dependency only; an installed hop and provider receipt remain held.", "source": "docs/architecture/contracts/growth-ecosystem-topology-v1.md", "selector": "O --> HE", "basis": "conceptual"},
    {"from": "vault", "to": "hermes", "kind": "knowledge", "label": "scoped references", "boundary": "Growth is outside the Hermes vault-write allowlist.", "source": "docs/architecture/contracts/growth-ecosystem-topology-v1.md", "selector": "Growth's Bridge A plan keeps the growth tree outside Hermes write zones.", "basis": "contract"},
    {"from": "hermes", "to": "proof", "kind": "evidence", "label": "artifact + attempt", "boundary": "Transport receipt is distinct from semantic acceptance.", "source": "INTEGRATION.md", "selector": "A terminal Hermes outcome may prove execution and inform the next intent, but cannot update the graph.", "basis": "contract"},
    {"from": "proof", "to": "gate", "kind": "projection", "label": "next-intent proposal", "boundary": "Receipts inform a fresh decision; a projection never writes D1.", "source": "INTEGRATION.md", "selector": "The Worker's signed Gate and graph-head CAS are the only return path.", "basis": "contract"},
    {"from": "fabric", "to": "curious", "kind": "projection", "label": "scoped display", "boundary": "No private vault bodies or raw authentication.", "source": "docs/architecture/cambium-operating-fabric.md", "selector": "The compatibility adapter is read-only.", "basis": "contract"},
    {"from": "proof", "to": "speculum", "kind": "projection", "label": "redacted readback", "boundary": "A console display cannot mint runtime acceptance.", "source": "docs/architecture/contracts/growth-ecosystem-topology-v1.md", "selector": "R --> UI[Manifest, Speculum and proposed TUI projections]", "basis": "conceptual"},
  ] as (AtlasConnection & { boundary: string })[],
  desks: [
    {"id": "head-of-marketing", "name": "Head of Marketing", "owner": "CEO (approve) + Synthesist (brief)", "documentOwner": "CEO", "principalOrgan": "genesis", "willDesk": "strategy", "executionState": "goal / candidate", "input": "Genesis DNA", "output": "Strategy + interpretation", "organs": ["genesis", "taste", "will"], "source": "docs/architecture/contracts/growth-desk-map-v1.md", "selector": "| Head of Marketing |"},
    {"id": "copywriter", "name": "Copywriter", "owner": "Synthesist (primary writer)", "documentOwner": "CEO", "principalOrgan": "hands", "willDesk": "dispatch", "executionState": "goal / candidate", "input": "Copy foundation + Taste", "output": "Draft + grading handoff", "organs": ["genesis", "hands", "taste", "will"], "source": "docs/architecture/contracts/growth-desk-map-v1.md", "selector": "| Copywriter |"},
    {"id": "creative-strategist", "name": "Creative Strategist", "owner": "Designer + Synthesist", "documentOwner": "CEO", "principalOrgan": "taste", "willDesk": "interpretation", "executionState": "goal / candidate", "input": "Taste + exemplars", "output": "Hooks + test proposal", "organs": ["genesis", "taste", "hands", "will"], "source": "docs/architecture/contracts/growth-desk-map-v1.md", "selector": "| Creative Strategist |"},
    {"id": "launch-lead", "name": "Launch Lead", "owner": "CEO + Hermes (cards only)", "documentOwner": "CEO", "principalOrgan": "will", "willDesk": "dispatch", "executionState": "goal / candidate", "input": "Reviewed campaign", "output": "Delivery review packet", "organs": ["will", "hands"], "source": "docs/architecture/contracts/growth-desk-map-v1.md", "selector": "| Launch Lead |"},
    {"id": "seo-lead", "name": "SEO Lead", "owner": "Scientist + Engineer", "documentOwner": "CEO", "principalOrgan": "hands", "willDesk": "retrieval", "executionState": "goal / candidate", "input": "Source foundation", "output": "Search-layer scorecard", "organs": ["hands", "will"], "source": "docs/architecture/contracts/growth-desk-map-v1.md", "selector": "| SEO Lead |"},
    {"id": "analyst", "name": "Analyst", "owner": "Scientist", "documentOwner": "CEO", "principalOrgan": "cortex", "willDesk": "audit", "executionState": "goal / candidate", "input": "Taste checks + Cortex", "output": "Grade + provenance", "organs": ["taste", "cortex", "will"], "source": "docs/architecture/contracts/growth-desk-map-v1.md", "selector": "| Analyst |"},
  ],
  growthLoop: [
    { id: 'extract', name: 'Extract', detail: 'Source → owned inbox' },
    { id: 'feed', name: 'Feed', detail: 'One bounded draft' },
    { id: 'grade', name: 'Grade', detail: 'Taste + Analyst verdict' },
    { id: 'approve', name: 'Approve', detail: 'Fresh founder choice' },
    { id: 'publish', name: 'Deliver', detail: 'Separately armed adapter' },
    { id: 'observe', name: 'Observe', detail: 'Receipt → dated learning' },
  ],
  receiptStrata: [
    { id: 'permission', name: 'Permission', question: 'Was this exact action admitted?', artifact: 'Identity · scope · digest · gate' },
    { id: 'transport', name: 'Transport', question: 'Did the attempt reach its destination?', artifact: 'Attempt · handoff · response' },
    { id: 'semantic', name: 'Outcome', question: 'Did the result satisfy the declared test?', artifact: 'Artifact hash · independent verdict' },
  ],
  holds: [
    { id: 'identity', name: 'Live identity', detail: 'Current Access policy and Plexus admin membership require authenticated readback.', source: 'workers/quests/src/lib/plexus-principal.ts' },
    { id: 'organs', name: 'Useful organ execution', detail: 'Callback, containment, accepted-work-unit and soak receipts remain owner gates.', source: 'docs/architecture/temperance-continuous-learning-integration.md' },
    { id: 'verbs', name: 'Growth machine bindings', detail: 'Missing cell verbs remain visible; prose cannot invent executable authority.', source: 'docs/architecture/contracts/growth-ecosystem-topology-v1.md' },
    { id: 'delivery', name: 'Delivery + enrollment', detail: 'Cadence is disabled in the reviewed design; publishing and enrollment remain separate.', source: 'docs/architecture/contracts/organ-update-delivery-v1.md' },
  ],
  retirementSource: { path: 'docs/architecture/contracts/system-atlas-v1.md', selector: 'retired Superset, Constellation, Paperclip and legacy app planes are historical' },
  retired: ['Superset', 'Constellation', 'Paperclip', 'Legacy app plane'],
} as const;

// Exact levels, never aliases such as "ready", "approved", "active" or "done".
export function atlasEvidence(value: unknown): AtlasEvidence {
  return ['source','local','production','held','retired'].includes(String(value))
    ? value as AtlasEvidence : 'held';
}
