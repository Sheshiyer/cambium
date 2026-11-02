import Foundation

// Native launch client and coordinator for `cambium.native-launch.v1`.
// Owner source: workers/quests/src/native-launch.ts and docs/NATIVE-LAUNCH-CONTRACT.md.
// Request bodies never carry tenant or principal. Scope comes from the injected
// SessionProvider and the endpoint authorizer only.

public enum LaunchContract {
    public static let version = "cambium.native-launch.v1"
    public static let maxBodyBytes = 4096
}

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

/// The exact eight-key tuple the owner pins. It carries no tenant or principal.
public struct LaunchCapabilityTuple: Codable, Sendable, Equatable {
    public var workId: String
    public var admissionRef: String
    public var graphVersion: Int
    public var loadoutId: String
    public var inputDigest: String
    public var executionPlant: String
    public var supportedAction: String
    public var expiresAt: String
}

public struct LaunchExistingRequest: Codable, Sendable, Equatable {
    public var requestId: String
    public var attemptId: String
}

/// Owner answer to the read-only capability route.
public enum LaunchCapabilityReply: Sendable, Equatable {
    case supported(LaunchCapabilityTuple)
    case unsupported(reason: String, tuple: LaunchCapabilityTuple)
    case unavailable(reason: String, existingRequest: LaunchExistingRequest?)
}

/// Transport status, owner execution state and acceptance stay separate fields.
public struct LaunchRequestWire: Codable, Sendable, Equatable {
    public var requestId: String
    public var attemptId: String
    public var status: LaunchStatusWire
    public var assignedRunId: String?
    public var detail: String?
    public var httpStatus: Int? = nil
    public var requestKey: String? = nil
    public var dispatch: String? = nil
    public var executionState: String? = nil
    public var ownerRef: String? = nil
    public var observedAt: String? = nil
    public var terminal: Bool? = nil
    public var acceptance: String? = nil
    public var retry: String? = nil
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
    public var detail: String? = nil
    public var requestKey: String? = nil
    public var dispatch: String? = nil
    public var executionState: String? = nil
    public var ownerRef: String? = nil
    public var observedAt: String? = nil
    public var terminal: Bool? = nil
    public var acceptance: String? = nil
    public var retry: String? = nil
    /// The owner's echo of the pinned tuple. Nil only from injected clients that do not report it.
    public var capability: LaunchCapabilityTuple? = nil
}

public enum SemanticVerdict: String, Codable, Sendable, Equatable {
    case pass, fail, held, missingAcceptance
}

public protocol LaunchClient: Sendable {
    func capability(workId: String, tenantId: String) async throws -> LaunchCapability
    func requestLaunch(capability: LaunchCapability, requestId: String, attemptId: String, idempotencyNonce: String) async throws -> LaunchRequestWire
    func attemptStatus(requestId: String, attemptId: String, tenantId: String) async throws -> AttemptStatusResult
    /// Local, synchronous checks that must pass before anything is persisted or sent.
    func preflight(capability: LaunchCapability, idempotencyNonce: String) throws
}

public extension LaunchClient {
    func preflight(capability: LaunchCapability, idempotencyNonce: String) throws {}
}

// MARK: - Owner wire decoding

enum OwnerWire {
    typealias Object = [String: JSONValue]

    static let executionStates: Set<String> = ["unknown", "accepted", "queued", "running", "succeeded", "failed", "refused", "busy"]
    static let terminalStates: Set<String> = ["succeeded", "failed", "refused", "busy"]
    static let dispatchStates: Set<String> = ["reserved", "owner_answered", "owner_unknown"]
    static let unavailableReasons: Set<String> = ["no_admission", "admission_expired", "admission_revoked", "graph_changed", "admission_consumed"]
    static let refusalCodes: Set<String> = [
        "request_changed", "attempt_collision", "nonce_collision", "admission_consumed",
        "admission_not_current", "pins_changed", "admission_expired", "admission_revoked", "graph_changed",
        "unsupported_plant_or_action"
    ]
    static let tupleKeys: Set<String> = [
        "workId", "admissionRef", "graphVersion", "loadoutId", "inputDigest", "executionPlant", "supportedAction", "expiresAt"
    ]

