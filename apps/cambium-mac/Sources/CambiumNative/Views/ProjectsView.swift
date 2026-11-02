import SwiftUI
import struct CambiumCore.MappedPortfolio
import struct CambiumCore.MappedProject

/// Source-classified portfolio records served by the same scoped Mission Fabric
/// read as Canopy. This page never turns catalog membership into admission.
struct ProjectsView: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var category = "all"

    var body: some View {
        PageScaffold(eyebrow: "Portfolio", title: "Mapped projects",
                     subtitle: "The projects in the owner’s display catalog, alongside their provenance and operational gaps.") {
            if let portfolio = model.fabric?.portfolio {
                if model.isDemo {
                    SyntheticNotice(message: "This is a dated replay of a catalog source. Its names and counts do not prove the current live owner state.")
                }
                summary(portfolio)
                if portfolio.detailAvailable {
                    controls
                    HStack(alignment: .top, spacing: 18) {
                        projectList(portfolio)
                            .frame(width: 300)
                        if let selected = model.selectedProject {
                            dossier(selected)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        } else {
                            EmptyStateView(symbol: "square.grid.2x2", title: "Choose a project",
                                           message: "Select a mapped project to inspect its source and gaps.")
                                .cambiumPanel()
                        }
                    }
                } else {
                    EmptyStateView(symbol: "lock", title: "Summary only",
                                   message: "This scoped session can read portfolio totals. Project records require a Cambium founder session.")
                        .cambiumPanel()
                }
            } else {
                EmptyStateView(symbol: "square.grid.2x2", title: "No project catalog loaded",
                               message: "Configure an owner in Connections and sign in to read its scoped project catalog. The demo contains a dated replay.")
                    .cambiumPanel()
                if !model.isDemo {
                    HStack {
                        Button("Connections") { model.open(.connections) }
                        Button("Open demo") { model.enterDemo() }
                    }
                }
            }
        }
    }

    private func summary(_ portfolio: MappedPortfolio) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Source classification", detail: "\(portfolio.summary.total) records")
            HStack(spacing: 8) {
                StatusChip(text: "\(portfolio.summary.saplings) saplings", tone: .evidence)
                StatusChip(text: "\(portfolio.summary.clientBranches) client branches", tone: .rail)
                StatusChip(text: "\(portfolio.summary.internalPrograms) internal programs", tone: .signal)
            }
            Text("Read only · \(portfolio.summary.status) · action admission: \(portfolio.summary.actionAdmission). Classification and tenant labels are source observations.")
                .font(.callout)
                .foregroundStyle(Palette.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
            FactRow(label: "Source generated", value: portfolio.sourceGeneratedAt.map(model.time))
            FactRow(label: "Graph as of", value: model.time(portfolio.asOf))
            FactRow(label: "Served", value: model.time(portfolio.servedAt))
            FactRow(label: "Display digest", value: portfolio.summary.catalogDigest, mono: true)
            FactRow(label: "Action digest", value: portfolio.summary.actionCatalogDigest, mono: true)
            if let join = portfolio.joinReport {
                Text("\(join.matchedCount) explicit runtime join\(join.matchedCount == 1 ? "" : "s") · \(join.catalogOrphanCount) catalog records without a runtime join · \(join.runtimeOrphanCount) runtime work records without a catalog join")
                    .font(.callout)
                    .foregroundStyle(Palette.inkMuted)
            }
        }
        .cambiumPanel()
    }

    private var controls: some View {
        HStack(spacing: 12) {
            TextField("Search mapped projects", text: $query)
                .textFieldStyle(.roundedBorder)
                .accessibilityIdentifier("projects.search")
            Picker("Category", selection: $category) {
                Text("All").tag("all")
                Text("Saplings").tag("sapling")
                Text("Client branches").tag("client-branch")
                Text("Internal programs").tag("internal-program")
            }
            .frame(width: 190)
            .accessibilityIdentifier("projects.category")
        }
    }

    private func visible(_ portfolio: MappedPortfolio) -> [MappedProject] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return portfolio.projects.filter { project in
            (category == "all" || project.classification == category) &&
            (normalized.isEmpty || [project.name, project.canonicalId, project.workId]
                .contains { $0.localizedCaseInsensitiveContains(normalized) })
        }
    }

    private func projectList(_ portfolio: MappedPortfolio) -> some View {
        let rows = visible(portfolio)
        return VStack(alignment: .leading, spacing: 9) {
            SectionHeader(title: "Projects", detail: "\(rows.count) shown")
            if rows.isEmpty {
                Text("No mapped projects match this search and category.")
                    .font(.callout)
                    .foregroundStyle(Palette.inkMuted)
            } else {
                ScrollView {
                    LazyVStack(spacing: 7) {
                        ForEach(rows) { project in
                            Button { model.selectProject(project.id) } label: {
                                HStack(spacing: 8) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(project.name)
                                            .font(CambiumFont.heading)
                                            .foregroundStyle(Palette.ink)
                                        Text(project.classification)
                                            .font(CambiumFont.label)
                                            .foregroundStyle(Palette.inkMuted)
                                    }
                                    Spacer(minLength: 3)
                                    if project.runtimeWorkId != nil {
                                        Image(systemName: "link")
                                            .foregroundStyle(Palette.evidence)
                                            .accessibilityLabel("Explicit runtime join")
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .cambiumPanel(padding: 10, highlighted: project.id == model.selectedProjectID)
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("projects.row.\(project.id)")
                            .accessibilityHint("Opens the source catalog record")
                        }
                    }
                }
                .frame(height: 560)
            }
        }
    }

    private func dossier(_ project: MappedProject) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                SectionHeader(title: "Project source")
                Text(project.name)
                    .font(CambiumFont.display)
                    .foregroundStyle(Palette.ink)
                StatusChip(text: project.classification, tone: .rail)
                Text("A source classification record. It does not grant a tenant role, approval, or launch admission.")
                    .font(.callout)
                    .foregroundStyle(Palette.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                FactRow(label: "Canonical ID", value: project.canonicalId, mono: true)
                FactRow(label: "Catalog work ID", value: project.workId, mono: true)
                FactRow(label: "Kind", value: project.kind)
                FactRow(label: "Tenant status", value: project.tenantStatus)
                FactRow(label: "Tenant label", value: project.tenantId)
                FactRow(label: "Parent tenant", value: project.parentTenant)
                FactRow(label: "Lifecycle", value: project.lifecycle)
                FactRow(label: "Promotion", value: project.promotionState)
                FactRow(label: "Program kind", value: project.programKind)
                FactRow(label: "Aliases", value: project.aliases.isEmpty ? nil : project.aliases.joined(separator: ", "))
            }
            .cambiumPanel(highlighted: true)

            VStack(alignment: .leading, spacing: 8) {
                SectionHeader(title: "Provenance and links")
                if project.provenance.isEmpty {
                    Text("No provenance listed.").foregroundStyle(Palette.hold)
                } else {
                    ForEach(project.provenance, id: \.self) { source in
                        Text(source).font(CambiumFont.monoSmall).foregroundStyle(Palette.ink)
                            .textSelection(.enabled)
                    }
                }
                FactRow(label: "Linked records", value: project.linkedCanonicalIds.isEmpty ? nil : project.linkedCanonicalIds.joined(separator: ", "), mono: true)
            }
            .cambiumPanel()

            VStack(alignment: .leading, spacing: 8) {
                SectionHeader(title: "Operational boundary")
                if project.operationalGapMissingFields.isEmpty {
                    Text("No catalog operational gap is listed. This is not an admission verdict.")
                        .font(.callout).foregroundStyle(Palette.inkMuted)
                } else {
                    Text("Mission data needed: \(project.operationalGapMissingFields.joined(separator: ", ")).")
                        .font(.callout).foregroundStyle(Palette.hold)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let work = model.joinedWork(for: project) {
                    FactRow(label: "Explicit join", value: work.id, mono: true)
                    Button("Open operational Work") { model.openOperationalWork(for: project.id) }
                        .accessibilityIdentifier("projects.openWork")
                } else {
                    Text("No served join to an operational Work node. Catalog membership cannot start a decision or launch.")
                        .font(.callout).foregroundStyle(Palette.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .cambiumPanel()
        }
        .accessibilityIdentifier("projects.dossier.\(project.id)")
    }
}
