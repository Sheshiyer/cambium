import XCTest
@testable import CambiumCore

/// Optional vectors are regenerated from the current TS handler and local D1.
/// Run tools/probe-current-signals.sh; no hand-written success envelope is used.
final class SignalsWireIntegrationTests: XCTestCase {
    func testCurrentWorkerSignalWireWhenProvided() async throws {
        guard let path = ProcessInfo.processInfo.environment["CAMBIUM_SIGNALS_FIXTURE_DIR"] else {
            throw XCTSkip("Use tools/probe-current-signals.sh for current Worker wire proof")
        }
        let base = URL(fileURLWithPath: path)
        let now = try XCTUnwrap(CanonicalTimestamp.parse("2026-11-03T00:00:00.000Z"))
        let session = ReaderSession(.verified(founderId: "synthetic-signal-founder", tenantId: "cambium", expiresAt: now.addingTimeInterval(3600)))
        let responses = try ["signals-created", "signals-replayed", "signals-updated", "signals-list", "signals-detail"].map {
            try Data(contentsOf: base.appendingPathComponent($0 + ".json"))
        }
        let queue = SignalWireQueue(responses)
        let client = SignalHTTPClient(origin: try HTTPOriginPolicy(url: URL(string: "https://signals.example.invalid")!),
            transport: queue, authorizer: ReaderStaticAuthorizer(), sessionProvider: session, clock: ReaderClock(now))
        let input = SignalCapture(operationId: "synthetic-wire-capture", title: "Synthetic integration signal",
            body: "Contract verification only.", source: SignalSource(system: "field-report",
                recordId: "synthetic-observation", version: "1", reference: nil, observedAt: "2026-11-03T00:00:00.000Z"),
            projectIds: ["sapling:cambium"])
        let created = try await client.capture(tenant: "cambium", value: input)
        XCTAssertEqual(created.signal.projectIds, ["sapling:cambium"])
        XCTAssertNil(created.signal.source.reference)
        XCTAssertEqual(created.signal.revision, 1)
        let replay = try await client.capture(tenant: "cambium", value: input)
        XCTAssertTrue(replay.replayed)
        XCTAssertEqual(created.signal.id, replay.signal.id)
        let updated = try await client.update(tenant: "cambium", id: created.signal.id,
            value: SignalUpdate(operationId: "synthetic-wire-update", expectedRevision: 1,
                title: "Updated integration signal", body: input.body, projectIds: input.projectIds))
        XCTAssertEqual(updated.signal.revision, 2)
        let list = try await client.list(tenant: "cambium", projectId: "sapling:cambium")
        XCTAssertEqual(list.signals, [updated.signal])
        let detail = try await client.read(tenant: "cambium", id: created.signal.id)
        XCTAssertEqual(detail.signal, updated.signal)
        let sent = await queue.requests
        XCTAssertEqual(sent.map(\.method), ["POST", "POST", "PUT", "GET", "GET"])
        XCTAssertEqual(sent[0].body, sent[1].body)
        let body = try XCTUnwrap(sent[0].body)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        let source = try XCTUnwrap(object["source"] as? [String: Any])
        XCTAssertTrue(source["reference"] is NSNull, "nil references must encode explicit null for the Worker contract")
    }
}

private actor SignalWireQueue: HTTPTransport {
    var requests: [HTTPRequest] = []
    private var data: [Data]
    init(_ data: [Data]) { self.data = data }
    func send(_ request: HTTPRequest) async throws -> HTTPResponse {
        requests.append(request)
        guard !data.isEmpty else { throw TransportFailure.malformedResponse }
        return HTTPResponse(status: requests.count == 1 ? 201 : 200, body: data.removeFirst())
    }
}
