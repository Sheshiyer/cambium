import Foundation

// Typed, read-only projection of the founder portfolio catalog served inside a
// Mission Fabric envelope. The catalog is render-and-proposal-only
// (`actionAdmission` none). Classification, lifecycle and tenant identity here
// are display observations. None of them is runtime authority, a tenant
// binding, or an admission for any action.

/// One catalog record prepared for display. `runtimeWorkId` is non-nil only when
/// the served `portfolioJoinReport.matches` lists this record's `canonicalId`
/// and the target Work node exists in the served projection.

/// A historical product surface. Its optional link names another catalog identity
/// for display. It is not a tenant binding, a Work node, or a runtime join.
public struct MappedProject: Identifiable, Equatable, Sendable {
    public let workId: String
    public let canonicalId: String
    public let name: String
    public let kind: String
    public let classification: String
    public let tenantStatus: String
    public let tenantId: String?
    public let parentTenant: String?
    public let lifecycle: String?
    public let promotionState: String?
    public let programKind: String?
    public let provenance: [String]
    public let linkedCanonicalIds: [String]
    public let aliases: [String]
    public let runtimeWorkId: String?
    /// Source observation of fields the catalog lacks for this record. Not a verdict.
    public let operationalGapMissingFields: [String]

    public var id: String { workId }

    public init(
        workId: String,
        canonicalId: String,
        name: String,
        kind: String,
        classification: String,
        tenantStatus: String,
        tenantId: String? = nil,
        parentTenant: String? = nil,
        lifecycle: String? = nil,
        promotionState: String? = nil,
        programKind: String? = nil,
        provenance: [String] = [],
        linkedCanonicalIds: [String] = [],
        aliases: [String] = [],
        runtimeWorkId: String? = nil,
        operationalGapMissingFields: [String] = []
    ) {
        self.workId = workId
        self.canonicalId = canonicalId
        self.name = name
        self.kind = kind
        self.classification = classification
        self.tenantStatus = tenantStatus
        self.tenantId = tenantId
        self.parentTenant = parentTenant
        self.lifecycle = lifecycle
        self.promotionState = promotionState
        self.programKind = programKind
        self.provenance = provenance
        self.linkedCanonicalIds = linkedCanonicalIds
        self.aliases = aliases
        self.runtimeWorkId = runtimeWorkId
        self.operationalGapMissingFields = operationalGapMissingFields
    }
}

public struct MappedHistoricalProject: Identifiable, Equatable, Sendable {
    public let canonicalId: String
    public let name: String
    public let status: String
    public let linkedCanonicalId: String?
    public let provenance: [String]

    public var id: String { canonicalId }

    public init(
        canonicalId: String,
        name: String,
        status: String,
        linkedCanonicalId: String? = nil,
        provenance: [String] = []
    ) {
        self.canonicalId = canonicalId
        self.name = name
        self.status = status
        self.linkedCanonicalId = linkedCanonicalId
        self.provenance = provenance
    }
}

/// An unresolved classification observation. `needed` describes missing evidence;
/// it grants no classification, tenant, or Work authority.
public struct MappedClassificationReview: Identifiable, Equatable, Sendable {
    public let canonicalId: String
    public let source: String
    public let needed: String

    public var id: String { canonicalId }

    public init(canonicalId: String, source: String, needed: String) {
        self.canonicalId = canonicalId
        self.source = source
        self.needed = needed
    }
}

public struct MappedPortfolio: Equatable, Sendable {
    public let summary: PortfolioCatalogSummary
    public let projects: [MappedProject]
    /// Historical surfaces from founder detail. Empty for a viewer.
    public let historicalProducts: [MappedHistoricalProject]
    /// Classification observations from founder detail. Empty for a viewer.
    public let classificationReviews: [MappedClassificationReview]
    /// False for a viewer: the server serves the summary without records.
    public let detailAvailable: Bool
    public let sourceGeneratedAt: String?
    public let asOf: String
    public let servedAt: String
    public let joinReport: PortfolioJoinReport?

