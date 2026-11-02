import Foundation
import XCTest
@testable import CambiumCore

// MARK: - Test doubles (private to this file's names; shared doubles live in CambiumCoreTests.swift)

actor MutableSession: SessionProvider {
    private var value: NativeSession
    init(_ value: NativeSession) { self.value = value }
    func set(_ next: NativeSession) { value = next }
    func currentSession() async -> NativeSession { value }
}

/// Wraps a store to force interleavings and failures.
actor ProbeStore: RecoveryStore {
    private let inner: any RecoveryStore
    private var failSaveCalls: Set<Int> = []
    private(set) var saveCalls = 0
    private(set) var keysEntered = 0
    private var holdNextKeys = false
    private var onKeys: (@Sendable () async -> Void)?

    init(_ inner: any RecoveryStore) { self.inner = inner }

    func failSaves(onCalls calls: Set<Int>) { failSaveCalls = calls }
    func holdNextKeysCall() { holdNextKeys = true }
    func releaseKeys() { holdNextKeys = false }
    func setOnKeys(_ hook: (@Sendable () async -> Void)?) { onKeys = hook }

    func save(_ data: Data, key: String) async throws {
        saveCalls += 1
        if failSaveCalls.contains(saveCalls) { throw TransportFailure.unreachable }
        try await inner.save(data, key: key)
    }
    func load(key: String) async throws -> Data? { try await inner.load(key: key) }
    func remove(key: String) async throws { try await inner.remove(key: key) }
    func keys(prefix: String) async throws -> [String] {
        keysEntered += 1
        if let hook = onKeys { await hook() }
        while holdNextKeys { try? await Task.sleep(nanoseconds: 2_000_000) }
        return try await inner.keys(prefix: prefix)
    }
}

actor ScriptedLaunchClient: LaunchClient {
    enum Launch { case queued, running, lostResponse, wrongIds, unknown }
    enum Status { case complete, running, lostResponse, wrongIds }

    private var launchMode: Launch
    private var statusMode: Status
    private let observedStore: (any RecoveryStore)?
    private(set) var sent: [(requestId: String, attemptId: String, nonce: String)] = []
    private(set) var statusCalls: [(requestId: String, attemptId: String)] = []
    private(set) var durableRecordsAtSend: [Int] = []

    init(launch: Launch = .queued, status: Status = .complete, observing store: (any RecoveryStore)? = nil) {
        launchMode = launch
        statusMode = status
        observedStore = store
    }

    func setLaunch(_ mode: Launch) { launchMode = mode }
    func setStatus(_ mode: Status) { statusMode = mode }

    func capability(workId: String, tenantId: String) async throws -> LaunchCapability { throw LaunchError.refused("unused") }

    func requestLaunch(capability: LaunchCapability, requestId: String, attemptId: String, idempotencyNonce: String) async throws -> LaunchRequestWire {
        sent.append((requestId, attemptId, idempotencyNonce))
        if let observedStore { durableRecordsAtSend.append(try await observedStore.keys(prefix: "launch:").count) }
        switch launchMode {
        case .queued: return LaunchRequestWire(requestId: requestId, attemptId: attemptId, status: .queued, assignedRunId: nil, detail: nil)
        case .running: return LaunchRequestWire(requestId: requestId, attemptId: attemptId, status: .running, assignedRunId: nil, detail: nil)
        case .unknown: return LaunchRequestWire(requestId: requestId, attemptId: attemptId, status: .unknown, assignedRunId: nil, detail: nil)
        case .wrongIds: return LaunchRequestWire(requestId: "req-attacker-0001", attemptId: "att-attacker-0001", status: .complete, assignedRunId: "run-evil", detail: nil)
        case .lostResponse: throw TransportFailure.timeout
        }
    }

    func attemptStatus(requestId: String, attemptId: String, tenantId: String) async throws -> AttemptStatusResult {
        statusCalls.append((requestId, attemptId))
        switch statusMode {
        case .complete: return AttemptStatusResult(requestId: requestId, attemptId: attemptId, status: .complete, runId: "run-1", artifactRef: nil, receiptRef: nil, verdict: nil)
        case .running: return AttemptStatusResult(requestId: requestId, attemptId: attemptId, status: .running, runId: nil, artifactRef: nil, receiptRef: nil, verdict: nil)
        case .wrongIds: return AttemptStatusResult(requestId: "req-attacker-0001", attemptId: "att-attacker-0001", status: .complete, runId: nil, artifactRef: nil, receiptRef: nil, verdict: .pass)
        case .lostResponse: throw TransportFailure.timeout
        }
    }
}

