import Foundation
import Observation
import AppKit
import SwiftUI
import struct CambiumCore.SystemSnapshot
import struct CambiumCore.WorkObject
import struct CambiumCore.EvidenceItem
import struct CambiumCore.ConnectionObservation
import enum CambiumCore.DemoData
import protocol CambiumCore.NativeBrowserPresenting

/// Application state for the nine screens.
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
    private(set) var gate: GateDisplay?
    private(set) var pendingGate: [GateDisplay] = []
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

    var ownerURLDraft = ""
    var tenantDraft = ""
    var clientIDDraft = ""
    var redirectDraft = OwnerConfiguration.reviewedRedirect
    private(set) var configuration: OwnerConfiguration?
    private(set) var configurationProblem: String?

    var feedback: String?

    private var services: (any OwnerServices)?
    private var generation: UInt64 = 0
    private var browser: (any NativeBrowserPresenting)?

    static var launchMode: LaunchMode {
        LaunchMode.current == .demo || CommandLine.arguments.contains("--demo") ? .demo : .standard
    }

    /// `services` is for tests. The app passes nothing and gets the system
    /// browser adapter, which is used only after an owner is configured and the
    /// person chooses Sign in.
    init(mode: LaunchMode = AppModel.launchMode, services: (any OwnerServices)? = nil, browser: (any NativeBrowserPresenting)? = nil) {
        self.mode = mode
        self.browser = browser ?? (services == nil ? NativeBrowserSignIn(anchorProvider: { NSApp.keyWindow }) : nil)
        snapshot = Self.emptySnapshot
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
    var supportsReject: Bool { services?.supportsReject ?? false }
    var replayClock: String? { services?.replayClock }

    var allEvidence: [EvidenceItem] { snapshot.work.flatMap(\.evidence) + unattachedEvidence }
    var selectedWork: WorkObject? { snapshot.work.first { $0.id == selectedWorkID } }
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

    func open(_ section: AppSection) { self.section = section; query = "" }
    func selectWork(_ id: String) { selectedWorkID = id; open(.work) }
    func selectEvidence(_ id: String) { selectedEvidenceID = id; open(.evidence) }
    func clearFeedback() { feedback = nil }

    // MARK: Mode

    func enterDemo() { load(.demo); feedback = "Opened the demo. It replays source fixtures through the real coordinators." }
    func leaveDemo() { load(.standard); feedback = "Left the demo. Standard mode stays unconfigured until an owner is supplied." }

    func applyConfiguration() {
        switch OwnerConfiguration.validate(ownerURL: ownerURLDraft, tenant: tenantDraft, clientId: clientIDDraft, redirect: redirectDraft) {
        case .success(let value):
            configuration = value
            configurationProblem = nil
            load(.standard)
            feedback = "Owner configuration saved on this Mac. Sign in when you are ready. Nothing was contacted."
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
        let previous = services
        self.mode = mode
        review = nil
        gate = nil
        capability = nil
        launch = nil
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
        Task { await previous?.invalidate() }
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

    private func refresh(_ token: UInt64) async {
        guard let services, token == generation else { return }
        session = await services.session()
        guard session != nil else {
            snapshot = mode == .demo ? DemoData.snapshot : Self.emptySnapshot
            return
        }
        switch await services.readFabric() {
        case .success(let display) where token == generation:
            fabric = display
            snapshot = display.snapshot
            unattachedEvidence = display.unattachedEvidence
        case .failure(let failure) where token == generation:
            issue = failure
            snapshot = mode == .demo ? DemoData.snapshot : Self.emptySnapshot
        default:
            return
        }
        let knowledge = await services.loadKnowledge()
        guard token == generation else { return }
        publishKnowledge(knowledge)
        if case .success(let loaded) = await services.loadReview(), token == generation {
            review = loaded
        }
        let gates = await services.pendingGate()
        let launches = await services.pendingLaunch()
        let stored = gates.isEmpty ? await services.storedReview() : nil
        guard token == generation else { return }
        pendingGate = gates
        pendingLaunch = launches
        if let stored { gate = stored }
        selectedWorkID = selectedWorkID ?? snapshot.work.first?.id
        selectedEvidenceID = selectedEvidenceID ?? allEvidence.first?.id
        selectedConnectionID = selectedConnectionID ?? snapshot.connections.first?.id
        selectedStepID = selectedStepID ?? tourSteps.first?.id
        selectedTraceID = selectedTraceID ?? fabric?.trace.nodes.first?.id
        selectedKnowledgeID = selectedKnowledgeID ?? self.knowledge.first?.id
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
            let result = await services.signIn()
            guard token == self.generation else { return }
            switch result {
            case .success(let signed):
                self.session = signed
                self.feedback = "Signed in as \(signed.founderId) for \(signed.tenantId)."
                await self.refresh(self.generation)
            case .failure(let failure):
                self.issue = failure
                self.feedback = failure.message
            }
        }
    }

    func signOut() {
        let token = generation
        generation &+= 1
        session = nil
        review = nil
        gate = nil
        capability = nil
        launch = nil
        fabric = nil
        knowledge = []
        pendingGate = []
        pendingLaunch = []
        loading = false
        snapshot = isDemo ? DemoData.snapshot : Self.emptySnapshot
        feedback = "Signed out. Pending results from the previous session will not be shown."
        _ = token
        Task { await services?.signOut() }
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
        run("Status") { services, token in
            let result = await services.recoverReview()
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

    func inspectCapability() {
        run("Capability") { services, token in
            let result = await services.inspectCapability()
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
        run("Status") { services, token in
            let result = await services.recoverLaunch()
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

    func resetDemo() {
        guard isDemo, gate?.needsStatusCheck != true, launch?.needsStatusCheck != true else {
            feedback = "Reset is blocked while an attempt is unknown. Check status first."
            return
        }
        run("Reset") { services, token in
            await services.resetDemo()
            guard token == self.generation else { return }
            self.review = nil
            self.gate = nil
            self.capability = nil
            self.launch = nil
            self.faultArmed = false
            self.reviewTyped = ""
            self.feedback = "Demo owner and recovery were cleared. Standard mode was not touched."
            await self.refresh(token)
        }
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
        func matches(_ fields: String...) -> Bool { fields.contains { $0.lowercased().contains(needle) } }
        var hits: [SearchHit] = []
        for work in snapshot.work where matches(work.name, work.summary, work.id) {
            hits.append(SearchHit(id: "work-\(work.id)", title: work.name, detail: work.summary, section: .work) { [weak self] in
                self?.selectWork(work.id)
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
