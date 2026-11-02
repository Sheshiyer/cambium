import AppKit
import CryptoKit
import IOKit.pwr_mgt
import SwiftUI

// Cambium Native entry point.
//
// Scene, window and snapshot behavior adapted from the Bama new-mac-app template
// (MIT, Dave Ebbelaar, pinned 639893c; see source-provenance/BAMA.md). The task
// model, SwiftData store and seed data of that template are not used here.
//
// Launch environment (all optional):
//   CAMBIUM_NATIVE_DEMO=1            labelled synthetic demo mode; no provider credentials are read
//   CAMBIUM_NATIVE_SNAPSHOT=<dir>    capture the main window, light and dark, default and minimum
//                                    size, write PNGs plus snapshot-manifest.json, then quit.
//                                    Requires CAMBIUM_NATIVE_DEMO=1.
//   CAMBIUM_NATIVE_SCREEN=<section>  demo mode only: open one AppSection (canopy, work, trace, evidence,
//                                    proposal, launch, knowledge, connections, preferences) at launch.
//                                    With a snapshot, files are named main-<section>-<size>-<appearance>.png
//                                    and the manifest records the page. Unset keeps the Canopy capture.
//   CAMBIUM_NATIVE_EXPECTED_REVISION=<rev>
//                                    snapshot only: refuse to run unless the embedded build stamp's
//                                    source revision starts with <rev> (7+ hex). It is a check and
//                                    never changes the revision the manifest reports.
//
// The reported source revision comes only from Contents/Resources/build-proof.json, written by
// build.sh before codesign. A snapshot refuses a missing or malformed stamp.

@main
struct CambiumNativeApp: App {
    @NSApplicationDelegateAdaptor(CambiumAppDelegate.self) private var delegate

    var body: some Scene {
        WindowGroup(LaunchMode.current.windowTitle, id: WindowID.main) {
            CambiumRootView()
                .frame(minWidth: WindowMetrics.minimum.width, minHeight: WindowMetrics.minimum.height)
        }
        .defaultSize(WindowMetrics.standard)
        .windowResizability(.contentMinSize)
        .windowToolbarStyle(.unified)
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("About Cambium Native") { AboutPanel.show() }
            }
            CambiumNavigationCommands()
            SidebarCommands()
            ToolbarCommands()
            InspectorCommands()
            TextEditingCommands()
        }

        Settings {
            FoundationSettings()
        }
        .windowResizability(.contentSize)
    }
}

enum WindowID {
    static let main = "main"
}

/// Window sizes shared by the scene and snapshot mode, so snapshots show the sizes people get.
enum WindowMetrics {
    static let minimum = CGSize(width: 880, height: 560)
    static let standard = CGSize(width: 1280, height: 820)
}

/// Whether this process shows synthetic demo data. Real reads stay unavailable until
/// native identity exists; demo mode only labels that state honestly.
enum LaunchMode: String, Sendable {
    case standard
    case demo

    static let current: LaunchMode =
        ProcessInfo.processInfo.environment["CAMBIUM_NATIVE_DEMO"] == "1" ? .demo : .standard

    var windowTitle: String {
        self == .demo ? "Cambium Native — Demo (synthetic data)" : "Cambium Native"
    }

    var summary: String {
        switch self {
        case .demo: "Demo mode: synthetic, labelled records. No provider credentials or live reads."
        case .standard: "Live owner reads require native sign-in, which is not available in this build."
        }
    }
}

final class CambiumAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Started from a terminal, the process is not a foreground app yet.
        NSApp.setActivationPolicy(.regular)
        NSApp.activate()
        SnapshotRun.startIfRequested()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) {
        if let code = SnapshotRun.exitCode { exit(code) }
    }
}

enum AboutPanel {
    static func show() {
        let credits = NSAttributedString(
            string: "\(LaunchMode.current.summary)\n\nFoundation adapted from the Bama Mac app template (MIT).",
            attributes: [.font: NSFont.systemFont(ofSize: NSFont.smallSystemFontSize),
                         .foregroundColor: NSColor.secondaryLabelColor])
        NSApp.orderFrontStandardAboutPanel(options: [.credits: credits])
    }
}

