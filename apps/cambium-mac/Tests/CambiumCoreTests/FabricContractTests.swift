import CryptoKit
import XCTest
@testable import CambiumCore

final class FabricContractTests: XCTestCase {

    private func fixtureData(named filename: String) throws -> Data {
        let currentFileURL = URL(fileURLWithPath: #filePath)
        let fixturesDir = currentFileURL.deletingLastPathComponent().appendingPathComponent("Fixtures")
        let fileURL = fixturesDir.appendingPathComponent(filename).appendingPathExtension("json")
        return try Data(contentsOf: fileURL)
    }

    func testCanonicalVectorsAndDigests() throws {
        let data = try fixtureData(named: "fabric-canonical-vectors")
        guard case .object(let root) = try JSONValue.parse(data),
              case .array(let vectors) = root["vectors"] else {
            return XCTFail("Invalid canonical vectors fixture")
        }

        for vectorValue in vectors {
            guard case .object(let v) = vectorValue,
                  case .string(let name) = v["name"],
                  case .string(let jsonStr) = v["json"] else {
                continue
            }
            let jsonData = Data(jsonStr.utf8)
            if name == "canonically-equivalent-keys" {
                XCTAssertThrowsError(try MissionFabricDecoder.graphDigest(projectionJSON: jsonData), "Expected canonically-equivalent-keys to fail")
                continue
            }
            guard case .string(let expectedDigest) = v["digest"] else { continue }
            let computedDigest = try MissionFabricDecoder.graphDigest(projectionJSON: jsonData)
            XCTAssertEqual(computedDigest, expectedDigest, "Digest mismatch for vector \(name)")
        }
    }

    func testFounderEnvelopeAndPortfolioCatalog() throws {
        let data = try fixtureData(named: "mission-fabric-envelope-founder")
        let requested = ReaderScope(tenantId: "cambium", role: "founder", principal: "founder-1")
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let now = formatter.date(from: "2026-07-28T09:05:00.000Z") ?? Date()
        let context = FabricDecodeContext(requested: requested, now: now)

        let result = MissionFabricDecoder.decode(json: data, context: context)
        switch result {
        case .success(let envelope):
            XCTAssertEqual(envelope.projection.tenantId, "cambium")
            XCTAssertNotNil(envelope.portfolioCatalogSummary)
            XCTAssertNotNil(envelope.portfolioCatalog)
            XCTAssertNotNil(envelope.portfolioJoinReport)
            XCTAssertNotNil(envelope.organUpdateDelivery)
            XCTAssertNil(envelope.organUpdateDeliverySummary)
            XCTAssertEqual(envelope.digests.graphDigest, envelope.projection.graphDigest)
            XCTAssertNotNil(envelope.digests.portfolioPairDigest)
        case .failure(let err):
            XCTFail("Failed to decode founder envelope: \(err)")
        }
    }

    func testViewerEnvelopeRestrictions() throws {
        let data = try fixtureData(named: "mission-fabric-envelope-viewer")
        let requested = ReaderScope(tenantId: "cambium", role: "viewer", principal: "viewer-1")
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let now = formatter.date(from: "2026-07-28T09:05:00.000Z") ?? Date()
        let context = FabricDecodeContext(requested: requested, now: now)

        let result = MissionFabricDecoder.decode(json: data, context: context)
        switch result {
        case .success(let envelope):
            XCTAssertEqual(envelope.projection.tenantId, "cambium")
            XCTAssertNotNil(envelope.portfolioCatalogSummary)
            XCTAssertNil(envelope.portfolioCatalog) // Viewer cannot acquire detailed founder payload
            XCTAssertNil(envelope.organUpdateDelivery)
            XCTAssertNotNil(envelope.organUpdateDeliverySummary)
        case .failure(let err):
            XCTFail("Failed to decode viewer envelope: \(err)")
        }
    }

    func testAcmeTenantFounderAndViewer() throws {
        let founderData = try fixtureData(named: "fabric-route-acme-founder")
        let requestedFounder = ReaderScope(tenantId: "acme", role: "founder", principal: "founder-1")
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let now = formatter.date(from: "2026-07-28T09:05:00.000Z") ?? Date()
        
        let founderResult = MissionFabricDecoder.decode(json: founderData, context: FabricDecodeContext(requested: requestedFounder, now: now))
        switch founderResult {
        case .success(let env):
            XCTAssertEqual(env.projection.tenantId, "acme")
        case .failure(let err):
            XCTFail("Acme founder decode failed: \(err)")
        }

        let viewerData = try fixtureData(named: "fabric-route-acme-viewer")
        let requestedViewer = ReaderScope(tenantId: "acme", role: "viewer", principal: "viewer-99")
        let viewerResult = MissionFabricDecoder.decode(json: viewerData, context: FabricDecodeContext(requested: requestedViewer, now: now))
        switch viewerResult {
        case .success(let env):
            XCTAssertEqual(env.projection.tenantId, "acme")
        case .failure(let err):
            XCTFail("Acme viewer decode failed: \(err)")
        }
    }

    func testCrossTenantWorkTamper() throws {
        let data = try fixtureData(named: "fabric-route-acme-founder")
        let requested = ReaderScope(tenantId: "cambium", role: "founder", principal: "founder-1")
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let now = formatter.date(from: "2026-07-28T09:05:00.000Z") ?? Date()
        let context = FabricDecodeContext(requested: requested, now: now)

        let result = MissionFabricDecoder.decode(json: data, context: context)
        guard case .failure(let err) = result else {
            return XCTFail("Expected tenant mismatch failure")
        }
        XCTAssertEqual(err, .tenantMismatch(expected: "cambium", actual: "acme"))
    }

    func testFutureServedAtStale() throws {
        let data = try fixtureData(named: "mission-fabric-envelope-founder")
        let requested = ReaderScope(tenantId: "cambium", role: "founder", principal: "founder-1")
        // Pass a 'now' in the past so servedAt (2026-07-28) appears in the future
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let pastNow = formatter.date(from: "2026-01-01T00:00:00.000Z") ?? Date()
        let context = FabricDecodeContext(requested: requested, now: pastNow)

        let result = MissionFabricDecoder.decode(json: data, context: context)
        guard case .failure(let err) = result else {
            return XCTFail("Expected future servedAt failure")
        }
        XCTAssertEqual(err, .stale("servedAt is in the future"))
    }

    // MARK: - Tamper vectors derived from source fixtures

    private static let servedNow = CanonicalTimestamp.parse("2026-07-28T09:05:00.000Z")!

    private func load(_ name: String) throws -> [String: Any] {
        try XCTUnwrap(JSONSerialization.jsonObject(with: fixtureData(named: name)) as? [String: Any])
    }

    private func decode(_ body: [String: Any], tenant: String, role: String = "founder", now: Date = servedNow) throws -> Result<MissionFabricEnvelope, FabricDecodeError> {
        let data = try JSONSerialization.data(withJSONObject: body)
        return MissionFabricDecoder.decode(json: data, context: FabricDecodeContext(requested: ReaderScope(tenantId: tenant, role: role, principal: "p-1"), now: now))
    }

    /// Re-seals a mutated projection with the source digest rule so only the targeted check can fail.
    private func reseal(_ body: inout [String: Any]) throws {
        var projection = try XCTUnwrap(body["projection"] as? [String: Any])
        projection["graphDigest"] = try MissionFabricDecoder.graphDigest(projectionJSON: JSONSerialization.data(withJSONObject: projection))
        body["projection"] = projection
    }

    private func failure(_ result: Result<MissionFabricEnvelope, FabricDecodeError>, file: StaticString = #filePath, line: UInt = #line) -> FabricDecodeError? {
        if case .failure(let error) = result { return error }
        XCTFail("expected failure", file: file, line: line)
        return nil
    }

    func testDuplicateSubjectAndDanglingEdgeRejected() throws {
        var dup = try load("fabric-route-acme-founder")
        var projection = try XCTUnwrap(dup["projection"] as? [String: Any])
        var nodes = try XCTUnwrap(projection["nodes"] as? [Any])
        nodes.append(nodes[0])
        projection["nodes"] = nodes
        dup["projection"] = projection
        try reseal(&dup)
        guard case .malformed(let reason)? = failure(try decode(dup, tenant: "acme")) else { return XCTFail() }
        XCTAssertTrue(reason.contains("duplicate node subject"), reason)

        var dangling = try load("fabric-route-acme-founder")
        projection = try XCTUnwrap(dangling["projection"] as? [String: Any])
        var edges = try XCTUnwrap(projection["edges"] as? [Any])
        edges.append(["kind": "executes", "fromId": "agent-cambium", "toId": "run-ghost"])
        projection["edges"] = edges
        dangling["projection"] = projection
        try reseal(&dangling)
        guard case .malformed(let edgeReason)? = failure(try decode(dangling, tenant: "acme")) else { return XCTFail() }
        XCTAssertTrue(edgeReason.contains("unresolved"), edgeReason)
    }

    func testResealedCrossTenantWorkNodeRejected() throws {
        var body = try load("fabric-route-acme-founder")
        var projection = try XCTUnwrap(body["projection"] as? [String: Any])
        var nodes = try XCTUnwrap(projection["nodes"] as? [[String: Any]])
        let index = try XCTUnwrap(nodes.firstIndex { $0["kind"] as? String == "work" })
        var value = try XCTUnwrap(nodes[index]["value"] as? [String: Any])
        value["tenantId"] = "cambium"
        nodes[index]["value"] = value
        projection["nodes"] = nodes
        body["projection"] = projection
        try reseal(&body)
        XCTAssertEqual(failure(try decode(body, tenant: "acme")), .tenantMismatch(expected: "acme", actual: "cambium"))
    }

    func testGraphDigestTamperRejected() throws {
        var body = try load("fabric-route-acme-founder")
        var projection = try XCTUnwrap(body["projection"] as? [String: Any])
        projection["graphVersion"] = 8
        body["projection"] = projection
        guard case .digest? = failure(try decode(body, tenant: "acme")) else { return XCTFail("digest tamper must fail") }
    }

    func testOldServedAtRejectedSeparatelyFromDigest() throws {
        let body = try load("fabric-route-acme-founder")
        let late = Self.servedNow.addingTimeInterval(MissionFabricCaps.maxAgeSeconds + 60)
        XCTAssertEqual(failure(try decode(body, tenant: "acme", now: late)), .stale("servedAt is too old"))
        // Same bytes, same digest, fresh clock: accepted. Freshness is not a digest property.
        guard case .success = try decode(body, tenant: "acme") else { return XCTFail() }
    }

    func testViewerCannotObtainFounderDetailByRequestingRole() throws {
        let founderBody = try load("mission-fabric-envelope-founder")
        guard case .scope? = failure(try decode(founderBody, tenant: "cambium", role: "viewer")) else {
            return XCTFail("viewer scope must reject founder detail")
        }
    }

    func testPlanAndSummaryCombinationsRejected() throws {
        var both = try load("mission-fabric-envelope-founder")
        let viewer = try load("mission-fabric-envelope-viewer")
        both["organUpdateDeliverySummary"] = viewer["organUpdateDeliverySummary"]
        guard case .malformed? = failure(try decode(both, tenant: "cambium")) else { return XCTFail() }

        var detailWithoutPlan = try load("mission-fabric-envelope-founder")
        detailWithoutPlan.removeValue(forKey: "organUpdateDelivery")
        guard case .malformed? = failure(try decode(detailWithoutPlan, tenant: "cambium")) else { return XCTFail() }

        var armed = try load("mission-fabric-envelope-founder")
        var plan = try XCTUnwrap(armed["organUpdateDelivery"] as? [String: Any])
        plan["scheduleArmed"] = true
        armed["organUpdateDelivery"] = plan
        guard case .digest? = failure(try decode(armed, tenant: "cambium")) else { return XCTFail("armed plan must break planDigest") }
    }

    func testJoinReportCountCollapseRejected() throws {
        var body = try load("mission-fabric-envelope-founder")
        var join = try XCTUnwrap(body["portfolioJoinReport"] as? [String: Any])
        join["matchedCount"] = 2
        body["portfolioJoinReport"] = join
        guard case .malformed? = failure(try decode(body, tenant: "cambium")) else { return XCTFail() }

        var ghost = try load("mission-fabric-envelope-founder")
        join = try XCTUnwrap(ghost["portfolioJoinReport"] as? [String: Any])
        join["matches"] = [["canonicalId": "sapling:cambium", "runtimeWorkId": "sapling:ghost"]]
        ghost["portfolioJoinReport"] = join
        guard case .malformed? = failure(try decode(ghost, tenant: "cambium")) else { return XCTFail() }
    }

    func testPortfolioPairAndCatalogDigestsAreSeparate() throws {
        let expectations = try load("fabric-expectations")
        let shadow = try XCTUnwrap(expectations["cambiumShadow"] as? [String: Any])
        guard case .success(let envelope) = try decode(try load("fabric-route-cambium-founder-shadow"), tenant: "cambium") else { return XCTFail() }
        XCTAssertEqual(envelope.projection.graphDigest, shadow["graphDigest"] as? String)
        XCTAssertEqual(envelope.delivery.portfolioPairDigest, shadow["pairDigest"] as? String)
        let digests = envelope.digests
        XCTAssertEqual(Set([digests.graphDigest, digests.catalogDigest, digests.actionCatalogDigest, digests.portfolioPairDigest].compactMap { $0 }).count, 4)

        var swapped = try load("fabric-route-cambium-founder-shadow")
        var delivery = try XCTUnwrap(swapped["delivery"] as? [String: Any])
        delivery["portfolioPairDigest"] = digests.catalogDigest
        swapped["delivery"] = delivery
        XCTAssertEqual(failure(try decode(swapped, tenant: "cambium")), .digest("portfolioPairDigest"))

        var catalogTamper = try load("fabric-route-cambium-founder-shadow")
        var catalog = try XCTUnwrap(catalogTamper["portfolioCatalog"] as? [String: Any])
        var records = try XCTUnwrap(catalog["records"] as? [[String: Any]])
        records[0]["name"] = "Tampered"
        catalog["records"] = records
        catalogTamper["portfolioCatalog"] = catalog
        XCTAssertEqual(failure(try decode(catalogTamper, tenant: "cambium")), .digest("portfolioCatalog"))
    }

    func testRedactedViewerDigestIsServerComputedAndPreservesGaps() throws {
        let expectations = try XCTUnwrap(try load("fabric-expectations")["acme"] as? [String: Any])
        guard case .success(let viewer) = try decode(try load("fabric-route-acme-viewer"), tenant: "acme", role: "viewer"),
              case .success(let founder) = try decode(try load("fabric-route-acme-founder"), tenant: "acme") else { return XCTFail() }
        XCTAssertEqual(viewer.projection.graphDigest, expectations["viewerGraphDigest"] as? String)
        XCTAssertEqual(viewer.projection.graphDigest, expectations["founderRedactedForViewer"] as? String)
        XCTAssertEqual(founder.projection.graphDigest, expectations["founderGraphDigest"] as? String)
        // Deliberate source gaps stay explicit; nothing is invented to fill them.
        XCTAssertTrue(viewer.projection.gaps.contains { $0.kind == "missing-join" && $0.subjectId == "run-fabric-orphan" })
        XCTAssertTrue(viewer.projection.gaps.allSatisfy { $0.evidenceRef == nil })
        let tasks = viewer.projection.nodes.compactMap { node -> FabricTaskValue? in
            if case .task(let task) = node { return task }
            return nil
        }
        XCTAssertTrue(tasks.contains { $0.taskId == "mission-fabric-foundation" && $0.missionId == nil })
        let snapshot = MissionFabricDecoder.snapshot(from: viewer)
        XCTAssertEqual(snapshot.sourceKind, "mission-fabric")
        XCTAssertTrue(snapshot.gaps.contains("gap-executes-join-run-fabric-orphan"))
    }

    func testJSONNumberAndBoolStayDistinctInCanonicalForm() throws {
        let value = try JSONValue.parse(Data(#"[true,1,false,0,null,-0,1e21]"#.utf8))
        XCTAssertEqual(value.canonical(), "[true,1,false,0,null,0,1e+21]")
    }

    func testShadowReportAndSidecarsValidation() throws {
        let shadowData = try fixtureData(named: "fabric-route-cambium-founder-shadow")
        let requested = ReaderScope(tenantId: "cambium", role: "founder", principal: "founder-1")
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let now = formatter.date(from: "2026-07-28T09:05:00.000Z") ?? Date()
        let context = FabricDecodeContext(requested: requested, now: now)

        let result = MissionFabricDecoder.decode(json: shadowData, context: context)
        switch result {
        case .success(let envelope):
            XCTAssertEqual(envelope.projection.tenantId, "cambium")
            XCTAssertNotNil(envelope.portfolioCatalogSummary)
            XCTAssertNotNil(envelope.portfolioCatalog)
            XCTAssertNotNil(envelope.portfolioJoinReport)
            XCTAssertNotNil(envelope.organUpdateDelivery)
        case .failure(let err):
            XCTFail("Failed to decode shadow envelope with sidecars: \(err)")
        }
    }

    func testJSONUnicodeEscapesRejectSignWhitespaceAndLoneSurrogates() throws {
        func parsed(_ json: String) throws -> JSONValue { try JSONValue.parse(Data(json.utf8)) }
        XCTAssertEqual(try parsed(#""\u0001""#), .string("\u{0001}"))
        XCTAssertEqual(try parsed(#""\uD83D\uDE00""#), .string("😀"))
        for bad in [#""\u+001""#, #""\u-001""#, #""\u 001""#, #""\u001 ""#, #""\uD83D""#, #""\uDE00""#, #""\uD83D\uD83D""#] {
            XCTAssertThrowsError(try parsed(bad), "expected \(bad) to fail")
        }
        XCTAssertThrowsError(try JSONValue.parse(Data([0x22, 0x80, 0x22])), "invalid UTF-8 inside a string must fail")
    }

    func testUnsupportedRoleRejected() throws {
        let body = try load("fabric-route-acme-viewer")
        guard case .scope(let reason)? = failure(try decode(body, tenant: "acme", role: "operator")) else { return XCTFail() }
        XCTAssertTrue(reason.contains("unsupported role"), reason)
    }

    func testReportedProjectionTruncationKeepsUnresolvedEdges() throws {
        let expected = try XCTUnwrap(try load("fabric-expectations")["capTruncation"] as? [String: Any])
        let capBody = try load("fabric-route-cap-truncation")
        guard case .success(let envelope) = try decode(capBody, tenant: "acme") else { return XCTFail() }
        XCTAssertEqual(envelope.projection.graphDigest, expected["graphDigest"] as? String)
        XCTAssertEqual(envelope.projection.nodes.count, MissionFabricCaps.maxNodes)
        XCTAssertEqual(envelope.projection.nodes.count, expected["nodeCount"] as? Int)
        XCTAssertEqual(Set(envelope.truncated), Set(try XCTUnwrap(expected["truncationGapIds"] as? [String])))
        let subjects = Set(envelope.projection.nodes.map(\.subjectId))
        let unresolved = envelope.projection.edges.filter { !subjects.contains($0.fromId) || ($0.kind != "pins-loadout" && !subjects.contains($0.toId)) }
        XCTAssertFalse(unresolved.isEmpty, "source cap must retain at least one edge with an omitted endpoint")
        XCTAssertFalse(subjects.contains("task-fabric-contract"), "omitted endpoint must stay absent")
        XCTAssertEqual(envelope.projection.edges.count, (try XCTUnwrap((capBody["projection"] as? [String: Any])?["edges"] as? [Any])).count)

        // Same source projection without its truncation gaps, resealed: dangling edges are refused.
        var stripped = capBody
        var strippedProjection = try XCTUnwrap(stripped["projection"] as? [String: Any])
        let gaps = try XCTUnwrap(strippedProjection["gaps"] as? [[String: Any]])
        strippedProjection["gaps"] = gaps.filter { $0["kind"] as? String != "projection-truncated" }
        stripped["projection"] = strippedProjection
        try reseal(&stripped)
        guard case .malformed(let strippedReason)? = failure(try decode(stripped, tenant: "acme")) else { return XCTFail() }
        XCTAssertTrue(strippedReason.contains("unresolved"), strippedReason)

        var unreported = try load("fabric-route-acme-founder")
        var projection = try XCTUnwrap(unreported["projection"] as? [String: Any])
        var edges = try XCTUnwrap(projection["edges"] as? [Any])
        edges.append(["kind": "executes", "fromId": "agent-cambium", "toId": "run-ghost"])
        projection["edges"] = edges
        unreported["projection"] = projection
        try reseal(&unreported)
        guard case .malformed(let reason)? = failure(try decode(unreported, tenant: "acme")) else { return XCTFail() }
        XCTAssertTrue(reason.contains("unresolved"), reason)
    }

    /// Content hash of a catalog with `catalogDigest` excluded, matching the decoder.
    private func resealCatalog(_ body: inout [String: Any]) throws {
        var catalog = try XCTUnwrap(body["portfolioCatalog"] as? [String: Any])
        catalog.removeValue(forKey: "catalogDigest")
        let parsed = try JSONValue.parse(JSONSerialization.data(withJSONObject: catalog))
        catalog["catalogDigest"] = MissionFabricDecoder.sha256Digest(parsed)
        body["portfolioCatalog"] = catalog
        var summary = try XCTUnwrap(body["portfolioCatalogSummary"] as? [String: Any])
        summary["catalogDigest"] = catalog["catalogDigest"]
        body["portfolioCatalogSummary"] = summary
    }

    /// Content hash of an organ plan with `planDigest` excluded, matching the decoder.
    private func resealPlan(_ body: inout [String: Any]) throws {
        var plan = try XCTUnwrap(body["organUpdateDelivery"] as? [String: Any])
        plan.removeValue(forKey: "planDigest")
        let parsed = try JSONValue.parse(JSONSerialization.data(withJSONObject: plan))
        plan["planDigest"] = MissionFabricDecoder.sha256Digest(parsed)
        body["organUpdateDelivery"] = plan
    }

    func testResealedSidecarFieldMutationsRejected() throws {
        func rejecting(_ mutate: (inout [String: Any]) throws -> Void, reseal: ((inout [String: Any]) throws -> Void)? = nil) throws -> FabricDecodeError? {
            var body = try load("fabric-route-cambium-founder-shadow")
            try mutate(&body)
            if let reseal { try reseal(&body) }
            return failure(try decode(body, tenant: "cambium"))
        }
        guard case .malformed? = try rejecting({ body in
            var catalog = body["portfolioCatalog"] as! [String: Any]
            var records = catalog["records"] as! [[String: Any]]
            records[0]["canonicalId"] = "not an id"
            catalog["records"] = records
            body["portfolioCatalog"] = catalog
        }, reseal: resealCatalog) else { return XCTFail("invalid catalog id") }
        guard case .schema? = try rejecting({ body in
            var catalog = body["portfolioCatalog"] as! [String: Any]
            var records = catalog["records"] as! [[String: Any]]
            records[0]["classification"] = "secret"
            catalog["records"] = records
            body["portfolioCatalog"] = catalog
        }, reseal: resealCatalog) else { return XCTFail("invalid classification") }
        guard case .schema? = try rejecting({ body in
            var catalog = body["portfolioCatalog"] as! [String: Any]
            var records = catalog["records"] as! [[String: Any]]
            records[0]["kind"] = "mystery"
            catalog["records"] = records
            body["portfolioCatalog"] = catalog
        }, reseal: resealCatalog) else { return XCTFail("invalid kind") }
        guard case .malformed? = try rejecting({ body in
            var catalog = body["portfolioCatalog"] as! [String: Any]
            var records = catalog["records"] as! [[String: Any]]
            records[0]["provenance"] = [1]
            catalog["records"] = records
            body["portfolioCatalog"] = catalog
        }, reseal: resealCatalog) else { return XCTFail("invalid field type") }
        guard case .schema? = try rejecting({ body in
            var plan = body["organUpdateDelivery"] as! [String: Any]
            var workflows = plan["workflows"] as! [[String: Any]]
            var topic = workflows[0]["defaultTopic"] as! [String: Any]
            topic["topicKey"] = "not-a-topic"
            workflows[0]["defaultTopic"] = topic
            plan["workflows"] = workflows
            body["organUpdateDelivery"] = plan
        }, reseal: resealPlan) else { return XCTFail("malformed topic") }
        guard case .malformed? = try rejecting({ body in
            var plan = body["organUpdateDelivery"] as! [String: Any]
            var workflows = plan["workflows"] as! [[String: Any]]
            workflows[0]["triggers"] = "brand-intake"
            plan["workflows"] = workflows
            body["organUpdateDelivery"] = plan
        }, reseal: resealPlan) else { return XCTFail("malformed trigger binding") }
        guard case .malformed? = try rejecting({ body in
            let viewer = try self.load("mission-fabric-envelope-viewer")
            body["organUpdateDelivery"] = nil
            body["portfolioCatalog"] = nil
            body["portfolioJoinReport"] = nil
            var planSummary = viewer["organUpdateDeliverySummary"] as! [String: Any]
            planSummary["workflowCount"] = "five"
            body["organUpdateDeliverySummary"] = planSummary
        }) else { return XCTFail("malformed count") }
        guard case .malformed(let countReason)? = try rejecting({ body in
            let viewer = try self.load("mission-fabric-envelope-viewer")
            body["organUpdateDelivery"] = nil
            body["portfolioCatalog"] = nil
            body["portfolioJoinReport"] = nil
            var planSummary = viewer["organUpdateDeliverySummary"] as! [String: Any]
            planSummary["workflowCount"] = 4
            body["organUpdateDeliverySummary"] = planSummary
        }) else { return XCTFail("count binding") }
        XCTAssertTrue(countReason.contains("workflowCount"), countReason)
        guard case .malformed? = try rejecting({ body in
            var join = body["portfolioJoinReport"] as! [String: Any]
            join["matches"] = [["canonicalId": "sapling:not-in-catalog", "runtimeWorkId": "sapling:cambium"]]
            join["matchedCount"] = 1
            body["portfolioJoinReport"] = join
        }) else { return XCTFail("mismatched join canonical id") }

        guard case .success(let envelope) = try decode(try load("fabric-route-cambium-founder-shadow"), tenant: "cambium"),
              case .object(let catalog)? = envelope.portfolioCatalog,
              case .array(let records)? = catalog["records"] else { return XCTFail("full catalog must be retained") }
        XCTAssertEqual(records.count, 76)
    }
}
