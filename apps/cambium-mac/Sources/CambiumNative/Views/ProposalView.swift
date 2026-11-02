import SwiftUI

struct ProposalView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        PageScaffold(eyebrow: "Proposal review", title: "Founder proposal review",
                     subtitle: "Review the signed change set, inspect consequence and reversibility, and type the exact source confirmation. Submissions go through the FounderGateCoordinator.") {
            if model.isDemo {
                SyntheticNotice(message: "The founder proposal fixture is dated 2026-07-28. It has no WorkObject join and is shown as a separate labelled demo example. Approving it does not admit any work.")
            }
            if let julyId = model.julyProposalExampleId, model.proposalBinding == nil && model.proposalRefDraft.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("July Proposal Example (Unjoined Demo)").font(CambiumFont.label).foregroundStyle(Palette.rail)
                    Text("This demo proposal fixture is available for manual review: \(julyId)")
                        .font(.callout).foregroundStyle(Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Button("Open July example proposal") {
                        model.proposalRefDraft = julyId
                        model.loadSelectedReview()
                    }
                    .buttonStyle(.bordered)
                }
                .cambiumPanel()
            }
            BindingPanel()

            if let review = model.review {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        StatusChip(text: "Version \(review.version)", tone: .signal)
                        StatusChip(text: "Expires \(review.expiresAt.prefix(10))", tone: .muted)
                        StatusChip(text: "Principal: \(review.principal)", tone: .evidence)
                        Spacer()
                    }
                    Text(review.summary).font(.body).foregroundStyle(Palette.ink)
                    FactRow(label: "Proposal ID", value: review.proposalId, mono: true)
                    FactRow(label: "Change digest", value: review.changeDigest, mono: true)
                    FactRow(label: "Consequence", value: review.consequence)
                    FactRow(label: "Reversibility", value: review.reversibility)
                    if let graph = review.graphVersion { FactRow(label: "Graph version", value: String(graph)) }
                    if let ref = review.sourceRef { FactRow(label: "Source reference", value: ref, mono: true) }
                }
                .cambiumPanel(highlighted: true)

                if !review.changes.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionHeader(title: "Changes (\(review.changes.count))")
                        ForEach(review.changes) { change in
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
                }

                VStack(alignment: .leading, spacing: 12) {
                    SectionHeader(title: "Decision & Confirmation")
                    Picker("Decision choice", selection: $model.reviewChoice) {
                        ForEach(ReviewChoice.allCases) { choice in
                            Text(choice.title).tag(choice)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 240)

                    Text("Type the exact source confirmation phrase below to submit:")
                        .font(.callout)
                        .foregroundStyle(Palette.ink)

                    Text(model.requiredPhrase)
                        .font(CambiumFont.mono)
                        .foregroundStyle(Palette.signal)
                        .padding(8)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Palette.surface))
                        .textSelection(.enabled)

                    TextField("Type exact confirmation...", text: $model.reviewTyped)
                        .textFieldStyle(.roundedBorder)
                        .font(CambiumFont.mono)

                    HStack(spacing: 12) {
                        Button("Confirm \(model.reviewChoice.rawValue)") {
                            model.confirmReview()
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(!model.typedMatches || model.loading || model.gate?.needsStatusCheck == true)

                        if model.isDemo {
                            Button(model.faultArmed ? "Response loss armed" : "Simulate response loss") {
                                model.armFault()
                            }
                            .disabled(model.faultArmed)
                        }

                        if model.gate?.needsStatusCheck == true {
                            Button("Check status (recovery)", action: model.recoverReview)
                                .buttonStyle(.borderedProminent)
                        }

                        Spacer()
                    }

                    if let gate = model.gate {
                        HStack {
                            Image(systemName: gate.recorded ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                                .foregroundStyle(gate.recorded ? Palette.evidence : Palette.hold)
                            Text("Outcome: \(gate.label). Updated: \(model.time(gate.updatedAt)).")
                                .font(.callout).foregroundStyle(Palette.ink)
                        }
                        .padding(.top, 4)
                    }
                }
                .cambiumPanel()

            } else {
                EmptyStateView(symbol: "signature", title: "No proposal loaded",
                               message: "Bind the selected work to a canonical proposal reference, then load the review. A missing binding is not an admission.")
                    .cambiumPanel()
            }
            if !model.pendingGate.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(title: "Pending recoveries on opening (\(model.pendingGate.count))")
                    ForEach(model.pendingGate) { record in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Proposal: \(record.proposalId)").font(CambiumFont.monoSmall)
                                Text("State: \(record.state) · Updated \(model.time(record.updatedAt))").font(.caption).foregroundStyle(Palette.inkMuted)
                            }
                            Spacer()
                            Button("Check status") { model.recoverReview(nonce: record.nonce) }
                                .controlSize(.small)
                        }
                        .cambiumPanel(padding: 10)
                    }
                }
                .cambiumPanel()
            }
            if model.review == nil, let gate = model.gate {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(title: "Decision status")
                    Text("Proposal: \(gate.proposalId)").font(CambiumFont.monoSmall)
                    Text("Outcome: \(gate.label). Updated: \(model.time(gate.updatedAt)).")
                        .font(.callout).foregroundStyle(Palette.ink)
                }
                .cambiumPanel()
            }
        }
    }
}

private struct BindingPanel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Selected work")
            if let work = model.selectedWork {
                FactRow(label: "Work", value: "\(work.name) · \(work.id)", mono: true)
            } else {
                Text("Select a work item from the system view before reviewing a proposal.")
                    .font(.callout).foregroundStyle(Palette.inkMuted)
            }
            if let binding = model.proposalBinding {
                FactRow(label: "Proposal reference", value: binding.proposalId, mono: true)
                FactRow(label: "Source", value: binding.source == .ownerProjection
                        ? "Named by the loaded projection for this work"
                        : "Typed canonical reference for this session")
            } else {
                Text("This work has no proposal join. Type the canonical reference. The app will not invent one.")
                    .font(.callout).foregroundStyle(Palette.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                TextField("tenant:sha256:…", text: $model.proposalRefDraft)
                    .textFieldStyle(.roundedBorder)
                    .font(CambiumFont.mono)
                    .accessibilityLabel("Canonical proposal reference")
                Button("Bind typed reference") { model.bindTypedProposal() }
                    .disabled(model.selectedWork == nil)
            }
            Button("Load review") { model.loadSelectedReview() }
                .disabled(model.proposalBinding == nil && model.proposalRefDraft.isEmpty || model.loading)
        }
        .cambiumPanel()
    }
}
