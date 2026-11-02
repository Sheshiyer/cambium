import Foundation
import XCTest
@testable import CambiumCore

// Stubs for the native identity controller. They are prefixed to stay unique
// inside the shared test module.

final class NativeTestClock: CoreClock, @unchecked Sendable {
    private let lock = NSLock()
    private var current: Date

    init(_ date: Date) { current = date }

    func now() -> Date { lock.lock(); defer { lock.unlock() }; return current }
    func set(_ date: Date) { lock.lock(); current = date; lock.unlock() }
}

/// Returns fixed bytes in call order: first the PKCE verifier, then the state.
final class NativeTestRandomness: NativeIdentityRandomness, @unchecked Sendable {
    private let lock = NSLock()
    private var calls = 0
    private let values: [Data]

    init(_ values: [Data]) { self.values = values }

    func bytes(count: Int) throws -> Data {
        lock.lock(); defer { lock.unlock() }
        let index = calls
        calls += 1
        guard index < values.count, values[index].count == count else {
            throw NativeIdentityError.randomnessUnavailable
        }
        return values[index]
    }
}

final class NativeTestTransport: HTTPTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var recorded: [HTTPRequest] = []
    private let handler: @Sendable (HTTPRequest) async throws -> HTTPResponse

    init(_ handler: @escaping @Sendable (HTTPRequest) async throws -> HTTPResponse) {
        self.handler = handler
    }

    var requests: [HTTPRequest] {
        lock.lock(); defer { lock.unlock() }
        return recorded
    }

    private func record(_ request: HTTPRequest) {
        lock.lock(); defer { lock.unlock() }
        recorded.append(request)
    }

    func send(_ request: HTTPRequest) async throws -> HTTPResponse {
        record(request)
        return try await handler(request)
    }
}

/// Lets a transport handler reach the controller it serves.
final class NativeTestControllerBox: @unchecked Sendable {
    var controller: NativeIdentityController?
}

@MainActor
final class NativeTestBrowser: NativeBrowserPresenting {
    private(set) var requests: [NativeAuthorizationRequest] = []
    var resultFor: @MainActor (NativeAuthorizationRequest) -> NativeBrowserResult
    var beforeReturn: (@MainActor () async -> Void)?

    init(resultFor: @escaping @MainActor (NativeAuthorizationRequest) -> NativeBrowserResult) {
        self.resultFor = resultFor
    }

    func present(_ request: NativeAuthorizationRequest) async -> NativeBrowserResult {
        requests.append(request)
        if let beforeReturn { await beforeReturn() }
        return resultFor(request)
    }
}

enum NativeTestFixture {
    static let owner = URL(string: "https://owner.example.test")!
    static let clientId = "cambium-native-dev"
    static let redirect = URL(string: "space.thoughtseed.cambium.native.dev://oauth/callback")!
    static let now = ISO8601DateFormatter().date(from: "2026-11-02T09:00:00Z")!
    static let token = "native_" + String(repeating: "x", count: 40)
    static let code = "code_" + String(repeating: "c", count: 40)
    static let verifierBytes = Data(repeating: 7, count: 32)
    static let stateBytes = Data(repeating: 9, count: 32)

    static var verifier: String { NativePKCE.base64URL(verifierBytes) }
    static var state: String { NativePKCE.base64URL(stateBytes) }

    static func configuration(tenant: String? = nil) throws -> NativeIdentityConfiguration {
        try NativeIdentityConfiguration(owner: owner, clientId: clientId, redirectURI: redirect, tenantCandidate: tenant)
    }

    static func randomness() -> NativeTestRandomness {
        NativeTestRandomness([verifierBytes, stateBytes])
    }

