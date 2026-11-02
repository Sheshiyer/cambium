import SwiftUI

struct KnowledgeView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        PageScaffold(eyebrow: "Knowledge", title: "Source-specific knowledge",
                     subtitle: "Field Theory and Field Report records come from separate Core readers and stay under their own labels.") {
            if model.isDemo { SyntheticNotice(message: "These records come from labelled demo exports. No vault or corpus was read.") }
            if let problem = model.knowledgeIssue {
                Label(problem, systemImage: "exclamationmark.triangle")
                    .font(.callout).foregroundStyle(Palette.hold)
                    .fixedSize(horizontal: false, vertical: true)
                    .cambiumPanel(padding: 12)
            }
            if model.knowledge.isEmpty {
                EmptyStateView(symbol: "books.vertical", title: "No knowledge records",
                               message: model.session == nil ? "Sign in with a configured owner, or open the demo." : "The readers returned no records.")
                    .cambiumPanel()
            } else {
                ForEach(KnowledgeSource.allCases) { source in
                    let rows = model.knowledge.filter { $0.source == source }
                    VStack(alignment: .leading, spacing: 8) {
                        SectionHeader(title: source.rawValue, detail: "\(rows.count)")
                        Text(source.explanation).font(.callout).foregroundStyle(Palette.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                        if rows.isEmpty {
                            Text("No \(source.rawValue) records.").font(.callout).foregroundStyle(Palette.hold)
                        }
                        ForEach(rows) { item in
                            Button { model.selectedKnowledgeID = item.id } label: {
                                HStack {
                                    Text(item.title).foregroundStyle(Palette.ink)
                                    Spacer()
                                    Text(item.meaning).font(.caption).foregroundStyle(Palette.inkMuted)
                                }
                                .contentShape(Rectangle())
                                .cambiumPanel(padding: 10, highlighted: model.selectedKnowledgeID == item.id)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(source.rawValue): \(item.title)")
                            .accessibilityAddTraits(model.selectedKnowledgeID == item.id ? .isSelected : [])
                        }
                    }
                }
                if let item = model.selectedKnowledge {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            StatusChip(text: item.source.rawValue, tone: .signal)
                            StatusChip(text: item.meaning, tone: .muted)
                            Spacer(minLength: 8)
                            Text(model.time(item.observedAt)).font(.caption).foregroundStyle(Palette.inkMuted)
                        }
                        Text(item.title).font(CambiumFont.title).foregroundStyle(Palette.ink)
                        FactRow(label: "Subject", value: item.subjectId, mono: true)
                        FactRow(label: "Freshness", value: item.freshness)
                        FactRow(label: "Source reference", value: item.sourceRef, mono: true)
                        FactRow(label: "Gaps", value: item.gaps.isEmpty ? nil : item.gaps.joined(separator: ", "), missing: "None listed")
                        Text(item.meaning == "proposal" ? "A proposal suggests a direction. It does not create work or an admission."
                                                         : "An observation records what was seen. It does not create work or an admission.")
                            .font(.callout).foregroundStyle(Palette.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .cambiumPanel(highlighted: true)
                }
            }
        }
    }
}
