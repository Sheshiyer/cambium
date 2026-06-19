# Project Feed Adapter

The project-feed adapter is the generic delivery-system evidence port. It can be implemented with GitHub Issues, Linear, a CRM, a spreadsheet, or any system that emits project milestones.

## Port

`project-evidence`

## Inputs

- Brief accepted or rejected.
- Contract present.
- Deposit received.
- Repository or workspace provisioned.
- Specs frozen.
- Review events.
- Gate approvals.
- Deploy events.
- Client or stakeholder sign-off.
- Lessons minted.
- Archive completed.

## Outputs

- Normalized project evidence for quest arcs X and later.
- Operator events for build, review, approval, launch, learning, and archive.

## Failure Mode

Unavailable feeds leave quest arcs pending with explicit evidence text. The adapter must not mark progress complete from empty or placeholder data.

## Tenant Mapping

Map each external project to a portable org slug and, when needed, a project slug under that org.

## Privacy Boundary

The product repository should include only schema docs and synthetic examples. Live project exports belong in ignored runtime state or external case-study repositories.
