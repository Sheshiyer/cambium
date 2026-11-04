import XCTest
@testable import CambiumCore
@testable import CambiumNative

/// Focused gates for the native finish:
/// 1. Demo reset's visual disabled state counts the pending arrays restored on opening.
/// 2. "Retry original request" exists only for a saved proved-absent record, resends the
///    same request, attempt and nonce, and is never triggered by Check status.
@MainActor
final class LaunchRetryAndResetTests: XCTestCase {
    private var directory: URL!

    override func setUp() async throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("cambium-native-retry-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func openApp() throws -> AppModel {
        AppModel(mode: .demo, services: try XCTUnwrap(CambiumOwnerServices.demo(directory: directory)))
    }

    private func until(_ what: String, timeout: Int = 250, _ condition: () -> Bool) async throws {
        for _ in 0..<timeout {
            if condition() { return }
            try await Task.sleep(for: .milliseconds(20))
        }
        XCTFail("timed out waiting for \(what)")
    }

    private func ready(_ model: AppModel) async throws {
        try await until("fabric") { model.fabric != nil && !model.loading }
        try await Task.sleep(for: .milliseconds(150))
    }

    private func resolveSupported(_ model: AppModel) async throws {
        model.selectWork(CambiumOwnerServices.workId)
        model.listAdmissions()
        try await until("admissions") { !model.admissions.isEmpty && !model.loading }
        model.selectAdmission(CambiumOwnerServices.admissionRef)
        model.resolveSelectedCapability()
        try await until("capability") { model.capability != nil && !model.loading }
    }

    private var ownerDirectory: URL { directory.appendingPathComponent("owner", isDirectory: true) }

    private func ownerLaunchWrites() async -> Int {
        await DemoOwnerSimulator(directory: ownerDirectory).durableLaunchWrites()
    }

    /// Launches with the reply dropped, so only the local saved attempt knows the IDs.
    private func lostLaunch() async throws -> LaunchDisplay {
        let model = try openApp()
        try await ready(model)
        try await resolveSupported(model)
        model.armFault()
        try await until("armed") { model.faultArmed }
        model.requestLaunch()
        try await until("lost launch") { model.launch?.needsStatusCheck == true && !model.loading }
        return try XCTUnwrap(model.launch)
    }

    /// The owner loses its row (its file is cleared); the local recovery folder is
    /// untouched. A restarted app then reads `404 not_found` for the exact IDs.
    private func provedAbsentAfterRestart() async throws -> (AppModel, LaunchDisplay) {
        let lost = try await lostLaunch()
        await DemoOwnerSimulator(directory: ownerDirectory).reset()
        let restarted = try openApp()
        try await ready(restarted)
        try await until("pending restored") { !restarted.pendingLaunch.isEmpty }
        XCTAssertEqual(restarted.launch?.ownerAbsent, false, "a lost reply alone is not an absence proof")
        restarted.recoverLaunch(nonce: lost.nonce)
        try await until("proved absent") { restarted.launch?.ownerAbsent == true && !restarted.loading }
        return (restarted, lost)
    }

    // MARK: Reset visual gate

    func testResetVisualDisabledStateCountsPendingArraysRestoredOnOpening() async throws {
        _ = try await lostLaunch()
        let restarted = try openApp()
        try await ready(restarted)
        try await until("pending restored") { !restarted.pendingLaunch.isEmpty }
        XCTAssertTrue(restarted.resetVisuallyBlocked)

        restarted.hideVisibleAttemptsForTest()
        XCTAssertFalse(restarted.resetVisuallyBlocked, "only the visible fields drive the visual state")
        restarted.resetDemo()
        try await Task.sleep(for: .milliseconds(300))
        let probe = try XCTUnwrap(CambiumOwnerServices.demo(directory: directory))
        let blocked = await probe.hasUnresolvedAttempt()
        XCTAssertTrue(blocked, "the durable store still refused the reset")
    }

    // MARK: Retry gating

    func testRetryIsRefusedWithoutAbsenceProofAndSendsNothing() async throws {
        let lost = try await lostLaunch()
        XCTAssertFalse(lost.ownerAbsent)
        let before = await ownerLaunchWrites()

        let restarted = try openApp()
        try await ready(restarted)
        try await until("pending restored") { !restarted.pendingLaunch.isEmpty }
        restarted.retryOriginalLaunch(nonce: lost.nonce)
        try await until("refused") { restarted.issue?.kind == .refused && !restarted.loading }
        let after = await ownerLaunchWrites()
        XCTAssertEqual(after, before, "no resend without a 404 not_found proof")
        XCTAssertEqual(restarted.launch?.requestId, lost.requestId)

        // An existing owner row (status observed) never produces the proof.
        restarted.recoverLaunch(nonce: lost.nonce)
        try await until("observed") { restarted.launch?.execution == "running" && !restarted.loading }
        XCTAssertEqual(restarted.launch?.ownerAbsent, false)
    }

