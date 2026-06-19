# Agent Plane Adapter

The agent-plane adapter records activity from AI or automation workers as operating evidence. It proves the organization is doing work, but it remains optional.

## Port

`agent-activity` and `archive-evidence`

## Inputs

- Agent started, completed, failed, or handed off.
- Human approval requested or resolved.
- Lesson or reusable skill minted.
- Project archive ceremony completed.

## Outputs

- Evidence for living-org, gate, learning, and archive quest arcs.
- Optional memory records describing lessons, failures, and reusable playbooks.

## Failure Mode

If the agent plane is unavailable, arcs depending on agent evidence remain pending. Local synthetic fixtures can still demonstrate the full quest shape without pretending live agents ran.

## Tenant Mapping

Map agent workspaces to portable org slugs through config. Keep workspace-specific identifiers out of committed examples.

## Privacy Boundary

Do not commit raw transcripts, private workspace names, or internal file paths. Publish only redacted summaries or synthetic fixtures.
