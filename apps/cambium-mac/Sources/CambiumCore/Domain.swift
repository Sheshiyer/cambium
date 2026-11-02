import Foundation

// Wave-1 shared domain values. UI depends on these names only.
// Records are observations or synthetic demo data. None of them authorize
// a decision or a launch.

public struct EvidenceItem: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var title: String
    public var sourceRef: String
    public var kind: String
    public var observedAt: String?
    public var digest: String?

    public init(
        id: String,
        title: String,
        sourceRef: String,
        kind: String,
        observedAt: String? = nil,
        digest: String? = nil
    ) {
        self.id = id
        self.title = title
        self.sourceRef = sourceRef
        self.kind = kind
        self.observedAt = observedAt
        self.digest = digest
    }
}

public struct WorkObject: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var name: String
    public var kind: String
    public var summary: String
    public var objective: String
    public var currentState: String
    public var nextStep: String
    public var dependencies: [String]
    public var evidence: [EvidenceItem]
    public var attention: String

    public init(
        id: String,
        name: String,
        kind: String,
        summary: String,
        objective: String,
        currentState: String,
        nextStep: String,
        dependencies: [String] = [],
        evidence: [EvidenceItem] = [],
        attention: String = "review"
    ) {
        self.id = id
        self.name = name
        self.kind = kind
        self.summary = summary
        self.objective = objective
        self.currentState = currentState
        self.nextStep = nextStep
        self.dependencies = dependencies
        self.evidence = evidence
        self.attention = attention
    }
}

public struct ConnectionObservation: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var name: String
    public var owner: String
    public var status: String
    public var detail: String
    public var observedAt: String?

    public init(
        id: String,
        name: String,
        owner: String,
        status: String,
        detail: String,
        observedAt: String? = nil
    ) {
        self.id = id
        self.name = name
        self.owner = owner
        self.status = status
        self.detail = detail
        self.observedAt = observedAt
    }
}

public struct SystemSnapshot: Codable, Sendable, Equatable {
    public var work: [WorkObject]
    public var connections: [ConnectionObservation]
    public var asOf: String
    public var sourceKind: String
    public var gaps: [String]

    public init(
        work: [WorkObject],
        connections: [ConnectionObservation],
        asOf: String,
        sourceKind: String,
        gaps: [String]
    ) {
        self.work = work
        self.connections = connections
        self.asOf = asOf
        self.sourceKind = sourceKind
        self.gaps = gaps
    }
}

public enum DemoData {
    /// Deterministic synthetic canopy. `sourceKind` is `demo`.
    /// Historical evidence is a reference, not a claim of successful work.
    public static let snapshot = SystemSnapshot(
        work: [
            WorkObject(
                id: "sapling:cambium",
                name: "Cambium",
                kind: "sapling",
                summary: "Synthetic native home for seeing the system and choosing a next step.",
                objective: "Show founder-scoped work, evidence and holds without inventing acceptance.",
                currentState: "demo",
                nextStep: "Open the dossier and inspect labelled gaps.",
                dependencies: ["program:thoughtseed-organ-console"],
                evidence: [
                    EvidenceItem(
                        id: "demo-evidence-cambium-brief",
                        title: "Native brief reference",
                        sourceRef: "apps/cambium-mac/docs/BRIEF.md",
                        kind: "reference",
                        observedAt: "2026-11-02T00:00:00.000Z"
                    )
                ],
                attention: "review"
            ),
            WorkObject(
                id: "program:thoughtseed-organ-console",
                name: "Organ Console",
                kind: "program",
                summary: "Synthetic connection to the organ console program.",
                objective: "Keep console ownership separate from this native surface.",
                currentState: "held",
                nextStep: "Read the owning program before treating any step as admitted.",
                evidence: [],
                attention: "held"
            )
        ],
        connections: [
            ConnectionObservation(
                id: "demo-connection-mission-fabric",
                name: "Mission Fabric",
                owner: "quests-worker",
                status: "unconfigured",
                detail: "Synthetic row. No live read was performed.",
                observedAt: "2026-11-02T00:00:00.000Z"
            ),
            ConnectionObservation(
                id: "demo-connection-founder-gate",
                name: "Founder Gate",
                owner: "canonical-founder-routes",
                status: "unconfigured",
                detail: "Synthetic row. A demo snapshot cannot authorize a decision.",
                observedAt: "2026-11-02T00:00:00.000Z"
            )
        ],
        asOf: "2026-11-02T00:00:00.000Z",
        sourceKind: "demo",
        gaps: [
            "native-identity-unconfigured",
            "launch-owner-unconfigured"
        ]
    )
}

