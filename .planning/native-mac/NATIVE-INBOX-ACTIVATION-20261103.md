# Native Inbox activation — 3 November 2026

Status: live native sign-in, owner-served catalog, and project-linked Inbox
create/read/edit/filter acceptance verified on 4 November 2026 (local time).
ISC-3467 and ISC-3672 are satisfied. Operational work admission and Field Report
peer integration remain separate.

## Activated owners

| Owner | Active version | Pinned source | Previous traffic version |
| --- | --- | --- | --- |
| Cambium | `23cf59d1-754a-4cef-be7a-f96fcc072f48` | `b53961011e09701959d59c2bcfebb3253e138001` | `ef6e0c74-697e-4938-9d15-e0e481c80dbe` |
| TeamForge | `7e4634ce-2a28-4c22-8255-30f9a2879039` | `18556245d6fc3769a869a1bdd77d1e8976b9175a` | `dd04f3dc-7cef-42f1-a376-20a0f018c2fe` |

The owner explicitly requested activation in this chat. Both existing Workers
were reconciled with their actual deployed source before rollout. Cambium keeps
the deployed Field Atlas/Founder bookkeeping release; TeamForge keeps the
deployed SFU fixes from PR104. Existing runtime and bindings were compared
before traffic: all 47 Cambium and 37 TeamForge bindings were preserved. Added
only five native Cambium bindings and the two dedicated TeamForge bindings.
Existing observability and logpush settings were preserved.

TeamForge's live database differs from its historical checked-in configuration.
The rollout retains the actual live binding. Read-only verification found the
existing active admin in the exact configured workspace. No identity, role,
workspace membership, catalog association or operational admission was created.

## Storage and authorization

Only migrations 0100, 0101 and 0102 were applied, with their exact names recorded
in the existing migration ledger. Remote readback confirms authorization codes,
sessions, consent intents, shared signals and signal operations tables. The
database recovery bookmark and exact migration digests are held in the private
operator receipt. Unrelated migrations 0010 and 0099 were not applied.

Dedicated service credentials were staged on their two owning Workers without
exposing values to the Mac, model review, source or evidence. The current
identity lookup succeeds for the existing enrolled admin; missing/wrong
credentials, foreign tenant and missing identity checks are denied.

The native browser uses `/founder/native/session/authorize`, covered by the
existing Founder Access application. Its consent form and Secure/HttpOnly/
SameSite=Strict CSRF cookie remain on that exact path. The registered callback,
PKCE exchange and native session API are unchanged. The canonical authenticated
authorize API remains supported. No Access policies were changed. Wrangler's
OAuth profile lacks Access-admin scopes; no alternate credential was used.

## Native candidate and evidence

Native source `007c68aa12f51013c10b51344ce9463bea55342f` builds with clean inputs
and its ad hoc signature verifies. Input aggregate:
`9ae2571a92bf37be3dd8c32960504f859111e69c8f679178f394d99431c2f0c4`.
Browser presentation retains the
actual app window and supports a visible inactive window. Diagnostics contain
only fixed failure categories and AuthenticationServices numeric error codes.

Verification: TeamForge 218 tests and typecheck; Cambium 111 activation-boundary
tests; protected browser-alias 90-test regression suite; Swift identity 47 and
native 39. Final consent/session/signal boundary suite: 90 passing. Updated
native candidate: Core 261 with two opt-in skips, native 39 passing. Final Worker
identity/signal/Mission Fabric/portfolio suite: 204 passing. Current-source
Worker-to-Swift portfolio wire probe passes. A separate offline reconstruction
of the current D1/KV read was accepted by the real Swift decoder, including
strict freshness, with 130 nodes and 202 explicit gaps. This reconstruction was
diagnosis; real native readback below establishes live delivery.

