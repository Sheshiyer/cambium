import CryptoKit
import Foundation

public enum FounderDecisionChoice: String, Codable, Sendable, Equatable {
    case approved
    case rejected
}

public struct GateReviewTuple: Codable, Sendable, Equatable {
    public var proposalId: String
    public var tenantId: String
    public var version: Int
    public var changeDigest: String
    public var nonce: String
    public var expiresAt: String
    public var summary: String
    public var reviewJSON: String
    public var approveConfirmation: String
    public var rejectConfirmation: String

    public func confirmation(for choice: FounderDecisionChoice) -> String {
        choice == .approved ? approveConfirmation : rejectConfirmation
    }
}

/// A review is pinned to the verified founder that fetched it. Another founder in
/// the same tenant cannot submit or renew it.
public struct GateReview: Sendable, Equatable {
    public let tuple: GateReviewTuple
    public let fetchedAt: Date
    public let principal: String

    init(tuple: GateReviewTuple, fetchedAt: Date, principal: String) {
        self.tuple = tuple
        self.fetchedAt = fetchedAt
        self.principal = principal
    }
}

public struct GateReceipt: Codable, Sendable, Equatable {
    public var proposalId: String
    public var version: Int
    public var changeDigest: String
    public var tenantId: String
    public var founderId: String
    public var nonce: String
    public var expiresAt: String
    public var decision: FounderDecisionChoice
    public var decidedAt: String
    public var channel: String?
}

public enum GateWireStatus: String, Codable, Sendable, Equatable {
    case approved, rejected, pending, unknown, conflict, expired, stale, changed, forbidden
    case unauthorized, invalid, confirmationRequired = "confirmation_required"
}

public struct GateDecisionWire: Sendable, Equatable {
    public var status: GateWireStatus
    public var receipt: GateReceipt?
    public var receiptDigest: String?
    public var canonicalReadback: Bool
}

public struct RenewalWire: Sendable, Equatable {
    public var status: String
    public var proposalId: String?
}

public protocol FounderGateClient: Sendable {
    func proposal(proposalId: String) async throws -> GateReviewTuple
    func decide(_ tuple: GateReviewTuple, decision: FounderDecisionChoice, confirmation: String) async throws -> GateDecisionWire
    func status(_ tuple: GateReviewTuple, decision: FounderDecisionChoice, confirmation: String) async throws -> GateDecisionWire
    func renew(_ tuple: GateReviewTuple) async throws -> RenewalWire
}

// MARK: - Canonical JSON (matches goal-graph/identity.ts canonicalJson)