    static let clientId = #"^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}\z"#
    static let nonce = #"^[A-Za-z0-9_-]{22,128}\z"#
    static let ref = #"^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}\z"#
    static let workId = #"^[a-z][a-z0-9-]*:[A-Za-z0-9._:/-]{1,200}\z"#
    static let digest = #"^sha256:[0-9a-f]{64}\z"#
    static let iso = #"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z\z"#
    static let requestKey = #"^nlr_[0-9a-f]{64}\z"#

    static func matches(_ value: String, _ pattern: String) -> Bool {
        value.range(of: pattern, options: .regularExpression) != nil
    }

    static func isoOK(_ value: String) -> Bool {
        matches(value, iso) && CanonicalTimestamp.parse(value) != nil
    }

    static func root(_ data: Data) throws -> Object {
        guard let parsed = try? JSONValue.parse(data), case .object(let object) = parsed,
              string(object, "contractVersion") == LaunchContract.version else {
            throw TransportFailure.malformedResponse
        }
        return object
    }

    static func string(_ o: Object, _ key: String) -> String? {
        if case .string(let value)? = o[key] { return value }
        return nil
    }

    static func object(_ o: Object, _ key: String) -> Object? {
        if case .object(let value)? = o[key] { return value }
        return nil
    }

    static func bool(_ o: Object, _ key: String) -> Bool? {
        if case .bool(let value)? = o[key] { return value }
        return nil
    }

    static func int(_ o: Object, _ key: String) -> Int? {
        if case .number(let value)? = o[key], value.rounded() == value, value.magnitude <= 9_007_199_254_740_991 {
            return Int(value)
        }
        return nil
    }

    /// Key may be absent or null; any other non-string type is malformed.
    static func nullableString(_ o: Object, _ key: String) throws -> String? {
        switch o[key] {
        case nil, .null?: return nil
        case .string(let value)?: return value
        default: throw TransportFailure.malformedResponse
        }
    }

    static func tuple(_ o: Object) throws -> LaunchCapabilityTuple {
        guard Set(o.keys) == tupleKeys,
              let workIdValue = string(o, "workId"), matches(workIdValue, workId),
              let admission = string(o, "admissionRef"), matches(admission, ref),
              let graph = int(o, "graphVersion"), graph >= 1,
              let loadout = string(o, "loadoutId"), matches(loadout, ref),
              let input = string(o, "inputDigest"), matches(input, digest),
              let plant = string(o, "executionPlant"), matches(plant, ref),
              let action = string(o, "supportedAction"), matches(action, ref),
              let expires = string(o, "expiresAt"), isoOK(expires) else {
            throw TransportFailure.malformedResponse
        }
        return LaunchCapabilityTuple(
            workId: workIdValue, admissionRef: admission, graphVersion: graph, loadoutId: loadout,
            inputDigest: input, executionPlant: plant, supportedAction: action, expiresAt: expires
        )
    }

    struct Projection: Equatable {
        var requestId: String
        var attemptId: String
        var requestKey: String
        var dispatch: String
        var reservedAt: String
        var tuple: LaunchCapabilityTuple
        var executionState: String
        var ownerRef: String?
        var observedAt: String?
        var terminal: Bool
        var acceptance: String
        var retry: String
        var status: String
    }

    /// Decodes the request / execution / acceptance sections the owner returns.
    static func projection(_ o: Object) throws -> Projection {
        guard let request = object(o, "request"), let execution = object(o, "execution"),
              let acceptance = object(o, "acceptance"),
              let requestId = string(request, "requestId"), matches(requestId, clientId),
              let attemptId = string(request, "attemptId"), matches(attemptId, clientId),
              let key = string(request, "requestKey"), matches(key, requestKey),
              let dispatch = string(request, "dispatch"), dispatchStates.contains(dispatch),
              let reservedAt = string(request, "reservedAt"), isoOK(reservedAt),
              let capability = object(request, "capability"),
              let state = string(execution, "state"), executionStates.contains(state),
              let terminal = bool(execution, "terminal"), terminal == terminalStates.contains(state),
              string(acceptance, "state") == "not_evaluated",
              let retry = string(o, "retry"), retry == (terminal ? "none" : "status_only"),
              let status = string(o, "status") else {
            throw TransportFailure.malformedResponse
        }
        let ownerRef = try nullableString(execution, "ownerRef")
        let observedAt = try nullableString(execution, "observedAt")
        if let ownerRef, !matches(ownerRef, ref) { throw TransportFailure.malformedResponse }
        if let observedAt, !isoOK(observedAt) { throw TransportFailure.malformedResponse }
        return Projection(
            requestId: requestId, attemptId: attemptId, requestKey: key, dispatch: dispatch,
            reservedAt: reservedAt, tuple: try tuple(capability), executionState: state,
            ownerRef: ownerRef, observedAt: observedAt, terminal: terminal,
            acceptance: "not_evaluated", retry: retry, status: status
        )
    }

