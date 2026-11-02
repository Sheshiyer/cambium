import Foundation

public struct LaunchCapability: Codable, Sendable, Equatable {
    public var tenantId: String
    public var principal: String
    public var workId: String
    public var admissionRef: String
    public var graphVersion: Int
    public var loadoutId: String
    public var inputDigest: String
    public var executionPlant: ExecutionPlant
    public var supportedAction: String
    public var expiresAt: String

    public init(
        tenantId: String, principal: String, workId: String, admissionRef: String,
        graphVersion: Int, loadoutId: String, inputDigest: String, executionPlant: ExecutionPlant,
        supportedAction: String, expiresAt: String
    ) {
        self.tenantId = tenantId
        self.principal = principal
        self.workId = workId
        self.admissionRef = admissionRef
        self.graphVersion = graphVersion
        self.loadoutId = loadoutId
        self.inputDigest = inputDigest
        self.executionPlant = executionPlant
        self.supportedAction = supportedAction
        self.expiresAt = expiresAt
    }
}

public enum ExecutionPlant: String, Codable, Sendable, Equatable {
    case hands = "temperance-hands"
    case hermes = "hermes-remote"
}

public struct LaunchRequestWire: Codable, Sendable, Equatable {
    public var requestId: String
    public var attemptId: String
    public var status: LaunchStatusWire
    public var assignedRunId: String?
    public var detail: String?
}

public enum LaunchStatusWire: String, Codable, Sendable, Equatable {
    case queued, busy, running, complete, failed, refused, expired, unknown
}

public struct AttemptStatusResult: Sendable, Equatable {
    public var requestId: String
    public var attemptId: String
    public var status: LaunchStatusWire
    public var runId: String?
    public var artifactRef: String?
    public var receiptRef: String?
    public var verdict: SemanticVerdict?
}

public enum SemanticVerdict: String, Codable, Sendable, Equatable {
    case pass, fail, held, missingAcceptance
}

public protocol LaunchClient: Sendable {
    func capability(workId: String, tenantId: String) async throws -> LaunchCapability
    func requestLaunch(capability: LaunchCapability, requestId: String, attemptId: String, idempotencyNonce: String) async throws -> LaunchRequestWire
    func attemptStatus(requestId: String, attemptId: String, tenantId: String) async throws -> AttemptStatusResult
}

// MARK: - HTTP adapter

public struct HTTPLaunchClient: LaunchClient {
    private let base: URL
    private let transport: any HTTPTransport
    private let authorizer: any RequestAuthorizer

    public init(baseURL: URL, transport: any HTTPTransport, authorizer: any RequestAuthorizer) {
        self.base = baseURL
        self.transport = transport
        self.authorizer = authorizer
    }

    public func capability(workId: String, tenantId: String) async throws -> LaunchCapability {
        let (status, object) = try await HTTPJSON.post(
            transport: transport, authorizer: authorizer,
            url: HTTPJSON.endpoint(base, "/v1/native/launch/capability"),
            body: ["workId": workId, "tenantId": tenantId]
        )
        guard status == 200,
              let tId = object["tenantId"] as? String,
              let principal = object["principal"] as? String,
              let wId = object["workId"] as? String,
              let admissionRef = object["admissionRef"] as? String,
              let graphVersion = object["graphVersion"] as? Int,
              let loadoutId = object["loadoutId"] as? String,
              let inputDigest = object["inputDigest"] as? String,
              let plantRaw = object["executionPlant"] as? String,
              let plant = ExecutionPlant(rawValue: plantRaw),
              let action = object["supportedAction"] as? String,
              let expiresAt = object["expiresAt"] as? String
        else { throw LaunchError.invalidCapability }
        return LaunchCapability(
            tenantId: tId, principal: principal, workId: wId, admissionRef: admissionRef,
            graphVersion: graphVersion, loadoutId: loadoutId, inputDigest: inputDigest,
            executionPlant: plant, supportedAction: action, expiresAt: expiresAt
        )
    }

    public func requestLaunch(capability: LaunchCapability, requestId: String, attemptId: String, idempotencyNonce: String) async throws -> LaunchRequestWire {
        let (status, object) = try await HTTPJSON.post(
            transport: transport, authorizer: authorizer,
            url: HTTPJSON.endpoint(base, "/v1/native/launch"),
            body: [
                "tenantId": capability.tenantId, "principal": capability.principal, "workId": capability.workId,
                "admissionRef": capability.admissionRef, "graphVersion": capability.graphVersion,
                "loadoutId": capability.loadoutId, "inputDigest": capability.inputDigest,
                "executionPlant": capability.executionPlant.rawValue, "supportedAction": capability.supportedAction,
                "expiresAt": capability.expiresAt, "requestId": requestId, "attemptId": attemptId,
                "idempotencyNonce": idempotencyNonce
            ]
        )
        guard status == 200,
              let reqId = object["requestId"] as? String, reqId == requestId,
              let attId = object["attemptId"] as? String, attId == attemptId,
              let rawStatus = object["status"] as? String,
              let wireStatus = LaunchStatusWire(rawValue: rawStatus)
        else { throw LaunchError.refused("status_\(status)") }
        return LaunchRequestWire(
            requestId: reqId, attemptId: attId, status: wireStatus,
            assignedRunId: object["assignedRunId"] as? String, detail: object["detail"] as? String
        )
    }

