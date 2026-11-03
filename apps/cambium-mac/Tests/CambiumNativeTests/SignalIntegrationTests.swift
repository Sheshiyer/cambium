import XCTest
@testable import CambiumCore
@testable import CambiumNative

@MainActor
final class SignalIntegrationTests: XCTestCase {
    func testUncertainOperationsLockDraftUntilResolved() {
        let source = SignalSource(system: "cambium-native", recordId: "source", version: "1", reference: nil, observedAt: CambiumOwnerServices.replay)
        let capture = SignalCapture(operationId: "original-capture", title: "T", body: "B", source: source, projectIds: [])
        let update = SignalUpdate(operationId: "original-update", expectedRevision: 1, title: "T", body: "B", projectIds: [])
        XCTAssertFalse(InboxDraft.isLocked(capture: nil, update: nil))
        XCTAssertTrue(InboxDraft.isLocked(capture: capture, update: nil))
        XCTAssertTrue(InboxDraft.isLocked(capture: nil, update: update))
        let retained = InboxDraft(title: "T", body: "B", capture: capture, hasStarted: true)
        XCTAssertEqual(retained.capture, capture)
        XCTAssertEqual(retained.capture?.operationId, "original-capture")
        XCTAssertTrue(InboxDraft.isDefinitiveRejection(SignalError.status(400)))
        XCTAssertTrue(InboxDraft.isDefinitiveRejection(SignalError.status(409)))
        XCTAssertTrue(InboxDraft.isDefinitiveRejection(SignalError.invalidRequest))
        XCTAssertFalse(InboxDraft.isDefinitiveRejection(SignalError.invalid), "Malformed success responses must retain the original operation")
        XCTAssertFalse(InboxDraft.isDefinitiveRejection(SignalError.status(503)))
        XCTAssertFalse(InboxDraft.isDefinitiveRejection(TransportFailure.timeout))
    }
    func testOwnerRecoveryNamespacesIsolateAndPreserveRecords() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        func directory(_ endpoint: String) throws -> URL {
            CambiumOwnerServices.standardRecoveryDirectory(support: root, origin: try HTTPOriginPolicy(url: XCTUnwrap(URL(string: endpoint))))
        }
        let a = try directory("https://OWNER.invalid/api/")
        XCTAssertEqual(a, try directory("https://owner.invalid:443/api"))
        XCTAssertEqual(try directory("https://owner.invalid"), try directory("https://owner.invalid/"))
        let others = try ["https://other.invalid/api", "https://owner.invalid/other", "https://owner.invalid:8443/api"].map(directory)
        XCTAssertTrue(others.allSatisfy { $0 != a })
        let key = "launch/cambium/founder/same-work", payload = Data("owner-a-pending".utf8)
        let store = FileRecoveryStore(directory: a)
        try await store.save(payload, key: key)
        for other in others {
            let loaded = try await FileRecoveryStore(directory: other).load(key: key)
            XCTAssertNil(loaded)
        }
        let restored = try await FileRecoveryStore(directory: try directory("https://owner.invalid/api")).load(key: key)
        XCTAssertEqual(restored, payload)
        let legacy = root.appendingPathComponent("space.thoughtseed.cambium.native.dev/standard-recovery-v1")
        try await FileRecoveryStore(directory: legacy).save(Data("unknown-owner".utf8), key: "legacy")
        let adopted = try await store.load(key: "legacy")
        let retainedLegacy = try await FileRecoveryStore(directory: legacy).load(key: "legacy")
        XCTAssertNil(adopted)
        XCTAssertEqual(retainedLegacy, Data("unknown-owner".utf8))
    }
    func testRevisionConflictCanReadLatestWithoutOverwritingIt() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let service = try XCTUnwrap(CambiumOwnerServices.demo(directory: root))
        let original = try await service.signalRead("demo-signal-1").signal
        let saved = try await service.signalUpdate(original.id, value: SignalUpdate(operationId: "peer-update", expectedRevision: original.revision, title: "Peer edit", body: original.body, projectIds: original.projectIds))
        do {
            _ = try await service.signalUpdate(original.id, value: SignalUpdate(operationId: "stale-update", expectedRevision: original.revision, title: "My draft", body: original.body, projectIds: original.projectIds))
            XCTFail("A stale edit must conflict")
        } catch { XCTAssertEqual(error as? SignalError, .status(409)) }
        let draft = InboxDraft(selected: original, title: "My draft", hasStarted: true, conflict: true)
        XCTAssertEqual(draft.title, "My draft")
        XCTAssertTrue(draft.conflict, "Conflict review survives navigation in the retained draft")
        let latest = try await service.signalRead(original.id).signal
        XCTAssertEqual(latest.revision, saved.signal.revision)
        XCTAssertEqual(latest.title, "Peer edit")
    }
    func testSyntheticCaptureUpdateAndProjectFilter() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let service = try XCTUnwrap(CambiumOwnerServices.demo(directory: directory))
        let initial = try await service.signalList(project: "sapling:cambium")
        XCTAssertTrue(initial.signals.contains { $0.id == "demo-signal-1" })
        let source = SignalSource(system: "cambium-native", recordId: UUID().uuidString, version: "1", reference: nil, observedAt: CambiumOwnerServices.replay)
        let capture = SignalCapture(operationId: UUID().uuidString, title: "Synthetic test", body: "Context", source: source, projectIds: ["sapling:cambium"])
        let created = try await service.signalCapture(capture)
        let replay = try await service.signalCapture(capture)
        XCTAssertEqual(created.signal.id, replay.signal.id); XCTAssertTrue(replay.replayed)
        let updated = try await service.signalUpdate(created.signal.id, value: SignalUpdate(operationId: UUID().uuidString, expectedRevision: 1, title: "Edited", body: "Context", projectIds: []))
        XCTAssertEqual(updated.signal.revision, 2)
        let filtered = try await service.signalList(project: "sapling:cambium")
        XCTAssertFalse(filtered.signals.contains { $0.id == created.signal.id })
        let all = try await service.signalList(project: nil)
        XCTAssertTrue(all.signals.contains { $0.id == created.signal.id })
        await service.resetDemo()
        let reset = try await service.signalList(project: nil)
        XCTAssertEqual(reset.signals.map(\.id), ["demo-signal-1"])
        let afterReset = try await service.signalCapture(capture)
        XCTAssertFalse(afterReset.replayed)
    }
}
