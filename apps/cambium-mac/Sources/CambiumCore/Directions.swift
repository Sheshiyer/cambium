import Foundation

enum DirectionEndpoint {
    case collection, record(String), executionReview(String), proposal(String), admission, result(String)
    case workIntake, directionWorkReview(String), resultReview, workAdmission, claimResult
    func path(tenant: String) -> String? {
        switch self {
        case .collection: return "/v1/directions/" + tenant
        case .workIntake: return "/v1/native/work/intake"
        case .resultReview: return "/v1/native/work/result/review"
        case .workAdmission: return "/v1/native/work/admit"
        case .claimResult: return "/v1/native/work/result"
        case .admission: return "/v1/direction-executions/" + tenant + "/admit"
        case .result(let id):
            guard id.range(of: #"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"#, options: .regularExpression) != nil else { return nil }
            return "/v1/direction-executions/" + tenant + "/" + id + "/result"
        case .record(let id), .executionReview(let id), .proposal(let id), .directionWorkReview(let id):
            guard id.range(of: #"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"#, options: .regularExpression) != nil else { return nil }
            let base = "/v1/directions/" + tenant + "/" + id
            switch self { case .record: return base; case .executionReview: return base + "/execution-review"; case .directionWorkReview: return base + "/review"; default: return base + "/proposal" }
        }
    }
}

public struct DirectionSignalPin: Codable, Equatable, Sendable {
    public let id: String
    public let revision: Int
    public init(id: String, revision: Int) { self.id = id; self.revision = revision }
}
public struct DirectionWorkContext: Codable, Equatable, Sendable {
    public let workObjectId: String
    public let workNodeId: String
    public let graphHeadDigest: String
    public init(workObjectId: String, workNodeId: String, graphHeadDigest: String) {
        self.workObjectId = workObjectId; self.workNodeId = workNodeId; self.graphHeadDigest = graphHeadDigest
    }
}
public struct DirectionDraft: Codable, Equatable, Sendable {
    public let title: String
    public let body: String
    public let workObjectId: String
    public let workNodeId: String
    public let graphHeadDigest: String
    public let signalPins: [DirectionSignalPin]
    public init(title: String, body: String, work: DirectionWorkContext, signalPins: [DirectionSignalPin]) {
        self.title = title; self.body = body; workObjectId = work.workObjectId; workNodeId = work.workNodeId
        graphHeadDigest = work.graphHeadDigest; self.signalPins = signalPins
    }
}
public struct SharedDirection: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let tenantId: String
    public let principal: String
    public let title: String
    public let body: String
    public let workObjectId: String
    public let workNodeId: String
    public let graphHeadDigest: String
    public let signalPins: [DirectionSignalPin]
    public let revision: Int
    public let createdAt: String
    public let updatedAt: String
}
public struct DirectionCreate: Encodable, Equatable, Sendable {
    public let schema = "cambium.direction-create.v1"
    public let operationId: String
    public let draft: DirectionDraft
    public init(operationId: String, draft: DirectionDraft) { self.operationId = operationId; self.draft = draft }
}
public struct DirectionUpdate: Encodable, Equatable, Sendable {
    public let schema = "cambium.direction-update.v1"
    public let operationId: String
    public let expectedRevision: Int
    public let draft: DirectionDraft
    public init(operationId: String, expectedRevision: Int, draft: DirectionDraft) {
        self.operationId = operationId; self.expectedRevision = expectedRevision; self.draft = draft
    }
}
public struct DirectionList: Decodable, Sendable {
    public let schema: String
    public let tenantId: String
    public let principal: String
    public let directions: [SharedDirection]
    public let workContext: DirectionWorkContext?
}
public struct DirectionResult: Decodable, Sendable {
    public let schema: String
    public let tenantId: String
    public let principal: String
    public let direction: SharedDirection
    public let replayed: Bool
}
public struct PreparedWork: Decodable, Sendable {
    public let schema: String
    public let tenantId: String
    public let proposalId: String
}
public struct WorkAdmission: Decodable, Sendable {
    public let schema: String
    public let tenantId: String
    public let workId: String
    public let admissionRef: String
}
public struct ClaimProofResult: Decodable, Sendable {
    public struct Verdict: Decodable, Sendable {
        public let schema: String
        public let proposalId: String
        public let decision: String
        public let decidedAt: String
        public let artifactDigest: String
        public let inputDigest: String
        public let canonicalReadback: Bool
    }
    public struct Artifact: Decodable, Sendable {
        public let digest: String
        public let markdown: String
        public let claimCount: Int
        public let sourceManifestDigest: String
    }
    public let schema: String
    public let tenantId: String
    public let workId: String
    public let admissionRef: String
    public let requestId: String
    public let attemptId: String
    public let taskId: String
    public let inputDigest: String
    public let execution: String
    public let artifact: Artifact?
    public let acceptance: String
    public let founderVerdict: Verdict?
}

/// Saved drafts carry exact source revisions. This client never approves or launches work.
public struct DirectionHTTPClient: Sendable {
    private let origin: HTTPOriginPolicy
    private let transport: any HTTPTransport
    private let authorizer: any RequestAuthorizer
    private let sessions: any SessionProvider
    private let clock: any CoreClock
    public init(origin: HTTPOriginPolicy, transport: any HTTPTransport, authorizer: any RequestAuthorizer, sessionProvider: any SessionProvider, clock: any CoreClock = SystemCoreClock()) {
        self.origin = origin; self.transport = transport; self.authorizer = authorizer; self.sessions = sessionProvider; self.clock = clock
    }
    public func list(tenant: String, workObjectId: String = "sapling:cambium") async throws -> DirectionList {
        guard ["sapling:cambium", "sapling:iverif"].contains(workObjectId) else { throw SignalError.invalidRequest }
        let (data, context) = try await request("GET", tenant: tenant, workFilter: workObjectId == "sapling:cambium" ? nil : workObjectId)
        let result = try JSONDecoder().decode(DirectionList.self, from: data)
        guard result.schema == "cambium.direction-list.v1", result.tenantId == context.tenantId, result.principal == context.principal,
              result.directions.count <= 100, Set(result.directions.map(\.id)).count == result.directions.count else { throw SignalError.scope }
        if let work = result.workContext { guard Self.workValid(work), work.workObjectId == workObjectId else { throw SignalError.invalid } }
        for row in result.directions { try Self.validate(row, context: context); guard row.workObjectId == workObjectId else { throw SignalError.scope } }
        return result
    }
    public func create(tenant: String, value: DirectionCreate) async throws -> DirectionResult {
        guard Self.identifier(value.operationId), Self.draftValid(value.draft) else { throw SignalError.invalidRequest }
        let (data, context) = try await request("POST", tenant: tenant, body: JSONEncoder().encode(value))
        let result = try JSONDecoder().decode(DirectionResult.self, from: data)
        guard result.schema == "cambium.direction-result.v1", result.tenantId == context.tenantId, result.principal == context.principal else { throw SignalError.scope }
        try Self.validate(result.direction, context: context)
        let row = result.direction, draft = value.draft
        guard row.title == draft.title, row.body == draft.body, row.workObjectId == draft.workObjectId, row.workNodeId == draft.workNodeId,
              row.graphHeadDigest == draft.graphHeadDigest, row.signalPins == draft.signalPins, row.revision == 1 else { throw SignalError.invalid }
        return result
    }
    public func prepareWork(tenant: String, workObjectId: String, operationId: String) async throws -> PreparedWork {
        guard ["sapling:cambium", "sapling:iverif"].contains(workObjectId), Self.identifier(operationId) else { throw SignalError.invalidRequest }
        return try await prepare(tenant: tenant, endpoint: .workIntake, fields: ["workObjectId":workObjectId,"operationId":operationId])
    }
    public func update(tenant: String, id: String, value: DirectionUpdate) async throws -> DirectionResult {
        guard Self.identifier(id), Self.identifier(value.operationId), value.expectedRevision > 0,
              value.expectedRevision < 9007199254740991, Self.draftValid(value.draft) else { throw SignalError.invalidRequest }
        let (data, context) = try await request("PUT", tenant: tenant, body: JSONEncoder().encode(value), endpoint: .record(id))
        let result = try JSONDecoder().decode(DirectionResult.self, from: data)
        guard result.schema == "cambium.direction-result.v1", result.tenantId == context.tenantId, result.principal == context.principal else { throw SignalError.scope }
        try Self.validate(result.direction, context: context)
        let row = result.direction, draft = value.draft
        guard row.id == id, row.revision == value.expectedRevision + 1, row.title == draft.title, row.body == draft.body,
              row.workObjectId == draft.workObjectId, row.workNodeId == draft.workNodeId,
              row.graphHeadDigest == draft.graphHeadDigest, row.signalPins == draft.signalPins else { throw SignalError.invalid }
        return result
    }
    public func prepareReview(tenant: String, direction: SharedDirection, operationId: String) async throws -> PreparedWork {
        guard Self.identifier(direction.id), direction.workObjectId == "sapling:iverif", direction.revision > 0, Self.identifier(operationId) else { throw SignalError.invalidRequest }
        return try await prepare(tenant: tenant, endpoint: .directionWorkReview(direction.id), fields: ["revision":direction.revision,"operationId":operationId])
    }
    private func prepare(tenant: String, endpoint: DirectionEndpoint, fields: [String: Any]) async throws -> PreparedWork {
        let (data, context) = try await request("POST", tenant: tenant, body: JSONSerialization.data(withJSONObject: fields), endpoint: endpoint)
        let result = try JSONDecoder().decode(PreparedWork.self, from: data)
        guard result.schema == "cambium.native.work-preparation.v1", result.tenantId == context.tenantId,
              result.proposalId.range(of: "^" + NSRegularExpression.escapedPattern(for: tenant) + ":(?:sha256:)?[a-f0-9]{64}$", options: .regularExpression) != nil else { throw SignalError.scope }
        return result
    }
    public func prepareResultReview(tenant: String, admissionRef: String, operationId: String) async throws -> PreparedWork {
        guard admissionRef.range(of: #"^claim-admission:goal_[a-f0-9]{64}$"#, options: .regularExpression) != nil, Self.identifier(operationId) else { throw SignalError.invalidRequest }
        return try await prepare(tenant: tenant, endpoint: .resultReview, fields: ["admissionRef":admissionRef,"operationId":operationId])
    }
    public func admit(tenant: String, proposalId: String) async throws -> WorkAdmission {
        let (data, context) = try await request("POST", tenant: tenant, body: JSONSerialization.data(withJSONObject: ["proposalId":proposalId]), endpoint: .workAdmission)
        let result = try JSONDecoder().decode(WorkAdmission.self, from: data)
        guard result.schema == "cambium.native.work-admission.v1", result.tenantId == context.tenantId, result.workId == "sapling:iverif",
              result.admissionRef.range(of: #"^claim-admission:goal_[a-f0-9]{64}$"#, options: .regularExpression) != nil else { throw SignalError.scope }
        return result
    }
    public func claimResult(tenant: String, admissionRef: String) async throws -> ClaimProofResult {
        guard admissionRef.range(of: #"^claim-admission:goal_[a-f0-9]{64}$"#, options: .regularExpression) != nil else { throw SignalError.invalidRequest }
        let (data, context) = try await request("GET", tenant: tenant, endpoint: .claimResult, query: [URLQueryItem(name:"admissionRef",value:admissionRef)])
        let result = try JSONDecoder().decode(ClaimProofResult.self, from: data)
        guard result.schema == "cambium.iverif.claim-result.v1", result.tenantId == context.tenantId, result.workId == "sapling:iverif", result.admissionRef == admissionRef,
              ["queued","running","succeeded","failed"].contains(result.execution),
              ["awaiting-founder-and-owner-review","awaiting-owner-review","accepted","rejected","review-required"].contains(result.acceptance),
              Self.identifier(result.requestId), Self.identifier(result.attemptId), Self.identifier(result.taskId),
              result.inputDigest.range(of: #"^sha256:[a-f0-9]{64}$"#, options: .regularExpression) != nil else { throw SignalError.scope }
        if let artifact = result.artifact { guard artifact.digest.range(of: #"^sha256:[a-f0-9]{64}$"#, options: .regularExpression) != nil,
            artifact.sourceManifestDigest.range(of: #"^sha256:[a-f0-9]{64}$"#, options: .regularExpression) != nil,
            artifact.claimCount > 0, artifact.claimCount <= 4096, artifact.markdown.utf8.count < HTTPLimits.maxResponseBytes else { throw SignalError.invalid } }
        if let verdict = result.founderVerdict {
            guard verdict.schema == "cambium.iverif.result-verdict.v1", verdict.canonicalReadback,
                ["approved","rejected"].contains(verdict.decision), verdict.inputDigest == result.inputDigest,
                verdict.artifactDigest == result.artifact?.digest,
                verdict.proposalId.range(of: #"^cambium:(?:sha256:)?[a-f0-9]{64}$"#, options: .regularExpression) != nil,
                CanonicalTimestamp.parse(verdict.decidedAt) != nil else { throw SignalError.invalid }
        }
        if ["accepted","awaiting-owner-review"].contains(result.acceptance) { guard result.founderVerdict?.decision == "approved" else { throw SignalError.invalid } }
        if result.acceptance == "rejected" { guard result.founderVerdict?.decision == "rejected" else { throw SignalError.invalid } }
        return result
    }
    func request(_ method: String, tenant: String, body: Data? = nil, endpoint: DirectionEndpoint = .collection, workFilter: String? = nil, query: [URLQueryItem] = []) async throws -> (Data, AuthenticatedReaderContext) {
        guard MissionFabricTenant.isValid(tenant), (body?.count ?? 0) <= 65536 else { throw SignalError.invalidRequest }
        guard let path = endpoint.path(tenant: tenant) else { throw SignalError.invalidRequest }
        var c = URLComponents(); c.scheme = origin.scheme; c.host = origin.host; c.port = origin.explicitPort
        c.percentEncodedPath = origin.basePath + path
        if let workFilter { c.queryItems = [URLQueryItem(name:"workObjectId",value:workFilter)] } else if !query.isEmpty { c.queryItems = query }
        guard let url = c.url, origin.admits(url) else { throw SignalError.invalidRequest }
        let context = try AuthenticatedReaderContext.derive(from: await sessions.currentSession(), tenantId: tenant, at: clock.now())
        var headers = try await authorizer.headers(for: url)
        let auth = headers.filter { $0.key.lowercased() == "authorization" }
        guard auth.count == 1, auth.first?.value.hasPrefix("Bearer ") == true,
              !headers.keys.contains(where: { ["cookie", "x-api-key", "x-auth-token", "x-access-token", "proxy-authorization"].contains($0.lowercased()) }) else { throw SignalError.authorization }
        headers = headers.filter { !["accept", "content-type"].contains($0.key.lowercased()) }
        headers["accept"] = "application/json"; if body != nil { headers["content-type"] = "application/json" }
        try context.check(against: await sessions.currentSession(), at: clock.now())
        let response = try await transport.send(HTTPRequest(method: method, url: url, headers: headers, body: body))
        try context.check(against: await sessions.currentSession(), at: clock.now())
        guard response.status == 200 || (method == "POST" && response.status == 201) else { throw SignalError.status(response.status) }
        guard response.body.count <= HTTPLimits.maxResponseBytes else { throw SignalError.tooLarge }
        return (response.body, context)
    }
    private static func identifier(_ value: String) -> Bool { value.range(of: #"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"#, options: .regularExpression) != nil }
    private static func workValid(_ work: DirectionWorkContext) -> Bool {
        ["sapling:cambium", "sapling:iverif"].contains(work.workObjectId) && identifier(work.workNodeId) && work.graphHeadDigest.range(of: #"^[a-f0-9]{64}$"#, options: .regularExpression) != nil
    }
    private static func draftValid(_ draft: DirectionDraft) -> Bool {
        !draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && draft.title.utf16.count <= 200 && !draft.title.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) })
        && draft.body.utf16.count <= 16000 && !draft.body.unicodeScalars.contains(where: { $0.value < 32 && ![9,10,13].contains($0.value) || $0.value == 127 })
        && workValid(DirectionWorkContext(workObjectId: draft.workObjectId, workNodeId: draft.workNodeId, graphHeadDigest: draft.graphHeadDigest))
        && (1...16).contains(draft.signalPins.count) && Set(draft.signalPins.map(\.id)).count == draft.signalPins.count && draft.signalPins.allSatisfy { identifier($0.id) && $0.revision > 0 && $0.revision <= 9007199254740991 }
    }
    private static func validate(_ row: SharedDirection, context: AuthenticatedReaderContext) throws {
        guard row.tenantId == context.tenantId, row.principal == context.principal else { throw SignalError.scope }
        let draft = DirectionDraft(title: row.title, body: row.body, work: DirectionWorkContext(workObjectId: row.workObjectId, workNodeId: row.workNodeId, graphHeadDigest: row.graphHeadDigest), signalPins: row.signalPins)
        guard identifier(row.id), row.revision > 0, draftValid(draft), let created = CanonicalTimestamp.parse(row.createdAt), let updated = CanonicalTimestamp.parse(row.updatedAt),
              CanonicalTimestamp.string(from: created) == row.createdAt, CanonicalTimestamp.string(from: updated) == row.updatedAt, updated >= created else { throw SignalError.invalid }
    }
}