    static func launchStatus(forExecution state: String) -> LaunchStatusWire {
        switch state {
        case "accepted", "queued": return .queued
        case "running": return .running
        case "succeeded": return .complete
        case "failed": return .failed
        case "refused": return .refused
        case "busy": return .busy
        default: return .unknown
        }
    }

    static func capabilityReply(status: Int, data: Data, workId requestedWork: String, admissionRef requestedAdmission: String) throws -> LaunchCapabilityReply {
        switch status {
        case 200: break
        case 401: throw TransportFailure.unauthorized
        case 503: throw TransportFailure.ownerUnconfigured
        default: throw TransportFailure.malformedResponse
        }
        let o = try root(data)
        guard let capability = string(o, "capability") else { throw TransportFailure.malformedResponse }
        func echoed() throws -> LaunchCapabilityTuple {
            guard let raw = object(o, "tuple") else { throw TransportFailure.malformedResponse }
            let parsed = try tuple(raw)
            guard parsed.workId == requestedWork, parsed.admissionRef == requestedAdmission else {
                throw TransportFailure.malformedResponse
            }
            return parsed
        }
        switch capability {
        case "supported":
            guard let acceptance = object(o, "acceptance"), string(acceptance, "state") == "not_evaluated" else {
                throw TransportFailure.malformedResponse
            }
            return .supported(try echoed())
        case "unsupported":
            guard let reason = string(o, "reason"), reason == "owner_does_not_support" else { throw TransportFailure.malformedResponse }
            return .unsupported(reason: reason, tuple: try echoed())
        case "unavailable":
            guard let reason = string(o, "reason"), unavailableReasons.contains(reason) else { throw TransportFailure.malformedResponse }
            var existing: LaunchExistingRequest? = nil
            if let raw = object(o, "existingRequest") {
                guard Set(raw.keys) == ["requestId", "attemptId"],
                      let requestId = string(raw, "requestId"), matches(requestId, clientId),
                      let attemptId = string(raw, "attemptId"), matches(attemptId, clientId) else {
                    throw TransportFailure.malformedResponse
                }
                existing = LaunchExistingRequest(requestId: requestId, attemptId: attemptId)
            }
            return .unavailable(reason: reason, existingRequest: existing)
        default:
            throw TransportFailure.malformedResponse
        }
    }

    static func launchWire(
        status: Int, data: Data, requestId: String, attemptId: String, tuple sent: LaunchCapabilityTuple
    ) throws -> LaunchRequestWire {
        let o = try root(data)
        if o["request"] != nil {
            let p = try projection(o)
            guard p.requestId == requestId, p.attemptId == attemptId, p.tuple == sent else {
                throw TransportFailure.malformedResponse
            }
            switch (status, p.status, p.executionState) {
            case (202, "recorded", "accepted"), (202, "recorded", "queued"), (202, "recorded", "running"),
                 (202, "recorded", "succeeded"), (202, "recorded", "failed"),
                 (200, "duplicate", _),
                 (429, "recorded", "busy"), (409, "recorded", "refused"),
                 (503, "unknown", "unknown"):
                break
            default:
                throw TransportFailure.malformedResponse
            }
            return LaunchRequestWire(
                requestId: p.requestId, attemptId: p.attemptId, status: launchStatus(forExecution: p.executionState),
                assignedRunId: nil, detail: p.status, httpStatus: status, requestKey: p.requestKey,
                dispatch: p.dispatch, executionState: p.executionState, ownerRef: p.ownerRef,
                observedAt: p.observedAt, terminal: p.terminal, acceptance: p.acceptance, retry: p.retry
            )
        }
        let tag = string(o, "status")
        if status == 409, tag == "conflict" || tag == "refused", let code = string(o, "code"), refusalCodes.contains(code) {
            return LaunchRequestWire(
                requestId: requestId, attemptId: attemptId, status: .refused, assignedRunId: nil,
                detail: "\(tag ?? ""):\(code)", httpStatus: status, acceptance: "not_evaluated"
            )
        }
        if status == 503, tag == "unknown" || string(o, "error") == "native_launch_unconfigured" {
            return LaunchRequestWire(
                requestId: requestId, attemptId: attemptId, status: .unknown, assignedRunId: nil,
                detail: tag ?? "native_launch_unconfigured", httpStatus: status, retry: "status_only"
            )
        }
        throw LaunchError.refused("http_\(status)")
    }

