import Foundation
import XCTest
@testable import CambiumCore

/// Proves the stuck-launch window: a first send that reserves nothing (401, or a
/// lost response whose status is `not_found`) may be resent as the exact original
/// request. Anything less certain stays held, and a second attempt is never created.
final class LaunchLivenessTests: XCTestCase {

    private func coordinator(
        client: any LaunchClient, store: any RecoveryStore,
        session: any SessionProvider = MutableSession(LaunchFixtures.session()),
        clock: any CoreClock = TestClock(date: LaunchFixtures.now)
    ) -> LaunchCoordinator {
        LaunchCoordinator(client: client, session: session, clock: clock, store: store)
    }

    /// First launch throws `unauthorized` (the 401 after session expiry on the wire).
    /// Status then answers `not_found` for those exact IDs. A later launch of the same
    /// capability and nonce resends that original and nothing else.
    func testUnauthorizedSendThenNotFoundAllowsExactOriginalResend() async throws {
        let store = InMemoryRecoveryStore()
        let client = LivenessLaunchClient(launch: .unauthorized, status: .notFound)
        let launcher = coordinator(client: client, store: store)
        let capability = LaunchFixtures.capability()

        let failed = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-one")
        XCTAssertEqual(failed.state, .transmissionFailed)
        let originalRequest = failed.record.requestId
        let originalAttempt = failed.record.attemptId
        XCTAssertNotEqual(originalRequest, originalAttempt)
        XCTAssertNil(failed.record.ownerAbsent)

        let held = try await launcher.recover(workId: capability.workId, idempotencyNonce: "nonce-one")
        XCTAssertEqual(held.state, .transmissionFailed)
        XCTAssertEqual(held.record.detail, "not_found")
        XCTAssertEqual(held.record.ownerAbsent, true)
        XCTAssertEqual(held.record.requestId, originalRequest)
        XCTAssertEqual(held.record.attemptId, originalAttempt)
        XCTAssertEqual(held.record.idempotencyNonce, "nonce-one")
        XCTAssertEqual(held.record.capability, capability)

        // Same nonce before the proof would have returned the record. After the proof
        // it is the only permitted send, and it carries the persisted tuple.
        await client.setLaunch(.queued)
        let resent = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-one")
        XCTAssertEqual(resent.state, .queued)
        XCTAssertEqual(resent.record.requestId, originalRequest)
        XCTAssertEqual(resent.record.attemptId, originalAttempt)
        XCTAssertEqual(resent.record.idempotencyNonce, "nonce-one")
        XCTAssertNil(resent.record.ownerAbsent)

        let sent = await client.sentRecords()
        XCTAssertEqual(sent.count, 2)
        XCTAssertEqual(sent.map(\.requestId), [originalRequest, originalRequest])
        XCTAssertEqual(sent.map(\.attemptId), [originalAttempt, originalAttempt])
        XCTAssertEqual(sent.map(\.nonce), ["nonce-one", "nonce-one"])
        XCTAssertEqual(sent.map(\.tuple), [LaunchCoordinator.pinned(capability), LaunchCoordinator.pinned(capability)])

        // The reservation now exists. A further same-nonce call does not send again.
        let parked = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-one")
        XCTAssertEqual(parked.record.requestId, originalRequest)
        let sentNow = await client.sentCount()
        XCTAssertEqual(sentNow, 2)

        do {
            _ = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-two")
            XCTFail("expected unresolvedAttempt")
        } catch {
            XCTAssertEqual(error as? LaunchError, .unresolvedAttempt)
        }
        let blockedSends = await client.sentCount()
        XCTAssertEqual(blockedSends, 2)
    }

