import SwiftUI

/// Visible label for any locally simulated data or interaction.
struct SyntheticBadge: View {
    var compact = false

    var body: some View {
        Label(compact ? "Synthetic" : "Synthetic demo", systemImage: "flask")
            .font(CambiumFont.label)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(Palette.hold)
            .background(Capsule().fill(Palette.holdFill))
            .overlay(Capsule().strokeBorder(Palette.hold.opacity(0.5), lineWidth: 1))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Synthetic demo. Not live data, not a live decision or run.")
    }
}

/// Full-width notice explaining what a synthetic surface does and does not prove.
struct SyntheticNotice: View {
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "flask")
                .foregroundStyle(Palette.hold)
            VStack(alignment: .leading, spacing: 2) {
                Text("Synthetic demo")
                    .font(CambiumFont.label)
                    .foregroundStyle(Palette.hold)
                Text(message)
                    .font(.callout)
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Palette.holdFill))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous)
            .strokeBorder(Palette.hold.opacity(0.45), lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}

struct StatusChip: View {
    let text: String
    let tone: Tone

    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(tone.color).frame(width: 6, height: 6)
            Text(text)
                .font(CambiumFont.label)
                .lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .foregroundStyle(tone.color)
        .background(Capsule().fill(tone.color.opacity(0.12)))
        .overlay(Capsule().strokeBorder(tone.color.opacity(0.4), lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }
}

struct SectionHeader: View {
    let title: String
    var detail: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: "diamond")
                .font(.system(size: 7, weight: .bold))
                .foregroundStyle(Palette.rail)
            Text(title.uppercased())
                .font(CambiumFont.label)
                .tracking(1.1)
                .foregroundStyle(Palette.rail)
            if let detail {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(Palette.inkMuted)
            }
            Spacer(minLength: 0)
        }
        .accessibilityAddTraits(.isHeader)
    }
}

/// Label/value row. A missing value stays explicit and peach.
struct FactRow: View {
    let label: String
    let value: String?
    var missing = "Not supplied"
    var mono = false

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                labelText.frame(width: 150, alignment: .leading)
                valueText
                Spacer(minLength: 0)
            }
            VStack(alignment: .leading, spacing: 2) {
                labelText
                valueText
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var labelText: some View {
        Text(label)
            .font(.callout)
            .foregroundStyle(Palette.inkMuted)
    }

    @ViewBuilder private var valueText: some View {
        if let value, !value.isEmpty {
            Text(value)
                .font(mono ? CambiumFont.mono : .callout)
                .foregroundStyle(Palette.ink)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        } else {
            Text(missing)
                .font(.callout.italic())
                .foregroundStyle(Palette.hold)
        }
    }
}

struct EmptyStateView: View {
    let symbol: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: symbol)
                .font(.system(size: 26, weight: .light))
                .foregroundStyle(Palette.rail)
            Text(title)
                .font(CambiumFont.heading)
                .foregroundStyle(Palette.ink)
            Text(message)
                .font(.callout)
                .foregroundStyle(Palette.inkMuted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 360)
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

/// Copper rail used between stages of a flow.
struct RailLine: View {
    var vertical = true
    var dashed = false

    var body: some View {
        GeometryReader { proxy in
            Path { path in
                if vertical {
                    path.move(to: CGPoint(x: proxy.size.width / 2, y: 0))
                    path.addLine(to: CGPoint(x: proxy.size.width / 2, y: proxy.size.height))
                } else {
                    path.move(to: CGPoint(x: 0, y: proxy.size.height / 2))
                    path.addLine(to: CGPoint(x: proxy.size.width, y: proxy.size.height / 2))
                }
            }
            .stroke(Palette.rail.opacity(dashed ? 0.5 : 0.8),
                    style: StrokeStyle(lineWidth: 1.2, dash: dashed ? [3, 4] : []))
        }
        .accessibilityHidden(true)
    }
}

struct PanelModifier: ViewModifier {
    var padding: CGFloat = 16
    var highlighted = false

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Palette.raised))
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(highlighted ? Palette.signal : Palette.hairline, lineWidth: highlighted ? 1.5 : 1))
    }
}

extension View {
    func cambiumPanel(padding: CGFloat = 16, highlighted: Bool = false) -> some View {
        modifier(PanelModifier(padding: padding, highlighted: highlighted))
    }

    /// Distinct chartreuse focus ring for custom focusable views.
    func cambiumFocusRing(_ focused: Bool, cornerRadius: CGFloat = 10) -> some View {
        overlay(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .strokeBorder(Palette.signal, lineWidth: focused ? 2.5 : 0)
                .padding(-3)
        )
    }
}

/// Page frame: title block plus scrolling content on the canvas color.
struct PageScaffold<Content: View>: View {
    let eyebrow: String
    let title: String
    let subtitle: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(eyebrow.uppercased())
                        .font(CambiumFont.label)
                        .tracking(1.2)
                        .foregroundStyle(Palette.rail)
                    Text(title)
                        .font(CambiumFont.display)
                        .foregroundStyle(Palette.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text(subtitle)
                        .font(.body)
                        .foregroundStyle(Palette.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
                content()
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 24)
            .frame(maxWidth: 1100, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Palette.canvas)
    }
}
