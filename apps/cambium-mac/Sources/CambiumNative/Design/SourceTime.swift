import Foundation
import CambiumCore

/// Formats source timestamps and names the gaps between them.
/// A missing or unreadable time is stated, never filled in.
enum SourceTime {
    static func parse(_ iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        if let canonical = CanonicalTimestamp.parse(iso) { return canonical }
        // Catalog provenance may be emitted at whole-second precision. Keep
        // this display tolerance separate from receipt/expiry validation.
        guard iso.range(of: #"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$"#,
                        options: .regularExpression) != nil else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        guard let date = formatter.date(from: iso), formatter.string(from: date) == iso else { return nil }
        return date
    }

    static func display(_ iso: String?, utc: Bool) -> String {
        guard let iso, !iso.isEmpty else { return "No source time" }
        guard let date = parse(iso) else { return "Unreadable time" }
        return display(date, utc: utc)
    }

    static func display(_ date: Date, utc: Bool) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = utc ? "d MMM yyyy, HH:mm 'UTC'" : "d MMM yyyy, HH:mm"
        formatter.timeZone = utc ? TimeZone(identifier: "UTC") : .current
        return formatter.string(from: date)
    }

    /// How long before the snapshot time a record was observed.
    static func gap(observed iso: String?, snapshot asOf: String) -> String {
        guard let observed = parse(iso) else { return "No source time to compare" }
        guard let base = parse(asOf) else { return "Snapshot has no time to compare" }
        let seconds = base.timeIntervalSince(observed)
        if seconds < -1 { return "Observed after the snapshot time" }
        if seconds < 60 { return "Observed at snapshot time" }
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = [.day, .hour, .minute]
        formatter.unitsStyle = .full
        formatter.maximumUnitCount = 2
        return "Observed \(formatter.string(from: seconds) ?? "earlier") before the snapshot"
    }
}
