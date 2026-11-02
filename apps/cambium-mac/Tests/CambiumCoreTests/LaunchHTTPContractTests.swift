import Foundation
import XCTest
@testable import CambiumCore

// Replays the owner-generated wire fixture (workers/quests/src/fixtures/native-launch-wire.v1.json)
// against HTTPLaunchClient. Responses are the fixture's own bodies or minimal mutations of them.

struct MockHTTPTransport: HTTPTransport {
    let handler: @Sendable (HTTPRequest) async throws -> HTTPResponse
    func send(_ request: HTTPRequest) async throws -> HTTPResponse {
        try await handler(request)
    }
}

actor RequestRecorder {
    private(set) var requests: [HTTPRequest] = []
    func add(_ request: HTTPRequest) { requests.append(request) }
    func last() -> HTTPRequest? { requests.last }
}

// Immutable after load; the [String: Any] payloads are plain JSON values.
struct WireSample: @unchecked Sendable {
    let name: String
    let path: String
    let inputBody: [String: Any]
    let status: Int
    let output: [String: Any]
}

struct HeaderAuthorizer: RequestAuthorizer {
    let values: [String: String]
    func headers() async throws -> [String: String] { values }
}

enum WireFixture {
    static func load() throws -> [String: WireSample] {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
        let url = root.appendingPathComponent("workers/quests/src/fixtures/native-launch-wire.v1.json")
        let data = try Data(contentsOf: url)
        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["contractVersion"] as? String, "cambium.native-launch.v1")
        let samples = try XCTUnwrap(json["samples"] as? [[String: Any]])
        var out: [String: WireSample] = [:]
        for sample in samples {
            let input = try XCTUnwrap(sample["input"] as? [String: Any])
            let output = try XCTUnwrap(sample["output"] as? [String: Any])
            let name = try XCTUnwrap(sample["name"] as? String)
            out[name] = WireSample(
                name: name, path: try XCTUnwrap(input["path"] as? String),
                inputBody: try XCTUnwrap(input["body"] as? [String: Any]),
                status: try XCTUnwrap(output["status"] as? Int),
                output: try XCTUnwrap(output["body"] as? [String: Any])
            )
        }
        return out
    }

    static func data(_ object: [String: Any]) throws -> Data { try JSONSerialization.data(withJSONObject: object) }

    /// Returns a copy of `object` with the value at `path` replaced (or removed when nil).
    static func mutate(_ object: [String: Any], _ path: [String], to value: Any?) -> [String: Any] {
        var copy = object
        guard let head = path.first else { return copy }
        if path.count == 1 {
            if let value { copy[head] = value } else { copy.removeValue(forKey: head) }
        } else if let child = copy[head] as? [String: Any] {
            copy[head] = mutate(child, Array(path.dropFirst()), to: value)
        }
        return copy
    }

    static func tupleCapability(from body: [String: Any]) throws -> LaunchCapability {
        let tuple = try XCTUnwrap(body["capability"] as? [String: Any] ?? body["tuple"] as? [String: Any])
        return LaunchCapability(
            tenantId: "cambium", principal: "founder-1",
            workId: try XCTUnwrap(tuple["workId"] as? String), admissionRef: try XCTUnwrap(tuple["admissionRef"] as? String),
            graphVersion: try XCTUnwrap(tuple["graphVersion"] as? Int), loadoutId: try XCTUnwrap(tuple["loadoutId"] as? String),
            inputDigest: try XCTUnwrap(tuple["inputDigest"] as? String),
            executionPlant: try XCTUnwrap(ExecutionPlant(rawValue: try XCTUnwrap(tuple["executionPlant"] as? String))),
            supportedAction: try XCTUnwrap(tuple["supportedAction"] as? String), expiresAt: try XCTUnwrap(tuple["expiresAt"] as? String)
        )
    }
}

final class LaunchHTTPContractTests: XCTestCase {
    private let base = URL(string: "https://owner.example.test")!

    private func client(
        recorder: RequestRecorder, status: Int, body: Data, authorizer: any RequestAuthorizer = NoAuthorizer()
    ) -> HTTPLaunchClient {
        HTTPLaunchClient(baseURL: base, transport: MockHTTPTransport { request in
            await recorder.add(request)
            return HTTPResponse(status: status, body: body)
        }, authorizer: authorizer)
    }