    func testLostResponseWithUnknownStatusStaysHeldAndDoesNotResend() async throws {
        let client = LivenessLaunchClient(launch: .lost, status: .unavailable)
        let launcher = coordinator(client: client, store: InMemoryRecoveryStore())
        let capability = LaunchFixtures.capability()

        let failed = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-one")
        XCTAssertEqual(failed.state, .transmissionFailed)

        let held = try await launcher.recover(workId: capability.workId, idempotencyNonce: "nonce-one")
        XCTAssertEqual(held.state, .outcomeUnknown)
        XCTAssertNotEqual(held.record.ownerAbsent, true)
        XCTAssertEqual(held.record.requestId, failed.record.requestId)

        let again = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-one")
        XCTAssertEqual(again.state, .outcomeUnknown)
        XCTAssertEqual(again.record.requestId, failed.record.requestId)
        let heldSends = await client.sentCount()
        XCTAssertEqual(heldSends, 1, "uncertain status never resends")

        do {
            _ = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-two")
            XCTFail("expected unresolvedAttempt")
        } catch {
            XCTAssertEqual(error as? LaunchError, .unresolvedAttempt)
        }
        let sends = await client.sentCount()
        XCTAssertEqual(sends, 1)
    }

    func testRecordedStatusDoesNotPermitResend() async throws {
        let client = LivenessLaunchClient(launch: .lost, status: .recorded)
        let launcher = coordinator(client: client, store: InMemoryRecoveryStore())
        let capability = LaunchFixtures.capability()

        let failed = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-one")
        let recovered = try await launcher.recover(workId: capability.workId, idempotencyNonce: "nonce-one")
        XCTAssertEqual(recovered.state, .running)
        XCTAssertNotEqual(recovered.record.ownerAbsent, true)
        XCTAssertEqual(recovered.record.requestId, failed.record.requestId)
        XCTAssertEqual(recovered.record.executionState, "running")

        let again = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-one")
        XCTAssertEqual(again.state, .running)
        let sends = await client.sentCount()
        XCTAssertEqual(sends, 1)
    }

    func testExpiredCapabilityAfterNotFoundStaysHeld() async throws {
        let clock = StepClock(LaunchFixtures.now)
        var capability = LaunchFixtures.capability()
        capability.expiresAt = "2026-11-02T00:10:00.000Z"
        let client = LivenessLaunchClient(launch: .unauthorized, status: .notFound)
        let launcher = coordinator(client: client, store: InMemoryRecoveryStore(), clock: clock)

        let failed = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-one")
        let proved = try await launcher.recover(workId: capability.workId, idempotencyNonce: "nonce-one")
        XCTAssertEqual(proved.record.ownerAbsent, true)

        clock.advance(3000)
        do {
            _ = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-one")
            XCTFail("expected expired")
        } catch {
            XCTAssertEqual(error as? LaunchError, .expired)
        }
        let expiredSends = await client.sentCount()
        XCTAssertEqual(expiredSends, 1, "an expired capability is not resent")

        let still = try await launcher.recover(workId: capability.workId, idempotencyNonce: "nonce-one")
        XCTAssertEqual(still.record.requestId, failed.record.requestId)
        XCTAssertEqual(still.record.attemptId, failed.record.attemptId)
        XCTAssertEqual(still.record.ownerAbsent, true)
        XCTAssertEqual(still.state, .transmissionFailed)
    }

