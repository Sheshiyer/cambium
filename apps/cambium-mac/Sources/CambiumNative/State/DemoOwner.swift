import CryptoKit
import Foundation
import CambiumCore

/// Demo clock pinned to the source fixture window. It is never the current time.
struct FixedCoreClock: CoreClock {
    let date: Date
    func now() -> Date { date }
}

/// Pinned synthetic session for the demo. `replace(.unconfigured)` ends the
/// scope, so a Core call still in flight fails its own scope check.
final class PinnedSessionProvider: SessionProvider, @unchecked Sendable {
    private let lock = NSLock()
    private var session: NativeSession

    init(_ session: NativeSession) { self.session = session }

    func replace(_ session: NativeSession) {
        lock.lock(); defer { lock.unlock() }
        self.session = session
    }

    func currentSession() async -> NativeSession { snapshot() }

    private func snapshot() -> NativeSession {
        lock.lock(); defer { lock.unlock() }
        return session
    }
}

/// Demo authorizer. The value is the synthetic bearer the source fixtures use.
/// It is not a credential and it only reaches the in-process demo owner.
struct DemoAuthorizer: RequestAuthorizer {
    func headers() async throws -> [String: String] { ["authorization": "Bearer synthetic-founder"] }
}

/// Byte copies of source-produced wire fixtures, checked against the lineage manifest.
nonisolated enum SourceFixtures {
    static func data(_ name: String) -> Data? {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: name, withExtension: "json") else { return nil }
        return try? Data(contentsOf: url)
    }

    static func sha256(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    /// Each manifest row with whether the bundled bytes still match its hash.
    static func lineage() -> [FixtureLineageDisplay] {
        guard let data = data("fixture-lineage"),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rows = object["fixtures"] as? [[String: Any]] else { return [] }
        return rows.compactMap { row in
            guard let name = row["name"] as? String, let hash = row["sha256"] as? String,
                  let source = row["source"] as? String else { return nil }
            let stem = name.hasSuffix(".json") ? String(name.dropLast(5)) : name
            let verified = Self.data(stem).map { sha256($0) == hash } ?? false
            return FixtureLineageDisplay(name: name, sha256: hash, source: source, verified: verified,
                                         synthetic: row["synthetic"] as? Bool ?? false)
        }
    }

    /// Loads a fixture only when its bytes match the manifest.
    static func verified(_ name: String) -> Data? {
        guard let data = data(name),
              lineage().contains(where: { $0.name == name + ".json" && $0.sha256 == sha256(data) }) else { return nil }
        return data
    }
}