enum LaunchFixtures {
    static let now = CanonicalTimestamp.parse("2026-11-02T00:00:00.000Z")!

    static func capability(work: String = "sapling:cambium", admission: String = "adm-1", principal: String = "founder-1", tenant: String = "cambium") -> LaunchCapability {
        LaunchCapability(
            tenantId: tenant, principal: principal, workId: work, admissionRef: admission,
            graphVersion: 1, loadoutId: "loadout-alpha",
            inputDigest: "sha256:" + String(repeating: "a", count: 64),
            executionPlant: .hands, supportedAction: "launch", expiresAt: "2030-01-01T00:00:00.000Z"
        )
    }

    static func session(_ principal: String = "founder-1", tenant: String = "cambium") -> NativeSession {
        .verified(founderId: principal, tenantId: tenant, expiresAt: now.addingTimeInterval(3600))
    }

    static func tempDir() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("cambium-launch-" + UUID().uuidString, isDirectory: true)
    }
}

final class LaunchSafetyTests: XCTestCase {

    private func waitFor(_ description: String, timeout: Double = 3, _ condition: @escaping @Sendable () async -> Bool) async {
        let end = Date().addingTimeInterval(timeout)
        while !(await condition()) {
            if Date() > end { return XCTFail("timed out waiting for \(description)") }
            try? await Task.sleep(nanoseconds: 2_000_000)
        }
    }

    private func coordinator(
        client: ScriptedLaunchClient, store: any RecoveryStore,
        session: any SessionProvider = MutableSession(LaunchFixtures.session())
    ) -> LaunchCoordinator {
        LaunchCoordinator(client: client, session: session, clock: TestClock(date: LaunchFixtures.now), store: store)
    }

    // MARK: FileRecoveryStore

    func testFileStoreLongKeyReopenBoundedNamesAndPrivatePermissions() async throws {
        let dir = LaunchFixtures.tempDir()
        defer { try? FileManager.default.removeItem(at: dir) }
        let longKey = "launch:v2:cambium:" + String(repeating: "founder-x", count: 60) + ":" + String(repeating: "n", count: 400)
        XCTAssertGreaterThan(longKey.utf8.count, 255)
        let payload = Data("opaque-payload".utf8)

        try await FileRecoveryStore(directory: dir).save(payload, key: longKey)

        // A fresh instance over the same directory is a real reopen.
        let reopened = FileRecoveryStore(directory: dir)
        let loaded = try await reopened.load(key: longKey)
        XCTAssertEqual(loaded, payload)
        let found = try await reopened.keys(prefix: "launch:v2:cambium:")
        XCTAssertEqual(found, [longKey])

        let names = try FileManager.default.contentsOfDirectory(atPath: dir.path)
        XCTAssertEqual(names.count, 1, "no temp leftovers: \(names)")
        XCTAssertTrue(names.allSatisfy { $0.utf8.count <= 80 }, "\(names)")
        let dirMode = try XCTUnwrap(try FileManager.default.attributesOfItem(atPath: dir.path)[.posixPermissions] as? NSNumber).intValue
        let fileMode = try XCTUnwrap(try FileManager.default.attributesOfItem(atPath: dir.appendingPathComponent(names[0]).path)[.posixPermissions] as? NSNumber).intValue
        XCTAssertEqual(dirMode & 0o777, 0o700)
        XCTAssertEqual(fileMode & 0o777, 0o600)
    }

    func testFileStoreAliasKeysStayDistinct() async throws {
        let dir = LaunchFixtures.tempDir()
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = FileRecoveryStore(directory: dir)
        let keys = ["a:b", "a%3Ab", "a/b", "A:B", "a:b "]
        for (index, key) in keys.enumerated() { try await store.save(Data("v\(index)".utf8), key: key) }
        for (index, key) in keys.enumerated() {
            let value = try await store.load(key: key)
            XCTAssertEqual(value, Data("v\(index)".utf8), key)
        }
        let listed = try await store.keys(prefix: "a")
        XCTAssertEqual(Set(listed), Set(["a:b", "a%3Ab", "a/b", "a:b "]))
        let none = try await store.keys(prefix: "a:b:")
        XCTAssertTrue(none.isEmpty)
    }

