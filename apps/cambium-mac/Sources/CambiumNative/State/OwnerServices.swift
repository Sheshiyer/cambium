import Foundation
import CambiumCore

/// Shared Core composition for demo and standard. The demo uses the in-process
/// owner, a pinned synthetic session and a fixed replay clock. Standard mode
/// uses URLSession and the identity controller, which starts with no session.
@MainActor
final class CambiumOwnerServices: OwnerServices {
    let isDemo: Bool
    let replayClock: String?
    let supportsReject: Bool
    let ownerDescription: String

    private let session: any SessionProvider
    private let clock: any CoreClock
    private let gate: FounderGateCoordinator
    private let launchCoordinator: LaunchCoordinator
    private let launchClient: HTTPLaunchClient
    private let fabricStore: MissionFabricSnapshotStore
    private let knowledgeStore: KnowledgeSnapshotStore
    private let fieldTheory: any FieldTheoryReading
    private let fieldReport: any FieldReportReading
    private let theoryExport: Data?
    private let reportExport: Data?
    private let owner: DemoOwnerSimulator?
    private let identity: NativeIdentityController?
    private var recoveryDirectory: URL?
    private var review: GateReview?
    private var capability: LaunchCapability?
    private var launchNonce: String?
    private var generation: UInt64 = 0

    private init(isDemo: Bool, replayClock: String?, supportsReject: Bool, ownerDescription: String,
                 session: any SessionProvider, clock: any CoreClock, gate: FounderGateCoordinator,
                 launchCoordinator: LaunchCoordinator, launchClient: HTTPLaunchClient,
                 fabricStore: MissionFabricSnapshotStore, knowledgeStore: KnowledgeSnapshotStore,
                 fieldTheory: any FieldTheoryReading, fieldReport: any FieldReportReading,
                 theoryExport: Data?, reportExport: Data?, owner: DemoOwnerSimulator?,
                 identity: NativeIdentityController?, recoveryDirectory: URL?) {
        self.isDemo = isDemo
        self.replayClock = replayClock
        self.supportsReject = supportsReject
        self.ownerDescription = ownerDescription
        self.session = session
        self.clock = clock
        self.gate = gate
        self.launchCoordinator = launchCoordinator
        self.launchClient = launchClient
        self.fabricStore = fabricStore
        self.knowledgeStore = knowledgeStore
        self.fieldTheory = fieldTheory
        self.fieldReport = fieldReport
        self.theoryExport = theoryExport
        self.reportExport = reportExport
        self.owner = owner
        self.identity = identity
        self.recoveryDirectory = recoveryDirectory
    }

    // MARK: Factories

    static let founder = "founder-1"
    static let tenant = "cambium"
    static let proposalId = "cambium:sha256:8308316077022b85aa6e8961285751942d441b3d5129953dfebaaf13c1b05847"
    static let workId = "sapling:cambium"
    /// From the source launch fixture. It is the only admission the demo may use.
    static let admissionRef = "adm-123"
    /// Inside the source proposal window (expires 2026-07-28T10:00:00Z) and the launch window.
    static let replay = "2026-07-28T09:30:00.000Z"

