import SwiftUI
import CambiumCore

struct DirectionExecutionPreparationView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let direction: SharedDirection
    let openReview: (PreparedDirectionExecution) -> Void
    @State private var busy = false
    @State private var message: String?
    @State private var requestVersion: UInt64 = 0

    private var state: DirectionExecutionDraftState { model.directionExecutionDraft }
    private var matches: Bool { state.directionID == direction.id }
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Review direction").font(CambiumFont.heading)
                Spacer()
                Button("Done") { dismiss() }.keyboardShortcut(.cancelAction)
            }
            Text(matches ? state.preview?.summary.objective ?? direction.title : direction.title).font(.headline)
            if matches, let preview = state.preview, preview.directionRevision != direction.revision {
                Text("This retained attempt reviews revision \(preview.directionRevision). Finish checking it before starting a new review.").font(.callout)
            }
            if busy { ProgressView("Checking the saved direction…") }
            if let message { Text(message).foregroundStyle(Palette.hold) }
            if matches, let preview = state.preview {
                Text(preview.summary.artifact)
                Text("Up to 3 minutes · Hosted Hermes · Review required for the result")
                    .font(.callout).foregroundStyle(Palette.inkMuted)
                Text("The task runs the shared-signal tests and returns a diff. Merging and deployment require separate decisions.")
                    .font(.callout).foregroundStyle(Palette.inkMuted)
                if let prepared = state.prepared {
                    Button("Open complete review") { openReview(prepared) }.buttonStyle(.borderedProminent)
                } else {
                    Button(state.pending == nil ? "Prepare complete review" : "Retry original request") { Task { await prepare() } }
                        .buttonStyle(.borderedProminent).disabled(busy)
                }
            }
            if state.prepared != nil && state.pending == nil {
                Button("Start fresh review") {
                    guard model.resetDirectionExecutionReview() else {
                        message = "Check the original decision before starting a fresh review."; return
                    }
                    Task { await load() }
                }.disabled(busy || model.loading)
                Text("The previous proposal stays in the decision journal.").font(.caption).foregroundStyle(Palette.inkMuted)
            }
            if message != nil && (!matches || state.pending == nil) {
                Button("Refresh review") { Task { await load() } }.disabled(busy)
            }
        }
        .padding(24).frame(minWidth: 540, idealWidth: 620, minHeight: 300).background(Palette.canvas)
        .task { await load() }
        .onChange(of: model.signalScopeVersion) { _, _ in requestVersion &+= 1; dismiss() }
        .onChange(of: model.selectedWorkID) { _, value in if value != direction.workObjectId { requestVersion &+= 1; dismiss() } }
        .onDisappear { requestVersion &+= 1 }
    }
    private func load() async {
        guard !busy, !model.isDemo, model.session != nil, model.selectedWorkID == direction.workObjectId,
              let service = model.signalService else { return }
        if state.pending != nil || state.prepared != nil {
            if !matches { message = "Finish the existing review request before preparing another direction." }
            return
        }
        requestVersion &+= 1
        let request = requestVersion, scope = model.signalScopeVersion
        busy = true; message = nil
        defer { if request == requestVersion { busy = false } }
        do {
            let preview = try await service.directionExecutionPreview(direction)
            guard request == requestVersion, scope == model.signalScopeVersion, model.selectedWorkID == direction.workObjectId else { return }
            model.directionExecutionDraft = DirectionExecutionDraftState(directionID: direction.id, preview: preview)
        } catch {
            guard request == requestVersion, scope == model.signalScopeVersion else { return }
            message = "This direction isn’t ready for execution review. Refresh its sources or try again when the connection is ready."
        }
    }
    private func prepare() async {
        guard !busy, matches, let preview = state.preview, let service = model.signalService,
              model.session != nil, !model.isDemo, model.selectedWorkID == direction.workObjectId else { return }
        let value = state.pending ?? DirectionExecutionPrepare(operationId: UUID().uuidString, preview: preview)
        model.directionExecutionDraft.pending = value
        requestVersion &+= 1
        let request = requestVersion, scope = model.signalScopeVersion
        busy = true; message = nil
        defer { if request == requestVersion { busy = false } }
        do {
            let prepared = try await service.prepareDirectionExecution(direction.id, value: value)
            guard request == requestVersion, scope == model.signalScopeVersion, model.selectedWorkID == direction.workObjectId else { return }
            model.directionExecutionDraft.pending = nil
            model.directionExecutionDraft.prepared = prepared
            openReview(prepared)
        } catch {
            guard request == requestVersion, scope == model.signalScopeVersion else { return }
            if InboxDraft.isDefinitiveRejection(error) {
                model.directionExecutionDraft.pending = nil
                message = "The sources changed or this request was refused. Refresh the review before trying again."
            } else {
                message = "We couldn’t confirm this request. Retry to check the original attempt safely."
            }
        }
    }
}
