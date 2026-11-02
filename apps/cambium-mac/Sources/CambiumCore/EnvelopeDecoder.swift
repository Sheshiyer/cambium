import CryptoKit
import Foundation
import CoreFoundation

public enum MissionFabricCaps {
    public static let maxNodes = 512
    public static let maxEdges = 1024
    public static let maxGaps = 128
    public static let maxDisplayChars = 512
    public static let maxCollectionItems = 256
    public static let clockSkewSeconds: TimeInterval = 120
    public static let maxAgeSeconds: TimeInterval = 24 * 60 * 60
}

public struct FabricDecodeContext: Sendable, Equatable {
    public var requested: ReaderScope
    public var now: Date
    public var acceptStale: Bool

    public init(requested: ReaderScope, now: Date, acceptStale: Bool = true) {
        self.requested = requested
        self.now = now
        self.acceptStale = acceptStale
    }
}

public enum MissionFabricDecoder {
    public static func decode(json: Data, context: FabricDecodeContext) -> Result<MissionFabricEnvelope, FabricDecodeError> {
        guard json.count <= 8_000_000 else { return .failure(.capExceeded("body")) }
        let root: JSONValue
        do {
            root = try JSONValue.parse(json)
        } catch {
            return .failure(.malformed("json"))
        }
        guard case .object(let body) = root else { return .failure(.malformed("body")) }
        if body["schema"] != nil {
            return .failure(.malformed("projection must be wrapped"))
        }
        guard let projectionValue = body["projection"] else { return .failure(.malformed("projection")) }
        guard let deliveryValue = body["delivery"] else { return .failure(.malformed("delivery")) }

        let projection: MissionFabricProjection
        do {
            projection = try decodeProjection(projectionValue, expectedTenant: context.requested.tenantId)
        } catch let error as FabricDecodeError {
            return .failure(error)
        } catch {
            return .failure(.malformed("projection"))
        }

        let delivery: DeliveryFreshness
        do {
            delivery = try decodeDelivery(deliveryValue, asOf: projection.asOf, now: context.now, acceptStale: context.acceptStale)
        } catch let error as FabricDecodeError {
            return .failure(error)
        } catch {
            return .failure(.malformed("delivery"))
        }

        var summary: PortfolioCatalogSummary?
        if let summaryValue = body["portfolioCatalogSummary"] {
            do {
                summary = try decodeSummary(summaryValue)
            } catch let error as FabricDecodeError {
                return .failure(error)
            } catch {
                return .failure(.malformed("portfolioCatalogSummary"))
            }
        }

        var catalog: JSONValue?
        if let catalogValue = body["portfolioCatalog"] {
            guard context.requested.tenantId == "cambium", context.requested.role == "founder" else {
                return .failure(.scope("portfolioCatalog requires founder role on cambium tenant"))
            }
            catalog = catalogValue
        }

        var joinReport: PortfolioJoinReport?
        if let joinValue = body["portfolioJoinReport"] {
            do {
                joinReport = try decodeJoin(joinValue)
            } catch let error as FabricDecodeError {
                return .failure(error)
            } catch {
                return .failure(.malformed("portfolioJoinReport"))
            }
        }

        let fullPlan = body["organUpdateDelivery"] != nil
        let summaryPlan = body["organUpdateDeliverySummary"] != nil
        if fullPlan && summaryPlan {
            return .failure(.malformed("organ delivery is both plan and summary"))
        }
        if fullPlan, context.requested.role != "founder" {
            return .failure(.scope("organUpdateDelivery requires founder role"))
        }

        do {
            try validateSidecars(
                body: body, projection: projection, delivery: delivery, summary: summary,
                joinReport: joinReport, requested: context.requested
            )
        } catch let error as FabricDecodeError {
            return .failure(error)
        } catch {
            return .failure(.malformed("sidecars"))
        }

        var truncated: [String] = []
        for gap in projection.gaps where gap.kind == "projection-truncated" {
            truncated.append(gap.gapId)
        }

        return .success(MissionFabricEnvelope(
            projection: projection,
            delivery: delivery,
            portfolioCatalogSummary: summary,
            portfolioCatalog: catalog,
            portfolioJoinReport: joinReport,
            organUpdateDelivery: body["organUpdateDelivery"],
            organUpdateDeliverySummary: body["organUpdateDeliverySummary"],
            organDeliveryPresent: fullPlan || summaryPlan,
            organDeliveryIsSummary: summaryPlan,
            truncated: truncated
        ))
    }

    public static func graphDigest(projectionJSON: Data) throws -> String {
        guard case .object(let object) = try JSONValue.parse(projectionJSON) else {
            throw FabricDecodeError.malformed("projection")
        }
        return try rawContentDigest(object)
    }

    static func sha256Digest(_ value: JSONValue) -> String {
        let digest = SHA256.hash(data: Data(value.canonical().utf8))
        return "sha256:" + digest.map { String(format: "%02x", $0) }.joined()
    }