    private func sentBody(_ recorder: RequestRecorder) async throws -> [String: Any] {
        let lastRequest = await recorder.last()
        let request = try XCTUnwrap(lastRequest)
        return try XCTUnwrap(try JSONSerialization.jsonObject(with: try XCTUnwrap(request.body)) as? [String: Any])
    }

    private func assertSameJSON(_ lhs: [String: Any], _ rhs: [String: Any], file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(NSDictionary(dictionary: lhs).isEqual(to: rhs), "\(lhs) != \(rhs)", file: file, line: line)
    }

    // MARK: Requests match the owner contract exactly

    func testCapabilityRequestAndSupportedReplyMatchFixture() async throws {
        let sample = try XCTUnwrap(try WireFixture.load()["capability_supported"])
        let recorder = RequestRecorder()
        let reply = try await client(recorder: recorder, status: sample.status, body: WireFixture.data(sample.output))
            .ownerCapability(workId: "sapling:cambium", admissionRef: "adm-123")

        let lastRequest = await recorder.last()
        let request = try XCTUnwrap(lastRequest)
        XCTAssertEqual(request.method, "POST")
        XCTAssertEqual(request.url.path, sample.path)
        XCTAssertEqual(request.headers["content-type"], "application/json")
        assertSameJSON(try await sentBody(recorder), sample.inputBody)
        guard case .supported(let tuple) = reply else { return XCTFail("\(reply)") }
        XCTAssertEqual(tuple.workId, "sapling:cambium")
        XCTAssertEqual(tuple.admissionRef, "adm-123")
        XCTAssertEqual(tuple.graphVersion, 1)
        XCTAssertEqual(tuple.executionPlant, "temperance-hands")
    }

    func testCapabilityUnsupportedAndUnavailableAreExplicit() async throws {
        let samples = try WireFixture.load()
        let unsupported = try XCTUnwrap(samples["capability_unsupported"])
        let unavailable = try XCTUnwrap(samples["capability_unavailable"])

        let reply1 = try await client(recorder: RequestRecorder(), status: 200, body: WireFixture.data(unsupported.output))
            .ownerCapability(workId: "sapling:cambium", admissionRef: "adm-123")
        guard case .unsupported(let reason, let tuple) = reply1 else { return XCTFail("\(reply1)") }
        XCTAssertEqual(reason, "owner_does_not_support")
        XCTAssertEqual(tuple.admissionRef, "adm-123")

        let reply2 = try await client(recorder: RequestRecorder(), status: 200, body: WireFixture.data(unavailable.output))
            .ownerCapability(workId: "sapling:other", admissionRef: "adm-123")
        XCTAssertEqual(reply2, .unavailable(reason: "no_admission", existingRequest: nil))

        let consumed: [String: Any] = [
            "contractVersion": "cambium.native-launch.v1", "capability": "unavailable", "reason": "admission_consumed",
            "existingRequest": ["requestId": "client-request-0001", "attemptId": "client-attempt-0001"]
        ]
        let reply3 = try await client(recorder: RequestRecorder(), status: 200, body: WireFixture.data(consumed))
            .ownerCapability(workId: "sapling:cambium", admissionRef: "adm-123")
        XCTAssertEqual(reply3, .unavailable(reason: "admission_consumed",
                                            existingRequest: LaunchExistingRequest(requestId: "client-request-0001", attemptId: "client-attempt-0001")))
    }

    func testCapabilityReplyForAnotherWorkOrAdmissionIsRejected() async throws {
        let sample = try XCTUnwrap(try WireFixture.load()["capability_supported"])
        let body = try WireFixture.data(sample.output)
        for (work, admission) in [("sapling:elsewhere", "adm-123"), ("sapling:cambium", "adm-other")] {
            do {
                _ = try await client(recorder: RequestRecorder(), status: 200, body: body).ownerCapability(workId: work, admissionRef: admission)
                XCTFail("expected malformed for \(work)/\(admission)")
            } catch { XCTAssertEqual(error as? TransportFailure, .malformedResponse) }
        }
    }

