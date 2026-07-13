# Repository lifecycle

Cambium keeps one owner for each kind of truth:

| Surface | Meaning | May contain current instructions? |
| --- | --- | --- |
| `ISA.md` | Current implementation acceptance and verification | Yes, while the work is active |
| GitHub issues and milestones | Current roadmap and release coordination | Yes |
| `docs/architecture/contracts/` | Current runtime and data contracts | Yes |
| `docs/runbooks/` | Current operator procedures | Yes |
| `docs/evidence/` | Immutable dated proof | No; evidence describes what happened |
| `docs/plans/` | Historical implementation records | No |
| `docs/superpowers/plans/` | Historical generated implementation records | No |
| `docs/plans/assets/` | Generated or historical proof assets | No operator authority |

An active procedure must describe how to discover current state before naming a
valid transition. It must not freeze a live message number, issue state, queue
state, timestamp, or milestone decision into prose.

Generated readiness and browser diagnostics are temporal artifacts. CI may
upload them, but committed copies never become release authority merely because
they are newer than a source file.

`npm run drift:audit` enforces these boundaries. New operational guidance goes
under `docs/runbooks/`; dated plans remain useful decision history but are never
followed as instructions.
