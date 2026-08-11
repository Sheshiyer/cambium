# Plans and active branch packets

Date-stamped plans in this directory are historical implementation records.
They may preserve old commands, message identifiers, checklists, screenshots,
and issue states as evidence of the work that was attempted; none of them is a
current operator procedure.

`product-branches/` is the explicit exception. Its indexed branch packets,
schema, and evidence inventory are active, machine-validated operating data.
They remain proof-bound inputs rather than operator runbooks, and a packet is
active only when it is listed in `product-branches/index.md`.

Current procedures live in [`../runbooks/`](../runbooks/). Current runtime
requirements live in [`../architecture/contracts/`](../architecture/contracts/).
Current implementation acceptance lives in the root `ISA.md`, and current
roadmap state lives in GitHub.

Do not update a dated plan to represent live status. Replace an obsolete active
procedure with a state-driven runbook, then leave the plan immutable or add the
standard banner:

> Lifecycle: historical; non-operational. Do not execute this plan as a runbook.