    static func demo(directory: URL, latency: (@Sendable (String) async -> Void)? = nil) -> CambiumOwnerServices? {
        guard let now = CanonicalTimestamp.parse(replay),
              let origin = try? HTTPOriginPolicy(url: URL(string: "https://demo-owner.invalid")!) else { return nil }
        let clock = FixedCoreClock(date: now)
        let session = PinnedSessionProvider(.verified(founderId: founder, tenantId: tenant, expiresAt: now.addingTimeInterval(30 * 60)))
        let ownerDirectory = directory.appendingPathComponent("owner", isDirectory: true)
        let recoveryDirectory = directory.appendingPathComponent("recovery", isDirectory: true)
        let owner = DemoOwnerSimulator(directory: ownerDirectory, latency: latency)
        let base = URL(string: "https://demo-owner.invalid")!
        let authorizer = DemoAuthorizer()
        let store = FileRecoveryStore(directory: recoveryDirectory)
        return CambiumOwnerServices(
            isDemo: true, replayClock: replay, supportsReject: false,
            ownerDescription: "In-process demo owner. Source fixture replay. No live service.",
            session: session, clock: clock,
            gate: FounderGateCoordinator(client: HTTPFounderGateClient(baseURL: base, transport: owner, authorizer: authorizer),
                                         session: session, clock: clock, store: store),
            launchCoordinator: LaunchCoordinator(client: HTTPLaunchClient(baseURL: base, transport: owner, authorizer: authorizer),
                                                 session: session, clock: clock, store: store),
            launchClient: HTTPLaunchClient(baseURL: base, transport: owner, authorizer: authorizer),
            fabricStore: MissionFabricSnapshotStore(
                reader: MissionFabricHTTPClient(endpoint: MissionFabricEndpoint(origin: origin), transport: owner,
                                                authorizer: authorizer, sessionProvider: session, clock: clock),
                sessionProvider: session, clock: clock, cacheTTL: 60 * 60),
            knowledgeStore: KnowledgeSnapshotStore(sessionProvider: session, clock: clock, cacheTTL: 60 * 60),
            fieldTheory: SuppliedFieldTheoryReader(), fieldReport: SuppliedFieldReportReader(),
            theoryExport: SourceFixtures.verified("knowledge-field-theory-demo"),
            reportExport: SourceFixtures.verified("knowledge-field-report-demo"),
            owner: owner, identity: nil, recoveryDirectory: recoveryDirectory
        )
    }

    /// Standard mode. With no configuration the identity controller is unconfigured
    /// and every read and action reports that. Nothing is contacted.
    static func standard(configuration: OwnerConfiguration?, browser: (any NativeBrowserPresenting)?) -> CambiumOwnerServices? {
        let identityConfig = configuration?.identityConfiguration
        let origin = configuration?.origin
        let transport: URLSessionHTTPTransport? = origin.flatMap { try? URLSessionHTTPTransport(origin: $0) }
        let identity = NativeIdentityController.make(configuration: identityConfig, transport: transport, browser: browser)
        let clock = SystemCoreClock()
        let base = configuration?.ownerURL ?? URL(string: "https://owner.invalid")!
        let authorizer: any RequestAuthorizer = identity
        let gateClient: any FounderGateClient = transport.map { HTTPFounderGateClient(baseURL: base, transport: $0, authorizer: authorizer) }
            ?? RefusingGateClient()
        let launchClient = transport.map { HTTPLaunchClient(baseURL: base, transport: $0, authorizer: authorizer) }
            ?? HTTPLaunchClient(baseURL: base, transport: RefusingTransport(), authorizer: authorizer)
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let recovery = FileRecoveryStore(directory: support
            .appendingPathComponent("space.thoughtseed.cambium.native.dev", isDirectory: true)
            .appendingPathComponent("standard-recovery-v1", isDirectory: true))
        let reader: any MissionFabricReading = (origin.flatMap { origin in
            transport.map { MissionFabricHTTPClient(endpoint: MissionFabricEndpoint(origin: origin), transport: $0,
                                                    authorizer: authorizer, sessionProvider: identity, clock: clock) }
        }) ?? UnconfiguredMissionFabricReader()
        return CambiumOwnerServices(
            isDemo: false, replayClock: nil, supportsReject: true,
            ownerDescription: configuration == nil
                ? "No owner is configured. Sign-in and live reads stay unavailable."
                : "Owner \(configuration?.ownerURL.host ?? "") configured. Not signed in until you choose Sign in.",
            session: identity, clock: clock,
            gate: FounderGateCoordinator(client: gateClient, session: identity, clock: clock, store: recovery),
            launchCoordinator: LaunchCoordinator(client: launchClient, session: identity, clock: clock, store: recovery),
            launchClient: launchClient,
            fabricStore: MissionFabricSnapshotStore(reader: reader, sessionProvider: identity, clock: clock),
            knowledgeStore: KnowledgeSnapshotStore(sessionProvider: identity, clock: clock),
            fieldTheory: UnconfiguredFieldTheoryReader(), fieldReport: UnconfiguredFieldReportReader(),
            theoryExport: nil, reportExport: nil, owner: nil, identity: identity, recoveryDirectory: nil
        )
    }

    // MARK: Scope

    func session() async -> SessionDisplay? {
        guard case .verified(let founder, let tenant, let expires) = await session.currentSession() else { return nil }
        return SessionDisplay(founderId: founder, tenantId: tenant, expiresAt: CanonicalTimestamp.string(from: expires), synthetic: isDemo)
    }