    func testLaunchRequestIsNestedWithNoIdentityAndBounded() async throws {
        let sample = try XCTUnwrap(try WireFixture.load()["launch_accepted_queued"])
        let recorder = RequestRecorder()
        let capability = try WireFixture.tupleCapability(from: sample.inputBody)
        let wire = try await client(recorder: recorder, status: sample.status, body: WireFixture.data(sample.output),
                                    authorizer: HeaderAuthorizer(values: ["authorization": "Bearer synthetic-founder"]))
            .requestLaunch(capability: capability, requestId: "client-request-0001", attemptId: "client-attempt-0001",
                           idempotencyNonce: "nonce_abcdefghijklmnopqrstuv")

        let lastRequest = await recorder.last()
        let request = try XCTUnwrap(lastRequest)
        XCTAssertEqual(request.url.path, sample.path)
        assertSameJSON(try await sentBody(recorder), sample.inputBody)
        let text = String(decoding: try XCTUnwrap(request.body), as: UTF8.self)
        XCTAssertLessThanOrEqual(try XCTUnwrap(request.body).count, LaunchContract.maxBodyBytes)
        for forbidden in ["tenantId", "principal", "cookie", "Cookie", "Bearer", "runner"] {
            XCTAssertFalse(text.contains(forbidden), forbidden)
        }
        XCTAssertEqual(request.headers["authorization"], "Bearer synthetic-founder")

        XCTAssertEqual(wire.requestId, "client-request-0001")
        XCTAssertEqual(wire.attemptId, "client-attempt-0001")
        XCTAssertEqual(wire.httpStatus, 202)
        XCTAssertEqual(wire.status, .queued)
        XCTAssertEqual(wire.detail, "recorded")
        XCTAssertEqual(wire.dispatch, "owner_answered")
        XCTAssertEqual(wire.executionState, "queued")
        XCTAssertEqual(wire.terminal, false)
        XCTAssertEqual(wire.acceptance, "not_evaluated")
        XCTAssertEqual(wire.retry, "status_only")
        XCTAssertEqual(wire.ownerRef, "synthetic-owner-1")
        XCTAssertEqual(wire.requestKey, "nlr_3dee6711ddb0adc67f7cd3576f72ec5d5665c543333b59896d52bc533ab92d6d")
    }

    func testLaunchUnknownLostOwnerResponseKeepsTransportExecutionAndAcceptanceSeparate() async throws {
        let sample = try XCTUnwrap(try WireFixture.load()["launch_unknown_lost_owner_response"])
        let capability = try WireFixture.tupleCapability(from: sample.inputBody)
        let wire = try await client(recorder: RequestRecorder(), status: sample.status, body: WireFixture.data(sample.output))
            .requestLaunch(capability: capability, requestId: "client-request-0001", attemptId: "client-attempt-0001",
                           idempotencyNonce: "nonce_abcdefghijklmnopqrstuv")
        XCTAssertEqual(wire.httpStatus, 503)
        XCTAssertEqual(wire.status, .unknown)
        XCTAssertEqual(wire.detail, "unknown")
        XCTAssertEqual(wire.dispatch, "owner_unknown")
        XCTAssertEqual(wire.executionState, "unknown")
        XCTAssertEqual(wire.acceptance, "not_evaluated")
        XCTAssertEqual(wire.retry, "status_only")
        XCTAssertNil(wire.assignedRunId, "no run id is invented from an owner reference")
    }

    func testEveryOwnerLaunchStatusCodeDecodesTruthfully() async throws {
        let base = try XCTUnwrap(try WireFixture.load()["launch_accepted_queued"])
        let capability = try WireFixture.tupleCapability(from: base.inputBody)
        func run(_ status: Int, _ tag: String, _ state: String, terminal: Bool) async throws -> LaunchRequestWire {
            var body = WireFixture.mutate(base.output, ["status"], to: tag)
            body = WireFixture.mutate(body, ["execution", "state"], to: state)
            body = WireFixture.mutate(body, ["execution", "terminal"], to: terminal)
            body = WireFixture.mutate(body, ["retry"], to: terminal ? "none" : "status_only")
            return try await client(recorder: RequestRecorder(), status: status, body: WireFixture.data(body))
                .requestLaunch(capability: capability, requestId: "client-request-0001", attemptId: "client-attempt-0001",
                               idempotencyNonce: "nonce_abcdefghijklmnopqrstuv")
        }
        let running = try await run(202, "recorded", "running", terminal: false)
        XCTAssertEqual(running.status, .running)
        let succeeded = try await run(202, "recorded", "succeeded", terminal: true)
        XCTAssertEqual(succeeded.status, .complete)
        XCTAssertEqual(succeeded.acceptance, "not_evaluated", "execution success is not acceptance")
        let duplicate = try await run(200, "duplicate", "queued", terminal: false)
        XCTAssertEqual(duplicate.status, .queued)
        XCTAssertEqual(duplicate.detail, "duplicate")
        let busy = try await run(429, "recorded", "busy", terminal: true)
        XCTAssertEqual(busy.status, .busy)
        XCTAssertEqual(busy.retry, "none")
        let refused = try await run(409, "recorded", "refused", terminal: true)
        XCTAssertEqual(refused.status, .refused)

        for (code, tag, state, terminal) in [(202, "recorded", "busy", true), (429, "recorded", "queued", false), (503, "unknown", "queued", false), (202, "unknown", "unknown", false)] {
            do { _ = try await run(code, tag, state, terminal: terminal); XCTFail("expected malformed for \(code)/\(tag)/\(state)") }
            catch { XCTAssertEqual(error as? TransportFailure, .malformedResponse) }
        }
    }

