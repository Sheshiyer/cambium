# Quine — one command for everything your operator knows and does

*A builder & agent tool inside cambium (v0.2.0). **Founders never touch this** — they just get a
self-running business. This is the control room that makes that possible.*

## In one line

Instead of learning six different tools to reach your venture's **memory**, its **code**, its
**work**, its **knowledge**, and its **cloud** — you use one. `quine` reads and writes across all of
them with the same two words: **read** and **write**.

## Who it's for

- **Builders & AI agents** running the operator — your single surface to everything.
- **Not founders.** Founders are sold the *outcome* (an idea goes in, a business comes out); they
  never type a command. Quine is the machinery behind the curtain.

## Use it

```bash
quine                                       # what's connected
quine status                                # is everything reachable?

quine read cortex "pricing pushback"        # what has the venture learned about this?
quine read gh milestones                    # where's the work?
quine read operator                         # the live state of the business

quine write cortex "founder prefers terse CTAs"   # teach it something
quine write operator '{"id":"x","kind":"tweak"}'  # make a move
```

Everything comes back as plain JSON, so you can pipe it anywhere (`| jq`). Errors go to stderr.

## What it reaches today

| Ask about… | Command |
|---|---|
| **Memory** — what the venture learned, across runs | `quine read cortex "<question>"` |
| **Work** — issues + milestones | `quine read gh milestones` |
| **Code** — what we've built, by name | `quine read code "<symbol>"` |
| **Knowledge** — the notes in the vault | `quine read vault "<term>"` |
| **The operator** — the live business state | `quine read operator` |
| **The cloud** — Cloudflare storage + search | `quine read cf vectorize` |

Each is writable where it makes sense (`quine write …`). Run via `node bin/quine/quine.ts`,
`npm run quine -- <args>`, or `./bin/quine/quine.ts`.

---

<details>
<summary><b>How it's built</b> (for the curious — skip if you just want to use it)</summary>

Each connector is a *hypha* — one thread of a **mycelial network**. The network knows itself
(`quine self` prints its own structure), and you grow it by dropping one file in
`hyphae/<name>.ts` (export a `Hypha`: `{ name, describe, help, status, read, write? }`) and
registering it in `quine.ts`. Add a thread, the network grows — `map` / `status` / `self` pick it
up automatically. Next threads: TeamForge, Paperclip, Huly, Clockify, Slack.

Zero-dep, Node v26 native TS. Config (env): `QUINE_VAULT` · `QUINE_GH_REPO` ·
`CLOUDFLARE_API_TOKEN`+`CLOUDFLARE_ACCOUNT_ID` (→ cloud cortex) · `NVIDIA_API_KEY` (→ smarter memory).

</details>
