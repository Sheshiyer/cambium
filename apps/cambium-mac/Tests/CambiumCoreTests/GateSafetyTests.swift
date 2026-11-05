import Foundation
import XCTest
@testable import CambiumCore

final class GateSafetyTests: XCTestCase {

    // MARK: - Fixtures

    private static let fixtureNow = "2026-07-28T09:05:00.000Z"
    private static let expiry = "2026-07-28T10:00:00.000Z"

    /// Builds the review tuple through the real HTTP adapter from the TypeScript fixture.
    private func fixtureTuple(mutate: ((inout [String: Any]) -> Void)? = nil) async throws -> GateReviewTuple {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "founder-proposal-response", withExtension: "json", subdirectory: "Fixtures"))
        let envelope = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        var body = try XCTUnwrap(envelope["body"] as? [String: Any])
        mutate?(&body)
        let data = try JSONSerialization.data(withJSONObject: body)
        let client = HTTPFounderGateClient(
            baseURL: URL(string: "https://gate.test")!,
            transport: StubTransport(body: data),
            authorizer: NoAuthorizer()
        )
        return try await client.proposal(proposalId: "cambium:sha256:8308316077022b85aa6e8961285751942d441b3d5129953dfebaaf13c1b05847")
    }

    private func founderSession(_ founder: String) -> NativeSession {
        .verified(founderId: founder, tenantId: "cambium", expiresAt: Self.date("2026-07-28T10:05:00.000Z"))
    }

    private static func date(_ text: String) -> Date {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: text) ?? Date(timeIntervalSince1970: 0)
    }

    private func receipt(for tuple: GateReviewTuple, decision: FounderDecisionChoice, founder: String = "founder-1") -> GateReceipt {
        GateReceipt(
            proposalId: tuple.proposalId, version: tuple.version, changeDigest: tuple.changeDigest,
            tenantId: tuple.tenantId, founderId: founder, nonce: tuple.nonce, expiresAt: tuple.expiresAt,
            decision: decision, decidedAt: Self.fixtureNow, channel: "curious"
        )
    }

    private func approved(_ tuple: GateReviewTuple, decision: FounderDecisionChoice = .approved, founder: String = "founder-1",
                          canonicalReadback: Bool = true) -> GateDecisionWire {
        GateDecisionWire(
            status: decision == .approved ? .approved : .rejected,
            receipt: receipt(for: tuple, decision: decision, founder: founder),
            receiptDigest: "sha256:receipt", canonicalReadback: canonicalReadback
        )
    }

    private func makeCoordinator(
        client: SafetyGateClient, session: SwitchableSession, clock: MovableClock, store: SafetyStore
    ) -> FounderGateCoordinator {
        FounderGateCoordinator(client: client, session: session, clock: clock, store: store)
    }

    private func waitUntilLoadEntered(_ store: SafetyStore) async {
        for _ in 0..<100_000 {
            if await store.loadCount >= 1 { return }
            await Task.yield()
        }
        XCTFail("load never entered")
    }

    // MARK: - In-flight reservation

    func testConcurrentSubmitIsBlockedDuringAwaitedLoad() async throws {
        let tuple = try await fixtureTuple()
        let client = SafetyGateClient(tuple: tuple)
        await client.setDecision(approved(tuple))
        let store = SafetyStore()
        await store.setHoldLoads(true)
        let session = SwitchableSession(founderSession("founder-1"))
        let clock = MovableClock(Self.date(Self.fixtureNow))
        let coordinator = makeCoordinator(client: client, session: session, clock: clock, store: store)
        let review = try await coordinator.review(proposalId: tuple.proposalId, tenantId: "cambium")
        let confirmation = review.tuple.approveConfirmation

        let first = Task { try await coordinator.submit(review: review, choice: .approved, typedConfirmation: confirmation) }
        await waitUntilLoadEntered(store)

        do {
            _ = try await coordinator.submit(review: review, choice: .approved, typedConfirmation: confirmation)
            XCTFail("second concurrent submit must not pass the reservation")
        } catch GateError.concurrentExecution {
        }

        await store.releaseLoads()
        let outcome = try await first.value
        XCTAssertEqual(outcome.state, .recorded)
        let decideCount = await client.decideCount
        XCTAssertEqual(decideCount, 1)
    }

    // MARK: - Founder pinning

    func testSubmitByDifferentFounderInSameTenantIsRefusedBeforeAnyWrite() async throws {
        let tuple = try await fixtureTuple()
        let client = SafetyGateClient(tuple: tuple)
        let store = SafetyStore()
        let session = SwitchableSession(founderSession("founder-1"))
        let clock = MovableClock(Self.date(Self.fixtureNow))
        let coordinator = makeCoordinator(client: client, session: session, clock: clock, store: store)
        let review = try await coordinator.review(proposalId: tuple.proposalId, tenantId: "cambium")

        await session.set(founderSession("founder-2"))
        do {
            _ = try await coordinator.submit(review: review, choice: .approved, typedConfirmation: review.tuple.approveConfirmation)
            XCTFail("founder-2 must not submit founder-1's review")
        } catch GateError.principalMismatch {
        }
        do {
            _ = try await coordinator.renew(review: review)
            XCTFail("founder-2 must not renew founder-1's review")
        } catch GateError.principalMismatch {
        }
        let decideCount = await client.decideCount
        let renewCount = await client.renewCount
        XCTAssertEqual(decideCount, 0)
        XCTAssertEqual(renewCount, 0)
        let saved = await store.saveCount
        XCTAssertEqual(saved, 0)
    }

    func testFounderSwitchDuringAwaitedDecisionReturnsNoOutcomeAndLeaksNoRecord() async throws {
        let tuple = try await fixtureTuple()
        let client = SafetyGateClient(tuple: tuple)
        await client.setDecision(approved(tuple))
        let store = SafetyStore()
        let session = SwitchableSession(founderSession("founder-1"))
        let clock = MovableClock(Self.date(Self.fixtureNow))
        let coordinator = makeCoordinator(client: client, session: session, clock: clock, store: store)
        let review = try await coordinator.review(proposalId: tuple.proposalId, tenantId: "cambium")
        let sessionCapture = session
        let switched = founderSession("founder-2")
        await client.onDecide { await sessionCapture.set(switched) }

        do {
            _ = try await coordinator.submit(review: review, choice: .approved, typedConfirmation: review.tuple.approveConfirmation)
            XCTFail("switched founder must not receive the outcome")
        } catch GateError.principalMismatch {
        }

        // Founder-1's own record is persisted; founder-2 cannot see or recover it.
        let stored = await store.recordCount
        XCTAssertEqual(stored, 1)
        let otherPending = try await coordinator.pendingRecoveries()
        XCTAssertEqual(otherPending, [])
        do {
            _ = try await coordinator.recover(tuple: tuple)
            XCTFail("founder-2 must not recover founder-1's record")
        } catch GateError.recoveryUnavailable {
        }
    }

    // MARK: - Compact record, restart recovery

    func testRecordAfterUnknownOutcomeHoldsNoProseAndRecoversAfterRestart() async throws {
        let tuple = try await fixtureTuple()
        let store = SafetyStore()
        let session = SwitchableSession(founderSession("founder-1"))
        let clock = MovableClock(Self.date(Self.fixtureNow))

        let firstClient = SafetyGateClient(tuple: tuple)
        await firstClient.setDecideError(TransportFailure.timeout)
        let first = makeCoordinator(client: firstClient, session: session, clock: clock, store: store)
        let review = try await first.review(proposalId: tuple.proposalId, tenantId: "cambium")
        let outcome = try await first.submit(review: review, choice: .approved, typedConfirmation: review.tuple.approveConfirmation)
        XCTAssertEqual(outcome.state, .outcomeUnknown)

        let raw = await store.onlyValue()
        let unwrapped = try XCTUnwrap(raw)
        let text = try XCTUnwrap(String(data: unwrapped, encoding: .utf8))
        XCTAssertFalse(text.contains("Add task-new"))
        XCTAssertFalse(text.contains("Consequence"))
        XCTAssertFalse(text.contains("approved proposal"))
        XCTAssertFalse(text.contains("review sha256"))
        let keys = try XCTUnwrap(JSONSerialization.jsonObject(with: unwrapped) as? [String: Any]).keys
        XCTAssertFalse(keys.contains("summary"))
        XCTAssertFalse(keys.contains("confirmation"))
        XCTAssertFalse(keys.contains("review"))
        XCTAssertLessThanOrEqual(unwrapped.count, FounderGateCoordinator.maxRecordBytes)

        // Restart: a fresh coordinator and client, no saved review.
        let restartClient = SafetyGateClient(tuple: tuple)
        await restartClient.setStatus(approved(tuple))
        let restarted = makeCoordinator(client: restartClient, session: session, clock: clock, store: store)
        let pending = try await restarted.pendingRecoveries()
        XCTAssertEqual(pending.count, 1)
        let record = try XCTUnwrap(pending.first)

        let recovered = try await restarted.recover(record: record)
        XCTAssertEqual(recovered.state, .recorded)
        let statusTuple = await restartClient.lastStatusTuple
        let statusConfirmation = await restartClient.lastStatusConfirmation
        XCTAssertEqual(statusTuple?.summary, "")
        XCTAssertEqual(statusTuple?.reviewJSON, "")
        XCTAssertEqual(statusConfirmation, "")
        let decideCount = await restartClient.decideCount
        XCTAssertEqual(decideCount, 0)
    }

    func testRecoverByTupleOverloadStillWorks() async throws {
        let tuple = try await fixtureTuple()
        let store = SafetyStore()
        let session = SwitchableSession(founderSession("founder-1"))
        let clock = MovableClock(Self.date(Self.fixtureNow))
        let client = SafetyGateClient(tuple: tuple)
        await client.setDecideError(TransportFailure.timeout)
        await client.setStatus(approved(tuple))
        let coordinator = makeCoordinator(client: client, session: session, clock: clock, store: store)
        let review = try await coordinator.review(proposalId: tuple.proposalId, tenantId: "cambium")
        _ = try await coordinator.submit(review: review, choice: .approved, typedConfirmation: review.tuple.approveConfirmation)

        let recovered = try await coordinator.recover(tuple: tuple)
        XCTAssertEqual(recovered.state, .recorded)
    }

    // MARK: - Receipts

    func testMismatchedOrMaliciousReceiptsResolveToConflict() async throws {
        let tuple = try await fixtureTuple()
        var wrongDigest = receipt(for: tuple, decision: .approved)
        wrongDigest.changeDigest = "sha256:" + String(repeating: "f", count: 64)
        let cases: [(String, GateDecisionWire)] = [
            ("wrong digest", GateDecisionWire(status: .approved, receipt: wrongDigest, receiptDigest: "sha256:r", canonicalReadback: true)),
            ("other founder", approved(tuple, founder: "founder-2")),
            ("no readback", approved(tuple, canonicalReadback: false)),
            ("wrong decision", approved(tuple, decision: .rejected)),
            ("missing receipt", GateDecisionWire(status: .approved, receipt: nil, receiptDigest: nil, canonicalReadback: true)),
        ]
        for (name, wire) in cases {
            let store = SafetyStore()
            let client = SafetyGateClient(tuple: tuple)
            await client.setDecision(wire)
            let coordinator = makeCoordinator(
                client: client, session: SwitchableSession(founderSession("founder-1")),
                clock: MovableClock(Self.date(Self.fixtureNow)), store: store
            )
            let review = try await coordinator.review(proposalId: tuple.proposalId, tenantId: "cambium")
            let outcome = try await coordinator.submit(review: review, choice: .approved, typedConfirmation: review.tuple.approveConfirmation)
            XCTAssertEqual(outcome.state, .conflict, name)
            XCTAssertNil(outcome.record.receipt, name)
        }
    }

    // MARK: - Corrupt and conflicting evidence

    func testCorruptRecordStaysClosedAndIsNotOverwritten() async throws {
        let tuple = try await fixtureTuple()
        let store = SafetyStore()
        let key = FounderGateCoordinator.key(tenantId: "cambium", principal: "founder-1", proposalId: tuple.proposalId, version: 1, nonce: tuple.nonce)
        let corrupt = Data("{\"state\":\"recorded\", garbage".utf8)
        await store.seed(corrupt, key: key)
        let client = SafetyGateClient(tuple: tuple)
        let coordinator = makeCoordinator(
            client: client, session: SwitchableSession(founderSession("founder-1")),
            clock: MovableClock(Self.date(Self.fixtureNow)), store: store
        )
        let review = try await coordinator.review(proposalId: tuple.proposalId, tenantId: "cambium")

        let outcome = try await coordinator.submit(review: review, choice: .approved, typedConfirmation: review.tuple.approveConfirmation)
        XCTAssertEqual(outcome.state, .conflict)
        let stored = await store.value(key)
        XCTAssertEqual(stored, corrupt)
        let decideCount = await client.decideCount
        XCTAssertEqual(decideCount, 0)
    }

    func testRecordWithMismatchedIdentityIsNotRecovered() async throws {
        let tuple = try await fixtureTuple()
        let store = SafetyStore()
        let key = FounderGateCoordinator.key(tenantId: "cambium", principal: "founder-1", proposalId: tuple.proposalId, version: 1, nonce: tuple.nonce)
        var record = FounderGateCoordinator.record(
            GateAttemptIdentity(tenantId: "cambium", principal: "founder-1", proposalId: tuple.proposalId, version: 1,
                                changeDigest: tuple.changeDigest, nonce: "other-nonce", expiresAt: tuple.expiresAt),
            choice: .approved, state: .outcomeUnknown, now: Self.date(Self.fixtureNow)
        )
        record.updatedAt = Self.fixtureNow
        await store.seed(try JSONEncoder().encode(record), key: key)
        let coordinator = makeCoordinator(
            client: SafetyGateClient(tuple: tuple), session: SwitchableSession(founderSession("founder-1")),
            clock: MovableClock(Self.date(Self.fixtureNow)), store: store
        )
        do {
            _ = try await coordinator.recover(tuple: tuple)
            XCTFail("mismatched record must not be recovered")
        } catch GateError.recoveryUnavailable {
        }
    }

    // MARK: - Expiry and uncertain status

    func testExpiredReviewCannotBeSubmitted() async throws {
        let tuple = try await fixtureTuple()
        let store = SafetyStore()
        let client = SafetyGateClient(tuple: tuple)
        let clock = MovableClock(Self.date(Self.fixtureNow))
        let coordinator = makeCoordinator(
            client: client, session: SwitchableSession(founderSession("founder-1")), clock: clock, store: store
        )
        let review = try await coordinator.review(proposalId: tuple.proposalId, tenantId: "cambium")
        clock.set(Self.date("2026-07-28T10:00:00.000Z"))
        do {
            _ = try await coordinator.submit(review: review, choice: .approved, typedConfirmation: review.tuple.approveConfirmation)
            XCTFail("expired review must not submit")
        } catch GateError.expired {
        }
        let decideCount = await client.decideCount
        XCTAssertEqual(decideCount, 0)
    }

    func testPendingStatusPastExpiryRecoversAsExpired() async throws {
        let tuple = try await fixtureTuple()
        let store = SafetyStore()
        let session = SwitchableSession(founderSession("founder-1"))
        let clock = MovableClock(Self.date(Self.fixtureNow))
        let client = SafetyGateClient(tuple: tuple)
        await client.setDecideError(TransportFailure.timeout)
        await client.setStatus(GateDecisionWire(status: .pending, receipt: nil, receiptDigest: nil, canonicalReadback: true))
        let coordinator = makeCoordinator(client: client, session: session, clock: clock, store: store)
        let review = try await coordinator.review(proposalId: tuple.proposalId, tenantId: "cambium")
        _ = try await coordinator.submit(review: review, choice: .approved, typedConfirmation: review.tuple.approveConfirmation)

        clock.set(Self.date("2026-07-28T10:01:00.000Z"))
        let recovered = try await coordinator.recover(tuple: tuple)
        XCTAssertEqual(recovered.state, .expired)
    }

    func testUncertainStatusStaysOutcomeUnknownAndSubmitStaysBlocked() async throws {
        let tuple = try await fixtureTuple()
        let store = SafetyStore()
        let session = SwitchableSession(founderSession("founder-1"))
        let clock = MovableClock(Self.date(Self.fixtureNow))
        let client = SafetyGateClient(tuple: tuple)
        await client.setDecideError(TransportFailure.timeout)
        await client.setStatusError(TransportFailure.unreachable)
        let coordinator = makeCoordinator(client: client, session: session, clock: clock, store: store)
        let review = try await coordinator.review(proposalId: tuple.proposalId, tenantId: "cambium")
        _ = try await coordinator.submit(review: review, choice: .approved, typedConfirmation: review.tuple.approveConfirmation)

        let recovered = try await coordinator.recover(tuple: tuple)
        XCTAssertEqual(recovered.state, .outcomeUnknown)
        do {
            _ = try await coordinator.submit(review: review, choice: .approved, typedConfirmation: review.tuple.approveConfirmation)
            XCTFail("unresolved attempt must not write again")
        } catch GateError.unresolvedAttempt {
        }
        let decideCount = await client.decideCount
        XCTAssertEqual(decideCount, 1)
    }

    // MARK: - Persistence failure after an owner write

    func testPersistenceFailureAfterWriteSurfacesUnknownAndBlocksSecondWrite() async throws {
        let tuple = try await fixtureTuple()
        let store = SafetyStore()
        await store.setFailSavesFrom(2)
        let client = SafetyGateClient(tuple: tuple)
        await client.setDecision(approved(tuple))
        let coordinator = makeCoordinator(
            client: client, session: SwitchableSession(founderSession("founder-1")),
            clock: MovableClock(Self.date(Self.fixtureNow)), store: store
        )
        let review = try await coordinator.review(proposalId: tuple.proposalId, tenantId: "cambium")

        let outcome = try await coordinator.submit(review: review, choice: .approved, typedConfirmation: review.tuple.approveConfirmation)
        XCTAssertEqual(outcome.state, .outcomeUnknown)
        XCTAssertNil(outcome.record.receipt)

        await store.setFailSavesFrom(nil)
        do {
            _ = try await coordinator.submit(review: review, choice: .approved, typedConfirmation: review.tuple.approveConfirmation)
            XCTFail("a lost save must not enable another write")
        } catch GateError.unresolvedAttempt {
        }
        let decideCount = await client.decideCount
        XCTAssertEqual(decideCount, 1)
    }

    // MARK: - Renewal pinning

    func testRenewRefusedWhenSessionSwitchesBeforeWire() async throws {
        let tuple = try await fixtureTuple()
        let client = SafetyGateClient(tuple: tuple)
        let session = SwitchableSession(founderSession("founder-1"))
        let coordinator = makeCoordinator(
            client: client, session: session, clock: MovableClock(Self.date(Self.fixtureNow)), store: SafetyStore()
        )
        let review = try await coordinator.review(proposalId: tuple.proposalId, tenantId: "cambium")
        await session.set(founderSession("founder-2"))
        do {
            _ = try await coordinator.renew(review: review)
            XCTFail("renew must be refused for a different founder")
        } catch GateError.principalMismatch {
        }
        let renewCount = await client.renewCount
        XCTAssertEqual(renewCount, 0)
    }

    // MARK: - Key encoding

    func testScopeKeysDoNotAliasAcrossDelimiters() {
        let a = FounderGateCoordinator.key(tenantId: "a:b", principal: "c", proposalId: "p", version: 1, nonce: "n")
        let b = FounderGateCoordinator.key(tenantId: "a", principal: "b:c", proposalId: "p", version: 1, nonce: "n")
        XCTAssertNotEqual(a, b)
        let c = FounderGateCoordinator.key(tenantId: "cambium", principal: "f", proposalId: "x:1", version: 1, nonce: "n")
        let d = FounderGateCoordinator.key(tenantId: "cambium", principal: "f", proposalId: "x", version: 1, nonce: "1:n")
        XCTAssertNotEqual(c, d)
        XCTAssertTrue(a.hasPrefix(FounderGateCoordinator.prefix(tenantId: "a:b", principal: "c")))
        XCTAssertFalse(a.hasPrefix(FounderGateCoordinator.prefix(tenantId: "a", principal: "b")))
    }

    // MARK: - Canonical confirmation

    func testConfirmationMatchesTypeScriptVector() async throws {
        let tuple = try await fixtureTuple()
        XCTAssertEqual(FounderGateCoordinator.computeConfirmation(tuple: tuple, decision: .approved), tuple.approveConfirmation)
        XCTAssertEqual(FounderGateCoordinator.computeConfirmation(tuple: tuple, decision: .rejected), tuple.rejectConfirmation)
        XCTAssertEqual(try FounderGateCoordinator.confirmation(tuple: tuple, decision: .approved), tuple.approveConfirmation)
    }

    func testCanonicalReviewHashIgnoresRawWhitespaceAndMatchesSourceForNumbersAndEscapes() throws {
        // Expected hash is founderConfirmation() from founder-decision.ts run under node on this exact review.
        let rawReview = #"{ "z": 1, "a": [0.5, 1e21, 1.5e-7, 123456789012345680000, 0, -3, true, null, "q\"\\\n\t\u0001é\u2028😀"], "b": {"y": 0.1, "x": 100} }"#
        let tuple = GateReviewTuple(
            proposalId: "cambium:sha256:" + String(repeating: "a", count: 64), tenantId: "cambium",
            version: 2, changeDigest: "sha256:" + String(repeating: "a", count: 64), nonce: "n",
            expiresAt: Self.expiry, summary: "S", reviewJSON: rawReview,
            approveConfirmation: "", rejectConfirmation: ""
        )
        let expected = "approved proposal cambium:sha256:" + String(repeating: "a", count: 64)
            + " version 2 digest sha256:" + String(repeating: "a", count: 64)
            + " expires 2026-07-28T10:00:00.000Z: S review sha256:00b71a919d3ed4cd7ffa0a7557dd8c3815d2ad0b36bf6569c52d2c11e0cc7eed"
        XCTAssertEqual(FounderGateCoordinator.computeConfirmation(tuple: tuple, decision: .approved), expected)
    }

    func testNumberFormattingMatchesEcmaScript() {
        XCTAssertEqual(GateJSON.jsNumber(0), "0")
        XCTAssertEqual(GateJSON.jsNumber(-3), "-3")
        XCTAssertEqual(GateJSON.jsNumber(100), "100")
        XCTAssertEqual(GateJSON.jsNumber(0.1), "0.1")
        XCTAssertEqual(GateJSON.jsNumber(1e21), "1e+21")
        XCTAssertEqual(GateJSON.jsNumber(1.5e-7), "1.5e-7")
        XCTAssertEqual(GateJSON.jsNumber(123456789012345680000), "123456789012345680000")
    }

    // MARK: - Full changeSet consistency

    func testReviewWithTamperedChangeSetIsRejected() async throws {
        do {
            let tampered = try await fixtureTuple { body in
                var proposal = body["proposal"] as! [String: Any]
                var review = proposal["review"] as! [String: Any]
                var changeSet = review["changeSet"] as! [String: Any]
                changeSet["nodesToCreate"] = [["nodeId": "gg-evil", "externalId": "evil", "desiredState": "x"]]
                review["changeSet"] = changeSet
                proposal["review"] = review
                body["proposal"] = proposal
            }
            try FounderGateCoordinator.validate(tampered, proposalId: tampered.proposalId, tenantId: "cambium", now: Self.date(Self.fixtureNow))
            XCTFail("tampered changeSet must not pass review")
        } catch GateError.incompleteTuple(let field) {
            XCTAssertTrue(field.hasPrefix("changeSet"), field)
        }
    }

    func testReviewWithTenantMismatchInChangeSetIsRejected() async throws {
        do {
            let tampered = try await fixtureTuple { body in
                var proposal = body["proposal"] as! [String: Any]
                var review = proposal["review"] as! [String: Any]
                var changeSet = review["changeSet"] as! [String: Any]
                changeSet["tenantId"] = "other"
                review["changeSet"] = changeSet
                proposal["review"] = review
                body["proposal"] = proposal
            }
            try FounderGateCoordinator.validate(tampered, proposalId: tampered.proposalId, tenantId: "cambium", now: Self.date(Self.fixtureNow))
            XCTFail("cross-tenant changeSet must not pass review")
        } catch GateError.tenantMismatch {
        }
    }
}