    func signIn() async -> Result<SessionDisplay, ServiceIssue> {
        guard let identity else { return .failure(.init(kind: .unavailable, message: "The demo session is pinned. It is not a sign-in.")) }
        do {
            let signed = try await identity.signIn()
            guard case .verified(let founder, let tenant, let expires) = signed else {
                return .failure(.init(kind: .unconfigured, message: "Sign-in finished without a session."))
            }
            return .success(SessionDisplay(founderId: founder, tenantId: tenant, expiresAt: CanonicalTimestamp.string(from: expires), synthetic: false))
        } catch let error as NativeIdentityError {
            return .failure(Self.issue(error))
        } catch {
            return .failure(.init(kind: .unknown, message: "Sign-in failed."))
        }
    }

    func signOut() async {
        generation &+= 1
        if let identity { _ = await identity.signOut() }
        if let pinned = session as? PinnedSessionProvider { pinned.replace(.unconfigured) }
        review = nil
        capability = nil
        await fabricStore.invalidate()
        await knowledgeStore.invalidate()
    }

    func invalidate() async { await signOut() }

    private func current() -> UInt64 { generation }

    private func stillCurrent(_ token: UInt64) -> Bool { token == generation }

    // MARK: Reads

    func readFabric() async -> Result<FabricDisplay, ServiceIssue> {
        let token = current()
        guard let current = await session() else { return .failure(.init(kind: .unconfigured, message: "No verified session.")) }
        do {
            let read = try await fabricStore.refresh(tenantId: current.tenantId)
            guard stillCurrent(token), await session()?.founderId == current.founderId else {
                return .failure(.init(kind: .unavailable, message: "The session changed before this read finished."))
            }
            return .success(Self.fabric(read.envelope))
        } catch let error as MissionFabricReadError {
            return .failure(Self.issue(error))
        } catch {
            return .failure(.init(kind: .unknown, message: "The Mission Fabric read failed."))
        }
    }

    func loadKnowledge() async -> KnowledgeDisplay {
        let token = current()
        guard let current = await session() else {
            let issue = ServiceIssue(kind: .unconfigured, message: "No verified session.")
            return KnowledgeDisplay(fieldTheory: .failure(issue), fieldReport: .failure(issue))
        }
        async let theory = oneKnowledge(current, token: token, source: .fieldTheory, export: theoryExport, reader: fieldTheory)
        async let report = oneKnowledge(current, token: token, source: .fieldReport, export: reportExport, reader: fieldReport)
        return KnowledgeDisplay(fieldTheory: await theory, fieldReport: await report)
    }

    private func oneKnowledge(_ current: SessionDisplay, token: UInt64, source: KnowledgeSource, export: Data?,
                              reader: any FieldTheoryReading) async -> Result<[KnowledgeItem], ServiceIssue> {
        guard let export else { return .failure(.init(kind: .unconfigured, message: "No \(source.rawValue) export is supplied.")) }
        do {
            let records = try await knowledgeStore.loadFieldTheory(exportJSON: export, tenantId: current.tenantId, reader: reader)
            guard stillCurrent(token) else { return .failure(.init(kind: .unavailable, message: "The session changed.")) }
            return .success(records.map { Self.item($0.id, source: source, subject: $0.subjectId, ref: $0.sourceRef,
                                                    observed: $0.observedAt, freshness: $0.freshness.rawValue, gaps: $0.gaps, meaning: $0.meaning.rawValue) })
        } catch { return .failure(Self.issue(error)) }
    }

    private func oneKnowledge(_ current: SessionDisplay, token: UInt64, source: KnowledgeSource, export: Data?,
                              reader: any FieldReportReading) async -> Result<[KnowledgeItem], ServiceIssue> {
        guard let export else { return .failure(.init(kind: .unconfigured, message: "No \(source.rawValue) export is supplied.")) }
        do {
            let records = try await knowledgeStore.loadFieldReport(exportJSON: export, tenantId: current.tenantId, reader: reader)
            guard stillCurrent(token) else { return .failure(.init(kind: .unavailable, message: "The session changed.")) }
            return .success(records.map { Self.item($0.id, source: source, subject: $0.subjectId, ref: $0.sourceRef,
                                                    observed: $0.observedAt, freshness: $0.freshness.rawValue, gaps: $0.gaps, meaning: $0.meaning.rawValue) })
        } catch { return .failure(Self.issue(error)) }
    }

