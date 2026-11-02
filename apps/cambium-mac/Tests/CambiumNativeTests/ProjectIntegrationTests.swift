import XCTest
@testable import CambiumCore
@testable import CambiumNative

@MainActor
final class ProjectIntegrationTests: XCTestCase {
    private func loadedDemo() async throws -> AppModel {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("cambium-project-test-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let services = try XCTUnwrap(CambiumOwnerServices.demo(directory: directory))
        let model = AppModel(mode: .demo, services: services)
        for _ in 0..<250 {
            if model.fabric?.portfolio?.detailAvailable == true && !model.loading { return model }
            try await Task.sleep(for: .milliseconds(20))
        }
        XCTFail("demo Mission Fabric did not load its mapped projects")
        return model
    }

    func testFounderCatalogProjectsAppearInSearchAndSelectTheirDossier() async throws {
        let model = try await loadedDemo()
        let portfolio = try XCTUnwrap(model.fabric?.portfolio)
        XCTAssertEqual(portfolio.projects.count, portfolio.summary.total)
        XCTAssertEqual(portfolio.summary.actionAdmission, "none")
        XCTAssertNotEqual(portfolio.summary.catalogDigest, portfolio.summary.actionCatalogDigest)

        model.query = "Fitcheck"
        let hit = try XCTUnwrap(model.searchHits.first { $0.id == "project-sapling:fitcheck" })
        XCTAssertEqual(hit.section, .projects)
        hit.apply()
        XCTAssertEqual(model.section, .projects)
        XCTAssertEqual(model.selectedProject?.canonicalId, "sapling:fitcheck")
        XCTAssertNil(model.selectedProjectWork)
    }

    func testOnlyServedJoinCanOpenOperationalWork() async throws {
        let model = try await loadedDemo()
        let before = model.selectedWorkID
        model.openOperationalWork(for: "branch:relovo")
        XCTAssertEqual(model.selectedWorkID, before)
        XCTAssertNotNil(model.feedback)

        model.selectProject("sapling:cambium")
        let project = try XCTUnwrap(model.selectedProject)
        XCTAssertEqual(project.runtimeWorkId, "sapling:cambium")
        XCTAssertEqual(model.joinedWork(for: project)?.id, "sapling:cambium")
        model.openOperationalWork(for: project.id)
        XCTAssertEqual(model.section, .work)
        XCTAssertEqual(model.selectedWorkID, "sapling:cambium")
    }

    func testHistoricalSourceIsSearchableAndCannotOpenWork() async throws {
        let model = try await loadedDemo()
        let portfolio = try XCTUnwrap(model.fabric?.portfolio)
        XCTAssertEqual(portfolio.historicalProducts.count, portfolio.summary.historicalProducts)

        model.query = "Axtech Product View"
        let hit = try XCTUnwrap(model.searchHits.first { $0.id == "historical-historical-product:axtech" })
        XCTAssertEqual(hit.section, .projects)
        hit.apply()
        XCTAssertEqual(model.selectedHistoricalProduct?.canonicalId, "historical-product:axtech")
        XCTAssertEqual(model.selectedHistoricalProduct?.linkedCanonicalId, "branch:axtech")
        XCTAssertNil(model.selectedProject)

        let before = model.selectedWorkID
        model.openOperationalWork(for: "historical-product:axtech")
        XCTAssertEqual(model.selectedWorkID, before)
        XCTAssertEqual(model.section, .projects)

        model.selectProject("branch:axtech")
        XCTAssertEqual(model.selectedProject?.canonicalId, "branch:axtech")
        XCTAssertNil(model.selectedHistoricalProduct)
        XCTAssertEqual(model.selectedWorkID, before)
    }

    func testCatalogSourceTimeRendersWholeSecondPrecision() async throws {
        let model = try await loadedDemo()
        let generated = try XCTUnwrap(model.fabric?.portfolio?.sourceGeneratedAt)
        XCTAssertEqual(generated, "2026-07-29T06:46:00Z")
        XCTAssertEqual(SourceTime.display(generated, utc: true), "29 Jul 2026, 06:46 UTC")
        XCTAssertEqual(SourceTime.display("2026-02-30T06:46:00Z", utc: true), "Unreadable time")
    }
}