/// Reader scope the app requested. The server resolves the authorized scope.
public struct ReaderScope: Codable, Sendable, Equatable {
    public var tenantId: String
    public var role: String
    /// Authenticated principal from the caller's verified session. Never read from a served document.
    public var principal: String?

    public init(tenantId: String, role: String, principal: String? = nil) {
        self.tenantId = tenantId
        self.role = role
        self.principal = principal
    }

    /// Cache partition for a read. A different principal, tenant or role never shares an entry.
    public var cachePartitionKey: String {
        "\(principal ?? "")|\(tenantId)|\(role)"
    }
}

public enum ObservationKind: String, Codable, Sendable, Equatable {
    case work
    case connection
    case evidence
    case gap
}

/// One typed observation. Unavailable subjects stay explicit.
public struct Observation: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var kind: ObservationKind
    public var producer: String
    public var schema: String
    public var subjectId: String
    public var sourceTime: String?
    public var observedAt: String
    public var expiresAt: String?
    public var provenance: String
    public var unavailableReason: String?

    public init(
        id: String,
        kind: ObservationKind,
        producer: String,
        schema: String,
        subjectId: String,
        sourceTime: String? = nil,
        observedAt: String,
        expiresAt: String? = nil,
        provenance: String,
        unavailableReason: String? = nil
    ) {
        self.id = id
        self.kind = kind
        self.producer = producer
        self.schema = schema
        self.subjectId = subjectId
        self.sourceTime = sourceTime
        self.observedAt = observedAt
        self.expiresAt = expiresAt
        self.provenance = provenance
        self.unavailableReason = unavailableReason
    }
}

public enum Freshness: String, Codable, Sendable, Equatable {
    case fresh
    case stale
    case unknown
}

/// Delivery freshness is transport metadata. It is not a content digest.
public struct DeliveryFreshness: Codable, Sendable, Equatable {
    public var servedAt: String
    public var freshness: Freshness
    public var portfolioPairDigest: String?

    public init(servedAt: String, freshness: Freshness, portfolioPairDigest: String? = nil) {
        self.servedAt = servedAt
        self.freshness = freshness
        self.portfolioPairDigest = portfolioPairDigest
    }
}

public struct DigestSet: Codable, Sendable, Equatable {
    public var graphDigest: String
    public var catalogDigest: String?
    public var classificationDigest: String?
    public var actionCatalogDigest: String?
    public var actionClassificationDigest: String?
    public var portfolioPairDigest: String?

    public init(
        graphDigest: String,
        catalogDigest: String? = nil,
        classificationDigest: String? = nil,
        actionCatalogDigest: String? = nil,
        actionClassificationDigest: String? = nil,
        portfolioPairDigest: String? = nil
    ) {
        self.graphDigest = graphDigest
        self.catalogDigest = catalogDigest
        self.classificationDigest = classificationDigest
        self.actionCatalogDigest = actionCatalogDigest
        self.actionClassificationDigest = actionClassificationDigest
        self.portfolioPairDigest = portfolioPairDigest
    }
}

