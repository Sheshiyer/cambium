import SwiftUI
import CambiumCore

struct InboxView: View {
    @Environment(AppModel.self) private var model
    @State private var rows: [Signal] = []
    @State private var selected: Signal?
    @State private var title = ""
    @State private var bodyText = ""
    @State private var projects: Set<String> = []
    @State private var sourceID = UUID().uuidString
    @State private var pendingCapture: SignalCapture?
    @State private var pendingUpdate: SignalUpdate?
    @State private var message = ""
    @State private var busy = false
    @State private var requestGeneration = 0
    @State private var nextCursor: String?
    @State private var scopeVersion: UInt64 = 0
    @State private var hasStarted = false
    @State private var conflict = false
    @State private var confirmReload = false
    private var retryLocked: Bool { InboxDraft.isLocked(capture: pendingCapture, update: pendingUpdate) }

    var body: some View {
        PageScaffold(eyebrow: "Shared signals", title: "Inbox", subtitle: "Capture an observation and associate it with mapped projects.") {
            if model.isDemo { SyntheticNotice(message: "Synthetic in-process owner. These observations are demo data.") }
            HStack {
                Text(model.inboxFilter.map { "Filtered: \($0)" } ?? "All signals")
                if model.inboxFilter != nil { Button("Show all") { model.openInbox(project: nil) } }
                Spacer()
                Button("Refresh") { Task { await load() } }.disabled(busy)
                Button("New observation") { clear() }.disabled(busy || retryLocked)
            }
            if busy { ProgressView("Loading or saving…") }
            if !message.isEmpty { Text(message).foregroundStyle(Palette.inkMuted) }
            HStack(alignment: .top, spacing: 18) {
                VStack(alignment: .leading) {
                    if rows.isEmpty && !busy { Text("No signals in this Inbox.") }
                    ForEach(rows) { row in
                        Button(row.title) { select(row) }.disabled(busy || retryLocked).frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if nextCursor != nil { Button("Load more") { Task { await loadMore() } }.disabled(busy) }
                }.frame(width: 240).cambiumPanel()
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(selected == nil ? "New observation" : "Signal detail").font(CambiumFont.heading)
                        Spacer()
                        Button(retryLocked ? "Retry original save" : "Save") { Task { await save() } }
                            .disabled(busy || conflict || model.session == nil || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    if conflict {
                        Text("This save conflicts with the owner. Your draft is retained. Reload the saved revision before editing it again.")
                        Button("Reload latest saved revision…") { confirmReload = true }.disabled(busy)
                    }
                    TextField("Title", text: $title).textFieldStyle(.roundedBorder).disabled(busy || retryLocked).onChange(of: title) { _, _ in edited() }
                    TextEditor(text: $bodyText).frame(minHeight: 120).disabled(busy || retryLocked)
                        .accessibilityLabel("Signal details").onChange(of: bodyText) { _, _ in edited() }
                    Text("Mapped projects (optional) · \(projects.count) linked").font(.headline)
                    if let portfolio = model.fabric?.portfolio, portfolio.detailAvailable {
                        ScrollView {
                            VStack(alignment: .leading) {
                                ForEach(portfolio.projects) { project in
                                    Toggle(project.name, isOn: Binding(get: { projects.contains(project.canonicalId) }, set: { on in
                                        if on { projects.insert(project.canonicalId) } else { projects.remove(project.canonicalId) }
                                        edited()
                                    })).disabled(busy || retryLocked)
                                }
                            }
                        }.frame(maxHeight: 160)
                    } else { Text("Load the scoped project catalog to select associations.") }
                    if let selected {
                        Text("Source: \(selected.source.system) · \(selected.source.recordId) · v\(selected.source.version)")
                        Text("Observed: \(selected.source.observedAt) · Revision \(selected.revision)")
                        if let reference = selected.source.reference { Text(reference).textSelection(.enabled) }
                    }
                    Text(retryLocked ? "Save outcome is uncertain. Editing and selection are locked; retry sends the original operation." : "Edits are kept in this window until saved.")
                        .font(.caption).foregroundStyle(Palette.inkMuted)
                }.frame(maxWidth: .infinity, alignment: .leading).cambiumPanel()
            }
        }
        .onAppear {
            scopeVersion = model.signalScopeVersion
            let draft = model.inboxDraft
            selected = draft.selected; title = draft.title; bodyText = draft.body; projects = draft.projects
            sourceID = draft.sourceID; pendingCapture = draft.capture; pendingUpdate = draft.update
            hasStarted = draft.hasStarted
            conflict = draft.conflict
        }
        .task(id: model.inboxVersion) { await load() }
        .onChange(of: model.signalScopeVersion) { _, _ in
            requestGeneration += 1; rows = []; clear(); hasStarted = false; busy = false; scopeVersion = model.signalScopeVersion
        }
        .onDisappear {
            requestGeneration += 1
            if scopeVersion == model.signalScopeVersion {
                model.inboxDraft = InboxDraft(selected: selected, title: title, body: bodyText, projects: projects,
                                              sourceID: sourceID, capture: pendingCapture, update: pendingUpdate, hasStarted: hasStarted, conflict: conflict)
            }
        }
        .confirmationDialog("Replace your draft with the latest saved revision?", isPresented: $confirmReload, titleVisibility: .visible) {
            Button("Discard draft and reload", role: .destructive) { Task { await reloadLatest() } }
            Button("Keep draft", role: .cancel) {}
        } message: {
            Text("Your unsaved fields are replaced only if the owner's latest revision loads successfully.")
        }
    }
    private func edited() {
        guard !retryLocked else { return }
        hasStarted = true
        if let selected, selected.title == title, selected.body == bodyText, Set(selected.projectIds) == projects {
            message = "Saved revision \(selected.revision)."
        } else {
            message = "Unsaved changes."
        }
    }
    private func clear() { selected = nil; title = ""; bodyText = ""; projects = Set(model.inboxFilter.map { [$0] } ?? []); sourceID = UUID().uuidString; pendingCapture = nil; pendingUpdate = nil; hasStarted = true; conflict = false; message = "New unsaved observation." }
    private func select(_ row: Signal) { selected = row; title = row.title; bodyText = row.body; projects = Set(row.projectIds); pendingCapture = nil; pendingUpdate = nil; hasStarted = true; conflict = false; message = "Saved revision \(row.revision)." }
    @MainActor private func reloadLatest() async {
        guard let selected, let service = model.signalService else { return }
        requestGeneration += 1; let generation = requestGeneration; busy = true
        do {
            let result = try await service.signalRead(selected.id)
            guard generation == requestGeneration, scopeVersion == model.signalScopeVersion else { return }
            select(result.signal)
        } catch {
            guard generation == requestGeneration, scopeVersion == model.signalScopeVersion else { return }
            message = "Unable to load the saved revision. Your draft is retained."
        }
        busy = false
    }
    @MainActor private func load() async {
        requestGeneration += 1; let generation = requestGeneration; busy = true
        do {
            guard let service = model.signalService else { throw SignalError.authorization }
            let value = try await service.signalList(project: model.inboxFilter)
            guard generation == requestGeneration, scopeVersion == model.signalScopeVersion else { return }
            rows = value.signals; nextCursor = value.nextCursor
            if !hasStarted, !retryLocked, let first = rows.first { select(first) }
        } catch {
            guard generation == requestGeneration, scopeVersion == model.signalScopeVersion else { return }
            rows = []
            message = model.session == nil ? "Sign in through Connections to read and save shared signals." : "Unable to load signals. Check the owner connection and try Refresh."
        }
        busy = false
    }
    @MainActor private func loadMore() async {
        guard let cursor = nextCursor else { return }
        requestGeneration += 1; let generation = requestGeneration; busy = true
        do {
            guard let service = model.signalService else { throw SignalError.authorization }
            let value = try await service.signalList(project: model.inboxFilter, cursor: cursor)
            guard generation == requestGeneration, scopeVersion == model.signalScopeVersion else { return }
            let seen = Set(rows.map(\.id)); rows.append(contentsOf: value.signals.filter { !seen.contains($0.id) })
            nextCursor = value.nextCursor; message = ""
        } catch { guard generation == requestGeneration, scopeVersion == model.signalScopeVersion else { return }; message = "Unable to load more signals. Check the owner connection and try again." }
        busy = false
    }
    @MainActor private func save() async {
        requestGeneration += 1; let generation = requestGeneration; busy = true
        do {
            guard let service = model.signalService else { throw SignalError.authorization }
            let result: SignalResult
            if let selected {
                let value = pendingUpdate ?? SignalUpdate(operationId: UUID().uuidString, expectedRevision: selected.revision, title: title, body: bodyText, projectIds: projects.sorted())
                pendingUpdate = value
                result = try await service.signalUpdate(selected.id, value: value)
            } else {
                let date = model.replayClock ?? CanonicalTimestamp.string(from: Date())
                let value = pendingCapture ?? SignalCapture(operationId: UUID().uuidString, title: title, body: bodyText,
                    source: SignalSource(system: "cambium-native", recordId: sourceID, version: "1", reference: nil, observedAt: date), projectIds: projects.sorted())
                pendingCapture = value
                result = try await service.signalCapture(value)
            }
            guard generation == requestGeneration, scopeVersion == model.signalScopeVersion else { return }
            select(result.signal); message = result.replayed ? "Saved; original operation replayed." : "Saved."
            busy = false; await load()
        } catch {
            guard generation == requestGeneration, scopeVersion == model.signalScopeVersion else { return }
            if InboxDraft.isDefinitiveRejection(error) {
                pendingCapture = nil; pendingUpdate = nil
                conflict = (error as? SignalError) == .status(409) && selected != nil
                message = conflict ? "Not saved. Review the conflict and reload the saved revision." : "Not saved. Correct the fields and save again."
            } else {
                message = "The save outcome is uncertain. Retry the original save."
            }
            busy = false
        }
    }
}
