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
    private var onSaved: (@Sendable (Int) async -> Void)?
    private var onLoad: (@Sendable () async -> Void)?
    private(set) var loadCalls = 0

    init(_ inner: any RecoveryStore) { self.inner = inner }

    /// Runs after the Nth save has reached the inner store, before save returns to the caller.
    func setOnSaved(_ hook: (@Sendable (Int) async -> Void)?) { onSaved = hook }
    /// Runs after a load reads its value, before load returns to the caller.
    func setOnLoad(_ hook: (@Sendable () async -> Void)?) { onLoad = hook }

    func failSaves(onCalls calls: Set<Int>) { failSaveCalls = calls }
    func holdNextKeysCall() { holdNextKeys = true }
    func releaseKeys() { holdNextKeys = false }
    func setOnKeys(_ hook: (@Sendable () async -> Void)?) { onKeys = hook }

    func save(_ data: Data, key: String) async throws {
        saveCalls += 1
        if failSaveCalls.contains(saveCalls) { throw TransportFailure.unreachable }
        try await inner.save(data, key: key)
        if let hook = onSaved { await hook(saveCalls) }
    }
    func load(key: String) async throws -> Data? {
        loadCalls += 1
        let value = try await inner.load(key: key)
        if let hook = onLoad { await hook() }
        return value
    }
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
    private var onSend: (@Sendable () async -> Void)?
    private var onStatus: (@Sendable () async -> Void)?
    private var sentTuple: LaunchCapabilityTuple?
    private var echoStatusTuple = false
    private var tupleMutation: (@Sendable (inout LaunchCapabilityTuple) -> Void)?

    init(launch: Launch = .queued, status: Status = .complete, observing store: (any RecoveryStore)? = nil) {
        launchMode = launch
        statusMode = status
        observedStore = store
    }

    func setLaunch(_ mode: Launch) { launchMode = mode }
    func setStatus(_ mode: Status) { statusMode = mode }
    /// Runs while the request is in flight, after the call is recorded and before the owner answers.
    func setOnSend(_ hook: (@Sendable () async -> Void)?) { onSend = hook }
    /// Runs while a status readback is in flight, before the owner answers.
    func setOnStatus(_ hook: (@Sendable () async -> Void)?) { onStatus = hook }
    /// Status answers carry the tuple that was sent, optionally altered like a hostile owner would.
    func echoStatusCapability(_ mutation: (@Sendable (inout LaunchCapabilityTuple) -> Void)? = nil) {
        echoStatusTuple = true
        tupleMutation = mutation
    }

    func capability(workId: String, tenantId: String) async throws -> LaunchCapability { throw LaunchError.refused("unused") }

    func requestLaunch(capability: LaunchCapability, requestId: String, attemptId: String, idempotencyNonce: String) async throws -> LaunchRequestWire {
        sent.append((requestId, attemptId, idempotencyNonce))
        sentTuple = LaunchCoordinator.pinned(capability)
        if let onSend { await onSend() }
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
        if let onStatus { await onStatus() }
        var echoed: LaunchCapabilityTuple? = nil
        if echoStatusTuple, var tuple = sentTuple {
            tupleMutation?(&tuple)
            echoed = tuple
        }
        switch statusMode {
        case .complete: return AttemptStatusResult(requestId: requestId, attemptId: attemptId, status: .complete, runId: "run-1", artifactRef: nil, receiptRef: nil, verdict: nil, capability: echoed)
        case .running: return AttemptStatusResult(requestId: requestId, attemptId: attemptId, status: .running, runId: nil, artifactRef: nil, receiptRef: nil, verdict: nil, capability: echoed)
        case .wrongIds: return AttemptStatusResult(requestId: "req-attacker-0001", attemptId: "att-attacker-0001", status: .complete, runId: nil, artifactRef: nil, receiptRef: nil, verdict: .pass)
        case .lostResponse: throw TransportFailure.timeout
        }
    }
}

