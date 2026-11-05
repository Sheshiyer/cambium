import AppKit
import SwiftUI

/// Cambium semantic palette. Brand hexes come from the existing visual docs
/// (petrol #00272B, substrate #012F34, chartreuse #E0FF4F, mint #D6FFF6,
/// peach #FFC7A1, copper #B58B65, ivory paper). Light-mode variants darken
/// the signal hues so text keeps contrast on ivory.
enum Palette {
    // Fixed brand values.
    static let petrol = Color(cambiumHex: 0x00272B)
    static let substrate = Color(cambiumHex: 0x012F34)
    static let chartreuse = Color(cambiumHex: 0xE0FF4F)
    static let mint = Color(cambiumHex: 0xD6FFF6)
    static let peach = Color(cambiumHex: 0xFFC7A1)
    static let copper = Color(cambiumHex: 0xB58B65)
    static let ivory = Color(cambiumHex: 0xF4EFE3)

    // Semantic, appearance-aware layers.
    static let canvas = dynamic(light: 0xF4EFE3, dark: 0x00272B)
    static let surface = dynamic(light: 0xE9E2D2, dark: 0x012F34)
    static let raised = dynamic(light: 0xFBF8F1, dark: 0x06393E)
    static let ink = dynamic(light: 0x0B2D31, dark: 0xF1ECE0)
    static let inkMuted = dynamic(light: 0x4A605B, dark: 0xA8C3BB)
    /// Chartreuse focus/selection as stroke or text.
    static let signal = dynamic(light: 0x4F5F00, dark: 0xE0FF4F)
    /// Chartreuse as a fill; pair with `onSignal` text.
    static let signalFill = Color(cambiumHex: 0xE0FF4F)
    static let onSignal = Color(cambiumHex: 0x00272B)
    /// Mint evidence/fact.
    static let evidence = dynamic(light: 0x1C6656, dark: 0xD6FFF6)
    /// Peach hold/uncertain.
    static let hold = dynamic(light: 0x9A4A17, dark: 0xFFC7A1)
    static let holdFill = dynamic(light: 0xFBE2CF, dark: 0x4A3324)
    /// Copper rails and edges.
    static let rail = dynamic(light: 0x8A6640, dark: 0xB58B65)
    static let hairline = dynamic(light: 0xC9B79C, dark: 0x2D5A57)
    // Terrain.
    static let terrainHigh = dynamic(light: 0xDDE7DD, dark: 0x0B4247)
    static let terrainLow = dynamic(light: 0xC8D9D0, dark: 0x001D21)
    static let contour = dynamic(light: 0x5C8A80, dark: 0x6FA59A)

    static func dynamic(light: UInt32, dark: UInt32) -> Color {
        Color(nsColor: NSColor(name: nil) { appearance in
            let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            return NSColor(cambiumHex: isDark ? dark : light)
        })
    }
}

extension NSColor {
    convenience init(cambiumHex hex: UInt32) {
        self.init(
            srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

extension Color {
    init(cambiumHex hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

/// Semantic tone shared by chips, dots and rails.
enum Tone: Sendable {
    case signal, evidence, hold, rail, muted

    var color: Color {
        switch self {
        case .signal: Palette.signal
        case .evidence: Palette.evidence
        case .hold: Palette.hold
        case .rail: Palette.rail
        case .muted: Palette.inkMuted
        }
    }

    /// Maps free-form attention/status strings from a snapshot to a tone.
    /// Unknown words stay muted; nothing is promoted to "ready" by default.
    static func forStatus(_ raw: String) -> Tone {
        let value = raw.lowercased()
        let hold = ["block", "hold", "held", "denied", "expired", "stale", "unknown", "refus",
                    "offline", "unavailable", "fail", "error", "missing", "unsupported"]
        let signal = ["review", "decide", "decision", "launch", "focus", "attention", "now", "next"]
        let evidence = ["ready", "done", "stable", "verified", "observed", "ok", "online",
                        "healthy", "complete", "recorded", "admitted"]
        if hold.contains(where: value.contains) { return .hold }
        if signal.contains(where: value.contains) { return .signal }
        if evidence.contains(where: value.contains) { return .evidence }
        return .muted
    }
}

enum CambiumFont {
    static let display = Font.system(.largeTitle, design: .serif).weight(.regular)
    static let title = Font.system(.title2, design: .serif).weight(.regular)
    static let heading = Font.system(.headline, design: .default)
    static let label = Font.system(.caption, design: .monospaced).weight(.medium)
    static let mono = Font.system(.callout, design: .monospaced)
    static let monoSmall = Font.system(.caption, design: .monospaced)
}

extension EnvironmentValues {
    /// Effective reduced motion: system setting or the local preference.
    @Entry var cambiumReduceMotion: Bool = false
}

/// Stable, process-independent hash (Swift's `hashValue` is seeded per run).
enum StableHash {
    static func fnv1a(_ text: String) -> UInt64 {
        var hash: UInt64 = 0xcbf29ce484222325
        for byte in text.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x100000001b3
        }
        return hash
    }

    static func unit(_ text: String) -> Double {
        Double(fnv1a(text) % 10_000) / 10_000
    }

    static func shortHex(_ text: String) -> String {
        String(String(fnv1a(text), radix: 16).prefix(8)).uppercased()
    }
}
