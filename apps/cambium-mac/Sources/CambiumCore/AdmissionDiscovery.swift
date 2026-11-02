import Foundation

// Native launch admission discovery client (`cambium.native-launch.v1`).
// Read-only discovery seam for listing already-admitted units for a given work.
// Owner source: workers/quests/src/native-launch.ts and docs/NATIVE-LAUNCH-CONTRACT.md.

public enum AdmissionAvailability: String, Codable, Sendable, Equatable {
    case supported
    case unsupported
    case unavailable
}

public struct AdmissionDiscoveryRecord: Sendable, Equatable {
    public var admissionRef: String
    public var tuple: LaunchCapabilityTuple
    public var availability: AdmissionAvailability
    public var reason: String
    public var existingRequest: LaunchExistingRequest?

    public init(
        admissionRef: String, tuple: LaunchCapabilityTuple,
        availability: AdmissionAvailability, reason: String,
        existingRequest: LaunchExistingRequest? = nil
    ) {
        self.admissionRef = admissionRef
        self.tuple = tuple
        self.availability = availability
        self.reason = reason
        self.existingRequest = existingRequest
    }
}

public struct AdmissionDiscoveryResult: Sendable, Equatable {
    public var workId: String
    public var readOnly: Bool
    public var admissions: [AdmissionDiscoveryRecord]
    public var truncated: Bool

    public init(workId: String, readOnly: Bool, admissions: [AdmissionDiscoveryRecord], truncated: Bool) {
        self.workId = workId
        self.readOnly = readOnly
        self.admissions = admissions
        self.truncated = truncated
    }
}

public enum AdmissionDiscoveryError: Error, Equatable, Sendable {
    case unconfigured
    case notAdmitted
    case tenantMismatch
    case expiredIdentity
    case principalSwitched
    case invalidWorkId
    case unauthorized
    case forbidden
    case unavailable
    case responseTooLarge
    case malformedResponse
    case transport(String)
}

public protocol AdmissionDiscovering: Sendable {
    func discoverAdmissions(
        workId: String,
        session: any SessionProvider,
        clock: any CoreClock
    ) async throws -> AdmissionDiscoveryResult
}

public struct UnconfiguredAdmissionDiscovery: AdmissionDiscovering {
    public init() {}
    public func discoverAdmissions(
        workId: String,
        session: any SessionProvider,
        clock: any CoreClock
    ) async throws -> AdmissionDiscoveryResult {
        throw AdmissionDiscoveryError.unconfigured
    }
}

public struct HTTPAdmissionDiscovery: AdmissionDiscovering {
    private let base: URL
    private let transport: any HTTPTransport
    private let authorizer: any RequestAuthorizer
    private let maxResponseBytes: Int

    public init(
        baseURL: URL,
        transport: any HTTPTransport,
        authorizer: any RequestAuthorizer,
        maxResponseBytes: Int = HTTPLimits.maxResponseBytes
    ) {
        self.base = baseURL
        self.transport = transport
        self.authorizer = authorizer
        self.maxResponseBytes = min(maxResponseBytes, HTTPLimits.maxResponseBytes)
    }

    public func discoverAdmissions(
        workId: String,
        session: any SessionProvider,
        clock: any CoreClock
    ) async throws -> AdmissionDiscoveryResult {
        guard OwnerWire.matches(workId, OwnerWire.workId) else {
            throw AdmissionDiscoveryError.invalidWorkId
        }

        let before = await session.currentSession()
        guard case .verified(_, let tenantId, _) = before, before.admits(tenantId: tenantId, at: clock.now()) else {
            throw AdmissionDiscoveryError.notAdmitted
        }

        let status: Int
        let data: Data
        do {
            let pair = try await HTTPJSON.postData(
                transport: transport, authorizer: authorizer,
                url: HTTPJSON.endpoint(base, "/v1/native/launch/admissions"),
                body: ["contractVersion": LaunchContract.version, "workId": workId],
                maxRequestBytes: LaunchContract.maxBodyBytes
            )
            status = pair.status
            data = pair.body
        } catch let failure as TransportFailure {
            switch failure {
            case .unauthorized: throw AdmissionDiscoveryError.unauthorized
            case .responseTooLarge: throw AdmissionDiscoveryError.responseTooLarge
            default: throw AdmissionDiscoveryError.transport("transport")
            }
        } catch {
            throw AdmissionDiscoveryError.transport("transport")
        }

        let after = await session.currentSession()
        guard after == before, after.admits(tenantId: tenantId, at: clock.now()) else {
            throw AdmissionDiscoveryError.notAdmitted
        }

        switch status {
        case 200: break
        case 401: throw AdmissionDiscoveryError.unauthorized
        case 403: throw AdmissionDiscoveryError.forbidden
        case 503: throw AdmissionDiscoveryError.unavailable
        default: throw AdmissionDiscoveryError.malformedResponse
        }

        guard data.count <= maxResponseBytes else { throw AdmissionDiscoveryError.responseTooLarge }
        return try AdmissionDiscoveryWire.decode(data, workId: workId)
    }
}