    public init(
        summary: PortfolioCatalogSummary,
        projects: [MappedProject],
        historicalProducts: [MappedHistoricalProject] = [],
        classificationReviews: [MappedClassificationReview] = [],
        detailAvailable: Bool,
        sourceGeneratedAt: String?,
        asOf: String,
        servedAt: String,
        joinReport: PortfolioJoinReport?
    ) {
        self.summary = summary
        self.projects = projects
        self.historicalProducts = historicalProducts
        self.classificationReviews = classificationReviews
        self.detailAvailable = detailAvailable
        self.sourceGeneratedAt = sourceGeneratedAt
        self.asOf = asOf
        self.servedAt = servedAt
        self.joinReport = joinReport
    }

    // Display helpers only. None of these carries authority.

    public func projects(classification: String) -> [MappedProject] {
        projects.filter { $0.classification == classification }
    }

    public var saplings: [MappedProject] { projects(classification: "sapling") }
    public var clientBranches: [MappedProject] { projects(classification: "client-branch") }
    public var internalPrograms: [MappedProject] { projects(classification: "internal-program") }

    /// Records the served join report explicitly links to a runtime Work node.
    public var runtimeLinkedProjects: [MappedProject] { projects.filter { $0.runtimeWorkId != nil } }

    public func project(workId: String) -> MappedProject? {
        projects.first { $0.workId == workId }
    }

    public func projectsByLifecycle() -> [String: [MappedProject]] {
        Dictionary(grouping: projects) { $0.lifecycle ?? "none" }
    }
}

public enum MappedPortfolioDecoder {
    private static let kinds: Set<String> = ["sapling", "program"]
    private static let classifications: Set<String> = ["sapling", "client-branch", "internal-program"]
    private static let tenantStatuses: Set<String> = [
        "canonical", "canonical-parent", "documented-not-runtime-verified", "not-applicable", "unresolved",
    ]
    private static let promotionStates: Set<String> = ["proof-only", "supervised-branch"]
    private static let programKinds: Set<String> = ["client", "company", "capability", "operations"]
    private static let lifecycles: Set<String> = ["proposed", "approved", "executing", "verifying", "complete", "retired"]
    private static let historicalStatuses: Set<String> = ["archived", "completed", "paused", "white-labelable"]
    private static let maxFieldChars = 2048