/// Local JSON tree whose `canonical()` reproduces JavaScript `JSON.stringify` on
/// key-sorted values, including ECMAScript number formatting and UTF-16 key order.
enum GateJSON: Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([GateJSON])
    case object([String: GateJSON])

    static func parse(_ text: String) -> GateJSON? {
        guard let data = text.data(using: .utf8),
              let raw = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) else { return nil }
        return from(foundation: raw)
    }

    static func from(foundation raw: Any) -> GateJSON? {
        switch raw {
        case is NSNull:
            return .null
        case let value as NSNumber:
            if CFGetTypeID(value as CFTypeRef) == CFBooleanGetTypeID() { return .bool(value.boolValue) }
            // Foundation may hold large literals as exact decimals; round from the decimal
            // text so the double matches JavaScript JSON.parse.
            let number = Double(value.stringValue) ?? value.doubleValue
            return number.isFinite ? .number(number) : nil
        case let value as String:
            return .string(value)
        case let value as [Any]:
            var out: [GateJSON] = []
            for item in value {
                guard let converted = from(foundation: item) else { return nil }
                out.append(converted)
            }
            return .array(out)
        case let value as [String: Any]:
            var out: [String: GateJSON] = [:]
            for (key, item) in value {
                guard let converted = from(foundation: item) else { return nil }
                out[key] = converted
            }
            return .object(out)
        default:
            return nil
        }
    }

    func canonical() -> String {
        switch self {
        case .null: return "null"
        case .bool(let value): return value ? "true" : "false"
        case .number(let value): return Self.jsNumber(value)
        case .string(let value): return Self.escaped(value)
        case .array(let values): return "[" + values.map { $0.canonical() }.joined(separator: ",") + "]"
        case .object(let values):
            let keys = values.keys.sorted { Array($0.utf16).lexicographicallyPrecedes(Array($1.utf16)) }
            return "{" + keys.map { Self.escaped($0) + ":" + (values[$0]?.canonical() ?? "null") }.joined(separator: ",") + "}"
        }
    }

    /// ECMAScript Number::toString for finite doubles.
    static func jsNumber(_ value: Double) -> String {
        if value == 0 { return "0" }
        if value < 0 { return "-" + jsNumber(-value) }
        // Swift prints the shortest round-trip digits, as ECMAScript requires.
        let text = "\(value)"
        let parts = text.split(separator: "e", maxSplits: 1, omittingEmptySubsequences: false)
        let exponent = parts.count == 2 ? Int(parts[1].replacingOccurrences(of: "+", with: "")) ?? 0 : 0
        let mantissa = parts[0].split(separator: ".", maxSplits: 1, omittingEmptySubsequences: false)
        let intPart = String(mantissa[0])
        let fracPart = mantissa.count == 2 ? String(mantissa[1]) : ""
        var digits = Array(intPart + fracPart)
        var pointPosition = intPart.count
        while digits.first == "0" && digits.count > 1 { digits.removeFirst(); pointPosition -= 1 }
        while digits.last == "0" && digits.count > 1 { digits.removeLast() }
        let k = digits.count
        let n = pointPosition + exponent
        let digitString = String(digits)
        if k <= n && n <= 21 { return digitString + String(repeating: "0", count: n - k) }
        if 0 < n && n <= 21 { return String(digits[0..<n]) + "." + String(digits[n...]) }
        if -6 < n && n <= 0 { return "0." + String(repeating: "0", count: -n) + digitString }
        let e = n - 1
        let sign = e < 0 ? "-" : "+"
        if k == 1 { return digitString + "e" + sign + String(abs(e)) }
        return String(digits[0]) + "." + String(digits[1...]) + "e" + sign + String(abs(e))
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
        return out + "\""
    }

    var objectValue: [String: GateJSON]? {
        if case .object(let value) = self { return value }
        return nil
    }

    var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    var integerValue: Int? {
        if case .number(let value) = self, value.rounded() == value, value.magnitude < 1_000_000_000 { return Int(value) }
        return nil
    }
}

// MARK: - HTTP adapter

public struct HTTPFounderGateClient: FounderGateClient {
    private let base: URL
    private let transport: any HTTPTransport
    private let authorizer: any RequestAuthorizer

    public init(baseURL: URL, transport: any HTTPTransport, authorizer: any RequestAuthorizer) {
        self.base = baseURL
        self.transport = transport
        self.authorizer = authorizer
    }

    public func proposal(proposalId: String) async throws -> GateReviewTuple {
        let (status, object) = try await HTTPJSON.post(
            transport: transport, authorizer: authorizer,
            url: HTTPJSON.endpoint(base, "/v1/founder/proposal"),
            body: ["proposalId": proposalId]
        )
        guard status == 200 else { throw GateError.refused(Self.reason(status, object)) }
        guard object["status"] as? String == "review",
              let proposal = object["proposal"] as? [String: Any],
              let proposalIdWire = proposal["proposalId"] as? String,
              let tenantId = proposal["tenantId"] as? String,
              let version = proposal["version"] as? Int,
              let changeDigest = proposal["changeDigest"] as? String,
              let nonce = proposal["nonce"] as? String,
              let expiresAt = proposal["expiresAt"] as? String,
              let summary = proposal["summary"] as? String,
              let review = proposal["review"] as? [String: Any],
              let approve = object["approveConfirmation"] as? String,
              let reject = object["rejectConfirmation"] as? String,
              let reviewValue = GateJSON.from(foundation: review)
        else { throw GateError.malformed }
        // Same canonical form as goal-graph/identity.ts canonicalJson, so the
        // review hash inside the server confirmation can be recomputed exactly.
        return GateReviewTuple(
            proposalId: proposalIdWire, tenantId: tenantId, version: version, changeDigest: changeDigest,
            nonce: nonce, expiresAt: expiresAt, summary: summary, reviewJSON: reviewValue.canonical(),
            approveConfirmation: approve, rejectConfirmation: reject
        )
    }

    public func decide(_ tuple: GateReviewTuple, decision: FounderDecisionChoice, confirmation: String) async throws -> GateDecisionWire {
        try await submit("/v1/founder/decision", tuple, decision, confirmation)
    }

    public func status(_ tuple: GateReviewTuple, decision: FounderDecisionChoice, confirmation: String) async throws -> GateDecisionWire {
        try await submit("/v1/founder/status", tuple, decision, confirmation)
    }

