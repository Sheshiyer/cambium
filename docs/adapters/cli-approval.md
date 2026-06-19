# CLI Approval Adapter

The CLI approval adapter is the default local adapter for development, demos, and CI. It proves the approval lane without requiring Telegram, Slack, email, or a deployed web surface.

## Port

`approval`

## Inputs

- command arguments such as tenant, subject, decision kind, and reason.
- optional path to a small JSON evidence file.
- current git/worktree context when a project gate needs repository evidence.

Example event shape:

```json
{
  "tenant": "demo-org",
  "subject": "ship-gate:demo-launch",
  "kind": "approve",
  "actor": "local-founder",
  "evidence": {
    "source": "example.com/demo-review",
    "summary": "synthetic launch review passed"
  }
}
```

## Outputs

- `cambium.approval.v1` event.
- quest evidence for gate arcs.
- optional project evidence count such as `gateApprovals`.

## Failure Mode

- invalid tenant slug fails before writing.
- missing subject or kind exits nonzero.
- ambiguous kind becomes `hold` only when explicitly requested.
- no provider credentials are needed.

## Tenant Mapping

The caller supplies `--tenant <org-slug>`. The adapter must validate the slug with the same lowercase kebab-case rule used by the rest of Cambium.

## Privacy Boundary

The CLI adapter may read local files, but committed fixtures must use synthetic `example.com` evidence only. Local approval output should go under ignored runtime state such as `.operator/`.
