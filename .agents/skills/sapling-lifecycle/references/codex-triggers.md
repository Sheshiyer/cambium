# Codex triggers and callback evidence

Start with the installed Codex implementation and its native `hooks/list` discovery. Read current [official hook documentation](https://learn.chatgpt.com/docs/hooks) when behavior or compatibility is uncertain. Supported events do not establish that a particular desktop, orchestration mode or installed consumer invoked them.

Run `npm run sapling:hooks` from the selected checkout. This manual helper starts a short-lived native app-server, calls only initialize and hook discovery, closes the process, and emits a public-safe projection. It starts no thread, invokes no callback, and writes no registration or trust state. Save a result only to ignored local output when needed. A discovery error or timeout remains unavailable; changed or untrusted enabled definitions require review.

The helper confines POSIX shutdown to its own process group and bounds pipe cleanup. Its actual native run is qualified only on the observed macOS host; Windows shutdown is unqualified and the helper refuses before starting a process there. This tool supplies no portable-engine target qualification.

The inspected November 4, 2026 CLI 0.166.0 reports six enabled, trusted command hooks, zero errors and zero warnings:

| Event | Existing owner | Responsibility |
| --- | --- | --- |
| SessionStart | Vestibule | Minimal bounded local orientation and sourced candidates. |
| SessionStart | Shared boundary audio | Existing local audio adapter. |
| UserPromptSubmit | PromptProcessing | One compact changes-only receipt; retain bound task and pool. |
| PreToolUse | SecurityPipeline | Existing scoped tool policy. |
| SessionEnd | Nutrix | Existing bounded close and verified-outcome delivery ownership. |
| SessionEnd | Shared boundary audio | Existing local end sound. |

This is native discovery evidence. The separate personal-runtime CLI canary in the existing host operations receipt and the portable-engine candidate's unobserved callbacks have different source and acceptance scopes. Neither proves current desktop event parity, portable-engine owner-result readback or installed Noesis adoption.

Official documentation says hooks from multiple sources accumulate, so adding a repo hook can duplicate an existing user hook. Non-managed definitions need trust review. `SessionEnd` runs on session end, rather than every completed turn, and is synchronous/advisory. Callback availability also depends on orchestration mode. Verify the actual selected surface before relying on a callback; do not port another client's event names or result fields from memory.

For this sapling pack, keep review/graph/growth/learn commands on demand. Do not append a growth scan to startup, add a Stop loop, or add a scheduler, organ, bridge or approval store. Resolve a needed indexed cluster/spoke without changing the managed fourteen hot capabilities or imported names/IDs. Installed adapters, hot-capability projection and runtime callbacks have distinct owners.

For an authorized callback change, prepare the exact definition/source diff, affected client/event, trust implications, harmless native canary, expected owner-result readback, failure/timeout behavior and reversal before requesting activation. Discovery alone is insufficient to close that packet. Preserve minimal Vestibule, compact PromptProcessing and Nutrix delivery guarantees.
