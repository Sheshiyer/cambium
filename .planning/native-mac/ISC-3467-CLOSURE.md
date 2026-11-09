# ISC-3467 closure packet

Status: **held**, 2026-11-03. No deployment, merge, secret, migration,
enrollment or admission write is authorized by this verification packet.
The fresh bounded observation is
[`2026-11-03-isc-3467-verification.json`](../../docs/evidence/2026-11-03-isc-3467-verification.json).
ISA remains the acceptance authority.

## Observed blockers

- The real standard-mode Mac app accepted the reviewed Curious / `cambium`
  profile in app memory, then Sign in returned “The owner did not complete
  this action.” Projects displayed “No project catalog loaded.” No synthetic
  replay was used. Its embedded revision is `3f507fb18db9cb69cf5f229e69c404e9a0ec544e`;
  the receipt binds that observation to the executable SHA-256. A valid ad hoc
  signature does not establish current-source rendering or owner delivery.
- Native session GET returned 404; the proposed TeamForge identity GET
  returned 501. Unauthenticated Mission Fabric and quest reads returned 401;
  those establish the authentication fence, not founder authorization.
- Deployment `d27c5b87-57ec-4774-82f8-21a518d23ccb` serves version
  `ef6e0c74-697e-4938-9d15-e0e481c80dbe` at 100%. Its successful version
  readback lacks the five native owner/client/identity bindings listed in the
  receipt. `BRIDGE_DB` matches the checked-in Labs database.
- A successful read-only schema query found none of
  `native_authorization_codes`, `native_sessions`, `native_consent_intents`.
  D1 reported changes 0, rows written 0, changed_db false. An earlier 7403
  failure is superseded by this successful read; it never proved absence.
  Migration ledger also lists 0010, 0099, 0100 and 0101 as unapplied.
- TeamForge [PR #105](https://github.com/Sheshiyer/team-forge-ts/pull/105)
  remains open at `0613dd6b16b162f077e11a23050e5d10fc35a26e`.
- Local source decoding gives 77 current / 20 historical / 0 review / 50 gaps /
  1 explicit join, with digest
  `sha256:42e1dd2b1aa672b6bb43b15c997dfb4cb1b3130181fca2e19a4a7e11c2374a94`.
  This is a comparison candidate, not an owner-served digest.

## Ordered owner activation work

1. Re-read both live Workers and pin the reviewed candidate revisions and
   exact input hashes before any rollout. Another owner lane has deployed
   newer Cambium work; do not overwrite it using an older candidate. Record
   both Workers' previous versions and the existing configuration/binding
   reversal. The version above is a dated observation, not perpetual rollback
   authority. TeamForge's rollback version is not established in this packet.
2. Review the narrow identity route and its tests at the pinned PR head. The
   separately approved merge/deployment must preserve the exact workspace
   mapping, active role and explicit `cambium` enrollment. A display catalog
   record must never enroll a founder.
3. Under separate owner approval, bind the narrow identity token pair and
   reviewed tenant/workspace map; Cambium needs
   `PLEXUS_NATIVE_IDENTITY_URL`, `PLEXUS_NATIVE_IDENTITY_TOKEN`,
   `PLEXUS_NATIVE_IDENTITY_TENANT=cambium`,
   `NATIVE_SESSION_OWNER_ORIGIN=https://curious.thoughtseed.space`, and the
   exact reviewed client `space.thoughtseed.cambium.native.dev` with callback
   `space.thoughtseed.cambium.native.dev://oauth/callback` in
   `NATIVE_SESSION_CLIENTS_JSON`. Preserve existing Access, whoami and D1
   authority. Service credentials belong to the Workers, never the Mac or a
   source receipt. Token values are deliberately absent here.
4. Review only the required schema changes and their current target ledger.
   0100 SHA-256:
   `2cd14f24cd6d9cc46c0b2de80678d340e34de8763fc14f1fbb65dd7712731f44`;
   0101 SHA-256:
   `84d0ccd64159b9367329f7c7ba88084d66bf615c3eaa7a7bcd9f0a9d333bdd4a`.
   A blanket migration apply would include outstanding 0010/0099 and is not
   scoped by these hashes. Define targeted application, backup/recovery and
   ledger handling with the owner. Worker rollback does not undo D1 schema
   or necessarily restore secret/configuration state. Preserve session data;
   destructive schema reversal is not an implicit rollback action.
5. Activate the reviewed identity seam and current Cambium entrypoint in the
   approved order. Source already conditionally composes the native host with
   atomic founder access; it needs activation and live verification. Read back
   deployed bindings, schema and routes through successful commands. Failed
   reads remain unavailable. Rerun denial/revocation checks separately from
   successful founder delivery.
6. Use the actual Mac bundle intended for acceptance, recording its embedded
   source revision and executable hash. Complete the normal external-browser
   consent/PKCE flow with the existing enrolled founder. Verify owner origin,
   exact client/callback, current founder role and exact `cambium` enrollment
   without retaining tokens, codes, native session IDs or private identity
   response bodies in receipts.
7. Refresh Projects in standard mode. Capture the actual owner response's
   catalog digest and served/source timestamps, then the Mac's **Source
   authority, joins and digests** disclosure and visible catalog. Compare to
   the pinned deployed catalog, not automatically to the dirty local source.
   Record tenant and admission authority preserved. Only then may ISA mark
   ISC-3467 accepted and replace the corresponding tree gaps with proven
   connections.

ISC-3467 does not require an admitted launch. Work navigation, decision and
admitted execution remain the distinct ISC-3477 gate; live activation and
binding work also relates to ISC-3476. Delivering the catalog closes neither
of those broader criteria automatically. Missing source joins stay broken
even if a separate runtime observation succeeds.
