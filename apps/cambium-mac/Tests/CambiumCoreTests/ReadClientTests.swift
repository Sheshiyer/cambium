import XCTest
@testable import CambiumCore

// MARK: - Test doubles (Reader-prefixed to stay unique inside the test module)

final class ReaderLock<Value>: @unchecked Sendable {
    private let lock = NSLock()
    private var value: Value
    init(_ value: Value) { self.value = value }
    func get() -> Value { lock.lock(); defer { lock.unlock() }; return value }
    func set(_ new: Value) { lock.lock(); value = new; lock.unlock() }
    func mutate(_ body: (inout Value) -> Void) { lock.lock(); body(&value); lock.unlock() }
}

actor ReaderGate {
    private var isOpen = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    private(set) var waiting = 0

    func wait() async {
        if isOpen { return }
        waiting += 1
        await withCheckedContinuation { waiters.append($0) }
    }

    func open() {
        isOpen = true
        waiters.forEach { $0.resume() }
        waiters = []
    }

    func waitUntilWaiting() async {
        for _ in 0..<2000 {
            if waiting > 0 { return }
            try? await Task.sleep(nanoseconds: 2_000_000)
        }
    }
}

final class ReaderClock: CoreClock, @unchecked Sendable {
    private let time: ReaderLock<Date>
    init(_ date: Date) { time = ReaderLock(date) }
    func now() -> Date { time.get() }
    func set(_ date: Date) { time.set(date) }
}

final class ReaderSession: SessionProvider, @unchecked Sendable {
    private let session: ReaderLock<NativeSession>
    init(_ session: NativeSession) { self.session = ReaderLock(session) }
    func set(_ new: NativeSession) { session.set(new) }
    func currentSession() async -> NativeSession { session.get() }
}

final class ReaderFakeTransport: HTTPTransport, @unchecked Sendable {
    typealias Handler = @Sendable (HTTPRequest) async throws -> HTTPResponse
    private let handler: Handler
    private let sent = ReaderLock<[HTTPRequest]>([])
    init(_ handler: @escaping Handler) { self.handler = handler }
    var requests: [HTTPRequest] { sent.get() }
    func send(_ request: HTTPRequest) async throws -> HTTPResponse {
        sent.mutate { $0.append(request) }
        return try await handler(request)
    }
}

struct ReaderStaticAuthorizer: RequestAuthorizer {
    var values: [String: String] = ["authorization": "Bearer owner-issued-test-token"]
    func headers() async throws -> [String: String] { values }
}

struct ReaderFailingAuthorizer: RequestAuthorizer {
    func headers() async throws -> [String: String] { throw TransportFailure.ownerUnconfigured }
}

func readerError<T>(_ body: () async throws -> T) async -> Error? {
    do { _ = try await body(); return nil } catch { return error }
}

enum ReaderFixtures {
    static let base = "2026-07-28T09:05:00.000Z"
    static var baseDate: Date { CanonicalTimestamp.parse(base)! }

    static func fabricBody(_ name: String = "mission-fabric-envelope-founder") throws -> Data {
        let url = try XCTUnwrap(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
        return try Data(contentsOf: url)
    }

    static func session(_ founder: String = "founder-1", tenant: String = "cambium", ttl: TimeInterval = 3600, from now: Date = baseDate) -> NativeSession {
        .verified(founderId: founder, tenantId: tenant, expiresAt: now.addingTimeInterval(ttl))
    }

    static func endpoint(_ url: String = "https://fabric.example.invalid") throws -> MissionFabricEndpoint {
        MissionFabricEndpoint(origin: try HTTPOriginPolicy(url: URL(string: url)!))
    }
}

// MARK: - Mission Fabric client

final class ReadClientTests: XCTestCase {

