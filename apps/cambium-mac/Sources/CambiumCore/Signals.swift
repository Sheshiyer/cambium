import Foundation

public struct SignalSource: Codable, Equatable, Sendable {
    public let system: String
    public let recordId: String
    public let version: String
    public let reference: String?
    public let observedAt: String
    public init(system: String, recordId: String, version: String, reference: String?, observedAt: String) {
        self.system = system; self.recordId = recordId; self.version = version
        self.reference = reference; self.observedAt = observedAt
    }
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(system, forKey: .system); try container.encode(recordId, forKey: .recordId)
        try container.encode(version, forKey: .version); try container.encode(reference, forKey: .reference)
        try container.encode(observedAt, forKey: .observedAt)
    }
}

public struct Signal: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let tenantId: String
    public let principal: String
    public let title: String
    public let body: String
    public let source: SignalSource
    public let projectIds: [String]
    public let revision: Int
    public let createdAt: String
    public let updatedAt: String
}

public struct SignalCapture: Encodable, Equatable, Sendable {
    public let schema = "cambium.signal-capture.v1"
    public let operationId: String
    public let title: String
    public let body: String
    public let source: SignalSource
    public let projectIds: [String]
    public init(operationId: String, title: String, body: String, source: SignalSource, projectIds: [String]) {
        self.operationId = operationId; self.title = title; self.body = body; self.source = source; self.projectIds = projectIds
    }
}

public struct SignalUpdate: Encodable, Equatable, Sendable {
    public let schema = "cambium.signal-update.v1"
    public let operationId: String
    public let expectedRevision: Int
    public let title: String
    public let body: String
    public let projectIds: [String]
    public init(operationId: String, expectedRevision: Int, title: String, body: String, projectIds: [String]) {
        self.operationId = operationId; self.expectedRevision = expectedRevision; self.title = title; self.body = body; self.projectIds = projectIds
    }
}

public struct SignalList: Decodable, Sendable {
    public let schema: String
    public let tenantId: String
    public let principal: String
    public let signals: [Signal]
    public let nextCursor: String?
}
public struct SignalResult: Decodable, Sendable {
    public let schema: String
    public let tenantId: String
    public let principal: String
    public let signal: Signal
    public let replayed: Bool
}
public enum SignalError: Error, Equatable {
    /// Validation failed before transport; no save was submitted.
    case invalidRequest
    /// A received response failed validation; a save may have committed.
    case invalid, scope, authorization, status(Int), tooLarge
}

