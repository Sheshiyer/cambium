import SwiftUI
import CambiumCore

struct DirectionDraftView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var busy = false
    @State private var message: String?
    @State private var editing = false

    var body: some View {
        @Bindable var model = model
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Draft direction").font(CambiumFont.heading)
                Spacer()
                Button("Done") { dismiss() }.keyboardShortcut(.cancelAction).disabled(busy)
            }
            if let saved = model.directionDraft.saved, !editing, model.directionDraft.pendingUpdate == nil {
                Label("Direction saved", systemImage: "checkmark.circle").foregroundStyle(Palette.signal)
                Text(saved.title).font(.headline)
                Text("Revision \(saved.revision)").font(.caption)
                Button("Edit and refresh source pins") { Task { await beginEdit(saved) } }
                if saved.workObjectId == "sapling:iverif" {
                    Button("Review claim-evidence task") { dismiss(); model.reviewSavedDirection() }.disabled(model.loading)
                }
                Text("Ready for review. Work has not been approved or launched.").font(.callout).foregroundStyle(Palette.inkMuted)
            } else {
                Text("Turn this observation into a clear next step for the selected project.").font(.callout).foregroundStyle(Palette.inkMuted)
                TextField("Direction title", text: $model.directionDraft.title).textFieldStyle(.roundedBorder).disabled(pending)
                TextEditor(text: $model.directionDraft.body).frame(minHeight: 160).accessibilityLabel("Direction details").disabled(pending)
                if editing { Text("Saving advances the revision and requires a new task review. Existing admission will be revoked.").font(.callout).foregroundStyle(Palette.hold) }
                HStack {
                    if model.directionDraft.work == nil { Button("Check connection") { Task { await load() } }.disabled(busy) }
                    Spacer()
                    Button(pending ? "Retry save" : "Save direction") { Task { await save() } }
                        .buttonStyle(.borderedProminent)
                        .disabled(busy || model.directionDraft.work == nil || model.directionDraft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            if let message { Text(message).font(.callout).foregroundStyle(Palette.hold) }
        }
        .padding(24).frame(minWidth: 520, idealWidth: 620, minHeight: 360)
        .background(Palette.canvas)
        .disabled(busy)
        .task { await load() }
        .onChange(of: model.signalScopeVersion) { _, _ in dismiss() }
    }
    private var pending: Bool { model.directionDraft.pending != nil || model.directionDraft.pendingUpdate != nil }
    private func beginEdit(_ saved: SharedDirection) async {
        guard let service = model.signalService, let signal = model.directionDraft.signal else { return }
        let scope = model.signalScopeVersion
        busy = true; defer { busy = false }
        do {
            let current = try await service.signalRead(signal.id)
            let context = try await service.directionList(workObjectId: saved.workObjectId)
            guard scope == model.signalScopeVersion, current.signal.projectIds.contains(saved.workObjectId), let work = context.workContext else { throw SignalError.scope }
            model.directionDraft.signal = current.signal; model.directionDraft.work = work
            model.directionDraft.title = saved.title; model.directionDraft.body = saved.body
            editing = true; message = nil
        } catch { message = "Couldn’t refresh the source pins. Check your sign-in and the project’s Work connection." }
    }
    private func load() async {
        guard let service = model.signalService, model.directionDraft.pending == nil, model.directionDraft.saved == nil else { return }
        let scope = model.signalScopeVersion
        busy = true; defer { busy = false }
        do {
            let result = try await service.directionList(workObjectId: model.directionDraft.workObjectId)
            guard scope == model.signalScopeVersion else { return }
            model.directionDraft.work = result.workContext
            if let signal = model.directionDraft.signal, let existing = result.directions.first(where: { $0.signalPins.contains(where: { $0.id == signal.id }) }) { model.directionDraft.saved = existing }
            message = result.workContext == nil ? "This project’s Work connection is awaiting approval." : nil
        } catch {
            guard scope == model.signalScopeVersion else { return }
            message = "Couldn’t load the Work connection. Check your sign-in and try again."
        }
    }
    private func save() async {
        guard let service = model.signalService, let signal = model.directionDraft.signal, let work = model.directionDraft.work else { return }
        let scope = model.signalScopeVersion
        let draft = DirectionDraft(title: model.directionDraft.title, body: model.directionDraft.body, work: work,
                                   signalPins: [DirectionSignalPin(id: signal.id, revision: signal.revision)])
        if let saved = model.directionDraft.saved {
            model.directionDraft.pendingUpdate = model.directionDraft.pendingUpdate ?? DirectionUpdate(operationId: UUID().uuidString, expectedRevision: saved.revision, draft: draft)
        } else { model.directionDraft.pending = model.directionDraft.pending ?? DirectionCreate(operationId: UUID().uuidString, draft: draft) }
        busy = true; defer { busy = false }
        do {
            let result: DirectionResult
            if let update = model.directionDraft.pendingUpdate, let saved = model.directionDraft.saved { result = try await service.directionUpdate(saved.id, value: update) }
            else if let create = model.directionDraft.pending { result = try await service.directionCreate(create) }
            else { return }
            guard scope == model.signalScopeVersion else { return }
            model.directionDraft.pending = nil; model.directionDraft.pendingUpdate = nil
            model.directionDraft.saved = result.direction; model.directionDraft.reviewOperationId = UUID().uuidString
            editing = false; message = nil
        } catch {
            guard scope == model.signalScopeVersion else { return }
            if InboxDraft.isDefinitiveRejection(error) || (error as? SignalError) == .status(404) {
                model.directionDraft.pending = nil
                model.directionDraft.pendingUpdate = nil
                message = "The direction could not be saved. Check its length and refresh the observation before trying again."
            } else { message = "We couldn’t confirm this save. Retry to check the original attempt safely." }
        }
    }
}
