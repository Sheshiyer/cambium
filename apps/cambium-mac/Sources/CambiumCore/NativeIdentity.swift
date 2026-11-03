import CryptoKit
import Foundation
import Security

// Founder sign-in through the owner-hosted native session contract
// (cambium.native-session.v1, workers/quests/src/native-session.ts).
// This controller creates no identity of its own: a session exists only after
// the owner's HTTPS responses confirm exchange and inspection. The bearer stays
// in memory. Nothing here reads or writes recovery, keychain, environment or
// native session stores, and no refresh is attempted.

public let nativeSessionContractVersion = "cambium.native-session.v1"

public enum NativeIdentityError: Error, Equatable, Sendable {
    case invalidConfiguration
    case randomnessUnavailable
    case unconfigured
    case signInInProgress
    case canceled
    case invalidCallback
    case stateMismatch
    case transactionSuperseded
    case exchangeRefused
    /// The exchange request was sent but no usable answer arrived. The code may
    /// already be spent, so nothing replays it automatically.
    case exchangeLost
    case inspectionFailed
    case scopeMismatch
    case malformedResponse
    case expired
    case transport(TransportFailure)
}

extension NativeIdentityError: CustomStringConvertible {
    public var description: String {
        switch self {
        case .invalidConfiguration: "native identity configuration is invalid"
        case .randomnessUnavailable: "native identity could not draw secure random bytes"
        case .unconfigured: "native identity is unconfigured"
        case .signInInProgress: "a native sign-in is already outstanding"
        case .canceled: "native sign-in was canceled"
        case .invalidCallback: "native callback did not match the registered URI"
        case .stateMismatch: "native callback state did not match"
        case .transactionSuperseded: "native sign-in was superseded"
        case .exchangeRefused: "native code exchange was refused"
        case .exchangeLost: "native code exchange was lost"
        case .inspectionFailed: "native session inspection was refused"
        case .scopeMismatch: "native session scope did not match"
        case .malformedResponse: "native session response was malformed"
        case .expired: "native session expired"
        case .transport: "native identity transport failed"
        }
    }
}

/// Pinned owner origin plus one reviewed client and its exact callback.
public struct NativeIdentityConfiguration: Sendable, Equatable {
    /// The only callback this client registers: reviewed reversed-domain dev
    /// scheme, host `oauth`, path `/callback`. Matches Info.plist.in.
    public static let reviewedRedirectURI = URL(string: "space.thoughtseed.cambium.native.dev://oauth/callback")!

    public let origin: HTTPOriginPolicy
    public let clientId: String
    public let redirectURI: URL
    /// Optional tenant candidate. When set, the exchanged and inspected tenant must equal it.
    public let tenantCandidate: String?

    public init(owner: URL, clientId: String, redirectURI: URL, tenantCandidate: String? = nil) throws {
        let origin: HTTPOriginPolicy
        do { origin = try HTTPOriginPolicy(url: owner) } catch { throw NativeIdentityError.invalidConfiguration }
        guard origin.scheme == "https" else { throw NativeIdentityError.invalidConfiguration }
        guard Self.isReviewedClientId(clientId) else { throw NativeIdentityError.invalidConfiguration }
        guard Self.isExactCallback(redirectURI) else { throw NativeIdentityError.invalidConfiguration }
        if let tenantCandidate, !Self.isNativeTenant(tenantCandidate) {
            throw NativeIdentityError.invalidConfiguration
        }
        self.origin = origin
        self.clientId = clientId
        self.redirectURI = redirectURI
        self.tenantCandidate = tenantCandidate
    }

    /// Server `CLIENT_ID`: an alphanumeric start, then 7 to 127 of `A-Za-z0-9._:-`.
    public static func isReviewedClientId(_ value: String) -> Bool {
        guard let first = value.utf8.first, isASCIIAlphanumeric(first) else { return false }
        let rest = value.utf8.dropFirst()
        return (7...127).contains(rest.count) && rest.allSatisfy(isClientIdByte)
    }

    /// Exact match against the reviewed callback. No other scheme, host, path, query or fragment is admitted.
    public static func isExactCallback(_ url: URL) -> Bool {
        url.absoluteString == reviewedRedirectURI.absoluteString
    }

    /// Server `TENANT`: a lowercase letter, then 1 to 63 of `a-z0-9-`.
    public static func isNativeTenant(_ value: String) -> Bool {
        guard let first = value.utf8.first, first >= 0x61, first <= 0x7A else { return false }
        let rest = value.utf8.dropFirst()
        return (1...63).contains(rest.count) && rest.allSatisfy { byte in
            (byte >= 0x61 && byte <= 0x7A) || (byte >= 0x30 && byte <= 0x39) || byte == 0x2D
        }
    }

