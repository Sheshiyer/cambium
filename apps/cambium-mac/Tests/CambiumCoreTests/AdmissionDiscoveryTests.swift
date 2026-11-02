import Foundation
import XCTest
@testable import CambiumCore

// Admission discovery against the owner-generated wire fixture
// (workers/quests/src/fixtures/native-launch-wire.v1.json). No real network.

final class AdmissionDiscoveryTests: XCTestCase {
    private let base = URL(string: "https://owner.example.test")!
    private let now = LaunchFixtures.now
    private let auth = HeaderAuthorizer(values: ["authorization": "Bearer synthetic-founder"])

    private func discovery(
        recorder: RequestRecorder = RequestRecorder(), status: Int, body: Data,
        onSend: (@Sendable () async -> Void)? = nil
    ) -> HTTPAdmissionDiscovery {
        HTTPAdmissionDiscovery(baseURL: base, transport: MockHTTPTransport { request in
            await recorder.add(request)
            await onSend?()
            return HTTPResponse(status: status, body: body)
        }, authorizer: auth)
    }

    private func sample(_ name: String) throws -> WireSample {
        try XCTUnwrap(try WireFixture.load()[name], name)
    }

    private func discover(
        _ client: HTTPAdmissionDiscovery, workId: String = "sapling:cambium",
        session: any SessionProvider = MutableSession(LaunchFixtures.session())
    ) async throws -> AdmissionDiscoveryResult {
        try await client.discoverAdmissions(workId: workId, session: session, clock: TestClock(date: now))
    }

    private func expect(
        _ error: AdmissionDiscoveryError, file: StaticString = #filePath, line: UInt = #line,
        _ body: () async throws -> AdmissionDiscoveryResult
    ) async {
        do {
            let result = try await body()
            XCTFail("expected \(error), got \(result)", file: file, line: line)
        } catch let actual as AdmissionDiscoveryError {
            XCTAssertEqual(actual, error, file: file, line: line)
        } catch {
            XCTFail("unexpected \(error)", file: file, line: line)
        }
    }

    private func entries(_ output: [String: Any]) throws -> [[String: Any]] {
        try XCTUnwrap(output["admissions"] as? [[String: Any]])
    }

    private func withEntries(_ output: [String: Any], _ list: [[String: Any]]) -> [String: Any] {
        var copy = output
        copy["admissions"] = list
        return copy
    }

    // MARK: Wire parity

    func testRequestAndCurrentReplyMatchFixture() async throws {
        let sample = try sample("admissions_current")
        let recorder = RequestRecorder()
        let result = try await discover(discovery(recorder: recorder, status: sample.status, body: WireFixture.data(sample.output)))

        let sent = await recorder.requests
        XCTAssertEqual(sent.count, 1)
        let request = try XCTUnwrap(sent.first)
        XCTAssertEqual(request.method, "POST")
        XCTAssertEqual(request.url.path, sample.path)
        XCTAssertEqual(request.url.path, "/v1/native/launch/admissions")
        XCTAssertEqual(request.headers["content-type"], "application/json")
        XCTAssertEqual(request.headers["authorization"], "Bearer synthetic-founder")
        let body = try XCTUnwrap(try JSONSerialization.jsonObject(with: try XCTUnwrap(request.body)) as? [String: Any])
        XCTAssertTrue(NSDictionary(dictionary: body).isEqual(to: sample.inputBody), "\(body)")
        XCTAssertEqual(Set(body.keys), ["contractVersion", "workId"])

        XCTAssertEqual(result.workId, "sapling:cambium")
        XCTAssertTrue(result.readOnly)
        XCTAssertFalse(result.truncated)
        XCTAssertEqual(result.admissions.count, 1)
        let record = try XCTUnwrap(result.admissions.first)
        XCTAssertEqual(record.admissionRef, "adm-123")
        XCTAssertEqual(record.availability, .supported)
        XCTAssertEqual(record.reason, "current")
        XCTAssertNil(record.existingRequest)
        XCTAssertEqual(record.tuple, LaunchCapabilityTuple(
            workId: "sapling:cambium", admissionRef: "adm-123", graphVersion: 1, loadoutId: "loadout-alpha",
            inputDigest: "sha256:" + String(repeating: "a", count: 64), executionPlant: "temperance-hands",
            supportedAction: "launch", expiresAt: "2026-11-02T01:00:00.000Z"
        ))
    }

    func testConsumedFixtureNamesTheExistingRequest() async throws {
        let sample = try sample("admissions_consumed")
        let result = try await discover(discovery(status: sample.status, body: WireFixture.data(sample.output)))
        let record = try XCTUnwrap(result.admissions.first)
        XCTAssertEqual(record.availability, .unavailable)
        XCTAssertEqual(record.reason, "admission_consumed")
        XCTAssertEqual(record.existingRequest, LaunchExistingRequest(requestId: "client-request-0001", attemptId: "client-attempt-0001"))
    }

