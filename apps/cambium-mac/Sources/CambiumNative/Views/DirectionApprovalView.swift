import SwiftUI
import enum CambiumCore.CanonicalTimestamp

struct DirectionApprovalView: View {
    @Environment(AppModel.self) private var model
    let review: ReviewDisplay
    @State private var confirming = false
    @State private var capturedDigest = ""
    @State private var capturedScope: UInt64 = 0
    @State private var capturedChoice: ReviewChoice = .approve
    @State private var confirmationText = ""
    @State private var busy = false
    @State private var message: String?

    private var decision: GateDisplay? { model.gate?.proposalId == review.proposalId ? model.gate : nil }
    private var approved: Bool { decision?.recorded == true && decision?.choice == "approved" }
    private var expired: Bool { CanonicalTimestamp.parse(review.expiresAt).map { $0 <= Date() } ?? true }
    var body: some View {
        PageScaffold(eyebrow: "Decision", title: "Review direction", subtitle: "Approve one exact task, then prepare its launch.") {
            if let direction = review.directionExecution {
                VStack(alignment: .leading, spacing: 12) {
                    Text(direction.title).font(CambiumFont.heading)
                    Text(direction.body).textSelection(.enabled)
                    Text("Cambium · Revision \(direction.revision) · \(direction.observations) \(direction.observations == 1 ? "observation" : "observations")")
                        .font(.caption).foregroundStyle(Palette.inkMuted)
                }.cambiumPanel(highlighted: true)
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(title: "Task and result")
                    Text("Apply the two-file title validation patch and run the shared-signal tests on hosted Hermes.")
                    Text("Up to 3 minutes · Free model pool · Result requires review")
                        .font(.callout).foregroundStyle(Palette.inkMuted)
                    Text("Target: \(direction.targetObjective)").font(.callout)
                    Text("Returns a code diff and test evidence. Merging, publishing and deployment require separate decisions.")
                        .font(.callout).foregroundStyle(Palette.inkMuted)
                    DisclosureGroup("Proposed code change") {
                        ScrollView([.horizontal, .vertical]) {
                            Text(direction.patchText).font(CambiumFont.monoSmall).textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }.frame(minHeight: 180, maxHeight: 320)
                    }
                }.cambiumPanel()
                if let message { Text(message).foregroundStyle(Palette.hold) }
                if let decision {
                    Text(decision.label).font(.headline).foregroundStyle(approved ? Palette.signal : Palette.inkMuted)
                }
                if decision?.needsStatusCheck == true {
                    Text("Check the original decision before doing anything else.").foregroundStyle(Palette.hold)
                    Button("Check decision") { model.recoverReview() }.disabled(model.loading)
                } else if approved {
                    Button("Prepare launch") { Task { await admit() } }
                        .buttonStyle(.borderedProminent).disabled(busy || model.loading)
                    Text("This checks the approved sources and creates a launch admission. It does not start the job.")
                        .font(.callout).foregroundStyle(Palette.inkMuted)
                } else if decision?.recorded == true {
                    Button("Review the saved direction again") {
                        guard model.resetDirectionExecutionReview() else { return }
                        model.open(.work)
                    }.disabled(model.loading)
                } else if !expired && decision?.recorded != true {
                    HStack {
                        Button("Approve direction") { confirm(.approve, direction: direction) }.buttonStyle(.borderedProminent)
                        Button("Reject") { confirm(.reject, direction: direction) }
                    }.disabled(model.loading || busy)
                } else if expired && decision?.recorded != true {
                    Text("This review expired. Prepare a fresh review of the saved direction.").foregroundStyle(Palette.hold)
                    Button("Return to saved directions") {
                        guard model.directionExecutionDraft.pending == nil else { return }
                        model.directionExecutionDraft = DirectionExecutionDraftState()
                        model.open(.work)
                    }
                }
            } else {
                Text("This direction review could not be verified. Reload it before deciding.").foregroundStyle(Palette.hold)
                Button("Reload review") { model.loadSelectedReview() }.disabled(model.loading)
            }
        }
        .confirmationDialog("Confirm your decision", isPresented: $confirming, titleVisibility: .visible) {
            Button(capturedChoice == .approve ? "Approve direction" : "Reject direction", role: capturedChoice == .reject ? .destructive : nil) {
                guard capturedScope == model.signalScopeVersion, capturedDigest == model.review?.changeDigest,
                      model.selectedWorkID == "sapling:cambium", model.review?.isDirectionExecution == true else {
                    message = "The review changed. Load it again before deciding."; return
                }
                model.reviewChoice = capturedChoice
                // The user confirmed the visible immutable review; the existing
                // coordinator still submits the exact owner-issued confirmation.
                model.reviewTyped = model.requiredPhrase
                model.confirmReview()
            }
            Button("Cancel", role: .cancel) { }
        } message: { Text(confirmationText) }
    }
    private func confirm(_ choice: ReviewChoice, direction: DirectionReviewDisplay) {
        capturedDigest = review.changeDigest; capturedScope = model.signalScopeVersion; capturedChoice = choice
        confirmationText = "\(choice == .approve ? "Approve" : "Reject") ‘\(direction.title)’ revision \(direction.revision). Approval binds the shown source, code change, checks and 3-minute budget. Admission and launch remain separate."
        confirming = true
    }
    private func admit() async {
        guard !busy, approved, !model.isDemo, let service = model.signalService,
              model.selectedWorkID == "sapling:cambium" else { return }
        let scope = model.signalScopeVersion, digest = review.changeDigest
        busy = true; message = nil; defer { busy = false }
        do {
            let result = try await service.admitDirectionExecution(review.proposalId)
            guard scope == model.signalScopeVersion, digest == model.review?.changeDigest,
                  model.selectedWorkID == "sapling:cambium" else { return }
            model.feedback = result.consumed ? "This task already has a launch. Check its original status." : "Launch admission is ready. Choose it to continue."
            if model.section == .proposal { model.open(.launch); model.listAdmissions() }
        } catch {
            guard scope == model.signalScopeVersion, digest == model.review?.changeDigest else { return }
            message = "Couldn’t prepare launch. Retry checks the original admission; changed sources need a fresh review."
        }
    }
}