/// Scoped, ephemeral transport. A save value can be retained and sent again unchanged.
public struct SignalHTTPClient: Sendable {
    private let origin: HTTPOriginPolicy
    private let transport: any HTTPTransport
    private let authorizer: any RequestAuthorizer
    private let sessions: any SessionProvider
    private let clock: any CoreClock
    public init(origin: HTTPOriginPolicy, transport: any HTTPTransport, authorizer: any RequestAuthorizer,
                sessionProvider: any SessionProvider, clock: any CoreClock = SystemCoreClock()) {
        self.origin = origin; self.transport = transport; self.authorizer = authorizer; self.sessions = sessionProvider; self.clock = clock
    }
    public func list(tenant: String, projectId: String? = nil, cursor: String? = nil) async throws -> SignalList {
        if let projectId { guard Self.identifier(projectId) else { throw SignalError.invalid } }
        if let cursor { guard cursor.count <= 512, cursor.range(of: #"^[A-Za-z0-9_-]+$"#, options: .regularExpression) != nil else { throw SignalError.invalid } }
        let (data, context) = try await request("GET", tenant: tenant, query: [("projectId", projectId), ("cursor", cursor)])
        let object = try Self.object(data, keys: ["schema", "tenantId", "principal", "signals", "nextCursor"])
        guard let rows = object["signals"] as? [[String: Any]], rows.count <= 100 else { throw SignalError.invalid }
        for row in rows { try Self.validate(row, context: context) }
        let result = try JSONDecoder().decode(SignalList.self, from: data)
        guard result.schema == "cambium.signal-list.v1", result.tenantId == context.tenantId,
              result.principal == context.principal, result.nextCursor.map({ $0.count <= 512 && $0.range(of: #"^[A-Za-z0-9_-]+$"#, options: .regularExpression) != nil }) ?? true else { throw SignalError.scope }
        if let projectId, result.signals.contains(where: { !$0.projectIds.contains(projectId) }) { throw SignalError.invalid }
        return result
    }
    public func read(tenant: String, id: String) async throws -> SignalResult {
        try await result("GET", tenant: tenant, id: id, body: nil)
    }
    public func capture(tenant: String, value: SignalCapture) async throws -> SignalResult {
        guard Self.identifier(value.operationId), Self.content(value.title, value.body, value.projectIds), Self.sourceValid(value.source) else { throw SignalError.invalidRequest }
        return try await result("POST", tenant: tenant, id: nil, body: Self.encode(value))
    }
    public func update(tenant: String, id: String, value: SignalUpdate) async throws -> SignalResult {
        guard Self.identifier(value.operationId), value.expectedRevision > 0, Self.content(value.title, value.body, value.projectIds) else { throw SignalError.invalidRequest }
        return try await result("PUT", tenant: tenant, id: id, body: Self.encode(value))
    }
    private static func encode<T: Encodable>(_ value: T) throws -> Data {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]; return try encoder.encode(value)
    }
    private func result(_ method: String, tenant: String, id: String?, body: Data?) async throws -> SignalResult {
        let (data, context) = try await request(method, tenant: tenant, id: id, body: body)
        let obj = try Self.object(data, keys: ["schema", "tenantId", "principal", "signal", "replayed"])
        guard let signal = obj["signal"] as? [String: Any] else { throw SignalError.invalid }
        try Self.validate(signal, context: context)
        let value = try JSONDecoder().decode(SignalResult.self, from: data)
        guard value.schema == "cambium.signal-result.v1", value.tenantId == context.tenantId,
              value.principal == context.principal, id == nil || value.signal.id == id else { throw SignalError.scope }
        return value
    }
    private func request(_ method: String, tenant: String, id: String? = nil, query: [(String, String?)] = [], body: Data? = nil) async throws -> (Data, AuthenticatedReaderContext) {
        guard MissionFabricTenant.isValid(tenant), id.map({ Self.pathIdentifier($0) }) ?? true, (body?.count ?? 0) <= 65536 else { throw SignalError.invalidRequest }
        var components = URLComponents(); components.scheme = origin.scheme; components.host = origin.host; components.port = origin.explicitPort
        components.percentEncodedPath = origin.basePath + "/v1/signals/" + tenant + (id.map { "/" + $0 } ?? "")
        let items = query.compactMap { key, value in value.map { URLQueryItem(name: key, value: $0) } }
        if !items.isEmpty { components.queryItems = items }
        guard let url = components.url, origin.admits(url) else { throw SignalError.invalidRequest }
        let context = try AuthenticatedReaderContext.derive(from: await sessions.currentSession(), tenantId: tenant, at: clock.now())
        var headers = try await authorizer.headers(for: url)
        let auth = headers.filter { $0.key.lowercased() == "authorization" }
        guard auth.count == 1, auth.first?.value.hasPrefix("Bearer ") == true,
              !headers.keys.contains(where: { ["cookie", "x-api-key", "proxy-authorization"].contains($0.lowercased()) }) else { throw SignalError.authorization }
        headers = headers.filter { !["accept", "content-type"].contains($0.key.lowercased()) }
        headers["accept"] = "application/json"; if body != nil { headers["content-type"] = "application/json" }
        try context.check(against: await sessions.currentSession(), at: clock.now())
        let response = try await transport.send(HTTPRequest(method: method, url: url, headers: headers, body: body))
        try context.check(against: await sessions.currentSession(), at: clock.now())
        guard response.status == 200 || (method == "POST" && response.status == 201) else { throw SignalError.status(response.status) }
        guard response.body.count <= HTTPLimits.maxResponseBytes else { throw SignalError.tooLarge }
        return (response.body, context)
    }
    private static func object(_ data: Data, keys: Set<String>) throws -> [String: Any] {
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any], Set(object.keys) == keys else { throw SignalError.invalid }
        return object
    }
    private static func validate(_ row: [String: Any], context: AuthenticatedReaderContext) throws {
        guard Set(row.keys) == ["id", "tenantId", "principal", "title", "body", "source", "projectIds", "revision", "createdAt", "updatedAt"],
              let data = try? JSONSerialization.data(withJSONObject: row), let signal = try? JSONDecoder().decode(Signal.self, from: data),
              let source = row["source"] as? [String: Any], Set(source.keys) == ["system", "recordId", "version", "reference", "observedAt"],
              pathIdentifier(signal.id), signal.tenantId == context.tenantId, signal.principal == context.principal,
              content(signal.title, signal.body, signal.projectIds), sourceValid(signal.source), signal.revision > 0,
              date(signal.createdAt), date(signal.updatedAt) else { throw SignalError.invalid }
    }
    private static func date(_ value: String) -> Bool { value.range(of: #"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$"#, options: .regularExpression) != nil && CanonicalTimestamp.parse(value).map { CanonicalTimestamp.string(from: $0) == value } == true }
    private static func identifier(_ value: String, limit: Int = 128) -> Bool { !value.isEmpty && value.count <= limit && !value.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) }
    private static func pathIdentifier(_ value: String) -> Bool { identifier(value) && value.range(of: #"^[A-Za-z0-9_-]+$"#, options: .regularExpression) != nil }
    private static func content(_ title: String, _ body: String, _ projects: [String]) -> Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && title.count <= 200 && body.count <= 16000 && projects.count <= 16 && Set(projects).count == projects.count && projects.allSatisfy { identifier($0) }
    }
    private static func sourceValid(_ source: SignalSource) -> Bool {
        guard ["cambium-native", "field-report"].contains(source.system), identifier(source.recordId), identifier(source.version), date(source.observedAt) else { return false }
        guard let reference = source.reference else { return true }
        guard reference.count <= 2048, let c = URLComponents(string: reference), ["http", "https"].contains(c.scheme?.lowercased() ?? ""), c.host?.isEmpty == false,
              c.user == nil, c.password == nil, c.query == nil, c.fragment == nil else { return false }
        return true
    }
}