/// Minimal Settings scene owned by the foundation. It shows build and data-mode facts only;
/// the interface owner may replace it with the design-kit Settings.
private struct FoundationSettings: View {
    private var identifier: String { Bundle.main.bundleIdentifier ?? "unbundled (swift run)" }
    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "dev"
        let build = info?["CFBundleVersion"] as? String ?? "local"
        return "\(short) (\(build))"
    }

    var body: some View {
        Form {
            Section("Data") {
                LabeledContent("Mode", value: LaunchMode.current == .demo ? "Demo (synthetic)" : "Standard")
                Text(LaunchMode.current.summary)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            Section("Build") {
                LabeledContent("Identifier", value: identifier)
                LabeledContent("Version", value: version)
            }
        }
        .formStyle(.grouped)
        .frame(width: 440)
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// Snapshot mode: real window captures for review, adapted from Bama's Snapshot.swift.
enum SnapshotRun {
    private(set) static var exitCode: Int32?

    /// Page requested with CAMBIUM_NATIVE_SCREEN. Honored in demo mode only; an
    /// unrecognized or empty value is nil.
    static let requestedSection: AppSection? = {
        guard LaunchMode.current == .demo else { return nil }
        return rawScreenRequest.flatMap(AppSection.init(rawValue:))
    }()

    private static var rawScreenRequest: String? {
        ProcessInfo.processInfo.environment["CAMBIUM_NATIVE_SCREEN"].flatMap { $0.isEmpty ? nil : $0 }
    }

    /// Set by the root view once it has opened the requested page, so the manifest
    /// reports the page that was actually shown.
    static var appliedSection: AppSection?

    private struct Shot: Codable {
        var file: String
        var page: String
        var appearance: String
        var size: String
        var width: Double
        var height: Double
        var method: String
    }

    private struct Manifest: Codable {
        var schema = "cambium.native.snapshot.v2"
        var bundleIdentifier: String
        var dataMode: String
        var synthetic: Bool
        var statement: String
        var requestedPage: String?
        var page: String
        var build: BuildStamp
        var executableSha256: String
        var provenanceNote: String
        var capturedAt: String
        var shots: [Shot]
        var failures: [String]
    }

    static func startIfRequested() {
        let env = ProcessInfo.processInfo.environment
        guard let dir = env["CAMBIUM_NATIVE_SNAPSHOT"], !dir.isEmpty else { return }
        guard LaunchMode.current == .demo else {
            finish(code: 2, message: "SNAPSHOT refused: set CAMBIUM_NATIVE_DEMO=1 so captures show labelled synthetic data")
            return
        }
        if let raw = rawScreenRequest, AppSection(rawValue: raw) == nil {
            let known = AppSection.allCases.map(\.rawValue).joined(separator: ", ")
            finish(code: 2, message: "SNAPSHOT refused: unknown CAMBIUM_NATIVE_SCREEN '\(raw)'. Use one of: \(known)")
            return
        }
        let stamp: BuildStamp
        do { stamp = try BuildStamp.loadEmbedded() } catch {
            finish(code: 2, message: "SNAPSHOT refused: \(error)")
            return
        }
        if let expected = env["CAMBIUM_NATIVE_EXPECTED_REVISION"], !expected.isEmpty,
           !stamp.matchesExpected(expected) {
            finish(code: 2, message: "SNAPSHOT refused: expected revision \(expected) but this bundle was built from \(stamp.sourceRevision)")
            return
        }
        guard let executableSha256 = BuildStamp.executableSha256() else {
            finish(code: 2, message: "SNAPSHOT refused: cannot hash the running executable")
            return
        }
        Task { await run(into: URL(fileURLWithPath: dir, isDirectory: true), stamp: stamp, executableSha256: executableSha256) }
    }

    private static func run(into dir: URL, stamp: BuildStamp, executableSha256: String) async {
        // A sleeping display gives screencapture nothing. These assertions end with the process.
        var activity: IOPMAssertionID = 0
        IOPMAssertionDeclareUserActivity("Cambium snapshots" as CFString, kIOPMUserActiveLocal, &activity)
        var awake: IOPMAssertionID = 0
        IOPMAssertionCreateWithName(kIOPMAssertionTypePreventUserIdleDisplaySleep as CFString,
                                    IOPMAssertionLevel(kIOPMAssertionLevelOn), "Cambium snapshots" as CFString, &awake)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        } catch {
            finish(code: 1, message: "SNAPSHOT cannot create output folder: \(error.localizedDescription)")
            return
        }
        try? await Task.sleep(for: .seconds(1.5))

        var shots: [Shot] = []
        var failures: [String] = []
        let requested = requestedSection
        // Default captures keep the Canopy page and the original file names.
        let page = requested ?? .canopy
        if let requested, appliedSection != requested {
            failures.append("page \(requested.rawValue): root view did not open it")
        }
        let sizes: [(String, CGSize)] = [("default", WindowMetrics.standard), ("minimum", WindowMetrics.minimum)]
        for appearance in ["light", "dark"] {
            NSApp.appearance = NSAppearance(named: appearance == "light" ? .aqua : .darkAqua)
            for (label, size) in sizes {
                guard let window = mainWindow() else {
                    failures.append("\(appearance)-\(label): no main window")
                    continue
                }
                window.setContentSize(size)
                window.center()
                try? await Task.sleep(for: .seconds(0.8))
                let name = requested == nil
                    ? "main-\(label)-\(appearance).png"
                    : "main-\(page.rawValue)-\(label)-\(appearance).png"
                let target = dir.appending(path: name)
                if let method = capture(window, to: target) {
                    let content = window.contentView?.bounds.size ?? size
                    shots.append(Shot(file: name, page: page.rawValue, appearance: appearance, size: label,
                                      width: content.width, height: content.height, method: method))
                    log("SNAPSHOT \(target.path) (\(method))")
                } else {
                    failures.append("\(name): capture failed")
                }
            }
        }

        let manifest = Manifest(
            bundleIdentifier: Bundle.main.bundleIdentifier ?? "unbundled",
            dataMode: LaunchMode.current.rawValue,
            synthetic: true,
            statement: "Demo mode: every record shown is synthetic. Nothing is live.",
            requestedPage: requested?.rawValue,
            page: page.rawValue,
            build: stamp,
            executableSha256: executableSha256,
            provenanceNote: "build holds the source revision and input digests embedded at build time. "
                + "executableSha256 is the hash of the running executable, computed at capture; it is a hash, "
                + "not a signature, and the code signature is verified separately by codesign.",
            capturedAt: ISO8601DateFormatter().string(from: Date()),
            shots: shots,
            failures: failures)
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(manifest).write(to: dir.appending(path: "snapshot-manifest.json"))
        } catch {
            failures.append("manifest: \(error.localizedDescription)")
        }
        let ok = failures.isEmpty && !shots.isEmpty
        finish(code: ok ? 0 : 1, message: ok ? "SNAPSHOT done \(dir.path)" : "SNAPSHOT failed: \(failures.joined(separator: "; "))")
    }

    private static func mainWindow() -> NSWindow? {
        NSApp.windows.first { $0.isVisible && $0.canBecomeMain && !$0.isSheet }
    }

    /// Captures the real window so materials match the screen; needs Screen Recording
    /// permission for the launching app. Falls back to drawing the view hierarchy.
    private static func capture(_ window: NSWindow, to url: URL) -> String? {
        if NSApp.isHidden { NSApp.unhideWithoutActivation() }
        NSApp.activate()
        window.makeKeyAndOrderFront(nil)
        try? FileManager.default.removeItem(at: url)
        for _ in 1...3 {
            let shot = Process()
            shot.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
            shot.arguments = ["-x", "-o", "-l", String(window.windowNumber), url.path]
            try? shot.run()
            shot.waitUntilExit()
            if FileManager.default.fileExists(atPath: url.path) { return "screencapture" }
            Thread.sleep(forTimeInterval: 0.5)
        }
        guard let view = window.contentView?.superview ?? window.contentView,
              let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { return nil }
        view.cacheDisplay(in: view.bounds, to: rep)
        guard let data = rep.representation(using: .png, properties: [:]),
              (try? data.write(to: url)) != nil else { return nil }
        return "view-cache-fallback"
    }

    private static func log(_ line: String) {
        FileHandle.standardOutput.write(Data((line + "\n").utf8))
    }

    private static func finish(code: Int32, message: String) {
        log(message)
        exitCode = code
        // An open sheet refuses terminate, and the run would wait forever.
        for window in NSApp.windows { if let sheet = window.attachedSheet { window.endSheet(sheet) } }
        NSApp.terminate(nil)
    }
}

