import SwiftUI

struct LaunchView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        PageScaffold(eyebrow: "Launch", title: "Admitted launch & run recovery",
                     subtitle: "Simulate local launch phases, result collection, and status-only uncertain recovery. Completely isolated and synthetic.") {
            if model.isDemo { SyntheticNotice(message: "Launch preview is local and synthetic. No execution capability, remote worker or live token is attached.") }

            VStack(alignment: .leading, spacing: 14) {
                SectionHeader(title: "Launch phases")
                FactRow(label: "Phase", value: model.launch.phase.rawValue.capitalized)
                FactRow(label: "Transport", value: model.launch.transport)
                FactRow(label: "Execution", value: model.launch.execution)
                FactRow(label: "Acceptance", value: model.launch.acceptance)

                HStack(spacing: 10) {
                    switch model.launch.phase {
                    case .idle:
                        Button("Request capability") { model.requestLaunch() }
                            .buttonStyle(.borderedProminent)
                    case .requested:
                        Button("Start run") { model.startRun() }
                            .buttonStyle(.borderedProminent)
                    case .running:
                        Button("Finish run") { model.finishRun() }
                            .buttonStyle(.borderedProminent)
                    case .finished:
                        Button("Simulate uncertain reply") { model.loseReply() }
                            .buttonStyle(.bordered)
                    case .uncertain:
                        Button("Check status (status-only)") { model.checkStatus() }
                            .buttonStyle(.borderedProminent)
                    }

                    if model.launch.phase != .idle {
                        Button("Reset preview", action: model.resetLaunch)
                    }
                }
                .padding(.top, 4)

                if model.launch.phase == .uncertain {
                    Text("Uncertain recovery: checked \(model.launch.statusChecks) times. Status-only check never relaunches.")
                        .font(.callout)
                        .foregroundStyle(Palette.hold)
                }
            }
            .cambiumPanel(highlighted: model.launch.phase != .idle)

            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Admission rules")
                Text("An admitted run requires a verified Git-backed admission mode with canonical observed Git root, common directory, branch, repository identity, manifest, and manually hands-enabled enrollment.")
                    .font(.callout)
                    .foregroundStyle(Palette.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .cambiumPanel()
        }
    }
}
