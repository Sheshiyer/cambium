import XCTest
@testable import CambiumCore

final class PortfolioProjectsTests: XCTestCase {
    private static let now = CanonicalTimestamp.parse("2026-07-28T09:05:00.000Z")!

    private func fixtureData(_ name: String) throws -> Data {
        let dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        return try Data(contentsOf: dir.appendingPathComponent(name).appendingPathExtension("json"))
    }

    private func envelope(_ name: String, role: String) throws -> MissionFabricEnvelope {
        let context = FabricDecodeContext(requested: ReaderScope(tenantId: "cambium", role: role, principal: "p-1"), now: Self.now)
        switch MissionFabricDecoder.decode(json: try fixtureData(name), context: context) {
        case .success(let value): return value
        case .failure(let error):
            XCTFail("fixture \(name) failed to decode: \(error)")
            throw error
        }
    }

    private func founder() throws -> MissionFabricEnvelope { try envelope("mission-fabric-envelope-founder", role: "founder") }

    private func mappedFounder() throws -> MappedPortfolio {
        try XCTUnwrap(try MappedPortfolioDecoder.decode(try founder()))
    }

    private func stringField(_ key: String) -> (JSONValue) -> String? {
        { value in
            guard case .object(let object) = value, case .string(let text)? = object[key] else { return nil }
            return text
        }
    }

    private func stringArrayField(_ key: String) -> (JSONValue) -> [String]? {
        { value in
            guard case .object(let object) = value, case .array(let rows)? = object[key] else { return nil }
            return rows.compactMap { if case .string(let text) = $0 { return text }; return nil }
        }
    }

    /// Edits the served catalog object after envelope validation, so only the mapper's own checks can refuse it.
    private func mutatingCatalog(_ edit: (inout [String: JSONValue]) -> Void) throws -> MissionFabricEnvelope {
        var env = try founder()
        guard case .object(var catalog)? = env.portfolioCatalog else { throw XCTSkip("fixture has no catalog") }
        edit(&catalog)
        env.portfolioCatalog = .object(catalog)
        return env
    }

    private func mutatingRecord(at index: Int, _ edit: (inout [String: JSONValue]) -> Void) throws -> MissionFabricEnvelope {
        try mutatingCatalog { catalog in
            guard case .array(var rows)? = catalog["records"], case .object(var row) = rows[index] else { return }
            edit(&row)
            rows[index] = .object(row)
            catalog["records"] = .array(rows)
        }
    }

    // MARK: - Founder detail

    func testFounderMapsEveryRecordFromSummaryCount() throws {
        let env = try founder()
        let mapped = try mappedFounder()
        let summary = try XCTUnwrap(env.portfolioCatalogSummary)
        XCTAssertTrue(mapped.detailAvailable)
        XCTAssertEqual(mapped.projects.count, summary.total)
        XCTAssertEqual(mapped.saplings.count, summary.saplings)
        XCTAssertEqual(mapped.clientBranches.count, summary.clientBranches)
        XCTAssertEqual(mapped.internalPrograms.count, summary.internalPrograms)
        XCTAssertEqual(Set(mapped.projects.map(\.workId)).count, mapped.projects.count)
        XCTAssertEqual(mapped.projects.filter { !$0.operationalGapMissingFields.isEmpty }.count, summary.operationalGaps)
        XCTAssertEqual(mapped.historicalProducts.count, summary.historicalProducts)
        XCTAssertEqual(mapped.classificationReviews.count, summary.classificationReview)
        XCTAssertEqual(mapped.summary, summary)
        XCTAssertEqual(mapped.summary.catalogDigest, summary.catalogDigest)
        XCTAssertEqual(mapped.summary.actionCatalogDigest, summary.actionCatalogDigest)
        XCTAssertEqual(mapped.summary.actionAdmission, "none")
        XCTAssertEqual(mapped.asOf, env.projection.asOf)
        XCTAssertEqual(mapped.servedAt, env.delivery.servedAt)
        XCTAssertEqual(mapped.joinReport, env.portfolioJoinReport)
        guard case .object(let catalog)? = env.portfolioCatalog, case .string(let generated)? = catalog["sourceGeneratedAt"] else {
            return XCTFail("fixture lacks sourceGeneratedAt")
        }
        XCTAssertEqual(mapped.sourceGeneratedAt, generated)
    }

