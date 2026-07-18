# Lead Ecosystem Contract Foundation

Status: L-1/L0 contract foundation. No provider is activated by this document or its companion contracts.

## What this architecture makes canonical

Thoughtseed keeps one control plane and one top-level composition:

```text
Hermes operator intake
  -> Cambium task / lease / fencing / approval / receipt authority
  -> genesis -> taste -> build -> ops
                               -> lead-ops@1 (versioned subgraph)
  -> tenant outcome ledger
  -> privacy-approved derived learning
  -> cortex
```

The lead subgraph lives beneath `ops`; it is not a second conductor. Product packets bind a product to versioned capabilities and policy. Typed provider ports can later satisfy those capabilities, but a packet cannot widen the port contract and a provider never owns approval, spend, or canonical task state.

## Four planes

| Plane | Owns | Must not own |
|---|---|---|
| Cambium control | Tasks, leases, fencing, product policy, exact approvals, writer leases, spend gates, execution attempts, reconciliation, receipts | Provider credentials in records; raw shared-memory contact data |
| Hermes operator | Allowlisted intake, bounded commands, truthful redacted status and next action | Canonical workflow state; document bytes; direct provider mutation |
| Capability | Specialist judgment, marketing methods, loop anatomy, quality checks | Credentials, workflow state, spend, approval, or network execution |
| Provider adapter | One typed observation or mutation port under a fixed binding | Tenant selection by caller, cross-port authority, hidden retries, canonical identity |

## Stage contract

| Stage | Purpose | Representative future providers | L0 boundary |
|---|---|---|---|
| Discover | Produce bounded market/company observations from an ICP | ScrapeGraphAI, Explee search | Observation only; provenance and observed time required |
| Capture | Admit source records into tenant scope | getleads MCP, explicit imports | Caller cannot override tenant/account/project/campaign binding |
| Enrich | Resolve identity continuously, apply suppression, compute evidence-bound scores | Explee enrichment, Apollo enrichment | Provider facts remain observations; brand precedence is forbidden |
| Understand | Form tenant-scoped signals and audience hypotheses | Capability staff plus approved models | No raw identity foldback to shared cortex |
| Create | Produce rights/provenance-bound content assets | marketingskills, ElevenLabs, Runway | Spend, rights, digest, expiry, and human approval remain explicit |
| Engage | Execute one exact approved action through one writer | Apollo or Composio-backed typed port | Disabled at L0; requires writer lease, suppression revision, budget, receipt, reconciliation, kill switch |

`Learn` is not a seventh provider stage. Tenant outcome events are transformed into bounded, privacy-approved aggregates before reaching shared cortex.

## Subscription placement

| Surface | Architectural placement | Contract meaning |
|---|---|---|
| agency-agents | Curated, commit-pinned capability manifest | Staff roster; counts are observations, not API contracts |
| marketingskills | Curated migration into existing skill clusters | Quality methods; collisions and local customizations must be reconciled |
| marketing-loops | Conductor recurrence compiler | Each loop becomes a scheduled Cambium task with cadence, state, idempotency, self-check, stop rule, gate, and receipt |
| Composio | Long-tail action implementation behind typed ports | Breadth does not bypass exact scopes, approval, writer ownership, or reconciliation |
| ScrapeGraphAI | Discover observation adapter candidate | Fixed endpoint/method contract, provenance, rate/budget policy, deterministic fixture |
| Explee | Separate search, enrich, observe, and mutation adapter candidates | Never expose the broad method/path proxy as a Cambium port |
| Apollo | Enrichment candidate and possible engagement writer | It may engage only when selected as the sole tenant/campaign/channel writer |
| getleads.io MCP | Capture reference adapter | Demonstrates the custom-wrapper contract and preserves source provenance |
| ElevenLabs / Runway | Gated create adapters | Rights, cost, input/output digest, expiry, and approval required before invocation |

Provider catalog sizes, company counts, deliverability percentages, and persona/skill counts are volatile telemetry. They are deliberately absent from executable contracts.

## Identity and suppression

Identity resolution owns tenant-scoped aliases and supports ambiguous, matched, merged, split, and review-required outcomes. Every change carries a revision, confidence, provenance, observation time, and lineage. Replaying an observation is idempotent; a provider refresh cannot erase suppression.

Suppression dominates approval. Opt-out, bounce, consent/lawful-basis failure, expiry, or retention disposition blocks `create` and `engage` even when an earlier action was approved. Merge/split behavior must preserve the stricter applicable suppression until human review resolves ambiguity.

## Spend and execution

The schema vocabulary is `none`, `subscription`, `metered`, and `gated`.

- `none` is limited to local/non-provider work and cannot disguise provider I/O.
- `gated` preserves the current local organ approval behavior.
- `subscription` and `metered` can be described at L0 but remain runtime-refused.

The later runtime implementation must add atomic budget reservation and usage ledgers before either new paid tier can execute. Until then rejection creates no spawn, queue, retry, or rollback state.

## Product packets

Existing packet fields remain valid. The optional provider/data policy section grants no authority when absent. A proof-only packet cannot enable mutation. iBerev, AISEO, and GEO enter as distinct proof-only control packets with no active provider binding; they are not aliases for IVerif.

## Next authorized L1 slice

Implement one fixed-tenant, read-only Explee observation adapter behind the contract catalog:

1. Pin one API/schema version and a narrow endpoint/method allowlist.
2. Bind tenant, account, project, and campaign server-side; reject caller overrides.
3. Use typed secret references only; never serialize credentials.
4. Validate deterministic request/response fixtures with a network sentinel first.
5. Add redaction, size/time limits, bounded retry for safe reads, drift refusal, and an immutable observation receipt.
6. Keep replies, budgets, sending, autopilot, and every mutation capability disabled.
7. Prove replay, provenance, suppression preservation, and operator-safe receipt before any live canary is separately authorized.

That L1 slice is read-only adapter work. Live network proof, paid enrichment, asset generation, outbound engagement, and shared learning remain later gates.
