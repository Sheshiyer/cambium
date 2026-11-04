import SwiftUI
import CambiumCore

struct SavedDirectionsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let workID: String
    @State private var selected: SharedDirection?
    @State private var rows: [SharedDirection] = []
    @State private var busy = false
    @State private var loaded = false
    @State private var message: String?
    @State private var requestVersion: UInt64 = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Saved directions").font(CambiumFont.heading)
                Spacer()
                Button("Refresh") { Task { await load() } }.disabled(busy)
                Button("Done") { dismiss() }.keyboardShortcut(.cancelAction)
            }
            Text("Choose a saved direction for Cambium.")
                .font(.callout).foregroundStyle(Palette.inkMuted)
            if busy { ProgressView("Loading directions…") }
            if let message {
                Text(message).foregroundStyle(Palette.hold)
                Button("Try again") { Task { await load() } }.disabled(busy)
            } else if loaded && rows.isEmpty && !busy {
                Text("No saved directions yet. Draft one from a Cambium observation in Inbox.")
                    .foregroundStyle(Palette.inkMuted)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(rows) { row in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(row.title).font(.headline)
                                Spacer()
                                Text("Saved").font(.caption).foregroundStyle(Palette.inkMuted)
                            }
                            Text(row.body).textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text("Revision \(row.revision) · \(row.signalPins.count) \(row.signalPins.count == 1 ? "observation" : "observations") · Updated \(model.time(row.updatedAt))")
                                .font(.caption).foregroundStyle(Palette.inkMuted)
                            Button("Review direction") { selected = row }
                        }
                        .cambiumPanel()
                    }
                }
            }
        }
        .padding(24).frame(minWidth: 560, idealWidth: 680, minHeight: 420)
        .background(Palette.canvas)
        .sheet(item: $selected) { direction in
            DirectionExecutionPreparationView(direction: direction) { prepared in
                selected = nil
                dismiss()
                model.openPreparedDirection(prepared)
            }.environment(model)
        }
        .task { await load() }
        .onChange(of: model.signalScopeVersion) { _, _ in invalidate() }
        .onChange(of: model.selectedWorkID) { _, value in if value != workID { invalidate() } }
        .onDisappear { requestVersion &+= 1; rows = [] }
    }

    private func invalidate() {
        requestVersion &+= 1
        rows = []; loaded = false; message = nil; busy = false
        dismiss()
    }
    private func load() async {
        guard !busy else { return }
        guard !model.isDemo, model.session != nil, workID == "sapling:cambium",
              model.selectedWorkID == workID, let service = model.signalService else {
            rows = []; message = "Sign in to load Cambium’s saved directions."; return
        }
        requestVersion &+= 1
        let request = requestVersion, scope = model.signalScopeVersion
        busy = true; message = nil
        defer { if request == requestVersion { busy = false } }
        do {
            let result = try await service.directionList()
            guard request == requestVersion, scope == model.signalScopeVersion,
                  model.session != nil, !model.isDemo, model.selectedWorkID == workID else { return }
            rows = result.directions.filter { $0.workObjectId == workID }
            loaded = true
        } catch {
            guard request == requestVersion, scope == model.signalScopeVersion,
                  model.session != nil, !model.isDemo, model.selectedWorkID == workID else { return }
            rows = []; loaded = false
            message = "Couldn’t load saved directions. Check your connection and try again."
        }
    }
}
