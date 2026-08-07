# Thoughtseed Portfolio Workbench

A proposal-only founder workbench for reconciling repository identity, origin,
WorkObject grammar, planning authority, and then sequencing the Thoughtseed
portfolio before any runtime integration.

The artifact contains the verified 72-object catalog snapshot, a privacy-safe
44-reference repository-evidence snapshot, and the five canonical organ
workflows. Seven smart views reveal ongoing, paused,
white-labelable, review-needed, unplanned, and historical work. Local signals,
five intentional horizons, priorities, tags, next actions, evidence, and
optional delivery previews stay in browser storage until exported.

Unplanned work starts with `Inspect & reconcile`. Scheduling stays locked until
an exact repository or explicit gap, origin, origin-derived type, planning
authority, and the repository/issues/legacy-evidence review gates agree. Only
Thoughtseed-originated ventures become Saplings; every client project is a
Client Branch even when new; shared Thoughtseed capability work is an Internal
Program. Client Branch describes a portfolio WorkObject, never a Git branch.

Untouched work remains explicitly Unscheduled. Source facts, source-derived
overlays, and reversible local intent are always labeled separately.

## Use

```bash
pnpm install
pnpm dev
```

For the portable artifact:

```bash
pnpm check
python3 -m http.server 4176 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4176/bundle.html`. The local HTTP path is the
verified preview surface; direct `file://` persistence is browser-dependent.

`bundle.html` contains its own CSS, JavaScript, and portfolio data. It makes
no network requests and cannot activate tenants, assign agents, mint receipts,
or send Telegram traffic. Valid v1, v2, and v3 packets migrate losslessly into v4 state;
unreadable or unknown-WorkObject packets pause autosave until explicit Import
or Reset, preserving the original payload.

## Authority boundary

- Vault owns canonical classification.
- The owning GitHub repository owns project-local issues, plans, and roadmaps.
- Cambium owns cross-portfolio sequencing and unresolved repository mappings.
- Tool/session/date files are historical evidence, not current planning authority.
- Cambium Goal Graph/D1 remains the operational writer.
- Hermes remains the Telegram transport.
- Workbench exports proposal packets for review and later integration.
- Candidate owner/name matches remain `unverified` until immutable GitHub identity metadata is available.
- `No project repository` is available only when the WorkObject has no catalog repository evidence; it cannot bypass a mapping gap.