    public func renew(_ tuple: GateReviewTuple) async throws -> RenewalWire {
        let (_, object) = try await HTTPJSON.post(
            transport: transport, authorizer: authorizer,
            url: HTTPJSON.endpoint(base, "/v1/founder/renew"),
            body: [
                "proposalId": tuple.proposalId, "version": tuple.version, "changeDigest": tuple.changeDigest,
                "nonce": tuple.nonce, "expiresAt": tuple.expiresAt
            ]
        )
        guard let status = object["status"] as? String else { throw GateError.malformed }
        return RenewalWire(status: status, proposalId: object["proposalId"] as? String)
    }

    private func submit(_ path: String, _ tuple: GateReviewTuple, _ decision: FounderDecisionChoice, _ confirmation: String) async throws -> GateDecisionWire {
        let (_, object) = try await HTTPJSON.post(
            transport: transport, authorizer: authorizer,
            url: HTTPJSON.endpoint(base, path),
            body: [
                "proposalId": tuple.proposalId, "version": tuple.version, "changeDigest": tuple.changeDigest,
                "nonce": tuple.nonce, "expiresAt": tuple.expiresAt,
                "decision": decision.rawValue, "confirmation": confirmation
            ]
        )
        guard let raw = object["status"] as? String, let status = GateWireStatus(rawValue: raw) else {
            throw GateError.malformed
        }
        var receipt: GateReceipt?
        if let wire = object["receipt"] as? [String: Any] {
            guard let proposalId = wire["proposalId"] as? String,
                  let version = wire["version"] as? Int,
                  let changeDigest = wire["changeDigest"] as? String,
                  let tenantId = wire["tenantId"] as? String,
                  let founderId = wire["founderId"] as? String,
                  let nonce = wire["nonce"] as? String,
                  let expiresAt = wire["expiresAt"] as? String,
                  let decisionRaw = wire["decision"] as? String,
                  let decided = FounderDecisionChoice(rawValue: decisionRaw),
                  let decidedAt = wire["decidedAt"] as? String
            else { throw GateError.malformed }
            receipt = GateReceipt(
                proposalId: proposalId, version: version, changeDigest: changeDigest, tenantId: tenantId,
                founderId: founderId, nonce: nonce, expiresAt: expiresAt, decision: decided,
                decidedAt: decidedAt, channel: wire["channel"] as? String
            )
        }
        return GateDecisionWire(
            status: status, receipt: receipt,
            receiptDigest: object["receiptDigest"] as? String,
            canonicalReadback: object["canonicalReadback"] as? Bool ?? false
        )
    }

    private static func reason(_ status: Int, _ object: [String: Any]) -> String {
        switch status {
        case 401: return "unauthorized"
        case 403: return "forbidden"
        case 503: return (object["error"] as? String) ?? "founder_host_unconfigured"
        default: return "status_\(status)"
        }
    }
}

// MARK: - Coordinator

public enum GateError: Error, Equatable, Sendable {
    case notAdmitted
    case tenantMismatch
    case principalMismatch
    case malformed
    case incompleteTuple(String)
    case expired
    case confirmationMismatch
    case unresolvedAttempt
    case recoveryUnavailable
    case persistenceFailed
    case concurrentExecution
    case refused(String)
}

public enum GateState: String, Codable, Sendable, Equatable {
    case reviewed, submitting, recorded, denied, changed, expired, stale, rejectedByOwner, conflict, outcomeUnknown, notRecorded
}

/// Compact, opaque original tuple plus outcome refs. It never holds review prose,
/// the summary or the typed confirmation.
public struct GateAttemptRecord: Codable, Sendable, Equatable {
    public var tenantId: String
    public var principal: String
    public var proposalId: String
    public var version: Int
    public var changeDigest: String
    public var nonce: String
    public var expiresAt: String
    public var choice: FounderDecisionChoice
    public var state: GateState
    public var receipt: GateReceipt?
    public var receiptDigest: String?
    public var updatedAt: String

    var key: String {
        FounderGateCoordinator.key(tenantId: tenantId, principal: principal, proposalId: proposalId, version: version, nonce: nonce)
    }
}

public struct GateOutcome: Sendable, Equatable {
    public var state: GateState
    public var record: GateAttemptRecord
    public var executionObserved: Bool { false }
}

/// Immutable identity of one reviewed tuple for one verified founder.
struct GateAttemptIdentity: Equatable {
    var tenantId: String
    var principal: String
    var proposalId: String
    var version: Int
    var changeDigest: String
    var nonce: String
    var expiresAt: String