    private func makeClient(
        session: ReaderSession,
        clock: ReaderClock = ReaderClock(ReaderFixtures.baseDate),
        authorizer: any RequestAuthorizer = ReaderStaticAuthorizer(),
        endpoint: MissionFabricEndpoint? = nil,
        maxResponseBytes: Int = HTTPLimits.maxResponseBytes,
        handler: @escaping ReaderFakeTransport.Handler
    ) throws -> (MissionFabricHTTPClient, ReaderFakeTransport) {
        let transport = ReaderFakeTransport(handler)
        let client = MissionFabricHTTPClient(
            endpoint: try endpoint ?? ReaderFixtures.endpoint(), transport: transport, authorizer: authorizer,
            sessionProvider: session, clock: clock, maxResponseBytes: maxResponseBytes
        )
        return (client, transport)
    }

    func testSuccessfulReadUsesExactRouteAndAuthenticatedContext() async throws {
        let body = try ReaderFixtures.fabricBody()
        let (client, transport) = try makeClient(session: ReaderSession(ReaderFixtures.session())) { _ in HTTPResponse(status: 200, body: body) }

        let read = try await client.readFabric(tenantId: "cambium")

        XCTAssertEqual(read.envelope.projection.tenantId, "cambium")
        XCTAssertEqual(read.context.principal, "founder-1")
        XCTAssertEqual(read.context.tenantId, "cambium")
        XCTAssertEqual(read.context.role, "founder")
        let sent = try XCTUnwrap(transport.requests.first)
        XCTAssertEqual(transport.requests.count, 1)
        XCTAssertEqual(sent.method, "GET")
        XCTAssertNil(sent.body)
        XCTAssertEqual(sent.url.absoluteString, "https://fabric.example.invalid/v1/mission-fabric/cambium")
        XCTAssertEqual(sent.headers["authorization"], "Bearer owner-issued-test-token")
        XCTAssertEqual(sent.headers["accept"], "application/json")
    }

    func testBasePathPrefixAndAcceptHeaderNormalised() async throws {
        let body = try ReaderFixtures.fabricBody()
        let authorizer = ReaderStaticAuthorizer(values: ["authorization": "Bearer t", "Accept": "text/html"])
        let (client, transport) = try makeClient(
            session: ReaderSession(ReaderFixtures.session()), authorizer: authorizer,
            endpoint: try ReaderFixtures.endpoint("https://fabric.example.invalid/owner/")
        ) { _ in HTTPResponse(status: 200, body: body) }

        _ = try await client.readFabric(tenantId: "cambium")

        let sent = try XCTUnwrap(transport.requests.first)
        XCTAssertEqual(sent.url.absoluteString, "https://fabric.example.invalid/owner/v1/mission-fabric/cambium")
        XCTAssertEqual(sent.headers.filter { $0.key.lowercased() == "accept" }.count, 1)
        XCTAssertEqual(sent.headers["accept"], "application/json")
    }

    func testEndpointEscapingRejectsUnsafeTenantsBeforeAnyRequest() async throws {
        let (client, transport) = try makeClient(session: ReaderSession(ReaderFixtures.session())) { _ in HTTPResponse(status: 200, body: Data()) }
        for tenant in ["", "../admin", "a/b", "a b", "Cambium", "cambium?x=1", "cambium%2Fx", "cambium#frag", "-a", "a--b", "a\nb"] {
            let error = await readerError { try await client.readFabric(tenantId: tenant) }
            XCTAssertEqual(error as? MissionFabricReadError, .invalidTenant, "tenant \(tenant.debugDescription)")
        }
        XCTAssertTrue(transport.requests.isEmpty)
        XCTAssertThrowsError(try ReaderFixtures.endpoint().url(tenant: "a/b"))
    }

    func testNoAuthenticationFailsClosedWithoutRequest() async throws {
        for authorizer in [NoAuthorizer() as any RequestAuthorizer, ReaderFailingAuthorizer(), ReaderStaticAuthorizer(values: [:])] {
            let (client, transport) = try makeClient(session: ReaderSession(ReaderFixtures.session()), authorizer: authorizer) { _ in
                HTTPResponse(status: 200, body: Data())
            }
            let error = await readerError { try await client.readFabric(tenantId: "cambium") }
            XCTAssertEqual(error as? MissionFabricReadError, .authorizationUnavailable)
            XCTAssertTrue(transport.requests.isEmpty)
        }
    }