    func testCheckStatusNeverAutoRetriesAfterAbsenceProof() async throws {
        let (restarted, lost) = try await provedAbsentAfterRestart()
        let writes = await ownerLaunchWrites()
        XCTAssertEqual(writes, 0, "the status read proved absence and sent no launch")
        XCTAssertEqual(restarted.launch?.requestId, lost.requestId)
        XCTAssertEqual(restarted.launch?.attemptId, lost.attemptId)
        XCTAssertEqual(restarted.launch?.state, "transmissionFailed")
        XCTAssertTrue(restarted.pendingLaunch.first?.ownerAbsent == true)
    }

    // MARK: Retry identity, duplicates and restart

    func testRetryAfterRestartResendsIdenticalIdsExactlyOnce() async throws {
        let (proved, lost) = try await provedAbsentAfterRestart()

        // A second restart: the action needs only the saved record, no new capability or listing.
        let reopened = try openApp()
        try await ready(reopened)
        try await until("pending restored") { reopened.pendingLaunch.first?.ownerAbsent == true }
        _ = proved
        XCTAssertNil(reopened.capability)
        XCTAssertTrue(reopened.admissions.isEmpty)
        XCTAssertEqual(reopened.launch?.capabilityExpiresAt, "2026-11-02T01:00:00.000Z")

        reopened.retryOriginalLaunch(nonce: lost.nonce)
        try await until("resent") { reopened.launch?.state == "queued" && !reopened.loading }
        let sent = try XCTUnwrap(reopened.launch)
        XCTAssertEqual(sent.requestId, lost.requestId)
        XCTAssertEqual(sent.attemptId, lost.attemptId)
        XCTAssertEqual(sent.nonce, lost.nonce)
        XCTAssertFalse(sent.ownerAbsent)
        XCTAssertEqual(sent.acceptance, "not_evaluated", "transport and acceptance stay separate")
        let once = await ownerLaunchWrites()
        XCTAssertEqual(once, 1)

        // The proof is spent. A repeated tap is refused and sends nothing.
        reopened.retryOriginalLaunch(nonce: lost.nonce)
        try await Task.sleep(for: .milliseconds(300))
        let still = await ownerLaunchWrites()
        XCTAssertEqual(still, 1, "no duplicate submit")
        XCTAssertEqual(reopened.launch?.requestId, lost.requestId)
    }
    func testResolvedDirectionPreparationCanBeReplacedButUnknownPreparationIsRetained() async throws {
        let model = try openApp(); try await ready(model)
        let digest = String(repeating:"a",count:64)
        let preparedData = try JSONSerialization.data(withJSONObject:["schema":"cambium.direction-proposal.v1","tenantId":"cambium","principal":"founder","directionId":"direction-1","directionRevision":1,"workObjectId":"sapling:cambium","proposalId":"cambium:"+digest,"changeDigest":digest,"duplicate":false,"writerAuthority":false,"executionGranted":false])
        let prepared = try JSONDecoder().decode(PreparedDirectionExecution.self,from:preparedData)
        model.directionExecutionDraft = DirectionExecutionDraftState(directionID:"direction-1",prepared:prepared)
        XCTAssertTrue(model.resetDirectionExecutionReview()); XCTAssertNil(model.directionExecutionDraft.prepared)
        // A prepared reply and an uncertain original request are distinct states.
        let previewData = try JSONSerialization.data(withJSONObject:["schema":"cambium.direction-execution-preview.v1","tenantId":"cambium","principal":"founder","directionId":"direction-1","directionRevision":1,"expectedHeadDigest":digest,"policyDigest":"sha256:"+digest,"writerAuthority":false,"executionGranted":false,"summary":["objective":"Title","artifact":"Patch","baseCommit":String(repeating:"a",count:40),"patchDigest":"sha256:"+digest,"allowedPaths":[],"check":"test","timeoutSeconds":180,"modelPool":"noesis-free","acceptance":"review-required","externalActions":"none"]])
        let preview = try JSONDecoder().decode(DirectionExecutionPreview.self,from:previewData)
        let pending = DirectionExecutionPrepare(operationId:"original-unknown",preview:preview)
        model.directionExecutionDraft = DirectionExecutionDraftState(directionID:"direction-1",preview:preview,pending:pending,prepared:prepared)
        XCTAssertFalse(model.resetDirectionExecutionReview()); XCTAssertEqual(model.directionExecutionDraft.pending,pending)
        XCTAssertEqual(model.directionExecutionDraft.prepared,prepared)
    }

}