/// In-process owner for the demo. It answers from the bundled source fixtures,
/// keeps the request identity it was sent, and persists what it accepted.
///
/// The durable record holds opaque identifiers and bounded states only: no
/// review text, confirmation, token, prompt or response body. A labelled fault
/// drops the reply after the record is written, so recovery must read status.
actor DemoOwnerSimulator: HTTPTransport {
    struct DecisionRecord: Codable, Equatable {
        var proposalId: String
        var version: Int
        var nonce: String
        var decision: String
    }

    struct LaunchRecord: Codable, Equatable {
        var requestId: String
        var attemptId: String
        var nonce: String
        var workId: String
        var admissionRef: String
        var state: String
    }

    private struct Disk: Codable {
        var v = 1
        var decisions: [DecisionRecord]
        var launches: [LaunchRecord]
        var decisionWrites: Int
        var launchWrites: Int
    }

    static let fileName = "demo-owner.v1.json"
    static let launchStates = ["queued", "running", "succeeded"]

    private let directory: URL
    private let latency: (@Sendable (String) async -> Void)?
    private let decisionFixture: Data?
    private let pendingFixture: Data?
    private let proposalFixture: (status: Int, body: Data)?
    private let launchSamples: [String: (status: Int, body: Data)]
    private let fabricFixture: Data?

    private var decisions: [DecisionRecord] = []
    private var launches: [LaunchRecord] = []
    private var decisionWrites = 0
    private var launchWrites = 0
    private var dropNextResponse = false
    /// Requests this process received, by path. Not persisted.
    private var received: [String: Int] = [:]

    init(directory: URL, latency: (@Sendable (String) async -> Void)? = nil) {
        self.directory = directory
        self.latency = latency
        func body(_ name: String) -> (status: Int, body: Data)? {
            guard let data = SourceFixtures.verified(name),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let status = object["status"] as? Int, let inner = object["body"],
                  let encoded = try? JSONSerialization.data(withJSONObject: inner) else { return nil }
            return (status, encoded)
        }
        proposalFixture = body("founder-proposal-response")
        decisionFixture = body("founder-decision-approved")?.body
        pendingFixture = body("founder-status-pending")?.body
        fabricFixture = SourceFixtures.verified("mission-fabric-envelope-founder")
        var samples: [String: (status: Int, body: Data)] = [:]
        if let data = SourceFixtures.verified("native-launch-wire.v1"),
           let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let rows = root["samples"] as? [[String: Any]] {
            for row in rows {
                guard let name = row["name"] as? String, let output = row["output"] as? [String: Any],
                      let status = output["status"] as? Int, let inner = output["body"],
                      let encoded = try? JSONSerialization.data(withJSONObject: inner) else { continue }
                samples[name] = (status, encoded)
            }
        }
        launchSamples = samples
        if let disk = Self.read(directory) {
            decisions = disk.decisions
            launches = disk.launches
            decisionWrites = disk.decisionWrites
            launchWrites = disk.launchWrites
        }
    }

    // MARK: Test and demo controls

    func armResponseLoss() { dropNextResponse = true }
    func responseLossArmed() -> Bool { dropNextResponse }
    func receivedCount(_ path: String) -> Int { received[path, default: 0] }
    func durableDecisionWrites() -> Int { decisionWrites }
    func durableLaunchWrites() -> Int { launchWrites }

    /// Clears the whole demo owner. It never touches any standard-mode directory.
    func reset() {
        decisions = []
        launches = []
        decisionWrites = 0
        launchWrites = 0
        dropNextResponse = false
        received = [:]
        try? FileManager.default.removeItem(at: directory.appendingPathComponent(Self.fileName))
    }

    // MARK: HTTPTransport

    func send(_ request: HTTPRequest) async throws -> HTTPResponse {
        let path = request.url.path
        received[path, default: 0] += 1
        if let latency { await latency(path) }
        guard request.headers["authorization"] == "Bearer synthetic-founder" else {
            return HTTPResponse(status: 401, body: Data(#"{"error":"unauthorized"}"#.utf8))
        }
        let body = (try? JSONSerialization.jsonObject(with: request.body ?? Data())) as? [String: Any] ?? [:]
        switch path {
        case "/v1/founder/proposal":
            guard let proposalFixture else { throw TransportFailure.ownerUnconfigured }
            return HTTPResponse(status: proposalFixture.status, body: proposalFixture.body)
        case "/v1/founder/decision":
            return try decide(body)
        case "/v1/founder/status":
            return try decisionStatus(body)
        case "/v1/native/launch/admissions":
            return try admissions(body)
        case "/v1/native/launch/capability":
            return try capability(body)
        case "/v1/native/launch":
            return try launch(body)
        case "/v1/native/launch/status":
            return try launchStatus(body)
        case "/v1/mission-fabric/cambium":
            guard let fabricFixture else { throw TransportFailure.ownerUnconfigured }
            return HTTPResponse(status: 200, body: fabricFixture)
        default:
            return HTTPResponse(status: 404, body: Data(#"{"status":"not_found"}"#.utf8))
        }
    }

    // MARK: Founder gate

    private func decide(_ body: [String: Any]) throws -> HTTPResponse {
        guard let proposalId = body["proposalId"] as? String, let version = body["version"] as? Int,
              let nonce = body["nonce"] as? String, let decision = body["decision"] as? String,
              decision == "approved" else {
            // Only the approved source vector exists. Anything else is refused, not invented.
            return HTTPResponse(status: 200, body: Data(#"{"status":"invalid","canonicalReadback":false}"#.utf8))
        }
        if !decisions.contains(where: { $0.proposalId == proposalId && $0.version == version && $0.nonce == nonce }) {
            decisions.append(DecisionRecord(proposalId: proposalId, version: version, nonce: nonce, decision: decision))
            decisionWrites += 1
            try persist()
        }
        if dropNextResponse {
            dropNextResponse = false
            throw TransportFailure.timeout
        }
        guard let decisionFixture else { throw TransportFailure.ownerUnconfigured }
        return HTTPResponse(status: 200, body: decisionFixture)
    }

    private func decisionStatus(_ body: [String: Any]) throws -> HTTPResponse {
        guard let proposalId = body["proposalId"] as? String, let version = body["version"] as? Int,
              let nonce = body["nonce"] as? String else { throw TransportFailure.malformedResponse }
        let recorded = decisions.contains { $0.proposalId == proposalId && $0.version == version && $0.nonce == nonce }
        guard let answer = recorded ? decisionFixture : pendingFixture else { throw TransportFailure.ownerUnconfigured }
        return HTTPResponse(status: 200, body: answer)
    }

    // MARK: Launch

    /// Replays the dated admission listing for the requested work. The body is the
    /// source sample's own body with `workId` set to the request, so an empty
    /// other-work sample stays empty and a cambium sample keeps its own refs.
    private func admissions(_ body: [String: Any]) throws -> HTTPResponse {
        let workId = body["workId"] as? String ?? ""
        let name = workId == "sapling:cambium" ? "admissions_current" : "admissions_other_work_empty"
        guard let sample = launchSamples[name],
              var object = try JSONSerialization.jsonObject(with: sample.body) as? [String: Any] else {
            throw TransportFailure.ownerUnconfigured
        }
        object["workId"] = workId
        return HTTPResponse(status: sample.status, body: try JSONSerialization.data(withJSONObject: object))
    }

    /// Resolves only the supported ref from the dated listing. A different ref,
    /// including one the listing marked unsupported or unavailable, is the
    /// source unavailable sample. The app does not rewrite that sample.
    private func capability(_ body: [String: Any]) throws -> HTTPResponse {
        let workId = body["workId"] as? String
        let admission = body["admissionRef"] as? String
        let name = workId == "sapling:cambium" && admission == "adm-123"
            ? "capability_supported" : "capability_unavailable"
        guard let sample = launchSamples[name] else { throw TransportFailure.ownerUnconfigured }
        return HTTPResponse(status: sample.status, body: sample.body)
    }

    private func launch(_ body: [String: Any]) throws -> HTTPResponse {
        guard let requestId = body["requestId"] as? String, let attemptId = body["attemptId"] as? String,
              let nonce = body["idempotencyNonce"] as? String,
              let capability = body["capability"] as? [String: Any],
              let workId = capability["workId"] as? String, let admission = capability["admissionRef"] as? String else {
            throw TransportFailure.malformedResponse
        }
        let record: LaunchRecord
        let duplicate: Bool
        if let existing = launches.first(where: { $0.nonce == nonce }) {
            record = existing
            duplicate = true
        } else {
            duplicate = false
            record = LaunchRecord(requestId: requestId, attemptId: attemptId, nonce: nonce,
                                  workId: workId, admissionRef: admission, state: "queued")
            launches.append(record)
            launchWrites += 1
            try persist()
        }
        if dropNextResponse {
            dropNextResponse = false
            throw TransportFailure.timeout
        }
        return try echo(record, http: duplicate ? 200 : 202, status: duplicate ? "duplicate" : "recorded")
    }

    /// Status readback keeps the original request identity. Each read moves the
    /// demo execution one step: queued, running, succeeded. Acceptance stays not_evaluated.
    private func launchStatus(_ body: [String: Any]) throws -> HTTPResponse {
        guard let requestId = body["requestId"] as? String, let attemptId = body["attemptId"] as? String else {
            throw TransportFailure.malformedResponse
        }
        guard let index = launches.firstIndex(where: { $0.requestId == requestId && $0.attemptId == attemptId }) else {
            guard let sample = launchSamples["status_unknown_request"] else { throw TransportFailure.ownerUnconfigured }
            return HTTPResponse(status: sample.status, body: sample.body)
        }
        if let at = Self.launchStates.firstIndex(of: launches[index].state), at + 1 < Self.launchStates.count {
            launches[index].state = Self.launchStates[at + 1]
            try persist()
        }
        return try echo(launches[index], http: 200, status: "observed")
    }

    /// The source projection with this request's identity and state. Every other
    /// field, including the pinned capability tuple, is the source fixture's own.
    private func echo(_ record: LaunchRecord, http: Int, status: String) throws -> HTTPResponse {
        guard let base = launchSamples["launch_accepted_queued"],
              var object = try JSONSerialization.jsonObject(with: base.body) as? [String: Any],
              var request = object["request"] as? [String: Any],
              var execution = object["execution"] as? [String: Any] else { throw TransportFailure.ownerUnconfigured }
        let terminal = record.state == "succeeded"
        request["requestId"] = record.requestId
        request["attemptId"] = record.attemptId
        execution["state"] = record.state
        execution["terminal"] = terminal
        object["request"] = request
        object["execution"] = execution
        object["status"] = status
        object["retry"] = terminal ? "none" : "status_only"
        return HTTPResponse(status: http, body: try JSONSerialization.data(withJSONObject: object))
    }

    // MARK: Persistence

    private static func read(_ directory: URL) -> Disk? {
        let url = directory.appendingPathComponent(fileName)
        guard let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
              let size = (attributes[.size] as? NSNumber)?.intValue, size <= 65_536,
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Disk.self, from: data)
    }

    private func persist() throws {
        let disk = Disk(decisions: decisions, launches: launches, decisionWrites: decisionWrites, launchWrites: launchWrites)
        let data = try JSONEncoder().encode(disk)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                                attributes: [.posixPermissions: 0o700])
        let url = directory.appendingPathComponent(Self.fileName)
        try data.write(to: url, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }
}

enum DemoPaths {
    /// Demo-only state. Standard mode never reads or writes here.
    static var defaultDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base.appendingPathComponent("space.thoughtseed.cambium.native.dev", isDirectory: true)
            .appendingPathComponent("demo-v1", isDirectory: true)
    }
}