public struct PortfolioCatalogSummary: Codable, Sendable, Equatable {
    public var total: Int
    public var saplings: Int
    public var clientBranches: Int
    public var internalPrograms: Int
    public var classificationReview: Int
    public var historicalProducts: Int
    public var operationalGaps: Int
    public var schema: String
    public var version: Int
    public var status: String
    public var readOnly: Bool
    public var classificationDigest: String
    public var catalogDigest: String
    public var actionClassificationDigest: String
    public var actionCatalogDigest: String
    public var actionAdmission: String

    public init(total: Int, saplings: Int, clientBranches: Int, internalPrograms: Int, classificationReview: Int, historicalProducts: Int, operationalGaps: Int, schema: String, version: Int, status: String, readOnly: Bool, classificationDigest: String, catalogDigest: String, actionClassificationDigest: String, actionCatalogDigest: String, actionAdmission: String) {
        self.total = total; self.saplings = saplings; self.clientBranches = clientBranches; self.internalPrograms = internalPrograms; self.classificationReview = classificationReview; self.historicalProducts = historicalProducts; self.operationalGaps = operationalGaps; self.schema = schema; self.version = version; self.status = status; self.readOnly = readOnly; self.classificationDigest = classificationDigest; self.catalogDigest = catalogDigest; self.actionClassificationDigest = actionClassificationDigest; self.actionCatalogDigest = actionCatalogDigest; self.actionAdmission = actionAdmission
    }
}

public struct PortfolioJoinMatch: Codable, Sendable, Equatable {
    public var canonicalId: String
    public var runtimeWorkId: String
    public init(canonicalId: String, runtimeWorkId: String) { self.canonicalId = canonicalId; self.runtimeWorkId = runtimeWorkId }
}

public struct PortfolioRuntimeIdentityCollision: Codable, Sendable, Equatable {
    public var workId: String
    public var occurrences: Int
    public init(workId: String, occurrences: Int) { self.workId = workId; self.occurrences = occurrences }
}

public struct PortfolioJoinReport: Codable, Sendable, Equatable {
    public var matchedCount: Int
    public var catalogOrphanCount: Int
    public var runtimeOrphanCount: Int
    public var runtimeIdentityCollisionCount: Int
    public var matches: [PortfolioJoinMatch]
    public var catalogOrphans: [String]
    public var runtimeOrphans: [String]
    public var runtimeIdentityCollisions: [PortfolioRuntimeIdentityCollision]
    public init(matchedCount: Int, catalogOrphanCount: Int, runtimeOrphanCount: Int, runtimeIdentityCollisionCount: Int, matches: [PortfolioJoinMatch], catalogOrphans: [String], runtimeOrphans: [String], runtimeIdentityCollisions: [PortfolioRuntimeIdentityCollision] = []) {
        self.matchedCount = matchedCount; self.catalogOrphanCount = catalogOrphanCount; self.runtimeOrphanCount = runtimeOrphanCount; self.runtimeIdentityCollisionCount = runtimeIdentityCollisionCount; self.matches = matches; self.catalogOrphans = catalogOrphans; self.runtimeOrphans = runtimeOrphans; self.runtimeIdentityCollisions = runtimeIdentityCollisions
    }
}

/// Bounded read of one full Mission Fabric response.
/// `organUpdateDelivery` stays an untyped sidecar: an illustrative plan is
/// not a persisted active delivery and is not operational authority.
public struct MissionFabricEnvelope: Codable, Sendable, Equatable {
    public var projection: MissionFabricProjection
    public var delivery: DeliveryFreshness
    public var portfolioCatalogSummary: PortfolioCatalogSummary?
    public var portfolioCatalog: JSONValue?
    public var portfolioJoinReport: PortfolioJoinReport?
    public var organUpdateDelivery: JSONValue?
    public var organUpdateDeliverySummary: JSONValue?
    public var organDeliveryPresent: Bool
    public var organDeliveryIsSummary: Bool
    public var truncated: [String]

