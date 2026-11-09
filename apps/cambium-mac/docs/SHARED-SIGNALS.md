# Shared signals and native Inbox

3 November 2026. Source implementation with local Worker/SQLite, Swift and
synthetic-owner verification. Standard-mode delivery requires the existing
native identity activation and separately approved deployment/migration.

## Daily flow

Open Inbox to read signals or create an observation. A signal can remain in the
workspace Inbox without a project. The project picker uses the served mapped
portfolio; a project dossier's **Open project Inbox** action opens the same
screen filtered by its exact canonical ID. Creating an observation from that
filtered screen preselects the project, and the association remains editable.

Signal detail shows title, body, source system/record/version, observation time,
revision and project associations. Save creates a record or updates the selected
revision. Load more follows the owner cursor. Existing Command-1 through
Command-9 and Command-0 navigation is preserved; Inbox is available through the
sidebar and Go menu without duplicating those shortcuts.

Unknown save outcomes retain their operation ID and exact payload, locking
editing/selection until **Retry original save** reconciles the original request.
A definitive validation rejection (400) permits correction without discarding
the fields. Revision/operation conflicts remain explicit errors; they never
overwrite newer backend state. Full conflict review belongs to the next sync
tranche.

Drafts survive navigation within the same window in memory. They are not yet a
durable offline outbox and are cleared on sign-out/scope change. Closing the app
can lose unsaved drafts. The synthetic demo's signals are in-process data; the
real backend's signals and receipts are durable D1 records.

## Owner API

Implemented routes:

| Method | Route | Result |
| --- | --- | --- |
| GET | `/v1/signals/{tenant}` | Scoped list with optional `projectId` and `cursor` |
| POST | `/v1/signals/{tenant}` | Capture with caller operation identity |
| GET | `/v1/signals/{tenant}/{id}` | Scoped detail |
| PUT | `/v1/signals/{tenant}/{id}` | Expected-revision update with immutable source provenance |

Wire shapes and bounds: [wave contract](../../../.planning/native-mac/SHARED-SIGNALS-WAVE-1.md).
Requests use the existing native bearer verifier and the exact current principal/
tenant. Foreign identity aliases and credential mixtures are refused. Server
errors use fixed codes; responses are private/no-store. Source references accept
clean HTTP(S) URLs without credentials, queries or fragments; original human
observations may have no reference. The source label is provenance, not proof
that an external producer was authenticated.

The migration `0102_shared_signals.sql` uses a receipt-insert trigger to make a
signal mutation and its receipt atomic. Updates compare the expected revision.
An exact retry returns its original snapshot, even if its associated project has
since left the catalog. A different request under the same operation ID conflicts.
New associations are checked against the current display catalog, including
display-only source proposals. Such links create no operational admission,
runtime Work join or tenant grant. Records are principal-scoped in this first
founder/operator slice; this does not implement cross-member sharing.

The migration is prepared source only. Do not apply all outstanding production
migrations merely to activate this table; use the reviewed owner migration packet.

## Verification

From the repository root:

```sh
node --test workers/quests/src/shared-signals.test.ts
./apps/cambium-mac/tools/probe-current-signals.sh
swift test --package-path apps/cambium-mac --filter CambiumNativeTests
./apps/cambium-mac/build.sh
./apps/cambium-mac/tools/verify-bundle.sh
./apps/cambium-mac/tools/snap.sh /tmp/cambium-inbox-review inbox
```

The wire probe runs the actual current TypeScript handler and migration in
local SQLite, creates/replays/updates a synthetic signal for `sapling:cambium`,
tests foreign-tenant denial, then decodes the responses through the Swift HTTP
client. Generated outputs are temporary, with no live credentials or runtime
calls. The default Swift suite skips the opt-in generated-wire test when its
environment is absent; the probe explicitly supplies it.

The signal-specific transport permits 64 KiB only for exact signal capture/update
routes. Existing Gate/Launch request limits remain unchanged. Tests exercise
same-operation retry, null reference encoding, malformed/foreign responses,
sign-out during a read, clean-reference policy and route-specific body caps.

## Delivery boundaries

The requested hosted Phloem fan-out was attempted. Its batch compatibility
resolver returned unavailable; direct hosted launchers then stopped at
`credit-refill-owner: qualification-held`, exit 125, before inference. The
allowlisted Claude fallback launcher also failed on a missing local launcher
dependency. Two isolated non-Sol fallback workers produced the source changes;
their results and a separate boundary review were integrated and verified.
No hosted provider execution or provider attribution is claimed for this build.
No routing configuration or qualification gate was changed.

Still required for connected use: owner activation of native sign-in and these
routes/schema, and a separately owned Field Report editor adapter with its
reviewed authentication contract. Existing Field Report data is not migrated by
this slice. Directions, selected-collection search, durable offline sync,
automatic acceptance and the real signal-to-result pilot remain later tranches
of the [integration plan](../../../.planning/native-mac/FIELD-REPORT-INTEGRATION-PLAN.md).
