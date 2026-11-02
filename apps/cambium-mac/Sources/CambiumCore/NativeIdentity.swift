import CryptoKit
import Foundation
import Security

// Founder sign-in through the owner-hosted native session contract
// (cambium.native-session.v1, see .planning/native-mac/NATIVE-SESSION-CONTRACT.md).
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
    public let origin: HTTPOriginPolicy
    public let clientId: String
    public let redirectURI: URL
    /// Optional tenant candidate. The owner still selects from current enrollment.
    public let tenantCandidate: String?

    public init(owner: URL, clientId: String, redirectURI: URL, tenantCandidate: String? = nil) throws {
        let origin: HTTPOriginPolicy
        do { origin = try HTTPOriginPolicy(url: owner) } catch { throw NativeIdentityError.invalidConfiguration }
        guard origin.scheme == "https" else { throw NativeIdentityError.invalidConfiguration }
        guard Self.isReviewedClientId(clientId) else { throw NativeIdentityError.invalidConfiguration }
        guard Self.isExactCallback(redirectURI) else { throw NativeIdentityError.invalidConfiguration }
        if let tenantCandidate, !MissionFabricTenant.isValid(tenantCandidate) {
            throw NativeIdentityError.invalidConfiguration
        }
        self.origin = origin
        self.clientId = clientId
        self.redirectURI = redirectURI
        self.tenantCandidate = tenantCandidate
    }

    public static func isReviewedClientId(_ value: String) -> Bool {
        (8...128).contains(value.count) && value.utf8.allSatisfy(isUnreservedASCII)
    }

    /// Scheme, host and a non-root path only. No user, query, fragment or port.
    public static func isExactCallback(_ url: URL) -> Bool {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let scheme = components.scheme?.lowercased(), !scheme.isEmpty,
              scheme != "http", scheme != "https",
              let host = components.host, !host.isEmpty,
              components.user == nil, components.password == nil,
              components.query == nil, components.fragment == nil,
              components.port == nil else {
            return false
        }
        let path = components.percentEncodedPath
        return !path.isEmpty && path != "/"
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

    static func isUnreservedASCII(_ byte: UInt8) -> Bool {
        (byte >= 0x30 && byte <= 0x39) || (byte >= 0x41 && byte <= 0x5A) ||
            (byte >= 0x61 && byte <= 0x7A) || byte == 0x2D || byte == 0x2E || byte == 0x5F
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
@MainActor
public protocol NativeBrowserPresenting: Sendable {
    func present(_ request: NativeAuthorizationRequest) async -> NativeBrowserResult
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

/// The owner contract caps a native session at 15 minutes.
let nativeSessionMaxLifetime: TimeInterval = 15 * 60

struct NativeTransaction: Sendable, Equatable {
    let generation: UInt64
    let state: String
    let verifier: String
    let redirectURI: URL
}

/// Browser sign-in, code exchange and session inspection against one pinned owner.
/// Conforms to `SessionProvider` (what the app may claim) and `RequestAuthorizer`
/// (the bearer for owner reads). It holds one outstanding transaction at a time.
public actor NativeIdentityController: SessionProvider, RequestAuthorizer, CustomStringConvertible {
    private let configuration: NativeIdentityConfiguration?
    private let transport: (any HTTPTransport)?
    private let browser: (any NativeBrowserPresenting)?
    private let clock: any CoreClock
    private let randomness: any NativeIdentityRandomness

    private var held: NativeHeldSession?
    private var outstanding: NativeTransaction?
    /// Bumped by every new transaction and every sign-out. A pending completion
    /// that sees a different value is discarded.
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
        guard let held else { return [:] }
        guard held.expiresAt > clock.now() else {
            self.held = nil
            return [:]
        }
        return ["authorization": "Bearer \(held.token)"]
    }

    /// Runs one browser sign-in. A second call while one is outstanding is refused.
    public func signIn() async throws -> NativeSession {
        guard let configuration, let transport, let browser else { throw NativeIdentityError.unconfigured }
        guard outstanding == nil else { throw NativeIdentityError.signInInProgress }

        let transaction = try beginTransaction(configuration)
        let request = try authorizationRequest(for: transaction, configuration: configuration)

        let result = await browser.present(request)
        guard generation == transaction.generation else { throw NativeIdentityError.transactionSuperseded }
        outstanding = nil

        switch result {
        case .canceled:
            throw NativeIdentityError.canceled
        case .failed:
            throw NativeIdentityError.invalidCallback
        case .callback(let callbackURL):
            let code = try Self.acceptCallback(callbackURL, transaction: transaction)
            let candidate = try await Self.exchange(
                code: code,
                verifier: transaction.verifier,
                configuration: configuration,
                transport: transport,
                now: clock.now()
            )
            guard generation == transaction.generation else { throw NativeIdentityError.transactionSuperseded }
            let inspected = try await Self.inspect(
                candidate: candidate,
                configuration: configuration,
                transport: transport,
                now: clock.now()
            )
            guard generation == transaction.generation else { throw NativeIdentityError.transactionSuperseded }
            held = inspected
            return .verified(founderId: inspected.founderId, tenantId: inspected.tenantId, expiresAt: inspected.expiresAt)
        }
    }

    /// Clears the local session and invalidates pending work first. Then makes a
    /// best-effort owner logout and reports its result separately.
    public func signOut() async -> NativeLogoutReport {
        let previous = held
        generation &+= 1
        outstanding = nil
        held = nil
        guard let previous, let configuration, let transport else {
            return NativeLogoutReport(localCleared: true, ownerConfirmed: false)
        }
        let confirmed = await Self.logout(token: previous.token, configuration: configuration, transport: transport)
        return NativeLogoutReport(localCleared: true, ownerConfirmed: confirmed)
    }

    public nonisolated var description: String { "NativeIdentityController(redacted)" }

    // MARK: - Transaction

    private func beginTransaction(_ configuration: NativeIdentityConfiguration) throws -> NativeTransaction {
        let verifier = NativePKCE.base64URL(try randomness.bytes(count: NativePKCE.secretByteCount))
        let state = NativePKCE.base64URL(try randomness.bytes(count: NativePKCE.secretByteCount))
        guard (43...128).contains(verifier.count), (22...128).contains(state.count) else {
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
            outstanding = nil
            throw NativeIdentityError.invalidConfiguration
        }
        return NativeAuthorizationRequest(url: url, redirectURI: configuration.redirectURI)
    }

    /// Accepts only the exact registered callback: scheme, host and path match,
    /// no credentials or fragment, exactly the `code` and `state` keys, and a
    /// `state` equal to the outstanding transaction. Runs before any exchange.
    static func acceptCallback(_ url: URL, transaction: NativeTransaction) throws -> String {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let expected = URLComponents(url: transaction.redirectURI, resolvingAgainstBaseURL: false) else {
            throw NativeIdentityError.invalidCallback
        }
        guard components.scheme?.lowercased() == expected.scheme?.lowercased(),
              components.host?.lowercased() == expected.host?.lowercased(),
              components.percentEncodedPath == expected.percentEncodedPath,
              components.user == nil, components.password == nil,
              components.port == nil, components.fragment == nil else {
            throw NativeIdentityError.invalidCallback
        }
        let items = components.queryItems ?? []
        guard items.count == 2, Set(items.map(\.name)) == ["code", "state"] else {
            throw NativeIdentityError.invalidCallback
        }
        guard let state = items.first(where: { $0.name == "state" })?.value,
              state == transaction.state else {
            throw NativeIdentityError.stateMismatch
        }
        guard let code = items.first(where: { $0.name == "code" })?.value,
              (43...256).contains(code.utf8.count),
              code.utf8.allSatisfy(NativeIdentityConfiguration.isUnreservedASCII) else {
            throw NativeIdentityError.invalidCallback
        }
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
        now: Date
    ) async throws -> NativeHeldSession {
        let body: [String: Any] = [
            "contractVersion": nativeSessionContractVersion,
            "clientId": configuration.clientId,
            "code": code,
            "codeVerifier": verifier,
            "redirectUri": configuration.redirectURI.absoluteString
        ]
        let payload = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
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
        return try parseSession(response.body, configuration: configuration, requireToken: true, now: now)
    }

    /// GET the session with the candidate bearer. The owner's answer must
    /// match the exchanged client, founder, tenant, expiry, role and enrollment.
    static func inspect(
        candidate: NativeHeldSession,
        configuration: NativeIdentityConfiguration,
        transport: any HTTPTransport,
        now: Date
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
        }
        guard response.status == 200 else { throw NativeIdentityError.inspectionFailed }
        let inspected = try parseSession(response.body, configuration: configuration, requireToken: false, now: now)
        guard inspected.clientId == candidate.clientId,
              inspected.founderId == candidate.founderId,
              inspected.tenantId == candidate.tenantId,
              inspected.expiresAt == candidate.expiresAt else {
            throw NativeIdentityError.scopeMismatch
        }
        guard inspected.expiresAt > now else { throw NativeIdentityError.expired }
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
        guard let founderId = object["founderId"] as? String, isOpaqueID(founderId),
              let tenantId = object["tenantId"] as? String, MissionFabricTenant.isValid(tenantId),
              let expiresAt = parseExpiry(object["expiresAt"]) else {
            throw NativeIdentityError.malformedResponse
        }
        guard expiresAt > now else { throw NativeIdentityError.expired }
        guard expiresAt.timeIntervalSince(now) <= nativeSessionMaxLifetime else {
            throw NativeIdentityError.malformedResponse
        }
        let token: String
        if requireToken {
            guard object["tokenType"] as? String == "Bearer",
                  let value = object["token"] as? String,
                  isOpaqueCredential(value) else {
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

    static func isOpaqueID(_ value: String) -> Bool {
        (8...128).contains(value.utf8.count) && value.utf8.allSatisfy(NativeIdentityConfiguration.isUnreservedASCII)
    }

    /// Opaque credential: 43 to 128 unreserved characters. A later owner prefix
    /// can tighten this in one place.
    static func isOpaqueCredential(_ value: String) -> Bool {
        (43...128).contains(value.utf8.count) && value.utf8.allSatisfy(NativeIdentityConfiguration.isUnreservedASCII)
    }

    /// Accepts only canonical `YYYY-MM-DDTHH:MM:SSZ`. Fractional seconds and offsets are refused.
    static func parseExpiry(_ value: Any?) -> Date? {
        guard let text = value as? String, text.utf8.count == 20 else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter.date(from: text)
    }
}