    func testConflictRefusedAndUnconfiguredRepliesAreExplicit() async throws {
        let base = try XCTUnwrap(try WireFixture.load()["launch_accepted_queued"])
        let capability = try WireFixture.tupleCapability(from: base.inputBody)
        func run(_ status: Int, _ body: [String: Any]) async throws -> LaunchRequestWire {
            try await client(recorder: RequestRecorder(), status: status, body: WireFixture.data(body))
                .requestLaunch(capability: capability, requestId: "client-request-0001", attemptId: "client-attempt-0001",
                               idempotencyNonce: "nonce_abcdefghijklmnopqrstuv")
        }
        let header: [String: Any] = ["contractVersion": "cambium.native-launch.v1", "acceptance": ["state": "not_evaluated"]]
        for code in ["request_changed", "attempt_collision", "nonce_collision", "admission_consumed"] {
            let wire = try await run(409, header.merging(["status": "conflict", "code": code]) { $1 })
            XCTAssertEqual(wire.status, .refused)
            XCTAssertEqual(wire.detail, "conflict:\(code)")
            XCTAssertEqual(wire.requestId, "client-request-0001")
        }
        for code in ["admission_not_current", "pins_changed", "admission_expired", "admission_revoked", "graph_changed", "unsupported_plant_or_action"] {
            let wire = try await run(409, header.merging(["status": "refused", "code": code]) { $1 })
            XCTAssertEqual(wire.status, .refused)
            XCTAssertEqual(wire.detail, "refused:\(code)")
        }
        let unconfigured = try await run(503, ["contractVersion": "cambium.native-launch.v1", "error": "native_launch_unconfigured"])
        XCTAssertEqual(unconfigured.status, .unknown)
        do { _ = try await run(409, header.merging(["status": "conflict", "code": "made_up"]) { $1 }); XCTFail() }
        catch { XCTAssertEqual(error as? LaunchError, .refused("http_409")) }
    }

    func testMaliciousLaunchResponsesAreRejected() async throws {
        let base = try XCTUnwrap(try WireFixture.load()["launch_accepted_queued"])
        let capability = try WireFixture.tupleCapability(from: base.inputBody)
        let mutations: [(String, [String: Any])] = [
            ("other request id", WireFixture.mutate(base.output, ["request", "requestId"], to: "attacker-request-1")),
            ("other attempt id", WireFixture.mutate(base.output, ["request", "attemptId"], to: "attacker-attempt-1")),
            ("changed pin", WireFixture.mutate(base.output, ["request", "capability", "inputDigest"], to: "sha256:" + String(repeating: "b", count: 64))),
            ("extra pin key", WireFixture.mutate(base.output, ["request", "capability", "principalId"], to: "someone")),
            ("acceptance decided", WireFixture.mutate(base.output, ["acceptance", "state"], to: "accepted")),
            ("wrong contract", WireFixture.mutate(base.output, ["contractVersion"], to: "cambium.native-launch.v2")),
            ("terminal flag lies", WireFixture.mutate(base.output, ["execution", "terminal"], to: true)),
            ("unknown execution state", WireFixture.mutate(base.output, ["execution", "state"], to: "teleported")),
            ("bad request key", WireFixture.mutate(base.output, ["request", "requestKey"], to: "nlr_short")),
            ("missing execution", WireFixture.mutate(base.output, ["execution"], to: nil)),
            ("future-shaped time", WireFixture.mutate(base.output, ["request", "reservedAt"], to: "tomorrow")),
        ]
        for (name, body) in mutations {
            do {
                _ = try await client(recorder: RequestRecorder(), status: 202, body: WireFixture.data(body))
                    .requestLaunch(capability: capability, requestId: "client-request-0001", attemptId: "client-attempt-0001",
                                   idempotencyNonce: "nonce_abcdefghijklmnopqrstuv")
                XCTFail("accepted malicious reply: \(name)")
            } catch { XCTAssertEqual(error as? TransportFailure, .malformedResponse, name) }
        }
        do {
            _ = try await client(recorder: RequestRecorder(), status: 202, body: Data(repeating: 0x20, count: HTTPLimits.maxResponseBytes + 1))
                .requestLaunch(capability: capability, requestId: "client-request-0001", attemptId: "client-attempt-0001",
                               idempotencyNonce: "nonce_abcdefghijklmnopqrstuv")
            XCTFail("oversize accepted")
        } catch { XCTAssertEqual(error as? TransportFailure, .responseTooLarge) }
    }

