import Foundation
import Observation
import SwiftUI
// Scoped imports: CambiumCore exports a type named `Observation`, which would
// shadow the Observation module that the @Observable macro expands into.
import struct CambiumCore.SystemSnapshot
import struct CambiumCore.WorkObject
import struct CambiumCore.EvidenceItem
import struct CambiumCore.ConnectionObservation
import enum CambiumCore.DemoData

// Local application state for the native surface.
//
// Demo data comes from CambiumCore.DemoData and is synthetic. Standard mode
// starts with an empty snapshot and states that sign-in and the owner are not
// configured. Every action here changes local state only: nothing is sent,
// and no local result is a live receipt, decision, admission or run.

enum AppSection: String, CaseIterable, Identifiable, Hashable {
    case canopy, work, trace, evidence, proposal, launch, knowledge, connections, preferences

    var id: String { rawValue }

    var title: String {
        switch self {
        case .canopy: "Canopy"
        case .work: "Work"
        case .trace: "Trace"
        case .evidence: "Evidence"
        case .proposal: "Proposal review"
        case .launch: "Launch"
        case .knowledge: "Knowledge"
        case .connections: "Connections"
        case .preferences: "Preferences"
        }
    }

    var symbol: String {
        switch self {
        case .canopy: "map"
        case .work: "doc.text"
        case .trace: "point.3.connected.trianglepath.dotted"
        case .evidence: "doc.badge.clock"
        case .proposal: "signature"
        case .launch: "play.rectangle"
        case .knowledge: "books.vertical"
        case .connections: "link"
        case .preferences: "slider.horizontal.3"
        }
    }

    /// Command-number shortcut shown in the Go menu.
    var shortcut: KeyEquivalent {
        KeyEquivalent(Character(String((AppSection.allCases.firstIndex(of: self) ?? 0) + 1)))
    }
}

/// Which knowledge source a row belongs to. The two stay separate.
enum KnowledgeSource: String, CaseIterable, Identifiable, Hashable {
    case fieldTheory = "Field Theory"
    case fieldReport = "Field Report"

    var id: String { rawValue }

    var explanation: String {
        switch self {
        case .fieldTheory:
            "Your bookmarks, Library notes and directions. A direction proposes work; it is not a task."
        case .fieldReport:
            "Versioned observations of a place. Field Report has its own schema and is not a Field Theory note."
        }
    }

    var symbol: String {
        switch self {
        case .fieldTheory: "text.book.closed"
        case .fieldReport: "map"
        }
    }
}

struct KnowledgeItem: Identifiable, Hashable {
    var id: String
    var source: KnowledgeSource
    var title: String
    var detail: String
    var sourceRef: String
    var observedAt: String
}

struct TraceStep: Identifiable, Hashable {
    var id: String
    var order: Int
    var title: String
    var detail: String
    var state: String
    var dependsOn: [String]
    var position: CGPoint
}

/// One field in the synthetic change-set, with its value before and after.
struct ChangeLine: Identifiable, Hashable {
    var id: String
    var field: String
    var before: String
    var after: String
}

struct SyntheticProposal: Equatable {
    var id: String
    var version: Int
    var workID: String
    var summary: String
    var expiresAt: String
    var changes: [ChangeLine]

    /// Local digest of the change-set, shown so the typed phrase binds to it.
    var digest: String {
        StableHash.shortHex(([id, String(version), workID] + changes.map { "\($0.field)=\($0.before)>\($0.after)" })
            .joined(separator: "|"))
    }
}

enum ReviewChoice: String, CaseIterable, Identifiable {
    case approve, reject
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

struct SyntheticReview: Equatable {
    enum Outcome: String { case pending, approved, rejected, held }
    var outcome: Outcome = .pending
    var choice: ReviewChoice = .approve
    var typed = ""
    var decidedAt: Date?
}

/// Local launch preview. Transport, execution and semantic acceptance are
/// tracked separately so one is never read as another.
struct SyntheticLaunch: Equatable {
    enum Phase: String { case idle, requested, running, finished, uncertain }
    var phase: Phase = .idle
    var requestedAt: Date?
    var statusChecks = 0
    var lastCheckedAt: Date?

    var transport: String {
        switch phase {
        case .idle: "Not sent"
        case .requested, .running, .finished: "Synthetic request accepted locally"
        case .uncertain: "Unknown: the preview lost the reply"
        }
    }

    var execution: String {
        switch phase {
        case .idle, .requested: "Not started"
        case .running: "Synthetic run in progress"
        case .finished: "Synthetic run finished"
        case .uncertain: "Unknown: check status only, do not relaunch"
        }
    }

