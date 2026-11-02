import CryptoKit
import XCTest
@testable import CambiumCore

final class CambiumCoreTests: XCTestCase {

    func testMinimalApiTypesAndDemoData() {
        let snapshot = DemoData.snapshot
        XCTAssertEqual(snapshot.sourceKind, "demo")
        XCTAssertFalse(snapshot.work.isEmpty)
        XCTAssertEqual(snapshot.work.first?.id, "sapling:cambium")
        XCTAssertEqual(snapshot.connections.count, 2)
        XCTAssertTrue(snapshot.gaps.contains("native-identity-unconfigured"))

        let evidence = EvidenceItem(id: "e1", title: "Test", sourceRef: "ref", kind: "kind")
        XCTAssertEqual(evidence.id, "e1")
        XCTAssertNil(evidence.observedAt)
        XCTAssertNil(evidence.digest)

        let work = WorkObject(id: "w1", name: "Work", kind: "sapling", summary: "Sum", objective: "Obj", currentState: "state", nextStep: "next")
        XCTAssertTrue(work.dependencies.isEmpty)
        XCTAssertTrue(work.evidence.isEmpty)
        XCTAssertEqual(work.attention, "review")

        let conn = ConnectionObservation(id: "c1", name: "Conn", owner: "owner", status: "ok", detail: "detail")
        XCTAssertEqual(conn.id, "c1")
        XCTAssertNil(conn.observedAt)
    }

