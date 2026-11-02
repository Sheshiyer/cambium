import SwiftUI

struct KnowledgeView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        PageScaffold(eyebrow: "Knowledge", title: "Source-specific knowledge",
                     subtitle: "Field Theory direction notes and Field Report spatial observations kept strictly separate in local storage.") {
            if model.knowledge.isEmpty {
                EmptyStateView(symbol: "books.vertical", title: "No knowledge notes",
                               message: "No owner is configured. Open the demo to see sample knowledge items.")
                    .cambiumPanel()
            } else {
                Picker("Knowledge source", selection: $model.selectedKnowledgeID) {
                    ForEach(model.knowledge) { item in
                        Text("\(item.source.rawValue): \(item.title)").tag(Optional(item.id))
                    }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: 400, alignment: .leading)

                if let item = model.selectedKnowledge {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            StatusChip(text: item.source.rawValue, tone: .signal)
                            Spacer(minLength: 8)
                            Text(model.time(item.observedAt)).font(.caption).foregroundStyle(Palette.inkMuted)
                        }
                        Text(item.title).font(CambiumFont.title).foregroundStyle(Palette.ink)
                        Text(item.detail).font(.body).foregroundStyle(Palette.ink)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(item.source.explanation)
                            .font(.callout)
                            .foregroundStyle(Palette.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                        FactRow(label: "Source reference", value: item.sourceRef, mono: true)
                    }
                    .cambiumPanel(highlighted: true)
                }
            }
        }
    }
}
