import XCTest
@testable import CambiumCore
@testable import CambiumNative

/// Holds one owner request until the test releases it.
actor RequestGate {
    private var open = false
    private(set) var reached = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func hold() async {
        reached = true
        if open { return }
        await withCheckedContinuation { waiters.append($0) }
    }

    func release() {
        open = true
        waiters.forEach { $0.resume() }
        waiters = []
    }

    func isReached() -> Bool { reached }
}

/// App-model integration over the real coordinators, the real HTTP clients and
/// the bundled source wire fixtures. The owner is the in-process demo simulator.
@MainActor
final class OwnerIntegrationTests: XCTestCase {
    private var directory: URL!

    override func setUp() async throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("cambium-native-test-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: directory)
    }

    // MARK: Helpers

    private func makeServices(latency: (@Sendable (String) async -> Void)? = nil) throws -> CambiumOwnerServices {
        try XCTUnwrap(CambiumOwnerServices.demo(directory: directory, latency: latency))
    }

    /// A new model over a new service stack on the same demo directory: an app restart.
    private func openApp(latency: (@Sendable (String) async -> Void)? = nil) throws -> AppModel {
        AppModel(mode: .demo, services: try makeServices(latency: latency))
    }

    private func until(_ what: String, timeout: Int = 250, _ condition: () -> Bool) async throws {
        for _ in 0..<timeout {
            if condition() { return }
            try await Task.sleep(for: .milliseconds(20))
        }
        XCTFail("timed out waiting for \(what)")
    }

    private func ready(_ model: AppModel) async throws {
        try await until("fabric, review and pending lists") { model.review != nil && model.fabric != nil && !model.loading }
        try await Task.sleep(for: .milliseconds(150))
    }

    private func ownerWrites() async -> (decisions: Int, launches: Int) {
        let reader = DemoOwnerSimulator(directory: directory.appendingPathComponent("owner", isDirectory: true))
        return (await reader.durableDecisionWrites(), await reader.durableLaunchWrites())
    }

    private func decide(_ model: AppModel) async throws {
        model.reviewTyped = try XCTUnwrap(model.review).approveConfirmation
        model.confirmReview()
    }

    // MARK: Review

    @MainActor
    func testFullReviewShowsSourceTupleAndConfirmsExactlyOnce() async throws {
        let model = try openApp()
        try await ready(model)

        let review = try XCTUnwrap(model.review)
        XCTAssertEqual(review.proposalId, CambiumOwnerServices.proposalId)
        XCTAssertEqual(review.tenantId, "cambium")
        XCTAssertEqual(review.version, 1)
        XCTAssertEqual(review.nonce, "nonce-1")
        XCTAssertEqual(review.expiresAt, "2026-07-28T10:00:00.000Z")
        XCTAssertEqual(review.changeDigest, "sha256:8308316077022b85aa6e8961285751942d441b3d5129953dfebaaf13c1b05847")
        XCTAssertEqual(review.consequence, "Creates one node")
        XCTAssertEqual(review.reversibility, "Rejectable before commit")
        XCTAssertEqual(review.graphVersion, 8)
        XCTAssertEqual(review.sourceRef, "telegram:intake/1")
        XCTAssertEqual(review.changes.count, 1)
        XCTAssertTrue(review.changes[0].field.contains("gg-new"))
        XCTAssertFalse(review.changeSetJSON.isEmpty)

        let vectors = try XCTUnwrap(SourceFixtures.verified("founder-vectors"))
        let expected = try XCTUnwrap(JSONSerialization.jsonObject(with: vectors) as? [String: Any])["approveConfirmation"] as? String
        XCTAssertEqual(model.requiredPhrase, expected)

        model.reviewTyped = String(review.approveConfirmation.dropLast())
        XCTAssertFalse(model.typedMatches)
        model.confirmReview()
        try await Task.sleep(for: .milliseconds(150))
        XCTAssertNil(model.gate)
        let none = await ownerWrites()
        XCTAssertEqual(none.decisions, 0)

        try await decide(model)
        try await until("recorded decision") { model.gate?.recorded == true }
        let gate = try XCTUnwrap(model.gate)
        XCTAssertEqual(gate.state, "recorded")
        XCTAssertEqual(gate.choice, "approved")
        XCTAssertFalse(gate.needsStatusCheck)
        XCTAssertNotNil(gate.receiptDigest)
        XCTAssertEqual(model.reviewTyped, "", "the typed confirmation is not kept")
        let writes = await ownerWrites()
        XCTAssertEqual(writes.decisions, 1)

        let reopened = try openApp()
        try await ready(reopened)
        try await until("stored decision after restart") { reopened.gate?.recorded == true }
        let again = await ownerWrites()
        XCTAssertEqual(again.decisions, 1)
    }