    public func attemptStatus(requestId: String, attemptId: String, tenantId: String) async throws -> AttemptStatusResult {
        let (status, object) = try await HTTPJSON.post(
            transport: transport, authorizer: authorizer,
            url: HTTPJSON.endpoint(base, "/v1/native/launch/status"),
            body: ["requestId": requestId, "attemptId": attemptId, "tenantId": tenantId]
        )
        guard status == 200,
              let reqId = object["requestId"] as? String, reqId == requestId,
              let attId = object["attemptId"] as? String, attId == attemptId,
              let rawStatus = object["status"] as? String,
              let wireStatus = LaunchStatusWire(rawValue: rawStatus)
        else { throw LaunchError.refused("status_\(status)") }
        var verdict: SemanticVerdict? = nil
        if let vRaw = object["verdict"] as? String { verdict = SemanticVerdict(rawValue: vRaw) }
        return AttemptStatusResult(
            requestId: reqId, attemptId: attId, status: wireStatus,
            runId: object["runId"] as? String, artifactRef: object["artifactRef"] as? String,
            receiptRef: object["receiptRef"] as? String, verdict: verdict
        )
    }
}

// MARK: - Coordinator

public enum LaunchError: Error, Equatable, Sendable {
    case notAdmitted
    case tenantMismatch
    case principalMismatch
    case expired
    case invalidCapability
    case transmissionFailed
    case recoveryUnavailable
    case persistenceFailed
    case concurrentExecution
    case refused(String)
}

public enum LaunchState: String, Codable, Sendable, Equatable {
    case queued, transmitting, transmissionFailed, persistenceFailed, busy, running, complete, failed, refused, expired, outcomeUnknown
}

public struct LaunchAttemptRecord: Codable, Sendable, Equatable {
    public var capability: LaunchCapability
    public var idempotencyNonce: String
    public var requestId: String
    public var attemptId: String
    public var state: LaunchState
    public var assignedRunId: String?
    public var artifactRef: String?
    public var receiptRef: String?
    public var verdict: SemanticVerdict?
    public var updatedAt: String
}

public struct LaunchOutcome: Sendable, Equatable {
    public var state: LaunchState
    public var record: LaunchAttemptRecord
}