    static func statusResult(status: Int, data: Data, requestId: String, attemptId: String) throws -> AttemptStatusResult {
        let o = try root(data)
        switch status {
        case 200:
            let p = try projection(o)
            guard p.requestId == requestId, p.attemptId == attemptId,
                  p.status == "observed" || p.status == "owner_not_found" else {
                throw TransportFailure.malformedResponse
            }
            return AttemptStatusResult(
                requestId: p.requestId, attemptId: p.attemptId, status: launchStatus(forExecution: p.executionState),
                runId: nil, artifactRef: nil, receiptRef: nil, verdict: nil, detail: p.status,
                requestKey: p.requestKey, dispatch: p.dispatch, executionState: p.executionState,
                ownerRef: p.ownerRef, observedAt: p.observedAt, terminal: p.terminal,
                acceptance: p.acceptance, retry: p.retry, capability: p.tuple
            )
        case 404 where string(o, "status") == "not_found":
            return AttemptStatusResult(
                requestId: requestId, attemptId: attemptId, status: .unknown,
                runId: nil, artifactRef: nil, receiptRef: nil, verdict: nil, detail: "not_found"
            )
        case 409 where string(o, "code") == "attempt_mismatch":
            throw LaunchError.refused("attempt_mismatch")
        case 503:
            throw TransportFailure.unreachable
        case 401:
            throw TransportFailure.unauthorized
        default:
            throw TransportFailure.malformedResponse
        }
    }
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

    /// Read-only owner capability check. The body carries only the contract version,
    /// work and admission reference.
    public func ownerCapability(workId: String, admissionRef: String) async throws -> LaunchCapabilityReply {
        guard OwnerWire.matches(workId, OwnerWire.workId), OwnerWire.matches(admissionRef, OwnerWire.ref) else {
            throw LaunchError.invalidCapability
        }
        let (status, data) = try await HTTPJSON.postData(
            transport: transport, authorizer: authorizer,
            url: HTTPJSON.endpoint(base, "/v1/native/launch/capability"),
            body: ["contractVersion": LaunchContract.version, "workId": workId, "admissionRef": admissionRef],
            maxRequestBytes: LaunchContract.maxBodyBytes
        )
        return try OwnerWire.capabilityReply(status: status, data: data, workId: workId, admissionRef: admissionRef)
    }

    /// Resolves a launchable capability. Tenant and principal come from the verified
    /// local session, checked before and after the awaited call; the owner response carries neither.
    public func resolveCapability(workId: String, admissionRef: String, session: any SessionProvider, clock: any CoreClock) async throws -> LaunchCapability {
        let before = await session.currentSession()
        guard case .verified(let founderId, let tenantId, _) = before, before.admits(tenantId: tenantId, at: clock.now()) else {
            throw LaunchError.notAdmitted
        }
        let reply = try await ownerCapability(workId: workId, admissionRef: admissionRef)
        let after = await session.currentSession()
        guard after == before, after.admits(tenantId: tenantId, at: clock.now()) else { throw LaunchError.notAdmitted }
        switch reply {
        case .unsupported(let reason, _): throw LaunchError.capabilityUnsupported(reason)
        case .unavailable(let reason, _): throw LaunchError.capabilityUnavailable(reason)
        case .supported(let tuple):
            guard let plant = ExecutionPlant(rawValue: tuple.executionPlant), tuple.supportedAction == "launch" else {
                throw LaunchError.capabilityUnsupported("plant_or_action")
            }
            guard let expiry = CanonicalTimestamp.parse(tuple.expiresAt) else { throw LaunchError.invalidCapability }
            guard expiry > clock.now() else { throw LaunchError.expired }
            return LaunchCapability(
                tenantId: tenantId, principal: founderId, workId: tuple.workId, admissionRef: tuple.admissionRef,
                graphVersion: tuple.graphVersion, loadoutId: tuple.loadoutId, inputDigest: tuple.inputDigest,
                executionPlant: plant, supportedAction: tuple.supportedAction, expiresAt: tuple.expiresAt
            )
        }
    }