    @MainActor
    func testApprovalDoesNotCreateAdmissionOrCapability() async throws {
        let model = try openApp()
        try await ready(model)
        try await decide(model)
        try await until("recorded decision") { model.gate?.recorded == true }
        XCTAssertNil(model.capability, "approval must not produce a launch capability")
        XCTAssertNil(model.launch)
        XCTAssertTrue(model.pendingLaunch.isEmpty)
        let writes = await ownerWrites()
        XCTAssertEqual(writes.launches, 0)
    }

    @MainActor
    func testResponseLossAfterOwnerRecordedRecoversByStatusOnly() async throws {
        let model = try openApp()
        try await ready(model)
        model.armFault()
        try await until("armed fault") { model.faultArmed }

        try await decide(model)
        try await until("unknown outcome") { model.gate != nil }
        XCTAssertEqual(model.gate?.state, "outcomeUnknown")
        XCTAssertEqual(model.gate?.needsStatusCheck, true)
        let before = await ownerWrites()
        XCTAssertEqual(before.decisions, 1)

        let restarted = try openApp()
        try await ready(restarted)
        XCTAssertEqual(restarted.pendingGate.count, 1)
        XCTAssertEqual(restarted.pendingGate.first?.nonce, "nonce-1")
        restarted.recoverReview()
        try await until("status read") { restarted.gate?.recorded == true }
        XCTAssertEqual(restarted.gate?.nonce, "nonce-1")
        XCTAssertTrue(restarted.pendingGate.isEmpty)

        let after = await ownerWrites()
        XCTAssertEqual(after.decisions, 1, "status recovery must not record a second decision")
    }

    @MainActor
    func testRecordedRecoveryRecordHoldsNoReviewOrConfirmationText() async throws {
        let model = try openApp()
        try await ready(model)
        try await decide(model)
        try await until("recorded decision") { model.gate?.recorded == true }
        let review = try XCTUnwrap(model.review)

        var combined = ""
        let root = directory.appendingPathComponent("recovery", isDirectory: true)
        for name in try FileManager.default.contentsOfDirectory(atPath: root.path) {
            combined += String(decoding: try Data(contentsOf: root.appendingPathComponent(name)), as: UTF8.self)
        }
        combined += (try? String(contentsOf: directory.appendingPathComponent("owner/\(DemoOwnerSimulator.fileName)"), encoding: .utf8)) ?? ""
        XCTAssertFalse(combined.isEmpty)
        XCTAssertFalse(combined.contains(review.summary))
        XCTAssertFalse(combined.contains(review.consequence))
        XCTAssertFalse(combined.contains("Bearer"))
        XCTAssertFalse(combined.contains(review.approveConfirmation))
    }

    // MARK: Launch

