# New Adopter in 30 Minutes

Cambium should make sense before any live provider is connected. This runbook gives a founder-led org, a small marketing team, or a dev/AI team a clean path to prove the standalone fractal tapestry with synthetic state only.

The goal is not to recreate a prior live deployment. The goal is to see the reusable machine:

```text
idea -> tenant -> quest ledger -> six-scale tapestry -> optional adapters
```

## Prerequisites

- Node 26.
- A clean clone of this repository.
- No provider credentials.
- No private exports, screenshots, chat dumps, or local operator state copied into source control.

The baseline tenant is `demo-org`. Its evidence uses `example.com` domains and synthetic fixture data.

## 0-5 Minutes: Prove the Clone Is Clean

Run the product checks first:

```bash
npm test
npm run standalone:audit
```

Expected result: tests pass, and the standalone audit finds no private company data in tracked or publishable files.

If either command fails, stop and fix the repository before adding adapters. A standalone product cannot depend on hidden local state.

## 5-10 Minutes: Create the Demo Tenant

Seed the synthetic tenant:

```bash
npm run demo:tenant -- --tenant demo-org --force
```

This writes ignored runtime state under `.operator/`. Treat `.operator/` as local evidence, not product source.

## 10-15 Minutes: Read the Quest Ledger

Render the synthetic quest surface:

```bash
npm run demo:quests -- --tenant demo-org
```

Look for:

- tenant is `demo-org`.
- source says `synthetic-demo-fixture`.
- quest evidence is generic and provider-neutral.
- no private workspace names, live URLs, personal paths, or credentials appear.

This is the founder-readable "you are here" layer of the tapestry.

## 15-20 Minutes: Export the Fractal Tapestry

Export the bounded snapshot:

```bash
npm run tapestry:snapshot -- --tenant demo-org --out /tmp/demo-org.tapestry.json
```

Inspect the JSON for the six recurring scales:

```text
skill -> cluster -> organ -> venture -> company -> portfolio
```

This snapshot is the integration contract for UI clients, docs, and future visual engines. It should explain the map without requiring Telegram, GitHub, Cloudflare, or any prior host organization.

## 20-25 Minutes: Inspect the Adapter Boundary

Read the adapter contract:

```text
docs/adapters/README.md
```

Every adapter must define its port, inputs, outputs, failure mode, tenant mapping, and privacy boundary. Adapters may feed evidence into Cambium, but they must not become Cambium's identity.

The rule: start from zero adapters, then add one provider at a time.

## 25-30 Minutes: Choose the First Real Path

Pick the smallest real integration that preserves the standalone shape.

For a founder-led org:

- Choose an org slug.
- Name the founder approval lane.
- Decide which events need a human gate.
- Keep chat surfaces optional and replaceable.

For a marketing team:

- Map campaigns, briefs, approvals, and launch assets into quest evidence.
- Keep creative memory tenant-scoped.
- Avoid committing vendor exports or customer lists.
- Use the demo tenant as the rehearsal before importing real evidence.

For a dev/AI team:

- Map repository events, deployment events, and agent activity into neutral evidence.
- Keep source-control adapters behind `docs/adapters/`.
- Use `example.com` fixtures in tests.
- Add a fail-soft mode for missing credentials before any provider-specific happy path.

## Acceptance Checklist

Before calling an adopter path ready:

- `npm run standalone:smoke` passes from a clean checkout.
- `npm test` passes without provider credentials.
- `npm run standalone:audit` reports no private leaks.
- the demo tenant can be regenerated with `npm run demo:tenant -- --tenant demo-org --force`.
- the quest ledger can be rendered with `npm run demo:quests -- --tenant demo-org`.
- the tapestry can be exported with `npm run tapestry:snapshot -- --tenant demo-org --out /tmp/demo-org.tapestry.json`.
- adapter docs explain what happens when credentials are absent.
- private runtime folders such as `.operator/` remain untracked.

## What Not to Commit

Do not commit:

- `.operator/` runtime state.
- API keys, tokens, or copied `.env` files.
- provider payload dumps.
- private host paths.
- live customer, founder, or workspace identifiers.
- screenshots that reveal private deployments.

If a real deployment taught the product something useful, convert that learning into a synthetic fixture, anonymized adapter doc, or generic acceptance test before committing it.
