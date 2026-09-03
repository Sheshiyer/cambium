# Local runtime → Thoughtseed portfolio → Labs vault map

Status: observed, proposal-only, read-only. Updated 2026-08-31.

This map explains how the customized local Temperance, GSD, OmniRoute, and
Superset surfaces relate to the Thoughtseed portfolio, the `thoughtseed-vault`
Git repository, and the Hermes EC2 execution peer. It is a Cambium contract;
it does not copy host state, move files, or authorize an external mutation.

## The authority split

| Layer | Canonical owner | Safe projection | Never becomes |
| --- | --- | --- | --- |
| Host routing | Temperance + OmniRoute | provider attribution and bridge health | project, vault, or approval authority |
| Project rail | each repository’s `.temperance/`, `ISA.md`, `.planning/` | bounded identity and acceptance pointers | host runtime store |
| Operator workspace | Superset | portable `.superset/setup.sh` and `.superset/run.sh` | credential or deployment authority |
| Portfolio | reviewed Vault registry + root map | Mission Control catalog and Canopy visibility | D1 Goal Graph writer |
| Company context | Labs vault (`Sheshiyer/thoughtseed-vault`) | guarded Git read model for Hermes | raw memory/session store |
| Operations | Cambium D1 Goal Graph | Mission Fabric read model | portfolio classifier or Telegram sender |
| Signal and delivery | Hermes on EC2 + Telegram | receipt pointers | Cambium acceptance or doctrine |

The D1 Goal Graph remains the sole operational writer. Hermes remains the
Telegram transport. A generated map, Workbench card, skill overlay, or receipt
can expose evidence and propose a next step, but cannot silently promote it.

## Host surfaces and repository mapping

The names below are logical aliases. Their machine-local locations stay outside
the repository and are intentionally not copied into this document.

| Alias | Observed responsibility | Cambium / portfolio relationship | EC2 treatment |
| --- | --- | --- | --- |
| `TEMPERANCE_HOME` | routing eligibility, combos, bridge, skill discovery | points to Cambium’s project rail; supplies no project or vault authority | never sync the runtime home |
| `GSD_HOME` | host defaults (`resolve_model_ids=omit`) | project-local `.planning/` wins for Cambium and each sibling repo | never sync host defaults |
| `OMNIROUTE_HOME` | loopback inference transport (`20128`) | attribution evidence beneath Temperance only | never sync runtime store or credentials |
| `SUPERSET_HOME` | operator workspace and Hands binding | portable setup/run contract may live in a repo’s `.superset/` | sync reviewed portable contracts only |

The observed Temperance surface reports a 37-repository rail census and an
809-entry skill index. Those are host observations, not a request to mirror the
host registry into the vault or Worker.

## Portfolio placement

`PORTFOLIO_ROOT` is a shallow repository/folder census. Its
`portfolio-map.v1.json` is explicitly proposal-only. Cambium is mapped as:

- `sapling:cambium` — the repository WorkObject;
- `program:cambium-operating-fabric` — the bounded internal program;
- `cambium · fabric` — the Superset operator role;
- `thoughtseed-labs` — the Cloudflare profile for the Labs account;
- `cambium-quests` — the Worker/read-model surface (active version
  `dd40e9d5-081a-4b75-b8e3-4ee979a6d5c3`, 100% traffic, `0/11` cron active).

The authenticated Workbench readback is consistent with the catalog: 72 source
records classify as 17 Saplings, 40 Branches, and 15 Programs; 71 cards are
active because one terminal closeout is intentionally kept in Project Archive /
Finished Work. Needs Review is zero. This is visibility evidence, not an
operational admission or a new writer.

The portfolio catalog is visible in Mission Control and Mission Fabric, while
operational admission still requires an explicit packet, signed Gate, and D1
readback. The portfolio root and sibling folders are not operational writers.
Nested or shared repositories retain explicit relationships; they are not
flattened into one WorkObject.

## Labs vault placement

