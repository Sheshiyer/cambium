import Foundation
import SwiftUI
import struct CambiumCore.SystemSnapshot
import struct CambiumCore.EvidenceItem
import struct CambiumCore.MappedPortfolio

// App-local display values. This file never imports all of CambiumCore, so the
// observable model can use these types without Core's `Observation` shadowing
// the Observation module.

enum AppSection: String, CaseIterable, Identifiable, Hashable {
    case canopy, work, trace, evidence, proposal, launch, knowledge, connections, preferences, projects, inbox

    var id: String { rawValue }

    var title: String {
        switch self {
        case .canopy: "Canopy"
        case .projects: "Projects"
        case .inbox: "Inbox"
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
        case .projects: "square.grid.2x2"
        case .inbox: "tray"
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
    ///
    /// Projects is the tenth section and uses Command-0. The first nine
    /// sections keep Command-1 through Command-9 in declaration order.
    var shortcut: KeyEquivalent {
        let index = AppSection.allCases.firstIndex(of: self) ?? 0
        return KeyEquivalent(Character(String((index + 1) % 10)))
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
            "Bookmarks, Library notes and directions. A direction proposes work; it is not a task."
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
    var meaning: String = ""
    var freshness: String = ""
    var subjectId: String = ""
    var gaps: [String] = []
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

/// How a selected work item reaches a reviewable proposal.
///
/// A mapping exists only when the owner projection names both sides, or when
/// the person types a canonical proposal reference. Approval never creates one,
/// and a missing mapping is not an admission.
struct WorkProposalBinding: Equatable, Sendable {
    enum Source: String, Equatable, Sendable {
        /// The work projection carried an owner-provided proposal reference.
        case ownerProjection
        /// The person typed a canonical `tenant:digest` reference.
        case typed
    }
    var workId: String
    var proposalId: String
    var source: Source
}

/// One already-admitted row from a read-only discovery listing.
///
/// The row is an observation. Selecting a supported reference does not resolve
/// a capability until the capability route is called for that exact tuple.
struct AdmissionRowDisplay: Equatable, Identifiable, Sendable {
    var id: String { admissionRef }
    var admissionRef: String
    var workId: String
    var availability: String
    var reason: String
    var plant: String
    var action: String
    var expiresAt: String
    var existingRequestId: String?
    var selectable: Bool
}

enum ReviewChoice: String, CaseIterable, Identifiable, Sendable {
    case approve, reject
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
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

// MARK: - Owner results

/// Why an action or read has no result. Kinds stay distinct so the UI never
/// shows an unknown or refused outcome as a success.
struct ServiceIssue: Equatable, Error {
    enum Kind: String, Equatable {
        case unconfigured, unavailable, unsupported, expired, refused, unknown, invalid
    }
    var kind: Kind
    var message: String

    var title: String {
        switch kind {
        case .unconfigured: "Not configured"
        case .unavailable: "Unavailable"
        case .unsupported: "Unsupported"
        case .expired: "Expired"
        case .refused: "Refused"
        case .unknown: "Unknown"
        case .invalid: "Invalid"
        }
    }
}

struct ChangeLine: Identifiable, Hashable {
    var id: String
    var field: String
    var before: String
    var after: String
}

/// Full owner review as decoded by the Core gate client.
struct ReviewDisplay: Equatable {
    var proposalId: String
    var tenantId: String
    var version: Int
    var changeDigest: String
    var nonce: String
    var expiresAt: String
    var summary: String
    var consequence: String
    var reversibility: String
    var graphVersion: Int?
    var expectedHeadDigest: String?
    var sourceRef: String?
    var sourceDigest: String?
    var changes: [ChangeLine]
    var changeSetJSON: String
    var approveConfirmation: String
    var rejectConfirmation: String
    var principal: String
}

/// One founder decision attempt, from the persisted Core record.
struct GateDisplay: Equatable, Identifiable {
    var id: String { "\(proposalId)#\(version)#\(nonce)" }
    var proposalId: String
    var version: Int
    var nonce: String
    var choice: String
    var state: String
    var label: String
    var decidedAt: String?
    var receiptDigest: String?
    var updatedAt: String
    /// The owner may already hold this decision. Only a status read is allowed.
    var needsStatusCheck: Bool
    var recorded: Bool
}

/// Exact capability tuple the owner returned for one work and admission.
struct LaunchCapabilityDisplay: Equatable {
    var workId: String
    var admissionRef: String
    var graphVersion: Int
    var loadoutId: String
    var inputDigest: String
    var plant: String
    var plantName: String
    var action: String
    var expiresAt: String
}

/// One launch attempt, from the persisted Core record. Transport, execution and
/// semantic acceptance are separate fields.
struct LaunchDisplay: Equatable, Identifiable {
    var id: String { requestId }
    var workId: String
    var admissionRef: String
    var plantName: String
    var requestId: String
    var attemptId: String
    var nonce: String
    var state: String
    var transport: String
    var execution: String
    var acceptance: String
    var ownerRef: String?
    var requestKey: String?
    var updatedAt: String
    var needsStatusCheck: Bool
    /// True only when a status read of these exact IDs returned `404 not_found`.
    /// That saved proof is the only reason the original request may be sent again.
    var ownerAbsent: Bool
    /// Owner expiry of the capability that was saved with this attempt.
    var capabilityExpiresAt: String
}

struct FabricTraceNode: Identifiable, Equatable {
    var id: String
    var kind: String
    var title: String
    var detail: String
    var position: CGPoint
}

struct FabricTraceEdge: Identifiable, Equatable {
    var id: String
    var from: String
    var to: String
    var kind: String
}

/// Producer work graph from one decoded Mission Fabric projection.
struct FabricTrace: Equatable {
    var nodes: [FabricTraceNode]
    var edges: [FabricTraceEdge]

    func node(_ id: String) -> FabricTraceNode? { nodes.first { $0.id == id } }
}

struct FabricGapDisplay: Identifiable, Equatable {
    var id: String
    var kind: String
    var subjectId: String?
    var detail: String
}

/// Independent portfolio sidecars. They are display and proposal data, never admission.
struct PortfolioSidecarDisplay: Equatable {
    var catalogTotal: Int?
    var saplings: Int?
    var clientBranches: Int?
    var internalPrograms: Int?
    var operationalGaps: Int?
    var catalogDigest: String?
    var actionAdmission: String?
    var joinMatched: Int?
    var joinCatalogOrphans: Int?
    var joinRuntimeOrphans: Int?
    var portfolioPairDigest: String?
    var organDeliveryPresent: Bool
    var organDeliveryIsSummary: Bool
}

struct FabricDisplay: Equatable {
    var snapshot: SystemSnapshot
    var unattachedEvidence: [EvidenceItem]
    var trace: FabricTrace
    var gaps: [FabricGapDisplay]
    var sidecars: PortfolioSidecarDisplay
    /// Display catalog decoded from the served portfolio sidecar.
    ///
    /// Nil means the served envelope has no catalog detail. A decode failure
    /// fails the whole fabric read and never produces a partial catalog here.
    var portfolio: MappedPortfolio?
    var tenantId: String
    var graphVersion: Int
    var graphDigest: String
    var asOf: String
    var generatedAt: String
    var servedAt: String
    var freshness: String
}

struct KnowledgeDisplay: Equatable {
    var fieldTheory: Result<[KnowledgeItem], ServiceIssue>
    var fieldReport: Result<[KnowledgeItem], ServiceIssue>
}

struct SessionDisplay: Equatable {
    var founderId: String
    var tenantId: String
    var expiresAt: String
    var synthetic: Bool
}

struct FixtureLineageDisplay: Identifiable, Equatable {
    var id: String { name }
    var name: String
    var sha256: String
    var source: String
    var verified: Bool
    var synthetic: Bool
}

/// The surface each mode supplies. Demo and standard implementations compose
/// Core coordinators and clients; this protocol carries only app display types.
@MainActor
protocol OwnerServices: AnyObject {
    var isDemo: Bool { get }
    /// Fixed source replay time, when one applies. Never current live freshness.
    var replayClock: String? { get }
    var supportsReject: Bool { get }
    var ownerDescription: String { get }
    /// July founder-proposal fixture id, when demo mode is showing that example.
    /// It is not a WorkObject join.
    var julyProposalExampleId: String? { get }

    func session() async -> SessionDisplay?
    func signIn() async -> Result<SessionDisplay, ServiceIssue>
    func signOut() async

    func readFabric() async -> Result<FabricDisplay, ServiceIssue>
    func loadKnowledge() async -> KnowledgeDisplay

    /// Owner-proven proposal reference for `workId`. Nil: the projection does not
    /// join this work to a proposal. The caller must not invent the join.
    func proposalBinding(workId: String) -> WorkProposalBinding?
    /// Work identifiers present in the loaded projection. Used to refuse a
    /// typed selection that is not one of those records.
    func projectedWorkIds() -> [String]
    func loadReview(proposalId: String) async -> Result<ReviewDisplay, ServiceIssue>
    func submitReview(_ choice: ReviewChoice, typed: String) async -> Result<GateDisplay, ServiceIssue>
    func recoverReview() async -> Result<GateDisplay, ServiceIssue>
    /// Status-only recovery of one persisted attempt, by its original nonce.
    func recoverReview(nonce: String) async -> Result<GateDisplay, ServiceIssue>
    func pendingGate() async -> [GateDisplay]
    /// The persisted outcome for the loaded review, if one exists. It may send a
    /// status-only read and never a decision.
    func storedReview() async -> GateDisplay?
    /// True when the durable store holds an unresolved gate or launch attempt.
    /// Visible UI state is not enough to answer this.
    func hasUnresolvedAttempt() async -> Bool

    /// Read-only list of already-admitted rows for one projected work id.
    func discoverAdmissions(workId: String) async -> Result<[AdmissionRowDisplay], ServiceIssue>
    /// Resolves the exact capability for a supported admission the listing returned.
    func resolveSelectedAdmission(workId: String, admissionRef: String) async -> Result<LaunchCapabilityDisplay, ServiceIssue>
    func launch() async -> Result<LaunchDisplay, ServiceIssue>
    /// Resends the exact saved request for a proved-absent nonce. Same capability,
    /// same nonce, no new request or attempt id. Never a status read.
    func retryOriginalLaunch(nonce: String) async -> Result<LaunchDisplay, ServiceIssue>
    func recoverLaunch() async -> Result<LaunchDisplay, ServiceIssue>
    /// Status-only recovery of one persisted launch, by its original nonce.
    func recoverLaunch(nonce: String) async -> Result<LaunchDisplay, ServiceIssue>
    func pendingLaunch() async -> [LaunchDisplay]

    func armResponseLoss() async
    func responseLossArmed() async -> Bool
    func resetDemo() async
    func lineage() -> [FixtureLineageDisplay]
    /// Stops this scope: sessions are dropped so late completions are refused.
    func invalidate() async
}

/// The Five-step product tour. It is a walkthrough, not the work graph.
enum Walkthrough {
    static let steps: [TraceStep] = [
        TraceStep(id: "tour-observe", order: 1, title: "Observe", detail: "Read the labelled snapshot and its gaps.",
                  state: "walkthrough", dependsOn: [], position: CGPoint(x: 0.10, y: 0.35)),
        TraceStep(id: "tour-select", order: 2, title: "Select", detail: "Choose one work item to inspect.",
                  state: "walkthrough", dependsOn: ["tour-observe"], position: CGPoint(x: 0.30, y: 0.68)),
        TraceStep(id: "tour-review", order: 3, title: "Review", detail: "Read the source change set and type the exact confirmation.",
                  state: "walkthrough", dependsOn: ["tour-select"], position: CGPoint(x: 0.50, y: 0.32)),
        TraceStep(id: "tour-launch", order: 4, title: "Launch", detail: "Inspect the owner capability, then launch through the coordinator.",
                  state: "walkthrough", dependsOn: ["tour-review"], position: CGPoint(x: 0.70, y: 0.68)),
        TraceStep(id: "tour-recover", order: 5, title: "Recover", detail: "A lost reply is recovered by status. Nothing is sent twice.",
                  state: "walkthrough", dependsOn: ["tour-launch"], position: CGPoint(x: 0.90, y: 0.35))
    ]
}
