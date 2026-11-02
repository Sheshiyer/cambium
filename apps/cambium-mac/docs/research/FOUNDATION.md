# Bama and the native foundation

Research cut: 2 November 2026. `[V]` means inspected source or observed local
metadata; `[P]` means proposal; `[U]` means a platform or product claim still
requiring a probe. These labels do not grant execution or live acceptance.

## Bama source pin

`[V]` Inspected upstream `daveebbelaar/bama` at commit
`639893c397278256f1ae204dd8f837eb82bd6527`, dated 1 November 2026. Its README
describes agent workflows for native Swift/SwiftUI development; it is not a
Cambium runtime, UI framework dependency or graph backend.

Primary references:

- [README](https://github.com/daveebbelaar/bama/blob/639893c397278256f1ae204dd8f837eb82bd6527/README.md)
- [Router](https://github.com/daveebbelaar/bama/blob/639893c397278256f1ae204dd8f837eb82bd6527/skills/start/bama/SKILL.md)
- [App brief](https://github.com/daveebbelaar/bama/blob/639893c397278256f1ae204dd8f837eb82bd6527/skills/start/app-brief/SKILL.md)
- [Research](https://github.com/daveebbelaar/bama/blob/639893c397278256f1ae204dd8f837eb82bd6527/skills/plan/research/SKILL.md)
- [Stories](https://github.com/daveebbelaar/bama/blob/639893c397278256f1ae204dd8f837eb82bd6527/skills/plan/user-stories/SKILL.md)
- [Native scaffold](https://github.com/daveebbelaar/bama/blob/639893c397278256f1ae204dd8f837eb82bd6527/skills/start/new-mac-app/SKILL.md)
- [Mac design](https://github.com/daveebbelaar/bama/blob/639893c397278256f1ae204dd8f837eb82bd6527/skills/design/mac-design/SKILL.md)
- [Custom design kit](https://github.com/daveebbelaar/bama/blob/639893c397278256f1ae204dd8f837eb82bd6527/skills/design/design-kit/SKILL.md)

The router/brief/research content was initially fetched from main alongside the
commit read; the later design/stories/scaffold reads used the explicit pin.
This records the actual lookup sequence instead of claiming a vendored install.
The README, router, brief and research files were then fetched again at the
explicit commit through the GitHub connector; each matched the initially read
content exactly. The other four skill files were read at the explicit pin.
No Bama plugin, global skill symlink, template script or build script was installed
or executed. Its workflow is being applied to the documentation in this repository.

## Adopt and adapt

| Bama behavior | Cambium application |
| --- | --- |
| Brief before code; skip questions answered by sources | Adopt; preserve the founder's whole-system-first answer |
| Research → screen index → stories → scaffold → design → verify | Adopt with root ISA as acceptance owner |
| One useful action per story and bounded milestone | Adopt; milestone ends with something usable, not only a new screen |
| Snapshot pages/panels/settings in light and dark | Adopt for actual native acceptance; existing screenshots remain historical/synthetic |
| Semantic tokens, real controls, keyboard and accessibility | Adopt; custom Cambium imagery and typography need deliberate adaptation |
| macOS 26+, Xcode 26+, Swift 6.2 default | Candidate baseline; confirm intended user hardware/support window |
| Swift package and real app bundle | Candidate foundation; use an XcodeGen project if selected integrations require it |
| Strip accounts, teams, integrations and sync for personal apps | Reject as a default here: required system identities and connections remain |
| Default local authoritative SwiftData model | Adapt to preferences/cache; operational graph remains server-owned |
| Optimistic UI with immediate success | Restrict to reversible local preferences; never claim a Gate outcome optimistically |
| New folder, git init and automatic initial commit | Adapt to existing monorepo; no nested repository or broad staging |
| Build script installs and opens from a standard app location | Defer until explicit native build scope; avoid collision with existing Cambium |
| Agent CLI drives app database through one writer | Later optional capability; cannot create a second D1 action authority |
| Native accent/system-only default appearance | Use the custom design-kit path to preserve the requested visual source language |

The existing Electron app declares bundle identifier `space.thoughtseed.cambium`.
Native development identity and install coexistence need an explicit decision
before a scaffold/build script can overwrite or impersonate that installation.

## Local platform observation

`[V]` Read-only commands returned macOS 27.2, Xcode 27.1 (27A9275), and Apple
Swift 6.4 targeting arm64 macOS. This exceeds Bama's documented toolchain
baseline. It proves installed tool metadata only. No native compile, linked
framework test, bundle launch, signing, notarization or physical acceptance ran.

`[V]` Existing apps source contains Electron/React/R3F implementations. The
specialist scan found zero Swift files under `apps/` at this cut.

## Architecture options

| Option | Benefit | Cost / unresolved proof | Disposition |
| --- | --- | --- | --- |
| SwiftUI shell + native 2D graph/terrain | Native navigation/accessibility; small first slice; brand can be deliberate | Graph layout/hit testing and performance need spike | Preferred first prototype `[P]` |
| SwiftUI shell + isolated WebKit spatial scene | Potential reuse of reviewed R3F visual behavior | Bridge, focus, navigation/origin policy, memory/GPU and accessibility need proof | Compare in bounded spike `[U]` |
| Entirely native spatial scene | Deeper native rendering control | Geometry conversion, materials, interaction and accessibility are new work | Later only if it improves user task `[P]` |
| Continue Electron only | Fastest reuse of current desktop source | Does not satisfy the requested native rebuild direction | Preserve as reference/recovery path |

The comparison must use the same selected work, evidence gaps and user task.
Measure “can the founder identify the next meaningful action?” alongside render
time, memory, interaction latency, keyboard and reduced-motion behavior. Do not
select a renderer solely because an impressive source world exists.

## Candidate module ownership

```text
App / scenes / native commands
  → view models / navigation state
  → immutable domain and validation
  → read adapters → existing authenticated owner endpoints

Deliberate review coordinator
  → isolated action gateway → existing canonical Gate/status owner

Preferences and disposable reader-scoped cache
  (no operational task, approval, lease or acceptance writer)
```

Authentication is a separate dependency. An embedded web view does not inherit
an external browser's session; a URLSession does not inherit Telegram initData.
No service token, owner signing key or exported native session belongs in the
app bundle. Proposed native sign-in and exact owner scope require validation.

Native authentication is unproved and blocks every Gate-dependent story and any
real authenticated read. Fixture-only screens must say so. A client may request
a tenant scope, but the server resolves and authorizes it; a client field,
cached identity, deep link or selected work never grants that scope.

Read-only describes effects, not HTTP verbs: an adapter can retrieve, validate
and cache allowed read data; it cannot decide, renew, compile a delivery, persist
foldback, publish, dispatch, edit policy or arm a schedule. Those capabilities
belong in isolated owner-specific action modules if later approved in scope.

Cache proposal: disk stores local preferences and non-sensitive source metadata
only in the first slice. Authenticated operational payloads remain in memory;
no tokens, raw corpus or business-decision authority enters the disposable cache.
Validity ends at the earlier of owner expiry or a configured read TTL (value to
set during the adapter spike). Sign-out, principal/tenant switch and revocation
clear incompatible entries. A local journal may retain an opaque original-tuple
reference for status recovery; persisting sensitive receipt content needs its
own explicit retention design. Cache expiry is never a safe-to-resubmit signal.

| Guard | Proposed native behavior | Required negative probe |
| --- | --- | --- |
| Full review / digest | Changed review becomes non-actionable | Tampered delta/digest cannot confirm |
| Nonce / immutable tuple | Match the original reference; reject conflict | Reused/opposite decision cannot create a second outcome |
| Version / expected head / CAS | Explain changed state and require fresh review | Concurrent head move cannot apply stale review |
| Expiry | Show expired and withhold action; renewal remains separate | Crossing expiry during awaited read cannot commit |
| Lost response | Show outcome unknown and query original status only | Zero extra decision submissions after response loss |
| Historical receipt | Retain immutable result separately from connection | Failed queue refresh cannot erase or relabel receipt |

## Required platform probes before selecting a foundation

| Question | Probe / evidence | Dependency |
| --- | --- | --- |
| Which OS and CPU families are supported? | Owner audience decision and explicit deployment target build | Distribution plan |
| Can app identities coexist? | Separate dev bundle ID and install-path rehearsal without touching existing app | Scaffold |
| SwiftPM or XcodeGen? | Minimal fixture build with chosen native integrations | Shortcuts/extensions/widget decision |
| Native login/callback contract? | Owner-reviewed identity flow; denied/expired/cancelled/cross-tenant tests | Any authenticated read |
| Local runtime access? | Signed/sandboxed loopback request test; scoped host policy and permissions | Manifest adapter |
| Offline/stale caching? | Kill network, switch tenant, expire snapshot; prove cache cannot authorize actions | Read adapters |
| 2D versus spatial? | Same task in bounded renderer prototypes; native keyboard and VoiceOver checks | Design/renderer selection |
| Source asset packaging? | Bundle-only derivatives with original/derivative hashes and no remote art fetch | Native snapshots |
| Signing/notarization/update policy? | Explicit distribution design and actual artifact evidence later | Release |
| App automation? | Read/write tool inventory with principal and effect scopes | CLI/MCP/Shortcuts later |

Initial Apple source discovery returned partial/failed pages. The subsequent
[platform pass](PLATFORM.md) retrieved the correct WebKit API and official DocC
metadata, establishing API introduction versions and documented contracts.
Actual signed native behavior still requires the platform spike.

## Research not yet completed

The first source pass prioritized the existing ecosystem and artwork. The
continuation added [official Apple platform research](PLATFORM.md) and a
[bounded four-product feature/review study](INTERACTION-REFERENCES.md). This is
sufficient to inform the proposed architecture; it is not a broad market census,
representative sentiment analysis or completed hands-on platform/clone cycle.
No competitor price or rating claim is made.

The founder confirmed a founder/operator first release with tenant and role
boundaries preserved, including decisions and launch of already-admitted work.
Exact supported work classes, OS support floor,
offline retention, notification policy, native login, renderer and distribution
remain decision/probe items. [Roadmap](../../../../.planning/native-mac/2026-11-02-ROADMAP.md)
keeps those dependencies visible.
