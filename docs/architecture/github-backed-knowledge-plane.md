# GitHub-backed knowledge plane

## Decision

Company knowledge for Hermes, Plexus, Cambium, the Fractal Tapestry, and
inference is read from the private GitHub repository
[`Sheshiyer/thoughtseed-labs`](https://github.com/Sheshiyer/thoughtseed-labs).
GitHub is the knowledge source of truth. This plane does not read or write
Cloudflare R2 or D1.

The migration is deliberately narrow. Existing D1 and R2 bindings that support
bridge execution, approved operational receipts, and portfolio evidence remain
outside this knowledge plane; they are not company knowledge stores.

## Spine

```mermaid
flowchart LR
  User["Founder, team, or model request"] --> Plexus["Plexus: identity, authorization, GitHub-App broker"]
  Plexus --> Policy["Verified source + routine-path policy"]
  Policy --> GitHub["Private GitHub: thoughtseed-labs"]
  GitHub --> Projection["Bounded markdown projection"]
  Projection --> Vectorize["Cloudflare Vectorize"]
  Vectorize --> Inference["Inference retrieval"]
  Inference --> Tapestry["Cambium Fractal Tapestry"]
```

Plexus does not store, curate, or infer knowledge. Its existing D1 resolver
retains identity and verified repository authority; its Worker is the only
GitHub-App credential broker. The Worker's internal context routes retain their service-token and tenant checks;
Plexus role enforcement for user-facing retrieval is a separate route-wiring
task and must fail closed before exposure.

## Plexus GitHub-App gateway contract

Plexus resolves the verified TeamForge project repository, mints a short-lived
GitHub App token scoped to that numeric repository, resolves one full Git commit
SHA, and reads only exact routine-allowlisted Markdown paths at that revision.
Cambium calls Plexus, never GitHub. The response carries repository, commit,
file SHA, path, and bounded excerpts, but never a GitHub token or source response body.

Required runtime configuration:

- TeamForge: `TF_KNOWLEDGE_GATEWAY_TOKEN` secret, verified workspace/project
  IDs, and `TF_KNOWLEDGE_ROUTINE_ALLOWLIST_JSON` policy. This is the sole
  GitHub-App credential boundary.
- Cambium: `PLEXUS_KNOWLEDGE_URL` and `PLEXUS_KNOWLEDGE_TOKEN`; this bearer
  authorizes only the gateway and is not a GitHub credential.
- `GITHUB_AGENT_TOKEN` remains separate and governed for command/write flows.

Example allowlist value (provision as a Worker secret or encrypted deployment
configuration; do not put sensitive paths in public artifacts):

```json
{
  "daily-standup-digest": [
    {
      "id": "system-records",
      "title": "System of records",
      "paths": ["00-meta/system-of-records.md"]
    }
  ]
}
```

## Retrieval and inference

Hermes owns the Plexus-to-Vectorize synchronization job. It reads the same
allowlisted, policy-screened gateway projection, projects bounded chunks with
commit/file provenance, and upserts only those chunks to Vectorize. Inference
queries Vectorize with tenant and kind filters; raw GitHub documents never go to
the browser or Telegram client.

The first allowlist must exclude HR, compensation, finance, invoices, legal,
contracts, payment records, credentials, private transcripts, agent outputs,
heartbeats, archives, and client material unless a separate visibility policy
allows a specific path. A source or provider failure returns a bounded
`blocked-no-signal` result, never a fallback scrape or an invented answer.

## Retired path

`CONTEXT_PROJECTIONS`, the R2-backed `POST /v1/context/projections` writer, and
the `CONTEXT_PROJECTION_WRITE_TOKEN` contract are retired for knowledge. The
route returns HTTP 410. `CAMBIUM_CORTEX` remains the Vectorize retrieval index;
it is not a source of truth.

## Rollout

1. Configure the dedicated Plexus gateway bearer, verified project scope, and
   one reviewed routine allowlist path.
2. Configure Cambium's gateway URL/bearer and verify provenance plus
   `blocked-no-signal` failure behavior.
3. Enable Hermes' policy-screened Vectorize synchronization.
4. Wire Plexus role policy into user-facing retrieval before exposing it beyond
   the current internal context route.
5. Only then remove the legacy R2 projection implementation and tests in a
   separately reviewed cleanup change.

No production deployment, GitHub credential creation, Vectorize upsert, or
Plexus/D1 mutation is performed by this repository change.
