# Thoughtseed Portfolio Registry — Review List

Transcribed directly from `work-object-registry.v1.json` (generated
2026-07-29T06:46:00Z, status `proposed-read-only`). No live filesystem
check performed — this is exactly what the registry currently states,
nothing more. 67 top-level folders under the Thoughtseed portfolio root
(vault-local path, see the registry's own `discovery.root`), 54
WorkObjects, 16 folders still flagged as needing a classification decision.

Legend: **Sapling** = owned product, **Branch** = client delivery engagement
(shown here under its Program record, `programKind: client`), **Program** =
internal capability/operations/company work.

---

## Work-source and child-source folders (51 folders → 38 WorkObjects)

A folder can be the sole source for a WorkObject, share a WorkObject with
another folder, or be a supporting ("child") source for a WorkObject whose
primary folder is listed elsewhere.

| Folder | Maps to WorkObject(s) | Kind | GitHub repo (from sourceRefs) | Aliases | Registry's reason |
|---|---|---|---|---|---|
| `Airdronauts` | Airdronauts Panorama Viewer Delivery | Branch (client: airdronauts-productions) | — | — | canonical client engagement evidence |
| `HDILINT` | HDILINT | Program (capability) | `HDILINT-backend-aleph` | — | internal capability system source |
| `HDILINT-backend-aleph` *(child)* | HDILINT | Program (capability) | `HDILINT-backend-aleph` | — | backend source for internal HDILINT capability program |
| `HeyZack` | HeyZack, ZackAI, CRM, Estimate, Partner Portal, Customer Portal, Panel App, Landing, Tooling, Proposal, Veloren CEE AI (11 Branches) | Branch (client: heyzack) | — | — | canonical client account with multiple delivery projects |
| `Panaroma-Webapp` | Vantyx | Sapling | `Panaroma-Webapp` | — | repository remote and Cambium branch packet identify Vantyx |
| `Sandboxlife` | SandBoxLife | Branch (client: valore-ventures, **paused**) | — | — | canonical Valore Ventures client project source |
| `Skill-clusters` | Skill Clusters | Program (capability) | `Skill-clusters` | — | internal capability registry |
| `Tirak` | Tirak Product (Sapling) + Tirak Client Partnership (Branch, client: tirak) | Sapling + Branch, linked | — | — | shared source for linked product Sapling and client Branch |
| `WHSPR` | WHSPR | Sapling | — | — | canonical active product surface |
| `brand-genesis` | Meristem Brand System | Program (capability) | `brandmint-v2` | — | internal brand-generation capability source |
| `brandmint-oracle-aleph` *(child)* | Meristem Brand System | Program (capability) | `brandmint-v2` | — | internal brand-generation capability implementation |
| `brandmint-showcase` *(child)* | Meristem Brand System | Program (capability) | `brandmint-v2` | — | showcase surface for internal brand capability |
| `brandmint-v2` | Meristem Brand System | Program (capability) | `brandmint-v2` | — | Meristem brand-brain implementation |
| `brandmint-variable-contracts` *(child)* | Meristem Brand System | Program (capability) | `brandmint-v2` | — | contract source for internal brand capability |
| `bwssb` | BWSSB | Branch (client: spaceblanket-ai, lifecycle: proposed) | — | — | canonical SpaceBlanket.AI client project |
| `cambium` | Cambium (Sapling) + Cambium Operating Fabric (Program) | Sapling + Program, linked | — | — | shared source for owned Cambium product and operating-fabric program |
| `explee-skills` | Explee Capability Pack | Program (capability) | `explee-skills` | — | internal provider capability package |
| `fitcheck-landing` | **Fitcheck** | Sapling | `fitcheck-landing` | **FitCheck** (legacy-product-name), **getfitcheck** (brand-alias) | owned productized service repository and Cambium product branch packet |
| `fmrl` | FMRL | Sapling | — | — | canonical active product surface |
| `github-next-wave-orchestrator` | Engineering Orchestration | Program (capability) | `github-next-wave-orchestrator`, `swarm-architect-skill` | — | internal engineering capability |
| `gram-cli` | Operator Utilities | Program (capability) | `gram-cli`, `reddit-cli`, `raycast-extensions` | — | internal operator utility |
| `iverif` | IVerif | Sapling | — | — | Cambium product branch packet identifies proof-only product candidate |
| `manifest-skill-cluster` | Skill Clusters | Program (capability) | `Skill-clusters` | — | internal skill-cluster capability |
| `motionsites-export` | Meristem Brand System | Program (capability) | `brandmint-v2` | — | internal web-production capability |
| `newsense` | Newsense | Branch (client: newsense) | — | — | canonical Newsense client project |
| `newsense-launch` *(child)* | Newsense | Branch (client: newsense) | — | — | launch implementation source for Newsense client Branch |
| `parkarea` | ParkArea Product (Sapling) + ParkArea Client Delivery (Branch, client: parkarea) | Sapling + Branch, linked | — | — | shared source for linked product Sapling and client Branch |
| `plexus-ts` | Plexus Work Coordination | Program (capability) | `plexus-ts` | — | internal work-coordination capability |
| `raycast-extensions` | Operator Utilities | Program (capability) | `gram-cli`, `reddit-cli`, `raycast-extensions` | — | internal operator utility collection |
| `reddit-cli` | Operator Utilities | Program (capability) | `gram-cli`, `reddit-cli`, `raycast-extensions` | — | internal operator utility |
| `snow-gloves-os` | Snow Gloves OS | Program (capability) | `snow-gloves-os` | — | canonical internal-service branch maps to capability program |
| `swarm-architect-skill` | Engineering Orchestration | Program (capability) | `github-next-wave-orchestrator`, `swarm-architect-skill` | — | internal engineering capability |
| `team-forge-ts` | TeamForge Cloudflare Control Plane (→ linked to Sapling SeedForge) | Program (capability) | `team-forge-ts` | — | internal Cloudflare control-plane source |
| `temperance_engine` | Hermes and Temperance Execution Plane | Program (operations) | `temperance_engine`, `thoughtseed-labs/hermes-aws-ts` | — | internal agent execution and routing capability |
| `thoughtseed-labs` | Thoughtseed Labs Vault (Program) + Hermes/Temperance (Program) + **SeedForge** (Sapling) | Program + Program + Sapling | — | **Seedforge** (vault-product-name), **SeedForge** (founder-view-name) | canonical portfolio and company-knowledge program |
| `thoughtseed-paperclip` | Paperclip Retired Execution Plane | Program (operations, **retired**) | `thoughtseed-paperclip` | — | retired execution-plane provenance |
| `vibrasonix` | Vibrasonix | Sapling | — | — | canonical active product source |
| `virtualtryon-3d` *(child)* | **Fitcheck** | Sapling | — | (inherits Fitcheck's aliases above) | product technology and prototype source linked to Fitcheck |
| `website` | Thoughtseed Company Website | Program (company, **paused**) | `website` | — | company website operations source |

---

## Classification-needed folders (16 — every one also appears in the registry's own `unresolvedCandidates` list)

No WorkObject mapping exists yet. These are exactly the ones worth going
through first if the goal is closing gaps.

| Folder | Registry's reason | What's needed |
|---|---|---|
| `10869` | code repository exists but no canonical Vault product or client mapping was found | owner and commercial outcome |
| `Coproperty` | source tree has no current canonical Vault mapping | canonical project or product note |
| `Insightreality` | repository reads like client delivery but lacks a canonical Vault client mapping | client account mapping or owned-product declaration |
| `Kacima` | code repository exists but commercial ownership is not canonicalized in Vault | client account mapping or owned-product declaration |
| `Pineapple` | portfolio or organization source without one canonical WorkObject mapping | portfolio container versus WorkObject decision |
| `ashwinsheth-group` | likely account source but no canonical Vault client mapping was found | client account and project IDs |
| `earthy-munchy` | source tree lacks a canonical Vault product or client mapping | canonical product or client note |
| `hostscalev0` | legacy repository with no current canonical portfolio mapping | current lifecycle and ownership |
| `klear-karma` | multiple application sources exist but canonical commercial class is absent | commercial ownership and WorkObject split |
| `kristudios` | source tree lacks a canonical Vault product or client mapping | canonical product or client note |
| `monthlymealprep` | product-like Rasa repository is not yet admitted in canonical Vault portfolio state | admit Rasa as Sapling or classify otherwise |
| `ratan-pitch` + `ratandevelopers` | likely (sibling) client project source but canonical client/account mapping is absent | one client account mapping and project split |
| `rssfeedscrapper` | AgentFount product-like source is not yet admitted in canonical Vault portfolio state | admit AgentFount as Sapling or classify otherwise |
| `safvr` | source tree lacks a canonical Vault product or client mapping | canonical product or client note |
| `synchronized-universe-blog` | owned media source is not yet classified as product or company program | owned media Sapling versus company Program decision |
| `wtfmedia` | media source is not yet classified as product, client, or company program | media Sapling, client Branch, or company Program decision |

---

## Excluded folders (10 — deliberately out of scope, not work identities)

| Folder | Reason |
|---|---|
| `.codex-worktrees` | generated-worktree-root |
| `.worktrees` | generated-worktree-root |
| `Archive` | archive-root |
| `Skill-clusters.worktrees` | generated-worktree-root |
| `_backups` | backup-root |
| `docs` | shared-document-root-not-work-identity |
| `plexus-ts-github-settings-ota-review` | temporary-review-worktree |
| `scripts` | shared-utility-root-not-work-identity |
| `snow-gloves-ci-fix` | temporary-fix-worktree |
| `snow-gloves-variable-contracts` | temporary-contract-worktree |
| `standups` | operational-record-root-not-work-identity |

---

## WorkObjects with no on-disk folder in this registry (16)

These exist as canonical WorkObjects (mostly client Branches, a few
Saplings) but their `sourceRefs` point only to vault documentation
(`vault:...`) — no `repo:` reference, and no matching entry in
`sourceInventory`. Either the client engagement never had local code, or
its code lives somewhere the registry's discovery scan didn't cover
(only immediate children of the `thoughtseed` root were scanned).

| WorkObject | Kind | Lifecycle |
|---|---|---|
| WhatsLegal | Sapling | proof-only |
| Effort Glyph | Sapling | proof-only |
| Axtech | Branch (client: axdis-group) | executing |
| Axtech ERP | Branch (client: axdis-group) | executing |
| Brightme | Branch (client, white-labelable) | retired |
| Dorix | Branch (client) | retired |
| Instal | Branch (client, white-labelable) | retired |
| Mathis Portal | Branch (client: mathis) | approved |
| Pongotrasteros | Branch (client) | executing |
| Symphonics | Branch (client) | executing |
| Thaleos | Branch (client) | complete |
| WattConnect | Branch (client) | complete |
| Wegrid.ai | Branch (client) | retired |

---

## Quick reference — name/alias mismatches already recorded

Only two WorkObjects have a registered alias today, and both are
same-product brand/case variants, not folder-vs-repo renames:

- **Fitcheck** — legacy name `FitCheck`, brand alias `getfitcheck`
- **SeedForge** — vault-product-name `Seedforge`, founder-view-name `SeedForge`

Everything else in the registry (including cases like HDLINT, which turned
out to be a genuine product fork/pivot rather than a rename) has no alias
entry recorded.