    /// Server shape (handler.ts): Portfolio sidecars exist only for `cambium`.
    /// Founder detail = catalog + join + full organ plan; otherwise summary-only.
    /// Digest checks prove content integrity only. They do not prove freshness or signature.
    private static func validateSidecars(
        body: [String: JSONValue],
        projection: MissionFabricProjection,
        delivery: DeliveryFreshness,
        summary: PortfolioCatalogSummary?,
        joinReport: PortfolioJoinReport?,
        requested: ReaderScope
    ) throws {
        let hasDetail = body["portfolioCatalog"] != nil
        let hasJoin = body["portfolioJoinReport"] != nil
        let hasPlan = body["organUpdateDelivery"] != nil
        let hasPlanSummary = body["organUpdateDeliverySummary"] != nil

        guard let summary else {
            guard !hasDetail, !hasJoin, !hasPlan, !hasPlanSummary, delivery.portfolioPairDigest == nil else {
                throw FabricDecodeError.malformed("portfolio sidecars require portfolioCatalogSummary")
            }
            return
        }
        guard projection.tenantId == "cambium" else { throw FabricDecodeError.scope("portfolio sidecars are cambium-only") }
        guard hasDetail == hasJoin, hasDetail == hasPlan, hasDetail != hasPlanSummary else {
            throw FabricDecodeError.malformed("inconsistent founder detail versus summary sidecars")
        }

        guard let pair = delivery.portfolioPairDigest else { throw FabricDecodeError.digest("portfolioPairDigest missing") }
        let expectedPair = sha256Digest(.object([
            "graphDigest": .string(projection.graphDigest),
            "catalogDigest": .string(summary.actionCatalogDigest),
        ]))
        guard pair == expectedPair else { throw FabricDecodeError.digest("portfolioPairDigest") }

        if hasDetail, case .object(var catalog)? = body["portfolioCatalog"] {
            guard case .string(let served)? = catalog.removeValue(forKey: "catalogDigest"),
                  served == summary.catalogDigest,
                  sha256Digest(.object(catalog)) == served else { throw FabricDecodeError.digest("portfolioCatalog") }
            guard case .string(summary.schema)? = catalog["schema"],
                  case .string(summary.status)? = catalog["status"],
                  case .bool(true)? = catalog["readOnly"],
                  case .string(summary.classificationDigest)? = catalog["classificationDigest"] else {
                throw FabricDecodeError.schema("portfolioCatalog")
            }
            guard case .object(let detailSummary)? = catalog["summary"] else { throw FabricDecodeError.malformed("portfolioCatalog.summary") }
            let counts: [(String, Int)] = [
                ("total", summary.total), ("saplings", summary.saplings), ("clientBranches", summary.clientBranches),
                ("internalPrograms", summary.internalPrograms), ("classificationReview", summary.classificationReview),
                ("historicalProducts", summary.historicalProducts), ("operationalGaps", summary.operationalGaps),
            ]
            for (key, expected) in counts {
                guard try int(detailSummary, key) == expected else { throw FabricDecodeError.malformed("portfolioCatalog.summary.\(key)") }
            }
            guard case .array(let records)? = catalog["records"], records.count == summary.total,
                  records.count <= MissionFabricCaps.maxCollectionItems else { throw FabricDecodeError.malformed("portfolioCatalog.records") }
            var recordIds = Set<String>()
            for record in records {
                guard case .object(let row) = record, recordIds.insert(try string(row, "workId")).inserted else {
                    throw FabricDecodeError.malformed("portfolioCatalog duplicate workId")
                }
            }
            guard case .object(let actionAuthority)? = catalog["actionAuthority"],
                  case .string(summary.actionCatalogDigest)? = actionAuthority["catalogDigest"],
                  case .string("none")? = actionAuthority["admission"] else {
                throw FabricDecodeError.schema("portfolioCatalog.actionAuthority")
            }
        } else if hasDetail {
            throw FabricDecodeError.malformed("portfolioCatalog")
        }

        if let joinReport {
            let workIds = Set(projection.nodes.compactMap { node -> String? in
                if case .work(let value) = node { return value.workId }
                return nil
            })
            for match in joinReport.matches where !workIds.contains(match.runtimeWorkId) {
                throw FabricDecodeError.malformed("join match \(match.runtimeWorkId) has no work node")
            }
            for orphan in joinReport.runtimeOrphans where !workIds.contains(orphan) {
                throw FabricDecodeError.malformed("runtime orphan \(orphan) has no work node")
            }
            let matched = Set(joinReport.matches.map(\.canonicalId))
            guard matched.count == joinReport.matches.count,
                  matched.isDisjoint(with: joinReport.catalogOrphans) else {
                throw FabricDecodeError.malformed("join match identity")
            }
        }

        if hasPlan {
            guard case .object(var plan)? = body["organUpdateDelivery"] else { throw FabricDecodeError.malformed("organUpdateDelivery") }
            guard case .string(let planDigest)? = plan.removeValue(forKey: "planDigest"),
                  sha256Digest(.object(plan)) == planDigest else { throw FabricDecodeError.digest("organUpdateDelivery.planDigest") }
            guard case .string("cambium.organ-update-plan.v1")? = plan["schema"],
                  case .bool(true)? = plan["readOnly"], case .bool(true)? = plan["eventDriven"],
                  case .bool(false)? = plan["scheduleArmed"],
                  case .array(let active)? = plan["activeDeliveries"], active.count <= 20,
                  case .array(let workflows)? = plan["workflows"], workflows.count <= MissionFabricCaps.maxCollectionItems else {
                throw FabricDecodeError.schema("organUpdateDelivery")
            }
        }
        if hasPlanSummary {
            guard case .object(let planSummary)? = body["organUpdateDeliverySummary"],
                  case .string("cambium.organ-update-delivery-summary.v1")? = planSummary["schema"],
                  case .bool(true)? = planSummary["readOnly"], case .bool(true)? = planSummary["eventDriven"],
                  case .bool(false)? = planSummary["scheduleArmed"] else {
                throw FabricDecodeError.schema("organUpdateDeliverySummary")
            }
            _ = try digest(planSummary, "planDigest")
            for key in ["workflowCount", "defaultTopicCount", "escalationTopicCount", "approvalRequiredWorkflowCount"] {
                _ = try int(planSummary, key)
            }
        }
    }

