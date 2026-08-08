# Temperance dispatch rail preflight — 2026-08-08

Status: read-only preflight for project/R2 mapping. No external worker output was accepted.

## Rail availability

| Rail / command | Status | Decision |
| --- | --- | --- |
| `temperance-batch` | missing | Do not claim Temperance batch dispatch. |
| `temperance-claude` | missing | Do not claim native non-Codex Temperance Claude workers. |
| `te-dispatch` | missing | Do not claim the `te-dispatch` rail. |
| `omniroute` | available | Candidate for later read-only model/route probes only; no settings changed. |
| `ollama` | available | Candidate for bounded read-only review only; no model worker accepted. |
| `clinepass` | missing | Do not claim ClinePass execution. |
| `codex` | available | Current execution surface remains Codex/local. |
| `gh` | available | GitHub CLI is available for read-only repository/project probes. |

## Command evidence

Availability probe:

```text
temperance-batch missing
temperance-claude missing
te-dispatch missing
omniroute available
ollama available
clinepass missing
codex available
gh available
```

Version and model probes:

```text
omniroute --version => 3.8.48
ollama --version => ollama version is 0.32.6
codex --version => codex-cli 0.139.0
gh --version => gh version 2.96.0 (2026-07-02)
```

`ollama list`:

```text
NAME               ID              SIZE    MODIFIED
kimi-k2.6:cloud    a90cd0d1590c    -       3 months ago
```

## OmniRoute note

`omniroute --version` also printed environment-load notices that included machine-local configuration paths. Those absolute local paths are intentionally not copied into repository evidence. The probe was read-only and did not change OmniRoute settings or provider state.

## Dispatch conclusion

- Temperance batch dispatch did not pass because the required batch commands are missing.
- ClinePass execution did not pass because `clinepass` is missing.
- `ollama` exposes a Kimi cloud candidate, but no live nontrivial output proof or gateway receipt was collected for this batch, so no model output is accepted.
- First-batch execution therefore remains local/read-only evidence collection by Codex, with no external worker result integrated.
