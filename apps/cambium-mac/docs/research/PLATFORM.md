# Apple platform research

2 November 2026. Official Apple documentation/DocC metadata was inspected in a
read-only specialist pass. Introduction versions below are API availability,
not Cambium's chosen support floor or a successful compile. No signed app,
entitlement, login or local-network permission was tested.

## Native foundation

| Concern | Primary-source finding | Cambium consequence / remaining probe |
| --- | --- | --- |
| Navigation | `NavigationSplitView` is available from macOS 13; `inspector` from 14 | Sidebar/content/dossier with contextual inspector is viable; verify widths, focus, selection and windows |
| Preferences | `AppStorage` uses UserDefaults; `SceneStorage` is lightweight state restoration with no guaranteed save timing | Appearance/preferences and scene selection only; no durable decision or launch ledger |
| Structured cache | SwiftData `ModelConfiguration` is available from macOS 14 and supports memory-only storage | Optional; explicitly disable CloudKit inference for disposable local cache; test partitioning/expiry |
| Authentication | `ASWebAuthenticationSession` is available from macOS 10.15; newer `Callback` from 14.4 | Candidate UI after the service defines native callback/exchange; no inherited Access login assumed |
| Authentication privacy | Ephemeral browser session is requested, and browser support affects behavior | Verify actual supported browser and identity switching; request is not universal isolation proof |
| API session | Ephemeral URLSession stores cache/cookies/credentials in memory; invalidation purges its data | Explicit owner-scoped session lifecycle; sign-out and principal changes invalidate it |
| Web visualization | WebKit's SwiftUI `WebView`/`WebPage` are macOS 26 APIs; local resource handling exists | Correct module is WebKit. Compare bounded spatial scene with native 2D at candidate 26+ baseline |
| Web data | WKWebsiteDataStore defaults persistent; `nonPersistent()` supplies an in-memory store | Set policy before view creation; never assume it shares URLSession or external-browser login |
| Graph accessibility | Standard controls have baseline semantics; custom Canvas can supply accessibility children | Graph and list must expose the same work/relationships; verify actual VoiceOver and keyboard |
| Motion | `accessibilityReduceMotion` exposes the user's preference | Static readable state must remain complete when spatial animation is disabled |
| Network | Sandbox outgoing-network entitlement permits connections to another or the same machine | Loopback needs a signed-app probe; sandbox, ATS and Local Network privacy are distinct mechanisms |
| Files/CLI | Embedded tools inherit the containing sandbox; sandbox does not grant general home-directory access | Field Theory and local Hands use supported owner interfaces and explicit access, not broad filesystem assumptions |
| Distribution | App Store requires sandbox; direct notarization requires Hardened Runtime and valid signing | Decide route, app identity and update policy; verify actual signed artifact and recovery later |
| Automation | App Intents can be in the app bundle, extension or shared framework | XcodeGen is Bama workflow advice when capabilities warrant it, not a universal Apple requirement |

Apple currently says automatically provided App Shortcuts are not supported on
macOS; users can build custom Mac shortcuts using an app's intents. A later story
should promise a bounded App Intent only after testing that exact Mac behavior.

The native first release includes deliberate Gate coordination and launch of
already-admitted work. Running an arbitrary child process is not that contract.
A local execution adapter must name the owner executable/service, validate the
admission/reference, use structured arguments without shell interpolation, bound
its output, and recover through the owner. A sandboxed child does not escape the
app's restrictions. A remote adapter must not impersonate Hermes' runner identity.

## Decision and probe table

| Decision | Current recommendation | Evidence still required |
| --- | --- | --- |
| Deployment baseline | macOS 26+ candidate, following Bama and optional WebKit scene | Founder support window and native target build; API minimum alone does not decide it |
| Project shape | SwiftPM if sufficient; XcodeGen if chosen targets/capabilities warrant | Minimal fixture with selected auth, packaging and later automation |
| Native authentication | External-browser session candidate, server-owned exchange | Access/Plexus owner design; callback/audience/expiry/role/revocation tests |
| Rendering | Native 2D first, optional WebKit scene comparison | Same work task, memory/GPU/latency, focus, origin restrictions and accessibility |
| Host connection | Narrow owner-specific local/remote adapters | Exact signed app with intended endpoint/permissions and admitted launch contract |
| Cache | Minimal preferences plus memory-only operational reads initially | Explicit TTL/expiry, sign-out and scope-switch tests; retain only allowed recovery refs |
| Distribution | Decide alongside execution/permissions architecture | Signed bundle/notarization/install/update/recovery on actual target Mac |

Do not use terminal `curl` as proof of native privacy behavior. Apple documents
different treatment for command-line tools launched from Terminal/SSH and tracks
Mac app privacy identity through signing. Exact localhost/IPv4/IPv6 behavior and
the final app entitlements remain platform probes.

## Primary sources

- [NavigationSplitView availability](https://developer.apple.com/tutorials/data/documentation/swiftui/navigationsplitview.json)
- [Inspector availability](https://developer.apple.com/tutorials/data/documentation/swiftui/view/inspector%28ispresented%3Acontent%3A%29.json), [Apple inspector session](https://developer.apple.com/videos/play/wwdc2023/10161/)
- [Settings/AppStorage](https://developer.apple.com/documentation/foundation/accessing-settings-from-your-code), [SceneStorage](https://developer.apple.com/documentation/swiftui/scenestorage)
- [SwiftData configuration](https://developer.apple.com/tutorials/data/documentation/swiftdata/modelconfiguration.json), [sync configuration](https://developer.apple.com/documentation/swiftdata/syncing-model-data-across-a-persons-devices)
- [ASWebAuthenticationSession](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession), [Callback metadata](https://developer.apple.com/tutorials/data/documentation/authenticationservices/aswebauthenticationsession/callback.json), [ephemeral behavior](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession/prefersephemeralwebbrowsersession)
- [Ephemeral URLSession](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/ephemeral), [cookie storage](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/httpcookiestorage)
- [WebKit for SwiftUI](https://developer.apple.com/documentation/webkit/webkit-for-swiftui), [WebView](https://developer.apple.com/documentation/webkit/webview-swift.struct), [availability](https://developer.apple.com/tutorials/data/documentation/webkit/webview-swift.struct.json), [local-resource sample](https://developer.apple.com/documentation/webkit/building-a-cross-platform-web-browser), [website data store](https://developer.apple.com/documentation/webkit/wkwebsitedatastore)
- [Accessibility fundamentals](https://developer.apple.com/documentation/swiftui/accessibility-fundamentals), [Reduce Motion](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducemotion)
- [Outgoing network entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.network.client), [sandbox](https://developer.apple.com/documentation/security/protecting-user-data-with-app-sandbox), [local ATS](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking), [TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- [Distribution](https://developer.apple.com/documentation/xcode/preparing-your-app-for-distribution), [notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution), [App Intent placement](https://developer.apple.com/documentation/appintents/configuring-the-runtime-behavior-of-your-app-intents), [Mac App Shortcuts guidance](https://developer.apple.com/design/human-interface-guidelines/app-shortcuts)