    var key: String {
        FounderGateCoordinator.key(tenantId: tenantId, principal: principal, proposalId: proposalId, version: version, nonce: nonce)
    }

    func matches(_ record: GateAttemptRecord) -> Bool {
        record.tenantId == tenantId && record.principal == principal && record.proposalId == proposalId
            && record.version == version && record.changeDigest == changeDigest && record.nonce == nonce
            && record.expiresAt == expiresAt
    }

    /// Status-only wire tuple. Source status ignores review prose and exact confirmation.
    var statusTuple: GateReviewTuple {
        GateReviewTuple(
            proposalId: proposalId, tenantId: tenantId, version: version, changeDigest: changeDigest,
            nonce: nonce, expiresAt: expiresAt, summary: "", reviewJSON: "",
            approveConfirmation: "", rejectConfirmation: ""
        )
    }
}

public actor FounderGateCoordinator {
    private let client: any FounderGateClient
    private let session: any SessionProvider
    private let clock: any CoreClock
    private let store: any RecoveryStore
    private var inFlight: Set<String> = []

    static let maxRecordBytes = 4096
    static let maxReviewBytes = 512_000

    public init(client: any FounderGateClient, session: any SessionProvider, clock: any CoreClock, store: any RecoveryStore) {
        self.client = client
        self.session = session
        self.clock = clock
        self.store = store
    }

    /// Components are percent-encoded so ":" in a component can never alias another key.
    static func key(tenantId: String, principal: String, proposalId: String, version: Int, nonce: String) -> String {
        prefix(tenantId: tenantId, principal: principal) + [encode(proposalId), String(version), encode(nonce)].joined(separator: ":")
    }

    static func prefix(tenantId: String, principal: String) -> String {
        "gate:v2:" + encode(tenantId) + ":" + encode(principal) + ":"
    }

    private static let keySafe = CharacterSet.alphanumerics.union(.init(charactersIn: "._-"))
    private static func encode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: keySafe) ?? ""
    }

    // MARK: Session

    /// Verified, tenant-scoped, unexpired session. When `pinned` is set the founder must match it.
    private func admit(tenantId: String, pinned: String?) async throws -> String {
        let current = await session.currentSession()
        guard case .verified(let founderId, let sessionTenant, _) = current,
              sessionTenant == tenantId,
              current.admits(tenantId: tenantId, at: clock.now()) else {
            throw GateError.notAdmitted
        }
        if let pinned, pinned != founderId { throw GateError.principalMismatch }
        return founderId
    }

    // MARK: Review

    public func review(proposalId: String, tenantId: String) async throws -> GateReview {
        let founderId = try await admit(tenantId: tenantId, pinned: nil)
        let tuple = try await client.proposal(proposalId: proposalId)
        _ = try await admit(tenantId: tenantId, pinned: founderId)
        try Self.validate(tuple, proposalId: proposalId, tenantId: tenantId, now: clock.now())
        return GateReview(tuple: tuple, fetchedAt: clock.now(), principal: founderId)
    }

    /// Exact server confirmation text, recomputed from the parsed review with the
    /// shared source canonical rules (founder-decision.ts founderConfirmation).
    static func confirmation(tuple: GateReviewTuple, decision: FounderDecisionChoice) throws -> String {
        guard tuple.reviewJSON.utf8.count <= maxReviewBytes,
              let review = GateJSON.parse(tuple.reviewJSON), review.objectValue != nil else { throw GateError.malformed }
        let hash = SHA256.hash(data: Data(review.canonical().utf8)).map { String(format: "%02x", $0) }.joined()
        return "\(decision.rawValue) proposal \(tuple.proposalId) version \(tuple.version) digest \(tuple.changeDigest) expires \(tuple.expiresAt): \(tuple.summary) review sha256:\(hash)"
    }

    /// Convenience that returns an empty string for an unparsable review. Submission
    /// paths use the throwing form and reject empty typed confirmations.
    public static func computeConfirmation(tuple: GateReviewTuple, decision: FounderDecisionChoice) -> String {
        (try? confirmation(tuple: tuple, decision: decision)) ?? ""
    }

    static func validate(_ tuple: GateReviewTuple, proposalId: String, tenantId: String, now: Date, requireUnexpired: Bool = true) throws {
        guard tuple.tenantId == tenantId else { throw GateError.tenantMismatch }
        guard tuple.proposalId == proposalId else { throw GateError.incompleteTuple("proposalId") }
        let bounded: [(String, String, Int)] = [
            ("proposalId", tuple.proposalId, 256), ("tenantId", tuple.tenantId, 128), ("changeDigest", tuple.changeDigest, 128),
            ("nonce", tuple.nonce, 128), ("expiresAt", tuple.expiresAt, 64), ("summary", tuple.summary, 8192),
            ("review", tuple.reviewJSON, maxReviewBytes), ("approveConfirmation", tuple.approveConfirmation, 16384),
            ("rejectConfirmation", tuple.rejectConfirmation, 16384)
        ]
        for (name, value, cap) in bounded where value.isEmpty || value.utf8.count > cap { throw GateError.incompleteTuple(name) }
        guard tuple.version >= 1, tuple.version < 1_000_000_000 else { throw GateError.incompleteTuple("version") }
        guard Self.isDigest(tuple.changeDigest) else { throw GateError.incompleteTuple("changeDigest") }
        guard tuple.proposalId == "\(tuple.tenantId):\(tuple.changeDigest)" else { throw GateError.incompleteTuple("proposalId") }
        guard let expiry = CanonicalTimestamp.parse(tuple.expiresAt) else { throw GateError.incompleteTuple("expiresAt") }
        if requireUnexpired { guard expiry > now else { throw GateError.expired } }

        guard let review = GateJSON.parse(tuple.reviewJSON), let reviewObject = review.objectValue, !reviewObject.isEmpty else {
            throw GateError.incompleteTuple("review")
        }
        try validateChangeSet(tuple, review: reviewObject)

        for choice in [FounderDecisionChoice.approved, FounderDecisionChoice.rejected] {
            let expected = try confirmation(tuple: tuple, decision: choice)
            guard tuple.confirmation(for: choice) == expected else { throw GateError.confirmationMismatch }
        }
    }

    /// Full immutable change set consistency, mirroring founder-access-host.ts readProposal.
    private static func validateChangeSet(_ tuple: GateReviewTuple, review: [String: GateJSON]) throws {
        func bad(_ field: String) -> GateError { .incompleteTuple(field) }
        guard review["status"]?.stringValue == "pending" else { throw bad("review.status") }
        guard case .object(let inspect)? = review["founderInspect"], inspect["consistent"] == .bool(true) else { throw bad("review.founderInspect") }
        guard let changeSet = review["changeSet"]?.objectValue else { throw bad("changeSet") }
        guard changeSet["tenantId"]?.stringValue == tuple.tenantId else { throw GateError.tenantMismatch }
        guard changeSet["changeDigest"]?.stringValue == tuple.changeDigest else { throw bad("changeSet.changeDigest") }
        switch changeSet["expectedHeadDigest"] {
        case .some(.null): break
        case .some(.string(let value)) where isDigest(value): break
        default: throw bad("changeSet.expectedHeadDigest")
        }
        guard let graphVersion = changeSet["graphVersion"]?.integerValue, graphVersion >= 1 else { throw bad("changeSet.graphVersion") }
        guard let sourceRef = changeSet["sourceRef"]?.stringValue, !sourceRef.isEmpty,
              let sourceDigest = changeSet["sourceDigest"]?.stringValue, !sourceDigest.isEmpty else { throw bad("changeSet.source") }
        var changeCount = 0
        for (name, shape) in [("nodesToCreate", "node"), ("nodesToUpdate", "update"), ("nodesToRemove", "node")] {
            guard case .array(let items)? = changeSet[name] else { throw bad("changeSet.\(name)") }
            changeCount += items.count
            for item in items {
                guard let entry = item.objectValue else { throw bad("changeSet.\(name)") }
                if shape == "node" {
                    guard let nodeId = entry["nodeId"]?.stringValue, !nodeId.isEmpty else { throw bad("changeSet.\(name)") }
                } else {
                    guard let nodeId = entry["nodeId"]?.stringValue, !nodeId.isEmpty,
                          entry["before"]?.objectValue != nil, entry["after"]?.objectValue != nil else { throw bad("changeSet.\(name)") }
                }
            }
        }
        guard changeSet["isNoop"] == .bool(changeCount == 0) else { throw bad("changeSet.isNoop") }

        var digestInput = changeSet
        digestInput["changeDigest"] = nil
        digestInput["isNoop"] = nil
        let digest = SHA256.hash(data: Data(GateJSON.object(digestInput).canonical().utf8)).map { String(format: "%02x", $0) }.joined()
        guard "sha256:" + digest == tuple.changeDigest else { throw bad("changeSet.digest") }

        guard review["fence"]?.integerValue == graphVersion else { throw bad("review.fence") }
        guard review["expectedHeadVersion"]?.integerValue == graphVersion - 1 else { throw bad("review.expectedHeadVersion") }
        guard review["approvalNonce"]?.stringValue == tuple.nonce else { throw bad("review.approvalNonce") }
        guard review["approvalExpiresAt"]?.stringValue == tuple.expiresAt else { throw bad("review.approvalExpiresAt") }
    }

    private static func isDigest(_ value: String) -> Bool {
        guard value.hasPrefix("sha256:") else { return false }
        let hex = value.dropFirst(7)
        return hex.count == 64 && hex.allSatisfy { $0.isASCII && ($0.isNumber || ("a"..."f").contains($0)) }
    }

    // MARK: Submit

    public func submit(review: GateReview, choice: FounderDecisionChoice, typedConfirmation: String) async throws -> GateOutcome {
        let tuple = review.tuple
        let founderId = try await admit(tenantId: tuple.tenantId, pinned: review.principal)
        try Self.validate(tuple, proposalId: tuple.proposalId, tenantId: tuple.tenantId, now: clock.now())
        let expected = try Self.confirmation(tuple: tuple, decision: choice)
        guard !typedConfirmation.isEmpty, typedConfirmation == expected else { throw GateError.confirmationMismatch }

        let identity = GateAttemptIdentity(
            tenantId: tuple.tenantId, principal: founderId, proposalId: tuple.proposalId, version: tuple.version,
            changeDigest: tuple.changeDigest, nonce: tuple.nonce, expiresAt: tuple.expiresAt
        )
        let key = identity.key

        // Reserve before the first storage await so a concurrent submit cannot pass the load.
        if inFlight.contains(key) { throw GateError.concurrentExecution }
        inFlight.insert(key)
        defer { inFlight.remove(key) }

        let existing: Data?
        do { existing = try await store.load(key: key) } catch { throw GateError.persistenceFailed }
        _ = try await admit(tenantId: identity.tenantId, pinned: founderId)
        guard let expiry = CanonicalTimestamp.parse(identity.expiresAt), expiry > clock.now() else { throw GateError.expired }

        if let raw = existing {
            guard let stored = Self.decodeRecord(raw), identity.matches(stored) else {
                // Corrupt or mismatched evidence stays closed and is never overwritten.
                return GateOutcome(state: .conflict, record: Self.record(identity, choice: choice, state: .conflict, now: clock.now()))
            }
            switch stored.state {
            case .notRecorded: break
            case .recorded: return GateOutcome(state: .recorded, record: stored)
            default: throw GateError.unresolvedAttempt
            }
        }

        var record = Self.record(identity, choice: choice, state: .submitting, now: clock.now())
        do { try await store.save(try Self.encode(record), key: key) } catch { throw GateError.persistenceFailed }

        // Last gate before the owner write: the founder must still be the pinned one.
        do {
            _ = try await admit(tenantId: identity.tenantId, pinned: founderId)
            let expiry = CanonicalTimestamp.parse(identity.expiresAt)
            guard let expiry, expiry > clock.now() else { throw GateError.expired }
        } catch {
            record.state = .notRecorded
            record.updatedAt = Self.stamp(clock.now())
            if let data = try? Self.encode(record) { try? await store.save(data, key: key) }
            throw error
        }

        do {
            let wire = try await client.decide(tuple, decision: choice, confirmation: expected)
            record = Self.apply(wire, to: record, founderId: founderId, now: clock.now(), statusOnly: false)
        } catch {
            record.state = .outcomeUnknown
            record.updatedAt = Self.stamp(clock.now())
        }
        record = await persistOutcome(record, key: key)
        _ = try await admit(tenantId: identity.tenantId, pinned: founderId)
        return GateOutcome(state: record.state, record: record)
    }

    /// Saves the outcome. If the save fails the owner may already have written, so the
    /// result is unknown; the stored `submitting` marker still blocks another write.
    private func persistOutcome(_ record: GateAttemptRecord, key: String) async -> GateAttemptRecord {
        do {
            try await store.save(try Self.encode(record), key: key)
            return record
        } catch {
            var unknown = record
            unknown.state = .outcomeUnknown
            unknown.receipt = nil
            unknown.receiptDigest = nil
            if let data = try? Self.encode(unknown) { try? await store.save(data, key: key) }
            return unknown
        }
    }

    // MARK: Recovery

    public func recover(tuple: GateReviewTuple) async throws -> GateOutcome {
        try await recover(tenantId: tuple.tenantId, proposalId: tuple.proposalId, version: tuple.version,
                          changeDigest: tuple.changeDigest, nonce: tuple.nonce, expiresAt: tuple.expiresAt, principal: nil)
    }

    public func recover(record: GateAttemptRecord) async throws -> GateOutcome {
        try await recover(tenantId: record.tenantId, proposalId: record.proposalId, version: record.version,
                          changeDigest: record.changeDigest, nonce: record.nonce, expiresAt: record.expiresAt,
                          principal: record.principal)
    }

    private func recover(tenantId: String, proposalId: String, version: Int, changeDigest: String, nonce: String,
                         expiresAt: String, principal: String?) async throws -> GateOutcome {
        let founderId = try await admit(tenantId: tenantId, pinned: principal)
        let identity = GateAttemptIdentity(
            tenantId: tenantId, principal: founderId, proposalId: proposalId, version: version,
            changeDigest: changeDigest, nonce: nonce, expiresAt: expiresAt
        )
        let key = identity.key
        if inFlight.contains(key) { throw GateError.concurrentExecution }
        inFlight.insert(key)
        defer { inFlight.remove(key) }

        let raw: Data?
        do { raw = try await store.load(key: key) } catch { throw GateError.persistenceFailed }
        _ = try await admit(tenantId: tenantId, pinned: founderId)
        guard let raw, var record = Self.decodeRecord(raw), identity.matches(record) else {
            throw GateError.recoveryUnavailable
        }
        guard [.submitting, .outcomeUnknown, .notRecorded].contains(record.state) else {
            return GateOutcome(state: record.state, record: record)
        }

        do {
            let wire = try await client.status(identity.statusTuple, decision: record.choice, confirmation: "")
            record = Self.apply(wire, to: record, founderId: founderId, now: clock.now(), statusOnly: true)
            if record.state == .notRecorded, let expiry = CanonicalTimestamp.parse(record.expiresAt), expiry <= clock.now() {
                record.state = .expired
            }
        } catch {
            record.state = .outcomeUnknown
            record.updatedAt = Self.stamp(clock.now())
        }
        record = await persistOutcome(record, key: key)
        _ = try await admit(tenantId: tenantId, pinned: founderId)
        return GateOutcome(state: record.state, record: record)
    }

    public func pendingRecoveries() async throws -> [GateAttemptRecord] {
        let current = await session.currentSession()
        guard case .verified(let founderId, let sessionTenant, _) = current,
              current.admits(tenantId: sessionTenant, at: clock.now()) else { return [] }
        var out: [GateAttemptRecord] = []
        for key in try await store.keys(prefix: Self.prefix(tenantId: sessionTenant, principal: founderId)) {
            if let data = try await store.load(key: key),
               let record = Self.decodeRecord(data),
               record.key == key,
               record.tenantId == sessionTenant,
               record.principal == founderId,
               [.submitting, .outcomeUnknown].contains(record.state) {
                out.append(record)
            }
        }
        // The session may have switched while storage was awaited.
        let after = await session.currentSession()
        guard after == current, after.admits(tenantId: sessionTenant, at: clock.now()) else { return [] }
        return out
    }

    // MARK: Renew

    public func renew(review: GateReview) async throws -> GateReview {
        let tuple = review.tuple
        let founderId = try await admit(tenantId: tuple.tenantId, pinned: review.principal)
        try Self.validate(tuple, proposalId: tuple.proposalId, tenantId: tuple.tenantId, now: clock.now(), requireUnexpired: false)
        let wire = try await client.renew(tuple)
        _ = try await admit(tenantId: tuple.tenantId, pinned: founderId)
        guard ["renewed", "duplicate"].contains(wire.status) else { throw GateError.refused(wire.status) }
        let renewed = try await self.review(proposalId: wire.proposalId ?? tuple.proposalId, tenantId: tuple.tenantId)
        guard renewed.principal == founderId else { throw GateError.principalMismatch }
        guard renewed.tuple.version > tuple.version else { throw GateError.incompleteTuple("version") }
        _ = try await admit(tenantId: tuple.tenantId, pinned: founderId)
        return renewed
    }

    // MARK: Records

    static func record(_ identity: GateAttemptIdentity, choice: FounderDecisionChoice, state: GateState, now: Date) -> GateAttemptRecord {
        GateAttemptRecord(
            tenantId: identity.tenantId, principal: identity.principal, proposalId: identity.proposalId,
            version: identity.version, changeDigest: identity.changeDigest, nonce: identity.nonce,
            expiresAt: identity.expiresAt, choice: choice, state: state, receipt: nil, receiptDigest: nil,
            updatedAt: stamp(now)
        )
    }

    private static let recordKeys: Set<String> = [
        "tenantId", "principal", "proposalId", "version", "changeDigest", "nonce", "expiresAt",
        "choice", "state", "receipt", "receiptDigest", "updatedAt"
    ]

    /// Strict decode: unknown keys (for example a legacy summary), oversize or inconsistent
    /// records are treated as corrupt.
    static func decodeRecord(_ raw: Data) -> GateAttemptRecord? {
        guard raw.count <= maxRecordBytes,
              let object = (try? JSONSerialization.jsonObject(with: raw)) as? [String: Any],
              Set(object.keys).isSubset(of: recordKeys),
              let record = try? JSONDecoder().decode(GateAttemptRecord.self, from: raw),
              isWellFormed(record) else { return nil }
        return record
    }

    private static func isWellFormed(_ record: GateAttemptRecord) -> Bool {
        let strings: [(String, Int)] = [
            (record.tenantId, 128), (record.principal, 256), (record.proposalId, 256),
            (record.nonce, 128), (record.changeDigest, 128)
        ]
        for (value, cap) in strings where value.isEmpty || value.utf8.count > cap { return false }
        guard record.version >= 1, record.version < 1_000_000_000, isDigest(record.changeDigest),
              CanonicalTimestamp.parse(record.expiresAt) != nil, CanonicalTimestamp.parse(record.updatedAt) != nil else { return false }
        if let receipt = record.receipt {
            guard receiptMatches(receipt, record), receiptWellFormed(receipt, digest: record.receiptDigest) else { return false }
        }
        if record.state == .recorded {
            guard let receipt = record.receipt, receipt.decision == record.choice, record.receiptDigest != nil else { return false }
        }
        return true
    }

    private static func encode(_ record: GateAttemptRecord) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(record)
        guard data.count <= maxRecordBytes else { throw GateError.persistenceFailed }
        return data
    }

    static func apply(_ wire: GateDecisionWire, to input: GateAttemptRecord, founderId: String, now: Date, statusOnly: Bool) -> GateAttemptRecord {
        var record = input
        record.updatedAt = stamp(now)
        switch wire.status {
        case .approved, .rejected:
            guard let receipt = wire.receipt, receiptMatches(receipt, record), receiptWellFormed(receipt, digest: wire.receiptDigest),
                  wire.canonicalReadback,
                  receipt.decision.rawValue == wire.status.rawValue,
                  receipt.founderId == founderId else {
                record.state = .conflict
                return record
            }
            if receipt.decision != record.choice {
                record.state = .conflict
                if statusOnly { record.receipt = receipt; record.receiptDigest = wire.receiptDigest }
                return record
            }
            record.receipt = receipt
            record.receiptDigest = wire.receiptDigest
            record.state = .recorded
        case .pending:
            record.state = wire.canonicalReadback && statusOnly ? .notRecorded : .outcomeUnknown
        case .unknown: record.state = .outcomeUnknown
        case .conflict: record.state = .conflict
        case .expired: record.state = .expired
        case .stale: record.state = .stale
        case .changed: record.state = .changed
        case .forbidden, .unauthorized: record.state = .denied
        case .invalid, .confirmationRequired: record.state = .rejectedByOwner
        }
        return record
    }

    static func receiptMatches(_ receipt: GateReceipt, _ record: GateAttemptRecord) -> Bool {
        receipt.tenantId == record.tenantId && receipt.proposalId == record.proposalId
            && receipt.version == record.version && receipt.changeDigest == record.changeDigest
            && receipt.nonce == record.nonce && receipt.expiresAt == record.expiresAt
            && receipt.founderId == record.principal
    }

    static func receiptWellFormed(_ receipt: GateReceipt, digest: String?) -> Bool {
        guard let digest, !digest.isEmpty, digest.utf8.count <= 128,
              CanonicalTimestamp.parse(receipt.decidedAt) != nil else { return false }
        return (receipt.channel?.utf8.count ?? 0) <= 32
    }

    static func stamp(_ date: Date) -> String { CanonicalTimestamp.string(from: date) }
}