/// Clock the test can advance, to expire a capability while a call is parked.
final class StepClock: CoreClock, @unchecked Sendable {
    private let lock = NSLock()
    private var date: Date
    init(_ date: Date) { self.date = date }
    func now() -> Date { lock.lock(); defer { lock.unlock() }; return date }
    func advance(_ seconds: TimeInterval) { lock.lock(); date = date.addingTimeInterval(seconds); lock.unlock() }
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
        session: any SessionProvider = MutableSession(LaunchFixtures.session()),
        clock: any CoreClock = TestClock(date: LaunchFixtures.now)
    ) -> LaunchCoordinator {
        LaunchCoordinator(client: client, session: session, clock: clock, store: store)
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

    // MARK: Asynchronous scope boundaries

    private func storedRecord(_ store: any RecoveryStore, work: String = "sapling:cambium", nonce: String = "nonce-one", principal: String = "founder-1") async throws -> LaunchAttemptRecord? {
        let key = LaunchCoordinator.key(tenantId: "cambium", principal: principal, workId: work, nonce: nonce)
        guard let data = try await store.load(key: key) else { return nil }
        return try JSONDecoder().decode(LaunchAttemptRecord.self, from: data)
    }

    private enum Swap { case otherPrincipal, signOut, expire }
    private static func apply(_ swap: Swap, to session: MutableSession) async {
        switch swap {
        case .otherPrincipal: await session.set(LaunchFixtures.session("founder-2"))
        case .signOut: await session.set(.unconfigured)
        case .expire: await session.set(.verified(founderId: "founder-1", tenantId: "cambium", expiresAt: LaunchFixtures.now.addingTimeInterval(-1)))
        }
    }

    func testSessionChangeDuringDurableSaveSendsNothing() async throws {
        for swap in [Swap.otherPrincipal, .signOut, .expire] {
            let session = MutableSession(LaunchFixtures.session())
            let probe = ProbeStore(InMemoryRecoveryStore())
            await probe.setOnSaved { [swap] _ in await LaunchSafetyTests.apply(swap, to: session) }
            let client = ScriptedLaunchClient()
            let launcher = coordinator(client: client, store: probe, session: session)
            do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one"); XCTFail("expected notAdmitted for \(swap)") }
            catch { XCTAssertEqual(error as? LaunchError, .notAdmitted, "\(swap)") }
            let sent = await client.sent.count
            XCTAssertEqual(sent, 0, "no transport on a pre-send switch: \(swap)")
            let leftover = try await probe.keys(prefix: "launch:")
            XCTAssertTrue(leftover.isEmpty, "unsent record must not block a later launch: \(swap)")
        }
    }

    func testCapabilityExpiryDuringDurableSaveSendsNothing() async throws {
        let clock = StepClock(LaunchFixtures.now)
        var capability = LaunchFixtures.capability()
        capability.expiresAt = "2026-11-02T00:00:30.000Z"
        let probe = ProbeStore(InMemoryRecoveryStore())
        await probe.setOnSaved { _ in clock.advance(60) }
        let client = ScriptedLaunchClient()
        let launcher = coordinator(client: client, store: probe, session: MutableSession(LaunchFixtures.session()), clock: clock)
        do { _ = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-one"); XCTFail("expected expired") }
        catch { XCTAssertEqual(error as? LaunchError, .expired) }
        let sent = await client.sent.count
        XCTAssertEqual(sent, 0)
    }

    func testSessionChangeDuringLaunchSendKeepsOriginalUncertainRecordAndReturnsNoForeignOutcome() async throws {
        for swap in [Swap.otherPrincipal, .signOut, .expire] {
            let session = MutableSession(LaunchFixtures.session())
            let store = InMemoryRecoveryStore()
            let client = ScriptedLaunchClient(launch: .queued)
            await client.setOnSend { [swap] in await LaunchSafetyTests.apply(swap, to: session) }
            let launcher = coordinator(client: client, store: store, session: session)
            do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one"); XCTFail("expected notAdmitted for \(swap)") }
            catch { XCTAssertEqual(error as? LaunchError, .notAdmitted, "\(swap)") }

            let sent = await client.sent
            XCTAssertEqual(sent.count, 1, "\(swap)")
            let recordOpt = try await storedRecord(store)
            let record = try XCTUnwrap(recordOpt, "\(swap)")
            XCTAssertEqual(record.state, .outcomeUnknown, "owner may have accepted: stays unknown (\(swap))")
            XCTAssertEqual(record.requestId, sent.first?.requestId)
            XCTAssertEqual(record.attemptId, sent.first?.attemptId)
            XCTAssertEqual(record.capability.principal, "founder-1", "original scope evidence kept (\(swap))")
            XCTAssertEqual(record.capability.tenantId, "cambium")
            XCTAssertNil(record.assignedRunId)
            XCTAssertNil(record.executionState, "the owner answer is not adopted (\(swap))")
            XCTAssertNil(record.acceptance)
            XCTAssertEqual(record.detail, "session_changed_after_send")
        }
    }

    func testSessionChangeDuringLaunchSendNeverMarksOtherPrincipalsRecordAndOriginalCanRecover() async throws {
        let session = MutableSession(LaunchFixtures.session())
        let store = InMemoryRecoveryStore()
        let client = ScriptedLaunchClient(launch: .queued, status: .complete)
        await client.setOnSend { await session.set(LaunchFixtures.session("founder-2")) }
        let launcher = coordinator(client: client, store: store, session: session)
        do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one"); XCTFail() }
        catch { XCTAssertEqual(error as? LaunchError, .notAdmitted) }

        // The new active principal sees nothing and cannot reach the record.
        let foreign = try await launcher.pendingRecoveries()
        XCTAssertTrue(foreign.isEmpty)
        do { _ = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one"); XCTFail() }
        catch { XCTAssertEqual(error as? LaunchError, .recoveryUnavailable) }
        let foreignRecord = try await storedRecord(store, principal: "founder-2")
        XCTAssertNil(foreignRecord)

        // The original principal returns and recovers by the original references, with no redispatch.
        await session.set(LaunchFixtures.session("founder-1"))
        let recovered = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one")
        XCTAssertEqual(recovered.state, .complete)
        let sent = await client.sent
        XCTAssertEqual(sent.count, 1)
        XCTAssertEqual(recovered.record.requestId, sent.first?.requestId)
        let statusCalls = await client.statusCalls
        XCTAssertEqual(statusCalls.map(\.requestId), [recovered.record.requestId])
    }

    func testSessionChangeDuringOutcomeSaveReturnsNoOutcomeButPersistsIt() async throws {
        for swap in [Swap.otherPrincipal, .signOut, .expire] {
            let session = MutableSession(LaunchFixtures.session())
            let probe = ProbeStore(InMemoryRecoveryStore())
            // Save 1 is the pre-send record, save 2 is the received outcome.
            await probe.setOnSaved { [swap] call in if call == 2 { await LaunchSafetyTests.apply(swap, to: session) } }
            let client = ScriptedLaunchClient(launch: .queued)
            let launcher = coordinator(client: client, store: probe, session: session)
            do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one"); XCTFail("expected notAdmitted for \(swap)") }
            catch { XCTAssertEqual(error as? LaunchError, .notAdmitted, "\(swap)") }
            let recordOpt = try await storedRecord(probe)
            let record = try XCTUnwrap(recordOpt, "\(swap)")
            XCTAssertEqual(record.state, .queued, "the owner answer was durable under the original scope (\(swap))")
            XCTAssertEqual(record.capability.principal, "founder-1")
            let sent = await client.sent.count
            XCTAssertEqual(sent, 1)
        }
    }

    func testSessionChangeDuringDuplicateScanPublishesNoDuplicate() async throws {
        let session = MutableSession(LaunchFixtures.session())
        let probe = ProbeStore(InMemoryRecoveryStore())
        let client = ScriptedLaunchClient()
        let launcher = coordinator(client: client, store: probe, session: session)
        _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")

        await probe.setOnLoad { await session.set(LaunchFixtures.session("founder-2")) }
        do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one"); XCTFail("expected notAdmitted") }
        catch { XCTAssertEqual(error as? LaunchError, .notAdmitted) }
        let sent = await client.sent.count
        XCTAssertEqual(sent, 1)
    }

    func testSessionChangeDuringResolvedRecordLoadPublishesNothing() async throws {
        for swap in [Swap.otherPrincipal, .signOut, .expire] {
            let session = MutableSession(LaunchFixtures.session())
            let probe = ProbeStore(InMemoryRecoveryStore())
            let client = ScriptedLaunchClient(launch: .queued, status: .complete)
            let launcher = coordinator(client: client, store: probe, session: session)
            _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
            let resolved = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one")
            XCTAssertEqual(resolved.state, .complete)
            let statusBefore = await client.statusCalls.count

            await probe.setOnLoad { [swap] in await LaunchSafetyTests.apply(swap, to: session) }
            do { _ = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one"); XCTFail("expected notAdmitted for \(swap)") }
            catch { XCTAssertEqual(error as? LaunchError, .notAdmitted, "\(swap)") }
            let statusAfter = await client.statusCalls.count
            XCTAssertEqual(statusAfter, statusBefore, "a resolved record needs no status call (\(swap))")
        }
    }

    func testSessionChangeDuringStatusReadbackNeverAppliesTheOwnerAnswer() async throws {
        for swap in [Swap.otherPrincipal, .signOut, .expire] {
            let session = MutableSession(LaunchFixtures.session())
            let store = InMemoryRecoveryStore()
            let client = ScriptedLaunchClient(launch: .lostResponse, status: .complete)
            let launcher = coordinator(client: client, store: store, session: session)
            _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
            await client.setOnStatus { [swap] in await LaunchSafetyTests.apply(swap, to: session) }
            do { _ = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one"); XCTFail("expected notAdmitted for \(swap)") }
            catch { XCTAssertEqual(error as? LaunchError, .notAdmitted, "\(swap)") }
            let recordOpt = try await storedRecord(store)
            let record = try XCTUnwrap(recordOpt, "\(swap)")
            XCTAssertEqual(record.state, .transmissionFailed, "the late owner answer is not applied (\(swap))")
            XCTAssertNil(record.assignedRunId)
            let sent = await client.sent.count
            XCTAssertEqual(sent, 1)
        }
    }

    // MARK: Status readback bound to the original capability

    private func uncertainLaunch(_ client: ScriptedLaunchClient, store: any RecoveryStore, session: MutableSession = MutableSession(LaunchFixtures.session())) async throws -> (LaunchCoordinator, LaunchOutcome) {
        let launcher = coordinator(client: client, store: store, session: session)
        let outcome = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
        return (launcher, outcome)
    }

    func testStatusWithCorrectIdsButChangedCapabilityStaysUnknownAndNeverRedispatches() async throws {
        let mutations: [(String, @Sendable (inout LaunchCapabilityTuple) -> Void)] = [
            ("other work", { $0.workId = "sapling:attacker" }),
            ("other admission", { $0.admissionRef = "adm-other" }),
            ("other input", { $0.inputDigest = "sha256:" + String(repeating: "c", count: 64) }),
            ("other loadout", { $0.loadoutId = "loadout-other" }),
            ("other graph", { $0.graphVersion = 9 }),
            ("other plant", { $0.executionPlant = ExecutionPlant.hermes.rawValue }),
            ("other action", { $0.supportedAction = "cancel" }),
            ("other expiry", { $0.expiresAt = "2031-01-01T00:00:00.000Z" }),
        ]
        for (name, mutate) in mutations {
            let client = ScriptedLaunchClient(launch: .lostResponse, status: .complete)
            await client.echoStatusCapability(mutate)
            let store = InMemoryRecoveryStore()
            // Sending records the tuple the status route will echo back (mutated).
            let (launcher, uncertain) = try await uncertainLaunch(client, store: store)
            XCTAssertEqual(uncertain.state, .transmissionFailed, name)
            let recovered = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one")
            XCTAssertEqual(recovered.state, .outcomeUnknown, name)
            XCTAssertEqual(recovered.record.detail, "mismatched_status_capability", name)
            XCTAssertNil(recovered.record.assignedRunId, name)
            XCTAssertNil(recovered.record.verdict, name)
            XCTAssertEqual(recovered.record.requestId, uncertain.record.requestId, name)
            XCTAssertEqual(recovered.record.attemptId, uncertain.record.attemptId, name)
            XCTAssertEqual(recovered.record.capability, LaunchFixtures.capability(), name)
            let sent = await client.sent.count
            XCTAssertEqual(sent, 1, "never re-dispatched: \(name)")
            do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-two"); XCTFail("expected unresolvedAttempt: \(name)") }
            catch { XCTAssertEqual(error as? LaunchError, .unresolvedAttempt, name) }
        }
    }

    func testStatusEchoingTheExactCapabilityIsApplied() async throws {
        let client = ScriptedLaunchClient(launch: .lostResponse, status: .complete)
        await client.echoStatusCapability()
        let (launcher, _) = try await uncertainLaunch(client, store: InMemoryRecoveryStore())
        let recovered = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one")
        XCTAssertEqual(recovered.state, .complete)
    }

    func testRecoveryRemainsPossibleAfterCapabilityExpiryWhileNewLaunchExpires() async throws {
        let clock = StepClock(LaunchFixtures.now)
        var capability = LaunchFixtures.capability()
        capability.expiresAt = "2026-11-02T00:10:00.000Z"
        let client = ScriptedLaunchClient(launch: .lostResponse, status: .complete)
        await client.echoStatusCapability()
        let store = InMemoryRecoveryStore()
        let launcher = coordinator(client: client, store: store, session: MutableSession(LaunchFixtures.session()), clock: clock)
        let uncertain = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-one")
        XCTAssertEqual(uncertain.state, .transmissionFailed)

        clock.advance(3000) // Past capability expiry (600s); the session (3600s) is still valid.
        do { _ = try await launcher.launch(capability: capability, idempotencyNonce: "nonce-two"); XCTFail("expected expired") }
        catch { XCTAssertEqual(error as? LaunchError, .expired) }

        let recovered = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-one")
        XCTAssertEqual(recovered.state, .complete)
        XCTAssertEqual(recovered.record.requestId, uncertain.record.requestId)
        let sent = await client.sent.count
        XCTAssertEqual(sent, 1)
    }

    // MARK: Strict enumeration

    func testRelocatedRecordRefusesInsteadOfDisappearing() async throws {
        let store = InMemoryRecoveryStore()
        let client = ScriptedLaunchClient(launch: .lostResponse)
        let launcher = coordinator(client: client, store: store)
        let first = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-one")
        XCTAssertEqual(first.state, .transmissionFailed)

        // Move the valid record under a different nonce's key in the same scope.
        let source = LaunchCoordinator.key(tenantId: "cambium", principal: "founder-1", workId: "sapling:cambium", nonce: "nonce-one")
        let moved = LaunchCoordinator.key(tenantId: "cambium", principal: "founder-1", workId: "sapling:cambium", nonce: "nonce-moved")
        let dataOpt = try await store.load(key: source)
        let data = try XCTUnwrap(dataOpt)
        try await store.remove(key: source)
        try await store.save(data, key: moved)

        do { _ = try await launcher.launch(capability: LaunchFixtures.capability(), idempotencyNonce: "nonce-fresh"); XCTFail("expected corruptRecord") }
        catch { XCTAssertEqual(error as? LaunchError, .corruptRecord) }
        do { _ = try await launcher.pendingRecoveries(); XCTFail("expected corruptRecord") }
        catch { XCTAssertEqual(error as? LaunchError, .corruptRecord) }
        do { _ = try await launcher.recover(workId: "sapling:cambium", idempotencyNonce: "nonce-moved"); XCTFail("expected corruptRecord") }
        catch { XCTAssertEqual(error as? LaunchError, .corruptRecord) }
        let sent = await client.sent.count
        XCTAssertEqual(sent, 1, "no new nonce can be sent while a relocated record exists")
    }
}
