# Repository lifecycle

This is Cambium's single human lifecycle and authority map. It explains where
truth lives; it does not replace any source it maps or grant execution
authority to an inventory result.

## Lifecycle classes

The lifecycle vocabulary is closed:

| Class | Meaning | Current-instruction and recovery rule |
| --- | --- | --- |
| `canonical` | Current authority within the source's bounded domain | Follow only inside that domain and re-read its live owner before acting. |
| `derived` | Navigation, explanation, or generated inspection | Regenerate from the cited source revision; never treat the view as authority. |
| `historical` | Recoverable, non-operational implementation history | Consult through Git or its history index; do not execute callable-looking text. |
| `evidentiary` | Recoverable proof or proof-bound operating evidence | Use to verify a bounded claim; it does not become a current procedure. |
| `local-only` | Ignored or owner-protected runtime state outside the committed corpus | Inspect only through its owning runtime and approval boundary; never import it into this inventory. |

Classification is descriptive and non-destructive. It never moves, deletes,
archives, externalizes, rewrites, deduplicates, dispatches, or queues a source.

## One owner per truth

| Owner | Bounded truth | Lifecycle default | Current instructions? |
| --- | --- | --- | --- |
| [`VISION.md`](../VISION.md) | Enduring repository doctrine | `canonical` | Doctrine only; no task or plan authority |
| [`MISSION.md`](../MISSION.md) | Renewable repository mission horizon | `canonical` | Doctrine only; no task or plan authority |
| [`ISA.md`](../ISA.md) | Approved goals, acceptance, and verification | `canonical` | Yes, while its work is active |
| [live `.planning/STATE.md`](../.planning/STATE.md) | Current finite planning transition | `canonical` | Yes; re-read it instead of copied status prose |
| [`docs/architecture/contracts/`](architecture/contracts/) | Runtime and data contracts | `canonical` | Yes, within the named contract |
| [`docs/runbooks/`](runbooks/) | Operator procedures | `canonical` | Yes; each procedure must discover live state first |
| GitHub issues and milestones | Roadmap and release coordination | `canonical` | Yes, within their separately governed scope |

An active procedure must discover current state before naming a valid
transition. It must not freeze a message number, issue state, queue state,
timestamp, progress value, provider result, or milestone decision into prose.

## Directory defaults and item exceptions

| Surface | Default class | Recovery and exception rule |
| --- | --- | --- |
| `docs/evidence/` | `evidentiary` | Recover through its [evidence index](evidence/README.md); create a new dated record instead of editing proof to represent current state. |
| `docs/plans/` and `docs/superpowers/plans/` | `historical` | Recover through the [plans index](plans/README.md) or Git; callable-looking commands remain non-operational. |
| `docs/archive/` | `historical` | Recover through the [archive contract](archive/README.md); archived examples do not become current direction. |
| Generated Intent Graph and Temperance Flow readbacks | `derived` | Regenerate from their declared sources; their recency never grants release or planning authority. |
| `docs/plans/assets/` | `historical` or `evidentiary` | Retain as referenced history or proof; it has no operator authority. |

Directory defaults yield only to explicit source-backed item evidence. The sole
product-branch exception is an exact packet listed in
[`docs/plans/product-branches/index.md`](plans/product-branches/index.md): an
indexed packet is proof-bound operating evidence, while an unindexed lookalike
remains `historical` and non-operational. A directory name or similar filename
is never sufficient to promote an item.

## Memory boundary

Root `MEMORY/` is a revision-scoped inventory fact, not a timeless repository
claim. The Phase 6 inventory reports whether a tracked root `MEMORY/` exists at
the caller-selected commit; at the reviewed source revision it does not.
[`docs/memory/`](memory/README.md) is the neutral, committed product memory
contract and is not a substitute for root `MEMORY/`. Ignored memory and
provider-owned runtime memory are `local-only`; the inventory must not probe or
copy either surface.

## On-demand inventory

The committed
[`Documentation Inventory v1` contract](architecture/contracts/documentation-inventory-v1.md)
defines deterministic machine and human views of one explicit commit. Select a
committed revision, then pass it explicitly:

```bash
REV=$(git rev-parse --verify 'HEAD^{commit}')
npm run --silent docs:inventory:json -- --source-revision <REV>
npm run --silent docs:inventory:markdown -- --source-revision <REV>
npm run --silent docs:inventory:check -- --source-revision <REV>
```

Replace `<REV>` with the selected full commit SHA (for example, `$REV`). The
JSON and Markdown outputs are ephemeral stdout views and can be regenerated for
any commit. Neither is a committed readback, freshness ledger, doctrine source,
planning surface, action queue, or durable status record. `--silent` keeps
package-manager banners out of parseable JSON and human Markdown stdout.

`npm run drift:audit` enforces the broader authority boundaries. New operating
guidance belongs under `docs/runbooks/`; historical and evidentiary sources stay
recoverable at their existing paths.