    /// The owner capability route needs an admission reference, which this legacy signature lacks.
    public func capability(workId: String, tenantId: String) async throws -> LaunchCapability {
        throw LaunchError.refused("admission_ref_required")
    }

    static func sendTuple(_ capability: LaunchCapability) throws -> LaunchCapabilityTuple {
        guard OwnerWire.matches(capability.workId, OwnerWire.workId),
              OwnerWire.matches(capability.admissionRef, OwnerWire.ref),
              capability.graphVersion >= 1,
              OwnerWire.matches(capability.loadoutId, OwnerWire.ref),
              OwnerWire.matches(capability.inputDigest, OwnerWire.digest),
              capability.supportedAction == "launch",
              OwnerWire.isoOK(capability.expiresAt) else {
            throw LaunchError.invalidCapability
        }
        return LaunchCapabilityTuple(
            workId: capability.workId, admissionRef: capability.admissionRef, graphVersion: capability.graphVersion,
            loadoutId: capability.loadoutId, inputDigest: capability.inputDigest,
            executionPlant: capability.executionPlant.rawValue, supportedAction: capability.supportedAction,
            expiresAt: capability.expiresAt
        )
    }

    public func preflight(capability: LaunchCapability, idempotencyNonce: String) throws {
        _ = try Self.sendTuple(capability)
        guard OwnerWire.matches(idempotencyNonce, OwnerWire.nonce) else { throw LaunchError.invalidCapability }
    }

    public func requestLaunch(capability: LaunchCapability, requestId: String, attemptId: String, idempotencyNonce: String) async throws -> LaunchRequestWire {
        try preflight(capability: capability, idempotencyNonce: idempotencyNonce)
        guard OwnerWire.matches(requestId, OwnerWire.clientId), OwnerWire.matches(attemptId, OwnerWire.clientId) else {
            throw LaunchError.invalidCapability
        }
        let tuple = try Self.sendTuple(capability)
        let nested: [String: Any] = [
            "workId": tuple.workId, "admissionRef": tuple.admissionRef, "graphVersion": tuple.graphVersion,
            "loadoutId": tuple.loadoutId, "inputDigest": tuple.inputDigest, "executionPlant": tuple.executionPlant,
            "supportedAction": tuple.supportedAction, "expiresAt": tuple.expiresAt
        ]
        let (status, data) = try await HTTPJSON.postData(
            transport: transport, authorizer: authorizer,
            url: HTTPJSON.endpoint(base, "/v1/native/launch"),
            body: [
                "contractVersion": LaunchContract.version, "requestId": requestId, "attemptId": attemptId,
                "idempotencyNonce": idempotencyNonce, "capability": nested
            ],
            maxRequestBytes: LaunchContract.maxBodyBytes
        )
        return try OwnerWire.launchWire(status: status, data: data, requestId: requestId, attemptId: attemptId, tuple: tuple)
    }

    /// Status readback with the original IDs. The tenant argument is ignored on the wire.
    public func attemptStatus(requestId: String, attemptId: String, tenantId: String) async throws -> AttemptStatusResult {
        guard OwnerWire.matches(requestId, OwnerWire.clientId), OwnerWire.matches(attemptId, OwnerWire.clientId) else {
            throw LaunchError.invalidCapability
        }
        let (status, data) = try await HTTPJSON.postData(
            transport: transport, authorizer: authorizer,
            url: HTTPJSON.endpoint(base, "/v1/native/launch/status"),
            body: ["contractVersion": LaunchContract.version, "requestId": requestId, "attemptId": attemptId],
            maxRequestBytes: LaunchContract.maxBodyBytes
        )
        return try OwnerWire.statusResult(status: status, data: data, requestId: requestId, attemptId: attemptId)
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
    case corruptRecord
    case unresolvedAttempt
    case capabilityUnsupported(String)
    case capabilityUnavailable(String)
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
    public var requestKey: String? = nil
    public var dispatch: String? = nil
    public var executionState: String? = nil
    public var ownerRef: String? = nil
    public var acceptance: String? = nil
    public var detail: String? = nil
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
    /// Work-level guards. Inserted before the first storage await, so concurrent
    /// launches or recoveries for one work cannot interleave.
    private var inFlight: Set<String> = []

    public init(client: any LaunchClient, session: any SessionProvider, clock: any CoreClock, store: any RecoveryStore) {
        self.client = client
        self.session = session
        self.clock = clock
        self.store = store
    }

    // Components are percent-encoded so ':' inside a work id cannot alias another key or prefix.
    private static let keySafe = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
    private static func enc(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: keySafe) ?? value }