    // MARK: Review

    func loadReview() async -> Result<ReviewDisplay, ServiceIssue> {
        let token = current()
        guard let current = await session() else { return .failure(.init(kind: .unconfigured, message: "No verified session.")) }
        do {
            let loaded = try await gate.review(proposalId: Self.proposalId, tenantId: current.tenantId)
            guard stillCurrent(token) else { return .failure(.init(kind: .unavailable, message: "The session changed.")) }
            review = loaded
            return .success(Self.reviewDisplay(loaded))
        } catch { return .failure(Self.issue(error)) }
    }

    func submitReview(_ choice: ReviewChoice, typed: String) async -> Result<GateDisplay, ServiceIssue> {
        let token = current()
        guard let review else { return .failure(.init(kind: .unavailable, message: "Load the review before confirming.")) }
        let decision: FounderDecisionChoice = choice == .approve ? .approved : .rejected
        do {
            let outcome = try await gate.submit(review: review, choice: decision, typedConfirmation: typed)
            guard stillCurrent(token) else { return .failure(.init(kind: .unavailable, message: "The session changed. The outcome was not published.")) }
            return .success(Self.gateDisplay(outcome.record))
        } catch { return .failure(Self.issue(error)) }
    }

    func recoverReview() async -> Result<GateDisplay, ServiceIssue> {
        let token = current()
        guard let review else { return .failure(.init(kind: .unavailable, message: "No review is loaded.")) }
        do {
            let outcome = try await gate.recover(tuple: review.tuple)
            guard stillCurrent(token) else { return .failure(.init(kind: .unavailable, message: "The session changed.")) }
            return .success(Self.gateDisplay(outcome.record))
        } catch { return .failure(Self.issue(error)) }
    }

    func pendingGate() async -> [GateDisplay] {
        (try? await gate.pendingRecoveries())?.map(Self.gateDisplay) ?? []
    }

    /// Shows a decision recorded before a restart. `recover` returns a resolved
    /// record without an owner call; at most it sends a status-only read, never a decision.
    func storedReview() async -> GateDisplay? {
        guard let review, let outcome = try? await gate.recover(tuple: review.tuple) else { return nil }
        return Self.gateDisplay(outcome.record)
    }

    // MARK: Launch

    func inspectCapability() async -> Result<LaunchCapabilityDisplay, ServiceIssue> {
        let token = current()
        guard await session() != nil else { return .failure(.init(kind: .unconfigured, message: "No verified session.")) }
        do {
            let resolved = try await launchClient.resolveCapability(
                workId: Self.workId, admissionRef: Self.admissionRef, session: session, clock: clock)
            guard stillCurrent(token) else { return .failure(.init(kind: .unavailable, message: "The session changed.")) }
            capability = resolved
            return .success(Self.capabilityDisplay(resolved))
        } catch { return .failure(Self.issue(error)) }
    }

    func launch() async -> Result<LaunchDisplay, ServiceIssue> {
        let token = current()
        guard let capability else { return .failure(.init(kind: .unavailable, message: "Inspect the owner capability before launching.")) }
        let nonce = launchNonce ?? Self.freshNonce()
        launchNonce = nonce
        do {
            let outcome = try await launchCoordinator.launch(capability: capability, idempotencyNonce: nonce)
            guard stillCurrent(token) else { return .failure(.init(kind: .unavailable, message: "The session changed. The attempt stays recoverable.")) }
            return .success(Self.launchDisplay(outcome.record))
        } catch { return .failure(Self.issue(error)) }
    }

    func recoverLaunch() async -> Result<LaunchDisplay, ServiceIssue> {
        let token = current()
        guard let nonce = launchNonce else { return .failure(.init(kind: .unavailable, message: "No launch attempt exists.")) }
        do {
            let outcome = try await launchCoordinator.recover(workId: Self.workId, idempotencyNonce: nonce)
            guard stillCurrent(token) else { return .failure(.init(kind: .unavailable, message: "The session changed.")) }
            return .success(Self.launchDisplay(outcome.record))
        } catch { return .failure(Self.issue(error)) }
    }

