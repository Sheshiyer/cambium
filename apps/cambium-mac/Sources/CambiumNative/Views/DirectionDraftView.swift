import SwiftUI
import CambiumCore

struct DirectionDraftView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var busy = false
    @State private var message: String?

    var body: some View {
        @Bindable var model = model
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Draft direction").font(CambiumFont.heading)
                Spacer()
                Button("Done") { dismiss() }.keyboardShortcut(.cancelAction).disabled(busy)
            }
            if let saved = model.directionDraft.saved {
                Label("Direction saved", systemImage: "checkmark.circle").foregroundStyle(Palette.signal)
                Text(saved.title).font(.headline)
                Text("Ready for review. Work has not been approved or launched.").font(.callout).foregroundStyle(Palette.inkMuted)
            } else {
                Text("Turn this observation into a clear next step for Cambium.").font(.callout).foregroundStyle(Palette.inkMuted)
                TextField("Direction title", text: $model.directionDraft.title).textFieldStyle(.roundedBorder).disabled(model.directionDraft.pending != nil)
                TextEditor(text: $model.directionDraft.body).frame(minHeight: 160).accessibilityLabel("Direction details").disabled(model.directionDraft.pending != nil)
                if let message { Text(message).font(.callout).foregroundStyle(Palette.hold) }
                HStack {
                    if model.directionDraft.work == nil { Button("Check connection") { Task { await load() } }.disabled(busy) }
                    Spacer()
                    Button(model.directionDraft.pending == nil ? "Save direction" : "Retry save") { Task { await save() } }
                        .buttonStyle(.borderedProminent)
                        .disabled(busy || model.directionDraft.work == nil || model.directionDraft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .padding(24).frame(minWidth: 520, idealWidth: 620, minHeight: 360)
        .background(Palette.canvas)
        .disabled(busy)
        .task { await load() }
        .onChange(of: model.signalScopeVersion) { _, _ in dismiss() }
    }
    private func load() async {
        guard let service = model.signalService, model.directionDraft.pending == nil, model.directionDraft.saved == nil else { return }
        let scope = model.signalScopeVersion
        busy = true; defer { busy = false }
        do {
            let result = try await service.directionList()
            guard scope == model.signalScopeVersion else { return }
            model.directionDraft.work = result.workContext
            message = result.workContext == nil ? "Cambium’s operational Work connection is awaiting approval." : nil
        } catch {
            guard scope == model.signalScopeVersion else { return }
            message = "Couldn’t load the Work connection. Check your sign-in and try again."
        }
    }
    private func save() async {
        guard let service = model.signalService, let signal = model.directionDraft.signal, let work = model.directionDraft.work else { return }
        let scope = model.signalScopeVersion
        let value = model.directionDraft.pending ?? DirectionCreate(operationId: UUID().uuidString,
            draft: DirectionDraft(title: model.directionDraft.title, body: model.directionDraft.body, work: work,
                                  signalPins: [DirectionSignalPin(id: signal.id, revision: signal.revision)]))
        model.directionDraft.pending = value
        busy = true; defer { busy = false }
        do {
            let result = try await service.directionCreate(value)
            guard scope == model.signalScopeVersion else { return }
            model.directionDraft.pending = nil; model.directionDraft.saved = result.direction; message = nil
        } catch {
            guard scope == model.signalScopeVersion else { return }
            if InboxDraft.isDefinitiveRejection(error) || (error as? SignalError) == .status(404) {
                model.directionDraft.pending = nil
                message = "The direction could not be saved. Check its length and refresh the observation before trying again."
            } else { message = "We couldn’t confirm this save. Retry to check the original attempt safely." }
        }
    }
}
