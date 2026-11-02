import Foundation

// Production `HTTPTransport` over URLSession. It holds no credentials: the
// owner's `RequestAuthorizer` supplies headers per request, and this transport
// refuses to send them anywhere except the one configured origin.

public enum HTTPOriginError: Error, Equatable, Sendable {
    case invalidURL
    case credentialsInURL
    case unsupportedScheme
    case insecureHost
}

/// One permitted origin plus an optional path prefix. HTTPS is required.
/// Plain HTTP is accepted only when the caller explicitly opts in AND the host
/// is a loopback address, for local development.
public struct HTTPOriginPolicy: Sendable, Equatable {
    public let scheme: String
    public let host: String
    public let explicitPort: Int?
    /// Percent-encoded path prefix without a trailing slash; empty for the root.
    public let basePath: String

    public init(url: URL, allowLoopbackHTTP: Bool = false) throws {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let rawScheme = components.scheme?.lowercased(),
              let rawHost = components.host?.lowercased(), !rawHost.isEmpty else {
            throw HTTPOriginError.invalidURL
        }
        guard components.user == nil, components.password == nil else { throw HTTPOriginError.credentialsInURL }
        switch rawScheme {
        case "https":
            break
        case "http":
            guard allowLoopbackHTTP else { throw HTTPOriginError.unsupportedScheme }
            guard Self.isLoopback(rawHost) else { throw HTTPOriginError.insecureHost }
        default:
            throw HTTPOriginError.unsupportedScheme
        }
        self.scheme = rawScheme
        self.host = rawHost
        self.explicitPort = components.port
        var path = components.percentEncodedPath
        while path.hasSuffix("/") { path.removeLast() }
        self.basePath = path
    }

    public static func isLoopback(_ host: String) -> Bool {
        let trimmed = host.trimmingCharacters(in: CharacterSet(charactersIn: "[]")).lowercased()
        return trimmed == "localhost" || trimmed == "127.0.0.1" || trimmed == "::1"
    }

    var effectivePort: Int { explicitPort ?? (scheme == "https" ? 443 : 80) }

    /// True when `url` is on this exact origin, carries no credentials and sits
    /// under the configured path prefix.
    public func admits(_ url: URL) -> Bool {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.user == nil, components.password == nil,
              components.scheme?.lowercased() == scheme,
              components.host?.lowercased() == host,
              (components.port ?? (scheme == "https" ? 443 : 80)) == effectivePort else {
            return false
        }
        if basePath.isEmpty { return true }
        let path = components.percentEncodedPath
        return path == basePath || path.hasPrefix(basePath + "/")
    }
}

/// Denies any redirect that leaves the configured origin or path scope. Runs
/// inside URLSession before the redirected request (and its headers) is sent.
final class OriginRedirectGuard: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    private let origin: HTTPOriginPolicy
    private let lock = NSLock()
    private var deniedRedirect = false

    init(origin: HTTPOriginPolicy) {
        self.origin = origin
    }

    var didDeny: Bool {
        lock.lock(); defer { lock.unlock() }
        return deniedRedirect
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping @Sendable (URLRequest?) -> Void
    ) {
        if let target = request.url, origin.admits(target) {
            completionHandler(request)
        } else {
            lock.lock(); deniedRedirect = true; lock.unlock()
            completionHandler(nil)
        }
    }
}

public final class URLSessionHTTPTransport: HTTPTransport {
    private let origin: HTTPOriginPolicy
    private let session: URLSession
    private let maxResponseBytes: Int
    private let maxRequestBytes: Int

    /// `configuration` is copied and hardened: no URL cache, cookies or stored
    /// credentials. Tests inject `protocolClasses` through it.
    public init(
        origin: HTTPOriginPolicy,
        configuration: URLSessionConfiguration = .ephemeral,
        timeout: TimeInterval = 15,
        maxResponseBytes: Int = HTTPLimits.maxResponseBytes,
        maxRequestBytes: Int = HTTPLimits.maxRequestBytes
    ) {
        let config = (configuration.copy() as? URLSessionConfiguration) ?? .ephemeral
        config.urlCache = nil
        config.httpCookieStorage = nil
        config.httpShouldSetCookies = false
        config.urlCredentialStorage = nil
        config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        config.waitsForConnectivity = false
        config.timeoutIntervalForRequest = timeout
        config.timeoutIntervalForResource = timeout
        self.origin = origin
        self.session = URLSession(configuration: config)
        self.maxResponseBytes = min(maxResponseBytes, HTTPLimits.maxResponseBytes)
        self.maxRequestBytes = min(maxRequestBytes, HTTPLimits.maxRequestBytes)
    }

    deinit { session.invalidateAndCancel() }

    public func send(_ request: HTTPRequest) async throws -> HTTPResponse {
        // Everything below runs before any header or body leaves the process.
        guard origin.admits(request.url) else { throw TransportFailure.unreachable }
        guard request.method == "GET" || request.method == "POST" else { throw TransportFailure.malformedResponse }
        if let body = request.body, body.count > maxRequestBytes { throw TransportFailure.malformedResponse }

        var urlRequest = URLRequest(url: request.url)
        urlRequest.httpMethod = request.method
        urlRequest.httpBody = request.body
        urlRequest.httpShouldHandleCookies = false
        for (name, value) in request.headers where name.lowercased() != "cookie" {
            urlRequest.setValue(value, forHTTPHeaderField: name)
        }

        let redirectGuard = OriginRedirectGuard(origin: origin)
        var collected = Data()
        let http: HTTPURLResponse
        do {
            let (bytes, response) = try await session.bytes(for: urlRequest, delegate: redirectGuard)
            guard let received = response as? HTTPURLResponse else { throw TransportFailure.malformedResponse }
            http = received
            if redirectGuard.didDeny || (300..<400).contains(http.statusCode) { throw TransportFailure.unreachable }
            if http.expectedContentLength > Int64(maxResponseBytes) { throw TransportFailure.responseTooLarge }
            for try await byte in bytes {
                collected.append(byte)
                if collected.count > maxResponseBytes { throw TransportFailure.responseTooLarge }
            }
        } catch let failure as TransportFailure {
            throw failure
        } catch let error as URLError where error.code == .timedOut {
            throw TransportFailure.timeout
        } catch {
            throw TransportFailure.unreachable
        }
        return HTTPResponse(status: http.statusCode, body: collected)
    }
}