Full repository check in an independent Git checkout at `b5396101`: 2,704 tests
passed, zero failures/skips. The first full pass exposed reconciliation issues;
the final candidate restores main's approved repository-membership/lifecycle
guards, keeps synthetic canaries privacy-neutral and refreshes the Atlas source
fingerprint. These corrections preserve Field Atlas/Founder bookkeeping while
retaining existing main authority checks. The source guard regression suite
passes 60 tests; Atlas and native/identity/signal tests remain green.

The owner completed email-code login and approved the registered client and
tenant. Live diagnosis confirmed `Origin: null` under the original no-referrer
consent page, then Chrome's CSP refusal of the custom callback redirect. The
consent page now uses same-origin referrers and permits the registered callback
scheme; APIs/code redirects retain no-referrer. Exact redirect registry matching,
origin checking, CSRF, PKCE and one-time intent/code checks remain enforced.
Atomic consent/grant SQL now uses RETURNING rows instead of advisory metadata;
replay and misleading-metadata regression tests pass. The consumed intent/code
readback also clarified that later consent_required responses were replay refusals,
not evidence that the initial database writes failed.

Real native standard mode displayed the verified founder, cambium tenant and
15-minute expiry. The signal “Native Inbox activation verification” was created,
listed from the backend, then edited and saved as revision 2. It remains in the
owner's Inbox; the final native session attached it to `sapling:cambium` and
saved revision 3. Refresh and the dossier's “Open project Inbox” read the same
signal with that exact project filter and one linked project.
No operational work was approved or launched. No token/cookie was extracted.
The initial app's status banner was hardcoded as signed-out; the rebuilt app
shows session state accurately and adds an explicit catalog error/retry control.
Restart clears its in-memory session; renewed owner login succeeded in the
final build. Tokens remain in memory and expire after 15 minutes.

## Live mapped catalog and source gaps

The native app displayed 76 current records (17 saplings, 43 client branches,
16 internal programs) and 20 historical records. The source disclosure showed
server delivery on 4 November at 00:14 local time, graph as-of 3 November 14:50,
and dated classification source 29 July 2026. Display digest:
`sha256:244df7a3e4197f4f252ed021cc9d3b9815a523395ab788bfd5673b4d5d9291e5`.
Action digest:
`sha256:b7393ed6ad4d05ec831fc105e9519c365bde036f7e29f9002b8a8abcff95170c`.

The actual served join report has zero explicit runtime joins. The earlier
one-join current-source probe is a local fixture, not this live portfolio.
The Cambium dossier identifies `sapling:cambium`, canonical tenant `cambium`,
and no served operational Work join. Source annotation is usable; this does
not enable operational approval or launch for that project.

The existing graph is version 11 with 132 stored nodes. The real ledger lacks
execution facts. The reader now reports that missing source explicitly rather
than failing the independent graph/catalog read. The shared server/Swift gap
bound is 256 (previously 128); overflow still refuses and tests exercise both
sides. Edges with absent served operational endpoints are omitted with explicit
missing-join gaps. No catalog record is promoted into a runtime Work node and
no source gaps are silently dropped. D1/KV graph and ledger data were not edited.

Hosted `noesis-free` performed a bounded identity review. Its generic suggestions
were checked against the dedicated service-auth boundary and exact mapping;
no authentication defect was confirmed. Actual provider attribution is
unavailable. A subsequent consent review disconnected before completion; its
free-pool retry completed with no actionable findings. The gap-capacity review
also completed: its three candidates were rejected against full source and
passing boundary tests (execution gaps are merged; Goal Graph anchors produce
gaps; explicit JSON null is supported). No S/A fallback,
provider configuration or routing write occurred.

## Acceptance and remaining work

ISC-3467/ISC-3672: real enrolled founder, scoped owner catalog/digests, native
signal creation, revisions 2 and 3, refresh readback and exact project Inbox
are verified. The test signal remains for owner inspection.
Field Report peer editing, durable offline sync and admitted work stay separate.

Traffic rollback uses the two previous versions above. It does not undo schema
or resource state. Preserve the additive tables and any session/signal data;
do not drop tables, restore a whole database, revoke other sessions or delete
service credentials as an implicit rollback action.