    /// Subject identity is `kind:id`, matching `fabricIdentityOf` in handler.ts.
    /// Edge endpoints must resolve to a served node, except `pins-loadout`, whose
    /// target is a loadout identity that the projection does not carry as a node.
    private static func validateGraphIdentity(nodes: [FabricNode], edges: [FabricEdge]) throws {
        var identities = Set<String>()
        var subjects = Set<String>()
        for node in nodes {
            guard identities.insert("\(node.kindName):\(node.subjectId)").inserted else {
                throw FabricDecodeError.malformed("duplicate node subject \(node.kindName):\(node.subjectId)")
            }
            subjects.insert(node.subjectId)
        }
        for edge in edges {
            guard subjects.contains(edge.fromId) else { throw FabricDecodeError.malformed("edge \(edge.kind) fromId \(edge.fromId) unresolved") }
            if edge.kind != "pins-loadout", !subjects.contains(edge.toId) {
                throw FabricDecodeError.malformed("edge \(edge.kind) toId \(edge.toId) unresolved")
            }
        }
    }

    static func rawContentDigest(_ object: [String: JSONValue]) throws -> String {
        var content: [String: JSONValue] = [:]
        for key in ["projectionVersion", "tenantId", "graphVersion", "sourceOfTruth", "readOnly", "nodes", "edges", "gaps"] {
            guard let value = object[key] else { throw FabricDecodeError.malformed(key) }
            content[key] = value
        }
        let digest = SHA256.hash(data: Data(JSONValue.object(content).canonical().utf8))
        return "sha256:" + digest.map { String(format: "%02x", $0) }.joined()
    }

    public static func observations(from envelope: MissionFabricEnvelope, requested: ReaderScope) -> [Observation] {
        var rows: [Observation] = []
        for node in envelope.projection.nodes {
            rows.append(Observation(
                id: "fabric:\(node.subjectId)",
                kind: .work,
                producer: "mission-fabric",
                schema: MissionFabricProjection.schemaName,
                subjectId: node.subjectId,
                sourceTime: envelope.projection.asOf,
                observedAt: envelope.delivery.servedAt,
                provenance: envelope.projection.graphDigest
            ))
        }
        for gap in envelope.projection.gaps {
            rows.append(Observation(
                id: "gap:\(gap.gapId)",
                kind: .gap,
                producer: "mission-fabric",
                schema: MissionFabricProjection.schemaName,
                subjectId: gap.subjectId ?? gap.gapId,
                sourceTime: envelope.projection.asOf,
                observedAt: envelope.delivery.servedAt,
                provenance: envelope.projection.graphDigest,
                unavailableReason: gap.detail
            ))
        }
        if envelope.delivery.freshness != .fresh {
            rows.append(Observation(
                id: "freshness:\(requested.tenantId)",
                kind: .connection,
                producer: "mission-fabric-delivery",
                schema: "delivery",
                subjectId: requested.tenantId,
                observedAt: envelope.delivery.servedAt,
                provenance: "delivery.freshness",
                unavailableReason: envelope.delivery.freshness.rawValue
            ))
        }
        return rows
    }

    public static func snapshot(from envelope: MissionFabricEnvelope) -> SystemSnapshot {
        let work = envelope.projection.nodes.compactMap { node -> WorkObject? in
            guard case .work(let value) = node else { return nil }
            return WorkObject(
                id: value.workId,
                name: value.name,
                kind: value.nodeKind,
                summary: value.desiredState,
                objective: value.desiredState,
                currentState: value.currentState,
                nextStep: value.nextAction ?? "No next action was served.",
                attention: value.status
            )
        }
        let connections = [
            ConnectionObservation(
                id: "mission-fabric:\(envelope.projection.tenantId)",
                name: "Mission Fabric",
                owner: "quests-worker",
                status: envelope.delivery.freshness.rawValue,
                detail: "Read-only projection \(envelope.projection.graphVersion).",
                observedAt: envelope.delivery.servedAt
            )
        ]
        return SystemSnapshot(
            work: work,
            connections: connections,
            asOf: envelope.projection.asOf,
            sourceKind: "mission-fabric",
            gaps: envelope.projection.gaps.map(\.gapId) + envelope.truncated
        )
    }

