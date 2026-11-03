import Foundation
import Observation
import AppKit
import SwiftUI
import struct CambiumCore.SystemSnapshot
import struct CambiumCore.WorkObject
import struct CambiumCore.MappedProject
import struct CambiumCore.MappedHistoricalProject
import struct CambiumCore.EvidenceItem
import struct CambiumCore.ConnectionObservation
import enum CambiumCore.DemoData
import protocol CambiumCore.NativeBrowserPresenting
import struct CambiumCore.Signal
import struct CambiumCore.SignalCapture
import struct CambiumCore.SignalUpdate
import enum CambiumCore.SignalError

struct InboxDraft {
    var selected: Signal?
    var title = ""
    var body = ""
    var projects: Set<String> = []
    var sourceID = UUID().uuidString
    var capture: SignalCapture?
    var update: SignalUpdate?
    var hasStarted = false
    var conflict = false

    static func isLocked(capture: SignalCapture?, update: SignalUpdate?) -> Bool {
        capture != nil || update != nil
    }

    static func isDefinitiveRejection(_ error: Error) -> Bool {
        guard let signalError = error as? SignalError else { return false }
        return signalError == .invalidRequest || signalError == .status(400) || signalError == .status(409)
    }
}

/// Application state for the ten screens.
///
/// Demo mode composes the tested Core coordinators over an in-process owner and
/// source wire fixtures. Standard mode stays unconfigured until an owner
/// configuration is supplied and sign-in succeeds. A mode or session change
/// drops the generation, so a completion from the old scope cannot publish.
@MainActor
@Observable
final class AppModel {
    private(set) var mode: LaunchMode
    var section: AppSection = .canopy
    var query = ""

    private(set) var snapshot: SystemSnapshot
    private(set) var unattachedEvidence: [EvidenceItem] = []
    private(set) var knowledge: [KnowledgeItem] = []
    private(set) var knowledgeIssue: String?
    private(set) var fabric: FabricDisplay?
    private(set) var review: ReviewDisplay?
    private(set) var proposalBinding: WorkProposalBinding?
    private(set) var gate: GateDisplay?
    private(set) var pendingGate: [GateDisplay] = []
    private(set) var admissions: [AdmissionRowDisplay] = []
    private(set) var admissionIssue: ServiceIssue?
    private(set) var selectedAdmissionRef: String?
    private(set) var capability: LaunchCapabilityDisplay?
    private(set) var launch: LaunchDisplay?
    private(set) var pendingLaunch: [LaunchDisplay] = []
    private(set) var session: SessionDisplay?
    private(set) var issue: ServiceIssue?
    private(set) var lineage: [FixtureLineageDisplay] = []
    private(set) var ownerDescription = ""
    private(set) var faultArmed = false
    private(set) var loading = false

    var selectedWorkID: String?
    var selectedProjectID: String?
    var selectedHistoricalID: String?
    private(set) var projectNavigationVersion: UInt64 = 0
    var selectedEvidenceID: String?
    var selectedConnectionID: String?
    var selectedStepID: String?
    var selectedTraceID: String?
    var selectedKnowledgeID: String?
    var selectedOrgan: Organ?
    var tourSteps = Walkthrough.steps

    var appearance: AppearanceChoice = .system
    var reduceMotion = false
    var utcTimes = false

    var reviewChoice: ReviewChoice = .approve
    var reviewTyped = ""
    /// Canonical proposal reference typed when the projection has no join.
    var proposalRefDraft = ""
    /// Work id typed in standard mode when the person is selecting one record.
    var workSelectionDraft = ""

    var ownerURLDraft = OwnerConfiguration.mappedOwnerURL
    var tenantDraft = OwnerConfiguration.mappedTenant
    var clientIDDraft = OwnerConfiguration.mappedClientId
    var redirectDraft = OwnerConfiguration.reviewedRedirect
    private(set) var configuration: OwnerConfiguration?
    private(set) var configurationProblem: String?