`LABS_VAULT` is the Git checkout for `Sheshiyer/thoughtseed-vault` and the
company’s durable, human-readable context. Its `00-meta/` contracts define the
system-of-record split, Wrangler profile map, and founder sync rules. The
vault’s `.temperance/README.md` is a project-side packet; it does not replace
the host runtime. Vault `.planning/` is vault-owned planning and does not
replace Cambium’s ISA or GSD state.

The following remain private or ignored and must not be projected to Cambium,
Git, or EC2: local memory databases, raw transcripts, native sessions, access
tokens, provider stores, runtime logs, and local client state. R2 is an
encrypted one-way backup, not a second Git transport or operational ledger.

## EC2 sync: intended contract and verified state

Hermes/EC2 may act as the steward for the existing
`founder-vault-git-sync.sh` helper. The only permitted transport is:

```text
origin → thoughtseed-vault → guarded fetch/rebase → Hermes read model
```

An optional push is allowed only after the dedicated vault repository is clean,
conflict-free, on its approved branch, and founder-reviewed. The archived
`Sheshiyer/thoughtseed-labs` remote is not a transport and must not be restored.

Founder authorization on 2026-08-31 cleared the vault-only synchronization
gate. The sibling commits `884aeb46` and `fed316cc` were reconciled by merge
commit `5960d3dba3b7d50e3bd6ebaf6a5a083bc2269659`. Its tree is byte-identical
to the newer pre-merge `origin/main` tree, so reconciliation changed ancestry
without reintroducing the superseded coordinator declaration.

The founder checkout, `origin/main`, GitHub `main`, and Hermes/EC2 `main` now
resolve to that exact commit. The EC2 checkout reports `main` tracking
`origin/main` at ahead 0 / behind 0; `hermes-repo-sync` and
`hermes-vault-sync` both returned `success`, and both timers remain active.
The founder checkout's 128 dirty-path contents were preserved byte-for-byte:
the pre/post manifest digest is
`92c59d03df98ddf22ace4cf6b3165f165f7d761c60ddb75a0f4b4ae433d3b3e9`.
The classification changed from 36 tracked plus 92 untracked paths to 37 plus
91 only because the reconciled origin began tracking the locally edited
project-map JSON.

The post-index EC2 readback reports 63 uncommitted paths after read-model
regeneration. That count is not presented as a clean-tree receipt; exact
branch, upstream, head, service result, and timer state are the synchronization
proof. EC2 still must not receive any host runtime home, local database,
credential, raw memory, log, or generated runtime cache through Git.

The clean local Hermes runbook source was also corrected to use canonical
`origin` / `thoughtseed-vault` for founder pushes, write-back merges, and the
deploy key. This documentation correction was not deployed to EC2.

## Context, skills, and flow

```text
Vault company notes ──guarded Git──> Hermes read model
Host skill clusters ──loadout digest─> Cambium read-only overlay
VISION → MISSION → ISA → GSD → bounded execution → evidence → learning
Telegram signal → Hermes classification → Mission Control → signed Gate → D1
```

This preserves the desired consistency without collapsing the planes:

- company context is durable, reviewed, and Git-synced;
- private agent memory stays local and is never a raw vault dump;
- skills are loaded by the host/Hermes owner and only projected as bounded
  loadout evidence;
- Cambium exposes portfolio and mission projections but cannot mint authority;
- receipts prove what happened, while doctrine and operational truth remain at
  their existing owners.

## Evidence and remaining gates

The machine-readable contract is
[`local-runtime-portfolio-vault-map.v1.json`](local-runtime-portfolio-vault-map.v1.json).
Its evidence pointers include the Cambium project packet, the portfolio/Mission
linkage contract, the system capability map, and the Vault’s system-of-record
and founder-sync contracts, plus the corrected Hermes vault-sync runbook.

Vault branch reconciliation and the exact EC2 checkout/branch receipt are now
complete. They authorize no further mutation. Host, registry, provider,
deployment, D1, Telegram, Cloudflare, Worker, binding, route, credential, and
production changes remain separately owner-approved and rollback-gated.
