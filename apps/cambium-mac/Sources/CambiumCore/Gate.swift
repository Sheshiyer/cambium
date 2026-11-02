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

public struct GateReview: Sendable, Equatable {
    public let tuple: GateReviewTuple
    public let fetchedAt: Date

    init(tuple: GateReviewTuple, fetchedAt: Date) {
        self.tuple = tuple
        self.fetchedAt = fetchedAt
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
              let reviewValue = try? JSONValue.from(foundation: review)
        else { throw GateError.malformed }
        // Same canonical form as goal-graph/identity.ts canonicalJson, so the
        // review hash inside the server confirmation can be recomputed exactly.
        let reviewJSON = reviewValue.canonical()
        return GateReviewTuple(
            proposalId: proposalIdWire, tenantId: tenantId, version: version, changeDigest: changeDigest,
            nonce: nonce, expiresAt: expiresAt, summary: summary, reviewJSON: reviewJSON,
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

public struct GateAttemptRecord: Codable, Sendable, Equatable {
    public var tenantId: String
    public var principal: String
    public var proposalId: String
    public var version: Int
    public var changeDigest: String
    public var nonce: String
    public var expiresAt: String
    public var summary: String
    public var choice: FounderDecisionChoice
    public var confirmation: String
    public var state: GateState
    public var receipt: GateReceipt?
    public var receiptDigest: String?
    public var updatedAt: String
}

public struct GateOutcome: Sendable, Equatable {
    public var state: GateState
    public var record: GateAttemptRecord
    public var executionObserved: Bool { false }
}

public actor FounderGateCoordinator {
    private let client: any FounderGateClient
    private let session: any SessionProvider
    private let clock: any CoreClock
    private let store: any RecoveryStore
    private var inFlight: Set<String> = []

    public init(client: any FounderGateClient, session: any SessionProvider, clock: any CoreClock, store: any RecoveryStore) {
        self.client = client
        self.session = session
        self.clock = clock
        self.store = store
    }

    static func key(tenantId: String, principal: String, proposalId: String, version: Int, nonce: String) -> String {
        "gate:\(tenantId):\(principal):\(proposalId):\(version):\(nonce)"
    }

    public func review(proposalId: String, tenantId: String) async throws -> GateReview {
        let currentSession = await session.currentSession()
        guard case .verified(let founderId, let sessionTenant, _) = currentSession,
              sessionTenant == tenantId,
              currentSession.admits(tenantId: tenantId, at: clock.now()) else {
            throw GateError.notAdmitted
        }
        let tuple = try await client.proposal(proposalId: proposalId)
        try Self.validate(tuple, proposalId: proposalId, tenantId: tenantId, expectedFounderId: founderId, now: clock.now())
        return GateReview(tuple: tuple, fetchedAt: clock.now())
    }

    public static func computeConfirmation(tuple: GateReviewTuple, decision: FounderDecisionChoice) -> String {
        let prefix = decision.rawValue
        let reviewHash: String
        if tuple.reviewJSON.isEmpty || tuple.reviewJSON == "{}" {
            reviewHash = ""
        } else {
            let digest = SHA256.hash(data: Data(tuple.reviewJSON.utf8))
            reviewHash = " review sha256:" + digest.map { String(format: "%02x", $0) }.joined()
        }
        return "\(prefix) proposal \(tuple.proposalId) version \(tuple.version) digest \(tuple.changeDigest) expires \(tuple.expiresAt): \(tuple.summary)\(reviewHash)"
    }

    static func validate(_ tuple: GateReviewTuple, proposalId: String, tenantId: String, expectedFounderId: String, now: Date) throws {
        guard tuple.tenantId == tenantId else { throw GateError.tenantMismatch }
        guard tuple.proposalId == proposalId else { throw GateError.incompleteTuple("proposalId") }
        let fields: [(String, String)] = [
            ("changeDigest", tuple.changeDigest), ("nonce", tuple.nonce), ("expiresAt", tuple.expiresAt),
            ("summary", tuple.summary), ("review", tuple.reviewJSON),
            ("approveConfirmation", tuple.approveConfirmation), ("rejectConfirmation", tuple.rejectConfirmation)
        ]
        for (name, value) in fields where value.isEmpty { throw GateError.incompleteTuple(name) }
        guard tuple.version >= 1 else { throw GateError.incompleteTuple("version") }
        guard tuple.reviewJSON != "{}" else { throw GateError.incompleteTuple("review") }
        guard let reviewData = tuple.reviewJSON.data(using: .utf8),
              let _ = try? JSONSerialization.jsonObject(with: reviewData) as? [String: Any] else {
            throw GateError.malformed
        }
        guard let expiry = CanonicalTimestamp.parse(tuple.expiresAt) else { throw GateError.incompleteTuple("expiresAt") }
        guard expiry > now else { throw GateError.expired }

        for choice in [FounderDecisionChoice.approved, FounderDecisionChoice.rejected] {
            let expected = computeConfirmation(tuple: tuple, decision: choice)
            let actual = tuple.confirmation(for: choice)
            guard actual == expected else { throw GateError.confirmationMismatch }
        }
    }

    public func submit(review: GateReview, choice: FounderDecisionChoice, typedConfirmation: String) async throws -> GateOutcome {
        let tuple = review.tuple
        let currentSession = await session.currentSession()
        guard case .verified(let founderId, let sessionTenant, _) = currentSession,
              sessionTenant == tuple.tenantId,
              currentSession.admits(tenantId: tuple.tenantId, at: clock.now()) else {
            throw GateError.notAdmitted
        }
        guard let expiry = CanonicalTimestamp.parse(tuple.expiresAt), expiry > clock.now() else { throw GateError.expired }
        let expected = Self.computeConfirmation(tuple: tuple, decision: choice)
        guard typedConfirmation == expected else { throw GateError.confirmationMismatch }

        let key = Self.key(tenantId: tuple.tenantId, principal: founderId, proposalId: tuple.proposalId, version: tuple.version, nonce: tuple.nonce)

        if inFlight.contains(key) { throw GateError.concurrentExecution }

        if let raw = try await store.load(key: key) {
            guard let record = try? JSONDecoder().decode(GateAttemptRecord.self, from: raw) else {
                let closedRecord = GateAttemptRecord(
                    tenantId: tuple.tenantId, principal: founderId, proposalId: tuple.proposalId,
                    version: tuple.version, changeDigest: tuple.changeDigest, nonce: tuple.nonce,
                    expiresAt: tuple.expiresAt, summary: tuple.summary, choice: choice,
                    confirmation: expected, state: .conflict, receipt: nil, receiptDigest: nil,
                    updatedAt: Self.stamp(clock.now())
                )
                try? await store.save(encoder(closedRecord), key: key)
                return GateOutcome(state: .conflict, record: closedRecord)
            }
            if record.principal != founderId { throw GateError.principalMismatch }
            switch record.state {
            case .notRecorded:
                break
            case .recorded:
                return GateOutcome(state: .recorded, record: record)
            default:
                throw GateError.unresolvedAttempt
            }
        }

        inFlight.insert(key)
        defer { inFlight.remove(key) }

        var record = GateAttemptRecord(
            tenantId: tuple.tenantId, principal: founderId, proposalId: tuple.proposalId,
            version: tuple.version, changeDigest: tuple.changeDigest, nonce: tuple.nonce,
            expiresAt: tuple.expiresAt, summary: tuple.summary, choice: choice, confirmation: expected,
            state: .submitting, receipt: nil, receiptDigest: nil, updatedAt: Self.stamp(clock.now())
        )
        do { try await store.save(encoder(record), key: key) } catch { throw GateError.persistenceFailed }

        do {
            let wire = try await client.decide(tuple, decision: choice, confirmation: expected)
            record = Self.apply(wire, to: record, founderId: founderId, now: clock.now(), statusOnly: false)
        } catch {
            record.state = GateState.outcomeUnknown
            record.updatedAt = Self.stamp(clock.now())
        }
        try? await store.save(encoder(record), key: key)
        return GateOutcome(state: record.state, record: record)
    }

    public func recover(tuple: GateReviewTuple) async throws -> GateOutcome {
        let currentSession = await session.currentSession()
        guard case .verified(let founderId, let sessionTenant, _) = currentSession,
              sessionTenant == tuple.tenantId else {
            throw GateError.notAdmitted
        }
        let key = Self.key(tenantId: tuple.tenantId, principal: founderId, proposalId: tuple.proposalId, version: tuple.version, nonce: tuple.nonce)
        guard let raw = try await store.load(key: key),
              var record = try? JSONDecoder().decode(GateAttemptRecord.self, from: raw) else {
            throw GateError.recoveryUnavailable
        }
        guard record.principal == founderId, record.tenantId == sessionTenant,
              currentSession.admits(tenantId: record.tenantId, at: clock.now()) else {
            throw GateError.notAdmitted
        }
        if record.state == .recorded { return GateOutcome(state: .recorded, record: record) }
        do {
            let wire = try await client.status(tuple, decision: record.choice, confirmation: record.confirmation)
            record = Self.apply(wire, to: record, founderId: founderId, now: clock.now(), statusOnly: true)
        } catch {
            record.state = GateState.outcomeUnknown
        }
        try? await store.save(encoder(record), key: key)
        return GateOutcome(state: record.state, record: record)
    }

    public func pendingRecoveries() async throws -> [GateAttemptRecord] {
        let currentSession = await session.currentSession()
        guard case .verified(let founderId, let sessionTenant, _) = currentSession else { return [] }
        let prefix = "gate:\(sessionTenant):\(founderId):"
        var out: [GateAttemptRecord] = []
        for key in try await store.keys(prefix: prefix) {
            if let data = try await store.load(key: key),
               let record = try? JSONDecoder().decode(GateAttemptRecord.self, from: data),
               record.tenantId == sessionTenant,
               record.principal == founderId,
               [.submitting, .outcomeUnknown].contains(record.state) {
                out.append(record)
            }
        }
        return out
    }

    public func renew(review: GateReview) async throws -> GateReview {
        let currentSession = await session.currentSession()
        guard case .verified(_, let sessionTenant, _) = currentSession,
              sessionTenant == review.tuple.tenantId,
              currentSession.admits(tenantId: review.tuple.tenantId, at: clock.now()) else {
            throw GateError.notAdmitted
        }
        let wire = try await client.renew(review.tuple)
        guard ["renewed", "duplicate"].contains(wire.status) else { throw GateError.refused(wire.status) }
        return try await self.review(proposalId: wire.proposalId ?? review.tuple.proposalId, tenantId: review.tuple.tenantId)
    }

    static func apply(_ wire: GateDecisionWire, to input: GateAttemptRecord, founderId: String, now: Date, statusOnly: Bool) -> GateAttemptRecord {
        var record = input
        record.updatedAt = stamp(now)
        switch wire.status {
        case .approved, .rejected:
            guard let receipt = wire.receipt, receiptMatches(receipt, record), wire.canonicalReadback,
                  receipt.decision.rawValue == wire.status.rawValue,
                  receipt.founderId == founderId else {
                record.state = .conflict
                return record
            }
            if !statusOnly && receipt.decision != record.choice { record.state = .conflict; return record }
            if statusOnly && receipt.decision != record.choice { record.state = .conflict; record.receipt = receipt; return record }
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

    static func stamp(_ date: Date) -> String { CanonicalTimestamp.string(from: date) }
    private func encoder(_ record: GateAttemptRecord) throws -> Data { try JSONEncoder().encode(record) }
}
