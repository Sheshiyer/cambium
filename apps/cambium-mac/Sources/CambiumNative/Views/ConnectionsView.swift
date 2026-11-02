import SwiftUI

struct ConnectionsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        PageScaffold(eyebrow: "Connections", title: "System connections",
                     subtitle: "Observed external integrations and transport health notices.") {
            if model.snapshot.connections.isEmpty {
                EmptyStateView(symbol: "network.slash", title: "No connections",
                               message: "No connections recorded.")
                    .cambiumPanel()
            } else {
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
                                Text("Observed: \(model.time(observed))").font(.caption2).foregroundStyle(Palette.inkMuted)
                            }
                        }
                        .cambiumPanel(padding: 14)
                    }
                }
            }
        }
    }
}
