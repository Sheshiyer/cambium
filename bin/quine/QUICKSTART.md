# Quine — Quick Start

The 30-second guide to the mycelial CLI.

```bash
# see the network + which threads are reachable
node bin/quine/quine.ts map
node bin/quine/quine.ts status

# read through any hypha (JSON out — pipe to jq)
node bin/quine/quine.ts read cortex "pricing pushback" --k 5
node bin/quine/quine.ts read code "wakeAsync"
node bin/quine/quine.ts read gh milestones
node bin/quine/quine.ts read operator | jq '.state.version'

# write through a hypha
node bin/quine/quine.ts write cortex "remember this" --tenant heyzack
node bin/quine/quine.ts write operator '{"id":"x","kind":"tweak"}'

# the quine — the network describes itself
node bin/quine/quine.ts self
```

`npm run quine -- <args>` works too. Output is JSON; errors go to stderr (exit 1).

Full docs: [README.md](./README.md).