    private static func decodeProjection(_ value: JSONValue, expectedTenant: String) throws -> MissionFabricProjection {
        guard case .object(let object) = value else { throw FabricDecodeError.malformed("projection") }
        let schema = try string(object, "schema")
        guard schema == MissionFabricProjection.schemaName else { throw FabricDecodeError.schema(schema) }
        let version = try int(object, "projectionVersion")
        guard version == 1 else { throw FabricDecodeError.schema("projectionVersion") }
        let tenant = try string(object, "tenantId")
        guard tenant == expectedTenant else { throw FabricDecodeError.tenantMismatch(expected: expectedTenant, actual: tenant) }
        let graphVersion = try int(object, "graphVersion")
        guard graphVersion >= 0 else { throw FabricDecodeError.malformed("graphVersion") }
        let graphDigest = try string(object, "graphDigest")
        guard graphDigest.hasPrefix("sha256:"), graphDigest.count == "sha256:".count + 64 else {
            throw FabricDecodeError.digest("graphDigest")
        }
        let generatedAt = try timestamp(object, "generatedAt")
        let asOf = try timestamp(object, "asOf")
        let source = try string(object, "sourceOfTruth")
        guard source == "d1-goal-graph" else { throw FabricDecodeError.schema("sourceOfTruth") }
        guard case .bool(let readOnly) = object["readOnly"], readOnly else {
            throw FabricDecodeError.schema("readOnly")
        }
        guard case .array(let nodeValues) = object["nodes"] else { throw FabricDecodeError.malformed("nodes") }
        guard case .array(let edgeValues) = object["edges"] else { throw FabricDecodeError.malformed("edges") }
        guard case .array(let gapValues) = object["gaps"] else { throw FabricDecodeError.malformed("gaps") }
        guard nodeValues.count <= MissionFabricCaps.maxNodes else { throw FabricDecodeError.capExceeded("nodes") }
        guard edgeValues.count <= MissionFabricCaps.maxEdges else { throw FabricDecodeError.capExceeded("edges") }
        guard gapValues.count <= MissionFabricCaps.maxGaps else { throw FabricDecodeError.capExceeded("gaps") }

        let nodes = try nodeValues.map { try decodeNode($0, expectedTenant: expectedTenant) }
        let edges = try edgeValues.map(decodeEdge)
        let gaps = try gapValues.map(decodeGap)
        try validateGraphIdentity(nodes: nodes, edges: edges)
        let projection = MissionFabricProjection(
            schema: schema,
            projectionVersion: version,
            tenantId: tenant,
            graphVersion: graphVersion,
            graphDigest: graphDigest,
            generatedAt: generatedAt,
            asOf: asOf,
            sourceOfTruth: source,
            readOnly: readOnly,
            nodes: nodes,
            edges: edges,
            gaps: gaps
        )
        let recomputed = try rawContentDigest(object)
        guard recomputed == graphDigest else {
            throw FabricDecodeError.digest("recomputed \(recomputed)")
        }
        return projection
    }

    private static func decodeNode(_ value: JSONValue, expectedTenant: String) throws -> FabricNode {
        guard case .object(let object) = value else { throw FabricDecodeError.malformed("node") }
        let kind = try string(object, "kind")
        guard case .object(let body) = object["value"] else { throw FabricDecodeError.malformed("node.value") }
        switch kind {
        case "work":
            let workTenant = try string(body, "tenantId")
            guard workTenant == expectedTenant else { throw FabricDecodeError.tenantMismatch(expected: expectedTenant, actual: workTenant) }
            return .work(FabricWorkValue(
                workId: try string(body, "workId"),
                tenantId: workTenant,
                name: try bounded(try string(body, "name")),
                desiredState: try optionalString(body, "desiredState") ?? "",
                currentState: try bounded(try string(body, "currentState")),
                status: try string(body, "status"),
                ownerId: try string(body, "ownerId"),
                nextAction: try optionalString(body, "nextAction").map { try bounded($0) },
                sourceRef: try string(body, "sourceRef"),
                sourceDigest: try string(body, "sourceDigest"),
                nodeKind: try string(body, "kind")
            ))
        case "mission":
            return .mission(FabricMissionValue(
                missionId: try string(body, "missionId"),
                workId: try string(body, "workId"),
                title: try bounded(try string(body, "title")),
                objective: try bounded(try string(body, "objective")),
                status: try string(body, "status"),
                taskIds: try stringArray(body, "taskIds"),
                sourceRef: try string(body, "sourceRef")
            ))
        case "task":
            return .task(FabricTaskValue(
                taskId: try string(body, "taskId"),
                missionId: try optionalString(body, "missionId"),
                desiredState: try optionalString(body, "desiredState"),
                status: try string(body, "status"),
                dependencyIds: try stringArray(body, "dependencyIds"),
                pinnedLoadoutId: try optionalString(body, "pinnedLoadoutId")
            ))
        case "receipt":
            return .receipt(FabricReceiptValue(
                receiptId: try string(body, "receiptId"),
                runId: try string(body, "runId"),
                taskId: try string(body, "taskId"),
                status: try string(body, "status"),
                inputDigest: try string(body, "inputDigest"),
                outputDigest: try optionalString(body, "outputDigest"),
                evidenceRefs: try stringArray(body, "evidenceRefs")
            ))
        case "agent":
            return .agent(FabricOpaqueValue(
                subjectId: try string(body, "agentId"),
                status: try string(body, "status"),
                sourceRef: try optionalString(body, "sourceRef")
            ))
        case "skill-cluster":
            return .skillCluster(FabricOpaqueValue(
                subjectId: try string(body, "clusterId"),
                status: try string(body, "status"),
                sourceRef: try optionalString(body, "sourceRef")
            ))
        case "run":
            return .run(FabricOpaqueValue(
                subjectId: try string(body, "runId"),
                status: try string(body, "status"),
                sourceRef: try optionalString(body, "sourceRef")
            ))
        default:
            throw FabricDecodeError.schema("node.kind")
        }
    }