    static func sessionBody(
        token: String? = token,
        founder: String = "founder-abc12345",
        tenant: String = "cambium",
        client: String = clientId,
        expires: String = "2026-11-02T09:10:00Z",
        role: String = "founder",
        enrolled: Bool = true
    ) -> [String: Any] {
        var body: [String: Any] = [
            "contractVersion": nativeSessionContractVersion,
            "founderId": founder,
            "tenantId": tenant,
            "clientId": client,
            "role": role,
            "enrolled": enrolled,
            "expiresAt": expires
        ]
        if let token {
            body["token"] = token
            body["tokenType"] = "Bearer"
        }
        return body
    }

    static func json(_ object: [String: Any], status: Int = 200) -> HTTPResponse {
        HTTPResponse(status: status, body: (try? JSONSerialization.data(withJSONObject: object)) ?? Data())
    }

    static func callback(for request: NativeAuthorizationRequest, code: String = code, state: String? = nil) -> URL {
        let value = state ?? NativeTestFixture.state
        var components = URLComponents(url: redirect, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "code", value: code), URLQueryItem(name: "state", value: value)]
        return components.url!
    }

    /// Owner that accepts exchange and then inspection, returning a healthy session.
    static func healthyOwner(
        exchange: @escaping @Sendable (HTTPRequest) -> HTTPResponse = { _ in
            json(sessionBody())
        },
        inspect: @escaping @Sendable (HTTPRequest) -> HTTPResponse = { _ in
            json(sessionBody(token: nil))
        }
    ) -> NativeTestTransport {
        NativeTestTransport { request in
            switch (request.method, request.url.path) {
            case ("POST", "/v1/native/session/exchange"): return exchange(request)
            case ("GET", "/v1/native/session"): return inspect(request)
            case ("POST", "/v1/native/session/logout"): return HTTPResponse(status: 200, body: Data("{}".utf8))
            default: return HTTPResponse(status: 404, body: Data())
            }
        }
    }
}

final class NativeIdentityTests: XCTestCase {

    // MARK: - PKCE and randomness