    /// Returns nil only when the envelope carries no catalog summary.
    /// With a summary and no detail (viewer), returns zero projects and `detailAvailable` false.
    /// With detail, every record must be valid; a malformed or missing row throws.
    public static func decode(_ envelope: MissionFabricEnvelope) throws -> MappedPortfolio? {
        guard let summary = envelope.portfolioCatalogSummary else { return nil }
        guard summary.actionAdmission == "none", summary.readOnly else {
            throw FabricDecodeError.schema("portfolioCatalogSummary authority")
        }
        let asOf = envelope.projection.asOf
        let servedAt = envelope.delivery.servedAt

        guard let detail = envelope.portfolioCatalog else {
            return MappedPortfolio(
                summary: summary, projects: [], historicalProducts: [], classificationReviews: [],
                detailAvailable: false, sourceGeneratedAt: nil,
                asOf: asOf, servedAt: servedAt, joinReport: envelope.portfolioJoinReport
            )
        }

        guard case .object(let catalog) = detail else { throw FabricDecodeError.malformed("portfolioCatalog") }
        guard case .bool(true)? = catalog["readOnly"] else { throw FabricDecodeError.schema("portfolioCatalog.readOnly") }
        guard case .object(let authority)? = catalog["actionAuthority"],
              case .string("none")? = authority["admission"] else {
            throw FabricDecodeError.schema("portfolioCatalog.actionAuthority")
        }
        let sourceGeneratedAt = try optionalString(catalog, "sourceGeneratedAt")
        if let sourceGeneratedAt {
            guard sourceGeneratedAt.count <= 64,
                  sourceGeneratedAt.range(of: CanonicalTimestamp.pattern, options: .regularExpression) != nil else {
                throw FabricDecodeError.malformed("portfolioCatalog.sourceGeneratedAt")
            }
        }

        guard case .array(let rows)? = catalog["records"],
              rows.count == summary.total,
              rows.count <= MissionFabricCaps.maxCollectionItems else {
            throw FabricDecodeError.malformed("portfolioCatalog.records")
        }

        let gaps = try decodeGaps(catalog["operationalGaps"], expectedCount: summary.operationalGaps)
        let historicalProducts = try decodeHistorical(catalog["historicalProducts"], expectedCount: summary.historicalProducts)
        let classificationReviews = try decodeReviews(catalog["classificationReview"], expectedCount: summary.classificationReview)
        let known = try knownCanonicalIds(rows: rows, historical: historicalProducts)
        let joins = try exactJoins(envelope: envelope, known: known)

        var seenWork = Set<String>()
        var seenCanonical = Set<String>()
        var projects: [MappedProject] = []
        projects.reserveCapacity(rows.count)
        for row in rows {
            let project = try decodeRecord(row, joins: joins, gaps: gaps)
            guard seenWork.insert(project.workId).inserted else { throw FabricDecodeError.malformed("portfolioCatalog duplicate workId") }
            guard seenCanonical.insert(project.canonicalId).inserted else { throw FabricDecodeError.malformed("portfolioCatalog duplicate canonicalId") }
            projects.append(project)
        }
        for workId in gaps.keys where !seenWork.contains(workId) {
            throw FabricDecodeError.malformed("operationalGaps workId is not a catalog record")
        }

        let counts = [
            ("saplings", projects.filter { $0.classification == "sapling" }.count, summary.saplings),
            ("clientBranches", projects.filter { $0.classification == "client-branch" }.count, summary.clientBranches),
            ("internalPrograms", projects.filter { $0.classification == "internal-program" }.count, summary.internalPrograms),
        ]
        for (name, actual, expected) in counts where actual != expected {
            throw FabricDecodeError.malformed("portfolioCatalog.summary.\(name)")
        }

        return MappedPortfolio(
            summary: summary, projects: projects, historicalProducts: historicalProducts,
            classificationReviews: classificationReviews, detailAvailable: true, sourceGeneratedAt: sourceGeneratedAt,
            asOf: asOf, servedAt: servedAt, joinReport: envelope.portfolioJoinReport
        )
    }

    // MARK: - Join

    /// Exact canonicalId to runtimeWorkId pairs from the served join report only.
    /// Every target must be a Work node in the served projection.
    private static func exactJoins(envelope: MissionFabricEnvelope, known: Set<String>) throws -> [String: String] {
        guard let report = envelope.portfolioJoinReport else { return [:] }
        guard report.matches.count <= MissionFabricCaps.maxCollectionItems else { throw FabricDecodeError.capExceeded("portfolioJoinReport") }
        let workIds = Set(envelope.projection.nodes.compactMap { node -> String? in
            if case .work(let value) = node { return value.workId }
            return nil
        })
        var joins: [String: String] = [:]
        for match in report.matches {
            guard known.contains(match.canonicalId) else { throw FabricDecodeError.malformed("join match canonicalId is not in the catalog") }
            guard workIds.contains(match.runtimeWorkId) else { throw FabricDecodeError.malformed("join match target has no work node") }
            guard joins.updateValue(match.runtimeWorkId, forKey: match.canonicalId) == nil else {
                throw FabricDecodeError.malformed("join match identity")
            }
        }
        return joins
    }

    private static func knownCanonicalIds(rows: [JSONValue], historical: [MappedHistoricalProject]) throws -> Set<String> {
        var ids = Set<String>()
        for row in rows {
            guard case .object(let object) = row else { throw FabricDecodeError.malformed("portfolioCatalog.records") }
            ids.insert(try string(object, "canonicalId"))
        }
        for product in historical { ids.insert(product.canonicalId) }
        return ids
    }

    // MARK: - Historical and review