    func testShadowFounderFixtureMapsDynamicallyWithSingleExplicitJoin() throws {
        let env = try envelope("fabric-route-cambium-founder-shadow", role: "founder")
        let mapped = try XCTUnwrap(try MappedPortfolioDecoder.decode(env))
        XCTAssertEqual(mapped.projects.count, env.portfolioCatalogSummary?.total)
        let report = try XCTUnwrap(env.portfolioJoinReport)
        XCTAssertEqual(mapped.runtimeLinkedProjects.map(\.canonicalId).sorted(), report.matches.map(\.canonicalId).sorted())
        XCTAssertEqual(mapped.runtimeLinkedProjects.map(\.workId), ["sapling:cambium"])
    }

    /// Opt-in cross-language probe: the TypeScript generator can write today's
    /// handler response to a temporary directory without replacing the dated
    /// replay fixture committed for deterministic tests.
    func testCurrentSourceGeneratedFounderEnvelopeWhenProvided() throws {
        guard let directory = ProcessInfo.processInfo.environment["CAMBIUM_FABRIC_FIXTURE_DIR"],
              !directory.isEmpty else { throw XCTSkip("set CAMBIUM_FABRIC_FIXTURE_DIR to probe current source") }
        let file = URL(fileURLWithPath: directory, isDirectory: true)
            .appendingPathComponent("fabric-route-cambium-founder-shadow.json")
        let data = try Data(contentsOf: file)
        let context = FabricDecodeContext(
            requested: ReaderScope(tenantId: "cambium", role: "founder", principal: "founder-1"),
            now: Self.now
        )
        let env: MissionFabricEnvelope
        switch MissionFabricDecoder.decode(json: data, context: context) {
        case .success(let value): env = value
        case .failure(let error): return XCTFail("current TypeScript handler envelope failed: \(error)")
        }
        let mapped = try XCTUnwrap(try MappedPortfolioDecoder.decode(env))
        let summary = try XCTUnwrap(env.portfolioCatalogSummary)
        XCTAssertEqual(mapped.projects.count, summary.total)
        XCTAssertEqual(mapped.historicalProducts.count, summary.historicalProducts)
        XCTAssertEqual(mapped.classificationReviews.count, summary.classificationReview)
        XCTAssertEqual(mapped.projects.filter { !$0.operationalGapMissingFields.isEmpty }.count, summary.operationalGaps)
        XCTAssertEqual(mapped.runtimeLinkedProjects.map(\.canonicalId).sorted(),
                       env.portfolioJoinReport?.matches.map(\.canonicalId).sorted())
        XCTAssertTrue(mapped.historicalProducts.allSatisfy { historical in
            mapped.project(workId: historical.canonicalId) == nil
        })
        let cambium = try XCTUnwrap(mapped.project(workId: "sapling:cambium"))
        XCTAssertEqual(cambium.name, "Cambium")
        XCTAssertEqual(cambium.classification, "sapling")
        XCTAssertEqual(cambium.tenantStatus, "canonical")
        XCTAssertEqual(cambium.tenantId, "cambium")
        XCTAssertTrue(cambium.provenance.contains("vault:40-products/cambium/product-overview.md"))
        XCTAssertTrue(cambium.linkedCanonicalIds.contains("program:cambium-operating-fabric"))
        XCTAssertEqual(cambium.runtimeWorkId, "sapling:cambium")

        let fabric = try XCTUnwrap(mapped.project(workId: "program:cambium-operating-fabric"))
        XCTAssertEqual(fabric.name, "Cambium Operating Fabric")
        XCTAssertEqual(fabric.classification, "internal-program")
        XCTAssertEqual(fabric.programKind, "operations")
        XCTAssertEqual(fabric.tenantStatus, "canonical")
        XCTAssertEqual(fabric.tenantId, "cambium")
        XCTAssertNil(fabric.runtimeWorkId)

        let relovo = try XCTUnwrap(mapped.project(workId: "branch:relovo"))
        XCTAssertEqual(relovo.name, "Relovo")
        XCTAssertEqual(relovo.classification, "client-branch")
        XCTAssertNil(relovo.runtimeWorkId)

        let mappedProjectAnchors: [(id: String, name: String, provenance: String)] = [
            ("branch:heyzack", "HeyZack", "repo:Sheshiyer/heyzack-dashboard"),
            ("branch:parkarea", "ParkArea Client Delivery", "repo:parkarea.parkarea-aleph"),
            ("branch:tirak", "Tirak Client Partnership", "repo:Sheshiyer/tirak-mobile-app-v2"),
            ("sapling:dlock", "DLOCK", "repo:thoughtseed-labs/lockwell-portal"),
        ]
        for anchor in mappedProjectAnchors {
            let project = try XCTUnwrap(mapped.project(workId: anchor.id), anchor.id)
            XCTAssertEqual(project.name, anchor.name)
            XCTAssertTrue(project.provenance.contains(anchor.provenance), anchor.id)
            XCTAssertNil(project.runtimeWorkId, anchor.id)
        }

        let exactJoin = try XCTUnwrap(env.portfolioJoinReport?.matches)
        XCTAssertEqual(exactJoin.map(\.canonicalId), ["sapling:cambium"])
        XCTAssertEqual(exactJoin.map(\.runtimeWorkId), ["sapling:cambium"])
        XCTAssertEqual(summary.actionAdmission, "none")
        XCTAssertTrue(summary.readOnly)
    }

