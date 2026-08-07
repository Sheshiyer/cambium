# Thoughtseed Portfolio Workbench

A founder-only hosted admin workbench for mapping the Thoughtseed portfolio,
reconciling repository identity, origin, WorkObject grammar, and planning
authority, then saving bounded intake and project-creation intents through the
Cambium Worker.

The artifact contains the verified 72-object Thoughtseed catalog snapshot, a
privacy-safe 44-reference repository-evidence snapshot, and the five canonical
organ workflows. It also contains a proposal-only root map for 47 Thoughtseed
folders and the R2-synced Thoughtseed vault copy. Tryambakam · Noesis remains
preserved in the static relocation evidence but is intentionally absent from
the active Workbench UI. Seven smart views reveal ongoing, paused,
white-labelable, review-needed, unplanned, and historical Thoughtseed work.
Browser storage is a recovery draft, never the durable authority.

Unplanned work exposes one `Review repository & map` action. Scheduling stays locked until
an exact repository or explicit gap, origin, origin-derived type, planning
authority, and the repository/issues/legacy-evidence review gates agree. Only
Thoughtseed-originated ventures become Saplings; every client project is a
Client Branch even when new; shared Thoughtseed capability work is an Internal
Program. Client Branch describes a portfolio WorkObject, never a Git branch.

`New Thoughtseed project` records a governed creation intent. The UI derives
Sapling, Internal Program, or Client Branch from origin and never accepts an
absolute or nested destination. Explicit local-founder intents with known
origin become execution-ready; agent, RBAC, dgchat, and system intents remain
at Founder Gate until the Worker resolves an authoritative Thoughtseed Gate
record that binds the normalized intent.
Unknown origin remains Needs Review and cannot execute.

Untouched work remains explicitly Unscheduled. Source facts, source-derived
overlays, and reversible local intent are always labeled separately.

The hosted intake actions are server-authoritative at the boundary:

1. the authenticated browser posts one closed-schema action to
   `/v1/admin/portfolio/actions`;
2. the Worker records immutable, idempotent evidence in the
   `THOUGHTSEED_VAULT` R2 binding;
3. only after durable evidence exists, the Worker creates a bounded repository
   review, Founder Gate, or local execution trigger in the action queue;
4. a later reviewed flow may translate that trigger into the D1 Goal Graph,
   which remains the sole operational writer.

The browser never receives an R2 key and never writes directly to R2, KV, D1,
GitHub, or Telegram. Import, Copy, JSON, Markdown, and Reset controls have been
removed from the hosted header.

The trusted local executor is the only component in this repository that may
create a project folder. It creates a shallow
`<projects-root>/thoughtseed/<slug>` Git repository and its project packet from
an approved intent and a selected workflow in the canonical workflow registry:

```bash
pnpm project:birth -- --intent /absolute/intent.json \
  --projects-root /absolute/projects/root \
  --workflow-registry /absolute/workflow-registry.json \
  --workflow-id workflow-id
```

The command is dry-run unless `--execute` is supplied. GitHub creation, remote
push, canonical registry writes, Vault/R2 copy changes, Goal Graph mutation,
and deployment remain separate governed actions.

The CLI directly supports only explicit `local-founder` execution. An
agent/RBAC/dgchat/system intent can execute only when a trusted host integration
injects a Founder Gate resolver backed by the authoritative Gate store; an
inline `founderApproval` object or receipt-looking string is never authority.
The executor also requires the exact reviewed root-map and portfolio-catalog
digests, so a valid-looking stale snapshot cannot create a repository.

## Local verification

```bash
pnpm install
pnpm dev
```

For the generated hosted artifact:

```bash
pnpm check
python3 -m http.server 4176 --bind 127.0.0.1
```

To validate or write the reversible root headers:

```bash
node scripts/generate-portfolio-root-map.mjs --projects-root /absolute/projects/root
PROJECTS_ROOT=/absolute/projects/root pnpm rootmap:headers
```

The first command is a dry run. The writer fails closed on folder drift and may
write only `PORTFOLIO.md` and `portfolio-map.v1.json` at each portfolio root; it
does not create grouping directories or move repositories.

Then open `http://127.0.0.1:4176/bundle.html`. Local preview renders the complete
UI but deliberately disables admin writes because its path is not one of the
authenticated hosted routes.

`bundle.html` contains its own CSS, JavaScript, and portfolio data. Its CSP
permits same-origin connections only, and source auditing permits only the
fixed portfolio action endpoint. Valid v1, v2, and v3 browser drafts migrate
losslessly into v4 state; unreadable drafts pause local autosave while explicit
server actions remain separate.

## Authority boundary

- Vault owns canonical classification.
- The owning GitHub repository owns project-local issues, plans, and roadmaps.
- Cambium owns cross-portfolio sequencing and unresolved repository mappings.
- Tool/session/date files are historical evidence, not current planning authority.
- Cambium Goal Graph/D1 remains the operational writer.
- Hermes remains the Telegram transport.
- Workbench records immutable R2 evidence before it creates a pending governed-intake trigger.
- R2 evidence is not workflow authority; the D1 Goal Graph remains the sole operational writer.
- Candidate owner/name matches remain `unverified` until immutable GitHub identity metadata is available.
- `No project repository` is available only when the WorkObject has no catalog repository evidence; it cannot bypass a mapping gap.
- Local project birth leaves a repository-local ingestion receipt and project-index proposal in `pending-cambium-ingestion`; it does not claim index authority.
- Production remains unchanged until packet review #292 clears promotion gate #293.