    var acceptance: String {
        switch phase {
        case .finished: "Not accepted: no acceptance check exists for a preview"
        default: "Not evaluated"
        }
    }
}

enum AppearanceChoice: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

struct SearchHit: Identifiable {
    var id: String
    var title: String
    var detail: String
    var section: AppSection
    var apply: () -> Void
}

@MainActor
@Observable
final class AppModel {
    private(set) var mode: LaunchMode
    var section: AppSection = .canopy
    var query = ""

    private(set) var snapshot: SystemSnapshot
    private(set) var knowledge: [KnowledgeItem] = []
    private(set) var steps: [TraceStep] = []
    private(set) var proposal: SyntheticProposal?

    var selectedWorkID: String?
    var selectedEvidenceID: String?
    var selectedConnectionID: String?
    var selectedStepID: String?
    var selectedKnowledgeID: String?
    var selectedOrgan: Organ?

    var appearance: AppearanceChoice = .system
    var reduceMotion = false
    var utcTimes = false

    var review = SyntheticReview()
    var launch = SyntheticLaunch()
    /// Short confirmation of the last local action, shown in the status line.
    private(set) var feedback: String?

    /// Demo mode starts from CAMBIUM_NATIVE_DEMO=1 or the --demo argument.
    static var launchMode: LaunchMode {
        if LaunchMode.current == .demo || CommandLine.arguments.contains("--demo") { return .demo }
        return .standard
    }

    init(mode: LaunchMode = AppModel.launchMode) {
        self.mode = mode
        snapshot = Self.emptySnapshot
        load(mode)
    }

    var isDemo: Bool { mode == .demo }

    // MARK: Mode

    func enterDemo() {
        load(.demo)
        feedback = "Opened the synthetic demo. Nothing here is live."
    }

    func leaveDemo() {
        load(.standard)
        feedback = "Left the demo. Live data needs sign-in, which this build does not have."
    }

    private func load(_ mode: LaunchMode) {
        self.mode = mode
        review = SyntheticReview()
        launch = SyntheticLaunch()
        selectedOrgan = nil
        if mode == .demo {
            snapshot = DemoData.snapshot
            knowledge = Self.demoKnowledge
            steps = Self.demoSteps
            proposal = Self.demoProposal
        } else {
            snapshot = Self.emptySnapshot
            knowledge = []
            steps = []
            proposal = nil
        }
        selectedWorkID = snapshot.work.first?.id
        selectedEvidenceID = snapshot.work.flatMap(\.evidence).first?.id
        selectedConnectionID = snapshot.connections.first?.id
        selectedStepID = steps.first?.id
        selectedKnowledgeID = knowledge.first?.id
    }

    // MARK: Lookups

    var selectedWork: WorkObject? { snapshot.work.first { $0.id == selectedWorkID } }
    var allEvidence: [EvidenceItem] { snapshot.work.flatMap(\.evidence) }
    var selectedEvidence: EvidenceItem? { allEvidence.first { $0.id == selectedEvidenceID } }
    var selectedConnection: ConnectionObservation? { snapshot.connections.first { $0.id == selectedConnectionID } }
    var selectedStep: TraceStep? { steps.first { $0.id == selectedStepID } }
    var selectedKnowledge: KnowledgeItem? { knowledge.first { $0.id == selectedKnowledgeID } }

    func work(owning evidenceID: String) -> WorkObject? {
        snapshot.work.first { $0.evidence.contains { $0.id == evidenceID } }
    }

    func time(_ iso: String?) -> String { SourceTime.display(iso, utc: utcTimes) }
    func time(_ date: Date) -> String { SourceTime.display(date, utc: utcTimes) }

    // MARK: Navigation

    func open(_ section: AppSection) {
        self.section = section
        query = ""
    }

    func selectWork(_ id: String) {
        selectedWorkID = id
        open(.work)
    }

