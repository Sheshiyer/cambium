import Foundation

// Read-only Field Theory and Field Report seams. They decode explicitly supplied
// export JSON only. No filesystem or vault reads, no CLI, no scripts, no memory
// writes, and nothing here promotes a note or proposal into admission.
// The schemas below are Cambium's own native transfer format. They are not an
// external Field Theory or Field Report wire schema. See KNOWLEDGE-ADAPTER-CONTRACT.md.
// Field Theory and Field Report are different sources and never share a label.

public enum KnowledgeSource: String, Codable, Sendable, Equatable {
    case fieldTheory = "field-theory"
    case fieldReport = "field-report"

    public var schema: String {
        switch self {
        case .fieldTheory: return "cambium.native-field-theory-reference.v1"
        case .fieldReport: return "cambium.native-field-report-reference.v1"
        }
    }
}

/// `proposal` is model- or human-suggested direction. `observation` is a
/// recorded fact. Neither is an admission.
public enum KnowledgeMeaning: String, Codable, Sendable, Equatable {
    case proposal
    case observation
}

public enum KnowledgeFreshness: String, Codable, Sendable, Equatable {
    case fresh
    case stale
    case unknown
}

public struct FieldTheoryRecord: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let source: KnowledgeSource
    public let schema: String
    public let subjectId: String
    public let tenantId: String
    public let principal: String
    public let sourceRef: String
    public let observedAt: String
    public let freshness: KnowledgeFreshness
    public let gaps: [String]
    public let meaning: KnowledgeMeaning

    public init(id: String, subjectId: String, tenantId: String, principal: String, sourceRef: String,
                observedAt: String, freshness: KnowledgeFreshness, gaps: [String], meaning: KnowledgeMeaning) {
        self.id = id
        self.source = .fieldTheory
        self.schema = KnowledgeSource.fieldTheory.schema
        self.subjectId = subjectId
        self.tenantId = tenantId
        self.principal = principal
        self.sourceRef = sourceRef
        self.observedAt = observedAt
        self.freshness = freshness
        self.gaps = gaps
        self.meaning = meaning
    }
}

public struct FieldReportRecord: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let source: KnowledgeSource
    public let schema: String
    public let subjectId: String
    public let tenantId: String
    public let principal: String
    public let sourceRef: String
    public let observedAt: String
    public let freshness: KnowledgeFreshness
    public let gaps: [String]
    public let meaning: KnowledgeMeaning

    public init(id: String, subjectId: String, tenantId: String, principal: String, sourceRef: String,
                observedAt: String, freshness: KnowledgeFreshness, gaps: [String], meaning: KnowledgeMeaning) {
        self.id = id
        self.source = .fieldReport
        self.schema = KnowledgeSource.fieldReport.schema
        self.subjectId = subjectId
        self.tenantId = tenantId
        self.principal = principal
        self.sourceRef = sourceRef
        self.observedAt = observedAt
        self.freshness = freshness
        self.gaps = gaps
        self.meaning = meaning
    }
}

/// Payloads are fixed categories. They never echo export text, so a bad
/// `sourceRef` or header-like value cannot leak into errors or logs.
public enum KnowledgeError: Error, Equatable, Sendable {
    case bridgeUnconfigured
    case capExceeded(String)
    case malformed(String)
    case schemaMismatch
    case sourceMismatch
    case scopeMismatch(String)
    case unsafeReference(String)
    case staleTime(String)
    case duplicateRecord
    case expiredContext
    case principalSwitched
}

/// Limits and optional subject scope for one decode.
public struct KnowledgeReadOptions: Sendable, Equatable {
    public var maxBytes: Int
    public var maxItems: Int
    public var maxAge: TimeInterval
    public var clockSkew: TimeInterval
    /// When set, records for any other subject are rejected.
    public var allowedSubjectIds: Set<String>?

    public init(maxBytes: Int = 2_000_000, maxItems: Int = 256, maxAge: TimeInterval = 30 * 24 * 60 * 60,
                clockSkew: TimeInterval = 120, allowedSubjectIds: Set<String>? = nil) {
        self.maxBytes = maxBytes
        self.maxItems = maxItems
        self.maxAge = maxAge
        self.clockSkew = clockSkew
        self.allowedSubjectIds = allowedSubjectIds
    }
}