    func testLocalPreflightRefusesBadShapesBeforeAnyRequest() async throws {
        let base = try XCTUnwrap(try WireFixture.load()["launch_accepted_queued"])
        let good = try WireFixture.tupleCapability(from: base.inputBody)
        let recorder = RequestRecorder()
        let sut = client(recorder: recorder, status: 202, body: try WireFixture.data(base.output))
        var badDigest = good; badDigest.inputDigest = "sha256:def"
        var badAction = good; badAction.supportedAction = "execute-plan"
        var badWork = good; badWork.workId = "not a work id"
        for capability in [badDigest, badAction, badWork] {
            do { _ = try await sut.requestLaunch(capability: capability, requestId: "client-request-0001", attemptId: "client-attempt-0001", idempotencyNonce: "nonce_abcdefghijklmnopqrstuv"); XCTFail() }
            catch { XCTAssertEqual(error as? LaunchError, .invalidCapability) }
        }
        for nonce in ["short", "has space has space has space", String(repeating: "n", count: 129)] {
            do { _ = try await sut.requestLaunch(capability: good, requestId: "client-request-0001", attemptId: "client-attempt-0001", idempotencyNonce: nonce); XCTFail() }
            catch { XCTAssertEqual(error as? LaunchError, .invalidCapability) }
        }
        do { _ = try await sut.requestLaunch(capability: good, requestId: "short", attemptId: "client-attempt-0001", idempotencyNonce: "nonce_abcdefghijklmnopqrstuv"); XCTFail() }
        catch { XCTAssertEqual(error as? LaunchError, .invalidCapability) }
        let sent = await recorder.requests.count
        XCTAssertEqual(sent, 0)
    }

    // MARK: Status

    func testStatusRequestAndTerminalReplyMatchFixture() async throws {
        let sample = try XCTUnwrap(try WireFixture.load()["status_recovered_succeeded"])
        let recorder = RequestRecorder()
        let result = try await client(recorder: recorder, status: sample.status, body: WireFixture.data(sample.output))
            .attemptStatus(requestId: "client-request-0001", attemptId: "client-attempt-0001", tenantId: "ignored-on-wire")
        assertSameJSON(try await sentBody(recorder), sample.inputBody)
        let lastRequest = await recorder.last()
        let request = try XCTUnwrap(lastRequest)
        XCTAssertEqual(request.url.path, sample.path)
        XCTAssertFalse(String(decoding: try XCTUnwrap(request.body), as: UTF8.self).contains("ignored-on-wire"))

        XCTAssertEqual(result.requestId, "client-request-0001")
        XCTAssertEqual(result.attemptId, "client-attempt-0001")
        XCTAssertEqual(result.status, .complete)
        XCTAssertEqual(result.detail, "observed")
        XCTAssertEqual(result.terminal, true)
        XCTAssertEqual(result.retry, "none")
        XCTAssertEqual(result.acceptance, "not_evaluated")
        XCTAssertNil(result.verdict)
        XCTAssertNil(result.runId)
        XCTAssertEqual(result.ownerRef, "synthetic-owner-1")
    }

