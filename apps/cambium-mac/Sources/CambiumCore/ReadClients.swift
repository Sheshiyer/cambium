import Foundation

// Read-only Mission Fabric seam. Nothing here writes to disk, reads environment,
// keychain or session stores, or creates credentials.

/// Reader identity derived only from a verified `SessionProvider` session.
/// HTTP authentication is still the owner's `RequestAuthorizer` responsibility;
/// a served document's own tenant/principal claim never creates this context.
public struct AuthenticatedReaderContext: Sendable, Equatable, Hashable {
    public let principal: String
    public let tenantId: String
    /// `NativeSession` only verifies founders. The server still resolves the
    /// authorized role and may refuse it.
    public let role: String
    public let expiresAt: Date

    public init(principal: String, tenantId: String, role: String, expiresAt: Date) {
        self.principal = principal
        self.tenantId = tenantId
        self.role = role
        self.expiresAt = expiresAt
    }

    public var scope: ReaderScope { ReaderScope(tenantId: tenantId, role: role, principal: principal) }

    public static func derive(from session: NativeSession, tenantId: String, at now: Date) throws -> AuthenticatedReaderContext {
        guard case .verified(let founderId, let sessionTenant, let expiresAt) = session else {
            throw MissionFabricReadError.unconfigured
        }
        guard !founderId.isEmpty, sessionTenant == tenantId else { throw MissionFabricReadError.tenantMismatch }
        guard expiresAt > now else { throw MissionFabricReadError.expiredIdentity }
        return AuthenticatedReaderContext(principal: founderId, tenantId: tenantId, role: "founder", expiresAt: expiresAt)
    }

    /// The same principal and tenant still hold an unexpired session, and this
    /// context's own expiry (captured at derivation) has not passed. A renewed
    /// session does not extend a context that was already minted.
    func check(against session: NativeSession, at now: Date) throws {
        guard session.founderId == principal, session.tenantId == tenantId else {
            throw MissionFabricReadError.principalSwitched
        }
        guard expiresAt > now else { throw MissionFabricReadError.expiredIdentity }
        guard session.admits(tenantId: tenantId, at: now) else { throw MissionFabricReadError.expiredIdentity }
    }
}

public enum MissionFabricReadError: Error, Equatable, Sendable {
    case unconfigured
    case invalidTenant
    case authorizationUnavailable
    case unauthorized
    case forbidden
    case unavailable
    case notFound
    case tenantMismatch
    case expiredIdentity
    case principalSwitched
    case responseTooLarge
    case stale(String)
    case badStatus(Int)
    case malformed(String)
    case transport(String)
}

/// Same tenant grammar as the Worker route (`VALID_TENANT` in handler.ts).
public enum MissionFabricTenant {
    public static func isValid(_ tenant: String) -> Bool {
        guard !tenant.isEmpty, tenant.count <= 128 else { return false }
        return tenant.range(of: #"^[a-z0-9]+(?:-[a-z0-9]+)*$"#, options: .regularExpression) != nil
    }
}

/// One configured owner origin for `GET /v1/mission-fabric/{tenant}`.
public struct MissionFabricEndpoint: Sendable, Equatable {
    public let origin: HTTPOriginPolicy

    public init(origin: HTTPOriginPolicy) {
        self.origin = origin
    }

    public func url(tenant: String) throws -> URL {
        guard MissionFabricTenant.isValid(tenant) else { throw MissionFabricReadError.invalidTenant }
        var components = URLComponents()
        components.scheme = origin.scheme
        components.host = origin.host
        components.port = origin.explicitPort
        components.percentEncodedPath = origin.basePath + "/v1/mission-fabric/" + tenant
        guard let url = components.url, origin.admits(url) else { throw MissionFabricReadError.invalidTenant }
        return url
    }
}

/// One successful read, bound to the context that requested it.
public struct MissionFabricRead: Sendable, Equatable {
    public let context: AuthenticatedReaderContext
    public let envelope: MissionFabricEnvelope
    public let receivedAt: Date
}

public protocol MissionFabricReading: Sendable {
    func readFabric(tenantId: String) async throws -> MissionFabricRead
}

public struct UnconfiguredMissionFabricReader: MissionFabricReading {
    public init() {}
    public func readFabric(tenantId: String) async throws -> MissionFabricRead {
        throw MissionFabricReadError.unconfigured
    }
}

public enum MissionFabricReaderFactory {
    /// Stays unconfigured until the owner supplies an endpoint, transport and
    /// authorizer. There is no default bearer or shared credential.
    public static func make(
        endpoint: MissionFabricEndpoint?,
        transport: (any HTTPTransport)?,
        authorizer: (any RequestAuthorizer)?,
        sessionProvider: any SessionProvider,
        clock: any CoreClock = SystemCoreClock()
    ) -> any MissionFabricReading {
        guard let endpoint, let transport, let authorizer else { return UnconfiguredMissionFabricReader() }
        return MissionFabricHTTPClient(endpoint: endpoint, transport: transport, authorizer: authorizer, sessionProvider: sessionProvider, clock: clock)
    }
}

public struct MissionFabricHTTPClient: MissionFabricReading {
    private let endpoint: MissionFabricEndpoint
    private let transport: any HTTPTransport
    private let authorizer: any RequestAuthorizer
    private let sessionProvider: any SessionProvider
    private let clock: any CoreClock
    private let maxResponseBytes: Int