public protocol FieldTheoryReading: Sendable {
    func readFieldTheory(exportJSON: Data, context: AuthenticatedReaderContext, now: Date, options: KnowledgeReadOptions) throws -> [FieldTheoryRecord]
}

public protocol FieldReportReading: Sendable {
    func readFieldReport(exportJSON: Data, context: AuthenticatedReaderContext, now: Date, options: KnowledgeReadOptions) throws -> [FieldReportRecord]
}

/// Live bridges are not configured. These readers always refuse.
public struct UnconfiguredFieldTheoryReader: FieldTheoryReading {
    public init() {}
    public func readFieldTheory(exportJSON: Data, context: AuthenticatedReaderContext, now: Date, options: KnowledgeReadOptions) throws -> [FieldTheoryRecord] {
        throw KnowledgeError.bridgeUnconfigured
    }
}

public struct UnconfiguredFieldReportReader: FieldReportReading {
    public init() {}
    public func readFieldReport(exportJSON: Data, context: AuthenticatedReaderContext, now: Date, options: KnowledgeReadOptions) throws -> [FieldReportRecord] {
        throw KnowledgeError.bridgeUnconfigured
    }
}

/// Decodes caller-supplied export JSON. No I/O.
public struct SuppliedFieldTheoryReader: FieldTheoryReading {
    public init() {}
    public func readFieldTheory(exportJSON: Data, context: AuthenticatedReaderContext, now: Date, options: KnowledgeReadOptions = KnowledgeReadOptions()) throws -> [FieldTheoryRecord] {
        try KnowledgeDecoder.decodeFieldTheory(exportJSON: exportJSON, context: context, now: now, options: options)
    }
}

public struct SuppliedFieldReportReader: FieldReportReading {
    public init() {}
    public func readFieldReport(exportJSON: Data, context: AuthenticatedReaderContext, now: Date, options: KnowledgeReadOptions = KnowledgeReadOptions()) throws -> [FieldReportRecord] {
        try KnowledgeDecoder.decodeFieldReport(exportJSON: exportJSON, context: context, now: now, options: options)
    }
}

public enum KnowledgeDecoder {
    private static let recordKeys: Set<String> = [
        "id", "source", "schema", "subjectId", "tenantId", "principal",
        "sourceRef", "observedAt", "freshness", "gaps", "meaning"
    ]
    private static let maxFieldChars = 512
    private static let maxGaps = 32

    public static func decodeFieldTheory(exportJSON: Data, context: AuthenticatedReaderContext, now: Date,
                                         options: KnowledgeReadOptions = KnowledgeReadOptions()) throws -> [FieldTheoryRecord] {
        try requireUnexpired(context, now)
        return try decode(.fieldTheory, exportJSON, context, now, options).map {
            FieldTheoryRecord(id: $0.id, subjectId: $0.subjectId, tenantId: $0.tenantId, principal: $0.principal,
                              sourceRef: $0.sourceRef, observedAt: $0.observedAt, freshness: $0.freshness,
                              gaps: $0.gaps, meaning: $0.meaning)
        }
    }

    public static func decodeFieldReport(exportJSON: Data, context: AuthenticatedReaderContext, now: Date,
                                         options: KnowledgeReadOptions = KnowledgeReadOptions()) throws -> [FieldReportRecord] {
        try requireUnexpired(context, now)
        return try decode(.fieldReport, exportJSON, context, now, options).map {
            FieldReportRecord(id: $0.id, subjectId: $0.subjectId, tenantId: $0.tenantId, principal: $0.principal,
                              sourceRef: $0.sourceRef, observedAt: $0.observedAt, freshness: $0.freshness,
                              gaps: $0.gaps, meaning: $0.meaning)
        }
    }

    private static func requireUnexpired(_ context: AuthenticatedReaderContext, _ now: Date) throws {
        guard context.expiresAt > now else { throw KnowledgeError.expiredContext }
    }

    private struct Row {
        let id, subjectId, tenantId, principal, sourceRef, observedAt: String
        let freshness: KnowledgeFreshness
        let gaps: [String]
        let meaning: KnowledgeMeaning
    }

