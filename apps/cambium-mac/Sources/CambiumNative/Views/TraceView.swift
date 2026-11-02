import SwiftUI

/// The same steps drawn as a graph and listed in order. Both select the same step.
struct TraceView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        PageScaffold(eyebrow: "Trace", title: "How the work moves",
                     subtitle: "Each step as a graph and as a numbered list. Both show the same steps.") {
            if model.steps.isEmpty {
                EmptyStateView(symbol: "point.3.connected.trianglepath.dotted", title: "No trace to show",
                               message: "A trace appears when work is read. No owner is configured.")
                    .cambiumPanel()
            } else {
                if model.isDemo { SyntheticNotice(message: "These steps describe the demo walk-through. They are not a record of a real run.") }
                TraceGraph()
                LinearSteps()
                if let step = model.selectedStep {
                    StepDetail(step: step)
                }
            }
        }
    }
}

private struct TraceGraph: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Graph")
            ZStack {
                TerrainBackground(seed: "trace")
                Canvas { context, size in
                    let byID = Dictionary(uniqueKeysWithValues: model.steps.map { ($0.id, $0) })
                    for step in model.steps {
                        for dependency in step.dependsOn {
                            guard let from = byID[dependency] else { continue }
                            let active = model.selectedStepID == step.id || model.selectedStepID == from.id
                            context.stroke(copperRail(from: from.position, to: step.position, in: size),
                                           with: .color(Palette.rail.opacity(active ? 1 : 0.6)),
                                           style: StrokeStyle(lineWidth: active ? 2.4 : 1.4, lineCap: .round))
                        }
                    }
                }
                .padding(.horizontal, 40)
                .padding(.vertical, 28)
                .accessibilityHidden(true)
                GeometryReader { proxy in
                    ForEach(model.steps) { step in
                        StepNode(step: step, selected: model.selectedStepID == step.id) {
                            model.selectedStepID = step.id
                        }
                        .position(x: step.position.x * proxy.size.width, y: step.position.y * proxy.size.height)
                    }
                }
                .padding(.horizontal, 40)
                .padding(.vertical, 28)
            }
            .frame(height: 240)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Palette.hairline))
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Trace graph")
        }
    }
}

private struct StepNode: View {
    let step: TraceStep
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Text("\(step.order)")
                    .font(CambiumFont.label)
                    .frame(width: 30, height: 30)
                    .foregroundStyle(selected ? Palette.onSignal : Palette.ink)
                    .background(Circle().fill(selected ? Palette.signalFill : Palette.raised))
                    .overlay(Circle().strokeBorder(Tone.forStatus(step.state).color, lineWidth: 1.5))
                Text(step.title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Palette.ink)
                    .padding(.horizontal, 6)
                    .background(Capsule().fill(Palette.raised.opacity(0.9)))
                    .fixedSize()
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Step \(step.order), \(step.title), \(step.state)")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

private struct LinearSteps: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Steps in order")
            ForEach(model.steps) { step in
                let selected = model.selectedStepID == step.id
                Button { model.selectedStepID = step.id } label: {
                    HStack(spacing: 12) {
                        Text("\(step.order)")
                            .font(CambiumFont.label)
                            .frame(width: 26, height: 26)
                            .foregroundStyle(selected ? Palette.onSignal : Palette.ink)
                            .background(Circle().fill(selected ? Palette.signalFill : Palette.surface))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(step.title).font(CambiumFont.heading).foregroundStyle(Palette.ink)
                            Text(step.detail).font(.callout).foregroundStyle(Palette.inkMuted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 8)
                        StatusChip(text: step.state, tone: Tone.forStatus(step.state))
                    }
                    .contentShape(Rectangle())
                    .cambiumPanel(padding: 10, highlighted: selected)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Step \(step.order), \(step.title), \(step.state). \(step.detail)")
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
    }
}

private struct StepDetail: View {
    @Environment(AppModel.self) private var model
    let step: TraceStep

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Selected step")
            FactRow(label: "Step", value: "\(step.order). \(step.title)")
            FactRow(label: "State", value: step.state)
            FactRow(label: "Comes after", value: step.dependsOn.compactMap { id in model.steps.first { $0.id == id }?.title }
                .joined(separator: ", "), missing: "Nothing; this is the first step")
            HStack {
                switch step.id {
                case "step-select": Button("Open work") { model.open(.work) }
                case "step-review": Button("Open proposal review") { model.open(.proposal) }
                case "step-preview": Button("Open launch preview") { model.open(.launch) }
                case "step-observe": Button("Open Canopy") { model.open(.canopy) }
                default: Text("Held. No action is available.").font(.callout).foregroundStyle(Palette.hold)
                }
                Spacer()
            }
        }
        .cambiumPanel()
    }
}
