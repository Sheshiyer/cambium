import XCTest
@testable import CambiumCore
@testable import CambiumNative

@MainActor
private final class CancelingEntryBrowser: NativeBrowserPresenting {
    var calls = 0
    var events: [String] = []
    func present(_ request: NativeAuthorizationRequest) async -> NativeBrowserResult {
        calls += 1
        events.append("present")
        return .canceled
    }
    func cancel() { events.append("cancel") }
}

@MainActor
final class SignInEntryTests: XCTestCase {
    func testMainEntryValidatesProfileBeforeOpeningBrowser() async throws {
        let browser = CancelingEntryBrowser()
        let model = AppModel(mode: .standard, browser: browser)
        model.ownerURLDraft = "http://invalid-owner.test"
        model.beginSignIn()
        await Task.yield()
        XCTAssertEqual(model.section, .connections)
        XCTAssertNil(model.configuration)
        XCTAssertNotNil(model.configurationProblem)
        XCTAssertEqual(browser.calls, 0)
    }

    func testMainEntryUsesReviewedProfileAndCancelLeavesSignedOut() async throws {
        let browser = CancelingEntryBrowser()
        let model = AppModel(mode: .standard, browser: browser)
        model.beginSignIn()
        for _ in 0..<100 {
            if browser.calls == 1 && !model.loading { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertEqual(model.section, .connections)
        XCTAssertEqual(model.configuration?.ownerURL.absoluteString, OwnerConfiguration.mappedOwnerURL)
        XCTAssertEqual(browser.calls, 1)
        XCTAssertEqual(browser.events.last, "present", "An old owner must not cancel the new browser presentation")
        XCTAssertNil(model.session)
        XCTAssertFalse(model.loading)
    }

    func testDemoEntryDoesNotContactAnOwner() async {
        let browser = CancelingEntryBrowser()
        let model = AppModel(mode: .demo, browser: browser)
        model.beginSignIn()
        await Task.yield()
        XCTAssertTrue(model.isDemo)
        XCTAssertNil(model.configuration)
        XCTAssertEqual(browser.calls, 0)
    }

    func testSignInAsAnotherFounderClearsScopedInboxState() async throws {
        let model = AppModel(mode: .demo)
        for _ in 0..<100 {
            if model.session != nil { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        let first = try XCTUnwrap(model.session)
        model.inboxDraft.body = "unsaved observation"
        model.inboxDraft.hasStarted = true
        let scope = model.signalScopeVersion

        model.acceptSignedIn(first)
        XCTAssertEqual(model.inboxDraft.body, "unsaved observation", "Re-signing as the same founder keeps the draft")
        XCTAssertEqual(model.signalScopeVersion, scope)

        var other = first
        other.founderId = first.founderId + "-other"
        model.acceptSignedIn(other)
        XCTAssertEqual(model.session, other)
        XCTAssertEqual(model.inboxDraft.body, "")
        XCTAssertFalse(model.inboxDraft.hasStarted)
        XCTAssertNotEqual(model.signalScopeVersion, scope)
    }

    func testExpiredSessionIsNotPresentedAsCurrent() async throws {
        let model = AppModel(mode: .demo)
        for _ in 0..<100 {
            if model.session != nil { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        let expiry = try XCTUnwrap(model.session.flatMap { CanonicalTimestamp.parse($0.expiresAt) })
        XCTAssertTrue(model.hasCurrentSession(at: expiry.addingTimeInterval(-1)))
        XCTAssertFalse(model.hasCurrentSession(at: expiry))
        XCTAssertFalse(model.hasCurrentSession(at: expiry.addingTimeInterval(1)))
    }
}