    var feedback: String?
    var inboxFilter: String?
    var inboxVersion: UInt64 = 0
    var signalScopeVersion: UInt64 = 0
    var inboxDraft = InboxDraft()
    var signalService: CambiumOwnerServices? { services as? CambiumOwnerServices }
    func openInbox(project: String?) {
        inboxFilter = project
        inboxVersion &+= 1
        open(.inbox)
    }

    private var services: (any OwnerServices)?
    private var generation: UInt64 = 0
    private var browser: (any NativeBrowserPresenting)?
    private var ownerInvalidation: Task<Void, Never>?

    static var launchMode: LaunchMode {
        LaunchMode.current == .demo || CommandLine.arguments.contains("--demo") ? .demo : .standard
    }

    /// `services` is for tests. The app passes nothing and gets the system
    /// browser adapter, which is used only after an owner is configured and the
    /// person chooses Sign in.
    init(mode: LaunchMode = AppModel.launchMode, services: (any OwnerServices)? = nil, browser: (any NativeBrowserPresenting)? = nil) {
        self.mode = mode
        self.browser = browser ?? (services == nil ? NativeBrowserSignIn(anchorProvider: {
            NSApp.keyWindow ?? NSApp.mainWindow ?? NSApp.windows.first(where: { $0.isVisible && $0.canBecomeKey })
        }) : nil)
        snapshot = Self.emptySnapshot
        restoreVisualPreferences()
        if let services {
            self.services = services
            adopt(services)
            let token = generation
            Task { await refresh(token) }
        } else {
            load(mode)
        }
    }

    var isDemo: Bool { mode == .demo }
    func hasCurrentSession(at date: Date = Date()) -> Bool {
        guard let session, let expiry = CanonicalTimestamp.parse(session.expiresAt) else { return false }
        return expiry > date
    }

    /// A deliberate entry point from the main app chrome. Applying the
    /// reviewed profile alone never opens a browser; this action does.
    func beginSignIn() {
        open(.connections)
        guard !isDemo, !loading else { return }
        if configuration == nil { applyConfiguration() }
        guard configuration != nil else { return }
        feedback = "Opening secure browser sign-in."
        signIn()
    }
    var supportsReject: Bool { services?.supportsReject ?? false }
    var replayClock: String? { services?.replayClock }
    var julyProposalExampleId: String? { services?.julyProposalExampleId }

    var allEvidence: [EvidenceItem] { snapshot.work.flatMap(\.evidence) + unattachedEvidence }
    var selectedWork: WorkObject? { snapshot.work.first { $0.id == selectedWorkID } }
    var selectedProject: MappedProject? { fabric?.portfolio?.projects.first { $0.id == selectedProjectID } }
    var selectedHistoricalProduct: MappedHistoricalProject? {
        fabric?.portfolio?.historicalProducts.first { $0.id == selectedHistoricalID }
    }

    /// The Work node named by the served join for this canonical project.
    /// Raw catalog identifiers, aliases, and tenant strings are not joins.
    func joinedWork(for project: MappedProject) -> WorkObject? {
        guard let match = fabric?.portfolio?.joinReport?.matches.first(where: { $0.canonicalId == project.canonicalId }),
              let work = snapshot.work.first(where: { $0.id == match.runtimeWorkId }) else { return nil }
        return work
    }

    var selectedProjectWork: WorkObject? {
        guard let selectedProject else { return nil }
        return joinedWork(for: selectedProject)
    }
    var selectedEvidence: EvidenceItem? { allEvidence.first { $0.id == selectedEvidenceID } }
    var selectedConnection: ConnectionObservation? { snapshot.connections.first { $0.id == selectedConnectionID } }
    var selectedTourStep: TraceStep? { tourSteps.first { $0.id == selectedStepID } }
    var selectedTraceNode: FabricTraceNode? { fabric?.trace.nodes.first { $0.id == selectedTraceID } }
    var selectedKnowledge: KnowledgeItem? { knowledge.first { $0.id == selectedKnowledgeID } }