    /// Display rows only. A linked canonical id is retained as text and is not resolved.
    private static func decodeHistorical(_ value: JSONValue?, expectedCount: Int) throws -> [MappedHistoricalProject] {
        guard case .array(let rows)? = value, rows.count == expectedCount, rows.count <= MissionFabricCaps.maxCollectionItems else {
            throw FabricDecodeError.malformed("portfolioCatalog.historicalProducts")
        }
        var seen = Set<String>()
        var products: [MappedHistoricalProject] = []
        products.reserveCapacity(rows.count)
        for row in rows {
            guard case .object(let object) = row else { throw FabricDecodeError.malformed("portfolioCatalog.historicalProducts") }
            let canonicalId = try string(object, "canonicalId")
            guard canonicalId.range(of: #"^historical-product:[a-z0-9]+(?:-[a-z0-9]+)*$"#, options: .regularExpression) != nil else {
                throw FabricDecodeError.schema("portfolioCatalog.historicalProducts.canonicalId")
            }
            guard seen.insert(canonicalId).inserted else { throw FabricDecodeError.malformed("portfolioCatalog duplicate historical canonicalId") }
            let name = try string(object, "name")
            guard name.count <= MissionFabricCaps.maxDisplayChars else { throw FabricDecodeError.capExceeded("display") }
            let status = try string(object, "status")
            guard historicalStatuses.contains(status) else { throw FabricDecodeError.schema("portfolioCatalog.historicalProducts.status") }
            let provenance = try stringArray(object, "provenance")
            guard provenance.count == 1 else { throw FabricDecodeError.malformed("portfolioCatalog.historicalProducts.provenance") }
            products.append(MappedHistoricalProject(
                canonicalId: canonicalId,
                name: name,
                status: status,
                linkedCanonicalId: try optionalString(object, "linkedCanonicalId"),
                provenance: provenance
            ))
        }
        return products
    }

    private static func decodeReviews(_ value: JSONValue?, expectedCount: Int) throws -> [MappedClassificationReview] {
        guard case .array(let rows)? = value, rows.count == expectedCount, rows.count <= MissionFabricCaps.maxCollectionItems else {
            throw FabricDecodeError.malformed("portfolioCatalog.classificationReview")
        }
        var seen = Set<String>()
        var reviews: [MappedClassificationReview] = []
        reviews.reserveCapacity(rows.count)
        for row in rows {
            guard case .object(let object) = row else { throw FabricDecodeError.malformed("portfolioCatalog.classificationReview") }
            let canonicalId = try string(object, "canonicalId")
            guard canonicalId.range(of: #"^review:[a-z0-9]+(?:-[a-z0-9]+)*$"#, options: .regularExpression) != nil else {
                throw FabricDecodeError.schema("portfolioCatalog.classificationReview.canonicalId")
            }
            guard seen.insert(canonicalId).inserted else { throw FabricDecodeError.malformed("portfolioCatalog duplicate review canonicalId") }
            let source = try string(object, "source")
            let needed = try string(object, "needed")
            guard source.count <= MissionFabricCaps.maxDisplayChars, needed.count <= MissionFabricCaps.maxDisplayChars else {
                throw FabricDecodeError.capExceeded("display")
            }
            reviews.append(MappedClassificationReview(canonicalId: canonicalId, source: source, needed: needed))
        }
        return reviews
    }

    // MARK: - Gaps

    private static func decodeGaps(_ value: JSONValue?, expectedCount: Int) throws -> [String: [String]] {
        guard case .array(let rows)? = value, rows.count == expectedCount, rows.count <= MissionFabricCaps.maxCollectionItems else {
            throw FabricDecodeError.malformed("portfolioCatalog.operationalGaps")
        }
        var gaps: [String: [String]] = [:]
        for row in rows {
            guard case .object(let object) = row else { throw FabricDecodeError.malformed("portfolioCatalog.operationalGaps") }
            let workId = try string(object, "workId")
            guard case .string("mission-data-needed")? = object["gapKind"] else {
                throw FabricDecodeError.schema("portfolioCatalog.operationalGaps.gapKind")
            }
            let fields = try stringArray(object, "missingFields")
            guard gaps.updateValue(fields, forKey: workId) == nil else { throw FabricDecodeError.malformed("operationalGaps duplicate workId") }
        }
        return gaps
    }

    // MARK: - Record