    func testRepresentativeFitcheckRelovoAndProposedFields() throws {
        let mapped = try mappedFounder()

        let fitcheck = try XCTUnwrap(mapped.project(workId: "sapling:fitcheck"))
        XCTAssertEqual(fitcheck.id, "sapling:fitcheck")
        XCTAssertEqual(fitcheck.canonicalId, "sapling:fitcheck")
        XCTAssertEqual(fitcheck.name, "Fitcheck")
        XCTAssertEqual(fitcheck.kind, "sapling")
        XCTAssertEqual(fitcheck.classification, "sapling")
        XCTAssertEqual(fitcheck.tenantStatus, "canonical-parent")
        XCTAssertEqual(fitcheck.tenantId, "cambium")
        XCTAssertEqual(fitcheck.parentTenant, "cambium")
        XCTAssertEqual(fitcheck.promotionState, "supervised-branch")
        XCTAssertNil(fitcheck.lifecycle)
        XCTAssertNil(fitcheck.programKind)
        XCTAssertTrue(fitcheck.aliases.contains("FitCheck"))
        XCTAssertTrue(fitcheck.provenance.contains("cambium:docs/plans/product-branches/fitcheck.md"))
        XCTAssertEqual(fitcheck.linkedCanonicalIds, ["program:hdilint"])
        XCTAssertNil(fitcheck.runtimeWorkId)
        XCTAssertFalse(fitcheck.operationalGapMissingFields.isEmpty)

        let relovo = try XCTUnwrap(mapped.project(workId: "branch:relovo"))
        XCTAssertEqual(relovo.name, "Relovo")
        XCTAssertEqual(relovo.kind, "program")
        XCTAssertEqual(relovo.classification, "client-branch")
        XCTAssertEqual(relovo.programKind, "client")
        XCTAssertEqual(relovo.lifecycle, "executing")
        XCTAssertEqual(relovo.tenantStatus, "unresolved")
        XCTAssertNil(relovo.tenantId)
        XCTAssertNil(relovo.parentTenant)
        XCTAssertNil(relovo.promotionState)
        XCTAssertNil(relovo.runtimeWorkId)

        // Internal program: parent tenant and a link to a sapling are display facts, not a join.
        let fabric = try XCTUnwrap(mapped.project(workId: "program:cambium-operating-fabric"))
        XCTAssertEqual(fabric.classification, "internal-program")
        XCTAssertEqual(fabric.programKind, "operations")
        XCTAssertEqual(fabric.lifecycle, "verifying")
        XCTAssertEqual(fabric.tenantStatus, "canonical")
        XCTAssertEqual(fabric.linkedCanonicalIds, ["sapling:cambium"])
        XCTAssertNil(fabric.runtimeWorkId)

        let proposed = mapped.projects.filter { $0.lifecycle == "proposed" }
        XCTAssertFalse(proposed.isEmpty)
        for project in proposed {
            XCTAssertEqual(project.classification, "client-branch")
            XCTAssertNil(project.runtimeWorkId)
        }
        XCTAssertEqual(mapped.projectsByLifecycle()["proposed"]?.count, proposed.count)
    }