    var requiredPhrase: String {
        guard let review else { return "" }
        return reviewChoice == .approve ? review.approveConfirmation : review.rejectConfirmation
    }

    var typedMatches: Bool { review != nil && !reviewTyped.isEmpty && reviewTyped == requiredPhrase }

    func work(owning evidenceID: String) -> WorkObject? {
        snapshot.work.first { $0.evidence.contains { $0.id == evidenceID } }
    }

    func time(_ iso: String?) -> String { SourceTime.display(iso, utc: utcTimes) }
    func time(_ date: Date) -> String { SourceTime.display(date, utc: utcTimes) }

    func open(_ section: AppSection) {
        self.section = section
        query = ""
        persistVisualPreferences()
    }

    func selectWork(_ id: String) {
        guard snapshot.work.contains(where: { $0.id == id }) else {
            feedback = "That work is not in the loaded projection."
            return
        }
        let changed = selectedWorkID != id
        selectedWorkID = id
        if changed {
            proposalBinding = services?.proposalBinding(workId: id)
            proposalRefDraft = proposalBinding?.proposalId ?? ""
            review = nil
            gate = nil
            admissions = []
            admissionIssue = nil
            selectedAdmissionRef = nil
            capability = nil
        }
        open(.work)
    }

    func selectProject(_ id: String) {
        guard fabric?.portfolio?.projects.contains(where: { $0.id == id }) == true else {
            feedback = "That project is not in the current display catalog."
            return
        }
        selectedProjectID = id
        selectedHistoricalID = nil
        projectNavigationVersion &+= 1
        open(.projects)
    }

    func selectHistoricalProduct(_ id: String) {
        guard fabric?.portfolio?.historicalProducts.contains(where: { $0.id == id }) == true else {
            feedback = "That historical product is not in the current display catalog."
            return
        }
        selectedHistoricalID = id
        selectedProjectID = nil
        projectNavigationVersion &+= 1
        open(.projects)
    }

    /// Opens the operational Work node named by an explicit served join.
    /// Catalog membership creates no launch or admission capability.
    func openOperationalWork(for projectID: String) {
        guard let project = fabric?.portfolio?.projects.first(where: { $0.id == projectID }) else {
            feedback = "That project is not in the current display catalog."
            return
        }
        guard let work = joinedWork(for: project) else {
            feedback = "No served join maps \(project.canonicalId) to an operational Work node."
            return
        }
        selectWork(work.id)
    }

    /// Binds the typed canonical proposal reference to the selected projected work.
    /// A work id that is not in the projection is refused. Approval is not involved.
    func bindTypedProposal() {
        guard let workId = selectedWorkID, snapshot.work.contains(where: { $0.id == workId }) else {
            feedback = "Select a work item from the loaded projection first."
            return
        }
        if let supplied = services?.proposalBinding(workId: workId) {
            proposalBinding = supplied
            feedback = "The projection names proposal \(supplied.proposalId) for this work."
            return
        }
        let typed = proposalRefDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let tenant = session?.tenantId, CambiumOwnerServices.canonicalProposal(typed, tenant: tenant) else {
            proposalBinding = nil
            feedback = "Type a canonical proposal reference: \(session?.tenantId ?? "tenant"):sha256: and 64 hex digits."
            return
        }
        proposalBinding = WorkProposalBinding(workId: workId, proposalId: typed, source: .typed)
        feedback = "Proposal reference bound for this session. It is not an admission."
    }

    func selectAdmission(_ ref: String) {
        guard let row = admissions.first(where: { $0.admissionRef == ref }) else { return }
        guard row.selectable else {
            selectedAdmissionRef = nil
            capability = nil
            feedback = "Admission \(row.admissionRef) is \(row.availability) (\(row.reason)). Only a supported existing reference can be resolved."
            return
        }
        selectedAdmissionRef = ref
        capability = nil
    }
    func selectEvidence(_ id: String) { selectedEvidenceID = id; open(.evidence) }
    func clearFeedback() { feedback = nil }

    // MARK: Mode

