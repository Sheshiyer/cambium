# Run an onboarding workflow by project

Use the single manual `project-onboarding` skill. Resolve the selected Thoughtseed WorkObject against the existing registry, repo and scoped handoff before loading a workflow. An exact branch, product or repo must be confirmed when aliases match more than one candidate. Never infer authority from the currently open chat or a command name.

## Client entry points

| Client | Entry point |
|---|---|
| Codex app, primary | Open the Cambium workspace, open the composer’s slash menu and select **Thoughtseed Project Onboarding**, or invoke it explicitly with `$project-onboarding`. Then add the intent and one exact project. Example: `$project-onboarding review-status branch:klear-karma`. Use the skill entry rather than creating a legacy custom prompt. |
| Claude Code | From Cambium use `/project-onboarding <intent> <target>`. In Claude Code Desktop, use **+ → Slash commands** and select it if present. This is the native menu, not a separately installed mod. |
| Grok CLI | From Cambium use `/project-onboarding <intent> <target>` when the repo-local Grok CLI skill is discovered. Otherwise explicitly request the canonical skill by path. This adapter is for the local CLI only, never for Grokbot or the Tryambakam Noesis workspace. |

Invoke from Cambium to use its repo-local discovery. Selecting a client repo in an unrelated Codex workspace does not prove this shared skill is loaded there. Record native project/command discovery and an invocation receipt separately before adding any cross-workspace wrapper.

## Intent routes

| Intent | Source and stop condition |
|---|---|
| `review` (default), `resume`, `roadmap`, `rails`, `closeout` | Keep their existing meanings in [the runbook](../runbook.md). Never reinterpret a selected workflow as blanket permission to act. |
| `phases` or `waves` | [Phases and waves](phases-and-waves.md); reconcile project → governor → phase → wave. The pillar owns the wave, prerequisites are edges, and the result goes back to the parent. Codex chats may be peers; preserve logical parentage in the handoff. Stop at a proposal or a missing source; no chat creation. |
| `review-status` | [Review](scheduled-review.md), one manual read-only pass: compare the last verified handoff and current receipts. Return material drift and one next decision. Do not create, modify or run a schedule. |
| `archive` | [Archive](archive.md), eligibility review only: accepted or cancelled terminal outcome, evidence and artifacts recoverable, pending work transferred to a named owner. Do not archive chats or clean worktrees from this intent. |
| `references` | [Cross-project references](cross-project-references.md), one representative flow from this project's repo and evidence. Separate transferable patterns, app-specific design, and unverified experiments. Cortex access is separately scoped; if unavailable, record the hold without repurposing a different tenant or endpoint. |

For every targeted intent return: project identity, owner, source/ref, what was verified, missing prerequisite and next action. Use an existing local packet for a preview, if present, and preserve evidence freshness. A proposal or receipt from one project is not proof for a sibling. Write only ignored local previews when requested.

## Client continuity pickup

For Thoughtseed client pickup, read the authoritative Labs vault’s `00-meta/memory-sync/README.md` (Repeatable client continuity flow), then the client’s current checkpoint in `60-client-ecosystem/<client>/project-brief.md` and the owning repo receipt. Vestibule returns one cited next action; Adytum only requests missing evidence through an exact, existing project grant. Nutrix drafts updates for review. If Hindsight resolves to a broad/shared bank or the exact grant is absent, use the cited vault checkpoint only and report recall held. Do not rescan or read new chats without the approved room scope.

## Project sections

These are review checkpoints linked to existing authority, not a new registry, operational graph, task list or approval.

- **Co.Property OS** (`branch:co-property`): use the existing Office OS handoff, repo ISA/roadmap, and the owning `ops/hermes/skills/coproperty-cofounder/SKILL.md` for its scoped operating rules. GitHub readback on 18 November 2026 returned the same repository ID (1422139448) for the legacy spelling and current `copropertyinfo-a11y/coproperty-office-os` source. Preserve the WorkObject and use the current owner when opening evidence; the registry was not rewritten. Keep readiness, turnover/maintenance and LINE company audiences separate. Start with one current first-party evidence item; do not read private staff DMs or add Work admission.
- **Klear Karma** (`branch:klear-karma`): use the existing delivery, workspace and session-preview packets. Keep RN/backend, admin, wiki and landing as distinct repo roles. The local free-booking delivery wave still needs native evidence and owner sign-off. The separate Sapling hypothesis is not the client delivery roadmap.
- **Relovo**: use the existing seller voice reference. Trace per-clip consent, editable transcript, typed fallback and independent publish confirmation. Local screen/design evidence is distinct from live Cortex hits. If that source review is held and the user asked to review it before ParkArea, preserve the order.
- **ParkArea**: retain the post-v1.4 reconciliation preview and guarded pilot as distinct decisions. Review an exact repo/ISA/board source before proposing another wave.
- **Tirak Core / Plus**: retain two ordered Core waves and Plus's separate customer/admin source authorities. Hold Plus if the intended repo or owner is unresolved.

The Cambium governor and existing Work/ISA gates retain authority. These launchers do not alter provider routing, enroll projects, create or archive chats, publish, send, change schedules, open a migration, or start a work graph.
