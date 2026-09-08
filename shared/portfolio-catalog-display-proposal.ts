// Browser-safe, finite proposal inventory for the Portfolio Cartographer.
//
// This is intentionally separate from portfolio-catalog-authority.ts. The
// reviewed 72-record catalog remains the only action authority; these three
// records are source-backed display/proposal material and carry no tenant,
// runtime, approval, or action admission.

export type PortfolioDisplayProposalProgram = readonly [
  workId: 'branch:codigo-olimpo' | 'branch:codigo-olimpo-creator-platform' | 'program:thoughtseed-organ-console',
  name: string,
  programKind: 'client' | 'capability',
  lifecycle: 'approved' | 'executing',
  tenantStatus: 'documented-not-runtime-verified' | 'not-applicable',
  tenantId: null,
  provenance: readonly string[],
  accountId?: 'codigo-olimpo',
  linkedWorkIds?: readonly string[],
];

export const PORTFOLIO_DISPLAY_PROPOSAL_SELECTION_SHA256 =
  'ce7c129bd24fd173089c069956b9d5cc18f8d829239ce32cbd2a6798252473ca' as const;

export const PORTFOLIO_DISPLAY_SELECTION_DIGEST =
  `sha256:${PORTFOLIO_DISPLAY_PROPOSAL_SELECTION_SHA256}` as const;

// Canonical digest of the 72 reviewed records plus this exact three-record
// display selection. It is a presentation pin only and is deliberately not
// accepted by action validators.
export const PORTFOLIO_DISPLAY_CATALOG_DIGEST =
  'sha256:899d3b0443f27c5de923e369157bb3d1e94119780869a18ca0ac65442926356a' as const;

export const PORTFOLIO_DISPLAY_PROPOSAL_PROGRAMS = [
  [
    'branch:codigo-olimpo',
    'Codigo Olimpo (Brick And Mortar Client Acquisition FZCO)',
    'client',
    'approved',
    'documented-not-runtime-verified',
    null,
    [
      'vault:60-client-ecosystem/codigo-olimpo/client-profile.md',
      'vault:60-client-ecosystem/codigo-olimpo/project-brief.md',
      'vault:60-client-ecosystem/codigo-olimpo/mapping-receipt.md',
    ],
    'codigo-olimpo',
    ['branch:codigo-olimpo-creator-platform'],
  ],
  [
    'branch:codigo-olimpo-creator-platform',
    'Codigo Olimpo Creator Platform — Month 1 Beta',
    'client',
    'executing',
    'documented-not-runtime-verified',
    null,
    [
      'vault:60-client-ecosystem/codigo-olimpo/project-brief.md',
      'vault:60-client-ecosystem/codigo-olimpo/technical-spec.md',
      'vault:handoffs/HO-codigo-olimpo-loop-probe.md',
    ],
    'codigo-olimpo',
    ['branch:codigo-olimpo'],
  ],
  [
    'program:thoughtseed-organ-console',
    'Thoughtseed Organ Console',
    'capability',
    'approved',
    'not-applicable',
    null,
    [
      'repo:thoughtseed-organ-console',
      'vault:40-products/thoughtseed-organ-console/product-overview.md',
      'vault:00-meta/entity-registry.md',
    ],
  ],
] as const satisfies readonly PortfolioDisplayProposalProgram[];

export const PORTFOLIO_DISPLAY_PROPOSAL_WORK_IDS = Object.freeze(
  PORTFOLIO_DISPLAY_PROPOSAL_PROGRAMS.map(([workId]) => workId).sort(),
);

export const PORTFOLIO_DISPLAY_PROPOSAL = Object.freeze({
  schema: 'cambium.portfolio-display-proposal.v1',
  status: 'source-backed-proposal; not runtime admission',
  admission: 'render-and-proposal-only',
  canonicalSource: {
    repository: 'Sheshiyer/thoughtseed-vault',
    revision: '4ab895653a3b5bc575dffb0b2360a70062221697',
    path: '00-meta/work-object-registry.v1.json',
    fileSha256: '1e6d2a3779c5ea901ae1135cb549c4e71fd803eb7bcc385a25a1edbc2e3a4aa3',
    classificationDigest: '08bdef05f45f948cfee07da2b64982a7f76487cee609ac900a3a6e485db24757',
  },
  selectionDigest: PORTFOLIO_DISPLAY_SELECTION_DIGEST,
  intendedDisplayCount: 75,
  pendingDeltaReceipt: 'CATALOG-CURRENT-SOURCE-DELTA.json',
} as const);

export const PORTFOLIO_DISPLAY_CATALOG_COUNTS = Object.freeze({
  total: 75,
  saplings: 17,
  clientBranches: 42,
  internalPrograms: 16,
  classificationReview: 0,
  historicalProducts: 20,
  operationalGaps: 48,
} as const);
