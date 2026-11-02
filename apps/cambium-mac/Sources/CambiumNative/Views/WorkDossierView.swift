import SwiftUI
import struct CambiumCore.WorkObject
import struct CambiumCore.MappedProject

struct WorkDossierView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        PageScaffold(eyebrow: "Work", title: model.selectedWork?.name ?? "Work dossier",
                     subtitle: "Objective, state, next step, dependencies and evidence for one work item.") {
            if model.snapshot.work.isEmpty {
                EmptyStateView(symbol: "doc.text", title: "No work to show",
                               message: "No owner is configured, so no work has been read. Open the demo to see labelled synthetic records.")
                    .cambiumPanel()
            } else {
                Picker("Work item", selection: $model.selectedWorkID) {
                    ForEach(model.snapshot.work) { work in
                        Text(work.name).tag(Optional(work.id))
                    }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: 360, alignment: .leading)

                if let work = model.selectedWork {
                    Dossier(work: work)
                }
            }
        }
    }
}

private struct Dossier: View {
    @Environment(AppModel.self) private var model
    let work: WorkObject

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            OrganImage(organ: work.kind == "program" ? .will : .genesis, size: 64)
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    StatusChip(text: "Observed", tone: .muted)
                    StatusChip(text: work.attention, tone: Tone.forStatus(work.attention))
                    if model.isDemo { SyntheticBadge(compact: true) }
                }
                Text(work.summary)
                    .font(.body)
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(bindingCopy)
                    .font(.callout)
                    .foregroundStyle(Palette.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Observed work is not admitted. An approved proposal does not create an admission.")
                    .font(.callout)
                    .foregroundStyle(Palette.hold)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .cambiumPanel(highlighted: true)

        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Details")
            FactRow(label: "Identifier", value: work.id, mono: true)
            FactRow(label: "Kind", value: work.kind)
            FactRow(label: "Objective", value: work.objective)
            FactRow(label: "Current state", value: work.currentState)
            FactRow(label: "Next step", value: work.nextStep)
            FactRow(label: "Snapshot time", value: model.time(model.snapshot.asOf))
            if let project = joinedProject {
                FactRow(label: "Source classification", value: "\(project.classification) · \(project.canonicalId) (explicit served join)")
                Button("Open mapped project") { model.selectProject(project.id) }
                    .accessibilityHint("Opens the display catalog record joined to this work")
            }
        }
        .cambiumPanel()

        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Depends on", detail: "\(work.dependencies.count)")
            if work.dependencies.isEmpty {
                Text("No dependencies listed.").font(.callout).foregroundStyle(Palette.inkMuted)
            }
            ForEach(work.dependencies, id: \.self) { dependency in
                let target = model.snapshot.work.first { $0.id == dependency }
                HStack {
                    Image(systemName: "arrow.turn.down.right").foregroundStyle(Palette.rail).accessibilityHidden(true)
                    Text(target?.name ?? dependency).foregroundStyle(Palette.ink)
                    Text(dependency).font(CambiumFont.monoSmall).foregroundStyle(Palette.inkMuted)
                    Spacer(minLength: 8)
                    if let target {
                        Button("Open") { model.selectWork(target.id) }
                            .accessibilityLabel("Open \(target.name)")
                    } else {
                        Text("Not in this snapshot").font(.caption).foregroundStyle(Palette.hold)
                    }
                }
            }
        }
        .cambiumPanel()

        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Evidence", detail: "\(work.evidence.count)")
            if work.evidence.isEmpty {
                Text("No evidence is attached. Nothing here shows that this work succeeded.")
                    .font(.callout)
                    .foregroundStyle(Palette.hold)
            }
            ForEach(work.evidence) { item in
                Button { model.selectEvidence(item.id) } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "doc.badge.clock").foregroundStyle(Palette.evidence).accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title).foregroundStyle(Palette.ink)
                            Text("\(item.kind) · \(model.time(item.observedAt))")
                                .font(.caption).foregroundStyle(Palette.inkMuted)
                        }
                        Spacer(minLength: 8)
                        Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(Palette.rail)
                            .accessibilityHidden(true)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Evidence: \(item.title)")
                .accessibilityHint("Opens the evidence page")
            }
        }
        .cambiumPanel()

        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Proposal binding")
            if let binding = model.proposalBinding, binding.workId == work.id {
                FactRow(label: "Proposal", value: binding.proposalId, mono: true)
                FactRow(label: "Binding", value: binding.source == .ownerProjection ? "Named by the loaded projection" : "Typed for this session")
            } else if model.isDemo {
                Text("This record has no proposal reference in the loaded projection. The dated founder proposal is a separate example and is not assumed.")
                    .font(.callout).foregroundStyle(Palette.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("No owner projection joins this work to a proposal. Type the canonical proposal reference on the review page.")
                    .font(.callout).foregroundStyle(Palette.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .cambiumPanel()

        HStack {
            Button("See the trace") { model.open(.trace) }
            Button("Review proposal") { model.open(.proposal) }
            Button("List admissions") {
                model.open(.launch)
                model.listAdmissions()
            }
            Spacer()
        }
    }

    /// The catalog record the served join report maps to this exact Work node.
    private var joinedProject: MappedProject? {
        guard let portfolio = model.fabric?.portfolio,
              let match = portfolio.joinReport?.matches.first(where: { $0.runtimeWorkId == work.id }) else { return nil }
        return portfolio.projects.first { $0.canonicalId == match.canonicalId }
    }

    private var bindingCopy: String {
        if model.isDemo {
            return "Demo projection. The founder proposal example is dated 2026-07-28. The launch admission example is dated 2026-11-02. They stay separate."
        }
        return "Loaded from the configured owner. Nothing here is admitted until discovery lists an existing admission."
    }
}