    private static func decodeRecord(_ value: JSONValue, joins: [String: String], gaps: [String: [String]]) throws -> MappedProject {
        guard case .object(let row) = value else { throw FabricDecodeError.malformed("portfolioCatalog.records") }
        let workId = try string(row, "workId")
        let canonicalId = try string(row, "canonicalId")
        let name = try string(row, "name")
        guard name.count <= MissionFabricCaps.maxDisplayChars else { throw FabricDecodeError.capExceeded("display") }
        let kind = try string(row, "kind")
        guard kinds.contains(kind) else { throw FabricDecodeError.schema("portfolioCatalog.records.kind") }
        let classification = try string(row, "classification")
        guard classifications.contains(classification) else { throw FabricDecodeError.schema("portfolioCatalog.records.classification") }
        guard case .object(let identity)? = row["tenantIdentity"] else { throw FabricDecodeError.malformed("portfolioCatalog.records.tenantIdentity") }
        let tenantStatus = try string(identity, "status")
        guard tenantStatuses.contains(tenantStatus) else { throw FabricDecodeError.schema("portfolioCatalog.records.tenantIdentity.status") }

        var aliases: [String] = []
        guard case .array(let aliasRows)? = row["aliases"], aliasRows.count <= MissionFabricCaps.maxCollectionItems else {
            throw FabricDecodeError.malformed("portfolioCatalog.records.aliases")
        }
        for alias in aliasRows {
            guard case .object(let item) = alias, case .bool(false)? = item["tenantAuthority"] else {
                throw FabricDecodeError.malformed("portfolioCatalog.records.aliases")
            }
            aliases.append(try string(item, "value"))
            _ = try string(item, "namespace")
        }
        if let portfolioStatus = try optionalString(row, "portfolioStatus"), portfolioStatus != "active" {
            throw FabricDecodeError.schema("portfolioCatalog.records.portfolioStatus")
        }
        let lifecycle = try optionalString(row, "lifecycle")
        if let lifecycle, !lifecycles.contains(lifecycle) {
            throw FabricDecodeError.schema("portfolioCatalog.records.lifecycle")
        }
        let promotionState = try optionalString(row, "promotionState")
        if let promotionState, !promotionStates.contains(promotionState) {
            throw FabricDecodeError.schema("portfolioCatalog.records.promotionState")
        }
        let programKind = try optionalString(row, "programKind")
        if let programKind, !programKinds.contains(programKind) {
            throw FabricDecodeError.schema("portfolioCatalog.records.programKind")
        }
        _ = try optionalString(row, "accountId")

        return MappedProject(
            workId: workId,
            canonicalId: canonicalId,
            name: name,
            kind: kind,
            classification: classification,
            tenantStatus: tenantStatus,
            tenantId: try optionalString(identity, "tenantId"),
            parentTenant: try optionalString(row, "parentTenant"),
            lifecycle: lifecycle,
            promotionState: promotionState,
            programKind: programKind,
            provenance: try stringArray(row, "provenance"),
            linkedCanonicalIds: try stringArray(row, "linkedCanonicalIds"),
            aliases: aliases,
            runtimeWorkId: joins[canonicalId],
            operationalGapMissingFields: gaps[workId] ?? []
        )
    }

    // MARK: - Field helpers (error text carries field names only, never source contents)

    private static func string(_ object: [String: JSONValue], _ key: String) throws -> String {
        guard case .string(let value)? = object[key], !value.isEmpty, value.count <= maxFieldChars else {
            throw FabricDecodeError.malformed(key)
        }
        return value
    }

    private static func optionalString(_ object: [String: JSONValue], _ key: String) throws -> String? {
        guard let value = object[key] else { return nil }
        if case .null = value { return nil }
        guard case .string(let text) = value, !text.isEmpty, text.count <= maxFieldChars else { throw FabricDecodeError.malformed(key) }
        return text
    }

    private static func stringArray(_ object: [String: JSONValue], _ key: String) throws -> [String] {
        guard case .array(let values)? = object[key], values.count <= MissionFabricCaps.maxCollectionItems else {
            throw FabricDecodeError.malformed(key)
        }
        return try values.map { value in
            guard case .string(let text) = value, text.count <= maxFieldChars else { throw FabricDecodeError.malformed(key) }
            return text
        }
    }
}