    func testFileStoreBoundsAndCorruptEnvelopesThrow() async throws {
        let dir = LaunchFixtures.tempDir()
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = FileRecoveryStore(directory: dir)

        do { try await store.save(Data(count: FileRecoveryStore.maxPayloadBytes + 1), key: "k"); XCTFail("expected tooLarge") }
        catch { XCTAssertEqual(error as? RecoveryStoreError, .tooLarge) }
        do { try await store.save(Data(), key: String(repeating: "k", count: FileRecoveryStore.maxKeyBytes + 1)); XCTFail("expected invalidKey") }
        catch { XCTAssertEqual(error as? RecoveryStoreError, .invalidKey) }

        try await store.save(Data("good".utf8), key: "gate:one")
        let name = try XCTUnwrap(try FileManager.default.contentsOfDirectory(atPath: dir.path).first)
        let file = dir.appendingPathComponent(name)

        // Garbage bytes: load and enumeration both refuse; neither reports "absent".
        try Data("not-an-envelope".utf8).write(to: file)
        do { _ = try await store.load(key: "gate:one"); XCTFail("expected corruptEnvelope") }
        catch { XCTAssertEqual(error as? RecoveryStoreError, .corruptEnvelope) }
        do { _ = try await store.keys(prefix: "gate:"); XCTFail("expected corruptEnvelope") }
        catch { XCTAssertEqual(error as? RecoveryStoreError, .corruptEnvelope) }

        // A valid envelope moved under another key's filename is also corrupt.
        try await store.save(Data("good".utf8), key: "gate:one")
        try await store.save(Data("other".utf8), key: "gate:two")
        let other = try XCTUnwrap(try FileManager.default.contentsOfDirectory(atPath: dir.path).first { $0 != name })
        try FileManager.default.removeItem(at: dir.appendingPathComponent(other))
        try FileManager.default.copyItem(at: file, to: dir.appendingPathComponent(other))
        do { _ = try await store.load(key: "gate:two"); XCTFail("expected corruptEnvelope") }
        catch { XCTAssertEqual(error as? RecoveryStoreError, .corruptEnvelope) }
    }

    // MARK: Coordinator keys

    func testCoordinatorKeysDoNotAliasAcrossWorkAndNonce() {
        let a = LaunchCoordinator.key(tenantId: "cambium", principal: "founder-1", workId: "sapling:a", nonce: "n:1")
        let b = LaunchCoordinator.key(tenantId: "cambium", principal: "founder-1", workId: "sapling:a:n", nonce: "1")
        let c = LaunchCoordinator.key(tenantId: "cambium", principal: "founder-1", workId: "sapling:a", nonce: "n%3A1")
        XCTAssertEqual(Set([a, b, c]).count, 3)
        let workPrefix = LaunchCoordinator.workPrefix(tenantId: "cambium", principal: "founder-1", workId: "sapling:a")
        XCTAssertTrue(a.hasPrefix(workPrefix))
        XCTAssertFalse(b.hasPrefix(workPrefix))
    }

    // MARK: Race

    func testConcurrentLaunchGuardIsHeldBeforeFirstStorageAwait() async throws {
        let probe = ProbeStore(InMemoryRecoveryStore())
        let client = ScriptedLaunchClient()
        let launcher = coordinator(client: client, store: probe)
        await probe.holdNextKeysCall()

        let first = Task { try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one") }
        await waitFor("first launch parked in storage") { await probe.keysEntered >= 1 }

        // Same nonce and a new nonce for the same work both bounce while the first is parked.
        for nonce in ["nonce-one", "nonce-two"] {
            do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: nonce); XCTFail("expected concurrentExecution for \(nonce)") }
            catch { XCTAssertEqual(error as? LaunchError, .concurrentExecution) }
        }
        let sentWhileParked = await client.sent.count
        XCTAssertEqual(sentWhileParked, 0)