    func testFounderMapsHistoricalAndReviewRowsFromTheServedCatalog() throws {
        let env = try founder()
        let mapped = try mappedFounder()
        guard case .object(let catalog)? = env.portfolioCatalog,
              case .array(let historical)? = catalog["historicalProducts"],
              case .array(let reviews)? = catalog["classificationReview"] else {
            return XCTFail("founder fixture lacks historical or review detail")
        }

        XCTAssertEqual(mapped.historicalProducts.count, historical.count)
        XCTAssertEqual(mapped.classificationReviews.count, reviews.count)
        XCTAssertEqual(mapped.historicalProducts.map(\.canonicalId), historical.compactMap(stringField("canonicalId")))
        XCTAssertEqual(mapped.classificationReviews.map(\.canonicalId), reviews.compactMap(stringField("canonicalId")))
        XCTAssertEqual(mapped.historicalProducts.map(\.id), mapped.historicalProducts.map(\.canonicalId))

        let linked = try XCTUnwrap(mapped.historicalProducts.first { $0.linkedCanonicalId != nil })
        let source = try XCTUnwrap(historical.first { stringField("canonicalId")($0) == linked.canonicalId })
        XCTAssertEqual(linked.name, stringField("name")(source))
        XCTAssertEqual(linked.status, stringField("status")(source))
        XCTAssertEqual(linked.linkedCanonicalId, stringField("linkedCanonicalId")(source))
        XCTAssertEqual(linked.provenance, stringArrayField("provenance")(source))
        XCTAssertNil(mapped.project(workId: linked.canonicalId))
        XCTAssertNil(mapped.runtimeLinkedProjects.first { $0.canonicalId == linked.canonicalId })
        if let target = linked.linkedCanonicalId {
            XCTAssertNil(mapped.project(workId: target)?.runtimeWorkId)
        }

        for product in mapped.historicalProducts {
            XCTAssertNil(mapped.project(workId: product.canonicalId))
            XCTAssertFalse(mapped.runtimeLinkedProjects.contains { $0.canonicalId == product.canonicalId || $0.workId == product.canonicalId })
            if let target = product.linkedCanonicalId {
                XCTAssertNotEqual(mapped.project(workId: target)?.runtimeWorkId, product.canonicalId)
            }
        }
    }

    func testHistoricalLinkDoesNotCreateARuntimeJoin() throws {
        var env = try founder()
        let mapped = try XCTUnwrap(try MappedPortfolioDecoder.decode(env))
        let linked = try XCTUnwrap(mapped.historicalProducts.first { $0.linkedCanonicalId != nil })
        let target = try XCTUnwrap(linked.linkedCanonicalId)
        XCTAssertNotNil(mapped.project(workId: target))

        // The report joins the historical id itself to a real Work node. The linked
        // active record must not inherit that join through `linkedCanonicalId`.
        env.portfolioJoinReport = PortfolioJoinReport(
            matchedCount: 1, catalogOrphanCount: 0, runtimeOrphanCount: 0, runtimeIdentityCollisionCount: 0,
            matches: [PortfolioJoinMatch(canonicalId: linked.canonicalId, runtimeWorkId: "sapling:cambium")],
            catalogOrphans: [], runtimeOrphans: []
        )
        let remapped = try XCTUnwrap(try MappedPortfolioDecoder.decode(env))
        XCTAssertNil(remapped.project(workId: target)?.runtimeWorkId)
        XCTAssertNil(remapped.project(workId: "sapling:cambium")?.runtimeWorkId)
        XCTAssertTrue(remapped.runtimeLinkedProjects.isEmpty)
        XCTAssertEqual(remapped.historicalProducts.first { $0.id == linked.id }?.linkedCanonicalId, target)
    }