    private static func stringArray(_ object: [String: JSONValue], _ key: String) throws -> [String] {
        guard case .array(let values) = object[key] else { return [] }
        return try values.map { value in
            guard case .string(let s) = value else { throw FabricDecodeError.malformed(key) }
            return s
        }
    }

    private static func decodeEdge(_ value: JSONValue) throws -> FabricEdge {
        guard case .object(let object) = value else { throw FabricDecodeError.malformed("edge") }
        let kind = try string(object, "kind")
        let allowed = ["contains", "depends-on", "assigned-to", "requires-cluster", "pins-loadout", "executes", "produces", "proves", "informs-next-intent"]
        guard allowed.contains(kind) else { throw FabricDecodeError.schema("edge.kind") }
        return FabricEdge(kind: kind, fromId: try string(object, "fromId"), toId: try string(object, "toId"))
    }

    private static func decodeGap(_ value: JSONValue) throws -> FabricGap {
        guard case .object(let object) = value else { throw FabricDecodeError.malformed("gap") }
        return FabricGap(
            gapId: try string(object, "gapId"),
            kind: try string(object, "kind"),
            subjectId: try optionalString(object, "subjectId"),
            detail: try bounded(try string(object, "detail")),
            evidenceRef: try optionalString(object, "evidenceRef")
        )
    }

    private static func decodeDelivery(_ value: JSONValue, asOf: String, now: Date, acceptStale: Bool) throws -> DeliveryFreshness {
        guard case .object(let object) = value else { throw FabricDecodeError.malformed("delivery") }
        let servedAt = try timestamp(object, "servedAt")
        guard let served = CanonicalTimestamp.parse(servedAt), let content = CanonicalTimestamp.parse(asOf) else {
            throw FabricDecodeError.malformed("timestamp")
        }
        if served.timeIntervalSince(now) > MissionFabricCaps.clockSkewSeconds {
            throw FabricDecodeError.stale("servedAt is in the future")
        }
        if now.timeIntervalSince(served) > MissionFabricCaps.maxAgeSeconds {
            throw FabricDecodeError.stale("servedAt is too old")
        }
        let label = try string(object, "freshness")
        let freshness: Freshness
        switch label {
        case "fresh": freshness = .fresh
        case "stale": freshness = .stale
        default: throw FabricDecodeError.schema("freshness")
        }
        if freshness == .stale && !acceptStale {
            throw FabricDecodeError.stale("delivery.freshness")
        }
        if content.timeIntervalSince(served) > MissionFabricCaps.clockSkewSeconds {
            throw FabricDecodeError.stale("asOf is after servedAt")
        }
        return DeliveryFreshness(
            servedAt: servedAt,
            freshness: freshness,
            portfolioPairDigest: try optionalString(object, "portfolioPairDigest")
        )
    }

    private static func decodeSummary(_ value: JSONValue) throws -> PortfolioCatalogSummary {
        guard case .object(let object) = value else { throw FabricDecodeError.malformed("portfolioCatalogSummary") }
        let schema = try string(object, "schema")
        guard schema == "cambium.portfolio-display-catalog.v1" else { throw FabricDecodeError.schema(schema) }
        let status = try string(object, "status")
        guard status == "render-and-proposal-only" else { throw FabricDecodeError.schema("portfolioStatus") }
        guard try bool(object, "readOnly") else { throw FabricDecodeError.schema("portfolioReadOnly") }
        guard try string(object, "actionAdmission") == "none" else { throw FabricDecodeError.schema("actionAdmission") }
        return PortfolioCatalogSummary(
            total: try int(object, "total"), saplings: try int(object, "saplings"), clientBranches: try int(object, "clientBranches"),
            internalPrograms: try int(object, "internalPrograms"), classificationReview: try int(object, "classificationReview"),
            historicalProducts: try int(object, "historicalProducts"), operationalGaps: try int(object, "operationalGaps"),
            schema: schema, version: try int(object, "version"), status: status, readOnly: true,
            classificationDigest: try hexDigest(object, "classificationDigest"), catalogDigest: try digest(object, "catalogDigest"),
            actionClassificationDigest: try hexDigest(object, "actionClassificationDigest"), actionCatalogDigest: try digest(object, "actionCatalogDigest"),
            actionAdmission: "none"
        )
    }