        await probe.releaseKeys()
        let result = try await first.value
        XCTAssertEqual(result.state, .queued)
        let sent = await client.sent
        XCTAssertEqual(sent.count, 1, "exactly one transmission")
    }

    func testDifferentWorksLaunchIndependently() async throws {
        let client = ScriptedLaunchClient()
        let launcher = coordinator(client: client, store: InMemoryRecoveryStore())
        async let one = launcher.launch(capability: LaunchFixtures.capability(work: "sapling:one", admission: "adm-1"), idempotencyNonce: "nonce-1")
        async let two = launcher.launch(capability: LaunchFixtures.capability(work: "sapling:two", admission: "adm-2"), idempotencyNonce: "nonce-2")
        let results = try await [one, two]
        XCTAssertEqual(results.map(\.state), [.queued, .queued])
        let sentCount = await client.sent.count
        XCTAssertEqual(sentCount, 2)
    }

    // MARK: Durability order, uncertainty, nonce bypass, restart

    func testOriginalIdsAreDurableBeforeTransmission() async throws {
        let store = InMemoryRecoveryStore()
        let client = ScriptedLaunchClient(observing: store)
        let outcome = try await coordinator(client: client, store: store).launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
        let durable = await client.durableRecordsAtSend
        XCTAssertEqual(durable, [1])
        let sent = await client.sent
        XCTAssertEqual(sent.first?.requestId, outcome.record.requestId)
        XCTAssertEqual(sent.first?.attemptId, outcome.record.attemptId)
    }

    func testNewNonceAfterUncertainAttemptCannotBypassAndLostResponseRecoversAfterRestart() async throws {
        let dir = LaunchFixtures.tempDir()
        defer { try? FileManager.default.removeItem(at: dir) }
        let lost = ScriptedLaunchClient(launch: .lostResponse)
        let first = coordinator(client: lost, store: FileRecoveryStore(directory: dir))
        let uncertain = try await first.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
        XCTAssertEqual(uncertain.state, .transmissionFailed)

        // New nonce for the same work is refused and sends nothing.
        do { _ = try await first.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-two"); XCTFail("expected unresolvedAttempt") }
        catch { XCTAssertEqual(error as? LaunchError, .unresolvedAttempt) }
        // Same nonce returns the stored attempt without sending.
        let again = try await first.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
        XCTAssertEqual(again.record.requestId, uncertain.record.requestId)
        let sentBefore = await lost.sent.count
        XCTAssertEqual(sentBefore, 1)

        // "Restart": new store instance, new coordinator, new client. Recovery is status only.
        let after = ScriptedLaunchClient(status: .complete)
        let restarted = coordinator(client: after, store: FileRecoveryStore(directory: dir))
        let pending = try await restarted.pendingRecoveries()
        XCTAssertEqual(pending.map(\.requestId), [uncertain.record.requestId])
        let recovered = try await restarted.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one")
        XCTAssertEqual(recovered.state, .complete)
        XCTAssertEqual(recovered.record.requestId, uncertain.record.requestId)
        XCTAssertEqual(recovered.record.attemptId, uncertain.record.attemptId)
        let calls = await after.statusCalls
        XCTAssertEqual(calls.map(\.requestId), [uncertain.record.requestId])
        let redispatch = await after.sent.count
        XCTAssertEqual(redispatch, 0)
        let remaining = try await restarted.pendingRecoveries()
        XCTAssertTrue(remaining.isEmpty)
    }

    func testResolvedWorkCannotConsumeSameAdmissionWithNewNonce() async throws {
        let store = InMemoryRecoveryStore()
        let client = ScriptedLaunchClient()
        let launcher = coordinator(client: client, store: store)
        _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
        _ = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one")
        do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-two"); XCTFail("expected refusal") }
        catch { XCTAssertEqual(error as? LaunchError, .refused("admission_consumed")) }
        let sent = await client.sent.count
        XCTAssertEqual(sent, 1)
    }

    func testSameNonceWithDifferentCapabilityIsRefused() async throws {
        let client = ScriptedLaunchClient()
        let launcher = coordinator(client: client, store: InMemoryRecoveryStore())
        _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
        var changed = LaunchFixtures.capability()
        changed.inputDigest = "sha256:" + String(repeating: "b", count: 64)
        do { _ = try await launcher.launch(capability: changed, idempotencyNonce: "nonce-one"); XCTFail("expected refusal") }
        catch { XCTAssertEqual(error as? LaunchError, .refused("nonce_reused_with_different_capability")) }
    }

    // MARK: Persistence failures

    func testPersistenceFailureBeforeSendSendsNothing() async throws {
        let probe = ProbeStore(InMemoryRecoveryStore())
        await probe.failSaves(onCalls: [1])
        let client = ScriptedLaunchClient()
        let launcher = coordinator(client: client, store: probe)
        do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one"); XCTFail("expected persistenceFailed") }
        catch { XCTAssertEqual(error as? LaunchError, .persistenceFailed) }
        let sent = await client.sent.count
        XCTAssertEqual(sent, 0)
    }

    func testPersistenceFailureAfterSendSurfacesUnknownAndNeverRedispatches() async throws {
        let probe = ProbeStore(InMemoryRecoveryStore())
        await probe.failSaves(onCalls: [2, 3])
        let client = ScriptedLaunchClient()
        let launcher = coordinator(client: client, store: probe)
        let outcome = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
        XCTAssertEqual(outcome.state, .outcomeUnknown)

        // The durable record is still the pre-send one with the original IDs.
        let again = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
        XCTAssertEqual(again.record.requestId, outcome.record.requestId)
        XCTAssertEqual(again.state, .transmitting)
        do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-two"); XCTFail("expected unresolvedAttempt") }
        catch { XCTAssertEqual(error as? LaunchError, .unresolvedAttempt) }
        let sent = await client.sent.count
        XCTAssertEqual(sent, 1)

        let recovered = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one")
        XCTAssertEqual(recovered.state, .complete)
        XCTAssertEqual(recovered.record.requestId, outcome.record.requestId)
    }

    // MARK: Corruption

    func testCorruptRecordRefusesAndIsNeverReplaced() async throws {
        let store = InMemoryRecoveryStore()
        let key = LaunchCoordinator.key(tenantId: "cambium", principal: "founder-1", workId: "sapling:cambium", nonce: "nonce-one")
        let junk = Data("{\"not\":\"a launch record\"}".utf8)
        try await store.save(junk, key: key)
        let client = ScriptedLaunchClient()
        let launcher = coordinator(client: client, store: store)

        for _ in 0..<2 {
            do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one"); XCTFail("expected corruptRecord") }
            catch { XCTAssertEqual(error as? LaunchError, .corruptRecord) }
        }
        do { _ = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one"); XCTFail("expected corruptRecord") }
        catch { XCTAssertEqual(error as? LaunchError, .corruptRecord) }
        do { _ = try await launcher.pendingRecoveries(); XCTFail("expected corruptRecord") }
        catch { XCTAssertEqual(error as? LaunchError, .corruptRecord) }

        let stored = try await store.load(key: key)
        XCTAssertEqual(stored, junk, "the original is untouched")
        let sent = await client.sent.count
        XCTAssertEqual(sent, 0)
    }

    func testCorruptFileOnDiskRefusesLaunch() async throws {
        let dir = LaunchFixtures.tempDir()
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = FileRecoveryStore(directory: dir)
        let client = ScriptedLaunchClient(launch: .lostResponse)
        let launcher = coordinator(client: client, store: store)
        _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
        let name = try XCTUnwrap(try FileManager.default.contentsOfDirectory(atPath: dir.path).first)
        try Data("garbage".utf8).write(to: dir.appendingPathComponent(name))

        do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-two"); XCTFail("expected refusal") }
        catch { XCTAssertEqual(error as? RecoveryStoreError, .corruptEnvelope) }
        let sent = await client.sent.count
        XCTAssertEqual(sent, 1)
    }

    // MARK: Malicious or mismatched IDs

    func testMismatchedLaunchResponseIdsStayUnknownWithOriginalIds() async throws {
        let store = InMemoryRecoveryStore()
        let client = ScriptedLaunchClient(launch: .wrongIds)
        let launcher = coordinator(client: client, store: store)
        let outcome = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
        XCTAssertEqual(outcome.state, .outcomeUnknown)
        XCTAssertTrue(outcome.record.requestId.hasPrefix("req-"))
        XCTAssertNotEqual(outcome.record.requestId, "req-attacker-0001")
        XCTAssertNil(outcome.record.assignedRunId)
        let sent = await client.sent
        XCTAssertEqual(outcome.record.requestId, sent.first?.requestId)
    }

    func testMismatchedStatusIdsDoNotResolveTheAttempt() async throws {
        let client = ScriptedLaunchClient(launch: .running, status: .wrongIds)
        let launcher = coordinator(client: client, store: InMemoryRecoveryStore())
        let launched = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
        let recovered = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one")
        XCTAssertEqual(recovered.state, .outcomeUnknown)
        XCTAssertNil(recovered.record.verdict)
        XCTAssertEqual(recovered.record.requestId, launched.record.requestId)
    }

    func testStatusReadbackFailureKeepsLiveAttemptState() async throws {
        let client = ScriptedLaunchClient(launch: .running, status: .lostResponse)
        let launcher = coordinator(client: client, store: InMemoryRecoveryStore())
        _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
        let recovered = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one")
        XCTAssertEqual(recovered.state, .running)
    }

    // MARK: Scope

    func testScopeSwapDuringAwaitedStorageSendsNothing() async throws {
        let session = MutableSession(LaunchFixtures.session("founder-1"))
        let probe = ProbeStore(InMemoryRecoveryStore())
        await probe.setOnKeys { await session.set(LaunchFixtures.session("founder-2")) }
        let client = ScriptedLaunchClient()
        let launcher = coordinator(client: client, store: probe, session: session)
        do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one"); XCTFail("expected notAdmitted") }
        catch { XCTAssertEqual(error as? LaunchError, .notAdmitted) }
        let sent = await client.sent.count
        XCTAssertEqual(sent, 0)
        let saves = await probe.saveCalls
        XCTAssertEqual(saves, 0)
    }

    func testOtherPrincipalAndTenantCannotRecoverOrListAttempts() async throws {
        let store = InMemoryRecoveryStore()
        let owner = MutableSession(LaunchFixtures.session("founder-1"))
        let client = ScriptedLaunchClient(launch: .lostResponse)
        let ownerCoordinator = coordinator(client: client, store: store, session: owner)
        _ = try await ownerCoordinator.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")

        for foreign in [LaunchFixtures.session("founder-2"), LaunchFixtures.session("founder-1", tenant: "other-tenant")] {
            let foreignCoordinator = coordinator(client: client, store: store, session: MutableSession(foreign))
            let pending = try await foreignCoordinator.pendingRecoveries()
            XCTAssertTrue(pending.isEmpty)
            do { _ = try await foreignCoordinator.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one"); XCTFail("expected recoveryUnavailable") }
            catch { XCTAssertEqual(error as? LaunchError, .recoveryUnavailable) }
        }
        let calls = await client.statusCalls.count
        XCTAssertEqual(calls, 0)
    }

    func testExpiredOrUnconfiguredSessionListsNothingAndRefusesRecovery() async throws {
        let store = InMemoryRecoveryStore()
        let client = ScriptedLaunchClient(launch: .lostResponse)
        let session = MutableSession(LaunchFixtures.session())
        let launcher = coordinator(client: client, store: store, session: session)
        _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")

        await session.set(.verified(founderId: "founder-1", tenantId: "cambium", expiresAt: LaunchFixtures.now.addingTimeInterval(-1)))
        let expiredPending = try await launcher.pendingRecoveries()
        XCTAssertTrue(expiredPending.isEmpty)
        do { _ = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one"); XCTFail("expected notAdmitted") }
        catch { XCTAssertEqual(error as? LaunchError, .notAdmitted) }

        await session.set(.unconfigured)
        let unconfiguredPending = try await launcher.pendingRecoveries()
        XCTAssertTrue(unconfiguredPending.isEmpty)
    }

    func testRecoveryUsesExactKeyNotSuffixOrPrefixMatch() async throws {
        let store = InMemoryRecoveryStore()
        let client = ScriptedLaunchClient(launch: .lostResponse)
        let launcher = coordinator(client: client, store: store)
        _ = try await launcher.launch(capability: LaunchFixtures.capability(work: "sapling:a", admission: "adm-a"), idempotencyNonce: "n-1")

        for (work, nonce) in [("sapling:a", "1"), ("sapling:a", "xn-1"), ("sapling:a:n", "1"), ("sapling:b", "n-1")] {
            do { _ = try await launcher.recover(workId: work, idempotencyNonce: nonce); XCTFail("expected recoveryUnavailable for \(work)/\(nonce)") }
            catch { XCTAssertEqual(error as? LaunchError, .recoveryUnavailable) }
        }
        let calls = await client.statusCalls.count
        XCTAssertEqual(calls, 0)
    }

    func testExpiredCapabilityIsRefusedBeforeAnyPersistence() async throws {
        let probe = ProbeStore(InMemoryRecoveryStore())
        var capability = LaunchFixtures.capability()
        capability.expiresAt = "2026-11-01T00:00:00.000Z"
        let client = ScriptedLaunchClient()
        let launcher = coordinator(client: client, store: probe)
        do { _ = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-one"); XCTFail("expected expired") }
        catch { XCTAssertEqual(error as? LaunchError, .expired) }
        let saves = await probe.saveCalls
        XCTAssertEqual(saves, 0)
    }
}
