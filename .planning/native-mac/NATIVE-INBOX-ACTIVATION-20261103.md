# Native Inbox activation — 3 November 2026

Status: backend active; the actual native app is waiting at the existing
Cloudflare Founder Gate login. Real native session, owner-served project catalog
and persisted Inbox acceptance remain pending owner login and consent.

## Activated owners

| Owner | Active version | Pinned source | Previous traffic version |
| --- | --- | --- | --- |
| Cambium | `323f4587-7066-4c89-b7db-d21c12493d7a` | `ab94d63c7db8572c3743c1cb8c3d69221ba0f053` | `ef6e0c74-697e-4938-9d15-e0e481c80dbe` |
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

Native source `2c083f63a3f998b959130c7c59a78a2f906b0671` builds cleanly, with
input aggregate `16d9da13ebc2818f87c661638f6f900b88df6b7b3fdc38c949faac0e6d09e1f5`.
Its ad hoc bundle signature verifies. Browser presentation now retains the
actual app window and supports a visible inactive window. Diagnostics contain
only fixed failure categories and AuthenticationServices numeric error codes.

Verification: TeamForge 218 tests and typecheck; Cambium 111 activation-boundary
tests; protected browser-alias 90-test regression suite; Swift identity 47 and
native 39. These local results do not establish a real founder session.

Actual native standard mode now opens the Cloudflare page titled “Log in to
Cambium Founder Gate.” The owner must complete the normal email-code login and
explicit 15-minute app consent. No browser credential or native token is copied
out of the normal flow. No synthetic demo or manually inserted session is used.

Hosted `noesis-free` performed a bounded identity review. Its generic suggestions
were checked against the dedicated service-auth boundary and exact mapping;
no authentication defect was confirmed. Actual provider attribution is
unavailable. No S/A fallback, provider configuration or routing write occurred.

## Remaining acceptance

After owner login, verify native session inspection, exact served catalog and
digest, create a clearly labelled signal linked to `sapling:cambium`, read it
back after refresh, edit it to a new revision and open the same project Inbox.
Record only bounded acceptance facts. Keep ISC-3467/ISC-3672 open until that proof.
Field Report peer editing, durable offline sync and admitted work stay separate.

Traffic rollback uses the two previous versions above. It does not undo schema
or resource state. Preserve the additive tables and any session/signal data;
do not drop tables, restore a whole database, revoke other sessions or delete
service credentials as an implicit rollback action.