    public init(
        projection: MissionFabricProjection,
        delivery: DeliveryFreshness,
        portfolioCatalogSummary: PortfolioCatalogSummary? = nil,
        portfolioCatalog: JSONValue? = nil,
        portfolioJoinReport: PortfolioJoinReport? = nil,
        organUpdateDelivery: JSONValue? = nil,
        organUpdateDeliverySummary: JSONValue? = nil,
        organDeliveryPresent: Bool,
        organDeliveryIsSummary: Bool,
        truncated: [String] = []
    ) {
        self.projection = projection
        self.delivery = delivery
        self.portfolioCatalogSummary = portfolioCatalogSummary
        self.portfolioCatalog = portfolioCatalog
        self.portfolioJoinReport = portfolioJoinReport
        self.organUpdateDelivery = organUpdateDelivery
        self.organUpdateDeliverySummary = organUpdateDeliverySummary
        self.organDeliveryPresent = organDeliveryPresent
        self.organDeliveryIsSummary = organDeliveryIsSummary
        self.truncated = truncated
    }

    public var digests: DigestSet {
        DigestSet(
            graphDigest: projection.graphDigest,
            catalogDigest: portfolioCatalogSummary?.catalogDigest,
            classificationDigest: portfolioCatalogSummary?.classificationDigest,
            actionCatalogDigest: portfolioCatalogSummary?.actionCatalogDigest,
            actionClassificationDigest: portfolioCatalogSummary?.actionClassificationDigest,
            portfolioPairDigest: delivery.portfolioPairDigest
        )
    }
}

public struct MissionFabricProjection: Codable, Sendable, Equatable {
    public static let schemaName = "cambium.mission-fabric-projection.v1"

    public var schema: String
    public var projectionVersion: Int
    public var tenantId: String
    public var graphVersion: Int
    public var graphDigest: String
    public var generatedAt: String
    public var asOf: String
    public var sourceOfTruth: String
    public var readOnly: Bool
    public var nodes: [FabricNode]
    public var edges: [FabricEdge]
    public var gaps: [FabricGap]

    public init(
        schema: String,
        projectionVersion: Int,
        tenantId: String,
        graphVersion: Int,
        graphDigest: String,
        generatedAt: String,
        asOf: String,
        sourceOfTruth: String,
        readOnly: Bool,
        nodes: [FabricNode],
        edges: [FabricEdge],
        gaps: [FabricGap]
    ) {
        self.schema = schema
        self.projectionVersion = projectionVersion
        self.tenantId = tenantId
        self.graphVersion = graphVersion
        self.graphDigest = graphDigest
        self.generatedAt = generatedAt
        self.asOf = asOf
        self.sourceOfTruth = sourceOfTruth
        self.readOnly = readOnly
        self.nodes = nodes
        self.edges = edges
        self.gaps = gaps
    }
}

public struct FabricEdge: Codable, Sendable, Equatable {
    public var kind: String
    public var fromId: String
    public var toId: String

    public init(kind: String, fromId: String, toId: String) {
        self.kind = kind
        self.fromId = fromId
        self.toId = toId
    }
}

public struct FabricGap: Codable, Sendable, Equatable, Identifiable {
    public var gapId: String
    public var kind: String
    public var subjectId: String?
    public var detail: String
    public var evidenceRef: String?

    public var id: String { gapId }

    public init(gapId: String, kind: String, subjectId: String?, detail: String, evidenceRef: String?) {
        self.gapId = gapId
        self.kind = kind
        self.subjectId = subjectId
        self.detail = detail
        self.evidenceRef = evidenceRef
    }
}

public struct FabricWorkValue: Codable, Sendable, Equatable {
    public var workId: String
    public var tenantId: String
    public var name: String
    public var desiredState: String
    public var currentState: String
    public var status: String
    public var ownerId: String
    public var nextAction: String?
    public var sourceRef: String
    public var sourceDigest: String
    public var nodeKind: String

