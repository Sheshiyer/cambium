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

        var joinReport: PortfolioJoinReport?
        if let join = body["portfolioJoinReport"] {
            do { joinReport = try decodeJoin(join) } catch let error as FabricDecodeError { return .failure(error) } catch { return .failure(.malformed("portfolioJoinReport")) }
        }

        let fullPlan = body["organUpdateDelivery"] != nil
        let summaryPlan = body["organUpdateDeliverySummary"] != nil
        if fullPlan && summaryPlan {
            return .failure(.malformed("organ delivery is both plan and summary"))
        }

        var truncated: [String] = []
        for gap in projection.gaps where gap.kind == "projection-truncated" {
            truncated.append(gap.gapId)
        }

        return .success(MissionFabricEnvelope(
            projection: projection,
            delivery: delivery,
            portfolioCatalogSummary: summary,
            portfolioJoinReport: joinReport,
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
        guard matches.count <= MissionFabricCaps.maxCollectionItems, orphans.count <= MissionFabricCaps.maxCollectionItems else { throw FabricDecodeError.capExceeded("portfolioJoinReport") }
        return PortfolioJoinReport(matchedCount: try int(object, "matchedCount"), catalogOrphanCount: try int(object, "catalogOrphanCount"), runtimeOrphanCount: try int(object, "runtimeOrphanCount"), runtimeIdentityCollisionCount: try int(object, "runtimeIdentityCollisionCount"), matches: matches, catalogOrphans: orphans, runtimeOrphans: runtime)
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

enum JSONValue: Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    static func parse(_ data: Data) throws -> JSONValue {
        let raw = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
        return try convert(raw)
    }

    static func from(foundation raw: Any) throws -> JSONValue {
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

    func canonical() -> String {
        switch self {
        case .null:
            return "null"
        case .bool(let value):
            return value ? "true" : "false"
        case .number(let value):
            if value.rounded() == value, value.magnitude < 1_000_000_000_000 {
                return String(Int(value))
            }
            return String(value)
        case .string(let value):
            return JSONValue.escaped(value)
        case .array(let values):
            return "[" + values.map { $0.canonical() }.joined(separator: ",") + "]"
        case .object(let values):
            let pairs = values.keys.sorted().map { key in
                JSONValue.escaped(key) + ":" + (values[key]?.canonical() ?? "null")
            }
            return "{" + pairs.joined(separator: ",") + "}"
        }
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