    static func scopePrefix(tenantId: String, principal: String) -> String {
        "launch:v2:\(enc(tenantId)):\(enc(principal)):"
    }

    static func workPrefix(tenantId: String, principal: String, workId: String) -> String {
        scopePrefix(tenantId: tenantId, principal: principal) + enc(workId) + ":"
    }

    static func key(tenantId: String, principal: String, workId: String, nonce: String) -> String {
        workPrefix(tenantId: tenantId, principal: principal, workId: workId) + enc(nonce)
    }

    private static let resolved: Set<LaunchState> = [.complete, .failed, .refused, .expired, .busy]
    private static let pending: Set<LaunchState> = [.queued, .transmitting, .transmissionFailed, .persistenceFailed, .busy, .running, .outcomeUnknown]

    /// The tuple the owner was asked to launch. A status readback must echo it exactly.
    static func pinned(_ capability: LaunchCapability) -> LaunchCapabilityTuple {
        LaunchCapabilityTuple(
            workId: capability.workId, admissionRef: capability.admissionRef, graphVersion: capability.graphVersion,
            loadoutId: capability.loadoutId, inputDigest: capability.inputDigest,
            executionPlant: capability.executionPlant.rawValue, supportedAction: capability.supportedAction,
            expiresAt: capability.expiresAt
        )
    }

    /// Re-reads the session. Each await in this coordinator is followed by this check before a result is published.
    private func scopeHolds(tenantId: String, principal: String) async -> Bool {
        let current = await session.currentSession()
        guard case .verified(let founderId, let sessionTenant, _) = current else { return false }
        return sessionTenant == tenantId && founderId == principal && current.admits(tenantId: tenantId, at: clock.now())
    }

    private func requireScope(tenantId: String, principal: String) async throws {
        guard await scopeHolds(tenantId: tenantId, principal: principal) else { throw LaunchError.notAdmitted }
    }

    /// A record counts only when its stored key is the key derived from its own contents.
    /// A relocated or spliced record refuses instead of disappearing from enumeration.
    private func decode(_ data: Data?, expectedKey: String, tenantId: String, principal: String) throws -> LaunchAttemptRecord? {
        guard let data else { return nil }
        guard let record = try? JSONDecoder().decode(LaunchAttemptRecord.self, from: data),
              record.capability.tenantId == tenantId, record.capability.principal == principal,
              Self.key(tenantId: record.capability.tenantId, principal: record.capability.principal,
                       workId: record.capability.workId, nonce: record.idempotencyNonce) == expectedKey else {
            throw LaunchError.corruptRecord
        }
        return record
    }

