# Native build wave 1 contract

Owner-authorized native build. Inference uses hosted Phloem/noesis-execute.
Primary dirty work is preserved; workers own separate files in isolated worktrees.
No worker may spawn agents, edit host/provider configuration, install over an
existing app, deploy, or perform a real business decision or admitted live job.

## Shared package shape

`apps/cambium-mac/Package.swift`: Swift tools6.2, macOS26 candidate baseline.
Library target `CambiumCore` at `Sources/CambiumCore`; executable target
`CambiumNative` at `Sources/CambiumNative`, depends on `CambiumCore`, with processed
`Resources`. Tests at `Tests/CambiumCoreTests`. No remote package dependencies.
Entry `CambiumNativeApp` renders `CambiumRootView()`; UI worker defines that view.
Bundle dev identity `space.thoughtseed.cambium.native.dev`, display Cambium Native.
No nested Git repository. Local bundle build only; install is an explicit flag.

## Minimal shared domain API

Core worker supplies public Codable/Sendable/Equatable value types:

- `EvidenceItem: Identifiable`: String `id,title,sourceRef,kind`; optional String
  `observedAt,digest`; initializer with these labels, optionals default nil.
- `WorkObject: Identifiable`: String `id,name,kind,summary,objective,currentState,nextStep,attention`;
  `[String] dependencies`; `[EvidenceItem] evidence`; initializer in that order,
  dependencies/evidence default empty, attention default "review".
- `ConnectionObservation: Identifiable`: String `id,name,owner,status,detail`;
  optional String `observedAt`; initializer with these labels.
- `SystemSnapshot`: `[WorkObject] work`; `[ConnectionObservation] connections`;
  String `asOf,sourceKind`; `[String] gaps`; initializer with those labels.
- `DemoData.snapshot: SystemSnapshot`: deterministic synthetic records, labelled
  demo. Real historical evidence remains references, not invented successful work.

The core worker may add strict wire DTOs, protocols and Gate/launch/run state
machines freely inside its owned target. UI should depend initially only on the
minimal API above. Wave2 integrates real core coordinators into the UI; local
preview actions must be labelled synthetic and cannot imply live acceptance.

## Ownership

- foundation: Package.swift, Info.plist.in, build.sh, .gitignore, tools/, provenance/license,
  Sources/CambiumNative/CambiumNativeApp.swift ONLY; no Core, UI views or resources.
- core: Sources/CambiumCore/** and Tests/CambiumCoreTests/** ONLY.
- interface: Sources/CambiumNative/Views/**, Design/**, State/**, Resources/** ONLY.

Preserve concurrent files. Do not modify root ISA or handoffs in worker worktrees.
Return exact changed files, actual commands/results and integration assumptions.