    func testUnconfiguredExpiredAndForeignTenantSessionsSendNothing() async throws {
        let cases: [(NativeSession, MissionFabricReadError)] = [
            (.unconfigured, .unconfigured),
            (ReaderFixtures.session(ttl: -10), .expiredIdentity),
            (ReaderFixtures.session(tenant: "other"), .tenantMismatch)
        ]
        for (session, expected) in cases {
            let (client, transport) = try makeClient(session: ReaderSession(session)) { _ in HTTPResponse(status: 200, body: Data()) }
            let error = await readerError { try await client.readFabric(tenantId: "cambium") }
            XCTAssertEqual(error as? MissionFabricReadError, expected)
            XCTAssertTrue(transport.requests.isEmpty)
        }
    }

    func testIdentityExpiringWhileRequestIsPending() async throws {
        let clock = ReaderClock(ReaderFixtures.baseDate)
        let body = try ReaderFixtures.fabricBody()
        let (client, _) = try makeClient(session: ReaderSession(ReaderFixtures.session(ttl: 60)), clock: clock) { _ in
            clock.set(ReaderFixtures.baseDate.addingTimeInterval(120))
            return HTTPResponse(status: 200, body: body)
        }
        let error = await readerError { try await client.readFabric(tenantId: "cambium") }
        XCTAssertEqual(error as? MissionFabricReadError, .expiredIdentity)
    }

    func testPrincipalSwitchDuringRequestDiscardsResponse() async throws {
        let body = try ReaderFixtures.fabricBody()
        let session = ReaderSession(ReaderFixtures.session("founder-1"))
        let gate = ReaderGate()
        let (client, _) = try makeClient(session: session) { _ in
            await gate.wait()
            return HTTPResponse(status: 200, body: body)
        }

        let task = Task { try await client.readFabric(tenantId: "cambium") }
        await gate.waitUntilWaiting()
        session.set(ReaderFixtures.session("founder-2"))
        await gate.open()

        guard case .failure(let error) = await task.result else { return XCTFail("old principal data was published") }
        XCTAssertEqual(error as? MissionFabricReadError, .principalSwitched)
    }

    func testSignOutAndTenantSwitchDuringRequestDiscardResponse() async throws {
        let body = try ReaderFixtures.fabricBody()
        for replacement in [NativeSession.unconfigured, ReaderFixtures.session(tenant: "other")] {
            let session = ReaderSession(ReaderFixtures.session())
            let gate = ReaderGate()
            let (client, _) = try makeClient(session: session) { _ in
                await gate.wait()
                return HTTPResponse(status: 200, body: body)
            }
            let task = Task { try await client.readFabric(tenantId: "cambium") }
            await gate.waitUntilWaiting()
            session.set(replacement)
            await gate.open()
            guard case .failure(let error) = await task.result else { return XCTFail("response survived the switch") }
            XCTAssertEqual(error as? MissionFabricReadError, .principalSwitched)
        }
    }