    public func launch(capability: LaunchCapability, idempotencyNonce: String) async throws -> LaunchOutcome {
        try Self.validate(capability, now: clock.now())
        try Self.validateNonce(idempotencyNonce)

        // The guard is taken with no suspension point between check and insert.
        let guardKey = Self.workPrefix(tenantId: capability.tenantId, principal: capability.principal, workId: capability.workId)
        if inFlight.contains(guardKey) { throw LaunchError.concurrentExecution }
        inFlight.insert(guardKey)
        defer { inFlight.remove(guardKey) }

        try await requireScope(tenantId: capability.tenantId, principal: capability.principal)
        try client.preflight(capability: capability, idempotencyNonce: idempotencyNonce)

        let key = Self.key(tenantId: capability.tenantId, principal: capability.principal, workId: capability.workId, nonce: idempotencyNonce)
        var existing: LaunchAttemptRecord? = nil
        for other in try await store.keys(prefix: Self.scopePrefix(tenantId: capability.tenantId, principal: capability.principal)) {
            guard let record = try decode(try await store.load(key: other), expectedKey: other,
                                          tenantId: capability.tenantId, principal: capability.principal) else { continue }
            if other == key {
                existing = record
            } else if record.capability.workId == capability.workId, !Self.resolved.contains(record.state) {
                throw LaunchError.unresolvedAttempt
            } else if record.capability.admissionRef == capability.admissionRef {
                throw LaunchError.refused("admission_consumed")
            }
        }
        // The scan awaited storage. A switch during it must not publish a duplicate.
        try await requireScope(tenantId: capability.tenantId, principal: capability.principal)

        if let existing {
            guard existing.capability == capability, existing.idempotencyNonce == idempotencyNonce else {
                throw LaunchError.refused("nonce_reused_with_different_capability")
            }
            return LaunchOutcome(state: existing.state, record: existing)
        }

        try Self.validate(capability, now: clock.now())

        let requestId = "req-" + UUID().uuidString.lowercased()
        let attemptId = "att-" + UUID().uuidString.lowercased()
        var record = LaunchAttemptRecord(
            capability: capability, idempotencyNonce: idempotencyNonce,
            requestId: requestId, attemptId: attemptId, state: .transmitting,
            assignedRunId: nil, artifactRef: nil, receiptRef: nil, verdict: nil,
            updatedAt: Self.stamp(clock.now())
        )
        // Original IDs are durable before any bytes leave the process.
        do { try await store.save(try encoder(record), key: key) } catch { throw LaunchError.persistenceFailed }

        // The durable save is a suspension point. A switch or expiry here sends nothing,
        // so the unsent record is removed rather than left to block later launches.
        let stillCurrent = await scopeHolds(tenantId: capability.tenantId, principal: capability.principal)
        let unexpired = CanonicalTimestamp.parse(capability.expiresAt).map { $0 > clock.now() } ?? false
        guard stillCurrent, unexpired else {
            try? await store.remove(key: key)
            throw stillCurrent ? LaunchError.expired : LaunchError.notAdmitted
        }

        var wire: LaunchRequestWire? = nil
        var sendError = false
        do {
            wire = try await client.requestLaunch(capability: capability, requestId: requestId, attemptId: attemptId, idempotencyNonce: idempotencyNonce)
        } catch {
            sendError = true
        }

        // The owner may have accepted the request. If the session moved during the send, the attempt
        // stays uncertain under its original scope and the owner answer is not adopted.
        let held = await scopeHolds(tenantId: capability.tenantId, principal: capability.principal)
        record.updatedAt = Self.stamp(clock.now())
        if !held {
            record.state = .outcomeUnknown
            record.detail = "session_changed_after_send"
        } else if let wire, !sendError {
            if wire.requestId != requestId || wire.attemptId != attemptId {
                record.state = .outcomeUnknown
                record.detail = "mismatched_response_ids"
            } else {
                record.state = Self.state(for: wire.status)
                record.assignedRunId = wire.assignedRunId
                record.requestKey = wire.requestKey
                record.dispatch = wire.dispatch
                record.executionState = wire.executionState
                record.ownerRef = wire.ownerRef
                record.acceptance = wire.acceptance
                record.detail = wire.detail
            }
        } else {
            record.state = .transmissionFailed
        }

        do {
            try await store.save(try encoder(record), key: key)
        } catch {
            // The request may have reached the owner. Keep the original IDs, report unknown and never redispatch.
            record.state = .outcomeUnknown
            try? await store.save(try encoder(record), key: key)
        }

        // The outcome is durable under its original scope. A session that moved during that save gets no publication.
        try await requireScope(tenantId: capability.tenantId, principal: capability.principal)
        return LaunchOutcome(state: record.state, record: record)
    }