    func enterDemo() { load(.demo); feedback = "Demo opened. Using sample data." }
    func leaveDemo() { load(.standard); feedback = "Demo closed." }

    func applyConfiguration() {
        switch OwnerConfiguration.validate(ownerURL: ownerURLDraft, tenant: tenantDraft, clientId: clientIDDraft, redirect: redirectDraft) {
        case .success(let value):
            configuration = value
            configurationProblem = nil
            load(.standard)
            feedback = "Connection settings saved."
        case .failure(let problem):
            configuration = nil
            configurationProblem = problem.rawValue
        }
    }

    func clearConfiguration() {
        configuration = nil
        configurationProblem = nil
        load(.standard)
        feedback = "Owner configuration cleared."
    }

    private func load(_ mode: LaunchMode) {
        generation &+= 1
        signalScopeVersion &+= 1
        inboxDraft = InboxDraft()
        inboxFilter = nil
        inboxVersion &+= 1
        let previous = services
        self.mode = mode
        review = nil
        proposalBinding = nil
        proposalRefDraft = ""
        gate = nil
        capability = nil
        launch = nil
        admissions = []
        admissionIssue = nil
        selectedAdmissionRef = nil
        pendingGate = []
        pendingLaunch = []
        fabric = nil
        knowledge = []
        knowledgeIssue = nil
        session = nil
        issue = nil
        faultArmed = false
        loading = false
        reviewTyped = ""
        selectedOrgan = nil
        selectedWorkID = nil
        selectedProjectID = nil
        selectedHistoricalID = nil
        selectedEvidenceID = nil
        selectedConnectionID = nil
        selectedTraceID = nil
        selectedKnowledgeID = nil
        if mode == .demo {
            services = CambiumOwnerServices.demo(directory: DemoPaths.defaultDirectory)
        } else {
            services = CambiumOwnerServices.standard(configuration: configuration, browser: browser)
        }
        adopt(services)
        let earlierInvalidation = ownerInvalidation
        ownerInvalidation = Task {
            await earlierInvalidation?.value
            await previous?.invalidate()
        }
        let token = generation
        Task { await refresh(token) }
    }

    private func adopt(_ services: (any OwnerServices)?) {
        ownerDescription = services?.ownerDescription ?? "No owner is configured."
        lineage = services?.lineage() ?? []
        if services == nil {
            snapshot = Self.emptySnapshot
            unattachedEvidence = []
        }
    }

    func retryOwnerRead() {
        guard !loading else { return }
        run("Owner read") { _, token in await self.refresh(token) }
    }

