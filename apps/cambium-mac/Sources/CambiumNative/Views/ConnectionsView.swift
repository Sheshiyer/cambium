import SwiftUI

struct ConnectionsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        PageScaffold(eyebrow: "Connections", title: "Connections and owner setup",
                     subtitle: "What this app is connected to, how fresh each source is, and the owner configuration for standard mode.") {
            SessionPanel()
            if !model.isDemo { OwnerPanel() }
            if let fabric = model.fabric { FabricPanel(fabric: fabric) }
            if !model.snapshot.connections.isEmpty {
                VStack(spacing: 12) {
                    ForEach(model.snapshot.connections) { conn in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(conn.name).font(CambiumFont.heading).foregroundStyle(Palette.ink)
                                Text(conn.id).font(CambiumFont.monoSmall).foregroundStyle(Palette.rail)
                                Spacer()
                                StatusChip(text: conn.status, tone: Tone.forStatus(conn.status))
                            }
                            Text(conn.detail).font(.callout).foregroundStyle(Palette.inkMuted)
                                .fixedSize(horizontal: false, vertical: true)
                            if let observed = conn.observedAt {
                                Text("Served: \(model.time(observed))").font(.caption2).foregroundStyle(Palette.inkMuted)
                            }
                        }
                        .cambiumPanel(padding: 14)
                    }
                }
            }
            if model.isDemo && !model.lineage.isEmpty { LineagePanel() }
        }
    }
}

private struct SessionPanel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Session")
            FactRow(label: "Owner", value: model.ownerDescription)
            if let session = model.session {
                FactRow(label: "Founder", value: session.founderId, mono: true)
                FactRow(label: "Tenant", value: session.tenantId, mono: true)
                FactRow(label: "Session expires", value: model.time(session.expiresAt))
                if session.synthetic {
                    Text("This session is pinned for the demo. It is not a sign-in.").font(.callout).foregroundStyle(Palette.hold)
                }
                if !model.isDemo {
                    Button("Sign out", action: model.signOut)
                }
            } else {
                Text("Not signed in.").font(.callout).foregroundStyle(Palette.hold)
            }
            if let replay = model.replayClock {
                FactRow(label: "Replay clock", value: model.time(replay))
                Text("Fixed source replay time. It is not the current time and not live freshness.")
                    .font(.caption).foregroundStyle(Palette.hold)
            }
        }
        .cambiumPanel(highlighted: true)
    }
}

private struct OwnerPanel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Owner configuration")
            Text("Enter the reviewed owner identity. These fields hold no password, token or secret. Applying contacts nothing and lasts for this session.")
                .font(.callout).foregroundStyle(Palette.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
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

private struct FabricPanel: View {
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

private struct LineagePanel: View {
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