    func testStatusNotFoundOwnerNotFoundMismatchAndReadbackUnavailable() async throws {
        let samples = try WireFixture.load()
        let notFound = try XCTUnwrap(samples["status_unknown_request"])
        let unknown = try await client(recorder: RequestRecorder(), status: notFound.status, body: WireFixture.data(notFound.output))
            .attemptStatus(requestId: "client-request-9999", attemptId: "client-attempt-9999", tenantId: "t")
        XCTAssertEqual(unknown.status, .unknown)
        XCTAssertEqual(unknown.detail, "not_found")
        XCTAssertEqual(unknown.requestId, "client-request-9999")

        let base = try XCTUnwrap(samples["status_recovered_succeeded"])
        var ownerNotFound = WireFixture.mutate(base.output, ["status"], to: "owner_not_found")
        ownerNotFound = WireFixture.mutate(ownerNotFound, ["execution", "state"], to: "unknown")
        ownerNotFound = WireFixture.mutate(ownerNotFound, ["execution", "terminal"], to: false)
        ownerNotFound = WireFixture.mutate(ownerNotFound, ["retry"], to: "status_only")
        let lost = try await client(recorder: RequestRecorder(), status: 200, body: WireFixture.data(ownerNotFound))
            .attemptStatus(requestId: "client-request-0001", attemptId: "client-attempt-0001", tenantId: "t")
        XCTAssertEqual(lost.status, .unknown)
        XCTAssertEqual(lost.detail, "owner_not_found")

        do {
            _ = try await client(recorder: RequestRecorder(), status: 409, body: WireFixture.data(["contractVersion": "cambium.native-launch.v1", "status": "conflict", "code": "attempt_mismatch"]))
                .attemptStatus(requestId: "client-request-0001", attemptId: "client-attempt-0001", tenantId: "t")
            XCTFail()
        } catch { XCTAssertEqual(error as? LaunchError, .refused("attempt_mismatch")) }

        do {
            _ = try await client(recorder: RequestRecorder(), status: 503, body: WireFixture.data(WireFixture.mutate(base.output, ["status"], to: "readback_unavailable")))
                .attemptStatus(requestId: "client-request-0001", attemptId: "client-attempt-0001", tenantId: "t")
            XCTFail()
        } catch { XCTAssertEqual(error as? TransportFailure, .unreachable) }

        do {
            _ = try await client(recorder: RequestRecorder(), status: 200, body: WireFixture.data(WireFixture.mutate(base.output, ["request", "requestId"], to: "attacker-request-1")))
                .attemptStatus(requestId: "client-request-0001", attemptId: "client-attempt-0001", tenantId: "t")
            XCTFail()
        } catch { XCTAssertEqual(error as? TransportFailure, .malformedResponse) }
    }

    // MARK: Scope

    func testResolveCapabilityPinsScopeFromSessionAndRechecksAfterAwait() async throws {
        let sample = try XCTUnwrap(try WireFixture.load()["capability_supported"])
        let body = try WireFixture.data(sample.output)
        let clock = TestClock(date: LaunchFixtures.now)
        let session = MutableSession(LaunchFixtures.session("founder-1", tenant: "cambium"))

        let sut = HTTPLaunchClient(baseURL: base, transport: MockHTTPTransport { _ in HTTPResponse(status: 200, body: body) }, authorizer: NoAuthorizer())
        let capability = try await sut.resolveCapability(workId: "sapling:cambium", admissionRef: "adm-123", session: session, clock: clock)
        XCTAssertEqual(capability.tenantId, "cambium")
        XCTAssertEqual(capability.principal, "founder-1")
        XCTAssertEqual(capability.admissionRef, "adm-123")

        let swapping = HTTPLaunchClient(baseURL: base, transport: MockHTTPTransport { _ in
            await session.set(LaunchFixtures.session("founder-2", tenant: "cambium"))
            return HTTPResponse(status: 200, body: body)
        }, authorizer: NoAuthorizer())
        await session.set(LaunchFixtures.session("founder-1", tenant: "cambium"))
        do { _ = try await swapping.resolveCapability(workId: "sapling:cambium", admissionRef: "adm-123", session: session, clock: clock); XCTFail() }
        catch { XCTAssertEqual(error as? LaunchError, .notAdmitted) }

        let recorder = RequestRecorder()
        let silent = client(recorder: recorder, status: 200, body: body)
        do { _ = try await silent.resolveCapability(workId: "sapling:cambium", admissionRef: "adm-123", session: MutableSession(.unconfigured), clock: clock); XCTFail() }
        catch { XCTAssertEqual(error as? LaunchError, .notAdmitted) }
        let sent = await recorder.requests.count
        XCTAssertEqual(sent, 0)
    }

