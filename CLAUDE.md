# Claude pickup adapter

Use this repository as `cambium`. Start with
`PROJECT.md`, then read `.project/CONTEXT.md` and only the first 12 lines
of `.project/HANDOFF.md`. Use PROJECT's bounded structured-handoff pickup;
read the continuation matching the requested task, with its cited proof.
Search historical sections only for a specific missing fact. Follow
`AGENTS.md` as the shared operating contract.

The vault is the knowledge authority, not an application dependency. Keep
client sessions, Paseo state, provider stores, credentials, and OmniRoute
configuration outside this repository. Use the commands declared in
`PROJECT.md`.

This packet is reviewed-held. Do not perform relocation, registry,
session, or provider mutations from this adapter; those actions require a
separately approved, reviewed manifest. Production deployment remains a
separate owner-approved and rollback-gated action.