    // MARK: - Joins

    func testOnlyExplicitCambiumRuntimeJoinIsMapped() throws {
        let env = try founder()
        let mapped = try mappedFounder()
        let report = try XCTUnwrap(env.portfolioJoinReport)
        XCTAssertEqual(report.matches.count, 1)

        let linked = mapped.runtimeLinkedProjects
        XCTAssertEqual(linked.map(\.workId), ["sapling:cambium"])
        XCTAssertEqual(linked.first?.runtimeWorkId, "sapling:cambium")
        XCTAssertEqual(mapped.project(workId: "sapling:cambium")?.runtimeWorkId, report.matches.first?.runtimeWorkId)

        // Catalog-only projects stay unjoined, including those the report lists as orphans.
        for orphan in report.catalogOrphans {
            if let project = mapped.projects.first(where: { $0.canonicalId == orphan }) {
                XCTAssertNil(project.runtimeWorkId, orphan)
            }
        }
        XCTAssertNil(mapped.project(workId: "branch:relovo")?.runtimeWorkId)
        XCTAssertNil(mapped.project(workId: "sapling:fitcheck")?.runtimeWorkId)
    }

    func testEqualWorkIdWithoutJoinReportEntryAcquiresNoJoin() throws {
        // The projection holds a Work node whose id equals a catalog workId.
        var env = try founder()
        XCTAssertTrue(env.projection.nodes.contains { if case .work(let w) = $0 { return w.workId == "sapling:cambium" }; return false })

        // Empty report: identical strings alone never create a join.
        env.portfolioJoinReport = PortfolioJoinReport(
            matchedCount: 0, catalogOrphanCount: 0, runtimeOrphanCount: 0, runtimeIdentityCollisionCount: 0,
            matches: [], catalogOrphans: [], runtimeOrphans: []
        )
        var mapped = try XCTUnwrap(try MappedPortfolioDecoder.decode(env))
        XCTAssertNil(mapped.project(workId: "sapling:cambium")?.runtimeWorkId)
        XCTAssertTrue(mapped.runtimeLinkedProjects.isEmpty)

        // No report at all: same result.
        env.portfolioJoinReport = nil
        mapped = try XCTUnwrap(try MappedPortfolioDecoder.decode(env))
        XCTAssertNil(mapped.joinReport)
        XCTAssertTrue(mapped.runtimeLinkedProjects.isEmpty)
    }

    func testJoinTargetWithoutWorkNodeIsRefused() throws {
        var env = try founder()
        env.portfolioJoinReport = PortfolioJoinReport(
            matchedCount: 1, catalogOrphanCount: 0, runtimeOrphanCount: 0, runtimeIdentityCollisionCount: 0,
            matches: [PortfolioJoinMatch(canonicalId: "sapling:fitcheck", runtimeWorkId: "sapling:fitcheck")],
            catalogOrphans: [], runtimeOrphans: []
        )
        XCTAssertThrowsError(try MappedPortfolioDecoder.decode(env))
    }

    func testJoinIsExactCanonicalIdToRuntimeWorkId() throws {
        // Joins use the report's runtimeWorkId, which may differ from the catalog workId.
        var env = try founder()
        env.portfolioJoinReport = PortfolioJoinReport(
            matchedCount: 1, catalogOrphanCount: 0, runtimeOrphanCount: 0, runtimeIdentityCollisionCount: 0,
            matches: [PortfolioJoinMatch(canonicalId: "branch:relovo", runtimeWorkId: "branch:acme-client")],
            catalogOrphans: [], runtimeOrphans: []
        )
        let mapped = try XCTUnwrap(try MappedPortfolioDecoder.decode(env))
        XCTAssertEqual(mapped.project(workId: "branch:relovo")?.runtimeWorkId, "branch:acme-client")
        XCTAssertNil(mapped.project(workId: "sapling:cambium")?.runtimeWorkId)
        XCTAssertEqual(mapped.runtimeLinkedProjects.count, 1)
    }

