# Cloudflare Adapter

Cloudflare is an optional infrastructure adapter for Workers, Vectorize retrieval, static hosting, and scheduled operator surfaces. It is not required for local demos. Private company knowledge is sourced from GitHub, not R2 or D1.

## Port

`deployment`, `memory`, and `scheduled-runtime`

## Inputs

- Worker deploy events.
- Pages/static hosting deploy events.
- Vectorize index availability.
- Scheduled heartbeat triggers.

## Outputs

- Deployment evidence for quest arcs.
- Vectorize retrieval index for policy-screened GitHub knowledge projections.
- Optional scheduled wake loop infrastructure.

## Failure Mode

When Cloudflare credentials are absent, Cambium uses local sqlite memory and local CLI execution. Missing Cloudflare resources should be surfaced as adapter unavailable, never as product failure.

## Tenant Mapping

Use config to map account/project names to portable org slugs. Do not encode account-specific IDs in committed files.

## Privacy Boundary

Never commit account IDs, API tokens, deploy logs with private hostnames, captured request payloads, GitHub read tokens, or raw private-repository content. Public docs should use `cambium.example.com` and other `example.com` domains.
