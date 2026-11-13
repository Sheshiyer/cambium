/** Reference bindings, not an agent registry or permission grant. */
export const ORG_SOURCE = 'thoughtseed-labs:00-meta/plans/2026-10-08-operating-org-authority-proposal.md';
export const WILL_SOURCE = 'thoughtseed-labs:20-operations/growth/department/organ-map.md';
export type DepartmentId = 'product' | 'engineering' | 'design' | 'growth' | 'operations' | 'governance';
export type ProductId = 'lumenbar' | 'temperance';
export const DEPARTMENTS = {
  product: { label: 'Product & research', roleId: 'tsscientist', clusters: ['gsd-orchestrator', 'research-knowledge-orchestrator'], desks: [] as string[], sourceRef: ORG_SOURCE },
  engineering: { label: 'Engineering', roleId: 'tsengineer', clusters: ['quality-eval-orchestrator'], desks: [] as string[], sourceRef: ORG_SOURCE },
  design: { label: 'Design & experience', roleId: 'tsdesigner', clusters: ['design-orchestrator'], desks: [] as string[], sourceRef: ORG_SOURCE },
  growth: { label: 'Growth & content', roleId: 'tssynthesist', clusters: ['growth-content-orchestrator'], desks: ['01-head-of-marketing', '02-copywriter', '03-creative-strategist', '04-launch-lead', '05-seo-lead', '06-analyst'], sourceRef: WILL_SOURCE },
  operations: { label: 'Operations & reliability', roleId: 'default', clusters: ['agentic-ops-orchestrator', 'quality-eval-orchestrator'], desks: [] as string[], sourceRef: ORG_SOURCE },
  governance: { label: 'Finance & governance', roleId: 'default', clusters: ['agentic-ops-orchestrator'], desks: [] as string[], sourceRef: ORG_SOURCE },
} as const;
export const PRIVATE_FINANCE_REFS = ['cfoevidence', 'cfostrategy'] as const;
export const SKILL_REFERENCE_PINS = {
  "copywriting": {
    "id": "copywriting",
    "clusterId": "growth-content-orchestrator",
    "digest": "sha256:dc6f9ebb8262a8a374000b9de7d4ef605c52b0b91e215bfb6b50509e650b7abe",
    "origin": "library",
    "sourceRef": "skill://copywriting"
  },
  "copy-editing": {
    "id": "copy-editing",
    "clusterId": "growth-content-orchestrator",
    "digest": "sha256:2631e9c10b2fbd67cbdff67bf1155e0ecfcd6e88ce1f75e4aa0c8a626b905960",
    "origin": "library",
    "sourceRef": "skill://copy-editing"
  },
  "launch-strategy": {
    "id": "launch-strategy",
    "clusterId": "growth-content-orchestrator",
    "digest": "sha256:90b23cb74b41c9527a05bde4cd9e7130b634bd5aaad0697fe57d7ad72dbe8755",
    "origin": "library",
    "sourceRef": "skill://launch-strategy"
  }
} as const;
export const DESK_SKILL_REFERENCES: Record<string, readonly (keyof typeof SKILL_REFERENCE_PINS)[]> = {
  '02-copywriter': ['copywriting', 'copy-editing'],
  '04-launch-lead': ['launch-strategy'],
};
export const PRODUCTS = [
  { id: 'lumenbar', workObjectId: 'sapling:lumen-bar', label: 'LumenBar', sector: 'macOS display utility' },
  { id: 'temperance', workObjectId: 'program:temperance-hermes', label: 'Temperance Engine', sector: 'Agent orchestration' },
] as const;
/** These are provisional facet rules over existing lifecycle stage labels. */
export const STAGE_BINDINGS: Record<string, { departmentId: DepartmentId; category: string; deskId?: string }> = {
  x: { departmentId: 'growth', category: 'social-x', deskId: '04-launch-lead' },
  launch: { departmentId: 'growth', category: 'launch', deskId: '04-launch-lead' },
  growth: { departmentId: 'growth', category: 'campaign-evidence', deskId: '06-analyst' },
  'content-engine-binding': { departmentId: 'growth', category: 'editorial-binding', deskId: '02-copywriter' },
  'release-proof': { departmentId: 'operations', category: 'release-evidence' },
  delivery: { departmentId: 'operations', category: 'delivery-evidence' },
  evidence: { departmentId: 'operations', category: 'evidence-review' },
  lifecycle: { departmentId: 'product', category: 'lifecycle-review' },
  learning: { departmentId: 'product', category: 'learning-review' },
  source: { departmentId: 'engineering', category: 'source-review' },
  research: { departmentId: 'product', category: 'problem-evidence' },
  engineering: { departmentId: 'engineering', category: 'contract-delivery' },
  implementation: { departmentId: 'engineering', category: 'contract-delivery' },
  design: { departmentId: 'design', category: 'experience' },
  website: { departmentId: 'growth', category: 'website', deskId: '02-copywriter' },
  readme: { departmentId: 'growth', category: 'documentation', deskId: '02-copywriter' },
  docs: { departmentId: 'growth', category: 'documentation', deskId: '02-copywriter' },
  video: { departmentId: 'design', category: 'explainer-video' },
  'product-hunt': { departmentId: 'growth', category: 'launch', deskId: '04-launch-lead' },
  'x-profile': { departmentId: 'growth', category: 'social-x', deskId: '04-launch-lead' },
  'reddit-profile': { departmentId: 'growth', category: 'social-reddit', deskId: '04-launch-lead' },
  'reddit-community': { departmentId: 'growth', category: 'community', deskId: '04-launch-lead' },
  release: { departmentId: 'operations', category: 'release-evidence' },
  deployment: { departmentId: 'operations', category: 'release-evidence' },
  governance: { departmentId: 'governance', category: 'owner-gates' },
};
export interface KpiDefinition {
  id: string; version: 1; productId: ProductId; departmentId: DepartmentId;
  label: string; horizon: 'short' | 'long'; decision: string; formula: string;
  cohort: string; unit: 'ratio'; direction: 'higher'; sourceReader: string;
  maxAgeHours: number; target: null; guardrail: string; review: 'monthly' | 'quarterly';
}
const concepts: Record<DepartmentId, [string, string, string, string, string, string]> = {
  product: ['Decision-backed problem evidence', 'Problems with a reviewed outcome hypothesis / eligible consented problems', 'consented-problem-reports', 'Consented feedback and decision receipts', 'Decide which existing problems merit investigation', 'Do not infer active use or retention from downloads'],
  engineering: ['Accepted contract scenarios', 'Scenarios with actual acceptance receipts / pinned eligible scenarios', 'pinned-acceptance-scenarios', 'Pinned scenario and device/host acceptance receipts', 'Prioritize unresolved accepted contract coverage', 'Source tests do not prove device, clean-host or recovery acceptance'],
  design: ['Observed task comprehension', 'Successful consented task attempts / eligible consented attempts', 'consented-task-attempts', 'Consented usability observation receipts', 'Choose the next bounded usability experiment', 'Report sample size; no inference from screenshot quality'],
  growth: ['Due approved publication receipts', 'Exact public receipts / due eligible approved items', 'due-eligible-exact-approved-items', 'Existing editorial consumer and public readback receipts', 'Reconcile missing launch evidence', 'Publication is an output, not adoption; preserve exact payload and slots'],
  operations: ['Current evidence coverage', 'Checks with current attributable results / eligible release checks', 'pinned-release-evidence-checks', 'Release, support and documentation verification receipts', 'Prioritize stale or missing evidence checks', 'HTTP 200 or build success does not close runtime acceptance'],
  governance: ['Attributable resource evidence', 'Resource records with complete attribution / eligible resource records', 'owner-approved-resource-records', 'Existing owner-authorized accounting or provider receipts', 'Identify missing resource attribution for owner review', 'No spending action, entitlement expansion or inferred zero cost'],
};
export const KPI_DEFINITIONS: readonly KpiDefinition[] = Object.freeze(PRODUCTS.flatMap(product =>
  (Object.keys(DEPARTMENTS) as DepartmentId[]).map(departmentId => {
    const [label, formula, cohort, sourceReader, decision, guardrail] = concepts[departmentId];
    return Object.freeze({ id: `${product.id}:${departmentId}:evidence-v1`, version: 1 as const, productId: product.id, departmentId,
      label: departmentId === 'engineering' ? (product.id === 'lumenbar' ? 'Accepted display/reconnect scenarios' : 'Accepted clean-host/routing/recovery scenarios') : label, horizon: 'short' as const, decision, formula, cohort: `${product.id}:${cohort}`, unit: 'ratio' as const, direction: 'higher' as const,
      sourceReader, maxAgeHours: departmentId === 'growth' ? 24 : 168, target: null,
      guardrail, review: 'monthly' as const });
  })));
/** Long-term measures stay candidates until approved cohorts/baselines exist. */
export const LONG_TERM_QUESTIONS: Record<DepartmentId, string> = {
  product: 'Do consented follow-ups show continued value from the accepted product outcome?',
  engineering: 'Do qualified later releases preserve device/host behavior and recovery?',
  design: 'Does observed task clarity persist across consented follow-ups?',
  growth: 'Do attributable qualified visits lead to voluntary product adoption?',
  operations: 'Are reproducible support issues resolved and independently accepted sooner?',
  governance: 'Does operation stay within owner-approved resource and privacy bounds?',
};
