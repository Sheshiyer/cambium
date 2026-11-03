import SwiftUI
import struct CambiumCore.EvidenceItem

struct EvidenceView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        PageScaffold(eyebrow: "Evidence", title: "Evidence",
                     subtitle: "References and their source times. A reference shows where something is; it does not prove that work succeeded.") {
            if model.allEvidence.isEmpty {
                EmptyStateView(symbol: "doc.badge.clock", title: "No evidence to show",
                               message: "No owner is configured, so no evidence has been read.")
                    .cambiumPanel()
            } else {
                HStack(alignment: .top, spacing: 16) {
                    List(model.allEvidence, selection: $model.selectedEvidenceID) { item in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title)
                            Text(model.time(item.observedAt)).font(.caption).foregroundStyle(.secondary)
                        }
                        .tag(item.id)
                        .accessibilityLabel("\(item.title), \(model.time(item.observedAt))")
                    }
                    .frame(minWidth: 220, idealWidth: 260, maxWidth: 300, minHeight: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                    if let item = model.selectedEvidence {
                        EvidenceDetail(item: item)
                    } else {
                        EmptyStateView(symbol: "hand.point.left", title: "Choose evidence",
                                       message: "Select an item to see its source and time.")
                            .cambiumPanel()
                    }
                }
            }
        }
    }
}

private struct EvidenceDetail: View {
    @Environment(AppModel.self) private var model
    let item: EvidenceItem

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(item.title).font(CambiumFont.title).foregroundStyle(Palette.ink)
                Spacer(minLength: 8)
                StatusChip(text: item.kind, tone: .evidence)
            }
            if model.isDemo { SyntheticBadge(compact: true) }
            FactRow(label: "Source", value: item.sourceRef, mono: true)
            FactRow(label: "Source time", value: item.observedAt == nil ? nil : model.time(item.observedAt),
                    missing: "No source time")
            FactRow(label: "Snapshot time", value: model.time(model.snapshot.asOf))
            FactRow(label: "Gap", value: SourceTime.gap(observed: item.observedAt, snapshot: model.snapshot.asOf))
            FactRow(label: "Digest", value: item.digest, missing: "No digest; the content is not pinned", mono: true)
            if let owner = model.work(owning: item.id) {
                HStack {
                    Text("Attached to \(owner.name)").font(.callout).foregroundStyle(Palette.inkMuted)
                    Spacer()
                    Button("Open work") { model.selectWork(owner.id) }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cambiumPanel()
    }
}
