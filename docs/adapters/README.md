# Cambium Adapter Boundary

Cambium is a standalone fractal tapestry first. External systems are optional adapters that feed evidence into the same neutral operator loop:

```text
ingest -> route -> act -> viability -> learn -> persist
```

An adapter may provide chat messages, approvals, repository events, deployment events, CRM records, or project evidence. It must not become the product identity, the default tenant, or a required runtime for local demos.

## Adapter Contract

Every adapter should document:

- **Port**: the neutral capability it implements, such as chat, issue tracker, repository, deployment, CRM, or webhook evidence.
- **Inputs**: the external event shape and the minimum fields Cambium needs.
- **Outputs**: the Cambium event, quest evidence, approval, or memory record it emits.
- **Failure mode**: how the adapter fails soft when credentials, network, or provider access are unavailable.
- **Tenant mapping**: how a provider workspace maps to a portable org slug.
- **Privacy boundary**: which provider payloads are redacted or kept out of source control.

## Current Adapter Docs

- [Approval lane](./approval.md): provider-neutral human gate for irreversible moves.
- [CLI approval](./cli-approval.md): local and CI-friendly approval input.
- [Web approval](./web-approval.md): browser approval surface, including non-Telegram miniapps.
- [Generic webhook](./generic-webhook.md): provider-neutral evidence ingress for local demos and first integrations.
- [GitHub](./github.md): repository and issue events as project evidence.
- [Cloudflare](./cloudflare.md): optional deployment and memory infrastructure.
- [Telegram](./telegram.md): one approval/chat surface, not the default product identity.
- [Project feed](./project-feed.md): issue/project evidence from a generic delivery system.
- [Agent plane](./agent-plane.md): agent activity and archive ceremony evidence.
- [Project archive ceremony](../archive/README.md): generic project closeout receipt; adapters may provide evidence.

Start with zero adapters:

```bash
npm run demo:tenant -- --tenant demo-org --force
npm test
npm run standalone:audit
```

Then add provider adapters one at a time. The local synthetic fixture remains the baseline for clean-clone verification.