    func testJoinForUnknownCanonicalIdIsRefused() throws {
        var env = try founder()
        env.portfolioJoinReport = PortfolioJoinReport(
            matchedCount: 1, catalogOrphanCount: 0, runtimeOrphanCount: 0, runtimeIdentityCollisionCount: 0,
            matches: [PortfolioJoinMatch(canonicalId: "sapling:not-in-catalog", runtimeWorkId: "sapling:cambium")],
            catalogOrphans: [], runtimeOrphans: []
        )
        XCTAssertThrowsError(try MappedPortfolioDecoder.decode(env))
    }

    // MARK: - Viewer

    func testViewerKeepsSummaryCountsWithZeroDetail() throws {
        let env = try envelope("mission-fabric-envelope-viewer", role: "viewer")
        XCTAssertNil(env.portfolioCatalog)
        let mapped = try XCTUnwrap(try MappedPortfolioDecoder.decode(env))
        XCTAssertFalse(mapped.detailAvailable)
        XCTAssertTrue(mapped.projects.isEmpty)
        XCTAssertTrue(mapped.historicalProducts.isEmpty)
        XCTAssertTrue(mapped.classificationReviews.isEmpty)
        XCTAssertGreaterThan(mapped.summary.historicalProducts, mapped.historicalProducts.count)
        XCTAssertNil(mapped.sourceGeneratedAt)
        XCTAssertNil(mapped.joinReport)
        XCTAssertEqual(mapped.summary, env.portfolioCatalogSummary)
        XCTAssertGreaterThan(mapped.summary.total, 0)
        XCTAssertEqual(mapped.summary.actionAdmission, "none")
        XCTAssertEqual(mapped.asOf, env.projection.asOf)
        XCTAssertEqual(mapped.servedAt, env.delivery.servedAt)
    }

    func testNoSummaryReturnsNil() throws {
        let context = FabricDecodeContext(requested: ReaderScope(tenantId: "acme", role: "founder", principal: "p-1"), now: Self.now)
        guard case .success(let env) = MissionFabricDecoder.decode(json: try fixtureData("fabric-route-acme-founder"), context: context) else {
            return XCTFail("acme fixture must decode")
        }
        XCTAssertNil(env.portfolioCatalogSummary)
        XCTAssertNil(try MappedPortfolioDecoder.decode(env))
    }

    // MARK: - Malformed refusal

    func testMalformedRecordsAreRefusedNotDropped() throws {
        let cases: [(String, (inout [String: JSONValue]) -> Void)] = [
            ("missing name", { $0["name"] = nil }),
            ("bad classification", { $0["classification"] = .string("authority") }),
            ("bad kind", { $0["kind"] = .string("tenant") }),
            ("missing tenantIdentity", { $0["tenantIdentity"] = nil }),
            ("bad tenant status", { $0["tenantIdentity"] = .object(["status": .string("verified")]) }),
            ("non-string lifecycle", { $0["lifecycle"] = .number(3) }),
            ("unknown lifecycle", { $0["lifecycle"] = .string("admitted") }),
            ("unknown promotionState", { $0["promotionState"] = .string("runtime-bound") }),
            ("provenance not array", { $0["provenance"] = .string("repo:x") }),
            ("alias with tenant authority", { $0["aliases"] = .array([.object(["value": .string("x"), "namespace": .string("n"), "tenantAuthority": .bool(true)])]) }),
            ("oversize name", { $0["name"] = .string(String(repeating: "x", count: MissionFabricCaps.maxDisplayChars + 1)) }),
        ]
        for (label, edit) in cases {
            let env = try mutatingRecord(at: 0, edit)
            XCTAssertThrowsError(try MappedPortfolioDecoder.decode(env), label)
        }
    }

    func testRecordCountMismatchAndDuplicatesAreRefused() throws {
        let truncated = try mutatingCatalog { catalog in
            guard case .array(var rows)? = catalog["records"] else { return }
            rows.removeLast()
            catalog["records"] = .array(rows)
        }
        XCTAssertThrowsError(try MappedPortfolioDecoder.decode(truncated))

        let duplicated = try mutatingCatalog { catalog in
            guard case .array(var rows)? = catalog["records"] else { return }
            rows[1] = rows[0]
            catalog["records"] = .array(rows)
        }
        XCTAssertThrowsError(try MappedPortfolioDecoder.decode(duplicated))

        let notAnObject = try mutatingCatalog { catalog in
            guard case .array(var rows)? = catalog["records"] else { return }
            rows[0] = .string("row")
            catalog["records"] = .array(rows)
        }
        XCTAssertThrowsError(try MappedPortfolioDecoder.decode(notAnObject))
    }

