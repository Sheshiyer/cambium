# GitHub Adapter

The GitHub adapter treats repository and issue events as project evidence for the operator. It is useful for dev and AI-first teams, but Cambium must still run without GitHub credentials.

## Port

`repository` and `issue-tracker`

## Inputs

- Pull request opened, reviewed, merged, or closed.
- Issue opened, labeled, assigned, completed, or reopened.
- Workflow run completed.
- Release published.

## Outputs

- Project evidence for build, review, approval, deploy, and archive arcs.
- Structural-memory hints for CodeGraph recall after software changes.
- Optional quest status updates derived from real repository events.

## Failure Mode

No token means no repository polling. The operator should continue with local world state and synthetic fixture data. API errors should be reported as unreachable evidence, not as completed progress.

## Tenant Mapping

Map repository owners or configured repository groups to portable org slugs. Do not hard-code a live organization name into product code or docs.

## Privacy Boundary

Do not commit private issue exports, user emails, or raw webhook dumps. Summaries should use synthetic handles and `example.com` links unless they are deliberately published case studies.
