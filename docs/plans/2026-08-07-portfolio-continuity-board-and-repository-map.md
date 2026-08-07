# Portfolio Continuity Board and Repository Map

**Captured:** 2026-08-07
**Purpose:** preserve the unfinished brand, Cloudflare, Hermes, quest, and skill-cluster board while moving durable planning into GitHub repositories and Cambium portfolio coordination.
**Authority:** this document is a continuity index, not runtime truth. Each project-local item must resolve to an owning repository; Cambium owns cross-portfolio dependencies and unresolved mappings.

## Completed evidence carried forward

| Item | Recorded outcome |
|---|---|
| CF-0…CF-5 relocation path | Labs zone, Workers, D1/R2, Hermes Access, and secret minting completed |
| Apex Error 1000 | Fixed |
| Main site on Pages | `ThoughtseedOS-Site` → `thoughtseed-os-site` |
| GitHub auto-deploy | Green on `main` |
| Public canary | Six-hour, post-deploy, and dispatch checks green locally and in GitHub |
| Portfolio truth | `program:company-website` executing; brand-atlas WorkObject added |
| Mail read canary | Zoho lists `wave@`; Gmail labels available |
| Evidence notes | Brand-spine and cutover documentation exists |

These are preserved as prior evidence, not re-executed or independently re-certified by this mapping iteration.

## Open board

### Brand spine

| ID | Work | Open reason | Durable owner |
|---|---|---|---|
| B1 | Founder content decisions | Resolve “Studio Partner” vs “Requirement-to-Handoff”; scrub public `conscious*` language | #281; owning brand/site repositories after #291 |
| B2 | Full Vault → atlas → site copy sync | Only a snapshot was annotated; no full rewrite pass | #281 and #291 |
| B3 | `pro` redesign fate | Decide canary, promotion, or archive for `thoughtseed-space` | #281 |
| B4 | Brand atlas host | Still on Vercel; Pages move remains optional | #281 |
| B5 | Contact automation | `mailto:wave@` remains; Zoho draft/send canary requires send approval | #280 |
| B6 | `accounts@` mailbox | Legal checklist remains open | #280 |
| B7 | GitHub → Pages native connection | Optional because Actions already deploy | #282 |
| B8 | Workbench HTML regeneration | Catalog changed; hosted bundle may be stale until reviewed rebuild/promotion | #289 and #293 |

### Cloudflare and infrastructure hygiene

| ID | Work | Open reason | Durable owner |
|---|---|---|---|
| C1 | Pages personal → Labs | Zone is in Labs; Pages remains in the personal account | #282 |
| C2 | CF-6 personal drain | Residual personal assets require bounded inventory and cleanup | #282 |
| C3 | Vault 68-object mop-up | Separate residual inventory if still authoritative | #282 and #291; confirm before acting |
| C4 | Durable DNS write path | Temporary DNS tokens are still minted; no day-to-day Labs DNS-edit path is documented | #282 |

### Hermes, Temperance, and quests

| ID | Work | Open reason | Durable owner |
|---|---|---|---|
| H1 | `HERMES_RUNNER_EXECUTE_DIRECTIVES=true` canary | Execution is off, so real work is not proven | #283 |
| H2 | One assign → execute → evidence → ACK proof | Primary closed loop is not proven | #283 |
| H3 | Quest push / ledger | `/api/quests/cambium` was empty/404-class | #284 |
| H4 | Reconcile July pending directives | Historical `shesh` directives remain pending | #249 and #283 |
| H5 | Mute noise crons | Observe/report traffic still dominates the useful signal | #283 |
| H6 | Weekly-context 501 residual | TeamForge reporting path is incomplete | #252 and #283 |
| H7 | Hermes EC2 public-canary cron | Script exists but is not installed; GitHub remains the live canary | #283; optional |
| H8 | Skill-cluster stage wiring into Hermes | Preparation exists; website delivery is not agent-cron driven | #284 |

### Skill clusters and agents

| ID | Work | Open reason | Durable owner |
|---|---|---|---|
| S1 | Run website delivery as a full plan | Stage 8 ship path exists; stages 0–7 were not executed as one project | #284 |
| S2 | Brandmint refresh → atlas → site | Meristem is executing as a capability but the public-site loop is open | #281 and #284 |
| S3 | Quest definition for `program:company-website` | Catalog is ready; no quest object is pushed and verified live | #284 |

## Preserved priority

1. H1 + H2 — enable one bounded canary and prove a real assign-to-ACK loop.
2. H5 — reduce observation noise so execution signal is visible.
3. B1 — make one founder content decision and remove dual brand truth.
4. Then B3, approval-gated B5, and B2.
5. C1 is convenient hygiene, not the lead outcome.
6. GitHub deployment and GitHub canary are already sufficient; H7 remains optional.

## Repository-first conversion

The portfolio UI must not translate these open items directly into `Now`, `Next`, or `Later`. Each item first passes:

1. exact GitHub repository or explicit repository gap;
2. origin: Thoughtseed venture, Thoughtseed internal, client, or unknown;
3. derived WorkObject grammar;
4. repository or Cambium planning authority;
5. repository-planning, GitHub-issue, and historical-tool-evidence review;
6. canonical classification agreement or an explicit mapping proposal.

Only after those gates may scheduling be treated as a real planning event.

## GitHub issue and Project index

| Scope | Issue |
|---|---|
| Contact and mailbox proof | #280 |
| Brand truth → atlas → public site | #281 |
| Cloudflare ownership and hygiene | #282 |
| Hermes execution, ACK, and signal | #283 |
| Company-site quest and delivery loop | #284 |
| Full unfinished-board continuity | #285 |
| Relocation preparation | #287 |
| Repository-first Workbench implementation | #289 |
| Repository/origin/classification audit | #290 |
| Project-local planning-authority migration | #291 |
| Cambium packet human review | #292 |
| Later production promotion | #293 |

All twelve issues are collected in [Cambium — Repository-First Portfolio & Relocation](https://github.com/users/Sheshiyer/projects/14).

## Relocation boundary

No file or repository is moved by this continuity conversion. Physical relocation remains manifest-gated, digest-pinned, one standalone repository at a time, with dirty/nested repositories rejected. R2-backed Vault mapping begins only after relocation proof and remains referenced knowledge rather than a runtime dependency or second planning writer.