    func testExplicitStatusMapping() async throws {
        let expected: [Int: MissionFabricReadError] = [
            401: .unauthorized, 403: .forbidden, 404: .notFound, 503: .unavailable, 500: .badStatus(500), 204: .badStatus(204)
        ]
        for (status, error) in expected {
            let (client, _) = try makeClient(session: ReaderSession(ReaderFixtures.session())) { _ in
                HTTPResponse(status: status, body: Data(#"{"error":"x"}"#.utf8))
            }
            let thrown = await readerError { try await client.readFabric(tenantId: "cambium") }
            XCTAssertEqual(thrown as? MissionFabricReadError, error, "status \(status)")
        }
    }

    func testTransportFailuresAreMapped() async throws {
        let cases: [(TransportFailure, MissionFabricReadError)] = [
            (.responseTooLarge, .responseTooLarge), (.timeout, .transport("timeout")), (.unreachable, .transport("unreachable"))
        ]
        for (failure, expected) in cases {
            let (client, _) = try makeClient(session: ReaderSession(ReaderFixtures.session())) { _ in throw failure }
            let thrown = await readerError { try await client.readFabric(tenantId: "cambium") }
            XCTAssertEqual(thrown as? MissionFabricReadError, expected)
        }
    }

    func testResponseSizeBound() async throws {
        let body = try ReaderFixtures.fabricBody()
        let (client, _) = try makeClient(session: ReaderSession(ReaderFixtures.session()), maxResponseBytes: 1024) { _ in
            HTTPResponse(status: 200, body: body)
        }
        let thrown = await readerError { try await client.readFabric(tenantId: "cambium") }
        XCTAssertEqual(thrown as? MissionFabricReadError, .responseTooLarge)
    }

    func testMalformedAndWrongTenantResponses() async throws {
        let body = try ReaderFixtures.fabricBody()
        let (bad, _) = try makeClient(session: ReaderSession(ReaderFixtures.session())) { _ in
            HTTPResponse(status: 200, body: Data("not json".utf8))
        }
        guard case .malformed? = await readerError({ try await bad.readFabric(tenantId: "cambium") }) as? MissionFabricReadError else {
            return XCTFail("malformed body accepted")
        }

        // Session is valid for "acme" but the server returned the cambium projection.
        let (foreign, _) = try makeClient(session: ReaderSession(ReaderFixtures.session(tenant: "acme"))) { _ in
            HTTPResponse(status: 200, body: body)
        }
        let thrown = await readerError { try await foreign.readFabric(tenantId: "acme") }
        XCTAssertEqual(thrown as? MissionFabricReadError, .tenantMismatch)
    }

    func testStaleResponseIsRejected() async throws {
        let body = try ReaderFixtures.fabricBody()
        let later = ReaderFixtures.baseDate.addingTimeInterval(3 * 24 * 3600)
        let (client, _) = try makeClient(
            session: ReaderSession(ReaderFixtures.session(from: later)), clock: ReaderClock(later)
        ) { _ in HTTPResponse(status: 200, body: body) }
        guard case .stale? = await readerError({ try await client.readFabric(tenantId: "cambium") }) as? MissionFabricReadError else {
            return XCTFail("stale projection accepted")
        }
    }

    func testFactoryStaysUnconfiguredUntilOwnerSuppliesEverything() async throws {
        let session = ReaderSession(ReaderFixtures.session())
        let transport = ReaderFakeTransport { _ in HTTPResponse(status: 200, body: Data()) }
        let readers: [any MissionFabricReading] = [
            MissionFabricReaderFactory.make(endpoint: nil, transport: transport, authorizer: ReaderStaticAuthorizer(), sessionProvider: session),
            MissionFabricReaderFactory.make(endpoint: try ReaderFixtures.endpoint(), transport: nil, authorizer: ReaderStaticAuthorizer(), sessionProvider: session),
            MissionFabricReaderFactory.make(endpoint: try ReaderFixtures.endpoint(), transport: transport, authorizer: nil, sessionProvider: session)
        ]
        for reader in readers {
            let thrown = await readerError { try await reader.readFabric(tenantId: "cambium") }
            XCTAssertEqual(thrown as? MissionFabricReadError, .unconfigured)
        }
        XCTAssertTrue(transport.requests.isEmpty)
    }

    // MARK: Snapshot store

    func testSnapshotStoreInvalidatedOnSwitchAndSignOut() async throws {
        let body = try ReaderFixtures.fabricBody()
        let session = ReaderSession(ReaderFixtures.session("founder-1"))
        let (client, _) = try makeClient(session: session) { _ in HTTPResponse(status: 200, body: body) }
        let store = MissionFabricSnapshotStore(reader: client, sessionProvider: session, clock: ReaderClock(ReaderFixtures.baseDate))

        _ = try await store.refresh(tenantId: "cambium")
        let same = await store.snapshot(for: ReaderFixtures.session("founder-1"))
        XCTAssertNotNil(same)

        let foreign = await store.snapshot(for: ReaderFixtures.session("founder-2"))
        XCTAssertNil(foreign)
        // The mismatch purged memory; even the original principal gets nothing now.
        let afterPurge = await store.snapshot(for: ReaderFixtures.session("founder-1"))
        XCTAssertNil(afterPurge)

        _ = try await store.refresh(tenantId: "cambium")
        let signedOut = await store.snapshot(for: .unconfigured)
        XCTAssertNil(signedOut)
    }

    func testPendingRefreshCannotPublishAfterInvalidate() async throws {
        let body = try ReaderFixtures.fabricBody()
        let session = ReaderSession(ReaderFixtures.session("founder-1"))
        let gate = ReaderGate()
        let (client, _) = try makeClient(session: session) { _ in
            await gate.wait()
            return HTTPResponse(status: 200, body: body)
        }
        let store = MissionFabricSnapshotStore(reader: client, sessionProvider: session, clock: ReaderClock(ReaderFixtures.baseDate))

        let task = Task { try await store.refresh(tenantId: "cambium") }
        await gate.waitUntilWaiting()
        await store.invalidate()
        await gate.open()

        guard case .failure(let error) = await task.result else { return XCTFail("refresh published after invalidate") }
        XCTAssertEqual(error as? MissionFabricReadError, .principalSwitched)
        let held = await store.snapshot(for: ReaderFixtures.session("founder-1"))
        XCTAssertNil(held)
    }

    func testRefreshFailureOnAuthRefusalDropsPriorSnapshot() async throws {
        let body = try ReaderFixtures.fabricBody()
        let status = ReaderLock(200)
        let session = ReaderSession(ReaderFixtures.session())
        let (client, _) = try makeClient(session: session) { _ in
            let code = status.get()
            return HTTPResponse(status: code, body: code == 200 ? body : Data("{}".utf8))
        }
        let store = MissionFabricSnapshotStore(reader: client, sessionProvider: session, clock: ReaderClock(ReaderFixtures.baseDate))
        _ = try await store.refresh(tenantId: "cambium")
        status.set(403)
        let thrown = await readerError { try await store.refresh(tenantId: "cambium") }
        XCTAssertEqual(thrown as? MissionFabricReadError, .forbidden)
        let held = await store.snapshot(for: ReaderFixtures.session())
        XCTAssertNil(held)
    }
}

// MARK: - Origin policy and production URLSession transport (no live network)

final class ReaderStubProtocol: URLProtocol, @unchecked Sendable {
    enum Result: Sendable {
        case response(status: Int, headers: [String: String], body: Data)
        case redirect(String)
        case fail(URLError.Code)
    }
    typealias Handler = @Sendable (URLRequest) -> Result
    static let handler = ReaderLock<Handler?>(nil)
    static let seen = ReaderLock<[URLRequest]>([])

    static func reset(_ new: Handler?) { seen.set([]); handler.set(new) }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.seen.mutate { $0.append(request) }
        guard let url = request.url, let handler = Self.handler.get() else {
            client?.urlProtocol(self, didFailWithError: URLError(.badURL)); return
        }
        switch handler(request) {
        case .response(let status, let headers, let body):
            let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: body)
            client?.urlProtocolDidFinishLoading(self)
        case .redirect(let location):
            let response = HTTPURLResponse(url: url, statusCode: 302, httpVersion: "HTTP/1.1", headerFields: ["Location": location])!
            client?.urlProtocol(self, wasRedirectedTo: URLRequest(url: URL(string: location)!), redirectResponse: response)
            // When the delegate refuses the redirect, a real server's 3xx response becomes the final one.
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocolDidFinishLoading(self)
        case .fail(let code):
            client?.urlProtocol(self, didFailWithError: URLError(code))
        }
    }

