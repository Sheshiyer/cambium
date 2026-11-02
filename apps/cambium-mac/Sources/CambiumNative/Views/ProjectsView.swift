import SwiftUI
import struct CambiumCore.MappedPortfolio
import struct CambiumCore.MappedProject
import struct CambiumCore.MappedHistoricalProject

private enum ProjectListEntry: Identifiable {
    case active(MappedProject)
    case historical(MappedHistoricalProject)

    var id: String {
        switch self {
        case .active(let project): project.id
        case .historical(let product): "historical-\(product.id)"
        }
    }

    var name: String {
        switch self {
        case .active(let project): project.name
        case .historical(let product): product.name
        }
    }
}

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
                    let rows = visible(portfolio)
                    let selected = rows.first(where: isSelected) ?? rows.first
                    HStack(alignment: .top, spacing: 18) {
                        projectList(rows, selectedID: selected?.id)
                            .frame(width: 300)
                        if let selected {
                            switch selected {
                            case .active(let project):
                                dossier(project)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            case .historical(let product):
                                historicalDossier(product)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        } else {
                            EmptyStateView(symbol: "square.grid.2x2", title: "Choose a project",
                                           message: "Select a mapped project to inspect its source and gaps.")
                                .cambiumPanel()
                        }
                    }
                    if !portfolio.classificationReviews.isEmpty {
                        classificationReviews(portfolio)
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
        .onChange(of: model.projectNavigationVersion) { _, _ in
            guard let portfolio = model.fabric?.portfolio, portfolio.detailAvailable else { return }
            if !visible(portfolio).contains(where: isSelected) {
                query = ""
                category = "all"
            }
        }
    }

    private func summary(_ portfolio: MappedPortfolio) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Source classification",
                          detail: "\(portfolio.summary.total) current · \(portfolio.summary.historicalProducts) historical")
            HStack(spacing: 8) {
                StatusChip(text: "\(portfolio.summary.saplings) saplings", tone: .evidence)
                StatusChip(text: "\(portfolio.summary.clientBranches) client branches", tone: .rail)
                StatusChip(text: "\(portfolio.summary.internalPrograms) internal programs", tone: .signal)
            }
            HStack(spacing: 14) {
                Text("Read only · no action admission")
                if let generated = portfolio.sourceGeneratedAt {
                    Text("Source \(model.time(generated))")
                }
            }
            .font(.caption)
            .foregroundStyle(Palette.inkMuted)
            DisclosureGroup("Source authority, joins and digests") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("\(portfolio.summary.status) · action admission: \(portfolio.summary.actionAdmission). Classification and tenant labels are source observations.")
                        .font(.callout)
                        .foregroundStyle(Palette.inkMuted)
                    if portfolio.summary.classificationReview > 0 {
                        StatusChip(text: "\(portfolio.summary.classificationReview) classification reviews", tone: .hold)
                    }
                    if let join = portfolio.joinReport {
                        Text("\(join.matchedCount) explicit runtime join\(join.matchedCount == 1 ? "" : "s") · \(join.catalogOrphanCount) catalog records without a runtime join · \(join.runtimeOrphanCount) runtime work records without a catalog join")
                            .font(.callout)
                            .foregroundStyle(Palette.inkMuted)
                    }
                    FactRow(label: "Source generated", value: portfolio.sourceGeneratedAt.map(model.time))
                    FactRow(label: "Graph as of", value: model.time(portfolio.asOf))
                    FactRow(label: "Served", value: model.time(portfolio.servedAt))
                    FactRow(label: "Display digest", value: portfolio.summary.catalogDigest, mono: true)
                    FactRow(label: "Action digest", value: portfolio.summary.actionCatalogDigest, mono: true)
                }
                .padding(.top, 8)
            }
            .accessibilityIdentifier("projects.sourceDetails")
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
                Text("Historical products").tag("historical")
            }
            .frame(width: 190)
            .accessibilityIdentifier("projects.category")
        }
    }

    private func visible(_ portfolio: MappedPortfolio) -> [ProjectListEntry] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let active = portfolio.projects.filter { project in
            (category == "all" || project.classification == category) &&
            (normalized.isEmpty || ([project.name, project.canonicalId, project.workId] + project.aliases)
                .contains { $0.localizedCaseInsensitiveContains(normalized) })
        }.map(ProjectListEntry.active)
        let history = portfolio.historicalProducts.filter { product in
            (category == "all" || category == "historical") &&
            (normalized.isEmpty || [product.name, product.canonicalId, product.linkedCanonicalId ?? ""]
                .contains { $0.localizedCaseInsensitiveContains(normalized) })
        }.map(ProjectListEntry.historical)
        return active + history
    }

    private func projectList(_ rows: [ProjectListEntry], selectedID: String?) -> some View {
        return VStack(alignment: .leading, spacing: 9) {
            SectionHeader(title: "Projects", detail: "\(rows.count) shown")
            if rows.isEmpty {
                Text("No mapped projects match this search and category.")
                    .font(.callout)
                    .foregroundStyle(Palette.inkMuted)
            } else {
                ScrollView {
                    LazyVStack(spacing: 7) {
                        ForEach(rows) { entry in
                            Button { select(entry) } label: {
                                HStack(spacing: 8) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(entry.name)
                                            .font(CambiumFont.heading)
                                            .foregroundStyle(Palette.ink)
                                        Text(entrySubtitle(entry))
                                            .font(CambiumFont.label)
                                            .foregroundStyle(Palette.inkMuted)
                                    }
                                    Spacer(minLength: 3)
                                    if case .active(let project) = entry, project.runtimeWorkId != nil {
                                        Image(systemName: "link")
                                            .foregroundStyle(Palette.evidence)
                                            .accessibilityLabel("Explicit runtime join")
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .cambiumPanel(padding: 10, highlighted: entry.id == selectedID)
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("projects.row.\(entry.id)")
                            .accessibilityHint("Opens the source catalog record")
                        }
                    }
                }
                .frame(height: 560)
            }
        }
    }

    private func select(_ entry: ProjectListEntry) {
        switch entry {
        case .active(let project): model.selectProject(project.id)
        case .historical(let product): model.selectHistoricalProduct(product.id)
        }
    }

    private func isSelected(_ entry: ProjectListEntry) -> Bool {
        switch entry {
        case .active(let project): project.id == model.selectedProjectID
        case .historical(let product): product.id == model.selectedHistoricalID
        }
    }

    private func entrySubtitle(_ entry: ProjectListEntry) -> String {
        switch entry {
        case .active(let project): project.classification
        case .historical(let product): "Historical · \(product.status)"
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
                FactRow(label: "Source account", value: project.accountId)
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
                linkedRows(project.linkedCanonicalIds)
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

    private func historicalDossier(_ product: MappedHistoricalProject) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                SectionHeader(title: "Historical source")
                Text(product.name)
                    .font(CambiumFont.display)
                    .foregroundStyle(Palette.ink)
                StatusChip(text: product.status, tone: .muted)
                Text("Historical classification only. This record has no runtime Work or action admission.")
                    .font(.callout)
                    .foregroundStyle(Palette.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                FactRow(label: "Canonical ID", value: product.canonicalId, mono: true)
                if let target = product.linkedCanonicalId {
                    linkedRows([target])
                } else {
                    FactRow(label: "Linked current record", value: nil)
                }
            }
            .cambiumPanel(highlighted: true)

            VStack(alignment: .leading, spacing: 8) {
                SectionHeader(title: "Provenance")
                if product.provenance.isEmpty {
                    Text("No provenance listed.")
                        .font(.callout).foregroundStyle(Palette.hold)
                } else {
                    ForEach(product.provenance, id: \.self) { source in
                        Text(source).font(CambiumFont.monoSmall).foregroundStyle(Palette.ink)
                            .textSelection(.enabled)
                    }
                }
            }
            .cambiumPanel()
        }
        .accessibilityIdentifier("projects.historical.\(product.id)")
    }

    private func linkedRows(_ canonicalIds: [String]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            SectionHeader(title: "Linked source records")
            if canonicalIds.isEmpty {
                Text("No source links listed.")
                    .font(.callout).foregroundStyle(Palette.inkMuted)
            }
            ForEach(canonicalIds, id: \.self) { id in
                if let project = model.fabric?.portfolio?.projects.first(where: { $0.canonicalId == id }) {
                    Button {
                        category = "all"
                        query = ""
                        model.selectProject(project.id)
                    } label: {
                        Label(project.name, systemImage: "arrow.turn.down.right")
                    }
                    .accessibilityHint("Opens a linked source classification record, not operational Work")
                } else if let product = model.fabric?.portfolio?.historicalProducts.first(where: { $0.canonicalId == id }) {
                    Button {
                        category = "all"
                        query = ""
                        model.selectHistoricalProduct(product.id)
                    } label: {
                        Label(product.name, systemImage: "arrow.turn.down.right")
                    }
                    .accessibilityHint("Opens a linked historical source record")
                } else {
                    Text("\(id) · not in this served catalog")
                        .font(CambiumFont.monoSmall)
                        .foregroundStyle(Palette.hold)
                }
            }
        }
    }

    private func classificationReviews(_ portfolio: MappedPortfolio) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Classification review", detail: "\(portfolio.classificationReviews.count) source questions")
            Text("These are source questions awaiting classification. They do not create Work or grant tenant access.")
                .font(.callout).foregroundStyle(Palette.inkMuted)
            ForEach(portfolio.classificationReviews) { review in
                VStack(alignment: .leading, spacing: 4) {
                    Text(review.canonicalId).font(CambiumFont.monoSmall).foregroundStyle(Palette.ink)
                    Text(review.needed).font(.callout).foregroundStyle(Palette.hold)
                    Text(review.source).font(CambiumFont.monoSmall).foregroundStyle(Palette.inkMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .cambiumPanel(padding: 10)
            }
        }
    }
}
