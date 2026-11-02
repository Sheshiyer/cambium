import SwiftUI

struct ProposalView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        PageScaffold(eyebrow: "Proposal review", title: "Founder proposal review",
                     subtitle: "Review the proposed change and type the exact confirmation phrase. Decisions are local and synthetic; nothing is transmitted.") {
            if let proposal = model.proposal {
                if model.isDemo { SyntheticNotice(message: "This proposal is a demo fixture. Confirming or rejecting it changes local state only.") }

                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        StatusChip(text: "Version \(proposal.version)", tone: .signal)
                        StatusChip(text: "Expires \(proposal.expiresAt.prefix(10))", tone: .muted)
                        Spacer()
                    }
                    Text(proposal.summary).font(.body).foregroundStyle(Palette.ink)
                    FactRow(label: "Proposal ID", value: proposal.id, mono: true)
                    FactRow(label: "Change digest", value: proposal.digest, mono: true)
                }
                .cambiumPanel(highlighted: true)

                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(title: "Changes")
                    ForEach(proposal.changes) { change in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(change.field).font(CambiumFont.label).foregroundStyle(Palette.rail)
                            HStack(alignment: .top, spacing: 10) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Before").font(.caption2).foregroundStyle(Palette.inkMuted)
                                    Text(change.before).font(CambiumFont.monoSmall).foregroundStyle(Palette.ink)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                Image(systemName: "arrow.right").foregroundStyle(Palette.rail).padding(.top, 10)
                                    .accessibilityHidden(true)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("After").font(.caption2).foregroundStyle(Palette.inkMuted)
                                    Text(change.after).font(CambiumFont.monoSmall).foregroundStyle(Palette.ink)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Palette.canvas))
                    }
                }
                .cambiumPanel()

                VStack(alignment: .leading, spacing: 12) {
                    SectionHeader(title: "Decision")
                    Picker("Decision choice", selection: $model.review.choice) {
                        ForEach(ReviewChoice.allCases) { choice in
                            Text(choice.title).tag(choice)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 240)

                    Text("To confirm this review, type the exact phrase below:")
                        .font(.callout)
                        .foregroundStyle(Palette.ink)

                    Text(model.requiredPhrase)
                        .font(CambiumFont.mono)
                        .foregroundStyle(Palette.signal)
                        .padding(8)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Palette.surface))
                        .textSelection(.enabled)

                    TextField("Type the exact phrase to confirm...", text: $model.review.typed)
                        .textFieldStyle(.roundedBorder)
                        .font(CambiumFont.mono)

                    HStack(spacing: 12) {
                        Button("Confirm \(model.review.choice.rawValue)") {
                            model.confirmReview()
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(!model.typedMatches || model.review.outcome != .pending)

                        Button("Hold") {
                            model.holdReview()
                        }
                        .disabled(model.review.outcome != .pending)

                        if model.review.outcome != .pending {
                            Button("Reset decision", action: model.resetReview)
                        }
                        Spacer()
                    }

                    if model.review.outcome != .pending {
                        HStack {
                            Image(systemName: model.review.outcome == .approved ? "checkmark.circle.fill" : model.review.outcome == .rejected ? "xmark.circle.fill" : "pause.circle")
                                .foregroundStyle(model.review.outcome == .approved ? Palette.evidence : Palette.hold)
                            Text("Recorded outcome: \(model.review.outcome.rawValue.capitalized) at \(model.time(model.review.decidedAt ?? Date())). No backend was invoked.")
                                .font(.callout)
                                .foregroundStyle(Palette.ink)
                        }
                        .padding(.top, 4)
                    }
                }
                .cambiumPanel()
            } else {
                EmptyStateView(symbol: "signature", title: "No proposal to review",
                               message: "Open the demo to see a sample founder proposal.")
                    .cambiumPanel()
            }
        }
    }
}
