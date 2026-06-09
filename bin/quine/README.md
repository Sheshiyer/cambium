# Quine Engine — the mycelial CLI

*Part of cambium (v0.2.0 · Thalia). Node v26 native TS, zero-dep.*

One command surface threaded through **everything we have**. The **mycelium** is a network of
**hyphae** — each a thread reaching into one subsystem, reading and (sometimes) writing it. And the
quine knows itself: `quine self` outputs the network's own structure.

## Why

We have many subsystems — the cortex (memory), the code graph, the operator (wake loop), the vault
(knowledge), GitHub — each with its own access path. Quine threads them into **one** connective
surface: the same verbs read/write across all of them, and you grow the network by adding one module.

## Run

```bash
node bin/quine/quine.ts          # the map (default)
npm run quine -- status          # or via npm
./bin/quine/quine.ts self        # or directly (chmod +x)
```

## Verbs

| Verb | Does |
|---|---|
| `quine [map]` | the network — every hypha + what it connects to |
| `quine status` | reachability of every hypha (parallel) |
| `quine self` | **the quine** — the network describes its own structure |
| `quine read <hypha> <args>` | read through a hypha |
| `quine write <hypha> <args>` | write through a hypha |
| `quine <hypha> <args>` | shorthand for `read` |

## Hyphae (the threads)

| Hypha | Reads | Writes |
|---|---|---|
| **cortex** | semantic memory search (NIM · node:sqlite \| Vectorize) | remember a note |
| **code** | CodeGraph symbols / call-graph | — (generated, read-only) |
| **operator** | the wake-loop world-state | wake a move |
| **vault** | grep the Obsidian notes | append to the guarded agent-outputs zone |
| **gh** | issues / milestones / search | create an issue |

## Examples

```bash
quine read cortex "pricing pushback" --tenant heyzack --k 5
quine write cortex "the founder prefers terse CTAs" --tenant heyzack
quine read code "wakeAsync"
quine read operator                          # the world-state (JSON)
quine write operator '{"id":"x","kind":"tweak"}'
quine read vault "onboarding" --limit 10
quine read gh milestones
quine write gh issue "Title" "Body"
```

Everything is **JSON** to stdout (pipe to `jq`); errors → stderr, exit 1.

## Config (env)

| Var | Effect |
|---|---|
| `QUINE_VAULT` | the vault root (default `../thoughtseed-labs`) |
| `QUINE_GH_REPO` | the GitHub repo (default `Sheshiyer/cambium`) |
| `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | cortex → Vectorize (else node:sqlite) |
| `NVIDIA_API_KEY` | cortex embeddings → real 1024-d NIM (else 64-d stub) |

## Growing the network

Add a hypha: write `bin/quine/hyphae/<name>.ts` exporting a `Hypha`
(`{ name, describe, help, status, read, write? }`), then register it in `quine.ts`'s `HYPHAE` map.
`map` / `status` / `self` pick it up automatically. Candidate next threads: **cf** (R2/Workers),
**teamforge**, **paperclip**, **huly**, **clockify**, **slack**.

## Philosophy

- **Mycelial** — decentralized threads, one network; add a hypha, the network grows.
- **Quine** — the network describes itself (`quine self`); self-knowledge is a first-class verb.
- **Composable** — JSON out, same verbs across every subsystem.
- **Zero-dep** — Node v26 native TS; imports the cambium operator directly, shells `gh`/`codegraph`.