    override func stopLoading() {}
}

final class URLSessionTransportTests: XCTestCase {
    private let origin = "https://fabric.example.invalid"

    private func makeTransport(_ url: String? = nil, timeout: TimeInterval = 5, maxResponseBytes: Int = HTTPLimits.maxResponseBytes) throws -> URLSessionHTTPTransport {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ReaderStubProtocol.self]
        return URLSessionHTTPTransport(
            origin: try HTTPOriginPolicy(url: URL(string: url ?? origin)!), configuration: configuration,
            timeout: timeout, maxResponseBytes: maxResponseBytes
        )
    }

    private func get(_ path: String, headers: [String: String] = [:]) -> HTTPRequest {
        HTTPRequest(method: "GET", url: URL(string: origin + path)!, headers: headers)
    }

    override func tearDown() { ReaderStubProtocol.reset(nil) }

    func testOriginPolicyRules() throws {
        XCTAssertThrowsError(try HTTPOriginPolicy(url: URL(string: "https://user:pw@fabric.example.invalid")!)) {
            XCTAssertEqual($0 as? HTTPOriginError, .credentialsInURL)
        }
        XCTAssertThrowsError(try HTTPOriginPolicy(url: URL(string: "http://fabric.example.invalid")!)) {
            XCTAssertEqual($0 as? HTTPOriginError, .unsupportedScheme)
        }
        XCTAssertThrowsError(try HTTPOriginPolicy(url: URL(string: "http://fabric.example.invalid")!, allowLoopbackHTTP: true)) {
            XCTAssertEqual($0 as? HTTPOriginError, .insecureHost)
        }
        XCTAssertThrowsError(try HTTPOriginPolicy(url: URL(string: "http://localhost:8787")!)) {
            XCTAssertEqual($0 as? HTTPOriginError, .unsupportedScheme)
        }
        XCTAssertThrowsError(try HTTPOriginPolicy(url: URL(string: "ftp://fabric.example.invalid")!))
        for host in ["http://localhost:8787", "http://127.0.0.1:8787", "http://[::1]:8787"] {
            XCTAssertNoThrow(try HTTPOriginPolicy(url: URL(string: host)!, allowLoopbackHTTP: true), host)
        }

        let scoped = try HTTPOriginPolicy(url: URL(string: "https://fabric.example.invalid/api/")!)
        XCTAssertTrue(scoped.admits(URL(string: "https://fabric.example.invalid/api/v1/x")!))
        XCTAssertTrue(scoped.admits(URL(string: "https://FABRIC.example.invalid:443/api")!))
        XCTAssertFalse(scoped.admits(URL(string: "https://fabric.example.invalid/apix")!))
        XCTAssertFalse(scoped.admits(URL(string: "https://fabric.example.invalid/other")!))
        XCTAssertFalse(scoped.admits(URL(string: "https://fabric.example.invalid:8443/api/x")!))
        XCTAssertFalse(scoped.admits(URL(string: "http://fabric.example.invalid/api/x")!))
        XCTAssertFalse(scoped.admits(URL(string: "https://evil.example.invalid/api/x")!))
        XCTAssertFalse(scoped.admits(URL(string: "https://u:p@fabric.example.invalid/api/x")!))
    }

