import AppKit
import SwiftUI

/// The eleven conceptual organ roles that have source art in the atlas.
/// The art names a role. It never reports health or live status.
enum Organ: String, CaseIterable, Identifiable, Sendable {
    case genesis, taste, hands, will, cortex, vestibule, adytum, nutrix, auspex, circulator, praeceptor

    var id: String { rawValue }

    var title: String { rawValue.capitalized }

    var role: String {
        switch self {
        case .genesis: "Brand intake and proof"
        case .taste: "Quality review of presentation"
        case .hands: "Carries out admitted work"
        case .will: "Intent and growth planning"
        case .cortex: "Source-linked retrieval and lessons"
        case .vestibule: "Session orientation"
        case .adytum: "On-demand synthesis, one next action"
        case .nutrix: "Session-end learning signals"
        case .auspex: "Health evidence and bounded healing"
        case .circulator: "Periodic recommendation digest"
        case .praeceptor: "Daily advisory drafts"
        }
    }

    /// Conceptual placement on the terrain, in unit coordinates.
    var terrainPoint: CGPoint {
        switch self {
        case .genesis: CGPoint(x: 0.08, y: 0.30)
        case .taste: CGPoint(x: 0.21, y: 0.72)
        case .hands: CGPoint(x: 0.36, y: 0.30)
        case .will: CGPoint(x: 0.50, y: 0.74)
        case .cortex: CGPoint(x: 0.50, y: 0.40)
        case .vestibule: CGPoint(x: 0.64, y: 0.22)
        case .adytum: CGPoint(x: 0.76, y: 0.62)
        case .nutrix: CGPoint(x: 0.88, y: 0.28)
        case .auspex: CGPoint(x: 0.34, y: 0.58)
        case .circulator: CGPoint(x: 0.92, y: 0.76)
        case .praeceptor: CGPoint(x: 0.66, y: 0.52)
        }
    }

    /// Pairs joined by a copper rail on the terrain. Roles only, not traffic.
    static let rails: [(Organ, Organ)] = [
        (.genesis, .taste), (.genesis, .hands), (.hands, .cortex), (.taste, .auspex),
        (.auspex, .cortex), (.cortex, .will), (.cortex, .vestibule), (.cortex, .praeceptor),
        (.praeceptor, .adytum), (.vestibule, .nutrix), (.adytum, .circulator), (.nutrix, .adytum)
    ]
}

/// Loads the byte-identical source WEBP derivatives from the module bundle.
enum OrganArt {
    private static var cache: [Organ: NSImage] = [:]

    static func image(for organ: Organ) -> NSImage? {
        if let cached = cache[organ] { return cached }
        let name = "\(organ.rawValue)-concept-256"
        let url = Bundle.module.url(forResource: name, withExtension: "webp", subdirectory: "Atlas")
            ?? Bundle.module.url(forResource: name, withExtension: "webp")
        guard let url, let image = NSImage(contentsOf: url) else { return nil }
        cache[organ] = image
        return image
    }
}

struct OrganImage: View {
    let organ: Organ
    var size: CGFloat = 48

    var body: some View {
        Group {
            if let image = OrganArt.image(for: organ) {
                Image(nsImage: image)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFill()
            } else {
                Image(systemName: "circle.hexagongrid")
                    .resizable()
                    .scaledToFit()
                    .padding(size * 0.22)
                    .foregroundStyle(Palette.rail)
                    .background(Palette.surface)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.2, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: size * 0.2, style: .continuous)
            .strokeBorder(Palette.rail.opacity(0.7), lineWidth: 1))
        .accessibilityHidden(true)
    }
}