    private static func decodeJoin(_ value: JSONValue) throws -> PortfolioJoinReport {
        guard case .object(let object) = value else { throw FabricDecodeError.malformed("portfolioJoinReport") }
        let matches = try objectArray(object, "matches").map { row -> PortfolioJoinMatch in
            guard case .object(let item) = row else { throw FabricDecodeError.malformed("matches") }
            return PortfolioJoinMatch(canonicalId: try string(item, "canonicalId"), runtimeWorkId: try string(item, "runtimeWorkId"))
        }
        let orphans = try stringArray(object, "catalogOrphans")
        let runtime = try stringArray(object, "runtimeOrphans")
        let collisions = try objectArray(object, "runtimeIdentityCollisions").map { row -> PortfolioRuntimeIdentityCollision in
            guard case .object(let item) = row else { throw FabricDecodeError.malformed("runtimeIdentityCollisions") }
            return PortfolioRuntimeIdentityCollision(workId: try string(item, "workId"), occurrences: try int(item, "occurrences"))
        }
        guard matches.count <= MissionFabricCaps.maxCollectionItems, orphans.count <= MissionFabricCaps.maxCollectionItems else { throw FabricDecodeError.capExceeded("portfolioJoinReport") }
        let matchedCount = try int(object, "matchedCount")
        let catalogOrphanCount = try int(object, "catalogOrphanCount")
        let runtimeOrphanCount = try int(object, "runtimeOrphanCount")
        let runtimeIdentityCollisionCount = try int(object, "runtimeIdentityCollisionCount")
        guard matchedCount == matches.count, catalogOrphanCount == orphans.count, runtimeOrphanCount == runtime.count, runtimeIdentityCollisionCount == collisions.count else {
            throw FabricDecodeError.malformed("portfolioJoinReport counts do not match collection lengths")
        }
        return PortfolioJoinReport(
            matchedCount: matchedCount,
            catalogOrphanCount: catalogOrphanCount,
            runtimeOrphanCount: runtimeOrphanCount,
            runtimeIdentityCollisionCount: runtimeIdentityCollisionCount,
            matches: matches,
            catalogOrphans: orphans,
            runtimeOrphans: runtime,
            runtimeIdentityCollisions: collisions
        )
    }

    private static func objectArray(_ object: [String: JSONValue], _ key: String) throws -> [JSONValue] {
        guard case .array(let values) = object[key] else { throw FabricDecodeError.malformed(key) }
        return values
    }

    private static func hexDigest(_ object: [String: JSONValue], _ key: String) throws -> String {
        let value = try string(object, key)
        guard value.count == 64, value.allSatisfy({ $0.isHexDigit }) else { throw FabricDecodeError.digest(key) }
        return value
    }

    private static func string(_ object: [String: JSONValue], _ key: String) throws -> String {
        guard case .string(let value) = object[key], !value.isEmpty, value.count <= 2048 else {
            throw FabricDecodeError.malformed(key)
        }
        return value
    }

    private static func optionalString(_ object: [String: JSONValue], _ key: String) throws -> String? {
        guard let value = object[key] else { return nil }
        if case .null = value { return nil }
        guard case .string(let text) = value, text.count <= 2048 else { throw FabricDecodeError.malformed(key) }
        return text.isEmpty ? nil : text
    }

    private static func int(_ object: [String: JSONValue], _ key: String) throws -> Int {
        guard case .number(let value) = object[key], value.rounded() == value, value >= 0, value < 1_000_000_000 else {
            throw FabricDecodeError.malformed(key)
        }
        return Int(value)
    }

    private static func bool(_ object: [String: JSONValue], _ key: String) throws -> Bool {
        guard case .bool(let value) = object[key] else { throw FabricDecodeError.malformed(key) }
        return value
    }

    private static func timestamp(_ object: [String: JSONValue], _ key: String) throws -> String {
        let value = try string(object, key)
        guard CanonicalTimestamp.parse(value) != nil else { throw FabricDecodeError.malformed(key) }
        return value
    }

    private static func digest(_ object: [String: JSONValue], _ key: String) throws -> String {
        let value = try string(object, key)
        guard value.hasPrefix("sha256:"), value.count == "sha256:".count + 64 else { throw FabricDecodeError.digest(key) }
        return value
    }

    private static func bounded(_ value: String) throws -> String {
        guard value.count <= MissionFabricCaps.maxDisplayChars else { throw FabricDecodeError.capExceeded("display") }
        return value
    }
}

struct StrictJSONParser {
    static let maxDepth = 64
    let bytes: [UInt8]
    var index = 0

    init(bytes: [UInt8]) { self.bytes = bytes }

    mutating func parseDocument() throws -> JSONValue {
        skipWhitespace()
        let value = try parseValue(depth: 0)
        skipWhitespace()
        guard index == bytes.count else { throw FabricDecodeError.malformed("json") }
        return value
    }

    private mutating func skipWhitespace() {
        while index < bytes.count, [0x20, 0x09, 0x0A, 0x0D].contains(bytes[index]) { index += 1 }
    }

    private mutating func expect(_ literal: String) throws {
        for byte in literal.utf8 {
            guard index < bytes.count, bytes[index] == byte else { throw FabricDecodeError.malformed("json") }
            index += 1
        }
    }

    private mutating func parseValue(depth: Int) throws -> JSONValue {
        guard depth <= Self.maxDepth else { throw FabricDecodeError.capExceeded("json depth") }
        guard index < bytes.count else { throw FabricDecodeError.malformed("json") }
        switch bytes[index] {
        case UInt8(ascii: "{"): return try parseObject(depth: depth)
        case UInt8(ascii: "["): return try parseArray(depth: depth)
        case UInt8(ascii: "\""): return .string(try parseString())
        case UInt8(ascii: "t"): try expect("true"); return .bool(true)
        case UInt8(ascii: "f"): try expect("false"); return .bool(false)
        case UInt8(ascii: "n"): try expect("null"); return .null
        default: return .number(try parseNumber())
        }
    }