public actor LaunchCoordinator {
    private let client: any LaunchClient
    private let session: any SessionProvider
    private let clock: any CoreClock
    private let store: any RecoveryStore
    private var inFlight: Set<String> = []

    public init(client: any LaunchClient, session: any SessionProvider, clock: any CoreClock, store: any RecoveryStore) {
        self.client = client
        self.session = session
        self.clock = clock
        self.store = store
    }

    static func key(tenantId: String, principal: String, workId: String, nonce: String) -> String {
        "launch:\(tenantId):\(principal):\(workId):\(nonce)"
    }

    public func launch(capability: LaunchCapability, idempotencyNonce: String) async throws -> LaunchOutcome {
        let currentSession = await session.currentSession()
        guard case .verified(let founderId, let sessionTenant, _) = currentSession,
              sessionTenant == capability.tenantId, founderId == capability.principal,
              currentSession.admits(tenantId: capability.tenantId, at: clock.now()) else {
            throw LaunchError.notAdmitted
        }
        try Self.validate(capability, now: clock.now())

        let key = Self.key(tenantId: capability.tenantId, principal: capability.principal, workId: capability.workId, nonce: idempotencyNonce)

        if inFlight.contains(key) { throw LaunchError.concurrentExecution }

        if let raw = try await store.load(key: key) {
            guard let record = try? JSONDecoder().decode(LaunchAttemptRecord.self, from: raw) else {
                let closedRecord = LaunchAttemptRecord(
                    capability: capability, idempotencyNonce: idempotencyNonce,
                    requestId: "req-corrupted", attemptId: "att-corrupted", state: .failed,
                    assignedRunId: nil, artifactRef: nil, receiptRef: nil, verdict: nil,
                    updatedAt: Self.stamp(clock.now())
                )
                try? await store.save(encoder(closedRecord), key: key)
                return LaunchOutcome(state: .failed, record: closedRecord)
            }
            if record.capability.principal != capability.principal {
                throw LaunchError.principalMismatch
            }
            return LaunchOutcome(state: record.state, record: record)
        }

        inFlight.insert(key)
        defer { inFlight.remove(key) }

        let requestId = "req-" + UUID().uuidString.lowercased()
        let attemptId = "att-" + UUID().uuidString.lowercased()
        var record = LaunchAttemptRecord(
            capability: capability, idempotencyNonce: idempotencyNonce,
            requestId: requestId, attemptId: attemptId, state: .transmitting,
            assignedRunId: nil, artifactRef: nil, receiptRef: nil, verdict: nil,
            updatedAt: Self.stamp(clock.now())
        )
        do { try await store.save(encoder(record), key: key) } catch { throw LaunchError.persistenceFailed }

        do {
            let wire = try await client.requestLaunch(capability: capability, requestId: requestId, attemptId: attemptId, idempotencyNonce: idempotencyNonce)
            guard wire.requestId == requestId, wire.attemptId == attemptId else {
                throw LaunchError.refused("mismatched_response_ids")
            }
            record.assignedRunId = wire.assignedRunId
            switch wire.status {
            case .queued: record.state = .queued
            case .busy: record.state = .busy
            case .running: record.state = .running
            case .complete: record.state = .complete
            case .failed: record.state = .failed
            case .refused: record.state = .refused
            case .expired: record.state = .expired
            case .unknown: record.state = .outcomeUnknown
            }
        } catch {
            record.state = .transmissionFailed
        }
        record.updatedAt = Self.stamp(clock.now())
        do { try await store.save(encoder(record), key: key) } catch {
            record.state = .persistenceFailed
            try? await store.save(encoder(record), key: key)
            throw LaunchError.persistenceFailed
        }
        return LaunchOutcome(state: record.state, record: record)
    }

    public func recover(workId: String, idempotencyNonce: String) async throws -> LaunchOutcome {
        let currentSession = await session.currentSession()
        guard case .verified(let founderId, let sessionTenant, _) = currentSession else {
            throw LaunchError.notAdmitted
        }
        let prefix = "launch:\(sessionTenant):\(founderId):\(workId):"
        let keys = try await store.keys(prefix: prefix)
        let key = keys.first { $0.hasSuffix(":\(idempotencyNonce)") } ?? prefix + idempotencyNonce

        guard let raw = try await store.load(key: key),
              var record = try? JSONDecoder().decode(LaunchAttemptRecord.self, from: raw) else {
            throw LaunchError.recoveryUnavailable
        }
        guard record.capability.tenantId == sessionTenant, record.capability.principal == founderId,
              currentSession.admits(tenantId: record.capability.tenantId, at: clock.now()) else {
            throw LaunchError.notAdmitted
        }
        do {
            let status = try await client.attemptStatus(requestId: record.requestId, attemptId: record.attemptId, tenantId: sessionTenant)
            guard status.requestId == record.requestId, status.attemptId == record.attemptId else {
                throw LaunchError.refused("mismatched_status_ids")
            }
            record.assignedRunId = status.runId ?? record.assignedRunId
            record.artifactRef = status.artifactRef
            record.receiptRef = status.receiptRef
            record.verdict = status.verdict
            switch status.status {
            case .queued: record.state = .queued
            case .busy: record.state = .busy
            case .running: record.state = .running
            case .complete: record.state = .complete
            case .failed: record.state = .failed
            case .refused: record.state = .refused
            case .expired: record.state = .expired
            case .unknown: record.state = .outcomeUnknown
            }
        } catch {
            record.state = .outcomeUnknown
        }
        record.updatedAt = Self.stamp(clock.now())
        try? await store.save(encoder(record), key: key)
        return LaunchOutcome(state: record.state, record: record)
    }

    public func pendingRecoveries() async throws -> [LaunchAttemptRecord] {
        let currentSession = await session.currentSession()
        guard case .verified(let founderId, let sessionTenant, _) = currentSession else { return [] }
        let prefix = "launch:\(sessionTenant):\(founderId):"
        var out: [LaunchAttemptRecord] = []
        for key in try await store.keys(prefix: prefix) {
            if let data = try await store.load(key: key),
               let record = try? JSONDecoder().decode(LaunchAttemptRecord.self, from: data),
               record.capability.tenantId == sessionTenant,
               record.capability.principal == founderId,
               [.queued, .transmitting, .transmissionFailed, .busy, .running, .outcomeUnknown].contains(record.state) {
                out.append(record)
            }
        }
        return out
    }

    static func validate(_ capability: LaunchCapability, now: Date) throws {
        let fields = [
            capability.tenantId, capability.principal, capability.workId,
            capability.admissionRef, capability.loadoutId, capability.inputDigest, capability.supportedAction
        ]
        for item in fields where item.isEmpty { throw LaunchError.invalidCapability }
        guard capability.graphVersion >= 0 else { throw LaunchError.invalidCapability }
        guard let expiry = CanonicalTimestamp.parse(capability.expiresAt) else { throw LaunchError.invalidCapability }
        guard expiry > now else { throw LaunchError.expired }
    }

    private static func stamp(_ date: Date) -> String { CanonicalTimestamp.string(from: date) }
    private func encoder(_ record: LaunchAttemptRecord) throws -> Data { try JSONEncoder().encode(record) }
}