    var authorizeURL: URL { endpoint("/v1/native/session/authorize") }
    var exchangeURL: URL { endpoint("/v1/native/session/exchange") }
    var sessionURL: URL { endpoint("/v1/native/session") }
    var logoutURL: URL { endpoint("/v1/native/session/logout") }

    private func endpoint(_ path: String) -> URL {
        var components = URLComponents()
        components.scheme = origin.scheme
        components.host = origin.host
        components.port = origin.explicitPort
        components.percentEncodedPath = origin.basePath + path
        return components.url ?? redirectURI
    }

    static func isASCIIAlphanumeric(_ byte: UInt8) -> Bool {
        (byte >= 0x30 && byte <= 0x39) || (byte >= 0x41 && byte <= 0x5A) || (byte >= 0x61 && byte <= 0x7A)
    }

    static func isClientIdByte(_ byte: UInt8) -> Bool {
        isUnreservedASCII(byte) || byte == 0x3A
    }

    static func isUnreservedASCII(_ byte: UInt8) -> Bool {
        isASCIIAlphanumeric(byte) || byte == 0x2D || byte == 0x2E || byte == 0x5F
    }
}

/// The browser request the adapter presents. `url` is the authorize GET.
public struct NativeAuthorizationRequest: Sendable, Equatable {
    public let url: URL
    public let redirectURI: URL
}

public enum NativeBrowserResult: Sendable, Equatable {
    case callback(URL)
    case canceled
    case failed
}

/// Presents the owner authorize URL in an external browser and returns the raw callback.
/// Implementations start a browser only inside `present`.
@MainActor
public protocol NativeBrowserPresenting: Sendable {
    func present(_ request: NativeAuthorizationRequest) async -> NativeBrowserResult
    /// Stops any browser presentation this adapter started. Safe when nothing is showing.
    func cancel()
}

public struct NativeLogoutReport: Sendable, Equatable {
    /// Local state was cleared. This is always true after `signOut()`.
    public let localCleared: Bool
    /// True only when the owner answered 200 to this session's logout.
    public let ownerConfirmed: Bool
}

/// Supplies PKCE verifier and state bytes. Tests inject a fixed source.
public protocol NativeIdentityRandomness: Sendable {
    func bytes(count: Int) throws -> Data
}

public struct SystemNativeIdentityRandomness: NativeIdentityRandomness {
    public init() {}

    public func bytes(count: Int) throws -> Data {
        var data = Data(count: count)
        let status = data.withUnsafeMutableBytes { buffer -> Int32 in
            guard let base = buffer.baseAddress else { return errSecParam }
            return SecRandomCopyBytes(kSecRandomDefault, count, base)
        }
        guard status == errSecSuccess else { throw NativeIdentityError.randomnessUnavailable }
        return data
    }
}

enum NativePKCE {
    static let secretByteCount = 32

    static func challenge(verifier: String) -> String {
        base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
    }

    static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

struct NativeHeldSession: Sendable, Equatable, CustomStringConvertible, CustomDebugStringConvertible {
    var token: String
    var founderId: String
    var tenantId: String
    var clientId: String
    var expiresAt: Date

