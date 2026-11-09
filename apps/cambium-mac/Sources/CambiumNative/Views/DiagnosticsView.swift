import SwiftUI

/// Technical inspection lives behind Settings, outside everyday account flows.
struct DiagnosticsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Diagnostics").font(CambiumFont.heading)
                Spacer()
                Button("Done") { dismiss() }.keyboardShortcut(.cancelAction)
            }.padding(20)
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionHeader(title: "Session details")
                        FactRow(label: "Owner", value: model.ownerDescription)
                        FactRow(label: "Principal", value: model.session?.founderId, mono: true)
                        FactRow(label: "Tenant", value: model.session?.tenantId, mono: true)
                        FactRow(label: "Expires", value: model.session.map { model.time($0.expiresAt) })
                        if let issue = model.issue { FactRow(label: "Last issue", value: issue.message) }
                    }.cambiumPanel()
                    if !model.isDemo { DiagnosticOwnerPanel() }
                    if let fabric = model.fabric { DiagnosticFabricPanel(fabric: fabric) }
                    if let project = model.fabric?.portfolio?.projects.first(where: { $0.id == model.selectedProjectID }) {
                        VStack(alignment: .leading, spacing: 8) {
                            SectionHeader(title: "Selected project")
                            FactRow(label: "Canonical ID", value: project.canonicalId, mono: true)
                            FactRow(label: "Catalog work ID", value: project.workId, mono: true)
                            FactRow(label: "Runtime Work", value: project.runtimeWorkId, mono: true)
                            FactRow(label: "Tenant status", value: project.tenantStatus)
                            FactRow(label: "Missing fields", value: project.operationalGapMissingFields.joined(separator: ", "))
                            ForEach(project.sourceReferences) { source in Text(source.raw).font(CambiumFont.monoSmall).textSelection(.enabled) }
                        }.cambiumPanel()
                    }
                    if let signal = model.inboxDraft.selected {
                        VStack(alignment: .leading, spacing: 8) {
                            SectionHeader(title: "Selected signal")
                            FactRow(label: "ID", value: signal.id, mono: true)
                            FactRow(label: "Source", value: signal.source.system)
                            FactRow(label: "Source record", value: signal.source.recordId, mono: true)
                            FactRow(label: "Source version", value: signal.source.version)
                            FactRow(label: "Revision", value: String(signal.revision))
                            FactRow(label: "Observed", value: signal.source.observedAt)
                        }.cambiumPanel()
                    }
                    ForEach(model.snapshot.connections) { connection in
                        VStack(alignment: .leading, spacing: 8) {
                            SectionHeader(title: connection.name)
                            FactRow(label: "ID", value: connection.id, mono: true)
                            Text(connection.detail).font(.callout)
                            FactRow(label: "Observed", value: connection.observedAt.map(model.time))
                        }.cambiumPanel()
                    }
                    if !model.lineage.isEmpty { DiagnosticLineagePanel() }
                }.padding(20)
            }
        }
        .frame(minWidth: 600, idealWidth: 720, minHeight: 500, idealHeight: 680)
        .background(Palette.canvas)
    }
}

