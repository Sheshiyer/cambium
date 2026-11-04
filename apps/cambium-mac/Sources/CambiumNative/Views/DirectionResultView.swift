import SwiftUI
import struct CambiumCore.DirectionExecutionResult

struct DirectionResultView: View {
    @Environment(AppModel.self) private var model
    @State private var value: DirectionExecutionResult?
    @State private var busy = false
    @State private var message: String?
    @State private var generation = UUID()
    private var identity: String { "\(model.signalScopeVersion):\(model.launch?.requestId ?? ""): \(model.launch?.attemptId ?? "")" }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Coding result")
            if let value {
                Text(value.title).font(.headline)
                if let result = value.result {
                    Text(result.status == "result-ready" ? "Checks passed · ready for review" : "Checks need attention")
                        .foregroundStyle(result.status == "result-ready" ? Palette.evidence : Palette.hold)
                    Text("Baseline: \(result.baselineExitCode == 0 ? "passed" : "failed") · With change: \(result.candidateExitCode == 0 ? "passed" : "failed")")
                    Text("Review this result before accepting it. Publishing and merging require a separate decision.").font(.callout).foregroundStyle(Palette.inkMuted)
                    DisclosureGroup("Code change") { Text(result.diff ?? "").font(.system(.caption, design: .monospaced)).textSelection(.enabled) }
                    DisclosureGroup("Check output") {
                        Text(result.baselineLog + "\n" + result.candidateLog).font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                    }
                } else { Text(value.state == "failed" ? "The coding run failed before producing a result." : "A result is not available yet.").foregroundStyle(Palette.inkMuted) }
            } else { Text(message ?? "Check the saved result for this launch.").foregroundStyle(Palette.inkMuted) }
            Button(busy ? "Checking…" : "Check result") { Task { await load() } }.disabled(busy)
        }
        .cambiumPanel()
        .onChange(of: identity) { _, _ in generation = UUID(); value = nil; message = nil; busy = false }
    }
    private func load() async {
        guard !busy, let launch = model.launch, let services = model.signalService else { return }
        let scope = model.signalScopeVersion, request = UUID(); generation = request; busy = true
        defer { if generation == request { busy = false } }
        do {
            let result = try await services.directionExecutionResult(requestId: launch.requestId, attemptId: launch.attemptId)
            guard generation == request, scope == model.signalScopeVersion, model.launch?.requestId == launch.requestId,
                  model.launch?.attemptId == launch.attemptId, model.selectedWorkID == "sapling:cambium" else { return }
            value = result; message = nil
        } catch {
            guard generation == request, scope == model.signalScopeVersion else { return }
            value = nil; message = "We couldn’t confirm the result. Try again."
        }
    }
}
