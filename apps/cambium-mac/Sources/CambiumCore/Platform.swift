import CryptoKit
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
///
/// `headers(for:)` is the call every authenticated request makes, so an
/// authorizer can refuse a destination before any byte is sent. Test and demo
/// authorizers that only know `headers()` keep working: the default ignores
/// the URL and returns those headers. An authorizer that holds a real bearer
/// overrides `headers(for:)` and withholds it unless the URL is its origin.
public protocol RequestAuthorizer: Sendable {
    func headers() async throws -> [String: String]
    func headers(for url: URL) async throws -> [String: String]
}

extension RequestAuthorizer {
    public func headers(for url: URL) async throws -> [String: String] {
        try await headers()
    }
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

public enum RecoveryStoreError: Error, Equatable, Sendable {
    case invalidKey
    case tooLarge
    case corruptEnvelope
    case ioFailure
}

struct RecoveryEnvelope: Codable, Equatable {
    var v: Int
    var key: String
    var payload: Data
}

/// One bounded, private file per key under a caller-chosen directory.
///
/// The filename is `rs1-<sha256(key)>.json`, so any key length maps to a short,
/// collision-safe name. The file holds an envelope with the exact opaque key and
/// payload, which makes enumeration exact and lets `load` reject a file whose
/// stored key does not hash to its name. The directory is `0700`, files are
/// `0600` from creation, and writes go through a temp file, `fsync` and rename.
/// A corrupt envelope throws; it is never reported as absent.
public actor FileRecoveryStore: RecoveryStore {
    public static let maxKeyBytes = 2048
    public static let maxPayloadBytes = 1_048_576
    static let maxEnvelopeBytes = 2_097_152

    private let directory: URL

    public init(directory: URL) {
        self.directory = directory
    }

    static func fileName(for key: String) -> String {
        let digest = SHA256.hash(data: Data(key.utf8))
        return "rs1-" + digest.map { String(format: "%02x", $0) }.joined() + ".json"
    }

    private static func isStoreFile(_ name: String) -> Bool {
        name.range(of: #"^rs1-[0-9a-f]{64}\.json\z"#, options: .regularExpression) != nil
    }

    private func checkKey(_ key: String) throws {
        guard !key.isEmpty, key.utf8.count <= Self.maxKeyBytes else { throw RecoveryStoreError.invalidKey }
    }

    private func url(for key: String) throws -> URL {
        try checkKey(key)
        return directory.appendingPathComponent(Self.fileName(for: key), isDirectory: false)
    }

    private func readEnvelope(at target: URL, expectedName: String? = nil) throws -> RecoveryEnvelope {
        let attributes = try? FileManager.default.attributesOfItem(atPath: target.path)
        guard let size = (attributes?[.size] as? NSNumber)?.intValue, size <= Self.maxEnvelopeBytes else {
            throw RecoveryStoreError.corruptEnvelope
        }
        guard let data = try? Data(contentsOf: target),
              let envelope = try? JSONDecoder().decode(RecoveryEnvelope.self, from: data),
              envelope.v == 1,
              !envelope.key.isEmpty, envelope.key.utf8.count <= Self.maxKeyBytes,
              envelope.payload.count <= Self.maxPayloadBytes,
              Self.fileName(for: envelope.key) == (expectedName ?? target.lastPathComponent) else {
            throw RecoveryStoreError.corruptEnvelope
        }
        return envelope
    }

    private func prepareDirectory() throws {
        let manager = FileManager.default
        try manager.createDirectory(at: directory, withIntermediateDirectories: true,
                                    attributes: [.posixPermissions: 0o700])
        try manager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
    }

    private func writeAtomically(_ data: Data, to target: URL) throws {
        let temp = directory.appendingPathComponent(".tmp-" + UUID().uuidString, isDirectory: false)
        let descriptor = open(temp.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600)
        guard descriptor >= 0 else { throw RecoveryStoreError.ioFailure }
        var ok = fchmod(descriptor, 0o600) == 0
        if ok {
            data.withUnsafeBytes { buffer in
                var offset = 0
                while offset < buffer.count {
                    let written = write(descriptor, buffer.baseAddress! + offset, buffer.count - offset)
                    if written <= 0 { ok = false; return }
                    offset += written
                }
            }
        }
        if ok { ok = fsync(descriptor) == 0 }
        close(descriptor)
        guard ok, rename(temp.path, target.path) == 0 else {
            unlink(temp.path)
            throw RecoveryStoreError.ioFailure
        }
    }

    public func save(_ data: Data, key: String) async throws {
        let target = try url(for: key)
        guard data.count <= Self.maxPayloadBytes else { throw RecoveryStoreError.tooLarge }
        let encoded = try JSONEncoder().encode(RecoveryEnvelope(v: 1, key: key, payload: data))
        guard encoded.count <= Self.maxEnvelopeBytes else { throw RecoveryStoreError.tooLarge }
        try prepareDirectory()
        try writeAtomically(encoded, to: target)
    }

    public func load(key: String) async throws -> Data? {
        let target = try url(for: key)
        guard FileManager.default.fileExists(atPath: target.path) else { return nil }
        let envelope = try readEnvelope(at: target)
        guard envelope.key == key else { throw RecoveryStoreError.corruptEnvelope }
        return envelope.payload
    }

    public func remove(key: String) async throws {
        let target = try url(for: key)
        if FileManager.default.fileExists(atPath: target.path) {
            try FileManager.default.removeItem(at: target)
        }
    }

    /// Exact enumeration from envelope keys. Any unreadable store file throws,
    /// because its key (and so whether it matches the prefix) cannot be known.
    public func keys(prefix: String) async throws -> [String] {
        guard FileManager.default.fileExists(atPath: directory.path) else { return [] }
        let names = try FileManager.default.contentsOfDirectory(atPath: directory.path)
        var out: [String] = []
        for name in names where Self.isStoreFile(name) {
            let envelope = try readEnvelope(at: directory.appendingPathComponent(name), expectedName: name)
            if envelope.key.hasPrefix(prefix) { out.append(envelope.key) }
        }
        return out.sorted()
    }
}

enum HTTPJSON {
    static func post(
        transport: any HTTPTransport,
        authorizer: any RequestAuthorizer,
        url: URL,
        body: [String: Any],
        maxRequestBytes: Int = HTTPLimits.maxRequestBytes
    ) async throws -> (status: Int, object: [String: Any]) {
        let (status, data) = try await postData(transport: transport, authorizer: authorizer, url: url, body: body, maxRequestBytes: maxRequestBytes)
        return try parse(HTTPResponse(status: status, body: data))
    }

    /// Same bounds as `post`, but returns the raw body for typed decoding.
    static func postData(
        transport: any HTTPTransport,
        authorizer: any RequestAuthorizer,
        url: URL,
        body: [String: Any],
        maxRequestBytes: Int = HTTPLimits.maxRequestBytes
    ) async throws -> (status: Int, body: Data) {
        let data = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        guard data.count <= maxRequestBytes else { throw TransportFailure.malformedResponse }
        var headers = try await authorizer.headers(for: url)
        headers["content-type"] = "application/json"
        headers["accept"] = "application/json"
        let response = try await transport.send(HTTPRequest(method: "POST", url: url, headers: headers, body: data))
        guard response.body.count <= HTTPLimits.maxResponseBytes else { throw TransportFailure.responseTooLarge }
        return (response.status, response.body)
    }

    static func get(
        transport: any HTTPTransport,
        authorizer: any RequestAuthorizer,
        url: URL
    ) async throws -> (status: Int, object: [String: Any]) {
        var headers = try await authorizer.headers(for: url)
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