    func pendingLaunch() async -> [LaunchDisplay] {
        let records = (try? await launchCoordinator.pendingRecoveries()) ?? []
        if launchNonce == nil, let first = records.first { launchNonce = first.idempotencyNonce }
        return records.map(Self.launchDisplay)
    }

    // MARK: Demo controls

    func armResponseLoss() async { await owner?.armResponseLoss() }
    func responseLossArmed() async -> Bool { await owner?.responseLossArmed() ?? false }

    func resetDemo() async {
        guard isDemo, let owner else { return }
        await owner.reset()
        if let recoveryDirectory { try? FileManager.default.removeItem(at: recoveryDirectory) }
        review = nil
        capability = nil
        launchNonce = nil
        await fabricStore.invalidate()
        await knowledgeStore.invalidate()
    }

    func lineage() -> [FixtureLineageDisplay] { SourceFixtures.lineage() }

    static func freshNonce() -> String {
        let alphabet = Array("abcdefghijklmnopqrstuvwxyz0123456789")
        return "nonce_" + String((0..<26).map { _ in alphabet.randomElement()! })
    }

    // MARK: Display mapping

    private static func reviewDisplay(_ review: GateReview) -> ReviewDisplay {
        let tuple = review.tuple
        let object = (try? JSONSerialization.jsonObject(with: Data(tuple.reviewJSON.utf8))) as? [String: Any]
        let changeSet = object?["changeSet"] as? [String: Any]
        func json(_ value: Any?) -> String {
            guard let value, JSONSerialization.isValidJSONObject(value) || value is String,
                  let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .fragmentsAllowed]) else { return "" }
            return String(decoding: data, as: UTF8.self)
        }
        var changes: [ChangeLine] = []
        func rows(_ key: String, _ label: String, _ describe: ([String: Any]) -> (String, String)) {
            guard let items = changeSet?[key] as? [[String: Any]] else { return }
            for (index, node) in items.enumerated() {
                let pair = describe(node)
                changes.append(ChangeLine(id: "\(key)-\(index)", field: "\(label) \(node["nodeId"] as? String ?? "")",
                                          before: pair.0, after: pair.1))
            }
        }
        rows("nodesToCreate", "Create") { ("absent", $0["desiredState"] as? String ?? $0["externalId"] as? String ?? "") }
        rows("nodesToUpdate", "Update") { (json($0["before"]), json($0["after"])) }
        rows("nodesToRemove", "Remove") { ($0["nodeId"] as? String ?? "", "removed") }
        return ReviewDisplay(
            proposalId: tuple.proposalId, tenantId: tuple.tenantId, version: tuple.version,
            changeDigest: tuple.changeDigest, nonce: tuple.nonce, expiresAt: tuple.expiresAt, summary: tuple.summary,
            consequence: object?["consequence"] as? String ?? "", reversibility: object?["reversibility"] as? String ?? "",
            graphVersion: changeSet?["graphVersion"] as? Int, expectedHeadDigest: changeSet?["expectedHeadDigest"] as? String,
            sourceRef: changeSet?["sourceRef"] as? String, sourceDigest: changeSet?["sourceDigest"] as? String,
            changes: changes, changeSetJSON: json(changeSet),
            approveConfirmation: tuple.approveConfirmation, rejectConfirmation: tuple.rejectConfirmation, principal: review.principal
        )
    }

    private static func gateDisplay(_ record: GateAttemptRecord) -> GateDisplay {
        let pending: Set<GateState> = [.submitting, .outcomeUnknown]
        return GateDisplay(
            proposalId: record.proposalId, version: record.version, nonce: record.nonce, choice: record.choice.rawValue,
            state: record.state.rawValue, label: label(record.state), decidedAt: record.receipt?.decidedAt,
            receiptDigest: record.receiptDigest, updatedAt: record.updatedAt,
            needsStatusCheck: pending.contains(record.state), recorded: record.state == .recorded
        )
    }

    private static func label(_ state: GateState) -> String {
        switch state {
        case .reviewed: "Reviewed"
        case .submitting: "Sending"
        case .recorded: "Recorded by the owner"
        case .denied: "Denied"
        case .changed: "The change set changed"
        case .expired: "Expired"
        case .stale: "Stale"
        case .rejectedByOwner: "Refused by the owner"
        case .conflict: "Conflicts with the owner record"
        case .outcomeUnknown: "Unknown until status is checked"
        case .notRecorded: "Not recorded"
        }
    }

    private static func capabilityDisplay(_ capability: LaunchCapability) -> LaunchCapabilityDisplay {
        LaunchCapabilityDisplay(
            workId: capability.workId, admissionRef: capability.admissionRef, graphVersion: capability.graphVersion,
            loadoutId: capability.loadoutId, inputDigest: capability.inputDigest, plant: capability.executionPlant.rawValue,
            plantName: capability.executionPlant == .hands ? "Hands" : "Hermes",
            action: capability.supportedAction, expiresAt: capability.expiresAt
        )
    }

    private static func launchDisplay(_ record: LaunchAttemptRecord) -> LaunchDisplay {
        let sent = record.state != .transmitting && record.state != .transmissionFailed
        let pending: Set<LaunchState> = [.queued, .transmitting, .transmissionFailed, .persistenceFailed, .running, .outcomeUnknown]
        return LaunchDisplay(
            workId: record.capability.workId, admissionRef: record.capability.admissionRef,
            plantName: record.capability.executionPlant == .hands ? "Hands" : "Hermes",
            requestId: record.requestId, attemptId: record.attemptId, nonce: record.idempotencyNonce,
            state: record.state.rawValue,
            transport: sent ? "Owner answered \(record.dispatch ?? record.state.rawValue)" : "No owner answer yet",
            execution: record.executionState ?? "not reported",
            acceptance: record.acceptance ?? "not_evaluated",
            ownerRef: record.ownerRef, requestKey: record.requestKey, updatedAt: record.updatedAt,
            needsStatusCheck: pending.contains(record.state)
        )
    }

    private static func fabric(_ envelope: MissionFabricEnvelope) -> FabricDisplay {
        var evidence: [EvidenceItem] = []
        for node in envelope.projection.nodes {
            if case .receipt(let value) = node {
                evidence.append(EvidenceItem(
                    id: value.receiptId, title: "Receipt \(value.receiptId)", sourceRef: value.evidenceRefs.first ?? value.runId,
                    kind: "receipt", observedAt: envelope.projection.asOf, digest: value.outputDigest ?? value.inputDigest))
            }
        }
        let columns = ["work", "mission", "task", "agent", "cluster", "run", "receipt"]
        var nodes: [FabricTraceNode] = []
        for node in envelope.projection.nodes {
            let kind: String
            let title: String
            let detail: String
            switch node {
            case .work(let value): kind = "work"; title = value.name; detail = "\(value.workId) · \(value.status)"
            case .mission(let value): kind = "mission"; title = value.title; detail = value.missionId
            case .task(let value): kind = "task"; title = value.taskId; detail = value.status
            case .agent(let value): kind = "agent"; title = value.subjectId; detail = value.status
            case .skillCluster(let value): kind = "cluster"; title = value.subjectId; detail = value.status
            case .run(let value): kind = "run"; title = value.subjectId; detail = value.status
            case .receipt(let value): kind = "receipt"; title = value.receiptId; detail = value.status
            }
            let column = columns.firstIndex(of: kind) ?? 0
            let row = nodes.filter { $0.kind == kind }.count
            nodes.append(FabricTraceNode(id: node.subjectId, kind: kind, title: title, detail: detail,
                                         position: CGPoint(x: 0.08 + CGFloat(column) * 0.14, y: min(0.82, 0.24 + CGFloat(row) * 0.30))))
        }
        let edges = envelope.projection.edges.map {
            FabricTraceEdge(id: "\($0.kind):\($0.fromId):\($0.toId)", from: $0.fromId, to: $0.toId, kind: $0.kind)
        }
        let summary = envelope.portfolioCatalogSummary
        let join = envelope.portfolioJoinReport
        return FabricDisplay(
            snapshot: MissionFabricDecoder.snapshot(from: envelope), unattachedEvidence: evidence,
            trace: FabricTrace(nodes: nodes, edges: edges),
            gaps: envelope.projection.gaps.map { FabricGapDisplay(id: $0.gapId, kind: $0.kind, subjectId: $0.subjectId, detail: $0.detail) },
            sidecars: PortfolioSidecarDisplay(
                catalogTotal: summary?.total, saplings: summary?.saplings, clientBranches: summary?.clientBranches,
                internalPrograms: summary?.internalPrograms, operationalGaps: summary?.operationalGaps,
                catalogDigest: summary?.catalogDigest, actionAdmission: summary?.actionAdmission,
                joinMatched: join?.matchedCount, joinCatalogOrphans: join?.catalogOrphanCount,
                joinRuntimeOrphans: join?.runtimeOrphanCount, portfolioPairDigest: envelope.delivery.portfolioPairDigest,
                organDeliveryPresent: envelope.organDeliveryPresent, organDeliveryIsSummary: envelope.organDeliveryIsSummary),
            tenantId: envelope.projection.tenantId, graphVersion: envelope.projection.graphVersion,
            graphDigest: envelope.projection.graphDigest, asOf: envelope.projection.asOf,
            generatedAt: envelope.projection.generatedAt, servedAt: envelope.delivery.servedAt,
            freshness: envelope.delivery.freshness.rawValue
        )
    }

    private static func item(_ id: String, source: KnowledgeSource, subject: String, ref: String, observed: String,
                             freshness: String, gaps: [String], meaning: String) -> KnowledgeItem {
        let title: String
        switch id {
        case "ft-direction-native-home": title = "Direction: a native home for Cambium"
        case "ft-bookmark-calm-dashboards": title = "Bookmark: calm native dashboards"
        case "fr-observation-studio-desk-v3": title = "Observation: studio desk, north window"
        default: title = id
        }
        return KnowledgeItem(id: id, source: source, title: title,
                             detail: "\(meaning.capitalized). Subject \(subject). Freshness \(freshness).",
                             sourceRef: ref, observedAt: observed, meaning: meaning, freshness: freshness, subjectId: subject, gaps: gaps)
    }

    private static func issue(_ error: Error) -> ServiceIssue {
        switch error {
        case GateError.notAdmitted, LaunchError.notAdmitted:
            return .init(kind: .unconfigured, message: "No verified session for this tenant.")
        case GateError.expired, LaunchError.expired:
            return .init(kind: .expired, message: "The owner window has expired.")
        case GateError.confirmationMismatch:
            return .init(kind: .invalid, message: "The typed confirmation does not match.")
        case GateError.unresolvedAttempt, LaunchError.unresolvedAttempt:
            return .init(kind: .unknown, message: "An earlier attempt is unresolved. Check status. Do not send it again.")
        case let GateError.refused(reason), let LaunchError.refused(reason):
            return .init(kind: .refused, message: "The owner refused: \(reason).")
        case let LaunchError.capabilityUnsupported(reason):
            return .init(kind: .unsupported, message: "The owner does not support this capability (\(reason)).")
        case let LaunchError.capabilityUnavailable(reason):
            return .init(kind: .unavailable, message: "No current admission (\(reason)). Approval is not admission.")
        case MissionFabricReadError.unconfigured, KnowledgeError.bridgeUnconfigured, NativeIdentityError.unconfigured:
            return .init(kind: .unconfigured, message: "This owner path is not configured.")
        case MissionFabricReadError.unauthorized, MissionFabricReadError.forbidden, NativeIdentityError.inspectionFailed:
            return .init(kind: .refused, message: "The owner refused this read.")
        case MissionFabricReadError.unavailable:
            return .init(kind: .unavailable, message: "The owner is unavailable.")
        default:
            return .init(kind: .unknown, message: "The owner did not complete this action.")
        }
    }
}

/// Used when standard mode has no transport. It sends nothing.
private struct RefusingTransport: HTTPTransport {
    func send(_ request: HTTPRequest) async throws -> HTTPResponse { throw TransportFailure.ownerUnconfigured }
}

private struct RefusingGateClient: FounderGateClient {
    func proposal(proposalId: String) async throws -> GateReviewTuple { throw GateError.refused("owner_unconfigured") }
    func decide(_ tuple: GateReviewTuple, decision: FounderDecisionChoice, confirmation: String) async throws -> GateDecisionWire {
        throw GateError.refused("owner_unconfigured")
    }
    func status(_ tuple: GateReviewTuple, decision: FounderDecisionChoice, confirmation: String) async throws -> GateDecisionWire {
        throw GateError.refused("owner_unconfigured")
    }
    func renew(_ tuple: GateReviewTuple) async throws -> RenewalWire { throw GateError.refused("owner_unconfigured") }
}
