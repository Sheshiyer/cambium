# Client commands and local helpers

All adapters read the same Cambium skill. Their filenames do not fork the workflow or grant actions beyond the user's request.

| Client | Invocation |
| --- | --- |
| Codex skill | `$sapling-lifecycle review temperance` or select Sapling Lifecycle from the skill menu |
| Codex prompt adapter | `/prompts:sapling-review temperance` in clients supporting custom prompts |
| Claude Code | `/sapling-review temperance` |
| OpenCode | `/sapling-review temperance` |
| Grok command | `/sapling-review temperance` |

The other suffixes are `new`, `run`, `graph`, `draft`, `grow`, `learn`, and `status`. For example: `/sapling-run iverif growth`, `/sapling-draft temperance producthunt`, or `/sapling-review all`. In Codex prompt syntax use the corresponding `/prompts:sapling-…` form. Discovery may require a new client session. Installed file presence is not proof that a client invoked a workflow successfully.

## Install and rollback

Run these from the Cambium checkout that will remain the maintained source:

```bash
node .agents/skills/sapling-lifecycle/scripts/install.mjs dry-run
node .agents/skills/sapling-lifecycle/scripts/install.mjs install
node .agents/skills/sapling-lifecycle/scripts/install.mjs check
node .agents/skills/sapling-lifecycle/scripts/install.mjs uninstall
```

`--source-root` selects a different Cambium checkout; `--home` supports isolated test directories. Dry-run is the default and performs no installation. The local ownership manifest records source and artifact digests. Check reports drift. Install refuses unowned, modified or symlinked destinations instead of replacing them. Uninstall removes unchanged pack-owned files and preserves modifications; it does not remove the canonical repository skill.

Optional Grok workflow copies require explicit `--vault-root` and `--with-workflows`. They include the four vault-owned Rhai sources and a provenance comment. Existing unowned workflow files are conflicts, even if a previous tool installed them. Do not delete them to force installation. Resolve ownership deliberately or install command adapters without optional copies and invoke the existing project workflow route. The GTM workflow's local ignored body is not silently vendored.

```bash
node .agents/skills/sapling-lifecycle/scripts/install.mjs dry-run \
  --vault-root "$THOUGHTSEED_VAULT_ROOT" --with-workflows
```

To install just the missing product graph while preserving older sync-owned copies:

```bash
node .agents/skills/sapling-lifecycle/scripts/install.mjs install \
  --vault-root "$THOUGHTSEED_VAULT_ROOT" --clusters-root "$SAPLING_CLUSTERS_ROOT" \
  --workflow sapling-product-loop
```

Use the same source-root, vault-root, cluster-root and workflow-selection flags
with `check` to reproduce the installed adapter contents. These bindings stay in
local generated wrappers. Environment defaults are `CAMBIUM_ROOT`,
`THOUGHTSEED_VAULT_ROOT` and `SAPLING_CLUSTERS_ROOT`; an ignored local
`.local/sapling-lifecycle/roots.json` may hold equivalent bindings.

No client configuration, provider, credentials, permission policy, daemon or scheduler is altered by these adapters.

## Deterministic preparation

The CLI reads packets and prepares reports/dispatch briefs. It does not call a model, run a delivery workflow, save an external draft, or execute arbitrary shell commands. The calling agent follows the skill to perform the selected authorized action and verify its result.

```bash
node .agents/skills/sapling-lifecycle/scripts/lifecycle.mjs review all \
  --vault-root "$THOUGHTSEED_VAULT_ROOT" --clusters-root "$SAPLING_CLUSTERS_ROOT"
node .agents/skills/sapling-lifecycle/scripts/lifecycle.mjs status iverif
node .agents/skills/sapling-lifecycle/scripts/lifecycle.mjs new example-product
node .agents/skills/sapling-lifecycle/scripts/lifecycle.mjs run iverif growth
node .agents/skills/sapling-lifecycle/scripts/lifecycle.mjs draft temperance producthunt
```

`run <product>` without a step returns `selection-required`. Supported step names are `intake`, `provenance`, `mapping`, `onboarding`, `mission`, `build`, `brand`, `media`, `website`, `release`, `draft`, `growth`, `learning`, and `closeout`. A named step returns one prepared brief; it does not execute the action.

Output is stdout by default. Explicit `--out .local/sapling-lifecycle/<report>.json` writes an ignored report. Explicit `--state .local/sapling-lifecycle/<state>.json --step-key <key>` enables local replay-aware preparation. A completed entry needs an attributable proof reference; an unknown or blocked outcome stays held. This is local resume context, not operational approval or acceptance state. Refresh original service status before retrying an uncertain external action.

## Product graph import

First run the existing Rhai workflow through a session that remains alive until its terminal result. Supply `record=false` and `approved=false`, use read-only agents, retain the terminal fence result and reason, and stop on timeout or rejection. Do not weaken a permission policy to make a workflow start.

Then import its scratch graph for deterministic validation:

```bash
node .agents/skills/sapling-lifecycle/scripts/lifecycle.mjs graph temperance \
  --graph "$SAPLING_GRAPH_FILE" --app-root "$PRODUCT_APP_ROOT" \
  --site-root "$PRODUCT_SITE_ROOT" --vault-root "$THOUGHTSEED_VAULT_ROOT" \
  --record=false --approved=false \
  --out .local/sapling-lifecycle/temperance-graph.json
```

The helper checks structure and evidence boundaries, emits a readable diagram, and keeps model fence status separate from graph validity. Missing roots, duplicate identities, dangling edges, contradictory or unsupported evidence, publishing rows, or a record request refuse the read route. A supplied `traced_nodes` set binds merged identities, evidence and status; absent trace provenance stays explicitly unverified. An HTTPS reference alone remains unverified. A returned graph must not be described as a live accepted product workflow.