    func testResolveCapabilitySurfacesUnsupportedUnavailableAndExpired() async throws {
        let samples = try WireFixture.load()
        let clock = TestClock(date: LaunchFixtures.now)
        let session = MutableSession(LaunchFixtures.session())
        func resolve(_ output: [String: Any]) async throws -> LaunchCapability {
            try await client(recorder: RequestRecorder(), status: 200, body: WireFixture.data(output))
                .resolveCapability(workId: "sapling:cambium", admissionRef: "adm-123", session: session, clock: clock)
        }
        do { _ = try await resolve(try XCTUnwrap(samples["capability_unsupported"]).output); XCTFail() }
        catch { XCTAssertEqual(error as? LaunchError, .capabilityUnsupported("owner_does_not_support")) }
        do { _ = try await resolve(try XCTUnwrap(samples["capability_unavailable"]).output); XCTFail() }
        catch { XCTAssertEqual(error as? LaunchError, .capabilityUnavailable("no_admission")) }
        let supported = try XCTUnwrap(samples["capability_supported"]).output
        do { _ = try await resolve(WireFixture.mutate(supported, ["tuple", "supportedAction"], to: "cancel")); XCTFail() }
        catch { XCTAssertEqual(error as? LaunchError, .capabilityUnsupported("plant_or_action")) }
        do { _ = try await resolve(WireFixture.mutate(supported, ["tuple", "expiresAt"], to: "2026-11-01T00:00:00.000Z")); XCTFail() }
        catch { XCTAssertEqual(error as? LaunchError, .expired) }
    }

    func testLegacyFlatCapabilitySignatureNeverFabricatesOwnerData() async throws {
        let recorder = RequestRecorder()
        let sut = client(recorder: recorder, status: 200, body: Data("{}".utf8))
        do { _ = try await sut.capability(workId: "sapling:cambium", tenantId: "cambium"); XCTFail() }
        catch { XCTAssertEqual(error as? LaunchError, .refused("admission_ref_required")) }
        let sent = await recorder.requests.count
        XCTAssertEqual(sent, 0)
    }

    // MARK: Coordinator + HTTP client end to end with an echoing owner fake

    private func echoTransport(_ samples: [String: WireSample], recorder: RequestRecorder, launch: String, status: String = "status_recovered_succeeded") -> MockHTTPTransport {
        MockHTTPTransport { request in
            await recorder.add(request)
            let body = try XCTUnwrap(try JSONSerialization.jsonObject(with: try XCTUnwrap(request.body)) as? [String: Any])
            let sample = try XCTUnwrap(request.url.path.hasSuffix("/status") ? samples[status] : samples[launch])
            var output = WireFixture.mutate(sample.output, ["request", "requestId"], to: body["requestId"])
            output = WireFixture.mutate(output, ["request", "attemptId"], to: body["attemptId"])
            return HTTPResponse(status: sample.status, body: try WireFixture.data(output))
        }
    }

    private func fixtureCapability(_ samples: [String: WireSample]) throws -> LaunchCapability {
        try WireFixture.tupleCapability(from: try XCTUnwrap(samples["launch_accepted_queued"]).inputBody)
    }