    func testDifferentPrincipalOrTupleCannotUseTheOriginal() async throws {
        let store = InMemoryRecoveryStore()
        let client = LivenessLaunchClient(launch: .unauthorized, status: .notFound)
        let session = MutableSession(LaunchFixtures.session())
        let launcher = coordinator(client: client, store: store, session: session)
        let capability = LaunchFixtures.capability()

        let failed = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-one")
        _ = try await launcher.recover(workId: capability.workId, idempotencyNonce: "nonce-one")

        var otherTuple = capability
        otherTuple.inputDigest = "sha256:" + String(repeating: "b", count: 64)
        do {
            _ = try await launcher.launch(capability: otherTuple, idempotencyNonce: "nonce-one")
            XCTFail("expected refusal")
        } catch {
            XCTAssertEqual(error as? LaunchError, .refused("nonce_reused_with_different_capability"))
        }

        await session.set(LaunchFixtures.session("founder-2"))
        let foreign = coordinator(client: client, store: store, session: session)
        do {
            _ = try await foreign.recover(workId: capability.workId, idempotencyNonce: "nonce-one")
            XCTFail("expected recoveryUnavailable")
        } catch {
            XCTAssertEqual(error as? LaunchError, .recoveryUnavailable)
        }
        // A different principal's own launch is a separate scope. It must not
        // read or resend founder-1's persisted request.
        let foreignLaunch = try await foreign.launch(
            capability: LaunchFixtures.capability(principal: "founder-2"), idempotencyNonce: "nonce-one"
        )
        XCTAssertNotEqual(foreignLaunch.record.requestId, failed.record.requestId)
        XCTAssertEqual(foreignLaunch.record.capability.principal, "founder-2")
        let sends = await client.sentCount()
        XCTAssertEqual(sends, 2)
        let firstSent = await client.sentRecords()
        XCTAssertEqual(firstSent.first?.requestId, failed.record.requestId)
        XCTAssertEqual(firstSent.first?.tuple, LaunchCoordinator.pinned(capability))
        XCTAssertNotEqual(firstSent.last?.requestId, failed.record.requestId)

        // The original principal still holds the same unsent request.
        await session.set(LaunchFixtures.session())
        let home = try await launcher.recover(workId: capability.workId, idempotencyNonce: "nonce-one")
        XCTAssertEqual(home.record.requestId, failed.record.requestId)
        XCTAssertEqual(home.record.ownerAbsent, true)
    }

    func testNotFoundProofSurvivesRestartAndResendsOnlyTheOriginal() async throws {
        let dir = LaunchFixtures.tempDir()
        defer { try? FileManager.default.removeItem(at: dir) }
        let firstClient = LivenessLaunchClient(launch: .unauthorized, status: .notFound)
        let first = coordinator(client: firstClient, store: FileRecoveryStore(directory: dir))
        let capability = LaunchFixtures.capability()
        let failed = try await first.launch(capability: capability, idempotencyNonce: "nonce-one")
        let proved = try await first.recover(workId: capability.workId, idempotencyNonce: "nonce-one")
        XCTAssertEqual(proved.record.ownerAbsent, true)

        let restartedClient = LivenessLaunchClient(launch: .queued, status: .notFound)
        let restarted = coordinator(client: restartedClient, store: FileRecoveryStore(directory: dir))
        let pending = try await restarted.pendingRecoveries()
        XCTAssertEqual(pending.map(\.requestId), [failed.record.requestId])
        XCTAssertEqual(pending.first?.ownerAbsent, true)

        let resent = try await restarted.launch(capability: capability, idempotencyNonce: "nonce-one")
        XCTAssertEqual(resent.state, .queued)
        XCTAssertEqual(resent.record.requestId, failed.record.requestId)
        XCTAssertEqual(resent.record.attemptId, failed.record.attemptId)
        XCTAssertEqual(resent.record.idempotencyNonce, failed.record.idempotencyNonce)
        let sent = await restartedClient.sent
        XCTAssertEqual(sent.count, 1)
        XCTAssertEqual(sent.first?.requestId, failed.record.requestId)
        XCTAssertEqual(sent.first?.attemptId, failed.record.attemptId)
        XCTAssertEqual(sent.first?.nonce, "nonce-one")
        XCTAssertEqual(sent.first?.tuple, LaunchCoordinator.pinned(capability))
    }