    var description: String { "NativeHeldSession(redacted)" }
    var debugDescription: String { description }
}

/// The owner contract caps a native session at 15 minutes, measured from grant.
let nativeSessionMaxLifetime: TimeInterval = 15 * 60

/// How far a client clock may sit behind the owner before a still-valid
/// 15 minute token is refused. A reply that arrives late, read on a clock
/// even a fraction of a second behind grant time, otherwise looks longer
/// than the contract lifetime. 120 seconds is the bound used by the fabric
/// and knowledge readers. Anything past it is treated as a bad lifetime.
let nativeSessionClockSkew: TimeInterval = 120

struct NativeTransaction: Sendable, Equatable {
    let generation: UInt64
    let state: String
    let verifier: String
    let redirectURI: URL
}

/// Browser sign-in, code exchange and session inspection against one pinned owner.
/// Conforms to `SessionProvider` (what the app may claim) and `RequestAuthorizer`
/// (the bearer for owner reads). One transaction stays outstanding from browser
/// start until exchange and inspection finish, fail or are superseded.
public actor NativeIdentityController: SessionProvider, RequestAuthorizer, CustomStringConvertible {
    private let configuration: NativeIdentityConfiguration?
    private let transport: (any HTTPTransport)?
    private let browser: (any NativeBrowserPresenting)?
    private let clock: any CoreClock
    private let randomness: any NativeIdentityRandomness

    private var held: NativeHeldSession?
    private var outstanding: NativeTransaction?
    /// Bumped by every new transaction, every sign-out and every cancel. A
    /// completion that sees a different value is discarded and never clears a
    /// newer outstanding transaction.
    private var generation: UInt64 = 0

    public init(
        configuration: NativeIdentityConfiguration?,
        transport: (any HTTPTransport)?,
        browser: (any NativeBrowserPresenting)?,
        clock: any CoreClock = SystemCoreClock(),
        randomness: any NativeIdentityRandomness = SystemNativeIdentityRandomness()
    ) {
        self.configuration = configuration
        self.transport = transport
        self.browser = browser
        self.clock = clock
        self.randomness = randomness
    }

    /// Explicit owner configuration, transport and browser are all required.
    /// Missing any of them yields an unconfigured controller. There is no shared default bearer.
    public static func make(
        configuration: NativeIdentityConfiguration?,
        transport: (any HTTPTransport)?,
        browser: (any NativeBrowserPresenting)?,
        clock: any CoreClock = SystemCoreClock(),
        randomness: any NativeIdentityRandomness = SystemNativeIdentityRandomness()
    ) -> NativeIdentityController {
        NativeIdentityController(
            configuration: configuration,
            transport: transport,
            browser: browser,
            clock: clock,
            randomness: randomness
        )
    }

    public func currentSession() async -> NativeSession {
        guard let held else { return .unconfigured }
        guard held.expiresAt > clock.now() else {
            self.held = nil
            return .unconfigured
        }
        return .verified(founderId: held.founderId, tenantId: held.tenantId, expiresAt: held.expiresAt)
    }

    public func headers() async throws -> [String: String] {
        try await authorizationHeaders(admitted: true)
    }

    /// Bearer for one request. The token is returned only when `url` is on the
    /// configured owner origin, including its path prefix. Any other destination
    /// throws before a header map exists, so the bearer cannot be attached.
    public func headers(for url: URL) async throws -> [String: String] {
        guard let configuration else { return [:] }
        guard configuration.origin.admits(url) else { throw NativeIdentityError.exchangeRefused }
        return try await authorizationHeaders(admitted: true)
    }

    private func authorizationHeaders(admitted: Bool) -> [String: String] {
        guard admitted, let held else { return [:] }
        guard held.expiresAt > clock.now() else {
            self.held = nil
            return [:]
        }
        return ["authorization": "Bearer \(held.token)"]
    }

    /// Runs one browser sign-in. A second call while one is outstanding is refused
    /// and does not disturb the first. The browser is started only by this call.
    public func signIn() async throws -> NativeSession {
        guard let configuration, let transport, let browser else { throw NativeIdentityError.unconfigured }
        guard outstanding == nil else { throw NativeIdentityError.signInInProgress }

        let transaction = try beginTransaction(configuration)
        let inspected: NativeHeldSession
        do {
            inspected = try await complete(
                transaction,
                configuration: configuration,
                transport: transport,
                browser: browser
            )
        } catch {
            clearIfCurrent(transaction)
            throw error
        }
        do {
            try ensureCurrent(transaction)
            guard inspected.expiresAt > clock.now() else { throw NativeIdentityError.expired }
        } catch {
            // The exchange already consumed the code. Drop this transaction
            // before the logout await so a newer sign-in is not cleared, then
            // revoke the token that will not be published.
            clearIfCurrent(transaction)
            await Self.logout(token: inspected.token, configuration: configuration, transport: transport)
            throw error
        }
        // No await between the checks above and this publish.
        clearIfCurrent(transaction)
        held = inspected
        return .verified(founderId: inspected.founderId, tenantId: inspected.tenantId, expiresAt: inspected.expiresAt)
    }

    /// Stops the browser and drops the outstanding transaction without starting
    /// another authorization. A session already held stays in place.
    public func cancelSignIn() async {
        generation &+= 1
        outstanding = nil
        await browser?.cancel()
    }

    /// Clears the local session and invalidates pending work before any await.
    /// Then makes a best-effort owner logout and reports its result separately.
    public func signOut() async -> NativeLogoutReport {
        let previous = held
        generation &+= 1
        outstanding = nil
        held = nil
        await browser?.cancel()
        guard let previous, let configuration, let transport else {
            return NativeLogoutReport(localCleared: true, ownerConfirmed: false)
        }
        let confirmed = await Self.logout(token: previous.token, configuration: configuration, transport: transport)
        return NativeLogoutReport(localCleared: true, ownerConfirmed: confirmed)
    }

    public nonisolated var description: String { "NativeIdentityController(redacted)" }

    // MARK: - Transaction

    private func complete(
        _ transaction: NativeTransaction,
        configuration: NativeIdentityConfiguration,
        transport: any HTTPTransport,
        browser: any NativeBrowserPresenting
    ) async throws -> NativeHeldSession {
        let request = try authorizationRequest(for: transaction, configuration: configuration)
        let result = await browser.present(request)
        try ensureCurrent(transaction)

        let callbackURL: URL
        switch result {
        case .canceled: throw NativeIdentityError.canceled
        case .failed: throw NativeIdentityError.invalidCallback
        case .callback(let url): callbackURL = url
        }
        let code = try Self.acceptCallback(callbackURL, transaction: transaction)

        let candidate = try await Self.exchange(
            code: code,
            verifier: transaction.verifier,
            configuration: configuration,
            transport: transport,
            clock: clock
        )
        do {
            try ensureCurrent(transaction)
            try Self.requireTenantCandidate(candidate.tenantId, configuration: configuration)

            let inspected = try await Self.inspect(
                candidate: candidate,
                configuration: configuration,
                transport: transport,
                clock: clock
            )
            try ensureCurrent(transaction)
            try Self.requireTenantCandidate(inspected.tenantId, configuration: configuration)
            // Expiry is checked against the clock after every await, not the clock read before them.
            guard inspected.expiresAt > clock.now() else { throw NativeIdentityError.expired }
            return inspected
        } catch {
            // Inspection or a post-await check refused a token the owner already
            // issued. Revoke that exact token. Logout does not touch transaction
            // state, and a logout failure must not hide the original refusal.
            await Self.logout(token: candidate.token, configuration: configuration, transport: transport)
            throw error
        }
    }

    private func beginTransaction(_ configuration: NativeIdentityConfiguration) throws -> NativeTransaction {
        let verifier = try randomURLSafeString()
        let state = try randomURLSafeString()
        guard verifier.count == 43, (22...128).contains(state.count) else {
            throw NativeIdentityError.invalidConfiguration
        }
        generation &+= 1
        let transaction = NativeTransaction(
            generation: generation,
            state: state,
            verifier: verifier,
            redirectURI: configuration.redirectURI
        )
        outstanding = transaction
        return transaction
    }

    /// Randomness sources may throw arbitrary errors. Map every failure to the fixed identity error.
    private func randomURLSafeString() throws -> String {
        do {
            return NativePKCE.base64URL(try randomness.bytes(count: NativePKCE.secretByteCount))
        } catch {
            throw NativeIdentityError.randomnessUnavailable
        }
    }

    private func ensureCurrent(_ transaction: NativeTransaction) throws {
        guard generation == transaction.generation, outstanding == transaction else {
            throw NativeIdentityError.transactionSuperseded
        }
    }

    /// Clears the outstanding slot only when it still belongs to this transaction.
    private func clearIfCurrent(_ transaction: NativeTransaction) {
        guard outstanding?.generation == transaction.generation else { return }
        outstanding = nil
    }

    private func authorizationRequest(
        for transaction: NativeTransaction,
        configuration: NativeIdentityConfiguration
    ) throws -> NativeAuthorizationRequest {
        var components = URLComponents(url: configuration.authorizeURL, resolvingAgainstBaseURL: false) ?? URLComponents()
        var items = [
            URLQueryItem(name: "client_id", value: configuration.clientId),
            URLQueryItem(name: "redirect_uri", value: configuration.redirectURI.absoluteString),
            URLQueryItem(name: "code_challenge", value: NativePKCE.challenge(verifier: transaction.verifier)),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: transaction.state)
        ]
        if let tenant = configuration.tenantCandidate {
            items.append(URLQueryItem(name: "tenant", value: tenant))
        }
        components.queryItems = items
        guard let url = components.url, configuration.origin.admits(url) else {
            throw NativeIdentityError.invalidConfiguration
        }
        return NativeAuthorizationRequest(url: url, redirectURI: configuration.redirectURI)
    }