    func testSendsAuthorizedGetAndReturnsBody() async throws {
        ReaderStubProtocol.reset { _ in .response(status: 200, headers: [:], body: Data("ok".utf8)) }
        let transport = try makeTransport()

        let response = try await transport.send(get("/v1/ping", headers: ["authorization": "Bearer t", "Cookie": "session=1"]))

        XCTAssertEqual(response.status, 200)
        XCTAssertEqual(String(decoding: response.body, as: UTF8.self), "ok")
        let seen = try XCTUnwrap(ReaderStubProtocol.seen.get().first)
        XCTAssertEqual(seen.value(forHTTPHeaderField: "authorization"), "Bearer t")
        XCTAssertNil(seen.value(forHTTPHeaderField: "Cookie"))
        XCTAssertFalse(seen.httpShouldHandleCookies)
    }

    func testOutOfScopeRequestsNeverReachTheNetwork() async throws {
        ReaderStubProtocol.reset { _ in .response(status: 200, headers: [:], body: Data()) }
        let transport = try makeTransport()
        let urls = [
            "https://evil.example.invalid/x", "http://fabric.example.invalid/x",
            "https://user:pw@fabric.example.invalid/x", "https://fabric.example.invalid:8443/x"
        ]
        for url in urls {
            let error = await readerError { try await transport.send(HTTPRequest(method: "GET", url: URL(string: url)!, headers: ["authorization": "Bearer t"])) }
            XCTAssertEqual(error as? TransportFailure, .unreachable, url)
        }
        let method = await readerError { try await transport.send(HTTPRequest(method: "DELETE", url: URL(string: self.origin + "/x")!)) }
        XCTAssertEqual(method as? TransportFailure, .malformedResponse)
        let oversize = await readerError {
            try await transport.send(HTTPRequest(method: "POST", url: URL(string: self.origin + "/x")!, body: Data(count: HTTPLimits.maxRequestBytes + 1)))
        }
        XCTAssertEqual(oversize as? TransportFailure, .malformedResponse)
        XCTAssertTrue(ReaderStubProtocol.seen.get().isEmpty)
    }

