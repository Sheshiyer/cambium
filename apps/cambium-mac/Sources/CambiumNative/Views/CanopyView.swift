import SwiftUI
import struct CambiumCore.WorkObject

/// Default page: the system at a glance, attention first.
struct CanopyView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        PageScaffold(eyebrow: "Canopy", title: "What needs you",
                     subtitle: model.isDemo
                        ? "Synthetic records as of \(model.time(model.snapshot.asOf)). Choose one to open it."
                        : "Nothing to show yet. Live work appears here after sign-in and owner setup exist.") {
            CanopyMap()

            if !model.isDemo {
                UnconfiguredPanel()
            }

            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Observed work", detail: model.isDemo ? "\(model.snapshot.work.count) synthetic records" : "none")
                if model.snapshot.work.isEmpty {
                    EmptyStateView(symbol: "tray", title: "No work to show",
                                   message: "No owner is configured, so no work has been read.")
                        .cambiumPanel()
                } else {
                    Text("Observed records are not admitted. Admission needs a capability that this build cannot obtain.")
                        .font(.callout)
                        .foregroundStyle(Palette.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                    ForEach(model.snapshot.work) { work in
                        WorkRow(work: work) { model.selectWork(work.id) }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Gaps", detail: "\(model.snapshot.gaps.count)")
                ForEach(model.snapshot.gaps, id: \.self) { gap in
                    Label {
                        Text(GapText.readable(gap))
                            .font(.callout)
                            .foregroundStyle(Palette.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    } icon: {
                        Image(systemName: "exclamationmark.triangle")
                            .foregroundStyle(Palette.hold)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .cambiumPanel(padding: 12)
                }
            }
        }
    }
}

/// Plain-language text for known gap codes. Unknown codes pass through.
enum GapText {
    static func readable(_ gap: String) -> String {
        switch gap {
        case "native-identity-unconfigured": "Sign-in is not set up, so nothing live can be read."
        case "launch-owner-unconfigured": "No launch owner is set up, so nothing can be launched."
        default: gap
        }
    }
}

private struct UnconfiguredPanel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            OrganImage(organ: .vestibule, size: 56)
            VStack(alignment: .leading, spacing: 6) {
                Text("Sign-in is not set up")
                    .font(CambiumFont.heading)
                    .foregroundStyle(Palette.ink)
                Text("This build has no sign-in and no owner, so it reads no live data and cannot decide or launch anything. You can explore a labelled synthetic demo instead.")
                    .font(.callout)
                    .foregroundStyle(Palette.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                HStack {
                    Button("Open demo") { model.enterDemo() }
                        .buttonStyle(.borderedProminent)
                    Button("Connections") { model.open(.connections) }
                }
                .padding(.top, 4)
            }
            Spacer(minLength: 0)
        }
        .cambiumPanel(highlighted: true)
    }
}

/// Terrain with organ portraits joined by copper rails. Portraits name roles;
/// they are not health or status indicators.
private struct CanopyMap: View {
    @Environment(AppModel.self) private var model
    @Environment(\.cambiumReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "System map", detail: "Roles only, not live status")
            ZStack {
                TimelineView(.animation(minimumInterval: 1 / 15, paused: reduceMotion)) { context in
                    let phase = reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 600) * 0.12
                    TerrainBackground(phase: phase)
                }
                Canvas { context, size in
                    for (a, b) in Organ.rails {
                        let highlighted = model.selectedOrgan == a || model.selectedOrgan == b
                        context.stroke(copperRail(from: a.terrainPoint, to: b.terrainPoint, in: size),
                                       with: .color(Palette.rail.opacity(highlighted ? 0.95 : 0.55)),
                                       style: StrokeStyle(lineWidth: highlighted ? 2.2 : 1.3, lineCap: .round,
                                                          dash: highlighted ? [] : [5, 4]))
                    }
                }
                .accessibilityHidden(true)
                GeometryReader { proxy in
                    ForEach(Organ.allCases) { organ in
                        OrganPin(organ: organ, selected: model.selectedOrgan == organ) {
                            model.selectedOrgan = model.selectedOrgan == organ ? nil : organ
                        }
                        .position(x: organ.terrainPoint.x * proxy.size.width,
                                  y: organ.terrainPoint.y * proxy.size.height)
                    }
                }
                .padding(.horizontal, 34)
                .padding(.vertical, 30)
            }
            .frame(height: 300)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Palette.hairline))

            Group {
                if let organ = model.selectedOrgan {
                    HStack(spacing: 12) {
                        OrganImage(organ: organ, size: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(organ.title).font(CambiumFont.heading).foregroundStyle(Palette.ink)
                            Text(organ.role).font(.callout).foregroundStyle(Palette.inkMuted)
                        }
                        Spacer(minLength: 8)
                        Text("Concept art. No live status.")
                            .font(.caption)
                            .foregroundStyle(Palette.inkMuted)
                        Button("Clear") { model.selectedOrgan = nil }
                            .controlSize(.small)
                    }
                } else {
                    Text("Select a portrait to read its role.")
                        .font(.callout)
                        .foregroundStyle(Palette.inkMuted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .cambiumPanel(padding: 12)
        }
    }
}

private struct OrganPin: View {
    let organ: Organ
    let selected: Bool
    let action: () -> Void
    @FocusState private var focused: Bool

    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                OrganImage(organ: organ, size: selected ? 54 : 44)
                Text(organ.title)
                    .font(CambiumFont.label)
                    .foregroundStyle(Palette.ink)
                    .padding(.horizontal, 5)
                    .background(Capsule().fill(Palette.raised.opacity(0.85)))
                    .fixedSize()
            }
            .overlay(alignment: .top) {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Palette.signal, lineWidth: selected ? 2 : 0)
                    .frame(width: (selected ? 54 : 44) + 6, height: (selected ? 54 : 44) + 6)
                    .offset(y: -3)
            }
        }
        .buttonStyle(.plain)
        .focusable()
        .focused($focused)
        .cambiumFocusRing(focused, cornerRadius: 12)
        .accessibilityLabel("\(organ.title): \(organ.role)")
        .accessibilityHint(selected ? "Selected. Activate to clear." : "Shows this role")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

struct WorkRow: View {
    let work: WorkObject
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                OrganImage(organ: work.kind == "program" ? .will : .genesis, size: 44)
                VStack(alignment: .leading, spacing: 4) {
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 8) {
                            Text(work.name).font(CambiumFont.heading).foregroundStyle(Palette.ink)
                            Text(work.kind).font(CambiumFont.monoSmall).foregroundStyle(Palette.rail)
                        }
                        Text(work.name).font(CambiumFont.heading).foregroundStyle(Palette.ink)
                    }
                    Text(work.summary)
                        .font(.callout)
                        .foregroundStyle(Palette.inkMuted)
                        .lineLimit(2)
                }
                Spacer(minLength: 8)
                StatusChip(text: "Observed · \(work.attention)", tone: Tone.forStatus(work.attention))
                Image(systemName: "chevron.right")
                    .font(.caption.bold())
                    .foregroundStyle(Palette.rail)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
            .cambiumPanel(padding: 12)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(work.name), \(work.kind), observed, \(work.attention)")
        .accessibilityHint("Opens the work dossier")
    }
}