    func testJSONValueNumberAndBoolDisambiguation() throws {
        let json = Data(#"{"num0":0,"num1":1,"boolTrue":true,"boolFalse":false}"#.utf8)
        let root = try JSONValue.parse(json)
        guard case .object(let dict) = root else { return XCTFail() }
        XCTAssertEqual(dict["num0"], .number(0))
        XCTAssertEqual(dict["num1"], .number(1))
        XCTAssertEqual(dict["boolTrue"], .bool(true))
        XCTAssertEqual(dict["boolFalse"], .bool(false))
    }

    func testFileRecoveryStoreCollisionSafeReopen() async throws {
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        let store = FileRecoveryStore(directory: tempDir)
        let key = "gate:cambium:p1:v1:nonce:123"
        let payload = Data("hello world".utf8)
        try await store.save(payload, key: key)

        let keys = try await store.keys(prefix: "gate:")
        XCTAssertEqual(keys, [key])

        let loaded = try await store.load(key: key)
        XCTAssertEqual(loaded, payload)

        try await store.remove(key: key)
        let removedLoad = try await store.load(key: key)
        XCTAssertNil(removedLoad)
    }

    func testEnvelopeDecoderWithRealTypeScriptFixtures() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "mission-fabric-envelope-founder", withExtension: "json", subdirectory: "Fixtures"))
        let data = try Data(contentsOf: url)
        let requested = ReaderScope(tenantId: "cambium", role: "founder")
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let now = formatter.date(from: "2026-07-28T09:05:00.000Z") ?? Date()
        let context = FabricDecodeContext(requested: requested, now: now)

        let result = MissionFabricDecoder.decode(json: data, context: context)
        switch result {
        case .success(let envelope):
            XCTAssertEqual(envelope.projection.tenantId, "cambium")
            XCTAssertFalse(envelope.projection.nodes.isEmpty)
            XCTAssertNotNil(envelope.portfolioCatalogSummary)
            XCTAssertEqual(envelope.digests.graphDigest, envelope.projection.graphDigest)
        case .failure(let err):
            XCTFail("Failed to decode envelope: \(err)")
        }
    }

    func testEnvelopeDecoderMalformedAndSchema() throws {
        let requested = ReaderScope(tenantId: "cambium", role: "founder")
        let context = FabricDecodeContext(requested: requested, now: Date())

        let badJson = Data("not json".utf8)
        let result1 = MissionFabricDecoder.decode(json: badJson, context: context)
        guard case .failure(let err1) = result1 else { return XCTFail() }
        XCTAssertEqual(err1, .malformed("json"))

        let wrongSchema = Data(#"{"projection":{"schema":"wrong","projectionVersion":1,"tenantId":"cambium"},"delivery":{"servedAt":"2026-11-02T00:00:00.000Z","freshness":"fresh"}}"#.utf8)
        let result2 = MissionFabricDecoder.decode(json: wrongSchema, context: context)
        guard case .failure(let err2) = result2 else { return XCTFail() }
        XCTAssertEqual(err2, .schema("wrong"))

        let projJSON = Data(#"{"projectionVersion":1,"tenantId":"other","graphVersion":1,"sourceOfTruth":"d1-goal-graph","readOnly":true,"nodes":[],"edges":[],"gaps":[]}"#.utf8)
        let digest = try MissionFabricDecoder.graphDigest(projectionJSON: projJSON)

        let tenantMismatchJSON = Data(#"{"projection":{"schema":"cambium.mission-fabric-projection.v1","projectionVersion":1,"tenantId":"other","graphVersion":1,"graphDigest":"\#(digest)","generatedAt":"2026-11-02T00:00:00.000Z","asOf":"2026-11-02T00:00:00.000Z","sourceOfTruth":"d1-goal-graph","readOnly":true,"nodes":[],"edges":[],"gaps":[]},"delivery":{"servedAt":"2026-11-02T00:00:00.000Z","freshness":"fresh"}}"#.utf8)
        let result3 = MissionFabricDecoder.decode(json: tenantMismatchJSON, context: context)
        guard case .failure(let err3) = result3 else { return XCTFail() }
        XCTAssertEqual(err3, .tenantMismatch(expected: "cambium", actual: "other"))
    }

    func testFreshnessAndFutureTimestamp() throws {
        let requested = ReaderScope(tenantId: "cambium", role: "founder")
        let projJSON = Data(#"{"projectionVersion":1,"tenantId":"cambium","graphVersion":1,"sourceOfTruth":"d1-goal-graph","readOnly":true,"nodes":[],"edges":[],"gaps":[]}"#.utf8)
        let digest = try MissionFabricDecoder.graphDigest(projectionJSON: projJSON)

        let json = Data(#"{"projection":{"schema":"cambium.mission-fabric-projection.v1","projectionVersion":1,"tenantId":"cambium","graphVersion":1,"graphDigest":"\#(digest)","generatedAt":"2026-11-02T00:00:00.000Z","asOf":"2026-11-02T00:00:00.000Z","sourceOfTruth":"d1-goal-graph","readOnly":true,"nodes":[],"edges":[],"gaps":[]},"delivery":{"servedAt":"2029-01-01T00:00:00.000Z","freshness":"fresh"}}"#.utf8)
        let context = FabricDecodeContext(requested: requested, now: Date())
        let result = MissionFabricDecoder.decode(json: json, context: context)
        guard case .failure(let err) = result else { return XCTFail() }
        XCTAssertEqual(err, .stale("servedAt is in the future"))
    }

    func testGateCoordinatorReviewAndSubmit() async throws {
        let propUrl = try XCTUnwrap(Bundle.module.url(forResource: "founder-proposal-response", withExtension: "json", subdirectory: "Fixtures"))
        let propData = try Data(contentsOf: propUrl)
        guard let jsonObj = try JSONSerialization.jsonObject(with: propData) as? [String: Any],
              let body = jsonObj["body"] as? [String: Any],
              let object = body as? [String: Any],
              let proposal = object["proposal"] as? [String: Any],
              let proposalIdWire = proposal["proposalId"] as? String,
              let tenantId = proposal["tenantId"] as? String,
              let version = proposal["version"] as? Int,
              let changeDigest = proposal["changeDigest"] as? String,
              let nonce = proposal["nonce"] as? String,
              let expiresAt = proposal["expiresAt"] as? String,
              let summary = proposal["summary"] as? String,
              let review = proposal["review"] as? [String: Any],
              let approve = object["approveConfirmation"] as? String,
              let reject = object["rejectConfirmation"] as? String,
              let reviewValue = try? JSONValue.from(foundation: review) else {
            return XCTFail("fixture parse failed")
        }
        let reviewJSON = reviewValue.canonical()
        let tuple = GateReviewTuple(
            proposalId: proposalIdWire, tenantId: tenantId, version: version, changeDigest: changeDigest,
            nonce: nonce, expiresAt: expiresAt, summary: summary, reviewJSON: reviewJSON,
            approveConfirmation: approve, rejectConfirmation: reject
        )

        let client = MockGateClient(tuple: tuple)
        let session = StaticSessionProvider(session: .verified(founderId: "founder-1", tenantId: "cambium", expiresAt: Date().addingTimeInterval(3600)))
        let clock = TestClock(date: Date())
        let store = InMemoryRecoveryStore()

        let coordinator = FounderGateCoordinator(client: client, session: session, clock: clock, store: store)
        let reviewObj = try await coordinator.review(proposalId: proposalIdWire, tenantId: tenantId)
        XCTAssertEqual(reviewObj.tuple.proposalId, proposalIdWire)

        let outcome = try await coordinator.submit(review: reviewObj, choice: .approved, typedConfirmation: approve)
        XCTAssertEqual(outcome.state, GateState.recorded)
        XCTAssertEqual(outcome.record.receipt?.decision, .approved)
    }

    func testLaunchCoordinatorPersistenceAndRestartRecovery() async throws {
        let capability = LaunchCapability(
            tenantId: "cambium", principal: "founder-1", workId: "sapling:cambium",
            admissionRef: "adm-1", graphVersion: 1, loadoutId: "l1",
            inputDigest: "sha256:def", executionPlant: .hands,
            supportedAction: "execute-plan", expiresAt: "2030-01-01T00:00:00.000Z"
        )
        let client = MockLaunchClient()
        let session = StaticSessionProvider(session: .verified(founderId: "founder-1", tenantId: "cambium", expiresAt: Date().addingTimeInterval(3600)))
        let clock = TestClock(date: Date())
        let store = InMemoryRecoveryStore()

        let coordinator = LaunchCoordinator(client: client, session: session, clock: clock, store: store)
        let outcome = try await coordinator.launch(capability: capability, idempotencyNonce: "nonce-99")
        XCTAssertEqual(outcome.state, LaunchState.queued)
        XCTAssertFalse(outcome.record.requestId.isEmpty)

        let outcome2 = try await coordinator.launch(capability: capability, idempotencyNonce: "nonce-99")
        XCTAssertEqual(outcome2.state, LaunchState.queued)
        XCTAssertEqual(outcome2.record.requestId, outcome.record.requestId)

        let pending = try await coordinator.pendingRecoveries()
        XCTAssertEqual(pending.count, 1)

        let recovered = try await coordinator.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-99")
        XCTAssertEqual(recovered.state, LaunchState.complete)
        XCTAssertEqual(recovered.record.verdict, SemanticVerdict.pass)
    }
}

// MARK: - Test doubles

final class MockGateClient: FounderGateClient, @unchecked Sendable {
    let tuple: GateReviewTuple
    var decideCount = 0

    init(tuple: GateReviewTuple) {
        self.tuple = tuple
    }

    func proposal(proposalId: String) async throws -> GateReviewTuple {
        guard proposalId == tuple.proposalId else { throw GateError.refused("not_found") }
        return tuple
    }

    func decide(_ tuple: GateReviewTuple, decision: FounderDecisionChoice, confirmation: String) async throws -> GateDecisionWire {
        decideCount += 1
        let receipt = GateReceipt(
            proposalId: tuple.proposalId, version: tuple.version, changeDigest: tuple.changeDigest,
            tenantId: tuple.tenantId, founderId: "founder-1", nonce: tuple.nonce,
            expiresAt: tuple.expiresAt, decision: decision, decidedAt: "2026-11-02T00:00:00.000Z",
            channel: "curious"
        )
        return GateDecisionWire(
            status: decision == .approved ? .approved : .rejected,
            receipt: receipt, receiptDigest: "sha256:receipt", canonicalReadback: true
        )
    }

    func status(_ tuple: GateReviewTuple, decision: FounderDecisionChoice, confirmation: String) async throws -> GateDecisionWire {
        return try await decide(tuple, decision: decision, confirmation: confirmation)
    }

    func renew(_ tuple: GateReviewTuple) async throws -> RenewalWire {
        return RenewalWire(status: "renewed", proposalId: tuple.proposalId)
    }
}

final class MockLaunchClient: LaunchClient, @unchecked Sendable {
    func capability(workId: String, tenantId: String) async throws -> LaunchCapability {
        return LaunchCapability(
            tenantId: tenantId, principal: "founder-1", workId: workId,
            admissionRef: "adm-1", graphVersion: 1, loadoutId: "l1",
            inputDigest: "sha256:def", executionPlant: .hands,
            supportedAction: "execute-plan", expiresAt: "2030-01-01T00:00:00.000Z"
        )
    }

    func requestLaunch(capability: LaunchCapability, requestId: String, attemptId: String, idempotencyNonce: String) async throws -> LaunchRequestWire {
        return LaunchRequestWire(
            requestId: requestId, attemptId: attemptId,
            status: .queued, assignedRunId: "run-1", detail: "Queued on hands"
        )
    }

    func attemptStatus(requestId: String, attemptId: String, tenantId: String) async throws -> AttemptStatusResult {
        return AttemptStatusResult(
            requestId: requestId, attemptId: attemptId, status: .complete,
            runId: "run-1", artifactRef: "artifacts/run-1.json",
            receiptRef: "receipts/run-1.json", verdict: .pass
        )
    }
}

struct StaticSessionProvider: SessionProvider {
    let session: NativeSession
    func currentSession() async -> NativeSession { session }
}

struct TestClock: CoreClock {
    let date: Date
    func now() -> Date { date }
}
