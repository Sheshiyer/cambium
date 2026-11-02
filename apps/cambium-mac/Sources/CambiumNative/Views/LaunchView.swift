import SwiftUI

struct LaunchView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        PageScaffold(eyebrow: "Launch", title: "Admitted launch and recovery",
                     subtitle: "Inspect the owner capability, launch through the LaunchCoordinator, and recover a lost reply by status only.") {
            if model.isDemo {
                SyntheticNotice(message: "The launch listing is a dated example from 2026-11-02 for sapling:cambium. It is separate from the 2026-07-28 founder proposal. A fixed 2026-07-28 replay clock exercises both examples and does not establish current eligibility. The demo starts no job and runs no command. Approval is not admission.")
            }

            if model.session == nil {
                EmptyStateView(symbol: "lock", title: "Launch is unavailable",
                               message: model.isDemo ? "The demo session could not start." : "Sign in with a configured owner to inspect a launch capability.")
                    .cambiumPanel()
            } else {
                AdmissionListPanel()
                CapabilityPanel()
                AttemptPanel()
                if !model.pendingLaunch.isEmpty { PendingPanel() }
                if model.isDemo { DemoPanel() }
            }
        }
    }
}

private struct AdmissionListPanel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Already admitted", detail: model.selectedWork.map { $0.id } ?? "no work selected")
            Text("This list is a read-only observation of admissions the owner already holds for the selected work. It does not admit anything, and an approved proposal does not add a row.")
                .font(.callout).foregroundStyle(Palette.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
            if model.admissions.isEmpty {
                Text(model.admissionIssue.map { "\($0.title): \($0.message)" } ?? "No listing yet. List admissions for the selected work.")
                    .font(.callout).foregroundStyle(model.admissionIssue == nil ? Palette.inkMuted : Palette.hold)
                    .fixedSize(horizontal: false, vertical: true)
            }
            ForEach(model.admissions) { row in
                Button {
                    model.selectAdmission(row.admissionRef)
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 8) {
                            Text(row.admissionRef).font(CambiumFont.monoSmall).foregroundStyle(Palette.ink)
                            StatusChip(text: row.availability, tone: Tone.forStatus(row.availability))
                            StatusChip(text: row.reason, tone: .muted)
                            Spacer()
                            if model.selectedAdmissionRef == row.admissionRef {
                                Image(systemName: "checkmark.circle.fill").foregroundStyle(Palette.evidence)
                                    .accessibilityLabel("Selected")
                            }
                        }
                        Text("\(row.workId) · \(row.plant) · \(row.action) · expires \(model.time(row.expiresAt))")
                            .font(.caption).foregroundStyle(Palette.inkMuted)
                        if let existing = row.existingRequestId {
                            Text("Consumed by request \(existing)").font(.caption).foregroundStyle(Palette.hold)
                        }
                        if !row.selectable {
                            Text("Not selectable. Only a supported existing reference can be resolved.")
                                .font(.caption).foregroundStyle(Palette.hold)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .cambiumPanel(padding: 10)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Admission \(row.admissionRef), \(row.availability), \(row.reason)")
                .accessibilityHint(row.selectable ? "Selects this supported admission" : "This admission cannot be resolved")
                .accessibilityAddTraits(model.selectedAdmissionRef == row.admissionRef ? .isSelected : [])
            }
            HStack(spacing: 10) {
                Button("List admissions", action: model.listAdmissions)
                    .disabled(model.loading || model.selectedWork == nil)
                Button("Resolve selected capability", action: model.resolveSelectedCapability)
                    .buttonStyle(.borderedProminent)
                    .disabled(model.loading || model.selectedAdmissionRef == nil || model.launch != nil)
                Spacer()
            }
        }
        .cambiumPanel(highlighted: !model.admissions.isEmpty)
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
                    if launch.ownerAbsent {
                        Text("Status proved the owner has no row for these exact IDs. Retry sends that same saved request. It does not create a new request, attempt, or nonce.")
                            .font(.callout).foregroundStyle(Palette.ink)
                            .fixedSize(horizontal: false, vertical: true)
                        FactRow(label: "Original capability expires", value: model.time(launch.capabilityExpiresAt))
                        Button("Retry original request") { model.retryOriginalLaunch(nonce: launch.nonce) }
                            .disabled(model.loading)
                            .accessibilityHint("Resends the saved request and nonce")
                    }
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
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(record.requestId).font(CambiumFont.monoSmall).foregroundStyle(Palette.ink)
                        Text("\(record.workId) · \(record.admissionRef) · \(record.plantName) · \(record.state)")
                            .font(.caption).foregroundStyle(Palette.inkMuted)
                    }
                    Spacer()
                    Button("Check status") { model.recoverLaunch(nonce: record.nonce) }
                        .disabled(model.loading)
                        .accessibilityLabel("Check status for \(record.requestId)")
                    if record.ownerAbsent {
                        Button("Retry original request") { model.retryOriginalLaunch(nonce: record.nonce) }
                            .disabled(model.loading)
                            .accessibilityLabel("Retry original request \(record.requestId)")
                            .accessibilityHint("Resends the saved request and nonce")
                    }
                }
                .cambiumPanel(padding: 10)
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
                    .disabled(model.resetVisuallyBlocked)
                Spacer()
            }
            if model.resetVisuallyBlocked {
                Text("Reset is blocked while an attempt is unknown.").font(.caption).foregroundStyle(Palette.hold)
            } else {
                Text("Reset clears the demo owner and demo recovery. It cannot touch standard mode.")
                    .font(.caption).foregroundStyle(Palette.hold)
            }
        }
        .cambiumPanel()
    }
}