    func testCoordinatorOverHTTPRecordsOwnerSectionsAndRecoversAfterRestart() async throws {
        let samples = try WireFixture.load()
        let dir = LaunchFixtures.tempDir()
        defer { try? FileManager.default.removeItem(at: dir) }
        let recorder = RequestRecorder()
        let nonce = "nonce_abcdefghijklmnopqrstuv"
        let session = MutableSession(LaunchFixtures.session())
        let clock = TestClock(date: LaunchFixtures.now)

        let lostClient = HTTPLaunchClient(baseURL: base, transport: echoTransport(samples, recorder: recorder, launch: "launch_unknown_lost_owner_response"), authorizer: NoAuthorizer())
        let first = LaunchCoordinator(client: lostClient, session: session, clock: clock, store: FileRecoveryStore(directory: dir))
        let outcome = try await first.launch(capability: try fixtureCapability(samples), idempotencyNonce: nonce)
        XCTAssertEqual(outcome.state, .outcomeUnknown)
        XCTAssertEqual(outcome.record.dispatch, "owner_unknown")
        XCTAssertEqual(outcome.record.acceptance, "not_evaluated")
        XCTAssertTrue(outcome.record.requestId.hasPrefix("req-"))

        let restartRecorder = RequestRecorder()
        let recovery = HTTPLaunchClient(baseURL: base, transport: echoTransport(samples, recorder: restartRecorder, launch: "launch_accepted_queued"), authorizer: NoAuthorizer())
        let restarted = LaunchCoordinator(client: recovery, session: session, clock: clock, store: FileRecoveryStore(directory: dir))
        let pending = try await restarted.pendingRecoveries()
        XCTAssertEqual(pending.map(\.requestId), [outcome.record.requestId])
        let recovered = try await restarted.recover(workId: "sapling:cambium", idempotencyNonce: nonce)
        XCTAssertEqual(recovered.state, .complete)
        XCTAssertEqual(recovered.record.requestId, outcome.record.requestId)
        XCTAssertEqual(recovered.record.attemptId, outcome.record.attemptId)
        XCTAssertEqual(recovered.record.executionState, "succeeded")
        XCTAssertEqual(recovered.record.acceptance, "not_evaluated")
        XCTAssertNil(recovered.record.verdict)

        let requests = await restartRecorder.requests
        XCTAssertEqual(requests.map { $0.url.path }, ["/v1/native/launch/status"])
        let statusBody = try XCTUnwrap(try JSONSerialization.jsonObject(with: try XCTUnwrap(requests.first?.body)) as? [String: Any])
        XCTAssertEqual(statusBody["requestId"] as? String, outcome.record.requestId)
        XCTAssertEqual(statusBody["attemptId"] as? String, outcome.record.attemptId)
        XCTAssertEqual(Set(statusBody.keys), ["contractVersion", "requestId", "attemptId"])

        let names = try FileManager.default.contentsOfDirectory(atPath: dir.path)
        let stored = try String(contentsOf: dir.appendingPathComponent(try XCTUnwrap(names.first)), encoding: .utf8)
        for forbidden in ["Bearer", "cookie", "Cookie", "runner"] { XCTAssertFalse(stored.contains(forbidden), forbidden) }
    }

    func testCoordinatorOverHTTPRefusesLocallyBadNonceWithoutPersistingOrSending() async throws {
        let samples = try WireFixture.load()
        let store = InMemoryRecoveryStore()
        let recorder = RequestRecorder()
        let client = HTTPLaunchClient(baseURL: base, transport: echoTransport(samples, recorder: recorder, launch: "launch_accepted_queued"), authorizer: NoAuthorizer())
        let launcher = LaunchCoordinator(client: client, session: MutableSession(LaunchFixtures.session()), clock: TestClock(date: LaunchFixtures.now), store: store)
        do { _ = try await launcher.launch(capability: try fixtureCapability(samples), idempotencyNonce: "nonce-99"); XCTFail() }
        catch { XCTAssertEqual(error as? LaunchError, .invalidCapability) }
        let keys = try await store.keys(prefix: "")
        XCTAssertTrue(keys.isEmpty)
        let sent = await recorder.requests.count
        XCTAssertEqual(sent, 0)
    }

    func testCoordinatorOverHTTPMapsBusyAndConflictWithoutRedispatch() async throws {
        let samples = try WireFixture.load()
        var busySamples = samples
        let queued = try XCTUnwrap(samples["launch_accepted_queued"])
        var busyBody = WireFixture.mutate(queued.output, ["execution", "state"], to: "busy")
        busyBody = WireFixture.mutate(busyBody, ["execution", "terminal"], to: true)
        busyBody = WireFixture.mutate(busyBody, ["retry"], to: "none")
        busySamples["busy"] = WireSample(name: "busy", path: queued.path, inputBody: queued.inputBody, status: 429, output: busyBody)

        let recorder = RequestRecorder()
        let client = HTTPLaunchClient(baseURL: base, transport: echoTransport(busySamples, recorder: recorder, launch: "busy"), authorizer: NoAuthorizer())
        let launcher = LaunchCoordinator(client: client, session: MutableSession(LaunchFixtures.session()), clock: TestClock(date: LaunchFixtures.now), store: InMemoryRecoveryStore())
        let outcome = try await launcher.launch(capability: try fixtureCapability(samples), idempotencyNonce: "nonce_abcdefghijklmnopqrstuv")
        XCTAssertEqual(outcome.state, .busy)
        XCTAssertEqual(outcome.record.executionState, "busy")

        do { _ = try await launcher.launch(capability: try fixtureCapability(samples), idempotencyNonce: "nonce_zzzzzzzzzzzzzzzzzzzzzz"); XCTFail() }
        catch { XCTAssertEqual(error as? LaunchError, .refused("admission_consumed")) }
        let sent = await recorder.requests.count
        XCTAssertEqual(sent, 1)
    }
}