    private static func decode(_ expected: KnowledgeSource, _ data: Data, _ context: AuthenticatedReaderContext,
                               _ now: Date, _ options: KnowledgeReadOptions) throws -> [Row] {
        guard data.count <= options.maxBytes else { throw KnowledgeError.capExceeded("bytes") }
        let root: JSONValue
        do { root = try JSONValue.parse(data) } catch { throw KnowledgeError.malformed("json") }
        guard case .object(let top) = root, case .array(let items)? = top["records"], top.keys.allSatisfy({ $0 == "records" }) else {
            throw KnowledgeError.malformed("object with only a records array required")
        }
        guard items.count <= options.maxItems else { throw KnowledgeError.capExceeded("items") }

        var seen = Set<String>()
        var rows: [Row] = []
        for item in items {
            guard case .object(let r) = item else { throw KnowledgeError.malformed("record") }
            guard Set(r.keys).isSubset(of: recordKeys) else { throw KnowledgeError.malformed("unknown record field") }

            let id = try string(r, "id")
            guard seen.insert(id).inserted else { throw KnowledgeError.duplicateRecord }

            let source = try string(r, "source")
            guard source == expected.rawValue else { throw KnowledgeError.sourceMismatch }
            let schema = try string(r, "schema")
            guard schema == expected.schema else { throw KnowledgeError.schemaMismatch }

            let tenantId = try string(r, "tenantId")
            guard tenantId == context.tenantId else { throw KnowledgeError.scopeMismatch("tenant") }
            let principal = try string(r, "principal")
            guard principal == context.principal else { throw KnowledgeError.scopeMismatch("principal") }
            let subjectId = try string(r, "subjectId")
            if let allowed = options.allowedSubjectIds, !allowed.contains(subjectId) {
                throw KnowledgeError.scopeMismatch("subject")
            }

            let sourceRef = try string(r, "sourceRef")
            try validateReference(sourceRef)
            let observedAt = try string(r, "observedAt")
            try validateTime(observedAt, now: now, options: options)

            guard let freshness = KnowledgeFreshness(rawValue: try string(r, "freshness")) else {
                throw KnowledgeError.malformed("freshness")
            }
            guard let meaning = KnowledgeMeaning(rawValue: try string(r, "meaning")) else {
                throw KnowledgeError.malformed("meaning")
            }
            rows.append(Row(id: id, subjectId: subjectId, tenantId: tenantId, principal: principal, sourceRef: sourceRef,
                            observedAt: observedAt, freshness: freshness, gaps: try strings(r, "gaps"), meaning: meaning))
        }
        return rows
    }

    private static func string(_ object: [String: JSONValue], _ key: String) throws -> String {
        guard case .string(let value)? = object[key], !value.isEmpty, value.count <= maxFieldChars,
              !value.unicodeScalars.contains(where: { $0.value < 0x20 || $0.value == 0x7f }) else {
            throw KnowledgeError.malformed(key)
        }
        return value
    }

    private static func strings(_ object: [String: JSONValue], _ key: String) throws -> [String] {
        guard let value = object[key] else { return [] }
        guard case .array(let items) = value, items.count <= maxGaps else { throw KnowledgeError.malformed(key) }
        return try items.map {
            guard case .string(let text) = $0, !text.isEmpty, text.count <= maxFieldChars else { throw KnowledgeError.malformed(key) }
            return text
        }
    }

    /// http(s) without embedded credentials, or an approved reference scheme.
    /// The source reference is metadata only: it is never fetched, executed or
    /// treated as authority. Errors carry a fixed category, never the reference.
    private static func validateReference(_ ref: String) throws {
        guard let colon = ref.firstIndex(of: ":") else { throw KnowledgeError.unsafeReference("no-scheme") }
        let scheme = ref[..<colon].lowercased()
        switch scheme {
        case "http", "https":
            guard let url = URL(string: ref), let host = url.host, !host.isEmpty else {
                throw KnowledgeError.unsafeReference("host")
            }
            guard url.user == nil, url.password == nil else {
                throw KnowledgeError.unsafeReference("credentials")
            }
        case "thoughtseed", "vault", "git":
            let rest = ref[ref.index(after: colon)...]
            guard !rest.isEmpty else { throw KnowledgeError.unsafeReference("empty") }
            guard !rest.hasPrefix("//") || scheme == "git" else { throw KnowledgeError.unsafeReference("authority") }
            guard !rest.contains("..") else { throw KnowledgeError.unsafeReference("traversal") }
        default:
            throw KnowledgeError.unsafeReference("scheme")
        }
    }

