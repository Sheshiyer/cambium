import Foundation
import CryptoKit

private func codeDigest(_ data: Data) -> String { "sha256:" + SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }

public struct DirectionExecutionSummary: Codable, Equatable, Sendable {
    public let objective: String
    public let artifact: String
    public let baseCommit: String
    public let patchDigest: String
    public let allowedPaths: [String]
    public let check: String
    public let timeoutSeconds: Int
    public let modelPool: String
    public let acceptance: String
    public let externalActions: String
}
public struct DirectionExecutionPreview: Decodable, Equatable, Sendable {
    public let schema: String
    public let tenantId: String
    public let principal: String
    public let directionId: String
    public let directionRevision: Int
    public let expectedHeadDigest: String
    public let policyDigest: String
    public let summary: DirectionExecutionSummary
    public let writerAuthority: Bool
    public let executionGranted: Bool
}
public struct DirectionExecutionPrepare: Encodable, Equatable, Sendable {
    public let schema = "cambium.direction-execution-intent.v1"
    public let operationId: String
    public let directionRevision: Int
    public let expectedHeadDigest: String
    public let policyDigest: String
    public init(operationId: String, preview: DirectionExecutionPreview) {
        self.operationId = operationId; directionRevision = preview.directionRevision
        expectedHeadDigest = preview.expectedHeadDigest; policyDigest = preview.policyDigest
    }
}
public struct PreparedDirectionExecution: Decodable, Equatable, Sendable {
    public let schema: String
    public let tenantId: String
    public let principal: String
    public let directionId: String
    public let directionRevision: Int
    public let workObjectId: String
    public let proposalId: String
    public let changeDigest: String
    public let duplicate: Bool
    public let writerAuthority: Bool
    public let executionGranted: Bool
}
public struct DirectionAdmission: Decodable, Equatable, Sendable {
    public let schema: String
    public let tenantId: String
    public let principal: String
    public let proposalId: String
    public let admissionRef: String
    public let workObjectId: String
    public let expiresAt: String
    public let status: String
    public let launchReady: Bool
    public let consumed: Bool
    public let admissionGranted: Bool
    public let launched: Bool
}
private func digest(_ value: String, prefix: Bool = true) -> Bool {
    value.range(of: prefix ? #"^sha256:[a-f0-9]{64}$"# : #"^[a-f0-9]{64}$"#, options: .regularExpression) != nil
}
extension DirectionHTTPClient {
    public func executionPreview(tenant: String, direction: SharedDirection) async throws -> DirectionExecutionPreview {
        let (data, context) = try await request("GET", tenant: tenant, endpoint: .executionReview(direction.id))
        let result = try JSONDecoder().decode(DirectionExecutionPreview.self, from: data)
        guard result.schema == "cambium.direction-execution-preview.v1", result.tenantId == context.tenantId,
              result.principal == context.principal, result.directionId == direction.id, result.directionRevision == direction.revision,
              !result.writerAuthority, !result.executionGranted, digest(result.expectedHeadDigest, prefix: false), digest(result.policyDigest),
              result.summary.objective == direction.title, result.summary.artifact.utf16.count <= 512,
              result.summary.baseCommit.range(of: #"^[a-f0-9]{40}$"#, options: .regularExpression) != nil,
              digest(result.summary.patchDigest), result.summary.allowedPaths == ["workers/quests/src/shared-signals.ts", "workers/quests/src/shared-signals.test.ts"],
              result.summary.check == "node --test workers/quests/src/shared-signals.test.ts", result.summary.timeoutSeconds == 180,
              result.summary.modelPool == "noesis-free", result.summary.acceptance == "review-required", result.summary.externalActions == "none"
        else { throw SignalError.invalid }
        return result
    }
    public func prepareExecution(tenant: String, directionId: String, value: DirectionExecutionPrepare) async throws -> PreparedDirectionExecution {
        guard value.operationId.range(of: #"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"#, options: .regularExpression) != nil,
              value.directionRevision > 0, value.directionRevision <= 9007199254740991,
              digest(value.expectedHeadDigest, prefix: false), digest(value.policyDigest) else { throw SignalError.invalidRequest }
        let (data, context) = try await request("POST", tenant: tenant, body: JSONEncoder().encode(value), endpoint: .proposal(directionId))
        let result = try JSONDecoder().decode(PreparedDirectionExecution.self, from: data)
        guard result.schema == "cambium.direction-proposal.v1", result.tenantId == context.tenantId, result.principal == context.principal,
              result.directionId == directionId, result.directionRevision == value.directionRevision, result.workObjectId == "sapling:cambium",
              digest(result.changeDigest, prefix: false), result.proposalId == context.tenantId + ":" + result.changeDigest,
              !result.writerAuthority, !result.executionGranted else { throw SignalError.invalid }
        return result
    }
    public func admitExecution(tenant: String, proposalId: String) async throws -> DirectionAdmission {
        guard proposalId.hasPrefix(tenant + ":"), digest(String(proposalId.dropFirst(tenant.count + 1)), prefix: false) else { throw SignalError.invalidRequest }
        struct Input: Encodable { let schema = "cambium.direction-admit.v1"; let proposalId: String }
        let (data, context) = try await request("POST", tenant: tenant, body: JSONEncoder().encode(Input(proposalId: proposalId)), endpoint: .admission)
        let result = try JSONDecoder().decode(DirectionAdmission.self, from: data)
        guard result.schema == "cambium.direction-admission.v1", result.tenantId == context.tenantId, result.principal == context.principal,
              result.proposalId == proposalId, result.workObjectId == "sapling:cambium", result.admissionGranted, !result.launched,
              result.launchReady != result.consumed, ["admitted", "existing"].contains(result.status),
              result.admissionRef.range(of: #"^nda_[a-f0-9]{64}$"#, options: .regularExpression) != nil,
              let expiry = CanonicalTimestamp.parse(result.expiresAt), CanonicalTimestamp.string(from: expiry) == result.expiresAt
        else { throw SignalError.invalid }
        return result
    }
}

public struct DirectionCodeResult: Codable, Equatable, Sendable {
    public let schema, taskId, directionId: String
    public let directionRevision: Int
    public let executionId, inputDigest, policyDigest, baseCommit, patchDigest, image: String
    public let baselineExitCode, candidateExitCode: Int
    public let diffBase64, baselineLog, candidateLog, status, acceptance, externalActions: String
    public var diff: String? { Data(base64Encoded: diffBase64).flatMap { String(data: $0, encoding: .utf8) } }
}
public struct DirectionExecutionResult: Decodable, Equatable, Sendable {
    public let schema, tenantId, principal, requestId, attemptId, directionId: String
    public let directionRevision: Int
    public let title, workObjectId, inputDigest, policyDigest, state: String
    public let result: DirectionCodeResult?
    public let outputDigest: String?
    public let acceptance, externalActions: String
}
extension DirectionHTTPClient {
    public func executionResult(tenant: String, requestId: String, attemptId: String) async throws -> DirectionExecutionResult {
        let (data, context) = try await request("GET", tenant: tenant, endpoint: .result(requestId))
        let value = try JSONDecoder().decode(DirectionExecutionResult.self, from: data)
        guard value.schema == "cambium.direction-result.v1", value.tenantId == context.tenantId, value.principal == context.principal,
              value.requestId == requestId, value.attemptId == attemptId, value.workObjectId == "sapling:cambium",
              value.directionRevision > 0, !value.title.isEmpty, value.title.utf16.count <= 240,
              digest(value.inputDigest), digest(value.policyDigest), value.acceptance == "review-required", value.externalActions == "none",
              ["pending", "result-ready", "failed"].contains(value.state) else { throw SignalError.invalid }
        if let result = value.result {
            guard result.schema == "thoughtseed.cambium.patch.result.v1", result.directionId == value.directionId,
                  result.directionRevision == value.directionRevision, result.inputDigest == value.inputDigest,
                  result.policyDigest == value.policyDigest, result.status == value.state,
                  result.acceptance == value.acceptance, result.externalActions == value.externalActions,
                  (0...255).contains(result.baselineExitCode), (0...255).contains(result.candidateExitCode),
                  result.status == (result.baselineExitCode != 0 && result.candidateExitCode == 0 ? "result-ready" : "failed"),
                  result.baselineLog.utf8.count <= 8192, result.candidateLog.utf8.count <= 8192,
                  let diff = Data(base64Encoded: result.diffBase64), diff.count <= 16384,
                  diff.base64EncodedString() == result.diffBase64, result.diff != nil,
                  result.patchDigest == codeDigest(diff), let outputDigest = value.outputDigest,
                  let object = try JSONSerialization.jsonObject(with: data) as? [String: Any], let raw = object["result"],
                  let canonical = try? JSONSerialization.data(withJSONObject: raw, options: [.sortedKeys, .withoutEscapingSlashes]),
                  codeDigest(canonical) == outputDigest else { throw SignalError.invalid }
        } else if value.state == "result-ready" || value.outputDigest != nil { throw SignalError.invalid }
        return value
    }
}