private struct DiagnosticOwnerPanel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Owner configuration")
            Text("Enter the reviewed owner identity. These fields hold no password, token or secret. Applying contacts nothing and lasts for this session.")
                .font(.callout).foregroundStyle(Palette.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
            Text("Mapped profile: Curious · cambium. The values are prefilled only; nothing is contacted until you apply them.")
                .font(.caption).foregroundStyle(Palette.rail)
                .fixedSize(horizontal: false, vertical: true)
            Text("Sign in opens Founder Gate in your browser and returns to Cambium. A session lasts 15 minutes.")
                .font(.callout).foregroundStyle(Palette.inkMuted)
            TextField("Owner URL (https)", text: $model.ownerURLDraft).textFieldStyle(.roundedBorder).font(CambiumFont.mono)
            TextField("Tenant", text: $model.tenantDraft).textFieldStyle(.roundedBorder).font(CambiumFont.mono)
            TextField("Reviewed client ID", text: $model.clientIDDraft).textFieldStyle(.roundedBorder).font(CambiumFont.mono)
            TextField("Callback", text: $model.redirectDraft).textFieldStyle(.roundedBorder).font(CambiumFont.mono)
            if let problem = model.configurationProblem {
                Label(problem, systemImage: "exclamationmark.triangle").font(.callout).foregroundStyle(Palette.hold)
            }
            HStack(spacing: 10) {
                Button("Use for this session", action: model.applyConfiguration)
                if model.configuration != nil {
                    Button("Sign in", action: model.signIn).buttonStyle(.borderedProminent).disabled(model.loading)
                    Button("Clear", action: model.clearConfiguration)
                }
                Spacer()
            }
            if model.configuration == nil {
                Text("Standard mode is unconfigured. Sign-in, reads and actions stay off until a valid configuration is applied.")
                    .font(.callout).foregroundStyle(Palette.hold)
            }
        }
        .cambiumPanel()
    }
}

private struct DiagnosticFabricPanel: View {
    @Environment(AppModel.self) private var model
    let fabric: FabricDisplay

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Mission Fabric read")
            FactRow(label: "Tenant", value: fabric.tenantId, mono: true)
            FactRow(label: "Graph version", value: String(fabric.graphVersion))
            FactRow(label: "Graph digest", value: fabric.graphDigest, mono: true)
            FactRow(label: "Projection as of", value: model.time(fabric.asOf))
            FactRow(label: "Generated", value: model.time(fabric.generatedAt))
            FactRow(label: "Served", value: model.time(fabric.servedAt))
            FactRow(label: "Delivery freshness", value: fabric.freshness)
            FactRow(label: "Gap, projection to delivery", value: SourceTime.gap(observed: fabric.asOf, snapshot: fabric.servedAt))
            Divider()
            SectionHeader(title: "Portfolio catalog sidecar")
            FactRow(label: "Catalog", value: fabric.sidecars.catalogTotal.map {
                "\($0) records: \(fabric.sidecars.saplings ?? 0) saplings, \(fabric.sidecars.clientBranches ?? 0) client branches, \(fabric.sidecars.internalPrograms ?? 0) programs"
            }, missing: "No catalog sidecar")
            FactRow(label: "Catalog digest", value: fabric.sidecars.catalogDigest, missing: "None", mono: true)
            FactRow(label: "Action admission", value: fabric.sidecars.actionAdmission, missing: "None")
            FactRow(label: "Join with runtime", value: fabric.sidecars.joinMatched.map {
                "\($0) matched, \(fabric.sidecars.joinCatalogOrphans ?? 0) catalog-only, \(fabric.sidecars.joinRuntimeOrphans ?? 0) runtime-only"
            }, missing: "No join report")
            FactRow(label: "Pair digest", value: fabric.sidecars.portfolioPairDigest, missing: "None", mono: true)
            FactRow(label: "Organ delivery", value: fabric.sidecars.organDeliveryPresent
                    ? (fabric.sidecars.organDeliveryIsSummary ? "Summary only" : "Illustrative plan; not an active delivery")
                    : nil, missing: "Not served")
            Text("The catalog describes the portfolio. It is not admission, and a join does not make a record launchable.")
                .font(.caption).foregroundStyle(Palette.inkMuted)
        }
        .cambiumPanel()
    }
}

private struct DiagnosticLineagePanel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Demo fixtures", detail: "\(model.lineage.count)")
            ForEach(model.lineage) { row in
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(row.name).font(CambiumFont.monoSmall).foregroundStyle(Palette.ink)
                        Text("\(row.source) · sha256 \(row.sha256.prefix(12))").font(.caption).foregroundStyle(Palette.inkMuted)
                    }
                    Spacer()
                    StatusChip(text: row.verified ? "hash matches" : "hash differs", tone: row.verified ? .evidence : .hold)
                }
            }
        }
        .cambiumPanel()
    }
}