    private func refresh(_ token: UInt64) async {
        guard let services, token == generation else { return }
        session = await services.session()
        guard session != nil else {
            snapshot = mode == .demo ? DemoData.snapshot : Self.emptySnapshot
            return
        }
        switch await services.readFabric() {
        case .success(let display) where token == generation:
            issue = nil
            fabric = display
            snapshot = display.snapshot
            unattachedEvidence = display.unattachedEvidence
        case .failure(let failure) where token == generation:
            issue = failure
            // A failed read leaves no catalog from an earlier read in view.
            fabric = nil
            selectedProjectID = nil
            selectedHistoricalID = nil
            snapshot = mode == .demo ? DemoData.snapshot : Self.emptySnapshot
        default:
            return
        }
        let knowledge = await services.loadKnowledge()
        guard token == generation else { return }
        publishKnowledge(knowledge)
        let gates = await services.pendingGate()
        let launches = await services.pendingLaunch()
        guard token == generation else { return }
        pendingGate = gates
        pendingLaunch = launches
        if let firstGate = gates.first {
            proposalRefDraft = firstGate.proposalId
        }
        if let firstLaunch = launches.first {
            selectedWorkID = firstLaunch.workId
            selectedAdmissionRef = firstLaunch.admissionRef
            launch = firstLaunch
        }
        if gates.isEmpty, let stored = await services.storedReview(), token == generation {
            gate = stored
        }
        if selectedWorkID == nil || !snapshot.work.contains(where: { $0.id == selectedWorkID }) {
            selectedWorkID = snapshot.work.first?.id
        }
        if fabric?.portfolio?.historicalProducts.contains(where: { $0.id == selectedHistoricalID }) != true {
            selectedHistoricalID = nil
        }
        if fabric?.portfolio?.projects.contains(where: { $0.id == selectedProjectID }) != true {
            selectedProjectID = nil
        }
        if selectedProjectID == nil && selectedHistoricalID == nil {
            selectedProjectID = fabric?.portfolio?.projects.first?.id
            if selectedProjectID == nil {
                selectedHistoricalID = fabric?.portfolio?.historicalProducts.first?.id
            }
        }
        if let selectedWorkID {
            proposalBinding = services.proposalBinding(workId: selectedWorkID)
            if proposalRefDraft.isEmpty { proposalRefDraft = proposalBinding?.proposalId ?? "" }
            if let binding = proposalBinding, case .success(let loaded) = await services.loadReview(proposalId: binding.proposalId), token == generation {
                review = loaded
                if let stored = await services.storedReview(), token == generation {
                    gate = stored
                }
            }
        }
        selectedEvidenceID = selectedEvidenceID ?? allEvidence.first?.id
        selectedConnectionID = selectedConnectionID ?? snapshot.connections.first?.id
        selectedStepID = selectedStepID ?? tourSteps.first?.id
        selectedTraceID = selectedTraceID ?? fabric?.trace.nodes.first?.id
        selectedKnowledgeID = selectedKnowledgeID ?? self.knowledge.first?.id
        if gate == nil, gates.isEmpty, let stored = await services.storedReview(), token == generation {
            gate = stored
        }
    }

    private func publishKnowledge(_ display: KnowledgeDisplay) {
        var rows: [KnowledgeItem] = []
        var problems: [String] = []
        for result in [display.fieldTheory, display.fieldReport] {
            switch result {
            case .success(let items): rows.append(contentsOf: items)
            case .failure(let failure): problems.append(failure.message)
            }
        }
        knowledge = rows
        knowledgeIssue = problems.isEmpty ? nil : problems.joined(separator: " ")
    }

    // MARK: Actions

    func signIn() {
        run("Sign-in") { services, token in
            // Old and new owners share one browser adapter. Finish the old
            // owner's cancellation before starting this presentation.
            await self.ownerInvalidation?.value
            guard token == self.generation else { return }
            let result = await services.signIn()
            guard token == self.generation else { return }
            switch result {
            case .success(let signed):
                self.acceptSignedIn(signed)
                self.feedback = "Signed in."
                await self.refresh(self.generation)
            case .failure(let failure):
                self.issue = failure
                self.feedback = failure.message
            }
        }
    }

    /// A sign-in as a different founder must not inherit the previous
    /// founder's selected signal or unsaved Inbox text.
    func acceptSignedIn(_ signed: SessionDisplay) {
        if let previous = session, previous.founderId != signed.founderId || previous.tenantId != signed.tenantId {
            signalScopeVersion &+= 1
            inboxDraft = InboxDraft()
            inboxFilter = nil
            inboxVersion &+= 1
        }
        session = signed
    }

    func signOut() {
        let token = generation
        generation &+= 1
        signalScopeVersion &+= 1
        inboxDraft = InboxDraft()
        inboxFilter = nil
        inboxVersion &+= 1
        session = nil
        review = nil
        proposalBinding = nil
        gate = nil
        capability = nil
        launch = nil
        admissions = []
        selectedAdmissionRef = nil
        fabric = nil
        selectedProjectID = nil
        selectedHistoricalID = nil
        knowledge = []
        pendingGate = []
        pendingLaunch = []
        loading = false
        snapshot = isDemo ? DemoData.snapshot : Self.emptySnapshot
        feedback = "Signed out."
        _ = token
        Task { await services?.signOut() }
    }

