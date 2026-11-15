# Snapshot limits for the 9 November planning records

These files preserve dated observations from 2–4 November 2026. They do not
replace `.project/HANDOFF.md`, `.planning/HANDOFF.json`, `ISA.md`, or
[NATIVE-INBOX-ACTIVATION-20261103.md](NATIVE-INBOX-ACTIVATION-20261103.md).
They authorize no deployment, migration, traffic change, enrollment, or
admission.

## ISC-3467

[ISC-3467-CLOSURE.md](ISC-3467-CLOSURE.md) and
`docs/evidence/2026-11-03-isc-3467-verification.json` record acceptance held
at 2026-11-03T07:43:34Z. `ISA.md` later checks ISC-3467. The held packet is
not a reversal of that check.

## Work-direction receipt

`WORK-DIRECTION-ROLLOUT-RECEIPT-20261104.json` says migration
`0103_shared_directions.sql` was applied and Worker version
`5f2c5dc7-e57a-47a8-89f3-0f64f6c29841` was at 100% traffic, with rollback
version `23cf59d1-754a-4cef-be7a-f96fcc072f48`. This repository has no
`workers/quests/migrations/0103_shared_directions.sql`. The 4 November
activation record says only migrations 0100, 0101, and 0102 were applied, and
names Cambium version `23cf59d1-754a-4cef-be7a-f96fcc072f48` as the active
version. `.planning/HANDOFF.json` records
`5f2c5dc7-e57a-47a8-89f3-0f64f6c29841` as a planning-baseline read with traffic
changes held. Do not reapply a migration or move traffic from the receipt.

That receipt sets `native_work_join_verified` and
`full_operational_loop_accepted` to false. That matches
[OPERATIONAL-LOOP-HANDOFF-20261104.md](OPERATIONAL-LOOP-HANDOFF-20261104.md):
the operational Work join is not wired.

## Temperance records

Temperance "glove" and "hand" in
`docs/plans/2026-11-02-temperance-hand-in-glove-handoff.md` are the portable
Temperance product and its optional profile. They are not Snow Gloves OS.
Thoughtseed Labs remains the Cambium owner account named by these records.
No AxTech product is admitted by this snapshot.