    func testOtherWorkFixtureIsAnExplicitEmptyList() async throws {
        let sample = try sample("admissions_other_work_empty")
        let result = try await discover(discovery(status: sample.status, body: WireFixture.data(sample.output)), workId: "sapling:other")
        XCTAssertEqual(result, AdmissionDiscoveryResult(workId: "sapling:other", readOnly: true, admissions: [], truncated: false))
    }

    func testListingUnconfiguredFixtureIsUnavailableNotEmpty() async throws {
        let sample = try sample("admissions_listing_unconfigured")
        XCTAssertEqual(sample.status, 503)
        await expect(.unavailable) { try await self.discover(self.discovery(status: sample.status, body: WireFixture.data(sample.output))) }
    }

    // MARK: Response validation

    func testWrongWorkIsRejected() async throws {
        let sample = try sample("admissions_current")
        await expect(.malformedResponse) {
            try await self.discover(self.discovery(status: 200, body: WireFixture.data(
                WireFixture.mutate(sample.output, ["workId"], to: "sapling:other"))))
        }
        // Tuple naming another work inside a matching envelope.
        var entry = try entries(sample.output)[0]
        entry = WireFixture.mutate(entry, ["tuple", "workId"], to: "sapling:other")
        let mutated = withEntries(sample.output, [entry])
        await expect(.malformedResponse) { try await self.discover(self.discovery(status: 200, body: WireFixture.data(mutated))) }
    }

    func testWrongRefDigestAndShapeAreRejected() async throws {
        let sample = try sample("admissions_current")
        let entry = try entries(sample.output)[0]
        let cases: [[String: Any]] = [
            WireFixture.mutate(entry, ["admissionRef"], to: "adm-other"),
            WireFixture.mutate(entry, ["tuple", "admissionRef"], to: "adm-other"),
            WireFixture.mutate(entry, ["tuple", "inputDigest"], to: "sha256:XYZ"),
            WireFixture.mutate(entry, ["tuple", "graphVersion"], to: 0),
            WireFixture.mutate(entry, ["tuple", "expiresAt"], to: "tomorrow"),
            WireFixture.mutate(entry, ["tuple", "tenantId"], to: "tenant-alpha"),
            WireFixture.mutate(entry, ["availability"], to: "ready"),
            WireFixture.mutate(entry, ["reason"], to: "admission_expired"),
            WireFixture.mutate(entry, ["principalId"], to: "founder-1"),
            WireFixture.mutate(entry, ["existingRequest"], to: ["requestId": "client-request-0001", "attemptId": "client-attempt-0001"]),
            WireFixture.mutate(WireFixture.mutate(entry, ["availability"], to: "unavailable"), ["reason"], to: "admission_consumed"),
        ]
        for (index, bad) in cases.enumerated() {
            let data = try WireFixture.data(withEntries(sample.output, [bad]))
            do {
                _ = try await discover(discovery(status: 200, body: data))
                XCTFail("case \(index) accepted")
            } catch let error as AdmissionDiscoveryError {
                XCTAssertEqual(error, .malformedResponse, "case \(index)")
            }
        }
        for root in [
            WireFixture.mutate(sample.output, ["readOnly"], to: false),
            WireFixture.mutate(sample.output, ["truncated"], to: nil),
            WireFixture.mutate(sample.output, ["contractVersion"], to: "cambium.native-launch.v0"),
            WireFixture.mutate(sample.output, ["tenantId"], to: "tenant-alpha"),
            WireFixture.mutate(sample.output, ["admissions"], to: ["not": "a list"]),
        ] {
            await expect(.malformedResponse) { try await self.discover(self.discovery(status: 200, body: WireFixture.data(root))) }
        }
        await expect(.malformedResponse) { try await self.discover(self.discovery(status: 200, body: Data("not json".utf8))) }
    }

    func testDuplicateRefIsRejected() async throws {
        let sample = try sample("admissions_current")
        let entry = try entries(sample.output)[0]
        await expect(.malformedResponse) {
            try await self.discover(self.discovery(status: 200, body: WireFixture.data(self.withEntries(sample.output, [entry, entry]))))
        }
    }

    func testMoreThanThirtyTwoEntriesIsRejected() async throws {
        let sample = try sample("admissions_current")
        let entry = try entries(sample.output)[0]
        func numbered(_ count: Int) -> [[String: Any]] {
            (0..<count).map { index in
                let ref = "adm-\(String(format: "%03d", index))"
                return WireFixture.mutate(WireFixture.mutate(entry, ["admissionRef"], to: ref), ["tuple", "admissionRef"], to: ref)
            }
        }
        let full = try await discover(discovery(status: 200, body: WireFixture.data(
            WireFixture.mutate(withEntries(sample.output, numbered(32)), ["truncated"], to: true))))
        XCTAssertEqual(full.admissions.count, 32)
        XCTAssertTrue(full.truncated)
        await expect(.malformedResponse) {
            try await self.discover(self.discovery(status: 200, body: WireFixture.data(self.withEntries(sample.output, numbered(33)))))
        }
    }

