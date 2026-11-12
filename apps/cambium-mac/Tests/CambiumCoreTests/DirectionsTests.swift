import XCTest
@testable import CambiumCore

private struct DirectionSession: SessionProvider {
    func currentSession() async -> NativeSession { .verified(founderId: "founder", tenantId: "cambium", expiresAt: .distantFuture) }
}
private struct DirectionAuth: RequestAuthorizer {
    func headers() async throws -> [String: String] { ["authorization": "Bearer fixture"] }
}
private actor DirectionTransport: HTTPTransport {
    let response: HTTPResponse
    var requests: [HTTPRequest] = []
    init(_ object: [String: Any], status: Int = 200) throws { response = HTTPResponse(status: status, body: try JSONSerialization.data(withJSONObject: object)) }
    func send(_ request: HTTPRequest) async throws -> HTTPResponse { requests.append(request); return response }
    func captured() -> [HTTPRequest] { requests }
}
final class DirectionsTests: XCTestCase {
    private let work = DirectionWorkContext(workObjectId: "sapling:cambium", workNodeId: "goal_" + String(repeating: "a", count: 64), graphHeadDigest: String(repeating: "b", count: 64))
    private func client(_ transport: DirectionTransport) throws -> DirectionHTTPClient {
        DirectionHTTPClient(origin: try HTTPOriginPolicy(url: XCTUnwrap(URL(string: "https://owner.invalid/prefix"))), transport: transport, authorizer: DirectionAuth(), sessionProvider: DirectionSession())
    }
    private func record(principal: String = "founder", title: String = "Improve Inbox") -> [String: Any] {
        ["id": "direction-1", "tenantId": "cambium", "principal": principal, "title": title, "body": "A small next step.",
         "workObjectId": work.workObjectId, "workNodeId": work.workNodeId, "graphHeadDigest": work.graphHeadDigest,
         "signalPins": [["id": "signal-1", "revision": 3]], "revision": 1, "createdAt": "2026-11-04T00:00:00.000Z", "updatedAt": "2026-11-04T00:00:00.000Z"]
    }
    func testReadsCanonicalWorkContextFromOwnerAndKeepsBasePath() async throws {
        let transport = try DirectionTransport(["schema": "cambium.direction-list.v1", "tenantId": "cambium", "principal": "founder", "directions": [record()],
            "workContext": ["workObjectId": work.workObjectId, "workNodeId": work.workNodeId, "graphHeadDigest": work.graphHeadDigest]])
        let result = try await client(transport).list(tenant: "cambium")
        XCTAssertEqual(result.workContext, work); XCTAssertEqual(result.directions.first?.signalPins.first?.revision, 3)
        let requests = await transport.captured(); XCTAssertEqual(requests.first?.url.path, "/prefix/v1/directions/cambium")
        XCTAssertEqual(requests.first?.headers["authorization"], "Bearer fixture")
    }
    func testCreatePinsExactPayloadAndRefusesChangedOwnerResult() async throws {
        let draft = DirectionDraft(title: "Improve Inbox", body: "A small next step.", work: work, signalPins: [DirectionSignalPin(id: "signal-1", revision: 3)])
        let value = DirectionCreate(operationId: "create-1", draft: draft)
        for title in ["Improve Inbox", "Substituted direction"] {
            let transport = try DirectionTransport(["schema": "cambium.direction-result.v1", "tenantId": "cambium", "principal": "founder", "direction": record(title: title), "replayed": false], status: 201)
            do { let saved = try await client(transport).create(tenant: "cambium", value: value); XCTAssertEqual(saved.direction.title, title); XCTAssertEqual(title, draft.title) }
            catch { XCTAssertNotEqual(title, draft.title); XCTAssertEqual(error as? SignalError, .invalid) }
            let requests = await transport.captured(); let body = try XCTUnwrap(requests.first?.body)
            let sent = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
            XCTAssertEqual(sent["operationId"] as? String, "create-1")
            XCTAssertNil(sent["principal"])
        }
    }
    func testForeignPrincipalInARecordIsRejected() async throws {
        let transport = try DirectionTransport(["schema": "cambium.direction-list.v1", "tenantId": "cambium", "principal": "founder", "directions": [record(principal: "other")], "workContext": NSNull()])
        do { _ = try await client(transport).list(tenant: "cambium"); XCTFail("foreign record accepted") } catch { XCTAssertEqual(error as? SignalError, .scope) }
    }
    func testInvalidPinsAreRefusedBeforeTransport() async throws {
        let transport = try DirectionTransport([:])
        let draft = DirectionDraft(title: "Improve Inbox", body: "", work: work, signalPins: [DirectionSignalPin(id: "signal-1", revision: 0)])
        do { _ = try await client(transport).create(tenant: "cambium", value: DirectionCreate(operationId: "create-1", draft: draft)); XCTFail("invalid pin accepted") } catch { XCTAssertEqual(error as? SignalError, .invalidRequest) }
        let requests = await transport.captured(); XCTAssertTrue(requests.isEmpty)
    }
}