    private static func validateTime(_ value: String, now: Date, options: KnowledgeReadOptions) throws {
        guard let observed = CanonicalTimestamp.parse(value) else { throw KnowledgeError.malformed("observedAt") }
        if observed.timeIntervalSince(now) > options.clockSkew { throw KnowledgeError.staleTime("future") }
        if now.timeIntervalSince(observed) > options.maxAge { throw KnowledgeError.staleTime("too old") }
    }
}

/// Memory-only holder for decoded knowledge. Each source keeps its own slot, so
/// a Field Report result can never be served under the Field Theory label.
/// `invalidate()` on context switch or sign-out drops both and defeats any
/// load that is still pending.
public actor KnowledgeSnapshotStore {
    public static let defaultCacheTTL: TimeInterval = 60

    private let sessionProvider: any SessionProvider
    private let clock: any CoreClock
    private let cacheTTL: TimeInterval
    private var generation: UInt64 = 0
    private var fieldTheory: (context: AuthenticatedReaderContext, records: [FieldTheoryRecord], receivedAt: Date)?
    private var fieldReport: (context: AuthenticatedReaderContext, records: [FieldReportRecord], receivedAt: Date)?

    public init(sessionProvider: any SessionProvider, clock: any CoreClock = SystemCoreClock(),
                cacheTTL: TimeInterval = defaultCacheTTL) {
        self.sessionProvider = sessionProvider
        self.clock = clock
        self.cacheTTL = cacheTTL
    }

    public func loadFieldTheory(exportJSON: Data, tenantId: String, reader: any FieldTheoryReading,
                                options: KnowledgeReadOptions = KnowledgeReadOptions()) async throws -> [FieldTheoryRecord] {
        let token = generation
        let context = try await verifiedContext(tenantId: tenantId)
        let records = try reader.readFieldTheory(exportJSON: exportJSON, context: context, now: clock.now(), options: options)
        try await confirm(context, token: token)
        fieldTheory = (context, records, clock.now())
        return records
    }

    public func loadFieldReport(exportJSON: Data, tenantId: String, reader: any FieldReportReading,
                                options: KnowledgeReadOptions = KnowledgeReadOptions()) async throws -> [FieldReportRecord] {
        let token = generation
        let context = try await verifiedContext(tenantId: tenantId)
        let records = try reader.readFieldReport(exportJSON: exportJSON, context: context, now: clock.now(), options: options)
        try await confirm(context, token: token)
        fieldReport = (context, records, clock.now())
        return records
    }

    public func fieldTheoryRecords(for session: NativeSession) -> [FieldTheoryRecord]? {
        guard let held = fieldTheory else { return nil }
        let now = clock.now()
        guard now.timeIntervalSince(held.receivedAt) <= cacheTTL else {
            fieldTheory = nil
            return nil
        }
        guard (try? held.context.check(against: session, at: now)) != nil else {
            invalidate()
            return nil
        }
        return held.records
    }

    public func fieldReportRecords(for session: NativeSession) -> [FieldReportRecord]? {
        guard let held = fieldReport else { return nil }
        let now = clock.now()
        guard now.timeIntervalSince(held.receivedAt) <= cacheTTL else {
            fieldReport = nil
            return nil
        }
        guard (try? held.context.check(against: session, at: now)) != nil else {
            invalidate()
            return nil
        }
        return held.records
    }

    public func invalidate() {
        generation &+= 1
        fieldTheory = nil
        fieldReport = nil
    }

    private func verifiedContext(tenantId: String) async throws -> AuthenticatedReaderContext {
        do {
            return try AuthenticatedReaderContext.derive(from: await sessionProvider.currentSession(), tenantId: tenantId, at: clock.now())
        } catch {
            throw KnowledgeError.scopeMismatch("session")
        }
    }

    private func confirm(_ context: AuthenticatedReaderContext, token: UInt64) async throws {
        guard token == generation else { throw KnowledgeError.principalSwitched }
        do {
            try context.check(against: await sessionProvider.currentSession(), at: clock.now())
        } catch {
            invalidate()
            throw KnowledgeError.principalSwitched
        }
        guard token == generation else { throw KnowledgeError.principalSwitched }
    }
}
