import CryptoKit
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

/// Thread-safe counter for transport handlers.
final class NativeTestCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0
    var value: Int { lock.lock(); defer { lock.unlock() }; return count }
    func increment() { lock.lock(); count += 1; lock.unlock() }
}

/// One-shot gate. `wait()` returns once `open()` has been called.
final class NativeTestGate: @unchecked Sendable {
    private let lock = NSLock()
    private var opened = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func open() {
        lock.lock()
        opened = true
        let pending = waiters
        waiters = []
        lock.unlock()
        pending.forEach { $0.resume() }
    }

    func wait() async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            lock.lock()
            if opened {
                lock.unlock()
                continuation.resume()
            } else {
                waiters.append(continuation)
                lock.unlock()
            }
        }
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

    private(set) var cancelCount = 0

    init(resultFor: @escaping @MainActor (NativeAuthorizationRequest) -> NativeBrowserResult) {
        self.resultFor = resultFor
    }

    func cancel() { cancelCount += 1 }

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
    static let expiresText = "2026-11-02T09:10:00.000Z"
    static let expiresDate = ISO8601DateFormatter().date(from: "2026-11-02T09:10:00Z")!
    static let token = "cns1_" + String(repeating: "x", count: 43)
    static let code = "cnc1_" + String(repeating: "c", count: 43)
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
        expires: String = expiresText,
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
        XCTAssertEqual(session, .verified(founderId: "founder-abc12345", tenantId: "cambium", expiresAt: NativeTestFixture.expiresDate))

        let authorize = try XCTUnwrap(browser.requests.first)
        XCTAssertEqual(authorize.url.path, "/founder/native/session/authorize")
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
            ("2026-11-02T10:00:00.000Z", .malformedResponse),
            ("2026-11-02T08:59:00.000Z", .expired),
            ("2026-11-02T09:10:00Z", .malformedResponse),
            ("2026-11-02T09:10:00.00Z", .malformedResponse),
            ("2026-11-02T09:10:00.000+00:00", .malformedResponse),
            ("2026-02-30T09:10:00.000Z", .malformedResponse),
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
        XCTAssertEqual(transport.requests.map(\.url.path), ["/v1/native/session/exchange", "/v1/native/session/logout"])
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

    // MARK: - Owner wire compatibility

    func testExpiryAcceptsOnlySourceCanonicalFractionalUTC() {
        XCTAssertEqual(NativeIdentityController.parseExpiry("2026-11-02T05:00:00.000Z"), ISO8601DateFormatter().date(from: "2026-11-02T05:00:00Z"))
        XCTAssertNotNil(NativeIdentityController.parseExpiry("2026-11-02T05:00:00.123Z"))
        for bad in ["2026-11-02T05:00:00Z", "2026-11-02T05:00:00.1Z", "2026-11-02T05:00:00.0000Z",
                    "2026-11-02T05:00:00.000+00:00", "2026-11-02 05:00:00.000Z", "2026-13-02T05:00:00.000Z",
                    "2026-02-30T05:00:00.000Z", "2026-11-02t05:00:00.000z"] {
            XCTAssertNil(NativeIdentityController.parseExpiry(bad), bad)
        }
        XCTAssertNil(NativeIdentityController.parseExpiry(1_800_000_000))
    }

    func testCredentialRealmsMatchOwnerPrefixes() {
        let body43 = String(repeating: "A", count: 42) + "_"
        XCTAssertTrue(NativeIdentityController.isAuthorizationCode("cnc1_" + body43))
        XCTAssertTrue(NativeIdentityController.isSessionToken("cns1_" + body43))
        XCTAssertFalse(NativeIdentityController.isAuthorizationCode("cns1_" + body43))
        XCTAssertFalse(NativeIdentityController.isSessionToken("cnc1_" + body43))
        XCTAssertFalse(NativeIdentityController.isSessionToken("cns1_" + body43 + "A"))
        XCTAssertFalse(NativeIdentityController.isSessionToken("cns1_" + String(body43.dropLast())))
        XCTAssertFalse(NativeIdentityController.isSessionToken("cns1_" + String(repeating: "A", count: 42) + "="))
        XCTAssertFalse(NativeIdentityController.isSessionToken("CNS1_" + body43))
        XCTAssertFalse(NativeIdentityController.isSessionToken(String(repeating: "x", count: 48)))
    }

    func testCallbackRefusesTokenRealmAndMalformedCodes() {
        let base = "space.thoughtseed.cambium.native.dev://oauth/callback"
        let state = NativeTestFixture.state
        for code in ["cns1_" + String(repeating: "c", count: 43), "cnc1_" + String(repeating: "c", count: 42),
                     "cnc1_" + String(repeating: "c", count: 44), String(repeating: "c", count: 48)] {
            XCTAssertThrowsError(try NativeIdentityController.acceptCallback(URL(string: "\(base)?code=\(code)&state=\(state)")!, transaction: transaction()), code) {
                XCTAssertEqual($0 as? NativeIdentityError, .invalidCallback, code)
            }
        }
        XCTAssertThrowsError(try NativeIdentityController.acceptCallback(URL(string: "\(base)?code=\(NativeTestFixture.code)&code=\(NativeTestFixture.code)")!, transaction: transaction())) {
            XCTAssertEqual($0 as? NativeIdentityError, .invalidCallback)
        }
    }

    func testFounderIdMatchesServerGrammar() {
        for good in ["access:founder@thoughtseed.space", "plexus/founder:42", "f", "A" + String(repeating: "b", count: 239)] {
            XCTAssertTrue(NativeIdentityController.isFounderID(good), good)
        }
        for bad in ["", ":founder", "-founder", "founder id", "founder#1", "founder?x", "A" + String(repeating: "b", count: 240)] {
            XCTAssertFalse(NativeIdentityController.isFounderID(bad), bad)
        }
    }

    @MainActor
    func testRealOwnerShapedResponsesSignIn() async throws {
        let founder = "access:founder@thoughtseed.space/abc"
        let transport = NativeTestFixture.healthyOwner(
            exchange: { _ in NativeTestFixture.json(NativeTestFixture.sessionBody(founder: founder, client: "cambium:native-dev")) },
            inspect: { _ in NativeTestFixture.json(NativeTestFixture.sessionBody(token: nil, founder: founder, client: "cambium:native-dev")) }
        )
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let configuration = try NativeIdentityConfiguration(owner: NativeTestFixture.owner, clientId: "cambium:native-dev", redirectURI: NativeTestFixture.redirect)
        let controller = NativeIdentityController(configuration: configuration, transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        let session = try await controller.signIn()
        XCTAssertEqual(session, .verified(founderId: founder, tenantId: "cambium", expiresAt: NativeTestFixture.expiresDate))
    }

    @MainActor
    func testWrongRealmExchangeTokenIsRefused() async throws {
        let transport = NativeTestFixture.healthyOwner(exchange: { _ in
            NativeTestFixture.json(NativeTestFixture.sessionBody(token: "cnc1_" + String(repeating: "x", count: 43)))
        })
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .malformedResponse) }
        XCTAssertEqual(transport.requests.map(\.method), ["POST"])
    }

    func testConfigurationAcceptsServerClientVocabularyAndOnlyReviewedCallback() {
        XCTAssertNoThrow(try NativeIdentityConfiguration(owner: NativeTestFixture.owner, clientId: "cambium:native-dev", redirectURI: NativeTestFixture.redirect))
        for bad in ["-cambium-native", "cambium/native-dev", "cambium native", "c" + String(repeating: "x", count: 128)] {
            XCTAssertThrowsError(try NativeIdentityConfiguration(owner: NativeTestFixture.owner, clientId: bad, redirectURI: NativeTestFixture.redirect), bad)
        }
        for raw in ["com.example.app://oauth/callback", "space.thoughtseed.cambium.native.dev:/oauth/callback",
                    "space.thoughtseed.cambium.native.prod://oauth/callback", "space.thoughtseed.cambium.native.dev://oauth/callback/",
                    "space.thoughtseed.cambium.native.dev://oauth:9/callback", "https://owner.example.test/callback"] {
            XCTAssertThrowsError(try NativeIdentityConfiguration(owner: NativeTestFixture.owner, clientId: NativeTestFixture.clientId, redirectURI: URL(string: raw)!), raw)
        }
    }

    // MARK: - Tenant candidate, expiry barrier, single transaction, cancel

    @MainActor
    func testTenantCandidateMismatchAfterExchangeIsRefused() async throws {
        let transport = NativeTestFixture.healthyOwner(
            exchange: { _ in NativeTestFixture.json(NativeTestFixture.sessionBody(tenant: "other-tenant")) },
            inspect: { _ in NativeTestFixture.json(NativeTestFixture.sessionBody(token: nil, tenant: "other-tenant")) }
        )
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(tenant: "cambium"), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .scopeMismatch) }
        XCTAssertEqual(transport.requests.map(\.method), ["POST", "POST"])
        XCTAssertEqual(transport.requests.map(\.url.path), ["/v1/native/session/exchange", "/v1/native/session/logout"])
        let session = await controller.currentSession()
        XCTAssertEqual(session, .unconfigured)
        let headers = try await controller.headers()
        XCTAssertEqual(headers, [:])
    }

    @MainActor
    func testSessionExpiringDuringInspectionAwaitIsNotPublished() async throws {
        let clock = NativeTestClock(NativeTestFixture.now)
        let transport = NativeTestFixture.healthyOwner(inspect: { _ in
            // The clock passes the expiry while the inspection answer is in flight.
            clock.set(NativeTestFixture.expiresDate.addingTimeInterval(1))
            return NativeTestFixture.json(NativeTestFixture.sessionBody(token: nil))
        })
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: clock, randomness: NativeTestFixture.randomness())
        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .expired) }
        clock.set(NativeTestFixture.now)
        let session = await controller.currentSession()
        XCTAssertEqual(session, .unconfigured)
        let headers = try await controller.headers()
        XCTAssertEqual(headers, [:])
    }

    @MainActor
    func testSessionExpiringDuringExchangeAwaitIsNotPublished() async throws {
        let clock = NativeTestClock(NativeTestFixture.now)
        let transport = NativeTestFixture.healthyOwner(exchange: { _ in
            clock.set(NativeTestFixture.expiresDate)
            return NativeTestFixture.json(NativeTestFixture.sessionBody())
        })
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: clock, randomness: NativeTestFixture.randomness())
        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .expired) }
        XCTAssertEqual(transport.requests.map(\.method), ["POST"])
    }

    @MainActor
    func testSecondSignInDuringExchangeIsRefusedAndFirstCompletes() async throws {
        let box = NativeTestControllerBox()
        let refusals = NativeTestCounter()
        let transport = NativeTestTransport { request in
            switch request.url.path {
            case "/v1/native/session/exchange":
                do { _ = try await box.controller?.signIn() } catch let error as NativeIdentityError where error == .signInInProgress {
                    refusals.increment()
                }
                return NativeTestFixture.json(NativeTestFixture.sessionBody())
            case "/v1/native/session":
                do { _ = try await box.controller?.signIn() } catch let error as NativeIdentityError where error == .signInInProgress {
                    refusals.increment()
                }
                return NativeTestFixture.json(NativeTestFixture.sessionBody(token: nil))
            default:
                return HTTPResponse(status: 404, body: Data())
            }
        }
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        box.controller = controller

        let session = try await controller.signIn()
        XCTAssertEqual(session.founderId, "founder-abc12345")
        XCTAssertEqual(refusals.value, 2)
        XCTAssertEqual(browser.requests.count, 1)
        XCTAssertEqual(transport.requests.map(\.method), ["POST", "GET"])
    }

    @MainActor
    func testFailedTransactionReleasesOutstandingForNextSignIn() async throws {
        var calls = 0
        let browser = NativeTestBrowser { request in
            calls += 1
            return calls == 1 ? .failed : .callback(NativeTestFixture.callback(for: request, state: NativePKCE.base64URL(Data(repeating: 4, count: 32))))
        }
        let randomness = NativeTestRandomness([NativeTestFixture.verifierBytes, NativeTestFixture.stateBytes, Data(repeating: 3, count: 32), Data(repeating: 4, count: 32)])
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: NativeTestFixture.healthyOwner(), browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: randomness)
        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .invalidCallback) }
        let session = try await controller.signIn()
        XCTAssertEqual(session.tenantId, "cambium")
    }

    @MainActor
    func testCancelDuringBrowserStopsBrowserAndSendsNothing() async throws {
        let box = NativeTestControllerBox()
        let transport = NativeTestFixture.healthyOwner()
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        browser.beforeReturn = { await box.controller?.cancelSignIn() }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        box.controller = controller

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .transactionSuperseded) }
        XCTAssertEqual(browser.cancelCount, 1)
        XCTAssertEqual(browser.requests.count, 1)
        XCTAssertTrue(transport.requests.isEmpty)
        let session = await controller.currentSession()
        XCTAssertEqual(session, .unconfigured)
    }

    @MainActor
    func testCancelWithoutSignInStartsNoBrowser() async throws {
        let browser = NativeTestBrowser { _ in .canceled }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: NativeTestFixture.healthyOwner(), browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        await controller.cancelSignIn()
        XCTAssertTrue(browser.requests.isEmpty)
        XCTAssertEqual(browser.cancelCount, 1)
    }

    @MainActor
    func testCancelDuringExchangeDiscardsLateResponse() async throws {
        let box = NativeTestControllerBox()
        let transport = NativeTestTransport { request in
            if request.url.path == "/v1/native/session/exchange" {
                await box.controller?.cancelSignIn()
                return NativeTestFixture.json(NativeTestFixture.sessionBody())
            }
            return NativeTestFixture.json(NativeTestFixture.sessionBody(token: nil))
        }
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        box.controller = controller

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .transactionSuperseded) }
        XCTAssertEqual(transport.requests.map(\.url.path), ["/v1/native/session/exchange", "/v1/native/session/logout"])
        let headers = try await controller.headers()
        XCTAssertEqual(headers, [:])
    }

    /// A cancelled transaction finishing late must not clear a newer outstanding one.
    @MainActor
    func testLateCompletionDoesNotClearNewerOutstandingTransaction() async throws {
        let box = NativeTestControllerBox()
        let gate = NativeTestGate()
        let secondState = NativePKCE.base64URL(Data(repeating: 4, count: 32))
        let secondStarted = NativeTestGate()
        var presented = 0
        let browser = NativeTestBrowser { request in
            presented == 1
                ? .callback(NativeTestFixture.callback(for: request))
                : .callback(NativeTestFixture.callback(for: request, state: secondState))
        }
        browser.beforeReturn = {
            presented += 1
            if presented == 2 {
                secondStarted.open()
                await gate.wait()
            }
        }
        let firstExchange = NativeTestCounter()
        let transport = NativeTestTransport { request in
            if request.url.path == "/v1/native/session/exchange", firstExchange.value == 0 {
                firstExchange.increment()
                await box.controller?.cancelSignIn()
                // A new sign-in begins while this old exchange is still in flight.
                Task { @MainActor in _ = try? await box.controller?.signIn() }
                await secondStarted.wait()
                return NativeTestFixture.json(NativeTestFixture.sessionBody())
            }
            if request.url.path == "/v1/native/session/exchange" {
                return NativeTestFixture.json(NativeTestFixture.sessionBody())
            }
            return NativeTestFixture.json(NativeTestFixture.sessionBody(token: nil))
        }
        let randomness = NativeTestRandomness([NativeTestFixture.verifierBytes, NativeTestFixture.stateBytes, Data(repeating: 3, count: 32), Data(repeating: 4, count: 32)])
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: randomness)
        box.controller = controller

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .transactionSuperseded) }
        // The second transaction is still outstanding, so a third is refused.
        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { XCTAssertEqual($0 as? NativeIdentityError, .signInInProgress) }
        gate.open()
        for _ in 0..<200 {
            if case .verified = await controller.currentSession() { break }
            await Task.yield()
            try await Task.sleep(nanoseconds: 1_000_000)
        }
        let session = await controller.currentSession()
        XCTAssertEqual(session.founderId, "founder-abc12345")
        XCTAssertEqual(browser.requests.count, 2)
    }

    // MARK: - Unconfigured factory

    // MARK: - Error redaction

    /// A transport that throws an arbitrary error whose text carries a secret.
    struct NativeSecretTransportError: Error, CustomStringConvertible {
        var description: String { "secret-bearing cns1_\(String(repeating: "Q", count: 43))" }
    }

    @MainActor
    func testRawTransportErrorDuringInspectionIsRedacted() async throws {
        let secret = "cns1_\(String(repeating: "Q", count: 43))"
        let transport = NativeTestTransport { request in
            if request.url.path == "/v1/native/session/exchange" {
                return NativeTestFixture.json(NativeTestFixture.sessionBody())
            }
            throw NativeSecretTransportError()
        }
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let controller = NativeIdentityController(configuration: try NativeTestFixture.configuration(), transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())

        await XCTAssertThrowsErrorAsync(try await controller.signIn()) { error in
            XCTAssertEqual(error as? NativeIdentityError, .inspectionFailed)
            XCTAssertFalse(String(describing: error).contains(secret))
            XCTAssertFalse(String(reflecting: error).contains(secret))
        }
        let session = await controller.currentSession()
        XCTAssertEqual(session, .unconfigured)
    }

    // MARK: - Source-produced wire fixture

    /// The owner fixture copied byte-exact from the source producer. Values inside it
    /// are deterministic synthetic credentials generated by the real handlers, clearly labeled as such.
    struct NativeSessionWireFixture {
        let raw: Data
        let object: [String: Any]
        let lineage: [String: Any]

        static let fixtureName = "native-session-wire.v1"
        static let lineageName = "native-session-wire-source"
        /// SHA-256 of the byte-exact fixture copy. Asserted in-test; no machine path is tracked.
        static let sha256 = "62bae3ed2a5cb64493165db5763371559ae416990708385b61de0aebce9ebade"
        /// Source `FIXTURE_NOW`. The owner issued the session at this instant, so expiry is exactly
        /// the 15 minute cap away. A clock that drops the milliseconds would see 900.123 s and refuse.
        static let issuedAt = NativeIdentityController.parseExpiry("2026-11-02T00:30:00.123Z")

        static func load() throws -> NativeSessionWireFixture {
            let fixtureURL = try XCTUnwrap(Bundle.module.url(forResource: fixtureName, withExtension: "json", subdirectory: "Fixtures"))
            let lineageURL = try XCTUnwrap(Bundle.module.url(forResource: lineageName, withExtension: "json", subdirectory: "Fixtures"))
            let raw = try Data(contentsOf: fixtureURL)
            let digest = SHA256.hash(data: raw).map { String(format: "%02x", $0) }.joined()
            XCTAssertEqual(digest, sha256)
            let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: raw) as? [String: Any])
            let lineage = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(contentsOf: lineageURL)) as? [String: Any])
            XCTAssertEqual(lineage["sha256"] as? String, sha256)
            XCTAssertEqual(lineage["fixture"] as? String, "\(fixtureName).json")
            XCTAssertEqual(lineage["sourcePath"] as? String, "workers/quests/src/fixtures/native-session-wire.v1.json")
            XCTAssertEqual(lineage["sourceCommit"] as? String, "3e37271ba3f290104c213462ae8d075339e76bfa")
            return NativeSessionWireFixture(raw: raw, object: object, lineage: lineage)
        }

        func dictionary(_ key: String) throws -> [String: Any] {
            try XCTUnwrap(object[key] as? [String: Any])
        }

        func string(_ key: String) throws -> String {
            try XCTUnwrap(object[key] as? String)
        }
    }

    func testSourceWireFixtureHashAndLineage() throws {
        let fixture = try NativeSessionWireFixture.load()
        XCTAssertEqual(fixture.object["synthetic"] as? String, "Deterministic synthetic values for wire tests. Not real credentials.")
        XCTAssertEqual(fixture.object["contractVersion"] as? String, "cambium.native-session.v1")
        let rendered = String(decoding: fixture.raw, as: UTF8.self)
        XCTAssertFalse(rendered.contains("Authorization"))
        XCTAssertFalse(rendered.localizedCaseInsensitiveContains("Bearer cns1_"))
    }

    func testSourceWireFixtureDecodesExchangeAndInspectBodies() throws {
        let fixture = try NativeSessionWireFixture.load()
        let configuration = try NativeIdentityConfiguration(
            owner: NativeTestFixture.owner,
            clientId: try fixture.string("clientId"),
            redirectURI: URL(string: try fixture.string("redirectUri"))!
        )
        let clock = try XCTUnwrap(NativeSessionWireFixture.issuedAt)
        let exchange = try JSONSerialization.data(withJSONObject: try fixture.dictionary("exchangeResponse"))
        let parsed = try NativeIdentityController.parseSession(exchange, configuration: configuration, requireToken: true, now: clock)
        XCTAssertEqual(parsed.founderId, "founder-synth-1")
        XCTAssertEqual(parsed.tenantId, "tenant-alpha")
        XCTAssertEqual(parsed.clientId, "space.thoughtseed.cambium.native.dev")
        XCTAssertTrue(parsed.token.hasPrefix("cns1_"))
        XCTAssertEqual(NativeIdentityController.parseExpiry("2026-11-02T00:45:00.123Z"), parsed.expiresAt)

        let inspect = try JSONSerialization.data(withJSONObject: try fixture.dictionary("sessionReadResponse"))
        let read = try NativeIdentityController.parseSession(inspect, configuration: configuration, requireToken: false, now: clock)
        XCTAssertEqual(read.founderId, parsed.founderId)
        XCTAssertEqual(read.tenantId, parsed.tenantId)
        XCTAssertEqual(read.clientId, parsed.clientId)
        XCTAssertEqual(read.expiresAt, parsed.expiresAt)
        XCTAssertEqual(read.token, "")
    }

    func testSourceWireFixturePKCEMatchesRFCVector() throws {
        let fixture = try NativeSessionWireFixture.load()
        let exchange = try fixture.dictionary("exchangeRequest")
        let query = try fixture.dictionary("authorizeQuery")
        let verifier = try XCTUnwrap(exchange["codeVerifier"] as? String)
        XCTAssertEqual(verifier, "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
        XCTAssertEqual(NativePKCE.challenge(verifier: verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
        XCTAssertEqual(query["code_challenge"] as? String, NativePKCE.challenge(verifier: verifier))
        XCTAssertEqual(query["code_challenge_method"] as? String, "S256")
    }

    @MainActor
    func testSourceWireFixtureDrivesWholeIdentityFlow() async throws {
        let fixture = try NativeSessionWireFixture.load()
        let clientId = try fixture.string("clientId")
        let redirect = try XCTUnwrap(URL(string: try fixture.string("redirectUri")))
        let configuration = try NativeIdentityConfiguration(
            owner: NativeTestFixture.owner,
            clientId: clientId,
            redirectURI: redirect,
            tenantCandidate: "tenant-alpha"
        )
        let exchangeRequest = try fixture.dictionary("exchangeRequest")
        let verifier = try XCTUnwrap(exchangeRequest["codeVerifier"] as? String)
        let sourceCode = try XCTUnwrap(exchangeRequest["code"] as? String)
        let sourceState = try XCTUnwrap((try fixture.dictionary("authorizeQuery"))["state"] as? String)
        XCTAssertTrue(sourceCode.hasPrefix("cnc1_"))
        // The RFC 7636 verifier decodes to exactly the 32 bytes the client draws.
        let verifierBytes = try XCTUnwrap(Data(base64URLEncoded: verifier))
        XCTAssertEqual(verifierBytes.count, 32)
        // The client generates its own state. The browser stub echoes that state with the source code.
        let stateBytes = NativeTestFixture.stateBytes
        let generatedState = NativePKCE.base64URL(stateBytes)
        XCTAssertNotEqual(generatedState, sourceState)

        let exchangeBody = try JSONSerialization.data(withJSONObject: try fixture.dictionary("exchangeResponse"))
        let inspectBody = try JSONSerialization.data(withJSONObject: try fixture.dictionary("sessionReadResponse"))
        let transport = NativeTestTransport { request in
            switch (request.method, request.url.path) {
            case ("POST", "/v1/native/session/exchange"):
                return HTTPResponse(status: 200, body: exchangeBody)
            case ("GET", "/v1/native/session"):
                return HTTPResponse(status: 200, body: inspectBody)
            case ("POST", "/v1/native/session/logout"):
                return HTTPResponse(status: 200, body: Data("{}".utf8))
            default:
                return HTTPResponse(status: 404, body: Data())
            }
        }
        let browser = NativeTestBrowser { request in
            let state = URLComponents(url: request.url, resolvingAgainstBaseURL: false)?
                .queryItems?.first { $0.name == "state" }?.value
            var components = URLComponents(url: redirect, resolvingAgainstBaseURL: false)!
            components.queryItems = [
                URLQueryItem(name: "code", value: sourceCode),
                URLQueryItem(name: "state", value: state)
            ]
            return .callback(components.url!)
        }
        let clock = NativeTestClock(try XCTUnwrap(NativeSessionWireFixture.issuedAt))
        let controller = NativeIdentityController(
            configuration: configuration,
            transport: transport,
            browser: browser,
            clock: clock,
            randomness: NativeTestRandomness([verifierBytes, stateBytes])
        )

        let session = try await controller.signIn()
        let expires = try XCTUnwrap(NativeIdentityController.parseExpiry("2026-11-02T00:45:00.123Z"))
        XCTAssertEqual(session, .verified(founderId: "founder-synth-1", tenantId: "tenant-alpha", expiresAt: expires))

        let authorize = try XCTUnwrap(browser.requests.first)
        let query = Dictionary(uniqueKeysWithValues: (URLComponents(url: authorize.url, resolvingAgainstBaseURL: false)?.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        XCTAssertEqual(query["client_id"], clientId)
        XCTAssertEqual(query["code_challenge_method"], "S256")
        XCTAssertEqual(query["code_challenge"], NativePKCE.challenge(verifier: verifier))
        XCTAssertEqual(query["state"], generatedState)
        XCTAssertEqual(query["tenant"], "tenant-alpha")

        let sent = try XCTUnwrap(transport.requests.first?.body)
        let sentJSON = try XCTUnwrap(JSONSerialization.jsonObject(with: sent) as? [String: Any])
        XCTAssertEqual(sentJSON["code"] as? String, sourceCode)
        XCTAssertEqual(sentJSON["codeVerifier"] as? String, verifier)
        XCTAssertEqual(sentJSON["redirectUri"] as? String, redirect.absoluteString)
        XCTAssertEqual(sentJSON["clientId"] as? String, clientId)
        XCTAssertEqual(sentJSON["contractVersion"] as? String, "cambium.native-session.v1")
        let headers = try await controller.headers()
        XCTAssertEqual(headers["authorization"], "Bearer \(try XCTUnwrap((try fixture.dictionary("exchangeResponse"))["token"] as? String))")
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

    // MARK: - Clock skew and origin-bound authorizer

    @MainActor
    func testClockSkewToleranceWithin120SecondsSucceeds() throws {
        let configuration = try NativeTestFixture.configuration()
        let issuedAt = NativeTestFixture.now
        // Token expires exactly 900 seconds after issuedAt.
        let expiresAt = issuedAt.addingTimeInterval(900)
        let expiresString = CanonicalTimestamp.string(from: expiresAt)
        var body = NativeTestFixture.sessionBody(expires: expiresString)
        body["token"] = NativeTestFixture.token
        let data = try JSONSerialization.data(withJSONObject: body)

        // Client clock behind by 250ms (so expiresAt - now = 900.250 <= 900 + 120).
        let clientClockBehind250ms = issuedAt.addingTimeInterval(-0.250)
        let parsed = try NativeIdentityController.parseSession(data, configuration: configuration, requireToken: true, now: clientClockBehind250ms)
        XCTAssertEqual(parsed.expiresAt, expiresAt)

        // Client clock behind by 121 seconds (so expiresAt - now = 1021 > 1020).
        let clientClockBehind121s = issuedAt.addingTimeInterval(-121)
        XCTAssertThrowsError(try NativeIdentityController.parseSession(data, configuration: configuration, requireToken: true, now: clientClockBehind121s)) {
            XCTAssertEqual($0 as? NativeIdentityError, .malformedResponse)
        }
    }

    @MainActor
    func testOriginBoundAuthorizerRefusesCrossOriginDestinations() async throws {
        let transport = NativeTestFixture.healthyOwner()
        let browser = NativeTestBrowser { .callback(NativeTestFixture.callback(for: $0)) }
        let configuration = try NativeTestFixture.configuration()
        let controller = NativeIdentityController(configuration: configuration, transport: transport, browser: browser, clock: NativeTestClock(NativeTestFixture.now), randomness: NativeTestFixture.randomness())
        _ = try await controller.signIn()

        let ownerURL = configuration.sessionURL
        let admittedHeaders = try await controller.headers(for: ownerURL)
        XCTAssertEqual(admittedHeaders["authorization"], "Bearer \(NativeTestFixture.token)")

        let maliciousURL = URL(string: "https://evil.example.test/v1/native/session")!
        await XCTAssertThrowsErrorAsync(try await controller.headers(for: maliciousURL)) {
            XCTAssertEqual($0 as? NativeIdentityError, .exchangeRefused)
        }

        let insecureURL = URL(string: "http://owner.example.test/v1/native/session")!
        await XCTAssertThrowsErrorAsync(try await controller.headers(for: insecureURL)) {
            XCTAssertEqual($0 as? NativeIdentityError, .exchangeRefused)
        }
    }
}

extension Data {
    /// Decodes unpadded base64url, as PKCE verifiers and fixture state are encoded.
    init?(base64URLEncoded value: String) {
        var padded = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        padded += String(repeating: "=", count: (4 - padded.count % 4) % 4)
        guard let data = Data(base64Encoded: padded) else { return nil }
        self = data
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