// MARK: - Test doubles

private struct StubTransport: HTTPTransport {
    let body: Data
    func send(_ request: HTTPRequest) async throws -> HTTPResponse {
        HTTPResponse(status: 200, body: body)
    }
}

private actor SwitchableSession: SessionProvider {
    private var session: NativeSession
    init(_ session: NativeSession) { self.session = session }
    func set(_ session: NativeSession) { self.session = session }
    func currentSession() async -> NativeSession { session }
}

private final class MovableClock: CoreClock, @unchecked Sendable {
    private var date: Date
    init(_ date: Date) { self.date = date }
    func set(_ date: Date) { self.date = date }
    func now() -> Date { date }
}

private actor SafetyStore: RecoveryStore {
    private var values: [String: Data] = [:]
    private var holdLoads = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    private var failSavesFrom: Int?
    private(set) var saveCount = 0
    private(set) var loadCount = 0

    var recordCount: Int { values.count }

    func setHoldLoads(_ value: Bool) { holdLoads = value }
    func setFailSavesFrom(_ value: Int?) { failSavesFrom = value }
    func seed(_ data: Data, key: String) { values[key] = data }
    func value(_ key: String) -> Data? { values[key] }
    func onlyValue() -> Data? { values.count == 1 ? values.values.first : nil }

    func releaseLoads() {
        holdLoads = false
        let pending = waiters
        waiters = []
        pending.forEach { $0.resume() }
    }

    func save(_ data: Data, key: String) async throws {
        saveCount += 1
        if let failSavesFrom, saveCount >= failSavesFrom { throw TransportFailure.unreachable }
        values[key] = data
    }

    func load(key: String) async throws -> Data? {
        loadCount += 1
        if holdLoads {
            await withCheckedContinuation { waiters.append($0) }
        }
        return values[key]
    }

    func remove(key: String) async throws { values[key] = nil }

    func keys(prefix: String) async throws -> [String] {
        values.keys.filter { $0.hasPrefix(prefix) }.sorted()
    }
}

