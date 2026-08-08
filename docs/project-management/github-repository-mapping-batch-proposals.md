# GitHub repository mapping batch proposals — 2026-08-08

Status: read-only founder-review proposal.

This is the layer above the physical folder settlement. The folder pass answered: "what is sitting under `$PROJECTS_ROOT/thoughtseed/`?" This pass answers: "what repositories are visible from the logged-in GitHub account that still need to be attached to Workbench WorkObjects, historical records, or explicit exclusions?"

Source evidence:

- `docs/evidence/2026-08-08-github-repository-mapping-audit.v1.json`
- `docs/evidence/2026-08-08-project-r2-folder-inventory.json`
- `docs/project-management/project-r2-mapping-proposals.v1.json`
- `docs/project-management/portfolio-roots.v1.json`
- `apps/portfolio-cartographer/src/portfolio-catalog-data.ts`

No GitHub issue, GitHub Project item, folder, R2 object, registry row, provider setting, Goal Graph row, or production deployment was changed by this audit.

## What the audit found

| Measure | Count |
| --- | ---: |
| Affiliated repositories visible to the authenticated account | 303 |
| Explicit `Sheshiyer` + `thoughtseedlabs` + `thoughtseed-labs` repos reviewed | 259 |
| Unique repositories after combining both views | 312 |
| Conservative exact matches already visible in current repo evidence or local checkouts | 27 |
| Combined repositories still unmapped by that conservative exact-match signal | 285 |
| Non-fork unmapped repositories | 268 |
| Non-fork unmapped repositories pushed since 2025-01-01 | 204 |
| Thoughtseed org repositories currently unmapped | 20 |
| Root-map dangling WorkObject ids | 0 after founder retirement decision |

The high count does not mean "285 new active projects." It means the current Workbench cannot yet account for many GitHub repositories by exact repository identity. Many will become historical evidence, client-branch evidence, forks, experiments, or exclusions.

## Settled founder decision before action wiring

`docs/project-management/portfolio-roots.v1.json` previously mapped `virtualtryon-3d` to `sapling:virtualtryon`, but the current catalog does not define `sapling:virtualtryon`.

Founder decision on 2026-08-08:

1. ignore and retire `virtualtryon-3d`;
2. do not create a Sapling or catalog WorkObject for `sapling:virtualtryon`;
3. keep the shallow folder accounted as `needs-review` / `empty-hold` with no active `workIds`;
4. do not generate active repository/R2 mapping receipts for `Sheshiyer/virtualtryon` unless a future founder-gated branch explicitly reopens this surface.

## Batch 1 — Thoughtseed org history

Purpose: account for the 20 visible `thoughtseedlabs` / `thoughtseed-labs` repositories without accidentally making old experiments active.

Default disposition: historical evidence, archive reference, or needs-review. Active rows require founder confirmation.

Key rows:

- `thoughtseed-labs/Sense.Play`, `thoughtseedlabs/Senselpay_Firmware`, `thoughtseedlabs/senseplay_dashboard_v0.01`, `thoughtseedlabs/tomBTfirmware` → likely SensePlay historical family.
- `thoughtseedlabs/Vibrasonix-Website` → Vibrasonix historical/site evidence or fork reference.
- `thoughtseed-labs/Breathspectrum`, `Unity-Biosensors`, `TrueRNG-CMOS-Noise`, `museVR`, `DeepAR-Unity`, `faceananlysisbeta` → historical research/product evidence.
- `thoughtseed-labs/DezinerAI` and `thoughtseed-labs/lockwell-portal` → needs-review because they have newer activity.
- Forks such as `JetScan`, `AR-Video-Player`, and `metaplex` → external fork/reference only unless founder says they became owned delivery surfaces.

## Batch 2 — Client branch clusters

Purpose: attach client-originated repositories to Client Branches. Newness does not make these Saplings.

Recommended clusters:

| Client family | Workbench target | Candidate repositories |
| --- | --- | --- |
| HeyZack | `branch:heyzack*` family | `Heyzack-ai/Heyzack-Email-Templates`, `Heyzack-ai/tuya-react-native`, `HeyZack-Domotique/estimate-web`, plus `Sheshiyer/heyzack-*`, `wiki-heyzackai`, `email-engine-heyzack`, `products-list-heyzack-gen`, `brochure-py-heyzack`, and research/pitch repos |
| Tirak | `branch:tirak` | `pineappleinnovationlabs/tirak-*`, `pineappleinnovationlabs/rork-tirak--companion-marketplace-in-thailand`, `Sheshiyer/tirak-*`, `tirakplus*`, `wikiv2-tirakapp` |
| Valore / SandboxLife | `branch:sandboxlife` | `Valoreventures/sandbox*`, `Valoreventures/landing-page-v0.1`, `Valoreventures/diverse_vitality`, `Sheshiyer/sandboxlife-v2` |
| Co.Property | `branch:co-property` | `copropertyspace`, `dashboard-0.1-coproperty`, `v0-co-property`, `wiki-coproperty*`, checklist/education repos |
| Other clients | existing branch rows | Newsense, Kacima, Valmark, Earthy Munchy, Symphonics, Ashwin Sheth / Marina One repositories |

Batch rule: map by repository identity and repo-local planning first; do not infer Sapling status from a repository being new or private.

## Batch 3 — Sapling provenance

Purpose: attach Thoughtseed-originated product repositories to existing Saplings, while holding ambiguous ones.

Direct Sapling candidates:

- `sapling:10869-space` ← `Sheshiyer/10869-space-v1`
- `sapling:effort-glyph` ← `effort-glyph*`
- `sapling:fmrl` ← `fmrl`, `FMRLcam`
- `sapling:iverif` ← `iverif-wiki`
- `sapling:vantyx` ← `vantyx`
- `sapling:vibrasonix` ← `Vibrasonix-Wiki`, `vibrasonix-wiki-v1`
- `sapling:wanderfruit` ← `wanderfruit-wiki-alpha`
- `sapling:whspr` ← `whspr-*`

Hold for founder review:

- Klear Karma: catalog says Sapling, but prior evidence notes contamination and needs reconciliation.
- Kristudios: prior evidence says it may be a distinct legal entity, so do not hard-promote without founder confirmation.
- ParkArea and Tirak: both currently have Sapling + Client Branch records; repository evidence should be split carefully between product/IP and client delivery.

## Batch 4 — Internal programs and vault context

Purpose: map infrastructure repositories without treating the R2/vault sync root as an active project folder.

Recommended mappings:

- `program:thoughtseed-vault` ← `Sheshiyer/thoughtseed-labs`, `Sheshiyer/thoughtseed-vault`
- `program:company-website` ← Thoughtseed website/internal-site repos and `thoughtseed/thoughtseedlabs-web`
- `program:temperance-hermes` ← `temperance_engine_landing_page`
- existing capability rows ← operator, brand, skill, and orchestration repositories already captured in the physical gap settlement

R2 rule: this batch may prepare evidence prefixes, but it does not make R2 the live workflow writer. Workbench actions should write immutable receipts to R2 and let the governed Goal Graph / action rail handle operational state.

## Batch 5 — Close/completed and exclusion handling

Purpose: avoid active-work noise.

- SAFVR is approved as a closed/completed Client Branch and should stay out of active workflow.
- `virtualtryon-3d` is retired/ignored by founder decision, not an active WorkObject and not a Sapling.
- Forks, external vendor clones, and dependency references should become dependency/reference evidence, not WorkObjects.
- Completed/terminated work needs the closeout packet: handoff Markdown, closeout receipt JSON, agent memory projection, finished-index delta, and immutable R2 evidence receipt.

## Execution gate

Before any batch mutates Workbench state, GitHub issues, project folders, or R2:

1. founder approves the batch;
2. each repository resolves to an immutable GitHub identity where possible;
3. each action payload includes catalog digest, root-map digest, WorkObject id, repository identity, lifecycle, and evidence prefix;
4. client-originated rows remain Client Branches;
5. close/completed rows produce the required handoff and memory artifacts before leaving active workflow;
6. VirtualTryOn remains retired/ignored and is not recreated as an active WorkObject during broad action wiring.