    func selectEvidence(_ id: String) {
        selectedEvidenceID = id
        open(.evidence)
    }

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
        for step in steps where matches(step.title, step.detail) {
            hits.append(SearchHit(id: "step-\(step.id)", title: step.title, detail: step.detail, section: .trace) { [weak self] in
                self?.selectedStepID = step.id
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

    // MARK: Synthetic review

    var requiredPhrase: String {
        guard let proposal else { return "" }
        return "\(review.choice.rawValue.uppercased()) \(proposal.digest)"
    }

    /// The typed phrase must match exactly, including case and spacing.
    var typedMatches: Bool {
        proposal != nil && review.typed == requiredPhrase
    }

    func confirmReview() {
        guard isDemo, review.outcome == .pending, typedMatches else { return }
        review.outcome = review.choice == .approve ? .approved : .rejected
        review.decidedAt = Date()
        feedback = "Synthetic \(review.choice.rawValue) kept on this Mac only. No decision was recorded."
    }

    func holdReview() {
        guard isDemo, review.outcome == .pending else { return }
        review.outcome = .held
        review.decidedAt = Date()
        feedback = "Proposal held locally. You can review it again."
    }

    func resetReview() {
        review = SyntheticReview()
        feedback = "Review reset."
    }

    // MARK: Synthetic launch

    func requestLaunch() {
        guard isDemo, launch.phase == .idle else { return }
        launch.phase = .requested
        launch.requestedAt = Date()
        feedback = "Synthetic launch request made locally. Nothing was sent."
    }

    func startRun() {
        guard isDemo, launch.phase == .requested else { return }
        launch.phase = .running
        feedback = "Synthetic run started locally."
    }

    func finishRun() {
        guard isDemo, launch.phase == .running else { return }
        launch.phase = .finished
        feedback = "Synthetic run finished. No receipt exists for a preview."
    }

    func loseReply() {
        guard isDemo, launch.phase == .requested || launch.phase == .running else { return }
        launch.phase = .uncertain
        feedback = "Synthetic reply lost. Recovery is status only."
    }

    /// Status-only recovery: records a local check and never relaunches.
    func checkStatus() {
        guard isDemo, launch.phase == .uncertain else { return }
        launch.statusChecks += 1
        launch.lastCheckedAt = Date()
        feedback = "Status checked locally (\(launch.statusChecks)). Still unknown; no relaunch was sent."
    }

    func resetLaunch() {
        launch = SyntheticLaunch()
        feedback = "Launch preview reset."
    }

    func clearFeedback() { feedback = nil }

    // MARK: Fixed content

    private static let emptySnapshot = SystemSnapshot(
        work: [],
        connections: [],
        asOf: "",
        sourceKind: "none",
        gaps: [
            "Sign-in is not available in this build.",
            "No owner is configured, so no live data is read."
        ]
    )

    private static let demoKnowledge: [KnowledgeItem] = [
        KnowledgeItem(
            id: "demo-knowledge-ft-direction",
            source: .fieldTheory,
            title: "Direction: a native home for Cambium",
            detail: "Synthetic Field Theory note. It suggests a direction and does not create a task.",
            sourceRef: "synthetic://field-theory/direction/native-home",
            observedAt: "2026-11-01T18:00:00.000Z"
        ),
        KnowledgeItem(
            id: "demo-knowledge-ft-bookmark",
            source: .fieldTheory,
            title: "Bookmark: calm native dashboards",
            detail: "Synthetic Field Theory bookmark kept as a reference.",
            sourceRef: "synthetic://field-theory/bookmark/calm-dashboards",
            observedAt: "2026-10-30T12:15:00.000Z"
        ),
        KnowledgeItem(
            id: "demo-knowledge-fr-observation",
            source: .fieldReport,
            title: "Observation: studio desk, north window",
            detail: "Synthetic Field Report observation of a place, version 3.",
            sourceRef: "synthetic://field-report/observation/studio-desk/v3",
            observedAt: "2026-11-01T09:30:00.000Z"
        )
    ]

    private static let demoSteps: [TraceStep] = [
        TraceStep(id: "step-observe", order: 1, title: "Observe", detail: "Read the labelled snapshot and its gaps.",
                  state: "shown", dependsOn: [], position: CGPoint(x: 0.10, y: 0.35)),
        TraceStep(id: "step-select", order: 2, title: "Select", detail: "Choose one work item to inspect.",
                  state: "shown", dependsOn: ["step-observe"], position: CGPoint(x: 0.30, y: 0.68)),
        TraceStep(id: "step-review", order: 3, title: "Review", detail: "Read the change-set and type the exact phrase.",
                  state: "review", dependsOn: ["step-select"], position: CGPoint(x: 0.50, y: 0.32)),
        TraceStep(id: "step-preview", order: 4, title: "Preview launch", detail: "Walk the local launch preview. Nothing is sent.",
                  state: "review", dependsOn: ["step-review"], position: CGPoint(x: 0.70, y: 0.68)),
        TraceStep(id: "step-record", order: 5, title: "Record result", detail: "Held. This build cannot record a result.",
                  state: "held", dependsOn: ["step-preview", "step-review"], position: CGPoint(x: 0.90, y: 0.35))
    ]

    private static let demoProposal = SyntheticProposal(
        id: "demo-proposal-cambium-next-step",
        version: 2,
        workID: "sapling:cambium",
        summary: "Change the Cambium next step and attention after the dossier review.",
        expiresAt: "2026-11-09T00:00:00.000Z",
        changes: [
            ChangeLine(id: "c1", field: "nextStep",
                       before: "Open the dossier and inspect labelled gaps.",
                       after: "Review the launch preview and its held result."),
            ChangeLine(id: "c2", field: "attention", before: "review", after: "decide"),
            ChangeLine(id: "c3", field: "dependencies",
                       before: "program:thoughtseed-organ-console",
                       after: "program:thoughtseed-organ-console (unchanged)"),
            ChangeLine(id: "c4", field: "evidence",
                       before: "1 reference",
                       after: "1 reference (unchanged)")
        ]
    )
}