    func testMalformedHistoricalAndReviewRowsAreRefused() throws {
        let historicalCases: [(String, (inout [String: JSONValue]) -> Void)] = [
            ("missing name", { $0["name"] = nil }),
            ("unknown status", { $0["status"] = .string("admitted") }),
            ("bad canonical id", { $0["canonicalId"] = .string("branch:historical") }),
            ("missing provenance", { $0["provenance"] = .array([]) }),
            ("non-string link", { $0["linkedCanonicalId"] = .number(1) }),
        ]
        for (label, edit) in historicalCases {
            let env = try mutatingCatalog { catalog in
                guard case .array(var rows)? = catalog["historicalProducts"], case .object(var row) = rows[0] else { return }
                edit(&row)
                rows[0] = .object(row)
                catalog["historicalProducts"] = .array(rows)
            }
            XCTAssertThrowsError(try MappedPortfolioDecoder.decode(env), "historical \(label)")
        }

        let countDrift = try mutatingCatalog { catalog in
            guard case .array(var rows)? = catalog["historicalProducts"] else { return }
            rows.removeLast()
            catalog["historicalProducts"] = .array(rows)
        }
        XCTAssertThrowsError(try MappedPortfolioDecoder.decode(countDrift))

        let review = try mutatingCatalog { catalog in
            catalog["classificationReview"] = .array([
                .object([
                    "canonicalId": .string("review:unclassified"),
                    "source": .string("Needs classification"),
                    "needed": .string("canonical product or client note"),
                ]),
            ])
        }
        XCTAssertThrowsError(try MappedPortfolioDecoder.decode(review), "review count must match the served summary")

        var accepted = review
        accepted.portfolioCatalogSummary?.classificationReview = 1
        let mapped = try XCTUnwrap(try MappedPortfolioDecoder.decode(accepted))
        XCTAssertEqual(mapped.classificationReviews.map(\.id), ["review:unclassified"])
        XCTAssertEqual(mapped.classificationReviews.first?.source, "Needs classification")
        XCTAssertEqual(mapped.classificationReviews.first?.needed, "canonical product or client note")
        XCTAssertNil(mapped.project(workId: "review:unclassified"))

        let malformedReview = try mutatingCatalog { catalog in
            catalog["classificationReview"] = .array([.object(["canonicalId": .string("review:unclassified")])])
        }
        var drifted = malformedReview
        drifted.portfolioCatalogSummary?.classificationReview = 1
        XCTAssertThrowsError(try MappedPortfolioDecoder.decode(drifted), "review missing source and needed")
    }

    func testCatalogWithoutNoneAdmissionIsRefused() throws {
        let env = try mutatingCatalog { catalog in
            catalog["actionAuthority"] = .object(["admission": .string("granted")])
        }
        XCTAssertThrowsError(try MappedPortfolioDecoder.decode(env))
    }

    func testMalformedSourceGeneratedAtIsRefused() throws {
        let malformed = try mutatingCatalog { $0["sourceGeneratedAt"] = .string("not-a-source-date") }
        XCTAssertThrowsError(try MappedPortfolioDecoder.decode(malformed))
        let oversized = try mutatingCatalog { $0["sourceGeneratedAt"] = .string("2026-07-29T06:46:00Z" + String(repeating: "x", count: 65)) }
        XCTAssertThrowsError(try MappedPortfolioDecoder.decode(oversized))
    }

    func testMalformedErrorDoesNotEchoSourceContents() throws {
        let secret = "SECRET-PROVENANCE-VALUE"
        let env = try mutatingRecord(at: 0) { $0["provenance"] = .array([.number(1), .string(secret)]) }
        do {
            _ = try MappedPortfolioDecoder.decode(env)
            XCTFail("expected refusal")
        } catch {
            XCTAssertFalse(String(describing: error).contains(secret))
        }
    }
}
