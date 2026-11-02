import SwiftUI

struct LaunchView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        PageScaffold(eyebrow: "Launch", title: "Admitted launch and recovery",
                     subtitle: "Inspect the owner capability, launch through the LaunchCoordinator, and recover a lost reply by status only.") {
            if model.isDemo {
                SyntheticNotice(message: "The demo owner replays the source launch fixture. It starts no job and runs no command. Approval is not admission.")
            }

            if model.session == nil {
                EmptyStateView(symbol: "lock", title: "Launch is unavailable",
                               message: model.isDemo ? "The demo session could not start." : "Sign in with a configured owner to inspect a launch capability.")
                    .cambiumPanel()
            } else {
                CapabilityPanel()
                AttemptPanel()
                if !model.pendingLaunch.isEmpty { PendingPanel() }
                if model.isDemo { DemoPanel() }
            }
        }
    }
}

private struct CapabilityPanel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Owner capability")
            if let capability = model.capability {
                FactRow(label: "Work", value: capability.workId, mono: true)
                FactRow(label: "Admission", value: capability.admissionRef, mono: true)
                FactRow(label: "Graph revision", value: String(capability.graphVersion))
                FactRow(label: "Loadout", value: capability.loadoutId, mono: true)
                FactRow(label: "Input digest", value: capability.inputDigest, mono: true)
                FactRow(label: "Plant", value: "\(capability.plantName) (\(capability.plant))")
                FactRow(label: "Action", value: capability.action)
                FactRow(label: "Expires", value: model.time(capability.expiresAt))
                Text("The owner returned this capability. The app did not build it, and an approved proposal does not create one.")
                    .font(.callout).foregroundStyle(Palette.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("No capability has been read. The app asks the owner for a capability by admission reference; it never builds one.")
                    .font(.callout).foregroundStyle(Palette.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                if let issue = model.issue {
                    Label("\(issue.title): \(issue.message)", systemImage: "exclamationmark.triangle")
                        .font(.callout).foregroundStyle(Palette.hold)
                }
            }
            HStack(spacing: 10) {
                Button("Inspect owner capability", action: model.inspectCapability)
                    .disabled(model.loading || model.launch != nil)
                Button("Launch", action: model.requestLaunch)
                    .buttonStyle(.borderedProminent)
                    .disabled(model.capability == nil || model.launch != nil || model.loading)
                Spacer()
            }
        }
        .cambiumPanel(highlighted: model.capability != nil)
    }
}

private struct AttemptPanel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Attempt")
            if let launch = model.launch {
                HStack(spacing: 8) {
                    StatusChip(text: launch.state, tone: Tone.forStatus(launch.state))
                    StatusChip(text: launch.plantName, tone: .muted)
                    Spacer()
                }
                FactRow(label: "Transport", value: launch.transport)
                FactRow(label: "Execution", value: launch.execution)
                FactRow(label: "Acceptance", value: launch.acceptance == "not_evaluated" ? "Not evaluated: no semantic acceptance exists" : launch.acceptance)
                FactRow(label: "Request", value: launch.requestId, mono: true)
                FactRow(label: "Attempt", value: launch.attemptId, mono: true)
                FactRow(label: "Owner reference", value: launch.ownerRef, missing: "None yet", mono: true)
                FactRow(label: "Updated", value: model.time(launch.updatedAt))
                if launch.needsStatusCheck {
                    Text("The original request is saved. Status reads the same request. It never sends another launch.")
                        .font(.callout).foregroundStyle(Palette.hold)
                        .fixedSize(horizontal: false, vertical: true)
                    Button("Check status", action: model.recoverLaunch)
                        .buttonStyle(.borderedProminent)
                        .disabled(model.loading)
                } else {
                    Text("This attempt is resolved. A new launch needs a new owner capability.")
                        .font(.callout).foregroundStyle(Palette.inkMuted)
                }
            } else {
                Text("No attempt in this session.").font(.callout).foregroundStyle(Palette.inkMuted)
            }
        }
        .cambiumPanel()
    }
}

private struct PendingPanel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Unresolved on opening", detail: "\(model.pendingLaunch.count)")
            ForEach(model.pendingLaunch) { record in
                VStack(alignment: .leading, spacing: 4) {
                    Text(record.requestId).font(CambiumFont.monoSmall).foregroundStyle(Palette.ink)
                    Text("\(record.workId) · \(record.plantName) · \(record.state)")
                        .font(.caption).foregroundStyle(Palette.inkMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .cambiumPanel(padding: 10)
            }
            if model.launch == nil {
                Button("Check status", action: model.recoverLaunch).disabled(model.loading)
            }
        }
        .cambiumPanel(highlighted: true)
    }
}

private struct DemoPanel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Demo controls")
            Text("These controls change only the demo owner and the demo recovery folder.")
                .font(.callout).foregroundStyle(Palette.inkMuted)
            HStack(spacing: 10) {
                Button(model.faultArmed ? "Response loss armed" : "Simulate response loss") { model.armFault() }
                    .disabled(model.faultArmed)
                Button("Reset demo state", role: .destructive) { model.resetDemo() }
                    .disabled(model.gate?.needsStatusCheck == true || model.launch?.needsStatusCheck == true)
                Spacer()
            }
            if model.gate?.needsStatusCheck == true || model.launch?.needsStatusCheck == true {
                Text("Reset is blocked while an attempt is unknown.").font(.caption).foregroundStyle(Palette.hold)
            } else {
                Text("Reset clears the demo owner and demo recovery. It cannot touch standard mode.")
                    .font(.caption).foregroundStyle(Palette.hold)
            }
        }
        .cambiumPanel()
    }
}
