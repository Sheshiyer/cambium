# Serving line reconciliation — 28 November 2026

This merge makes `main` carry the Cambium Worker code that is serving. Before
it, `main` was missing the serving line's Worker work, so deploying `main`
would have removed live behaviour. This record authorizes no deployment,
migration, traffic change or push.

## Inputs

- `main` at `db29d2fc` (#449).
- Serving line at `9fac9304`: `116a135e` (the Worker source of the version that
  served until 28 November) plus cherry-picks of #448 and #449. That line is the
  source of the version now serving.
- Common ancestor: `d571ea92` (#428, 4 November). `main` had 11 commits since;
  the serving line had 147. All but four of those 147 were already on the
  remote under other branches.

## What each side brought

- Serving line: the IVerif native claim-evidence cycle (claim-proof owner,
  direction execution, claim acceptance), shared directions with migrations
  `0103` and `0105`, operational Work intake and its founder Gate row, the
  department owner readers, native session fixes, the public portfolio project
  map (`/portfolio`, `/v1/portfolio`), the whole-Worker typecheck and the
  bundle-parity release gates.
- `main`: sapling command wrappers (#431, #433), staged Growth proposals
  (#408), the private Cortex provenance reader on the `cortex-services.ts`
  entry, Fitcheck scope reconciliation, the current-3D Field Atlas source proof,
  and the native planning records (#436).

## Decisions

Twenty-five files conflicted. Where both sides built the same feature, the
merge keeps the union, and the stricter rule where they disagree:

- `handler.ts` keeps the serving line's IVerif, operational Work and direction
  routes, and `main`'s request-local task snapshot. Fitcheck identity repairs
  stay out of public and Telegram projections.
- Fitcheck scope proposals are refused on founder-web intake
  (`canonical_owner_admin_required`), as on `main`. The serving line accepted
  them there.
- Founder bookkeeping batches need the canonical Gate, not a Telegram
  signature (`bookkeeping_proposal_requires_canonical_gate`), as on `main`.
- The Fitcheck Gate row omits `identityChanges`, as on `main`. No client read
  it; the full change set stays on the canonical founder review.
- `index.ts` is the serving line's composition. Git's automatic merge had
  listed `fitcheckReferenceReadback` twice; one copy was removed.
- A duplicate import of the Fitcheck names in `handler.ts` was removed. It
  would have failed at module load.
- The Labs config keeps `main`'s entry, `src/cortex-services.ts`, which
  re-exports the existing Worker and adds a private named entrypoint.
- `package.json` keeps `main`'s Field Atlas proof scripts and adds the serving
  line's `typecheck:worker` and its TypeScript dev dependencies. The release
  script runs the typecheck and bundle-parity gates first.
- Records: `main`'s later planning state wins for the handoff, the work-intent
  record and the read-retry rollout record. `ISA.md` keeps both sides'
  criteria. The 9 November snapshot note gains a dated addendum about `0103`.
- Generated files: the system atlas is regenerated. The Curious world bundle
  is the serving line's copy and must be rebuilt (see below).

## Known gaps

- The Curious world bundle (`curious-world.generated.ts`) is the serving
  line's build. The merged world source also has `main`'s Departments button
  and styles, so the bundle must be rebuilt with the R3F app's dependencies
  before a release.
- `main`'s current-3D Field Atlas proof records source digests that the merge
  changes. It was already stale on `main`. A fresh browser capture is needed
  before the proof checks pass.
- The remote D1 migration state was not read (the active login was refused).
- The whole-Worker typecheck did not run: TypeScript is not installed here.

- The #449 partial-Access test used the live Curious host, which the
  standalone audit forbids outside reviewed files. It now uses a placeholder
  host. `apps/cambium-mac/docs/PROJECTS-INTEGRATION.md` still names the live
  host. It came from #435 on `main`, and `main` fails the audit on it too.

## Verification

- `npm test`: 2829 tests, 2815 pass, 5 fail, 9 skipped. Untouched `main`:
  2795 tests, 2791 pass, 4 fail.
- Four of the five failures also fail on `main`: the two privacy checks
  (fixtures in `cortex-provenance-reader.test.ts`), the drift audit and the
  current-3D pixel check (the current-3D proof was already stale on `main`).
  The fifth ("unavailable source commit fails once") now stops at the stale
  source bindings first. All five need a fresh Field Atlas capture or a fixture
  change on `main`.
- The Worker suites (`workers/quests/src/*.test.ts` and `goal-graph`) pass
  apart from the shared checks above.
- Retired-runtime guard, generated docs and product-branch packets pass. The
  standalone audit fails only on the Mac document above.
