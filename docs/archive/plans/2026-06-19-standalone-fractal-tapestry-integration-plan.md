# Standalone Fractal Tapestry Integration Plan

Date: 2026-06-19

## Goal

Make Cambium a standalone, organization-emulable fractal tapestry: a portable company compiler and operator that can be adopted by founder-led businesses, small marketing teams, and AI-first dev teams without carrying Thoughtseed-specific data, credentials, tenants, URLs, customer artifacts, or private operational assumptions.

## Operating Rule

Thoughtseed usage may remain as case-study evidence outside the product core, but the Cambium repository should ship as neutral product infrastructure. Demo fixtures must be synthetic, provider-neutral, and safe to publish.

## 90 Touchpoints

### Product Boundary

1. Define Cambium as a standalone product in `README.md`, not an internal Thoughtseed system.
2. Replace repo-wide "thoughtseed" nouns with neutral examples unless describing historical evidence.
3. Separate public product docs from private implementation notes.
4. Add a `docs/case-studies/` boundary for optional non-core usage narratives.
5. Add a `docs/private/` ignore rule if private reviews need to live locally.
6. Make the default tenant `demo-org`, not `cambium` or a company-owned slug.
7. Make all sample founders synthetic.
8. Make all sample teams synthetic.
9. Make all sample domains use `example.com`.
10. Add a product positioning page: "Cambium for any founder-led org."

### Data Hygiene

11. Add a repository privacy checklist before every release.
12. Add a `rg`-based leakage check for Thoughtseed, personal emails, Stripe IDs, tokens, and local paths.
13. Ignore `.codegraph/` as local index state.
14. Ignore `.readme-gen.json` as generated local state.
15. Ignore `.DS_Store`.
16. Ignore `motionsites-export/` because it can contain private account and payment exports.
17. Move generated screenshots into committed docs only after review.
18. Remove absolute `/Volumes/.../thoughtseed/...` links from committed markdown.
19. Replace local filesystem links with repo-relative paths.
20. Add a sample redaction policy for third-party exports.

### Tenant Model

21. Rename root examples from founder/company-specific state to organization-neutral state.
22. Ensure tenant slugs are examples, not live customer names.
23. Add a tenant fixture generator.
24. Add a "new org bootstrap" command path.
25. Add a "delete org fixture" cleanup command.
26. Keep tenant state out of source control.
27. Add tests proving tenant fixtures are synthetic.
28. Add docs showing multiple orgs without Thoughtseed assumptions.
29. Make founder inheritance optional and configurable.
30. Document tenant isolation as a product feature.

### Integrations

31. Define integration ports for chat, calendar, issue tracker, repository, deployment, and CRM.
32. Keep Telegram as one adapter, not the default product identity.
33. Keep MultiCA as one evidence source, not a required dependency.
34. Keep Cloudflare as one deployment adapter, not the only runtime story.
35. Wrap provider names behind neutral interfaces.
36. Add adapter contracts for GitHub, Linear, Slack, Telegram, Cloudflare, and generic webhooks.
37. Add fake adapters for local demos.
38. Add fail-soft behavior for every missing external provider.
39. Add setup docs that start with zero external integrations.
40. Add provider-specific docs under `docs/adapters/`.

### Fractal Tapestry Core

41. Document the six-scale recursion: skill, cluster, organ, venture, company, portfolio.
42. Make "every organ is the same machine" explicit in product docs.
43. Keep `Genesis -> Taste -> Build -> Ops + Cortex` as the neutral canonical pipeline.
44. Make organ names configurable while preserving defaults.
45. Add a visual grammar spec for organ islands, rails, beacons, and cortex current.
46. Add a bounded snapshot schema for the tapestry renderer.
47. Add a CLI command to export a tapestry snapshot.
48. Add tests that snapshot fields derive from state, not prose.
49. Add docs for using the tapestry as an org operating map.
50. Add a minimal browser demo that runs on synthetic data.

### Cortex and Memory

51. Make cortex memory provider-neutral.
52. Keep NIM/Vectorize as adapters, not required conceptual dependencies.
53. Add local memory fixtures with fake embeddings.
54. Add import/export docs for org-specific memory.
55. Add deletion and reset semantics for memory stores.
56. Add a "no private memory in repo" test.
57. Separate design memory from product runtime memory.
58. Unify duplicate taste/design memory paths behind one interface.
59. Add migration notes for teams bringing existing knowledge bases.
60. Add memory tenancy threat-model docs.

### Operator and Quest Surface

61. Rename live quest examples to generic organization milestones.
62. Keep Thoughtseed onboarding as external evidence, not default sample data.
63. Add generic arcs for brief, build, review, approval, launch, learning, and archive.
64. Make founder gate an abstract approval lane.
65. Provide Telegram, web, and CLI approval adapters.
66. Add tests for no-fake-progress on generic fixture data.
67. Add a local demo quest ledger.
68. Add project-evidence docs that do not assume one company workflow.
69. Add archive ceremony docs for any project, not Paperclip-specific by default.
70. Keep Paperclip references as adapter examples only.

### R3F Visual Engine

71. Retain the R3F tactical map as the product's reference surface.
72. Replace visual labels that imply one internal org with neutral org labels.
73. Add a synthetic `demo-org` scene fixture.
74. Add screenshot gates for the standalone demo.
75. Keep Meshy assets if license/source metadata is safe.
76. Add asset provenance metadata for generated GLBs and thumbnails.
77. Move paid-generation ledgers into docs only if sanitized.
78. Add a lightweight no-asset fallback mode.
79. Add deployment docs for static hosting.
80. Add Electron readiness docs only after web demo is stable.

### Release and Governance

81. Add a pre-release standalone audit checklist.
82. Add CI leakage checks for company names and private paths.
83. Add CI size checks for large binary assets.
84. Move very large GLBs to LFS or external release assets if needed.
85. Add release notes that describe product capability, not internal client usage.
86. Add a clean-clone smoke test.
87. Add a "new adopter in 30 minutes" acceptance test.
88. Add a "marketing team without dev team" onboarding path.
89. Add a "dev/AI team integration" onboarding path.
90. Add a roadmap label for standalone-product blockers.

## Immediate Removal Candidates

- `motionsites-export/`: private third-party export material; keep ignored and do not commit.
- `.codegraph/`: local index cache; keep ignored.
- `.readme-gen.json`: local generation metadata; keep ignored.
- `.DS_Store`: local OS noise; keep ignored.

## Immediate Review Candidates

- `docs/plans/cambium-cortex-renderable-map.md`: useful, but must remove absolute local paths before commit.
- `docs/plans/cambium-isometric-moodboard.md`: useful, but currently names MultiCA, TeamForge, live tenant state, and local paths.
- `docs/plans/cambium-current-visual-review.md`: useful as R3F evidence, but mentions local PAI tooling and local runtime URLs.
- `docs/cambium-composition-technical-reference.html`: likely publishable after visual/style review and leakage scan.
- `docs/plans/assets/*`: commit only reviewed screenshots/assets that support standalone docs.

## Definition of Done

Cambium is standalone-ready when a clean clone can run the core tests, launch a synthetic demo org, render the fractal tapestry, complete a generic quest flow, and explain integrations as optional adapters without requiring Thoughtseed, private exports, live credentials, or company-specific memory.
