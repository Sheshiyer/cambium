# Review and delivery through Temperance

The hosted CLI entrypoint is `te-codex --pool noesis-free`. It selects the
canonical free pool for that new CLI session, preserves the hosted Phloem
credential boundary and supplies a relay identity. The desktop chat retains its
actual native model. Pool selection is not provider attribution or a guarantee
that a request will be admitted. Free means zero incremental cost; a temporary
promotion is eligible only if the routing owner admits it to that pool without
consuming protected S/A entitlements. Never silently fall back to S/A.

From an isolated review checkout, use:

```sh
te-codex --pool noesis-free exec --ephemeral --sandbox workspace-write \
  'Use the existing Temperance Git/PR workflow. Review this branch against
  origin/main, including staged, unstaged and untracked files. Preserve other
  work. Resolve confirmed findings, add meaningful regression coverage and run
  the repository gates. Use only the hosted noesis-free pool; stop and report
  unavailable capacity rather than changing pools, credentials or routing.
  Record review and preparation evidence under ignored .local/. Push only the
  scoped PR branch with a known lease. Merge only when explicitly authorized,
  after all required checks pass, using the exact prepared head SHA. Report
  actual provider attribution when available, otherwise mark it unavailable.
  Do not deploy, migrate production data, or modify provider configuration.'
```

For review only, change the sandbox to `read-only` and remove the instructions
to fix, push and merge. Authorize a specific PR before delivery; the snippet
does not grant standing permission to merge future changes.

The workflow sources are the installed `rubedo-execute-git` discovery skill and
its indexed `git-pr-ops-orchestrator`, `git-pr-ops-core`, `review-pr`,
`prepare-pr` and `merge-pr` spokes. Use their existing scripts when present.
If a repository lacks those wrappers, preserve the same review/preparation
artifacts, explicit file scope, lease, check and pinned-head gates with the
Git/GitHub CLI; do not claim a wrapper ran when it did not.