    public init(
        endpoint: MissionFabricEndpoint,
        transport: any HTTPTransport,
        authorizer: any RequestAuthorizer,
        sessionProvider: any SessionProvider,
        clock: any CoreClock = SystemCoreClock(),
        maxResponseBytes: Int = HTTPLimits.maxResponseBytes
    ) {
        self.endpoint = endpoint
        self.transport = transport
        self.authorizer = authorizer
        self.sessionProvider = sessionProvider
        self.clock = clock
        self.maxResponseBytes = min(maxResponseBytes, HTTPLimits.maxResponseBytes)
    }

    public func readFabric(tenantId: String) async throws -> MissionFabricRead {
        let url = try endpoint.url(tenant: tenantId)
        let context = try AuthenticatedReaderContext.derive(
            from: await sessionProvider.currentSession(), tenantId: tenantId, at: clock.now()
        )

        var headers: [String: String]
        do {
            headers = try await authorizer.headers(for: url)
        } catch {
            throw MissionFabricReadError.authorizationUnavailable
        }
        // An empty authorizer (for example NoAuthorizer) means no owner identity flow.
        guard !headers.isEmpty else { throw MissionFabricReadError.authorizationUnavailable }
        headers = headers.filter { $0.key.lowercased() != "accept" }
        headers["accept"] = "application/json"
        // Headers were minted across an await; they must still belong to this context.
        try context.check(against: await sessionProvider.currentSession(), at: clock.now())

        let response: HTTPResponse
        do {
            response = try await transport.send(HTTPRequest(method: "GET", url: url, headers: headers))
        } catch let failure as TransportFailure {
            throw failure == .responseTooLarge ? MissionFabricReadError.responseTooLarge : MissionFabricReadError.transport(String(describing: failure))
        } catch {
            throw MissionFabricReadError.transport(String(describing: error))
        }

        // A switch or sign-out while the request was in flight discards this response.
        let receivedAt = clock.now()
        try context.check(against: await sessionProvider.currentSession(), at: receivedAt)

        switch response.status {
        case 200: break
        case 401: throw MissionFabricReadError.unauthorized
        case 403: throw MissionFabricReadError.forbidden
        case 404: throw MissionFabricReadError.notFound
        case 503: throw MissionFabricReadError.unavailable
        default: throw MissionFabricReadError.badStatus(response.status)
        }
        guard response.body.count <= maxResponseBytes else { throw MissionFabricReadError.responseTooLarge }

        let decodeContext = FabricDecodeContext(requested: context.scope, now: receivedAt, acceptStale: false)
        switch MissionFabricDecoder.decode(json: response.body, context: decodeContext) {
        case .success(let envelope):
            return MissionFabricRead(context: context, envelope: envelope, receivedAt: receivedAt)
        case .failure(.tenantMismatch):
            throw MissionFabricReadError.tenantMismatch
        case .failure(.stale(let reason)):
            throw MissionFabricReadError.stale(reason)
        case .failure(.capExceeded):
            throw MissionFabricReadError.responseTooLarge
        case .failure(let error):
            throw MissionFabricReadError.malformed(String(describing: error))
        }
    }
}

/// Memory-only latest read. Invalidation bumps a generation so a read that was
/// pending across the switch cannot publish the previous principal's data.
/// `cacheTTL` bounds how long a successful read may be served from memory;
/// source timestamps inside the envelope stay the server's own freshness.
public actor MissionFabricSnapshotStore {
    public static let defaultCacheTTL: TimeInterval = 60

    private let reader: any MissionFabricReading
    private let sessionProvider: any SessionProvider
    private let clock: any CoreClock
    private let cacheTTL: TimeInterval
    private var current: MissionFabricRead?
    private var generation: UInt64 = 0

    public init(reader: any MissionFabricReading, sessionProvider: any SessionProvider,
                clock: any CoreClock = SystemCoreClock(), cacheTTL: TimeInterval = defaultCacheTTL) {
        self.reader = reader
        self.sessionProvider = sessionProvider
        self.clock = clock
        self.cacheTTL = cacheTTL
    }

    public func refresh(tenantId: String) async throws -> MissionFabricRead {
        let token = generation
        let read: MissionFabricRead
        do {
            read = try await reader.readFabric(tenantId: tenantId)
        } catch let error as MissionFabricReadError {
            switch error {
            case .unauthorized, .forbidden, .principalSwitched, .expiredIdentity, .unconfigured, .tenantMismatch:
                invalidate()
            default:
                break
            }
            throw error
        }
        guard token == generation else { throw MissionFabricReadError.principalSwitched }
        do {
            try read.context.check(against: await sessionProvider.currentSession(), at: clock.now())
        } catch {
            invalidate()
            throw error
        }
        guard token == generation else { throw MissionFabricReadError.principalSwitched }
        current = read
        return read
    }

    /// Returns the cached read only while it is inside `cacheTTL`, the original
    /// context is unexpired, and the session still matches. A miss is nil and
    /// requires a fresh `refresh`.
    public func snapshot(for session: NativeSession) -> MissionFabricRead? {
        guard let current else { return nil }
        let now = clock.now()
        guard now.timeIntervalSince(current.receivedAt) <= cacheTTL else {
            self.current = nil
            return nil
        }
        do {
            try current.context.check(against: session, at: now)
            return current
        } catch {
            invalidate()
            return nil
        }
    }

    /// Call on context switch or sign-out.
    public func invalidate() {
        generation &+= 1
        current = nil
    }
}