/// Strict decoder for the discovery reply. Any deviation is malformed; nothing is defaulted.
enum AdmissionDiscoveryWire {
    static let maxEntries = 32
    static let rootKeys: Set<String> = ["contractVersion", "workId", "readOnly", "admissions", "truncated"]
    static let unavailableReasons: Set<String> = ["admission_expired", "admission_revoked", "graph_changed", "admission_consumed"]

    static func decode(_ data: Data, workId: String) throws -> AdmissionDiscoveryResult {
        let o: OwnerWire.Object
        do { o = try OwnerWire.root(data) } catch { throw AdmissionDiscoveryError.malformedResponse }
        guard Set(o.keys) == rootKeys,
              OwnerWire.string(o, "workId") == workId,
              OwnerWire.bool(o, "readOnly") == true,
              let truncated = OwnerWire.bool(o, "truncated"),
              case .array(let rawAdmissions)? = o["admissions"],
              rawAdmissions.count <= maxEntries else {
            throw AdmissionDiscoveryError.malformedResponse
        }
        var records: [AdmissionDiscoveryRecord] = []
        var seenRefs: Set<String> = []
        for item in rawAdmissions {
            let record = try entry(item, workId: workId)
            guard seenRefs.insert(record.admissionRef).inserted else { throw AdmissionDiscoveryError.malformedResponse }
            records.append(record)
        }
        return AdmissionDiscoveryResult(workId: workId, readOnly: true, admissions: records, truncated: truncated)
    }

    static func entry(_ item: JSONValue, workId: String) throws -> AdmissionDiscoveryRecord {
        guard case .object(let node) = item else { throw AdmissionDiscoveryError.malformedResponse }
        let base: Set<String> = ["admissionRef", "tuple", "availability", "reason"]
        let keys = Set(node.keys)
        guard keys == base || keys == base.union(["existingRequest"]),
              let admissionRef = OwnerWire.string(node, "admissionRef"), OwnerWire.matches(admissionRef, OwnerWire.ref),
              let rawTuple = OwnerWire.object(node, "tuple"),
              let tuple = try? OwnerWire.tuple(rawTuple),
              tuple.workId == workId, tuple.admissionRef == admissionRef,
              let availabilityText = OwnerWire.string(node, "availability"),
              let availability = AdmissionAvailability(rawValue: availabilityText),
              let reason = OwnerWire.string(node, "reason") else {
            throw AdmissionDiscoveryError.malformedResponse
        }
        switch availability {
        case .supported: guard reason == "current" else { throw AdmissionDiscoveryError.malformedResponse }
        case .unsupported: guard reason == "owner_does_not_support" else { throw AdmissionDiscoveryError.malformedResponse }
        case .unavailable: guard unavailableReasons.contains(reason) else { throw AdmissionDiscoveryError.malformedResponse }
        }
        var existing: LaunchExistingRequest? = nil
        if keys.contains("existingRequest") {
            guard let raw = OwnerWire.object(node, "existingRequest"),
                  Set(raw.keys) == ["requestId", "attemptId"],
                  let requestId = OwnerWire.string(raw, "requestId"), OwnerWire.matches(requestId, OwnerWire.clientId),
                  let attemptId = OwnerWire.string(raw, "attemptId"), OwnerWire.matches(attemptId, OwnerWire.clientId) else {
                throw AdmissionDiscoveryError.malformedResponse
            }
            existing = LaunchExistingRequest(requestId: requestId, attemptId: attemptId)
        }
        // A consumed admission must name the request that consumed it; a supported one cannot have one.
        if reason == "admission_consumed", existing == nil { throw AdmissionDiscoveryError.malformedResponse }
        if availability == .supported, existing != nil { throw AdmissionDiscoveryError.malformedResponse }
        return AdmissionDiscoveryRecord(admissionRef: admissionRef, tuple: tuple, availability: availability,
                                        reason: reason, existingRequest: existing)
    }
}
