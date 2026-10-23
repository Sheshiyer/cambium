# Employee growth drafting workflow v1

Plexus Clio submits confirmed, bounded organization draft requests to Cambium.
Cambium is the admission and state authority; Hermes consumes the existing native
execution queue and returns a fenced execution outcome. A returned draft does
not authorize publication, client work, canonical vault edits, or general tools.

## Identity and scope

Only an active, unexpired bridge **member** token can read the growth projection,
submit a request, or read that member's requests. Identity and tenant come from
the canonical member binding. Admin and assignment tokens cannot impersonate
an employee at these endpoints. Organizational capability must be explicitly
configured, and the configured active runner member must share the organization.
There is no inferred client-project membership and no invented `project_id`.

Worker configuration:

- `GROWTH_WORKFLOW_TENANTS_JSON`: JSON array of explicitly admitted tenant IDs.
- `GROWTH_WORKFLOW_RUNNER_MEMBER_ID`: canonical member ID used by the runner.
- `GROWTH_WORKFLOW_MAX_PENDING`: integer 1–10; default 10 per member/tenant.
- `GROWTH_WORKFLOW_MAX_DAILY`: integer 1–50; default 50 per member/tenant/UTC day.

Missing or malformed capability configuration fails closed. The D1 admission
statement checks quotas atomically. Exact replays still return their original
request; altered intent under the same key conflicts. The pending quota consults
canonical terminal execution rows so a failed projection write cannot exhaust
pending slots indefinitely. Daily counts include failed and completed requests.

## Employee API

All routes use the existing bridge member Bearer credential.

- `GET /v1/bridge/growth/context`: reviewed employee-safe excerpts, source commit,
  projection digest, original source-file digests, excerpt digests, allowed roles
  and context references. The Worker does not open or ingest the whole vault.
- `POST /v1/bridge/growth/requests`: closed JSON object containing `requestId`,
  `scope: "org-growth"`, `role`, `objective` (1–4000 characters), and `contextRefs`
  (a nonempty subset of the four allowlisted documents). The server pins the
  projection/source version and derives employee identity. Returns a stable
  `growth_<digest>` request ID. No prompt, model reply, or caller-supplied identity
  is treated as an approval receipt.
- `GET /v1/bridge/growth/requests/:id`: member/tenant-scoped status, objective,
  source pins, and bounded draft result. Other members receive 404.

Roles are `ceo`, `scientist`, `engineer`, `designer`, `synthesist`, and `hermes`.
They select a drafting perspective; they do not expand the admitted authority.

## Native execution and results

Migration `0011_growth_workflow.sql` adds `bridge_growth_requests` to the existing
`BRIDGE_DB`. The existing D1-backed directive and execution stores remain the
queue, claim, fencing, terminal outcome, and acknowledgement authority.

The command is `growth.request.draft`. Its input has schema
`thoughtseed.growth.request.v1`, employee `requestId`, `tenantId`, `memberId`,
`scope`, `role`, `objective`, `contextRefs`, `contextProjectionDigest`,
`contextSourceCommit`, and `externalAction: "none"`. The envelope target is the
configured runner member, distinct from the requesting employee.

An executed attestation includes `growthResult` with schema
`thoughtseed.growth.result.v1`, `requestId`, `role`, `content` (1–16000 characters),
`sources: [{path,digest}]`, `approvalState: "draft"`, and `externalAction: "none"`.
Cambium validates the result digest and exact requested source-file digests
against the immutable admitted source snapshot before recording the fenced outcome.
Exact employee retries retain the originally admitted pins across projection updates;
changed input under the same request key still conflicts.

States are `queued`, `running`, `retrying`, `failed`, and `draft_ready`.
Member result reads derive terminal status/results from the canonical execution
row when the task projection is stale. Terminal replay also repairs projection
writes. Neither a queued response nor a model response establishes completion.

The context projection is generated from committed, reviewed excerpts of four
allowlisted growth playbooks. Hermes must validate pinned context and full-file
source digests before inference. Changed source pins require a new reviewed
request; admitted input is not silently rewritten after a context update.

## Deployment boundary

This is source implementation, not live acceptance. Deployment requires the
reviewed Worker candidate, migration, explicit organization/runner capability,
matching Hermes code and vault source pins, protected Clio relay, and enabled
runner execution. Keep existing runtime settings unchanged until an owner
approves the concrete activation and rollback plan. Never enable legacy ACK to
work around missing execution proof.