    func loadSelectedReview() {
        let proposalId = proposalBinding?.proposalId ?? proposalRefDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !proposalId.isEmpty else {
            feedback = "Bind a canonical proposal reference for the selected work before loading the review."
            return
        }
        run("Review") { services, token in
            let result = await services.loadReview(proposalId: proposalId)
            guard token == self.generation else { return }
            switch result {
            case .success(let loaded):
                self.review = loaded
                let stored = await services.storedReview()
                let pending = await services.pendingGate()
                guard token == self.generation else { return }
                self.gate = stored
                self.pendingGate = pending
                self.feedback = "Loaded review \(loaded.proposalId). Approval does not admit this work."
            case .failure(let failure):
                self.review = nil
                self.issue = failure
                self.feedback = failure.message
            }
        }
    }

    func confirmReview() {
        guard typedMatches else { return }
        let choice = reviewChoice
        let typed = reviewTyped
        run("Decision") { services, token in
            let result = await services.submitReview(choice, typed: typed)
            let pending = await services.pendingGate()
            self.faultArmed = await services.responseLossArmed()
            guard token == self.generation else { return }
            self.pendingGate = pending
            switch result {
            case .success(let display):
                self.gate = display
                self.reviewTyped = ""
                self.feedback = display.needsStatusCheck
                    ? "The reply was lost after the owner may have recorded it. Check status. Do not decide again."
                    : "Owner state: \(display.label)."
            case .failure(let failure):
                self.issue = failure
                self.feedback = failure.message
            }
        }
    }

    func recoverReview() {
        let nonce = gate?.nonce ?? pendingGate.first?.nonce
        guard let nonce else {
            feedback = "No saved decision attempt exists to recover."
            return
        }
        recoverReview(nonce: nonce)
    }

    func recoverReview(nonce: String) {
        run("Status") { services, token in
            let result = await services.recoverReview(nonce: nonce)
            let pending = await services.pendingGate()
            guard token == self.generation else { return }
            self.pendingGate = pending
            switch result {
            case .success(let display):
                self.gate = display
                self.feedback = "Status only. Owner state: \(display.label)."
            case .failure(let failure):
                self.issue = failure
                self.feedback = failure.message
            }
        }
    }

    func listAdmissions() {
        guard let workId = selectedWorkID else {
            feedback = "Select a work item before listing admissions."
            return
        }
        run("Admissions") { services, token in
            let result = await services.discoverAdmissions(workId: workId)
            guard token == self.generation else { return }
            switch result {
            case .success(let rows):
                self.admissions = rows
                self.admissionIssue = nil
                self.selectedAdmissionRef = nil
                self.capability = nil
                self.feedback = rows.isEmpty
                    ? "No already-admitted rows for this work. Approval does not create one."
                    : "Listed \(rows.count) already-admitted rows. This listing is read only."
            case .failure(let failure):
                self.admissions = []
                self.admissionIssue = failure
                self.issue = failure
                self.feedback = failure.message
            }
        }
    }

    func resolveSelectedCapability() {
        guard let workId = selectedWorkID, let ref = selectedAdmissionRef else {
            feedback = "Select a supported admission from the listing before resolving."
            return
        }
        run("Capability") { services, token in
            let result = await services.resolveSelectedAdmission(workId: workId, admissionRef: ref)
            guard token == self.generation else { return }
            switch result {
            case .success(let display):
                self.capability = display
                self.feedback = "Owner capability: \(display.action) on \(display.plantName)."
            case .failure(let failure):
                self.capability = nil
                self.issue = failure
                self.feedback = failure.message
            }
        }
    }

    func requestLaunch() {
        guard capability != nil, launch == nil else { return }
        run("Launch") { services, token in
            let result = await services.launch()
            let pending = await services.pendingLaunch()
            self.faultArmed = await services.responseLossArmed()
            guard token == self.generation else { return }
            self.pendingLaunch = pending
            switch result {
            case .success(let display):
                self.launch = display
                self.feedback = display.needsStatusCheck
                    ? "No owner answer. The original request is saved. Check status. Do not launch again."
                    : "Owner execution: \(display.execution). Acceptance: \(display.acceptance)."
            case .failure(let failure):
                self.issue = failure
                if let first = pending.first { self.launch = first }
                self.feedback = failure.message
            }
        }
    }