    private mutating func parseObject(depth: Int) throws -> JSONValue {
        index += 1
        var object: [String: JSONValue] = [:]
        skipWhitespace()
        if index < bytes.count, bytes[index] == UInt8(ascii: "}") { index += 1; return .object(object) }
        while true {
            skipWhitespace()
            guard index < bytes.count, bytes[index] == UInt8(ascii: "\"") else { throw FabricDecodeError.malformed("json key") }
            let key = try parseString()
            skipWhitespace()
            try expect(":")
            skipWhitespace()
            let value = try parseValue(depth: depth + 1)
            guard object[key] == nil else { throw FabricDecodeError.malformed("duplicate or canonically equivalent key") }
            object[key] = value
            skipWhitespace()
            guard index < bytes.count else { throw FabricDecodeError.malformed("json") }
            if bytes[index] == UInt8(ascii: ",") { index += 1; continue }
            if bytes[index] == UInt8(ascii: "}") { index += 1; return .object(object) }
            throw FabricDecodeError.malformed("json")
        }
    }

    private mutating func parseArray(depth: Int) throws -> JSONValue {
        index += 1
        var values: [JSONValue] = []
        skipWhitespace()
        if index < bytes.count, bytes[index] == UInt8(ascii: "]") { index += 1; return .array(values) }
        while true {
            skipWhitespace()
            values.append(try parseValue(depth: depth + 1))
            skipWhitespace()
            guard index < bytes.count else { throw FabricDecodeError.malformed("json") }
            if bytes[index] == UInt8(ascii: ",") { index += 1; continue }
            if bytes[index] == UInt8(ascii: "]") { index += 1; return .array(values) }
            throw FabricDecodeError.malformed("json")
        }
    }

    private mutating func parseHex4() throws -> UInt16 {
        guard index + 4 <= bytes.count, let text = String(bytes: bytes[index..<index + 4], encoding: .ascii),
              let value = UInt16(text, radix: 16) else { throw FabricDecodeError.malformed("json escape") }
        index += 4
        return value
    }

    private mutating func parseString() throws -> String {
        index += 1
        var units: [UInt16] = []
        var raw: [UInt8] = []
        func flushRaw() throws {
            guard !raw.isEmpty else { return }
            guard let text = String(bytes: raw, encoding: .utf8) else { throw FabricDecodeError.malformed("json utf8") }
            units.append(contentsOf: text.utf16)
            raw.removeAll()
        }
        while true {
            guard index < bytes.count else { throw FabricDecodeError.malformed("json string") }
            let byte = bytes[index]
            if byte == UInt8(ascii: "\"") {
                index += 1
                try flushRaw()
                // Lone surrogates are not representable in a Swift String; fail closed.
                guard let text = String(utf16CodeUnits: units, count: units.count) as String?,
                      Array(text.utf16) == units else { throw FabricDecodeError.malformed("json surrogate") }
                return text
            }
            guard byte >= 0x20 else { throw FabricDecodeError.malformed("json control") }
            if byte == UInt8(ascii: "\\") {
                try flushRaw()
                index += 1
                guard index < bytes.count else { throw FabricDecodeError.malformed("json escape") }
                let escape = bytes[index]
                index += 1
                switch escape {
                case UInt8(ascii: "\""): units.append(0x22)
                case UInt8(ascii: "\\"): units.append(0x5C)
                case UInt8(ascii: "/"): units.append(0x2F)
                case UInt8(ascii: "b"): units.append(0x08)
                case UInt8(ascii: "f"): units.append(0x0C)
                case UInt8(ascii: "n"): units.append(0x0A)
                case UInt8(ascii: "r"): units.append(0x0D)
                case UInt8(ascii: "t"): units.append(0x09)
                case UInt8(ascii: "u"): units.append(try parseHex4())
                default: throw FabricDecodeError.malformed("json escape")
                }
                continue
            }
            raw.append(byte)
            index += 1
        }
    }

    private mutating func parseNumber() throws -> Double {
        let start = index
        func digits() -> Int {
            let begin = index
            while index < bytes.count, (0x30...0x39).contains(bytes[index]) { index += 1 }
            return index - begin
        }
        if index < bytes.count, bytes[index] == UInt8(ascii: "-") { index += 1 }
        guard index < bytes.count else { throw FabricDecodeError.malformed("json number") }
        if bytes[index] == UInt8(ascii: "0") {
            index += 1
        } else {
            guard digits() > 0 else { throw FabricDecodeError.malformed("json number") }
        }
        if index < bytes.count, bytes[index] == UInt8(ascii: ".") {
            index += 1
            guard digits() > 0 else { throw FabricDecodeError.malformed("json number") }
        }
        if index < bytes.count, bytes[index] == UInt8(ascii: "e") || bytes[index] == UInt8(ascii: "E") {
            index += 1
            if index < bytes.count, bytes[index] == UInt8(ascii: "+") || bytes[index] == UInt8(ascii: "-") { index += 1 }
            guard digits() > 0 else { throw FabricDecodeError.malformed("json number") }
        }
        guard let text = String(bytes: bytes[start..<index], encoding: .ascii),
              let value = Double(text), value.isFinite else { throw FabricDecodeError.malformed("json number") }
        return value
    }
}