    func testCrossOriginRedirectIsDeniedBeforeFollowing() async throws {
        ReaderStubProtocol.reset { request in
            request.url?.host == "fabric.example.invalid" ? .redirect("https://evil.example.invalid/steal") : .response(status: 200, headers: [:], body: Data("leak".utf8))
        }
        let transport = try makeTransport()

        let error = await readerError { try await transport.send(self.get("/v1/x", headers: ["authorization": "Bearer t"])) }

        XCTAssertEqual(error as? TransportFailure, .unreachable)
        XCTAssertEqual(ReaderStubProtocol.seen.get().compactMap { $0.url?.host }, ["fabric.example.invalid"])
    }

    func testOutOfScopePathRedirectIsDenied() async throws {
        ReaderStubProtocol.reset { _ in .redirect("https://fabric.example.invalid/admin") }
        let transport = try makeTransport(origin + "/api")
        let error = await readerError { try await transport.send(HTTPRequest(method: "GET", url: URL(string: self.origin + "/api/v1/x")!)) }
        XCTAssertEqual(error as? TransportFailure, .unreachable)
        XCTAssertEqual(ReaderStubProtocol.seen.get().count, 1)
    }

    func testResponseSizeBoundStreamedAndDeclared() async throws {
        ReaderStubProtocol.reset { _ in .response(status: 200, headers: [:], body: Data(count: 100)) }
        let streamed = await readerError { try await self.makeTransport(maxResponseBytes: 10).send(self.get("/x")) }
        XCTAssertEqual(streamed as? TransportFailure, .responseTooLarge)

        ReaderStubProtocol.reset { _ in .response(status: 200, headers: ["Content-Length": "9999999"], body: Data(count: 4)) }
        let declared = await readerError { try await self.makeTransport(maxResponseBytes: 1000).send(self.get("/x")) }
        XCTAssertEqual(declared as? TransportFailure, .responseTooLarge)

        ReaderStubProtocol.reset { _ in .response(status: 200, headers: [:], body: Data(count: 10)) }
        let exact = try await makeTransport(maxResponseBytes: 10).send(get("/x"))
        XCTAssertEqual(exact.body.count, 10)
    }

    func testTimeoutAndNetworkFailureMapping() async throws {
        ReaderStubProtocol.reset { _ in .fail(.timedOut) }
        let timeout = await readerError { try await self.makeTransport().send(self.get("/x")) }
        XCTAssertEqual(timeout as? TransportFailure, .timeout)

        ReaderStubProtocol.reset { _ in .fail(.cannotConnectToHost) }
        let down = await readerError { try await self.makeTransport().send(self.get("/x")) }
        XCTAssertEqual(down as? TransportFailure, .unreachable)
    }

    func testNonSuccessStatusIsReturnedForTheClientToMap() async throws {
        ReaderStubProtocol.reset { _ in .response(status: 503, headers: [:], body: Data("{}".utf8)) }
        let response = try await makeTransport().send(get("/x"))
        XCTAssertEqual(response.status, 503)
    }

    func testClientOverProductionTransportEndToEnd() async throws {
        let body = try ReaderFixtures.fabricBody()
        ReaderStubProtocol.reset { _ in .response(status: 200, headers: [:], body: body) }
        let client = MissionFabricHTTPClient(
            endpoint: try ReaderFixtures.endpoint(), transport: try makeTransport(), authorizer: ReaderStaticAuthorizer(),
            sessionProvider: ReaderSession(ReaderFixtures.session()), clock: ReaderClock(ReaderFixtures.baseDate)
        )
        let read = try await client.readFabric(tenantId: "cambium")
        XCTAssertEqual(read.envelope.projection.tenantId, "cambium")
        XCTAssertEqual(ReaderStubProtocol.seen.get().first?.url?.path, "/v1/mission-fabric/cambium")
    }
}