    @MainActor
    func testLaunchSeparatesTransportExecutionAndAcceptanceAndRecovers() async throws {
        let model = try openApp()
        try await ready(model)

        model.inspectCapability()
        try await until("capability") { model.capability != nil }
        let capability = try XCTUnwrap(model.capability)
        XCTAssertEqual(capability.workId, "sapling:cambium")
        XCTAssertEqual(capability.admissionRef, "adm-123")
        XCTAssertEqual(capability.graphVersion, 1)
        XCTAssertEqual(capability.loadoutId, "loadout-alpha")
        XCTAssertEqual(capability.inputDigest, "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        XCTAssertEqual(capability.plantName, "Hands")
        XCTAssertEqual(capability.action, "launch")

        model.requestLaunch()
        try await until("queued launch") { model.launch != nil }
        let queued = try XCTUnwrap(model.launch)
        XCTAssertEqual(queued.execution, "queued")
        XCTAssertEqual(queued.acceptance, "not_evaluated")
        XCTAssertFalse(queued.requestId.isEmpty)
        let request = queued.requestId
        let attempt = queued.attemptId

        let restarted = try openApp()
        try await ready(restarted)
        XCTAssertEqual(restarted.pendingLaunch.count, 1)

        restarted.recoverLaunch()
        try await until("running") { restarted.launch?.execution == "running" }
        restarted.recoverLaunch()
        try await until("succeeded") { restarted.launch?.execution == "succeeded" }
        XCTAssertEqual(restarted.launch?.requestId, request)
        XCTAssertEqual(restarted.launch?.attemptId, attempt)
        XCTAssertEqual(restarted.launch?.acceptance, "not_evaluated")
        let sim = await ownerDirectory()
        let simulator = try XCTUnwrap(sim)
        let launches = await simulator.durableLaunchWrites()
        XCTAssertEqual(launches, 1, "recovery must not submit a second launch")
    }

    func testUnavailableAdmissionIsNotInventedFromApproval() async throws {
        let services = try makeServices()
        let client = HTTPLaunchClient(baseURL: URL(string: "https://demo-owner.invalid")!,
                                      transport: DemoOwnerSimulator(directory: directory.appendingPathComponent("owner-other")),
                                      authorizer: DemoAuthorizer())
        let session = PinnedSessionProvider(.verified(founderId: "founder-1", tenantId: "cambium",
                                                      expiresAt: CanonicalTimestamp.parse("2026-07-28T10:00:00.000Z")!))
        let clock = FixedCoreClock(date: CanonicalTimestamp.parse(CambiumOwnerServices.replay)!)
        do {
            _ = try await client.resolveCapability(workId: "sapling:other", admissionRef: "adm-from-approval", session: session, clock: clock)
            XCTFail("an admission the owner never issued was accepted")
        } catch LaunchError.capabilityUnavailable(let reason) {
            XCTAssertEqual(reason, "no_admission")
        }
        _ = services
    }

    @MainActor
    func testLostLaunchReplyKeepsOriginalRequestAcrossRestartWithZeroDuplicateSubmit() async throws {
        let model = try openApp()
        try await ready(model)
        model.inspectCapability()
        try await until("capability") { model.capability != nil }
        model.armFault()
        try await until("armed fault") { model.faultArmed }

        model.requestLaunch()
        try await until("unknown launch") { model.launch != nil }
        let lost = try XCTUnwrap(model.launch)
        XCTAssertEqual(lost.state, "transmissionFailed")
        XCTAssertTrue(lost.needsStatusCheck)
        let first = await ownerWrites()
        XCTAssertEqual(first.launches, 1)

        let restarted = try openApp()
        try await ready(restarted)
        XCTAssertEqual(restarted.pendingLaunch.count, 1)
        let pending = try XCTUnwrap(restarted.pendingLaunch.first)
        XCTAssertEqual(pending.requestId, lost.requestId)
        XCTAssertEqual(pending.attemptId, lost.attemptId)
        XCTAssertEqual(pending.nonce, lost.nonce)

        restarted.recoverLaunch()
        try await until("status read") { restarted.launch?.execution == "running" }
        XCTAssertEqual(restarted.launch?.requestId, lost.requestId)
        XCTAssertEqual(restarted.launch?.attemptId, lost.attemptId)
        XCTAssertEqual(restarted.launch?.acceptance, "not_evaluated")

        restarted.requestLaunch()
        try await Task.sleep(for: .milliseconds(200))
        let after = await ownerWrites()
        XCTAssertEqual(after.launches, 1, "no second submit after recovery")
    }

    @MainActor
    func testResetIsBlockedWhileAttemptIsUnknownAndNeverSendsAnything() async throws {
        let model = try openApp()
        try await ready(model)
        model.armFault()
        try await until("armed fault") { model.faultArmed }
        try await decide(model)
        try await until("unknown outcome") { model.gate?.needsStatusCheck == true }
        let before = await ownerWrites()

        model.resetDemo()
        try await Task.sleep(for: .milliseconds(200))
        XCTAssertEqual(model.gate?.needsStatusCheck, true)
        let after = await ownerWrites()
        XCTAssertEqual(after.decisions, before.decisions)
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent("recovery").path))
    }

    // MARK: Scope

    @MainActor
    func testModeSwitchWhileLaunchIsInFlightPublishesNothingFromTheOldScope() async throws {
        let gate = RequestGate()
        let model = try openApp { path in
            if path == "/v1/native/launch" { await gate.hold() }
        }
        try await ready(model)
        model.inspectCapability()
        try await until("capability") { model.capability != nil }
        model.requestLaunch()
        try await until("loading") { model.loading == true }
        for _ in 0..<100 {
            let reached = await gate.isReached()
            if reached { break }
            try await Task.sleep(for: .milliseconds(20))
        }
        let reached = await gate.isReached()
        XCTAssertTrue(reached)

        model.leaveDemo()
        await gate.release()
        try await Task.sleep(for: .milliseconds(300))
        XCTAssertFalse(model.isDemo)
        XCTAssertNil(model.launch)
        XCTAssertNil(model.capability)
        XCTAssertNil(model.review)
        XCTAssertNil(model.fabric)
        XCTAssertTrue(model.pendingLaunch.isEmpty)
    }

    @MainActor
    func testSignOutClearsDataAndActionStateImmediately() async throws {
        let model = try openApp()
        try await ready(model)
        model.inspectCapability()
        try await until("capability") { model.capability != nil }
        model.signOut()
        XCTAssertNil(model.session)
        XCTAssertNil(model.review)
        XCTAssertNil(model.capability)
        XCTAssertNil(model.fabric)
        XCTAssertTrue(model.knowledge.isEmpty)
        model.requestLaunch()
        model.confirmReview()
        try await Task.sleep(for: .milliseconds(200))
        XCTAssertNil(model.launch)
        XCTAssertNil(model.gate)
        let writes = await ownerWrites()
        XCTAssertEqual(writes.launches, 0)
        XCTAssertEqual(writes.decisions, 0)
    }

    @MainActor
    func testStandardModeStaysHonestlyUnconfigured() async throws {
        let model = AppModel(mode: .standard)
        try await Task.sleep(for: .milliseconds(300))
        XCTAssertFalse(model.isDemo)
        XCTAssertNil(model.configuration)
        XCTAssertNil(model.session)
        XCTAssertNil(model.review)
        XCTAssertNil(model.fabric)
        XCTAssertTrue(model.snapshot.work.isEmpty)
        XCTAssertTrue(model.knowledge.isEmpty)
        XCTAssertNil(model.replayClock)

        model.requestLaunch()
        model.inspectCapability()
        model.signIn()
        try await Task.sleep(for: .milliseconds(300))
        XCTAssertNil(model.capability)
        XCTAssertNil(model.launch)
        XCTAssertNil(model.session)
    }

    func testStandardServicesRefuseEverythingWithoutOwnerConfiguration() async throws {
        let standard = try XCTUnwrap(CambiumOwnerServices.standard(configuration: nil, browser: nil))
        if case .success = await standard.signIn() { XCTFail("unconfigured sign-in succeeded") }
        if case .success = await standard.readFabric() { XCTFail("unconfigured fabric read succeeded") }
        if case .success = await standard.loadReview() { XCTFail("unconfigured review succeeded") }
        if case .success = await standard.inspectCapability() { XCTFail("unconfigured capability succeeded") }
        let knowledge = await standard.loadKnowledge()
        if case .success = knowledge.fieldTheory { XCTFail("unconfigured Field Theory read succeeded") }
        if case .success = knowledge.fieldReport { XCTFail("unconfigured Field Report read succeeded") }
    }

    // MARK: Fabric and knowledge

    @MainActor
    func testFabricRendersProducerRelationshipsSidecarsAndReplayClock() async throws {
        let model = try openApp()
        try await ready(model)
        let fabric = try XCTUnwrap(model.fabric)

        XCTAssertEqual(fabric.tenantId, "cambium")
        XCTAssertEqual(fabric.freshness, "fresh")
        XCTAssertEqual(fabric.asOf, "2026-07-28T09:00:00.000Z")
        XCTAssertEqual(fabric.servedAt, "2026-07-28T09:00:00.000Z")
        XCTAssertEqual(Set(fabric.trace.nodes.map(\.kind)), ["work", "task", "agent", "cluster", "run", "receipt"])
        let kinds = Set(fabric.trace.edges.map(\.kind))
        XCTAssertTrue(kinds.isSuperset(of: ["assigned-to", "executes", "produces", "proves", "requires-cluster"]))
        XCTAssertTrue(fabric.trace.edges.contains { $0.from == "run-fabric-current" && $0.to == "receipt-fabric-contract" && $0.kind == "produces" })
        XCTAssertTrue(fabric.trace.edges.allSatisfy { fabric.trace.node($0.from) != nil && fabric.trace.node($0.to) != nil })

        XCTAssertEqual(fabric.sidecars.catalogTotal, 76)
        XCTAssertEqual(fabric.sidecars.actionAdmission, "none")
        XCTAssertEqual(fabric.sidecars.joinMatched, 1)
        XCTAssertEqual(fabric.sidecars.joinCatalogOrphans, 72)
        XCTAssertNotEqual(fabric.sidecars.catalogDigest, fabric.graphDigest)
        XCTAssertTrue(fabric.sidecars.organDeliveryPresent)

        XCTAssertTrue(fabric.gaps.contains { $0.kind == "accepted-result-unavailable" })
        XCTAssertEqual(model.replayClock, CambiumOwnerServices.replay)
        XCTAssertEqual(model.snapshot.work.count, 3)
        XCTAssertTrue(model.unattachedEvidence.contains { $0.id == "receipt-fabric-contract" })
    }

    @MainActor
    func testKnowledgeStaysSourceSpecificAndNeverBecomesAdmission() async throws {
        let model = try openApp()
        try await ready(model)
        let theory = model.knowledge.filter { $0.source == .fieldTheory }
        let report = model.knowledge.filter { $0.source == .fieldReport }
        XCTAssertEqual(theory.count, 2)
        XCTAssertEqual(report.count, 1)
        XCTAssertTrue(theory.contains { $0.meaning == "proposal" })
        XCTAssertEqual(report.first?.meaning, "observation")
        XCTAssertNotEqual(theory.first?.source, report.first?.source)
        XCTAssertNil(model.capability, "reading knowledge creates no capability")
        let writes = await ownerWrites()
        XCTAssertEqual(writes.launches + writes.decisions, 0)
    }

    func testKnowledgeReadersRejectEachOthersExports() async throws {
        let session = PinnedSessionProvider(.verified(founderId: "founder-1", tenantId: "cambium",
                                                      expiresAt: CanonicalTimestamp.parse("2026-07-28T10:00:00.000Z")!))
        let clock = FixedCoreClock(date: CanonicalTimestamp.parse(CambiumOwnerServices.replay)!)
        let store = KnowledgeSnapshotStore(sessionProvider: session, clock: clock, cacheTTL: 3600)
        let theory = try XCTUnwrap(SourceFixtures.verified("knowledge-field-theory-demo"))
        let report = try XCTUnwrap(SourceFixtures.verified("knowledge-field-report-demo"))
        do {
            _ = try await store.loadFieldReport(exportJSON: theory, tenantId: "cambium", reader: SuppliedFieldReportReader())
            XCTFail("a Field Theory export was read as Field Report")
        } catch KnowledgeError.sourceMismatch {}
        do {
            _ = try await store.loadFieldTheory(exportJSON: report, tenantId: "cambium", reader: SuppliedFieldTheoryReader())
            XCTFail("a Field Report export was read as Field Theory")
        } catch KnowledgeError.sourceMismatch {}
    }

    // MARK: Lineage and configuration

    func testFixtureLineageMatchesBundledBytes() throws {
        let rows = SourceFixtures.lineage()
        XCTAssertGreaterThanOrEqual(rows.count, 8)
        XCTAssertTrue(rows.allSatisfy(\.verified))
        XCTAssertEqual(rows.filter(\.synthetic).count, 2)
    }

    func testOwnerConfigurationValidationAndDefaultNil() {
        let reviewed = OwnerConfiguration.reviewedRedirect
        func validate(_ url: String, tenant: String = "cambium", client: String = "cambium-native", redirect: String = reviewed) -> OwnerConfiguration.Problem? {
            if case .failure(let problem) = OwnerConfiguration.validate(ownerURL: url, tenant: tenant, clientId: client, redirect: redirect) { return problem }
            return nil
        }
        XCTAssertNil(validate("https://owner.example.test"))
        XCTAssertEqual(validate("http://owner.example.test"), .ownerURL)
        XCTAssertEqual(validate("https://user:secret@owner.example.test"), .ownerURL)
        XCTAssertEqual(validate("https://owner.example.test?token=x"), .ownerURL)
        XCTAssertEqual(validate("https://owner.example.test", tenant: "Not Valid"), .tenant)
        XCTAssertEqual(validate("https://owner.example.test", client: "short"), .clientId)
        XCTAssertEqual(validate("https://owner.example.test", redirect: "https://evil.example.test/cb"), .redirect)
    }

    @MainActor
    func testSavingConfigurationContactsNothingAndNeverSignsIn() async throws {
        let model = AppModel(mode: .standard)
        model.ownerURLDraft = "https://owner.example.test"
        model.tenantDraft = "cambium"
        model.clientIDDraft = "cambium-native"
        model.applyConfiguration()
        XCTAssertNotNil(model.configuration)
        try await Task.sleep(for: .milliseconds(300))
        XCTAssertNil(model.session, "saving a configuration must not sign in")
        XCTAssertNil(model.fabric)
        XCTAssertNil(model.review)
    }

    private func ownerDirectory() async -> DemoOwnerSimulator? {
        DemoOwnerSimulator(directory: directory.appendingPathComponent("owner", isDirectory: true))
    }
}
