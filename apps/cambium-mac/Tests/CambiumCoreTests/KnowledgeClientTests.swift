import XCTest
@testable import CambiumCore

final class KnowledgeClientTests: XCTestCase {
    private let now = CanonicalTimestamp.parse("2026-11-02T00:10:00.000Z")!
    private let context = AuthenticatedReaderContext(
        principal: "founder-1", tenantId: "cambium", role: "founder",
        expiresAt: CanonicalTimestamp.parse("2026-11-02T01:00:00.000Z")!
    )

    private func row(
        id: String = "r-1", source: String = "field-theory", schema: String = "cambium.native-field-theory-reference.v1",
        subject: String = "sapling:cambium", tenant: String = "cambium", principal: String = "founder-1",
        ref: String = "https://example.invalid/ref", observedAt: String = "2026-11-02T00:00:00.000Z",
        freshness: String = "fresh", meaning: String = "observation", extra: String = ""
    ) -> String {
        """
        {"id":"\(id)","source":"\(source)","schema":"\(schema)","subjectId":"\(subject)","tenantId":"\(tenant)",
        "principal":"\(principal)","sourceRef":"\(ref)","observedAt":"\(observedAt)","freshness":"\(freshness)",
        "gaps":["no-live-bridge"],"meaning":"\(meaning)"\(extra)}
        """
    }

