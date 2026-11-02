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