/// The build stamp embedded by build.sh (Contents/Resources/build-proof.json). It is the only
/// source of the reported source revision: nothing at runtime reads git or the environment
/// to relabel the bundle.
struct BuildStamp: Codable, Sendable {
    var schema: String
    var sourceRevision: String
    var inputsDirty: Bool
    var inputsAggregateSha256: String
    var inputCount: Int
    var configuration: String
    var swiftToolchain: String
    var generatedAt: String
    var proofSha256: String

    struct Failure: Error, CustomStringConvertible { var description: String }

    private struct Input: Decodable { var path: String; var sha256: String }
    private struct Toolchain: Decodable { var swift: String }
    private struct Proof: Decodable {
        var schema: String
        var sourceRevision: String
        var inputsDirty: Bool
        var inputsAggregateSha256: String
        var inputs: [Input]
        var configuration: String
        var toolchain: Toolchain
        var generatedAt: String
    }

    static let maxProofBytes = 2 * 1024 * 1024

    static func loadEmbedded() throws -> BuildStamp {
        guard let url = Bundle.main.url(forResource: "build-proof", withExtension: "json") else {
            throw Failure(description: "missing build stamp (build-proof.json); rebuild with build.sh")
        }
        guard let data = try? Data(contentsOf: url), !data.isEmpty, data.count <= maxProofBytes else {
            throw Failure(description: "unreadable or oversized build stamp")
        }
        guard let proof = try? JSONDecoder().decode(Proof.self, from: data) else {
            throw Failure(description: "malformed build stamp")
        }
        guard proof.schema == "cambium.native.build-proof.v1",
              isHex(proof.sourceRevision, 40), isHex(proof.inputsAggregateSha256, 64),
              !proof.inputs.isEmpty,
              proof.inputs.allSatisfy({ isHex($0.sha256, 64) && !$0.path.hasPrefix("/")
                  && !$0.path.split(separator: "/").contains("..") }) else {
            throw Failure(description: "malformed build stamp fields")
        }
        let lines = proof.inputs.sorted { $0.path < $1.path }.map { "\($0.sha256)  \($0.path)\n" }.joined()
        guard sha256Hex(Data(lines.utf8)) == proof.inputsAggregateSha256 else {
            throw Failure(description: "build stamp aggregate digest does not match its inputs")
        }
        return BuildStamp(schema: proof.schema, sourceRevision: proof.sourceRevision,
                          inputsDirty: proof.inputsDirty, inputsAggregateSha256: proof.inputsAggregateSha256,
                          inputCount: proof.inputs.count, configuration: proof.configuration,
                          swiftToolchain: proof.toolchain.swift, generatedAt: proof.generatedAt,
                          proofSha256: sha256Hex(data))
    }

    func matchesExpected(_ expected: String) -> Bool {
        let e = expected.lowercased()
        return e.count >= 7 && Self.isHex(e, nil) && sourceRevision.hasPrefix(e)
    }

    static func executableSha256() -> String? {
        guard let url = Bundle.main.executableURL, let data = try? Data(contentsOf: url) else { return nil }
        return sha256Hex(data)
    }

    private static func isHex(_ value: String, _ length: Int?) -> Bool {
        (length == nil || value.count == length) && !value.isEmpty
            && value.allSatisfy { $0.isASCII && ($0.isNumber || ("a"..."f").contains($0)) }
    }

    private static func sha256Hex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}