public enum JSONValue: Codable, Sendable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let b = try? container.decode(Bool.self) {
            self = .bool(b)
        } else if let n = try? container.decode(Double.self) {
            self = .number(n)
        } else if let s = try? container.decode(String.self) {
            self = .string(s)
        } else if let a = try? container.decode([JSONValue].self) {
            self = .array(a)
        } else if let o = try? container.decode([String: JSONValue].self) {
            self = .object(o)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid JSONValue")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let b): try container.encode(b)
        case .number(let n): try container.encode(n)
        case .string(let s): try container.encode(s)
        case .array(let a): try container.encode(a)
        case .object(let o): try container.encode(o)
        }
    }

    /// Strict RFC 8259 parse. Numbers become IEEE doubles from their exact text,
    /// matching `JSON.parse`. Foundation would route large integers through
    /// NSDecimalNumber and round them differently. Keys that Swift `String`
    /// treats as equal (canonical equivalence) fail closed instead of collapsing.
    public static func parse(_ data: Data) throws -> JSONValue {
        var parser = StrictJSONParser(bytes: [UInt8](data))
        return try parser.parseDocument()
    }

    public static func from(foundation raw: Any) throws -> JSONValue {
        try convert(raw)
    }

    private static func convert(_ raw: Any) throws -> JSONValue {
        switch raw {
        case is NSNull:
            return .null
        case let value as NSNumber:
            if CFGetTypeID(value as CFTypeRef) == CFBooleanGetTypeID() {
                return .bool(value.boolValue)
            }
            let number = value.doubleValue
            guard number.isFinite else { throw FabricDecodeError.malformed("number") }
            return .number(number)
        case let value as Bool:
            return .bool(value)
        case let value as String:
            return .string(value)
        case let value as [Any]:
            return .array(try value.map(convert))
        case let value as [String: Any]:
            var object: [String: JSONValue] = [:]
            for (key, item) in value {
                object[key] = try convert(item)
            }
            return .object(object)
        default:
            throw FabricDecodeError.malformed("json")
        }
    }

    public func canonical() -> String {
        switch self {
        case .null:
            return "null"
        case .bool(let value):
            return value ? "true" : "false"
        case .number(let value):
            return JSONValue.ecmaNumber(value)
        case .string(let value):
            return JSONValue.escaped(value)
        case .array(let values):
            return "[" + values.map { $0.canonical() }.joined(separator: ",") + "]"
        case .object(let values):
            let sortedKeys = values.keys.sorted { lhs, rhs in
                let lutf16 = Array(lhs.utf16)
                let rutf16 = Array(rhs.utf16)
                for i in 0..<min(lutf16.count, rutf16.count) {
                    if lutf16[i] != rutf16[i] { return lutf16[i] < rutf16[i] }
                }
                return lutf16.count < rutf16.count
            }
            let pairs = sortedKeys.map { key in
                JSONValue.escaped(key) + ":" + (values[key]?.canonical() ?? "null")
            }
            return "{" + pairs.joined(separator: ",") + "}"
        }
    }

    /// ECMAScript `Number.prototype.toString`: shortest round-trip digits, with
    /// plain notation for decimal exponents in [-7, 21) and `e±` otherwise.
    static func ecmaNumber(_ value: Double) -> String {
        if value == 0 { return "0" }
        let sign = value < 0 ? "-" : ""
        // Swift's description is shortest round-trip; reduce it to digits and exponent.
        let text = String(value.magnitude)
        var mantissa = text
        var exponent = 0
        if let eIndex = text.firstIndex(where: { $0 == "e" || $0 == "E" }) {
            mantissa = String(text[..<eIndex])
            exponent = Int(text[text.index(after: eIndex)...]) ?? 0
        }
        var digits = mantissa.replacingOccurrences(of: ".", with: "")
        let dot = mantissa.firstIndex(of: ".").map { mantissa.distance(from: mantissa.startIndex, to: $0) } ?? mantissa.count
        var pointPos = dot + exponent
        while digits.hasPrefix("0") && digits.count > 1 {
            digits.removeFirst()
            pointPos -= 1
        }
        while digits.hasSuffix("0") && digits.count > 1 {
            digits.removeLast()
        }
        let k = digits.count
        let n = pointPos
        if k <= n && n <= 21 {
            return sign + digits + String(repeating: "0", count: n - k)
        }
        if 0 < n && n <= 21 {
            let i = digits.index(digits.startIndex, offsetBy: n)
            return sign + digits[..<i] + "." + digits[i...]
        }
        if -6 < n && n <= 0 {
            return sign + "0." + String(repeating: "0", count: -n) + digits
        }
        let e = n - 1
        let eSign = e >= 0 ? "+" : "-"
        let head = k == 1 ? digits : String(digits.prefix(1)) + "." + String(digits.dropFirst())
        return sign + head + "e" + eSign + String(abs(e))
    }

    private static func escaped(_ value: String) -> String {
        var out = "\""
        for scalar in value.unicodeScalars {
            switch scalar {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\t": out += "\\t"
            case "\u{08}": out += "\\b"
            case "\u{0C}": out += "\\f"
            default:
                if scalar.value < 0x20 {
                    out += String(format: "\\u%04x", scalar.value)
                } else {
                    out.unicodeScalars.append(scalar)
                }
            }
        }
        out += "\""
        return out
    }
}