    func recoverLaunch() {
        let nonce = launch?.nonce ?? pendingLaunch.first?.nonce
        guard let nonce else {
            feedback = "No saved launch attempt exists to recover."
            return
        }
        recoverLaunch(nonce: nonce)
    }

    /// Deliberate resend of one proved-absent original. Status reads never call this.
    func retryOriginalLaunch(nonce: String) {
        run("Retry") { services, token in
            let result = await services.retryOriginalLaunch(nonce: nonce)
            let pending = await services.pendingLaunch()
            guard token == self.generation else { return }
            self.pendingLaunch = pending
            switch result {
            case .success(let display):
                self.launch = display
                self.feedback = display.needsStatusCheck
                    ? "Original request used the same IDs. Check status before another send."
                    : "Original request resolved. Request \(display.requestId). Execution: \(display.execution)."
            case .failure(let failure):
                self.issue = failure
                if let saved = pending.first(where: { $0.nonce == nonce }) { self.launch = saved }
                self.feedback = failure.message
            }
        }
    }

    func recoverLaunch(nonce: String) {
        run("Status") { services, token in
            let result = await services.recoverLaunch(nonce: nonce)
            let pending = await services.pendingLaunch()
            guard token == self.generation else { return }
            self.pendingLaunch = pending
            switch result {
            case .success(let display):
                self.launch = display
                self.feedback = "Status only. Execution \(display.execution). Acceptance \(display.acceptance)."
            case .failure(let failure):
                self.issue = failure
                self.feedback = failure.message
            }
        }
    }

    func armFault() {
        guard isDemo else { return }
        let token = generation
        Task {
            await services?.armResponseLoss()
            let armed = await services?.responseLossArmed() ?? false
            guard token == generation else { return }
            faultArmed = armed
            feedback = "Demo fault armed. The next decision or launch is recorded, then its reply is dropped."
        }
    }

    /// Visual disabled state for demo reset. Current attempt flags and the pending
    /// arrays loaded on opening all count. The durable store remains the action gate.
    var resetVisuallyBlocked: Bool {
        gate?.needsStatusCheck == true
            || launch?.needsStatusCheck == true
            || pendingGate.contains { $0.needsStatusCheck }
            || pendingLaunch.contains { $0.needsStatusCheck }
    }

    /// Test seam. Drops the visible attempt so reset can be shown to consult the
    /// durable store rather than these fields. It does not touch recovery files.
    func hideVisibleAttemptsForTest() {
        gate = nil
        launch = nil
        pendingGate = []
        pendingLaunch = []
    }

    func resetDemo() {
        guard isDemo else { return }
        let token = generation
        Task {
            let blocked = await services?.hasUnresolvedAttempt() ?? false
            guard token == self.generation else { return }
            guard !blocked else {
                self.feedback = "Reset is blocked while a saved attempt is unresolved. Check status first."
                return
            }
            self.run("Reset") { services, token in
                await services.resetDemo()
                guard token == self.generation else { return }
                self.review = nil
                self.proposalBinding = nil
                self.gate = nil
                self.capability = nil
                self.launch = nil
                self.admissions = []
                self.selectedAdmissionRef = nil
                self.faultArmed = false
                self.reviewTyped = ""
                self.feedback = "Demo owner and recovery were cleared. Standard mode was not touched."
                await self.refresh(token)
            }
        }
    }

    // MARK: Visual preferences

    /// Appearance, motion, clock display and the selected section. Never a
    /// session, token, review body, confirmation or admission.
    private static let visualDefaultsKey = "space.thoughtseed.cambium.native.visual.v1"

    private func restoreVisualPreferences() {
        guard let raw = UserDefaults.standard.dictionary(forKey: Self.visualDefaultsKey) else { return }
        if let value = raw["appearance"] as? String, let choice = AppearanceChoice(rawValue: value) { appearance = choice }
        if let value = raw["reduceMotion"] as? Bool { reduceMotion = value }
        if let value = raw["utcTimes"] as? Bool { utcTimes = value }
        if let value = raw["section"] as? String, let section = AppSection(rawValue: value) { self.section = section }
    }