    static func requireTenantCandidate(_ tenantId: String, configuration: NativeIdentityConfiguration) throws {
        if let expected = configuration.tenantCandidate, tenantId != expected {
            throw NativeIdentityError.scopeMismatch
        }
    }

    // MARK: - Callback

    /// Accepts only the exact reviewed callback: the same scheme, host and path
    /// as the registered URI, no userinfo, port or fragment, exactly the `code`
    /// and `state` keys, a `state` equal to this transaction's, and a `code`
    /// in the owner `cnc1_` form. Runs before any exchange.
    static func acceptCallback(_ url: URL, transaction: NativeTransaction) throws -> String {
        let raw = url.absoluteString
        let expected = transaction.redirectURI.absoluteString
        guard let queryStart = raw.firstIndex(of: "?") else { throw NativeIdentityError.invalidCallback }
        let base = String(raw[..<queryStart])
        let query = String(raw[raw.index(after: queryStart)...])
        guard base == expected, !query.contains("#"), !base.contains("@") else {
            throw NativeIdentityError.invalidCallback
        }
        let pairs = query.split(separator: "&", omittingEmptySubsequences: false).map(String.init)
        guard pairs.count == 2 else { throw NativeIdentityError.invalidCallback }
        var values: [String: String] = [:]
        for pair in pairs {
            let parts = pair.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false).map(String.init)
            guard parts.count == 2, values[parts[0]] == nil,
                  let value = parts[1].removingPercentEncoding else {
                throw NativeIdentityError.invalidCallback
            }
            values[parts[0]] = value
        }
        guard Set(values.keys) == ["code", "state"] else { throw NativeIdentityError.invalidCallback }
        guard values["state"] == transaction.state else { throw NativeIdentityError.stateMismatch }
        guard let code = values["code"], isAuthorizationCode(code) else { throw NativeIdentityError.invalidCallback }
        return code
    }

    // MARK: - Owner calls

    /// POST exchange. The body carries no cookies and no Access assertion.
    /// Any failure after sending is treated as a lost exchange with no replay.
    static func exchange(
        code: String,
        verifier: String,
        configuration: NativeIdentityConfiguration,
        transport: any HTTPTransport,
        clock: any CoreClock
    ) async throws -> NativeHeldSession {
        let body: [String: Any] = [
            "contractVersion": nativeSessionContractVersion,
            "clientId": configuration.clientId,
            "code": code,
            "codeVerifier": verifier,
            "redirectUri": configuration.redirectURI.absoluteString
        ]
        let payload: Data
        do {
            payload = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        } catch {
            throw NativeIdentityError.invalidConfiguration
        }
        guard payload.count <= 2048 else { throw NativeIdentityError.invalidConfiguration }
        let response: HTTPResponse
        do {
            response = try await transport.send(HTTPRequest(
                method: "POST",
                url: configuration.exchangeURL,
                headers: ["content-type": "application/json", "accept": "application/json"],
                body: payload
            ))
        } catch {
            throw NativeIdentityError.exchangeLost
        }
        guard response.status == 200 else { throw NativeIdentityError.exchangeRefused }
        return try parseSession(response.body, configuration: configuration, requireToken: true, now: clock.now())
    }

    /// GET the session with the candidate bearer. The owner's answer must match
    /// the exchanged client, founder, tenant and expiry.
    static func inspect(
        candidate: NativeHeldSession,
        configuration: NativeIdentityConfiguration,
        transport: any HTTPTransport,
        clock: any CoreClock
    ) async throws -> NativeHeldSession {
        let response: HTTPResponse
        do {
            response = try await transport.send(HTTPRequest(
                method: "GET",
                url: configuration.sessionURL,
                headers: ["accept": "application/json", "authorization": "Bearer \(candidate.token)"]
            ))
        } catch let failure as TransportFailure {
            throw NativeIdentityError.transport(failure)
        } catch {
            throw NativeIdentityError.inspectionFailed
        }
        guard response.status == 200 else { throw NativeIdentityError.inspectionFailed }
        let inspected = try parseSession(response.body, configuration: configuration, requireToken: false, now: clock.now())
        guard inspected.clientId == candidate.clientId,
              inspected.founderId == candidate.founderId,
              inspected.tenantId == candidate.tenantId,
              inspected.expiresAt == candidate.expiresAt else {
            throw NativeIdentityError.scopeMismatch
        }
        return NativeHeldSession(
            token: candidate.token,
            founderId: inspected.founderId,
            tenantId: inspected.tenantId,
            clientId: inspected.clientId,
            expiresAt: inspected.expiresAt
        )
    }

    static func logout(token: String, configuration: NativeIdentityConfiguration, transport: any HTTPTransport) async -> Bool {
        do {
            let response = try await transport.send(HTTPRequest(
                method: "POST",
                url: configuration.logoutURL,
                headers: [
                    "content-type": "application/json",
                    "accept": "application/json",
                    "authorization": "Bearer \(token)"
                ],
                body: Data("{}".utf8)
            ))
            return response.status == 200
        } catch {
            return false
        }
    }

    /// Strict parse of the owner body. Exchange carries `token`; inspection must not.
    /// `now` is read after the response arrives. Expiry must still be in the future.
    /// The owner lifetime is 15 minutes from grant; a client clock behind the owner,
    /// or a reply that arrives late, may observe up to `nativeSessionClockSkew`
    /// beyond that. A larger gap is a malformed lifetime, not a usable session.
    static func parseSession(
        _ data: Data,
        configuration: NativeIdentityConfiguration,
        requireToken: Bool,
        now: Date
    ) throws -> NativeHeldSession {
        guard data.count <= HTTPLimits.maxResponseBytes,
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NativeIdentityError.malformedResponse
        }
        guard object["contractVersion"] as? String == nativeSessionContractVersion else {
            throw NativeIdentityError.malformedResponse
        }
        guard object["clientId"] as? String == configuration.clientId else { throw NativeIdentityError.scopeMismatch }
        guard object["role"] as? String == "founder", object["enrolled"] as? Bool == true else {
            throw NativeIdentityError.scopeMismatch
        }
        guard let founderId = object["founderId"] as? String, isFounderID(founderId),
              let tenantId = object["tenantId"] as? String, NativeIdentityConfiguration.isNativeTenant(tenantId),
              let expiresAt = parseExpiry(object["expiresAt"]) else {
            throw NativeIdentityError.malformedResponse
        }
        guard expiresAt > now else { throw NativeIdentityError.expired }
        guard expiresAt.timeIntervalSince(now) <= nativeSessionMaxLifetime + nativeSessionClockSkew else {
            throw NativeIdentityError.malformedResponse
        }
        let token: String
        if requireToken {
            guard object["tokenType"] as? String == "Bearer",
                  let value = object["token"] as? String,
                  isSessionToken(value) else {
                throw NativeIdentityError.malformedResponse
            }
            token = value
        } else {
            guard object["token"] == nil else { throw NativeIdentityError.malformedResponse }
            token = ""
        }
        return NativeHeldSession(
            token: token,
            founderId: founderId,
            tenantId: tenantId,
            clientId: configuration.clientId,
            expiresAt: expiresAt
        )
    }

    /// Server `FOUNDER`: an alphanumeric start, then up to 239 of `A-Za-z0-9._:@/-`.
    static func isFounderID(_ value: String) -> Bool {
        guard let first = value.utf8.first, NativeIdentityConfiguration.isASCIIAlphanumeric(first) else { return false }
        let rest = value.utf8.dropFirst()
        guard rest.count <= 239 else { return false }
        return rest.allSatisfy { byte in
            NativeIdentityConfiguration.isUnreservedASCII(byte) || byte == 0x3A || byte == 0x40 || byte == 0x2F
        }
    }

    /// Authorization code: `cnc1_` plus 43 base64url characters.
    static func isAuthorizationCode(_ value: String) -> Bool {
        isPrefixedCredential(value, prefix: "cnc1_")
    }

    /// Session token: `cns1_` plus 43 base64url characters.
    static func isSessionToken(_ value: String) -> Bool {
        isPrefixedCredential(value, prefix: "cns1_")
    }

    private static func isPrefixedCredential(_ value: String, prefix: String) -> Bool {
        guard value.hasPrefix(prefix) else { return false }
        let body = value.dropFirst(prefix.count)
        guard body.utf8.count == 43 else { return false }
        return body.utf8.allSatisfy { byte in
            NativeIdentityConfiguration.isASCIIAlphanumeric(byte) || byte == 0x2D || byte == 0x5F
        }
    }

    /// Owner canonical expiry: `YYYY-MM-DDTHH:mm:ss.SSSZ`. Text must round-trip
    /// exactly through the formatter, so impossible dates and other offsets fail.
    static func parseExpiry(_ value: Any?) -> Date? {
        guard let text = value as? String, text.utf8.count == 24 else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        guard let date = formatter.date(from: text), formatter.string(from: date) == text else { return nil }
        return date
    }
}