    private func export(_ rows: String...) -> Data { Data(#"{"records":[\#(rows.joined(separator: ","))]}"#.utf8) }

    private func reportRow(id: String = "r-1", ref: String = "https://example.invalid/ref") -> String {
        row(id: id, source: "field-report", schema: "cambium.native-field-report-reference.v1", ref: ref)
    }

    private func theoryError(_ data: Data, options: KnowledgeReadOptions = KnowledgeReadOptions()) -> KnowledgeError? {
        do { _ = try KnowledgeDecoder.decodeFieldTheory(exportJSON: data, context: context, now: now, options: options); return nil }
        catch { return error as? KnowledgeError }
    }

    // MARK: Happy path and typed meaning

    func testDecodesCitedScopedRecordsForEachSource() throws {
        let theory = try KnowledgeDecoder.decodeFieldTheory(exportJSON: export(row(meaning: "proposal")), context: context, now: now)
        XCTAssertEqual(theory.count, 1)
        XCTAssertEqual(theory[0].source, .fieldTheory)
        XCTAssertEqual(theory[0].schema, "cambium.native-field-theory-reference.v1")
        XCTAssertEqual(theory[0].meaning, .proposal)
        XCTAssertEqual(theory[0].tenantId, "cambium")
        XCTAssertEqual(theory[0].principal, "founder-1")
        XCTAssertEqual(theory[0].sourceRef, "https://example.invalid/ref")
        XCTAssertEqual(theory[0].observedAt, "2026-11-02T00:00:00.000Z")
        XCTAssertEqual(theory[0].freshness, .fresh)
        XCTAssertEqual(theory[0].gaps, ["no-live-bridge"])

        let report = try KnowledgeDecoder.decodeFieldReport(exportJSON: export(reportRow()), context: context, now: now)
        XCTAssertEqual(report[0].source, .fieldReport)
        XCTAssertEqual(report[0].schema, "cambium.native-field-report-reference.v1")
        XCTAssertEqual(report[0].meaning, .observation)
    }

    func testFieldReportAcceptsOnlyItsOwnSchemas() throws {
        XCTAssertThrowsError(try KnowledgeDecoder.decodeFieldReport(
            exportJSON: export(row(source: "field-report", schema: "cambium.native-field-theory-reference.v1")), context: context, now: now
        )) { XCTAssertEqual($0 as? KnowledgeError, .schemaMismatch) }
    }

    // MARK: Source and schema separation

    func testFieldTheoryIsNotFieldReport() throws {
        XCTAssertEqual(theoryError(export(reportRow())), .sourceMismatch)
        XCTAssertThrowsError(try KnowledgeDecoder.decodeFieldReport(exportJSON: export(row()), context: context, now: now)) {
            XCTAssertEqual($0 as? KnowledgeError, .sourceMismatch)
        }
        XCTAssertEqual(theoryError(export(row(schema: "cambium.native-field-report-reference.v1"))), .schemaMismatch)
        XCTAssertEqual(theoryError(export(row(source: "wrong-source"))), .sourceMismatch)
    }

    // MARK: Scope

    func testForeignTenantPrincipalAndSubjectAreRejected() {
        XCTAssertEqual(theoryError(export(row(tenant: "other"))), .scopeMismatch("tenant"))
        XCTAssertEqual(theoryError(export(row(principal: "founder-2"))), .scopeMismatch("principal"))
        let scoped = KnowledgeReadOptions(allowedSubjectIds: ["sapling:cambium"])
        XCTAssertNil(theoryError(export(row()), options: scoped))
        XCTAssertEqual(theoryError(export(row(subject: "sapling:other")), options: scoped), .scopeMismatch("subject"))
        // One foreign row poisons the whole export; nothing partial is returned.
        XCTAssertEqual(theoryError(export(row(id: "a"), row(id: "b", tenant: "other"))), .scopeMismatch("tenant"))
    }

    // MARK: Time

    func testStaleAndFutureObservationsAreRejected() {
        XCTAssertEqual(theoryError(export(row(observedAt: "2026-11-02T01:00:00.000Z"))), .staleTime("future"))
        XCTAssertEqual(theoryError(export(row(observedAt: "2026-08-01T00:00:00.000Z"))), .staleTime("too old"))
        XCTAssertNil(theoryError(export(row(observedAt: "2026-11-02T00:11:00.000Z"))), "within clock skew")
        XCTAssertEqual(theoryError(export(row(observedAt: "yesterday"))), .malformed("observedAt"))
        XCTAssertEqual(theoryError(export(row(observedAt: "2026-11-02T00:00:00+02:00"))), .malformed("observedAt"))
        let tight = KnowledgeReadOptions(maxAge: 60)
        XCTAssertEqual(theoryError(export(row()), options: tight), .staleTime("too old"))
    }

    // MARK: Identity, references, shape

    func testDuplicateIdsAreRejected() {
        XCTAssertEqual(theoryError(export(row(id: "dup"), row(id: "dup", subject: "sapling:b"))), .duplicateRecord)
    }

    func testUnsafeReferenceSchemesAreRejected() {
        let bad = [
            "javascript:alert(1)", "file:///etc/passwd", "data:text/html,x", "ftp://example.invalid/x", "ssh://host/x",
            "/relative/path", "no-scheme", "https://user:pw@example.invalid/x", "https://", "vault:", "vault:../../etc/passwd",
            "thoughtseed://x", "vault://x"
        ]
        for ref in bad {
            guard let error = theoryError(export(row(ref: ref))) else {
                XCTFail("ref \(ref) was accepted")
                continue
            }
            guard case .unsafeReference = error else {
                XCTFail("ref \(ref) threw unexpected error \(error)")
                continue
            }
        }
        for ref in ["https://example.invalid/a", "http://example.invalid/a", "thoughtseed:sapling:cambium", "vault:notes/a.md", "git:repo@abc123"] {
            XCTAssertNil(theoryError(export(row(ref: ref))), ref)
        }
    }

    func testMalformedRecordsAreRejected() {
        XCTAssertEqual(theoryError(Data("not json".utf8)), .malformed("json"))
        XCTAssertEqual(theoryError(Data("[]".utf8)), .malformed("object with only a records array required"))
        XCTAssertEqual(theoryError(Data(#"{"records":{}}"#.utf8)), .malformed("object with only a records array required"))
        XCTAssertEqual(theoryError(Data(#"{"records":[],"extra":1}"#.utf8)), .malformed("object with only a records array required"))
        XCTAssertEqual(theoryError(Data(#"{"records":["x"]}"#.utf8)), .malformed("record"))
        XCTAssertEqual(theoryError(export(row(extra: #","admit":true"#))), .malformed("unknown record field"))
        XCTAssertEqual(theoryError(export(row(id: ""))), .malformed("id"))
        XCTAssertEqual(theoryError(export(row(id: "a\\nb"))), .malformed("id"))
        XCTAssertEqual(theoryError(export(row(freshness: "recent"))), .malformed("freshness"))
        XCTAssertEqual(theoryError(export(row(meaning: "decision"))), .malformed("meaning"))
        XCTAssertEqual(theoryError(Data(#"{"records":[{"id":"a"}]}"#.utf8)), .malformed("source"))
        let badGaps = Data(#"{"records":[{"id":"a","source":"field-theory","schema":"cambium.native-field-theory-reference.v1","subjectId":"s","tenantId":"cambium","principal":"founder-1","sourceRef":"https://example.invalid/x","observedAt":"2026-11-02T00:00:00.000Z","freshness":"fresh","gaps":"x","meaning":"observation"}]}"#.utf8)
        XCTAssertEqual(theoryError(badGaps), .malformed("gaps"))
    }

    func testByteAndItemBounds() {
        XCTAssertEqual(theoryError(export(row()), options: KnowledgeReadOptions(maxBytes: 10)), .capExceeded("bytes"))
        let many = (0..<5).map { row(id: "r-\($0)") }.joined(separator: ",")
        XCTAssertEqual(theoryError(Data(#"{"records":[\#(many)]}"#.utf8), options: KnowledgeReadOptions(maxItems: 4)), .capExceeded("items"))
        XCTAssertNil(theoryError(Data(#"{"records":[\#(many)]}"#.utf8), options: KnowledgeReadOptions(maxItems: 5)))
    }

    // MARK: Unavailable bridges and supplied readers

    func testUnconfiguredBridgesRefuse() {
        XCTAssertThrowsError(try UnconfiguredFieldTheoryReader().readFieldTheory(exportJSON: export(row()), context: context, now: now, options: KnowledgeReadOptions())) {
            XCTAssertEqual($0 as? KnowledgeError, .bridgeUnconfigured)
        }
        XCTAssertThrowsError(try UnconfiguredFieldReportReader().readFieldReport(exportJSON: export(reportRow()), context: context, now: now, options: KnowledgeReadOptions())) {
            XCTAssertEqual($0 as? KnowledgeError, .bridgeUnconfigured)
        }
    }

    func testSuppliedReadersDecodeWithoutIO() throws {
        let records = try SuppliedFieldTheoryReader().readFieldTheory(exportJSON: export(row()), context: context, now: now, options: KnowledgeReadOptions())
        XCTAssertEqual(records.map(\.id), ["r-1"])
    }

    func testContextDerivesOnlyFromVerifiedSession() throws {
        let ok = try AuthenticatedReaderContext.derive(from: ReaderFixtures.session("founder-9", from: now), tenantId: "cambium", at: now)
        XCTAssertEqual(ok.principal, "founder-9")
        XCTAssertThrowsError(try AuthenticatedReaderContext.derive(from: .unconfigured, tenantId: "cambium", at: now))
        XCTAssertThrowsError(try AuthenticatedReaderContext.derive(from: ReaderFixtures.session(tenant: "x", from: now), tenantId: "cambium", at: now))
        XCTAssertThrowsError(try AuthenticatedReaderContext.derive(from: ReaderFixtures.session(ttl: -1, from: now), tenantId: "cambium", at: now))
    }

    // MARK: Memory store: separate labels and invalidation

    func testStoreKeepsSourcesSeparateAndHonoursInvalidation() async throws {
        let session = ReaderSession(ReaderFixtures.session("founder-1", from: now))
        let store = KnowledgeSnapshotStore(sessionProvider: session, clock: ReaderClock(now))
        let current = ReaderFixtures.session("founder-1", from: now)

        _ = try await store.loadFieldTheory(exportJSON: export(row()), tenantId: "cambium", reader: SuppliedFieldTheoryReader())
        _ = try await store.loadFieldReport(exportJSON: export(reportRow(id: "fr-1")), tenantId: "cambium", reader: SuppliedFieldReportReader())

        let theory = await store.fieldTheoryRecords(for: current)
        let report = await store.fieldReportRecords(for: current)
        XCTAssertEqual(theory?.map(\.id), ["r-1"])
        XCTAssertEqual(theory?.map(\.source), [.fieldTheory])
        XCTAssertEqual(report?.map(\.id), ["fr-1"])
        XCTAssertEqual(report?.map(\.source), [.fieldReport])

        // A different principal sees nothing, and the mismatch purges both slots.
        let foreign = await store.fieldTheoryRecords(for: ReaderFixtures.session("founder-2", from: now))
        XCTAssertNil(foreign)
        let purgedTheory = await store.fieldTheoryRecords(for: current)
        let purgedReport = await store.fieldReportRecords(for: current)
        XCTAssertNil(purgedTheory)
        XCTAssertNil(purgedReport)
    }

    func testPublicDecoderRejectsExpiredContext() {
        let expired = AuthenticatedReaderContext(principal: "founder-1", tenantId: "cambium", role: "founder",
                                                 expiresAt: now.addingTimeInterval(-1))
        XCTAssertThrowsError(try KnowledgeDecoder.decodeFieldTheory(exportJSON: export(row()), context: expired, now: now)) {
            XCTAssertEqual($0 as? KnowledgeError, .expiredContext)
        }
        XCTAssertThrowsError(try KnowledgeDecoder.decodeFieldReport(exportJSON: export(reportRow()), context: expired, now: now)) {
            XCTAssertEqual($0 as? KnowledgeError, .expiredContext)
        }
    }

    func testReferenceErrorsDoNotEchoSecrets() {
        let error = theoryError(export(row(ref: "https://user:hunter2@example.invalid/x")))
        XCTAssertEqual(error, .unsafeReference("credentials"))
        XCTAssertFalse(String(describing: error).contains("hunter2"))
    }

    func testStoreCacheExpiresAfterTTLAndOriginalContextExpiry() async throws {
        let one = ReaderFixtures.session("founder-1", ttl: 120, from: now)
        let clock = ReaderClock(now)
        let session = ReaderSession(one)
        let store = KnowledgeSnapshotStore(sessionProvider: session, clock: clock, cacheTTL: 300)
        _ = try await store.loadFieldTheory(exportJSON: export(row()), tenantId: "cambium", reader: SuppliedFieldTheoryReader())

        // A renewed same-principal session does not extend the context minted at +120s.
        let renewed = ReaderFixtures.session("founder-1", ttl: 3600, from: now.addingTimeInterval(100))
        session.set(renewed)
        clock.set(now.addingTimeInterval(121))
        let held = await store.fieldTheoryRecords(for: renewed)
        XCTAssertNil(held)
    }

    func testStoreCacheMissesAfterDefaultSixtySecondTTL() async throws {
        let one = ReaderFixtures.session("founder-1", ttl: 3600, from: now)
        let clock = ReaderClock(now)
        let store = KnowledgeSnapshotStore(sessionProvider: ReaderSession(one), clock: clock)
        _ = try await store.loadFieldReport(exportJSON: export(reportRow()), tenantId: "cambium", reader: SuppliedFieldReportReader())
        let warm = await store.fieldReportRecords(for: one)
        XCTAssertNotNil(warm)
        clock.set(now.addingTimeInterval(61))
        let cold = await store.fieldReportRecords(for: one)
        XCTAssertNil(cold)
    }

    func testStoreRefusesWithoutVerifiedSession() async {
        let store = KnowledgeSnapshotStore(sessionProvider: ReaderSession(.unconfigured), clock: ReaderClock(now))
        let error = await readerError { try await store.loadFieldTheory(exportJSON: self.export(self.row()), tenantId: "cambium", reader: SuppliedFieldTheoryReader()) }
        XCTAssertEqual(error as? KnowledgeError, .scopeMismatch("session"))
    }

    /// Session provider that runs a hook on its second call, which is the
    /// post-decode confirmation inside the store (the first call derives the context).
    private final class HookSession: SessionProvider, @unchecked Sendable {
        private let calls = ReaderLock(0)
        private let first: NativeSession
        private let later: NativeSession
        private let hook: @Sendable () async -> Void
        init(first: NativeSession, later: NativeSession, hook: @escaping @Sendable () async -> Void = {}) {
            self.first = first; self.later = later; self.hook = hook
        }
        func currentSession() async -> NativeSession {
            var n = 0
            calls.mutate { $0 += 1; n = $0 }
            if n == 1 { return first }
            await hook()
            return later
        }
    }

    func testLoadCannotPublishAfterPrincipalSwitch() async throws {
        let one = ReaderFixtures.session("founder-1", from: now)
        let two = ReaderFixtures.session("founder-2", from: now)
        let store = KnowledgeSnapshotStore(sessionProvider: HookSession(first: one, later: two), clock: ReaderClock(now))

        let error = await readerError { try await store.loadFieldTheory(exportJSON: self.export(self.row()), tenantId: "cambium", reader: SuppliedFieldTheoryReader()) }

        XCTAssertEqual(error as? KnowledgeError, .principalSwitched)
        let held = await store.fieldTheoryRecords(for: one)
        XCTAssertNil(held)
    }

    func testLoadPendingAcrossInvalidateCannotPublish() async throws {
        let one = ReaderFixtures.session("founder-1", from: now)
        // The hook fires while the store awaits the session: invalidate re-enters the actor.
        let holder = ReaderLock<KnowledgeSnapshotStore?>(nil)
        let session = HookSession(first: one, later: one) { await holder.get()?.invalidate() }
        let store = KnowledgeSnapshotStore(sessionProvider: session, clock: ReaderClock(now))
        holder.set(store)

        let error = await readerError { try await store.loadFieldReport(exportJSON: self.export(self.reportRow()), tenantId: "cambium", reader: SuppliedFieldReportReader()) }

        XCTAssertEqual(error as? KnowledgeError, .principalSwitched)
        let held = await store.fieldReportRecords(for: one)
        XCTAssertNil(held)
    }

    func testExplicitInvalidateDropsStoredRecords() async throws {
        let one = ReaderFixtures.session("founder-1", from: now)
        let store = KnowledgeSnapshotStore(sessionProvider: ReaderSession(one), clock: ReaderClock(now))
        _ = try await store.loadFieldTheory(exportJSON: export(row()), tenantId: "cambium", reader: SuppliedFieldTheoryReader())
        let before = await store.fieldTheoryRecords(for: one)
        XCTAssertNotNil(before)
        await store.invalidate()
        let after = await store.fieldTheoryRecords(for: one)
        XCTAssertNil(after)
    }
}