    func persistVisualPreferences() {
        UserDefaults.standard.set([
            "appearance": appearance.rawValue,
            "reduceMotion": reduceMotion,
            "utcTimes": utcTimes,
            "section": section.rawValue
        ], forKey: Self.visualDefaultsKey)
    }

    /// Runs one action for the current scope. A completion from an older scope,
    /// or from after sign-out, is dropped.
    private func run(_ name: String, _ body: @escaping @MainActor (any OwnerServices, UInt64) async -> Void) {
        guard let services else { feedback = "\(name) is unavailable. No owner is configured."; return }
        let token = generation
        loading = true
        Task {
            await body(services, token)
            if token == self.generation { self.loading = false }
        }
    }

    // MARK: Search

    var searchHits: [SearchHit] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return [] }
        func matches(_ fields: [String]) -> Bool { fields.contains { $0.lowercased().contains(needle) } }
        func matches(_ fields: String...) -> Bool { matches(fields) }
        var hits: [SearchHit] = []
        for work in snapshot.work where matches(work.name, work.summary, work.id) {
            hits.append(SearchHit(id: "work-\(work.id)", title: work.name, detail: work.summary, section: .work) { [weak self] in
                self?.selectWork(work.id)
            })
        }
        for project in fabric?.portfolio?.projects ?? []
        where matches([project.name, project.canonicalId, project.workId, project.runtimeWorkId ?? ""]
            + project.aliases
            + [project.accountId ?? ""]
            + project.provenance) {
            hits.append(SearchHit(id: "project-\(project.id)", title: project.name,
                                  detail: "Display catalog · \(project.canonicalId)", section: .projects) { [weak self] in
                self?.selectProject(project.id)
            })
        }
        for product in fabric?.portfolio?.historicalProducts ?? [] where matches(product.name, product.canonicalId, product.linkedCanonicalId ?? "") {
            hits.append(SearchHit(id: "historical-\(product.id)", title: product.name,
                                  detail: "Historical product · \(product.canonicalId)", section: .projects) { [weak self] in
                self?.selectHistoricalProduct(product.id)
            })
        }
        for item in allEvidence where matches(item.title, item.sourceRef) {
            hits.append(SearchHit(id: "evidence-\(item.id)", title: item.title, detail: item.sourceRef, section: .evidence) { [weak self] in
                self?.selectEvidence(item.id)
            })
        }
        for connection in snapshot.connections where matches(connection.name, connection.detail) {
            hits.append(SearchHit(id: "connection-\(connection.id)", title: connection.name, detail: connection.detail, section: .connections) { [weak self] in
                self?.selectedConnectionID = connection.id
                self?.open(.connections)
            })
        }
        for node in fabric?.trace.nodes ?? [] where matches(node.title, node.detail, node.kind) {
            hits.append(SearchHit(id: "trace-\(node.id)", title: node.title, detail: node.kind, section: .trace) { [weak self] in
                self?.selectedTraceID = node.id
                self?.open(.trace)
            })
        }
        for item in knowledge where matches(item.title, item.detail, item.source.rawValue) {
            hits.append(SearchHit(id: "knowledge-\(item.id)", title: item.title, detail: item.source.rawValue, section: .knowledge) { [weak self] in
                self?.selectedKnowledgeID = item.id
                self?.open(.knowledge)
            })
        }
        for section in AppSection.allCases where matches(section.title) {
            hits.append(SearchHit(id: "section-\(section.rawValue)", title: section.title, detail: "Go to page", section: section) { [weak self] in
                self?.open(section)
            })
        }
        return hits
    }

    private static let emptySnapshot = SystemSnapshot(
        work: [], connections: [], asOf: "", sourceKind: "none",
        gaps: ["Sign-in is not configured.", "No owner is configured, so no live data is read."]
    )
}