    public init(
        workId: String,
        tenantId: String,
        name: String,
        desiredState: String,
        currentState: String,
        status: String,
        ownerId: String,
        nextAction: String?,
        sourceRef: String,
        sourceDigest: String,
        nodeKind: String
    ) {
        self.workId = workId
        self.tenantId = tenantId
        self.name = name
        self.desiredState = desiredState
        self.currentState = currentState
        self.status = status
        self.ownerId = ownerId
        self.nextAction = nextAction
        self.sourceRef = sourceRef
        self.sourceDigest = sourceDigest
        self.nodeKind = nodeKind
    }
}

public struct FabricMissionValue: Codable, Sendable, Equatable {
    public var missionId: String
    public var workId: String
    public var title: String
    public var objective: String
    public var status: String
    public var taskIds: [String]
    public var sourceRef: String

    public init(missionId: String, workId: String, title: String, objective: String, status: String, taskIds: [String], sourceRef: String) {
        self.missionId = missionId
        self.workId = workId
        self.title = title
        self.objective = objective
        self.status = status
        self.taskIds = taskIds
        self.sourceRef = sourceRef
    }
}

public struct FabricTaskValue: Codable, Sendable, Equatable {
    public var taskId: String
    public var missionId: String?
    public var desiredState: String?
    public var status: String
    public var dependencyIds: [String]
    public var pinnedLoadoutId: String?

    public init(taskId: String, missionId: String?, desiredState: String?, status: String, dependencyIds: [String], pinnedLoadoutId: String?) {
        self.taskId = taskId
        self.missionId = missionId
        self.desiredState = desiredState
        self.status = status
        self.dependencyIds = dependencyIds
        self.pinnedLoadoutId = pinnedLoadoutId
    }
}

public struct FabricReceiptValue: Codable, Sendable, Equatable {
    public var receiptId: String
    public var runId: String
    public var taskId: String
    public var status: String
    public var inputDigest: String
    public var outputDigest: String?
    public var evidenceRefs: [String]

    public init(receiptId: String, runId: String, taskId: String, status: String, inputDigest: String, outputDigest: String?, evidenceRefs: [String]) {
        self.receiptId = receiptId
        self.runId = runId
        self.taskId = taskId
        self.status = status
        self.inputDigest = inputDigest
        self.outputDigest = outputDigest
        self.evidenceRefs = evidenceRefs
    }
}

public struct FabricOpaqueValue: Codable, Sendable, Equatable {
    public var subjectId: String
    public var status: String
    public var sourceRef: String?

    public init(subjectId: String, status: String, sourceRef: String?) {
        self.subjectId = subjectId
        self.status = status
        self.sourceRef = sourceRef
    }
}

public enum FabricNode: Codable, Sendable, Equatable {
    case work(FabricWorkValue)
    case mission(FabricMissionValue)
    case task(FabricTaskValue)
    case receipt(FabricReceiptValue)
    case agent(FabricOpaqueValue)
    case skillCluster(FabricOpaqueValue)
    case run(FabricOpaqueValue)

    public var subjectId: String {
        switch self {
        case .work(let value): return value.workId
        case .mission(let value): return value.missionId
        case .task(let value): return value.taskId
        case .receipt(let value): return value.receiptId
        case .agent(let value), .skillCluster(let value), .run(let value): return value.subjectId
        }
    }

    /// Wire `kind` from mission-fabric.ts.
    public var kindName: String {
        switch self {
        case .work: return "work"
        case .mission: return "mission"
        case .task: return "task"
        case .receipt: return "receipt"
        case .agent: return "agent"
        case .skillCluster: return "skill-cluster"
        case .run: return "run"
        }
    }
}

public enum FabricDecodeError: Error, Equatable, Sendable {
    case malformed(String)
    case schema(String)
    case scope(String)
    case tenantMismatch(expected: String, actual: String)
    case capExceeded(String)
    case stale(String)
    case digest(String)
}

public enum CanonicalTimestamp {
    public static let pattern = #"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$"#

    public static func parse(_ value: String) -> Date? {
        guard value.range(of: pattern, options: .regularExpression) != nil else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: value)
    }

    public static func string(from date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}