    /// The wire the owner returns for an unknown request is exactly `404` plus `not_found`.
    func testHTTPStatusNotFoundMarksOwnerAbsentAndRecordedDoesNot() async throws {
        let absent = try OwnerWire.statusResult(
            status: 404,
            data: Data(#"{"contractVersion":"cambium.native-launch.v1","status":"not_found"}"#.utf8),
            requestId: "client-request-0001", attemptId: "client-attempt-0001"
        )
        XCTAssertEqual(absent.detail, "not_found")
        XCTAssertTrue(absent.ownerAbsent)
        XCTAssertEqual(absent.status, .unknown)

        let recorded = try OwnerWire.statusResult(
            status: 200,
            data: LaunchLivenessHTTP.recordedStatus(),
            requestId: "client-request-0001", attemptId: "client-attempt-0001"
        )
        XCTAssertFalse(recorded.ownerAbsent)
        XCTAssertEqual(recorded.detail, "observed")
        XCTAssertEqual(recorded.status, .running)
    }
}

/// Launch client whose answers are the liveness cases, not a happy-path script.
private actor LivenessLaunchClient: LaunchClient {
    enum Launch { case queued, unauthorized, lost }
    enum Status { case notFound, unavailable, recorded }

    private var launchMode: Launch
    private var statusMode: Status
    private(set) var sent: [(requestId: String, attemptId: String, nonce: String, tuple: LaunchCapabilityTuple)] = []

    init(launch: Launch, status: Status) {
        launchMode = launch
        statusMode = status
    }

    func setLaunch(_ mode: Launch) { launchMode = mode }
    func sentCount() -> Int { sent.count }
    func sentRecords() -> [(requestId: String, attemptId: String, nonce: String, tuple: LaunchCapabilityTuple)] { sent }

    nonisolated func capability(workId: String, tenantId: String) async throws -> LaunchCapability {
        throw LaunchError.refused("unused")
    }

    nonisolated func preflight(capability: LaunchCapability, idempotencyNonce: String) throws {
        _ = LaunchCoordinator.pinned(capability)
        guard idempotencyNonce.isEmpty == false else { throw LaunchError.invalidCapability }
    }

    func requestLaunch(capability: LaunchCapability, requestId: String, attemptId: String, idempotencyNonce: String) async throws -> LaunchRequestWire {
        sent.append((requestId, attemptId, idempotencyNonce, LaunchCoordinator.pinned(capability)))
        switch launchMode {
        case .queued:
            return LaunchRequestWire(requestId: requestId, attemptId: attemptId, status: .queued, assignedRunId: nil, detail: "recorded")
        case .unauthorized:
            throw TransportFailure.unauthorized
        case .lost:
            throw TransportFailure.timeout
        }
    }

    func attemptStatus(requestId: String, attemptId: String, tenantId: String) async throws -> AttemptStatusResult {
        switch statusMode {
        case .notFound:
            return AttemptStatusResult(
                requestId: requestId, attemptId: attemptId, status: .unknown,
                runId: nil, artifactRef: nil, receiptRef: nil, verdict: nil,
                detail: "not_found", ownerAbsent: true
            )
        case .unavailable:
            throw TransportFailure.unreachable
        case .recorded:
            return AttemptStatusResult(
                requestId: requestId, attemptId: attemptId, status: .running,
                runId: nil, artifactRef: nil, receiptRef: nil, verdict: nil,
                detail: "observed", dispatch: "owner_answered", executionState: "running",
                acceptance: "not_evaluated", retry: "status_only",
                capability: sent.last?.tuple, ownerAbsent: false
            )
        }
    }
}

private enum LaunchLivenessHTTP {
    static func recordedStatus() -> Data {
        let digest = "sha256:" + String(repeating: "ab", count: 32)
        let json = """
        {"contractVersion":"cambium.native-launch.v1","status":"observed","retry":"status_only","request":{"requestId":"client-request-0001","attemptId":"client-attempt-0001","requestKey":"nlr_\(String(repeating: "a", count: 64))","dispatch":"owner_answered","reservedAt":"2026-11-02T00:00:00.000Z","capability":{"workId":"sapling:cambium","admissionRef":"adm-1","graphVersion":1,"loadoutId":"loadout-alpha","inputDigest":"\(digest)","executionPlant":"temperance-hands","supportedAction":"launch","expiresAt":"2030-01-01T00:00:00.000Z"}},"execution":{"state":"running","ownerRef":null,"observedAt":"2026-11-02T00:00:01.000Z","terminal":false},"acceptance":{"state":"not_evaluated"}}
        """
        return Data(json.utf8)
    }
}