    func testOversizePayloadIsRejected() async throws {
        let sample = try sample("admissions_current")
        let small = HTTPAdmissionDiscovery(baseURL: base, transport: MockHTTPTransport { _ in
            HTTPResponse(status: 200, body: try WireFixture.data(sample.output))
        }, authorizer: auth, maxResponseBytes: 64)
        await expect(.responseTooLarge) { try await self.discover(small) }

        let huge = HTTPAdmissionDiscovery(baseURL: base, transport: MockHTTPTransport { _ in
            HTTPResponse(status: 200, body: Data(count: HTTPLimits.maxResponseBytes + 1))
        }, authorizer: auth)
        await expect(.responseTooLarge) { try await self.discover(huge) }
    }

    // MARK: Session scope

    func testPrincipalSwitchDuringRequestDiscardsTheReply() async throws {
        let sample = try sample("admissions_current")
        let session = MutableSession(LaunchFixtures.session())
        let client = discovery(status: 200, body: try WireFixture.data(sample.output)) {
            await session.set(LaunchFixtures.session("founder-2"))
        }
        await expect(.notAdmitted) { try await self.discover(client, session: session) }

        let tenantSwitch = MutableSession(LaunchFixtures.session())
        let client2 = discovery(status: 200, body: try WireFixture.data(sample.output)) {
            await tenantSwitch.set(LaunchFixtures.session(tenant: "other-tenant"))
        }
        await expect(.notAdmitted) { try await self.discover(client2, session: tenantSwitch) }
    }

    func testExpiredOrUnconfiguredSessionSendsNothing() async throws {
        let sample = try sample("admissions_current")
        let recorder = RequestRecorder()
        let client = discovery(recorder: recorder, status: 200, body: try WireFixture.data(sample.output))
        await expect(.notAdmitted) { try await self.discover(client, session: MutableSession(.unconfigured)) }
        let expired = NativeSession.verified(founderId: "founder-1", tenantId: "cambium", expiresAt: now.addingTimeInterval(-1))
        await expect(.notAdmitted) { try await self.discover(client, session: MutableSession(expired)) }
        await expect(.invalidWorkId) { try await self.discover(client, workId: "not a work") }
        let sent = await recorder.requests
        XCTAssertTrue(sent.isEmpty)

        let unconfigured = UnconfiguredAdmissionDiscovery()
        do {
            _ = try await unconfigured.discoverAdmissions(workId: "sapling:cambium", session: MutableSession(LaunchFixtures.session()), clock: TestClock(date: now))
            XCTFail("unconfigured discovery returned data")
        } catch let error as AdmissionDiscoveryError {
            XCTAssertEqual(error, .unconfigured)
        }
    }

    // MARK: Server errors

    func testServerErrorsAreExplicit() async throws {
        let body = Data(#"{"contractVersion":"cambium.native-launch.v1","status":"unknown","retry":"status_only"}"#.utf8)
        let cases: [(Int, AdmissionDiscoveryError)] = [
            (401, .unauthorized), (403, .forbidden), (503, .unavailable), (400, .malformedResponse),
            (404, .malformedResponse), (500, .malformedResponse),
        ]
        for (status, error) in cases {
            await expect(error) { try await self.discover(self.discovery(status: status, body: body)) }
        }
        let failing = HTTPAdmissionDiscovery(baseURL: base, transport: MockHTTPTransport { _ in throw TransportFailure.timeout }, authorizer: auth)
        await expect(.transport("transport")) { try await self.discover(failing) }
    }

    func testInjectedErrorDetailNeverReachesTheSurface() async throws {
        let secret = "private-value-string"
        let leaking = HTTPAdmissionDiscovery(baseURL: base, transport: MockHTTPTransport { _ in
            throw LeakingFailure(detail: "token \(secret) at https://owner.example.test/?key=\(secret)")
        }, authorizer: auth)
        do {
            _ = try await discover(leaking)
            XCTFail("leaking failure returned data")
        } catch let error as AdmissionDiscoveryError {
            XCTAssertEqual(error, .transport("transport"))
            XCTAssertFalse(String(describing: error).contains(secret))
            XCTAssertFalse("\(error)".contains(secret))
        }
    }
}

private struct LeakingFailure: Error, CustomStringConvertible {
    let detail: String
    var description: String { detail }
}
