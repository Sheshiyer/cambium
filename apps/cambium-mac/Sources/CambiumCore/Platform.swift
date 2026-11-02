import Foundation

// Injected seams. Nothing here performs a live call by itself.

public protocol CoreClock: Sendable {
    func now() -> Date
}

public struct SystemCoreClock: CoreClock {
    public init() {}
    public func now() -> Date { Date() }
}

/// Native admission is not implemented. A session is a *claim the app holds*
/// that early UI checks use; the owning service still verifies everything.
public enum NativeSession: Sendable, Equatable {
    case unconfigured
    case verified(founderId: String, tenantId: String, expiresAt: Date)

    public func admits(tenantId: String, at date: Date) -> Bool {
        guard case .verified(_, let sessionTenant, let expiresAt) = self else { return false }
        return sessionTenant == tenantId && expiresAt > date
    }

    public var founderId: String? {
        guard case .verified(let founderId, _, _) = self else { return nil }
        return founderId
    }

    public var tenantId: String? {
        guard case .verified(_, let tenantId, _) = self else { return nil }
        return tenantId
    }
}

public protocol SessionProvider: Sendable {
    func currentSession() async -> NativeSession
}

public struct UnconfiguredSessionProvider: SessionProvider {
    public init() {}
    public func currentSession() async -> NativeSession { .unconfigured }
}

public struct HTTPRequest: Sendable, Equatable {
    public var method: String
    public var url: URL
    public var headers: [String: String]
    public var body: Data?

    public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) {
        self.method = method
        self.url = url
        self.headers = headers
        self.body = body
    }
}

public struct HTTPResponse: Sendable, Equatable {
    public var status: Int
    public var body: Data

    public init(status: Int, body: Data) {
        self.status = status
        self.body = body
    }
}

public protocol HTTPTransport: Sendable {
    func send(_ request: HTTPRequest) async throws -> HTTPResponse
}

/// Supplies authentication headers from the owner-reviewed native identity flow.
/// The core never creates credentials.
public protocol RequestAuthorizer: Sendable {
    func headers() async throws -> [String: String]
}

public struct NoAuthorizer: RequestAuthorizer {
    public init() {}
    public func headers() async throws -> [String: String] { [:] }
}

public enum TransportFailure: Error, Equatable, Sendable {
    case timeout
    case unreachable
    case malformedResponse
    case unauthorized
    case ownerUnconfigured
    case responseTooLarge
}

public enum HTTPLimits {
    public static let maxResponseBytes = 8_000_000
    public static let maxRequestBytes = 8192
}

// MARK: - Recovery persistence

/// Small keyed store for opaque recovery references. It never holds
/// credentials or prompt corpora.
public protocol RecoveryStore: Sendable {
    func save(_ data: Data, key: String) async throws
    func load(key: String) async throws -> Data?
    func remove(key: String) async throws
    func keys(prefix: String) async throws -> [String]
}

public actor InMemoryRecoveryStore: RecoveryStore {
    private var values: [String: Data] = [:]
    public var failSaves = false

    public init() {}

    public func setFailSaves(_ value: Bool) { failSaves = value }

    public func save(_ data: Data, key: String) async throws {
        if failSaves { throw TransportFailure.unreachable }
        values[key] = data
    }

    public func load(key: String) async throws -> Data? { values[key] }
    public func remove(key: String) async throws { values[key] = nil }
    public func keys(prefix: String) async throws -> [String] {
        values.keys.filter { $0.hasPrefix(prefix) }.sorted()
    }
}

/// One JSON file per key under a caller-chosen directory.
/// Uses percent-encoding for collision-safe and reversible key mapping.
public actor FileRecoveryStore: RecoveryStore {
    private let directory: URL

    public init(directory: URL) {
        self.directory = directory
    }

    private func url(for key: String) throws -> URL {
        guard !key.isEmpty else { throw TransportFailure.malformedResponse }
        let safeName = key.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(.init(charactersIn: "._-"))) ?? key
        return directory.appendingPathComponent(safeName + ".json")
    }

    public func save(_ data: Data, key: String) async throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try data.write(to: url(for: key), options: .atomic)
    }

    public func load(key: String) async throws -> Data? {
        let target = try url(for: key)
        guard FileManager.default.fileExists(atPath: target.path) else { return nil }
        return try Data(contentsOf: target)
    }

    public func remove(key: String) async throws {
        let target = try url(for: key)
        if FileManager.default.fileExists(atPath: target.path) {
            try FileManager.default.removeItem(at: target)
        }
    }

    public func keys(prefix: String) async throws -> [String] {
        guard FileManager.default.fileExists(atPath: directory.path) else { return [] }
        let names = try FileManager.default.contentsOfDirectory(atPath: directory.path)
        let safePrefix = prefix.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(.init(charactersIn: "._-"))) ?? prefix
        return names
            .filter { $0.hasSuffix(".json") && $0.hasPrefix(safePrefix) }
            .map { filename -> String in
                let base = String(filename.dropLast(5))
                return base.removingPercentEncoding ?? base
            }
            .sorted()
    }
}

enum HTTPJSON {
    static func post(
        transport: any HTTPTransport,
        authorizer: any RequestAuthorizer,
        url: URL,
        body: [String: Any]
    ) async throws -> (status: Int, object: [String: Any]) {
        let data = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        guard data.count <= HTTPLimits.maxRequestBytes else { throw TransportFailure.malformedResponse }
        var headers = try await authorizer.headers()
        headers["content-type"] = "application/json"
        headers["accept"] = "application/json"
        let response = try await transport.send(HTTPRequest(method: "POST", url: url, headers: headers, body: data))
        return try parse(response)
    }

    static func get(
        transport: any HTTPTransport,
        authorizer: any RequestAuthorizer,
        url: URL
    ) async throws -> (status: Int, object: [String: Any]) {
        var headers = try await authorizer.headers()
        headers["accept"] = "application/json"
        let response = try await transport.send(HTTPRequest(method: "GET", url: url, headers: headers))
        return try parse(response)
    }

    private static func parse(_ response: HTTPResponse) throws -> (status: Int, object: [String: Any]) {
        guard response.body.count <= HTTPLimits.maxResponseBytes else { throw TransportFailure.responseTooLarge }
        guard let object = try? JSONSerialization.jsonObject(with: response.body) as? [String: Any] else {
            throw TransportFailure.malformedResponse
        }
        return (response.status, object)
    }

    static func endpoint(_ base: URL, _ path: String) -> URL {
        let trimmed = base.absoluteString.hasSuffix("/") ? String(base.absoluteString.dropLast()) : base.absoluteString
        return URL(string: trimmed + path) ?? base
    }
}