    public func recover(workId: String, idempotencyNonce: String) async throws -> LaunchOutcome {
        let first = await session.currentSession()
        guard case .verified(let founderId, let sessionTenant, _) = first,
              first.admits(tenantId: sessionTenant, at: clock.now()) else {
            throw LaunchError.notAdmitted
        }
        let guardKey = Self.workPrefix(tenantId: sessionTenant, principal: founderId, workId: workId)
        if inFlight.contains(guardKey) { throw LaunchError.concurrentExecution }
        inFlight.insert(guardKey)
        defer { inFlight.remove(guardKey) }

        let key = Self.key(tenantId: sessionTenant, principal: founderId, workId: workId, nonce: idempotencyNonce)
        guard var record = try decode(try await store.load(key: key), expectedKey: key, tenantId: sessionTenant, principal: founderId),
              record.capability.workId == workId, record.idempotencyNonce == idempotencyNonce else {
            throw LaunchError.recoveryUnavailable
        }
        // The load is a suspension point. A resolved record is published only while its scope still holds.
        try await requireScope(tenantId: sessionTenant, principal: founderId)
        if Self.resolved.contains(record.state) { return LaunchOutcome(state: record.state, record: record) }

        var changed = false
        do {
            let status = try await client.attemptStatus(requestId: record.requestId, attemptId: record.attemptId, tenantId: sessionTenant)
            try await requireScope(tenantId: sessionTenant, principal: founderId)
            if status.requestId != record.requestId || status.attemptId != record.attemptId {
                record.state = .outcomeUnknown
                record.detail = "mismatched_status_ids"
            } else if let echoed = status.capability, echoed != Self.pinned(record.capability) {
                // Same IDs with a different work, admission, input or plant: keep the attempt unknown and apply nothing.
                record.state = .outcomeUnknown
                record.detail = "mismatched_status_capability"
            } else {
                record.state = Self.state(for: status.status)
                record.assignedRunId = status.runId ?? record.assignedRunId
                record.artifactRef = status.artifactRef
                record.receiptRef = status.receiptRef
                record.verdict = status.verdict
                record.requestKey = status.requestKey ?? record.requestKey
                record.dispatch = status.dispatch ?? record.dispatch
                record.executionState = status.executionState ?? record.executionState
                record.ownerRef = status.ownerRef ?? record.ownerRef
                record.acceptance = status.acceptance ?? record.acceptance
                record.detail = status.detail
            }
            changed = true
        } catch LaunchError.notAdmitted {
            throw LaunchError.notAdmitted
        } catch {
            if [.transmitting, .transmissionFailed, .persistenceFailed].contains(record.state) {
                record.state = .outcomeUnknown
                changed = true
            }
        }
        if changed {
            record.updatedAt = Self.stamp(clock.now())
            do { try await store.save(try encoder(record), key: key) } catch { throw LaunchError.persistenceFailed }
        }
        // Recovery does not check capability expiry: the owner status is still valid while the session is.
        try await requireScope(tenantId: sessionTenant, principal: founderId)
        return LaunchOutcome(state: record.state, record: record)
    }

    public func pendingRecoveries() async throws -> [LaunchAttemptRecord] {
        let first = await session.currentSession()
        guard case .verified(let founderId, let sessionTenant, _) = first,
              first.admits(tenantId: sessionTenant, at: clock.now()) else { return [] }
        var out: [LaunchAttemptRecord] = []
        for key in try await store.keys(prefix: Self.scopePrefix(tenantId: sessionTenant, principal: founderId)) {
            guard let record = try decode(try await store.load(key: key), expectedKey: key, tenantId: sessionTenant, principal: founderId) else { continue }
            if Self.pending.contains(record.state) && record.state != .busy { out.append(record) }
        }
        let last = await session.currentSession()
        guard last == first, last.admits(tenantId: sessionTenant, at: clock.now()) else { return [] }
        return out
    }

    static func state(for wire: LaunchStatusWire) -> LaunchState {
        switch wire {
        case .queued: return .queued
        case .busy: return .busy
        case .running: return .running
        case .complete: return .complete
        case .failed: return .failed
        case .refused: return .refused
        case .expired: return .expired
        case .unknown: return .outcomeUnknown
        }
    }

    static func validate(_ capability: LaunchCapability, now: Date) throws {
        let fields = [
            capability.tenantId, capability.principal, capability.workId,
            capability.admissionRef, capability.loadoutId, capability.inputDigest, capability.supportedAction
        ]
        for item in fields where item.isEmpty { throw LaunchError.invalidCapability }
        guard capability.tenantId.utf8.count <= 64, capability.principal.utf8.count <= 240,
              capability.workId.utf8.count <= 220 else { throw LaunchError.invalidCapability }
        guard capability.graphVersion >= 0 else { throw LaunchError.invalidCapability }
        guard let expiry = CanonicalTimestamp.parse(capability.expiresAt) else { throw LaunchError.invalidCapability }
        guard expiry > now else { throw LaunchError.expired }
    }

    static func validateNonce(_ nonce: String) throws {
        guard nonce.range(of: #"^[A-Za-z0-9_.:-]{1,128}\z"#, options: .regularExpression) != nil else {
            throw LaunchError.invalidCapability
        }
    }

    private static func stamp(_ date: Date) -> String { CanonicalTimestamp.string(from: date) }
    private func encoder(_ record: LaunchAttemptRecord) throws -> Data { try JSONEncoder().encode(record) }
}
