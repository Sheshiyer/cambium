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
}