private actor SafetyGateClient: FounderGateClient {
    let tuple: GateReviewTuple
    private(set) var decideCount = 0
    private(set) var renewCount = 0
    private(set) var lastStatusTuple: GateReviewTuple?
    private(set) var lastStatusConfirmation: String?
    private var decision: GateDecisionWire?
    private var decideError: Error?
    private var status: GateDecisionWire?
    private var statusError: Error?
    private var onDecideHook: (@Sendable () async -> Void)?

    init(tuple: GateReviewTuple) { self.tuple = tuple }

    func setDecision(_ wire: GateDecisionWire) { decision = wire }
    func setDecideError(_ error: Error) { decideError = error }
    func setStatus(_ wire: GateDecisionWire) { status = wire }
    func setStatusError(_ error: Error) { statusError = error }
    func onDecide(_ hook: @escaping @Sendable () async -> Void) { onDecideHook = hook }

    func proposal(proposalId: String) async throws -> GateReviewTuple { tuple }

    func decide(_ tuple: GateReviewTuple, decision choice: FounderDecisionChoice, confirmation: String) async throws -> GateDecisionWire {
        decideCount += 1
        if let onDecideHook { await onDecideHook() }
        if let decideError { throw decideError }
        return decision ?? GateDecisionWire(
            status: choice == .approved ? .approved : .rejected,
            receipt: GateReceipt(
                proposalId: tuple.proposalId, version: tuple.version, changeDigest: tuple.changeDigest,
                tenantId: tuple.tenantId, founderId: "founder-1", nonce: tuple.nonce, expiresAt: tuple.expiresAt,
                decision: choice, decidedAt: "2026-07-28T09:05:00.000Z", channel: "curious"
            ),
            receiptDigest: "sha256:receipt", canonicalReadback: true
        )
    }

    func status(_ tuple: GateReviewTuple, decision choice: FounderDecisionChoice, confirmation: String) async throws -> GateDecisionWire {
        lastStatusTuple = tuple
        lastStatusConfirmation = confirmation
        if let statusError { throw statusError }
        return status ?? GateDecisionWire(status: .unknown, receipt: nil, receiptDigest: nil, canonicalReadback: false)
    }

    func renew(_ tuple: GateReviewTuple) async throws -> RenewalWire {
        renewCount += 1
        return RenewalWire(status: "renewed", proposalId: tuple.proposalId)
    }
}
