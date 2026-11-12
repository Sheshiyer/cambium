import Foundation
import CryptoKit
import struct CambiumCore.SharedDirection

struct DirectionReviewDisplay: Equatable {
    let directionID: String
    let revision: Int
    let title: String
    let body: String
    let workID: String
    let targetObjective: String
    let observations: Int
    let patchText: String
    let baseCommit: String
    let policyID: String
    let timeoutSeconds: Int

    init?(object: [String: Any], graphVersion: Int?) {
        guard let raw = object["directionExecution"] as? [String: Any],
              let data = try? JSONSerialization.data(withJSONObject: raw),
              let wire = try? JSONDecoder().decode(Wire.self, from: data),
              wire.schema == "cambium.direction-execution-review.v1", wire.tenantId == "cambium",
              wire.direction.tenantId == wire.tenantId, wire.direction.principal == wire.principal,
              wire.direction.id == wire.input.directionId, wire.direction.revision == wire.input.directionRevision,
              wire.direction.workObjectId == "sapling:cambium", wire.work.workObjectId == "sapling:cambium",
              wire.work.nodeId == wire.direction.workNodeId, wire.input.workNodeId == wire.work.nodeId, wire.work.status == "active",
              wire.input.approvedGraphVersion == graphVersion, wire.input.approvedGraphVersion == wire.sourceHead.graphVersion + 1,
              wire.policy.modelPool == "noesis-free", wire.policy.acceptance == "review-required", wire.policy.externalActions == "none",
              wire.policy.id == "cambium.shared-signal-title.v1", wire.input.policyId == wire.policy.id,
              wire.policy.baseCommit == wire.input.baseCommit, wire.policy.patchDigest == wire.input.patchDigest,
              wire.policy.allowedPaths == ["workers/quests/src/shared-signals.ts", "workers/quests/src/shared-signals.test.ts"],
              wire.policy.testCommand == ["node", "--test", "workers/quests/src/shared-signals.test.ts"], wire.policy.limits.timeoutSeconds == 180,
              let inputObject = raw["input"], let policyObject = raw["policy"],
              let inputData = try? JSONSerialization.data(withJSONObject: inputObject, options: [.sortedKeys, .withoutEscapingSlashes]),
              let policyData = try? JSONSerialization.data(withJSONObject: policyObject, options: [.sortedKeys, .withoutEscapingSlashes]),
              Self.hash(inputData) == wire.inputDigest, Self.hash(policyData) == wire.input.policyDigest,
              wire.input.patchBase64.utf8.count <= 21848, let patch = Data(base64Encoded: wire.input.patchBase64),
              patch.base64EncodedString() == wire.input.patchBase64, Self.hash(patch) == wire.input.patchDigest,
              let text = String(data: patch, encoding: .utf8), !text.isEmpty,
              !wire.direction.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              wire.direction.title.utf16.count <= 200, wire.direction.body.utf16.count <= 16000,
              (1...16).contains(wire.direction.signalPins.count) else { return nil }
        directionID = wire.direction.id; revision = wire.direction.revision; title = wire.direction.title; body = wire.direction.body
        workID = wire.direction.workObjectId; targetObjective = wire.work.desiredState; observations = wire.direction.signalPins.count
        patchText = text; baseCommit = wire.input.baseCommit; policyID = wire.policy.id; timeoutSeconds = wire.policy.limits.timeoutSeconds
    }
    private static func hash(_ data: Data) -> String { "sha256:" + SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    private struct Wire: Decodable {
        let schema: String, tenantId: String, principal: String, inputDigest: String
        let direction: SharedDirection
        let work: Work
        let sourceHead: Head
        let input: Input
        let policy: Policy
        struct Work: Decodable { let nodeId: String, workObjectId: String, desiredState: String, status: String }
        struct Head: Decodable { let graphVersion: Int }
        struct Input: Decodable {
            let directionId: String, workNodeId: String, baseCommit: String, patchBase64: String, patchDigest: String, policyId: String, policyDigest: String
            let directionRevision: Int, approvedGraphVersion: Int
        }
        struct Policy: Decodable {
            let id: String, baseCommit: String, patchDigest: String, modelPool: String, acceptance: String, externalActions: String
            let allowedPaths: [String], testCommand: [String]
            let limits: Limits
            struct Limits: Decodable { let timeoutSeconds: Int }
        }
    }
}
