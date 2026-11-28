import XCTest
@testable import CambiumCore

private struct SignalSession: SessionProvider {
    func currentSession() async -> NativeSession { .verified(founderId: "founder", tenantId: "cambium", expiresAt: .distantFuture) }
}
private struct SignalAuth: RequestAuthorizer { func headers() async throws -> [String: String] { ["authorization": "Bearer test"] } }
private actor SignalTransport: HTTPTransport {
    let response: Data
    var requests: [HTTPRequest] = []
    init(_ text: String) { response = Data(text.utf8) }
    func send(_ request: HTTPRequest) async throws -> HTTPResponse { requests.append(request); return HTTPResponse(status: 200, body: response) }
    func captured() -> [HTTPRequest] { requests }
}
private actor SwitchableSignalSession: SessionProvider {
    var session: NativeSession = .verified(founderId: "founder", tenantId: "cambium", expiresAt: .distantFuture)
    func currentSession() async -> NativeSession { session }
    func signOut() { session = .unconfigured }
}
private actor WaitingSignalTransport: HTTPTransport {
    var continuation: CheckedContinuation<HTTPResponse, Never>?
    func send(_ request: HTTPRequest) async throws -> HTTPResponse { await withCheckedContinuation { continuation = $0 } }
    func waiting() -> Bool { continuation != nil }
    func finish() { continuation?.resume(returning: HTTPResponse(status: 200, body: Data(#"{"schema":"cambium.signal-list.v1","tenantId":"cambium","principal":"founder","signals":[],"nextCursor":null}"#.utf8))); continuation = nil }
}
private final class SignalURLProtocol: URLProtocol, @unchecked Sendable {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
final class SignalsTests: XCTestCase {
    private func client(_ transport: SignalTransport) throws -> SignalHTTPClient {
        SignalHTTPClient(origin: try HTTPOriginPolicy(url: XCTUnwrap(URL(string: "https://owner.invalid"))), transport: transport, authorizer: SignalAuth(), sessionProvider: SignalSession())
    }
    private let signal = #"{"id":"abc","tenantId":"cambium","principal":"founder","title":"T","body":"B","source":{"system":"cambium-native","recordId":"source","version":"1","reference":null,"observedAt":"2026-11-03T00:00:00.000Z"},"projectIds":["sapling:cambium"],"revision":1,"createdAt":"2026-11-03T00:00:00.000Z","updatedAt":"2026-11-03T00:00:00.000Z"}"#
    func testPreflightRejectionIsDistinctFromInvalidSaveResponse() async throws {
        let transport = SignalTransport("{}"), instance = try client(transport)
        let source = SignalSource(system: "cambium-native", recordId: "source", version: "1", reference: nil, observedAt: "2026-11-03T00:00:00.000Z")
        let invalid = SignalCapture(operationId: "op", title: String(repeating: "x", count: 201), body: "", source: source, projectIds: [])
        do { _ = try await instance.capture(tenant: "cambium", value: invalid); XCTFail("Expected preflight rejection") }
        catch { XCTAssertEqual(error as? SignalError, .invalidRequest) }
        let before = await transport.captured(); XCTAssertTrue(before.isEmpty)
        let valid = SignalCapture(operationId: "corrected-op", title: "Corrected", body: "", source: source, projectIds: [])
        do { _ = try await instance.capture(tenant: "cambium", value: valid); XCTFail("Expected invalid response") }
        catch { XCTAssertEqual(error as? SignalError, .invalid) }
        let after = await transport.captured(); XCTAssertEqual(after.count, 1)
    }
    func testExactRetryAndNullProvenance() async throws {
        let transport = SignalTransport("{\"schema\":\"cambium.signal-result.v1\",\"tenantId\":\"cambium\",\"principal\":\"founder\",\"signal\":\(signal),\"replayed\":false}")
        let client = try client(transport)
        let value = SignalCapture(operationId: "operation", title: "T", body: "B", source: SignalSource(system: "cambium-native", recordId: "source", version: "1", reference: nil, observedAt: "2026-11-03T00:00:00.000Z"), projectIds: ["sapling:cambium"])
        _ = try await client.capture(tenant: "cambium", value: value); _ = try await client.capture(tenant: "cambium", value: value)
        let requests = await transport.captured()
        XCTAssertEqual(requests.count, 2); XCTAssertEqual(requests[0].body, requests[1].body)
        let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: XCTUnwrap(requests[0].body)) as? [String: Any])
        XCTAssertTrue((object["source"] as? [String: Any])?["reference"] is NSNull)
    }
    func testCrossScopeAndUnexpectedFieldsRejected() async throws {
        for row in [signal.replacingOccurrences(of: "\"tenantId\":\"cambium\"", with: "\"tenantId\":\"other\""), signal.replacingOccurrences(of: "\"revision\":1", with: "\"revision\":1,\"unexpected\":true")] {
            let transport = SignalTransport("{\"schema\":\"cambium.signal-list.v1\",\"tenantId\":\"cambium\",\"principal\":\"founder\",\"signals\":[\(row)],\"nextCursor\":null}")
            do { _ = try await client(transport).list(tenant: "cambium"); XCTFail("Expected rejection") } catch { }
        }
    }
    func testFilteredListRejectsUnassociatedRow() async throws {
        let transport = SignalTransport("{\"schema\":\"cambium.signal-list.v1\",\"tenantId\":\"cambium\",\"principal\":\"founder\",\"signals\":[\(signal)],\"nextCursor\":null}")
        do { _ = try await client(transport).list(tenant: "cambium", projectId: "sapling:other"); XCTFail("Expected rejection") } catch { }
    }
    func testInvalidCanonicalDateRejected() async throws {
        let transport = SignalTransport("{}")
        let value = SignalCapture(operationId: "operation", title: "T", body: "B", source: SignalSource(system: "cambium-native", recordId: "source", version: "1", reference: nil, observedAt: "2026-02-30T00:00:00.000Z"), projectIds: [])
        do { _ = try await client(transport).capture(tenant: "cambium", value: value); XCTFail("Expected rejection") } catch { }
        let requests = await transport.captured(); XCTAssertTrue(requests.isEmpty)
    }
    func testSignoutDuringReadDiscardsResponse() async throws {
        let session = SwitchableSignalSession(), transport = WaitingSignalTransport()
        let instance = SignalHTTPClient(origin: try HTTPOriginPolicy(url: XCTUnwrap(URL(string: "https://owner.invalid"))), transport: transport, authorizer: SignalAuth(), sessionProvider: session)
        let task = Task { try await instance.list(tenant: "cambium") }
        while !(await transport.waiting()) { await Task.yield() }
        await session.signOut(); await transport.finish()
        do { _ = try await task.value; XCTFail("Old session response must be refused") } catch { }
    }
    func testTransportRequestCapsRemainRouteScoped() async throws {
        let origin = try HTTPOriginPolicy(url: XCTUnwrap(URL(string: "https://owner.invalid")))
        let configuration = URLSessionConfiguration.ephemeral; configuration.protocolClasses = [SignalURLProtocol.self]
        let transport = try URLSessionHTTPTransport(origin: origin, configuration: configuration)
        let medium = Data(repeating: 65, count: 8193)
        let signal = HTTPRequest(method: "POST", url: URL(string: "https://owner.invalid/v1/signals/cambium")!, body: medium)
        let accepted = try await transport.send(signal)
        XCTAssertEqual(accepted.status, 200)
        for route in ["/v1/directions/cambium", "/v1/signals/cambium"] {
            let url = URL(string: "https://owner.invalid" + route)!
            let saved = try await transport.send(HTTPRequest(method: "POST", url: url, body: medium))
            XCTAssertEqual(saved.status, 200)
            let changed = try await transport.send(HTTPRequest(method: "PUT", url: URL(string: url.absoluteString + "/id")!, body: medium))
            XCTAssertEqual(changed.status, 200)
            do { _ = try await transport.send(HTTPRequest(method: "POST", url: url, body: Data(repeating: 65, count: 65537))); XCTFail("Expected bounded draft limit") } catch { }
        }
        for path in ["/v1/founder/decision", "/v1/native/launch", "/v1/signals/cambium/extra/path", "/v1/directions/cambium/extra/path", "/v1/directions/cambium?unexpected=x"] {
            do { _ = try await transport.send(HTTPRequest(method: "POST", url: URL(string: "https://owner.invalid" + path)!, body: medium)); XCTFail("Expected original limit") } catch { }
        }
        do { _ = try await transport.send(HTTPRequest(method: "POST", url: signal.url, body: Data(repeating: 65, count: 65537))); XCTFail("Expected signal limit") } catch { }
        for path in ["/v1/founder/decision", "/v1/signals/cambium", "/v1/signals/cambium/id?cursor=unexpected"] {
            do {
                _ = try await transport.send(HTTPRequest(method: "PUT", url: URL(string: "https://owner.invalid" + path)!, body: Data()))
                XCTFail("PUT is only supported on the exact signal update route")
            } catch { XCTAssertEqual(error as? TransportFailure, .malformedResponse) }
        }
        let update = try await transport.send(HTTPRequest(method: "PUT", url: URL(string: "https://owner.invalid/v1/signals/cambium/id")!, body: medium))
        XCTAssertEqual(update.status, 200)
    }
    func testReferenceRejectsQueryAndFragment() async throws {
        let transport = SignalTransport("{}")
        for ref in ["https://example.com/?token=x", "https://example.com/#secret"] {
            let value = SignalCapture(operationId: "op", title: "T", body: "B", source: SignalSource(system: "field-report", recordId: "source", version: "1", reference: ref, observedAt: "2026-11-03T00:00:00.000Z"), projectIds: [])
            do { _ = try await client(transport).capture(tenant: "cambium", value: value); XCTFail("Expected reference rejection") } catch { }
        }
        let requests = await transport.captured(); XCTAssertTrue(requests.isEmpty)
    }
}