    func testRFC7636AppendixBVector() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        XCTAssertEqual(NativePKCE.challenge(verifier: verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
    }

    func testSystemRandomnessProducesRequestedLengthAndVaries() throws {
        let source = SystemNativeIdentityRandomness()
        let first = try source.bytes(count: 32)
        let second = try source.bytes(count: 32)
        XCTAssertEqual(first.count, 32)
        XCTAssertNotEqual(first, second)
    }

    func testVerifierAndStateMeetLengthBounds() {
        XCTAssertEqual(NativeTestFixture.verifier.count, 43)
        XCTAssertEqual(NativeTestFixture.state.count, 43)
        XCTAssertFalse(NativeTestFixture.verifier.contains("="))
    }

    // MARK: - Configuration

    func testConfigurationRejectsUnsafeInputs() {
        XCTAssertThrowsError(try NativeIdentityConfiguration(owner: URL(string: "http://owner.example.test")!, clientId: NativeTestFixture.clientId, redirectURI: NativeTestFixture.redirect))
        XCTAssertThrowsError(try NativeIdentityConfiguration(owner: URL(string: "https://user@owner.example.test")!, clientId: NativeTestFixture.clientId, redirectURI: NativeTestFixture.redirect))
        XCTAssertThrowsError(try NativeIdentityConfiguration(owner: NativeTestFixture.owner, clientId: "short", redirectURI: NativeTestFixture.redirect))
        XCTAssertThrowsError(try NativeIdentityConfiguration(owner: NativeTestFixture.owner, clientId: NativeTestFixture.clientId, redirectURI: URL(string: "space.thoughtseed.cambium.native.dev://oauth/callback?x=1")!))
        XCTAssertThrowsError(try NativeIdentityConfiguration(owner: NativeTestFixture.owner, clientId: NativeTestFixture.clientId, redirectURI: URL(string: "space.thoughtseed.cambium.native.dev://oauth/callback#f")!))
        XCTAssertThrowsError(try NativeIdentityConfiguration(owner: NativeTestFixture.owner, clientId: NativeTestFixture.clientId, redirectURI: URL(string: "space.thoughtseed.cambium.native.dev://")!))
        XCTAssertThrowsError(try NativeIdentityConfiguration(owner: NativeTestFixture.owner, clientId: NativeTestFixture.clientId, redirectURI: NativeTestFixture.redirect, tenantCandidate: "Bad Tenant"))
        XCTAssertNoThrow(try NativeTestFixture.configuration(tenant: "cambium"))
    }

    // MARK: - Callback validation

    private func transaction(redirect: URL = NativeTestFixture.redirect) -> NativeTransaction {
        NativeTransaction(generation: 1, state: NativeTestFixture.state, verifier: NativeTestFixture.verifier, redirectURI: redirect)
    }

    func testExactCallbackAccepted() throws {
        let url = NativeTestFixture.callback(for: NativeAuthorizationRequest(url: NativeTestFixture.owner, redirectURI: NativeTestFixture.redirect))
        let code = try NativeIdentityController.acceptCallback(url, transaction: transaction())
        XCTAssertEqual(code, NativeTestFixture.code)
    }

    func testCallbackRejectsWrongStateScheme_host_path_extra_and_missing() {
        let base = "space.thoughtseed.cambium.native.dev://oauth/callback"
        let state = NativeTestFixture.state
        let cases: [(String, NativeIdentityError)] = [
            ("\(base)?code=\(NativeTestFixture.code)&state=wrong-state-value-0000000000000000000", .stateMismatch),
            ("space.thoughtseed.cambium.native.prod://oauth/callback?code=\(NativeTestFixture.code)&state=\(state)", .invalidCallback),
            ("space.thoughtseed.cambium.native.dev://other/callback?code=\(NativeTestFixture.code)&state=\(state)", .invalidCallback),
            ("space.thoughtseed.cambium.native.dev://oauth/other?code=\(NativeTestFixture.code)&state=\(state)", .invalidCallback),
            ("\(base)?code=\(NativeTestFixture.code)&state=\(state)&extra=1", .invalidCallback),
            ("\(base)?code=\(NativeTestFixture.code)", .invalidCallback),
            ("\(base)?state=\(state)", .invalidCallback),
            ("\(base)?code=\(NativeTestFixture.code)&state=\(state)#frag", .invalidCallback),
            ("space.thoughtseed.cambium.native.dev://user@oauth/callback?code=\(NativeTestFixture.code)&state=\(state)", .invalidCallback),
            ("\(base)?code=short&state=\(state)", .invalidCallback)
        ]
        for (raw, expected) in cases {
            XCTAssertThrowsError(try NativeIdentityController.acceptCallback(URL(string: raw)!, transaction: transaction()), raw) { error in
                XCTAssertEqual(error as? NativeIdentityError, expected, raw)
            }
        }
    }

    // MARK: - Full sign-in flow

    @MainActor
    func testFullSignInExchangesAndInspectsBeforePublishing() async throws {
        let transport = NativeTestFixture.healthyOwner()
        let browser = NativeTestBrowser { request in
            .callback(NativeTestFixture.callback(for: request))
        }
        let controller = NativeIdentityController(
            configuration: try NativeTestFixture.configuration(tenant: "cambium"),
            transport: transport,
            browser: browser,
            clock: NativeTestClock(NativeTestFixture.now),
            randomness: NativeTestFixture.randomness()
        )

        let session = try await controller.signIn()
        XCTAssertEqual(session, .verified(founderId: "founder-abc12345", tenantId: "cambium", expiresAt: ISO8601DateFormatter().date(from: "2026-11-02T09:10:00Z")!))

        let authorize = try XCTUnwrap(browser.requests.first)
        XCTAssertEqual(authorize.url.path, "/v1/native/session/authorize")
        let query = Dictionary(uniqueKeysWithValues: (URLComponents(url: authorize.url, resolvingAgainstBaseURL: false)?.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        XCTAssertEqual(query["client_id"], NativeTestFixture.clientId)
        XCTAssertEqual(query["code_challenge_method"], "S256")
        XCTAssertEqual(query["code_challenge"], NativePKCE.challenge(verifier: NativeTestFixture.verifier))
        XCTAssertEqual(query["state"], NativeTestFixture.state)
        XCTAssertEqual(query["tenant"], "cambium")

        let requests = transport.requests
        XCTAssertEqual(requests.map(\.method), ["POST", "GET"])
        let exchangeBody = try XCTUnwrap(requests[0].body)
        let exchangeJSON = try XCTUnwrap(JSONSerialization.jsonObject(with: exchangeBody) as? [String: Any])
        XCTAssertEqual(Set(exchangeJSON.keys), ["contractVersion", "clientId", "code", "codeVerifier", "redirectUri"])
        XCTAssertEqual(exchangeJSON["contractVersion"] as? String, "cambium.native-session.v1")
        XCTAssertEqual(exchangeJSON["codeVerifier"] as? String, NativeTestFixture.verifier)
        XCTAssertNil(requests[0].headers["cookie"])
        XCTAssertNil(requests[0].headers["cf-access-jwt-assertion"])
        XCTAssertEqual(requests[1].headers["authorization"], "Bearer \(NativeTestFixture.token)")

        let headers = try await controller.headers()
        XCTAssertEqual(headers, ["authorization": "Bearer \(NativeTestFixture.token)"])
    }

    @MainActor
    func testInspectionScopeMismatchPublishesNothing() async throws {
        let transport = NativeTestFixture.healthyOwner(inspect: { _ in
            NativeTestFixture.json(NativeTestFixture.sessionBody(token: nil, tenant: "other-tenant"))
        })
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .scopeMismatch) }
        let session = await controller.currentSession()
        XCTAssertEqual(session, .unconfigured)
        let headers = try await controller.headers()
        XCTAssertEqual(headers, [:])
    }

    @MainActor
    func testExchangeClientMismatchIsRefused() async throws {
        let transport = NativeTestFixture.healthyOwner(exchange: { _ in
            NativeTestFixture.json(NativeTestFixture.sessionBody(client: "someone-else-client"))
        })
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .scopeMismatch) }
        XCTAssertEqual(transport.requests.map(\.method), ["POST"])
        let session = await controller.currentSession()
        XCTAssertEqual(session, .unconfigured)
    }

    // MARK: - Browser outcomes and callback abuse

    @MainActor
    func testBrowserCancelSendsNoExchange() async throws {
        let transport = NativeTestFixture.healthyOwner()
        let browser = NativeTestBrowser { _ in .canceled }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .canceled) }
        XCTAssertTrue(transport.requests.isEmpty)
    }

    @MainActor
    func testWrongStateCallbackSendsNoExchange() async throws {
        let transport = NativeTestFixture.healthyOwner()
        let browser = NativeTestBrowser { request in
            .callback(NativeTestFixture.callback(for: request, state: "attacker-state-value-000000000000000000"))
        }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .stateMismatch) }
        XCTAssertTrue(transport.requests.isEmpty)
    }

    @MainActor
    func testSecondSignInInvalidatesOldCallback() async throws {
        let transport = NativeTestFixture.healthyOwner()
        var firstCallback: URL?
        let browser = NativeTestBrowser { request in
            if firstCallback == nil {
                firstCallback = NativeTestFixture.callback(for: request)
                return .canceled
            }
            return .callback(firstCallback!)
        }
        let randomness = NativeTestRandomness([NativeTestFixture.verifierBytes, NativeTestFixture.stateBytes, Data(repeating: 3, count: 32), Data(repeating: 4, count: 32)])
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: randomness)

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .canceled) }
        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .stateMismatch) }
        XCTAssertTrue(transport.requests.isEmpty)
    }

    @MainActor
    func testConcurrentSignInIsRefused() async throws {
        let transport = NativeTestFixture.healthyOwner()
        let box = NativeTestControllerBox()
        let browser = NativeTestBrowser { _ in .canceled }
        browser.beforeReturn = {
            do { _ = try await box.controller?.signIn() } catch {
                XCTAssertEqual(error as? NativeIdentityError, .signInInProgress)
            }
        }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        box.controller = controller

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .canceled) }
    }

    @MainActor
    func testLostExchangeIsNotReplayed() async throws {
        let transport = NativeTestTransport { _ in throw TransportFailure.timeout }
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .exchangeLost) }
        XCTAssertEqual(transport.requests.count, 1)
        let session = await controller.currentSession()
        XCTAssertEqual(session, .unconfigured)
    }

    @MainActor
    func testRefusedExchangeIsGenericAndNotReplayed() async throws {
        let transport = NativeTestFixture.healthyOwner(exchange: { _ in
            NativeTestFixture.json(["contractVersion": nativeSessionContractVersion, "error": "invalid_grant"], status: 400)
        })
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .exchangeRefused) }
        XCTAssertEqual(transport.requests.count, 1)
    }

    // MARK: - Session response validation

    @MainActor
    func testMalformedExpiredAndOverlongExpiryAreRefused() async throws {
        let cases: [(String, NativeIdentityError)] = [
            ("2026-11-02T10:00:00Z", .malformedResponse),
            ("2026-11-02T08:59:00Z", .expired),
            ("2026-11-02T09:10:00.000Z", .malformedResponse),
            ("not-a-date", .malformedResponse)
        ]
        for (expires, expected) in cases {
            let transport = NativeTestFixture.healthyOwner(exchange: { _ in
                NativeTestFixture.json(NativeTestFixture.sessionBody(expires: expires))
            })
            let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
            let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
            await XCTAssertThrowsErrorAsync(try await controller.signIn(), expires) { XCTAssertEqual($0 as? NativeIdentityError, expected, expires) }
        }
    }

    @MainActor
    func testExchangeWithoutTokenOrWithRoleOtherThanFounderIsRefused() async throws {
        let noToken = NativeTestFixture.healthyOwner(exchange: { _ in NativeTestFixture.json(NativeTestFixture.sessionBody(token: nil)) })
        let roleOther = NativeTestFixture.healthyOwner(exchange: { _ in NativeTestFixture.json(NativeTestFixture.sessionBody(role: "member")) })
        for transport in [noToken, roleOther] {
            let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
            let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
            await XCTAssertThrowsErrorAsync(try await controller.signIn()) { error in
                XCTAssertTrue(error is NativeIdentityError)
            }
            let session = await controller.currentSession()
            XCTAssertEqual(session, .unconfigured)
        }
    }

    // MARK: - Expiry, sign-out and principal switch

    @MainActor
    func testExpiredSessionBecomesUnconfiguredAndHeadersStop() async throws {
        let clock = NativeTestClock(NativeTestFixture.now)
        let transport = NativeTestFixture.healthyOwner()
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: clock, randomness: NativeTestFixture.randomness())
        _ = try await controller.signIn()

        clock.set(NativeTestFixture.now.addingTimeInterval(11 * 60))
        let headers = try await controller.headers()
        XCTAssertEqual(headers, [:])
        let session = await controller.currentSession()
        XCTAssertEqual(session, .unconfigured)
    }

    @MainActor
    func testSignOutClearsLocalStateAndReportsOwnerConfirmationSeparately() async throws {
        let transport = NativeTestFixture.healthyOwner()
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        _ = try await controller.signIn()

        let report = await controller.signOut()
        XCTAssertEqual(report, NativeLogoutReport(localCleared: true, ownerConfirmed: true))
        let logout = try XCTUnwrap(transport.requests.last)
        XCTAssertEqual(logout.url.path, "/v1/native/session/logout")
        XCTAssertEqual(logout.headers["authorization"], "Bearer \(NativeTestFixture.token)")
        let headers = try await controller.headers()
        XCTAssertEqual(headers, [:])
    }

    @MainActor
    func testSignOutWithOwnerFailureStillClearsLocalState() async throws {
        let transport = NativeTestTransport { request in
            if request.url.path == "/v1/native/session/logout" { throw TransportFailure.unreachable }
            if request.url.path == "/v1/native/session/exchange" { return NativeTestFixture.json(NativeTestFixture.sessionBody()) }
            return NativeTestFixture.json(NativeTestFixture.sessionBody(token: nil))
        }
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        _ = try await controller.signIn()

        let report = await controller.signOut()
        XCTAssertEqual(report, NativeLogoutReport(localCleared: true, ownerConfirmed: false))
        let session = await controller.currentSession()
        XCTAssertEqual(session, .unconfigured)
    }

    @MainActor
    func testSignOutDuringExchangeDiscardsLateResponse() async throws {
        let box = NativeTestControllerBox()
        let transport = NativeTestTransport { request in
            if request.url.path == "/v1/native/session/exchange" {
                // A sign-out lands while the exchange is in flight.
                _ = await box.controller?.signOut()
                return NativeTestFixture.json(NativeTestFixture.sessionBody())
            }
            return NativeTestFixture.json(NativeTestFixture.sessionBody(token: nil))
        }
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        box.controller = controller

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .transactionSuperseded) }
        XCTAssertEqual(transport.requests.map(\.url.path), ["/v1/native/session/exchange"])
        let session = await controller.currentSession()
        XCTAssertEqual(session, .unconfigured)
        let headers = try await controller.headers()
        XCTAssertEqual(headers, [:])
    }

    @MainActor
    func testSignOutDuringBrowserDiscardsCallback() async throws {
        let box = NativeTestControllerBox()
        let transport = NativeTestFixture.healthyOwner()
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        browser.beforeReturn = { _ = await box.controller?.signOut() }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        box.controller = controller

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .transactionSuperseded) }
        XCTAssertTrue(transport.requests.isEmpty)
    }

    // MARK: - Redaction

    @MainActor
    func testDescriptionsNeverRevealTheBearerOrCallbackCode() async throws {
        let transport = NativeTestFixture.healthyOwner()
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        _ = try await controller.signIn()

        let rendered = [
            String(describing: controller),
            String(reflecting: controller),
            String(describing: NativeIdentityError.exchangeLost),
            String(describing: NativeIdentityError.invalidCallback)
        ].joined(separator: " ")
        XCTAssertFalse(rendered.contains(NativeTestFixture.token))
        XCTAssertFalse(rendered.contains(NativeTestFixture.code))
        XCTAssertFalse(rendered.contains(NativeTestFixture.verifier))
    }

    // MARK: - Unconfigured factory

    @MainActor
    func testFactoryWithoutExplicitConfigurationStaysUnconfigured() async throws {
        let controller = NativeIdentityController.make(configuration: nil, transport: nil, browser: nil)
        let session = await controller.currentSession()
        XCTAssertEqual(session, .unconfigured)
        let headers = try await controller.headers()
        XCTAssertEqual(headers, [:])
        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .unconfigured) }
    }
}

/// Async throw assertion helper. The closure receives the thrown error.
@MainActor
func XCTAssertThrowsErrorAsync<T>(
    _ expression: @autoclosure () async throws -> T,
    _ message: @autoclosure () -> String = "",
    file: StaticString = #filePath,
    line: UInt = #line,
    _ errorHandler: (Error) -> Void = { _ in }
) async {
    do {
        _ = try await expression()
        XCTFail("expected an error: \(message())", file: file, line: line)
    } catch {
        errorHandler(error)
    }
}
