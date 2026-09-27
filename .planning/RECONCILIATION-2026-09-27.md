# Cambium local source reconciliation — 27 September 2026

## Scope and acceptance

This integration begins at `e7058ef5d1c120df6dad80e09feb76edc9d4cd39` on `codex/reconcile-cambium-20260927`. It combines repository code, tests, source assets, and planning. It does not claim current production behavior. ISA owns acceptance; this file records branch disposition and the finite integration work.

## Branch dispositions

| Original branch | Original head | Disposition |
| --- | --- | --- |
| main; codex/cambium-planning-consolidation-20260902 | 746acf8 | Already upstream by ancestry. Primary WIP separately preserved in seven checkpoint commits below. |
| codex/labs-consolidation-20260831 | 5caca95 | Already upstream by ancestry. |
| codex/v0.4-closeout | a65ee09 | Exact tree and aggregate patch match upstream 5caca95; do not replay. |
| pr-370-prep | 03115f6 | Exact tree and aggregate patch match upstream 9eb8529 (#370). |
| worktree-agent-cambium-catalog-finite-20260908 | 9991641 | Exact tree and aggregate patch match upstream 650152d (#373). |
| worktree-agent-mapping-convergence-20260908 | 2b16491 | Exact tree and aggregate patch match upstream 4ad4214 (#372). Preserve its privacy and proposal/action corrections. |
| feat/cortex-mcp-n3-embed | a06035f | Patch-equivalent upstream (#374); do not replay. |
| codex/cambium-portfolio-mapping-20260906 | 9f85b41 | Historical ancestor of intake/census, superseded by reviewed public-safe #372; preserved, not replayed. |
| codex/reconcile-observed-repository-intake-20260907 | faaf364 | Historical census predecessor superseded by #372; preserved, not replayed. |
| codex/cambium-census-20260908 | 2f8458f | Historical pre-sanitization source; #372 integrates the reviewed descendant content. Replaying would undo privacy and authority fixes. |
| park/dirty-primary-20260903 | 6f4c440 | Historical mixed checkpoint; G/H/I work was revised into #366, later production-profile/routing changes supersede snapshot configuration. Retain recoverability, not an executable plan. |
| codex/wip-classification-phase9-20260903 | b2cd83f | Historical draft superseded by current v0.5 resource map and September 23 Phase 9 plan; do not revive v0.6 context or stale host inventories. |
| codex/superset-cambium-admission-canary | b7df9a9 | Host enrollment candidate held: canonical project manifest and enrollment identity must be regenerated together under owning host workflow. Do not install a stale manifest. |
| codex/cambium-stage3-readiness | bc89566 | Integrate source-only Telegram/WhatsApp messaging consent/readiness contracts and tests. No send or transport activation. |
| codex/plexus-admission-contract-20260905 | 1ee87a5 | Integrate read-only graph-reference prerequisite. Authenticated adapter, resource grant producer, installed-client verification remain a separate integration gate. |
| codex/continuous-learning-docs-20260911 | 236a83e | Integrate bounded learning-authority documentation; not proof of active learning runtime. |
| codex/checkpoint-cambium-20260927 | 02bb29b | Integrate a32737a, 4869186, 83d0dde, afdb10e, bf310a0, c9e4f65, 02bb29b: GTM, planning, visual provenance, retired projection removal, Apple Mail MCP, routing/safety, reviewed field guide. |
| codex/iverif-fr-gtm-20260911 | ec6a3d6 | Integrate composition/draft-package implementation; reconcile shared GTM contract overlaps and historical evidence without treating prior spend receipts as new authority. |
| codex/website-intake-cambium-20260924 | 0cfe679 | Integrate source/schema/tests; migration, bindings, deployment, sender integration remain unapplied. |

## Verification required before review

- Full repository `npm test` with coherent fixed source state.
- New shared GTM and owned-email tests, Apple Mail MCP tests, website intake tests, composition and draft-package tests.
- Standalone privacy audit, drift audit, rendered-doc parity, and diff hygiene.
- Phase 9 collector/classifier remains Task 1 of the concrete executable plan; no source implementation or authenticated inventory claim is made.
- Asset-library provenance/hash checks using committed sources, without rerunning provider generation.

## Exact remaining external frontier

| Lane | Missing evidence or action | Owner boundary |
| --- | --- | --- |
| Phase 9 Task 1 | Implement and synthetically verify the collector/classifier and local read adapter specified in 09-01-PLAN.md; this is a finite code task, not an external permission blocker | Cambium source owner |
| Phase 9 INV-01 / CLASS-01 | Explicit scope-bound authenticated read authorization, complete source/target logical-key inventory, producer-validated bytes and metadata, redacted classification receipt | Cloudflare account/resource owner; reads only |
| Phase 10 COPY-01 / PARITY-01 / RETIRE-01 | Approved exact-key transfer manifest, target parity and zero-source-writer proof, rollback observation, separate retirement decision | Separate approved operational phases |
| Website intake | Migration 0010 and exact Labs bindings review, authenticated integration test, deployed behavior and delivery proof | Deployment/data/channel owners; no automatic apply |
| Apple Mail / owned email | Exact transport/auth configuration, permitted sender/recipient, governed dispatch and receipt | Mail account and channel owner |
| Messaging readiness | Exact future-send consent/approval, configured transport, authenticated controlled test and error receipt | Channel owner; local readiness is not send approval |
| Plexus | Server-authenticated exact tenant grant adapter, revocation/readback and installed-client evidence | Plexus identity and admission owners |
| Temperance admission | Fresh manifest/enrollment pair, matched host identity and owning verification | Host enrollment owner |
| Hermes remediation | Deployed-source/watchdog identity, redacted incident evidence, runner Access and gateway metadata, canonical topic-map commit readback | Hermes/runtime owner; this repo does not repair another host |

Historical source/evidence remains dated. Doctrine `MISSION.md` renewal is distinct from integration completion. Neither a clean Git head nor passing tests closes the live v0.5 milestone.

## Routing provenance correction and retained viewport evidence

The eight-topic manifest at Hermes commit `1931f6c2d0d9260cfbf29c37413e1504e7ebf9e4` has SHA-256 `edcbbb34bb468107400767442df8c772c418a40a9e3747651404a23ec33c7d2a` (1,125 bytes). Read-only inspection of canonical Hermes HEAD `0979669c41176f7297d0de41f283dc17cc0ebc66` and earlier committed snapshots found the same bytes. The nine-topic Adytum/147 observation has digest `8680362398721c473cb768cf977d5d43d3621720d5edb35d871513ff4f93a630` only in the uncommitted canonical working file. It is preserved as an upstream hold, not admitted under the old source revision. No Hermes files were changed.

The candidate routing change modified exactly two embedded PAGE data lines (routing/derived plan digests), with no markup or style difference. Restoring the verified pin restores PAGE SHA-256 `3f6ea85b1e3d50a86b1b423be14c3cd2b883a23e766702c845509106a85a6ce8`, exactly matching the historical 2026-08-30 viewport manifest. Its 47 proofs and their hashes remain historical evidence; no new screenshot capture is claimed.

## Privacy disposition and release preparation

Raw fetch logs are excluded from the curated tree; a redaction receipt retains byte counts and digests. Network records are summarized without headers, URLs, or payloads. CRM retains zero raw contact records and only a count/digest for the earlier 207-contact observation. Six dated provider receipts replace the personal reply address array with an explicitly redacted empty array; this does not assert the provider setting changed. Original checkpoints remain local recovery history. Publish the reviewed final tree as a new single commit on upstream main so excluded raw evidence is not carried in its ancestry.

The removed generated HTML/PNG surfaces remain retired. Evergreen visual release-policy README and JSON were restored because existing release tests and downstream audits still depend on that policy; its links now point to maintained source provenance.

## Verification receipt

Before final source commit: 67 targeted shared/mail/website/composition tests passed; standalone audit passed 1,451 publishable files; drift audit, six-page/91-component rendered-doc parity, compose validation, and diff hygiene passed. Source-library check passed 46 mapped sources; organ-console hash comparison passed 120 published artifacts (97 assets and 23 review boards). Full-suite final result is recorded in the local review handoff after the immutable source commit.

The routed Build worker produced conflict and privacy repairs, but actual backend attribution was unavailable (`missing-session-attribution`); no provider/model resolution is claimed. Its shared-index sandbox prevented cherry-pick continuation, which the owning orchestrator completed. The unstarted Phase 9 worker was stopped before edits; Task 1 remains planned.

## Independent review corrections

ActionRequest founder conversations now consume the same committed eight-topic map (including only the existing agent-ops alias). Unadmitted Adytum requests fail without KV writes. Iverif competitor observations and working hypotheses retain class, evidence, limitations, and source section separately from verified receipts. Landing HTML and MJML escape source text and encode receipt metadata safely. The draft target agrees with the dated clean-project template (35674 / 159185), explicitly historical-source-only and draft-only; fresh live readback is still required before any future approval.

A valid Telegram token no longer removes an explicit legacy projection's narrower role or expiry; Plexus paths continue to ignore caller-supplied principals. The Iverif packet/index gate is synchronized. Original imported research bytes remain historical under one exact retired-vocabulary classification. Three removed generated visual projections have a digest-bound retirement receipt anchored to upstream ancestor `e7058ef5d1c120df6dad80e09feb76edc9d4cd39`, so a clean-clone release needs no recovery-only commits. Fixed-target capture/send scripts are excluded from publication with digests in the privacy ledger. Exact nonliteral environment expressions and one synthetic withholding canary are classified by the existing privacy scanner, with appended-secret rejection tests; no broad path or keyword suppression was added.

Focused review repairs pass: eight draft/admission tests, two scope/auth tests, and two exact state/privacy tests. The retired-runtime guard and all six product packets pass. The final full-suite and permitted release-gate receipt follows in the release record; browser lanes are delegated to CI under the local in-app-browser constraint.
