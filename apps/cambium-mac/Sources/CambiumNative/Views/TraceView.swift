import SwiftUI

/// Producer work graph from the decoded Mission Fabric projection, with an
/// equivalent linear list. The five-step tour is a separate walkthrough.
struct TraceView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        PageScaffold(eyebrow: "Trace", title: "How the work is connected",
                     subtitle: "Work, tasks, agents, clusters, runs and receipts as the producer served them. Graph and list show the same records.") {
            if let fabric = model.fabric {
                if let replay = model.replayClock {
                    SyntheticNotice(message: "Source fixture replay at \(model.time(replay)). This is the recorded producer response, not live freshness.")
                }
                FabricGraph(trace: fabric.trace)
                FabricList(fabric: fabric)
                if let node = model.selectedTraceNode { NodeDetail(node: node, trace: fabric.trace) }
                if !fabric.gaps.isEmpty { GapList(gaps: fabric.gaps) }
            } else {
                EmptyStateView(symbol: "point.3.connected.trianglepath.dotted", title: "No work graph",
                               message: model.session == nil
                                   ? "A work graph appears after a configured owner is read. No owner is signed in."
                                   : "The Mission Fabric read has not returned a graph.")
                    .cambiumPanel()
            }
            TourWalkthroughView()
        }
    }
}

private struct FabricGraph: View {
    @Environment(AppModel.self) private var model
    let trace: FabricTrace

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Graph", detail: "\(trace.nodes.count) records, \(trace.edges.count) relationships")
            ZStack {
                TerrainBackground(seed: "trace")
                Canvas { context, size in
                    for edge in trace.edges {
                        guard let from = trace.node(edge.from), let to = trace.node(edge.to) else { continue }
                        let active = model.selectedTraceID == edge.from || model.selectedTraceID == edge.to
                        context.stroke(copperRail(from: from.position, to: to.position, in: size),
                                       with: .color(Palette.rail.opacity(active ? 1 : 0.55)),
                                       style: StrokeStyle(lineWidth: active ? 2.4 : 1.2, lineCap: .round))
                    }
                }
                .padding(.horizontal, 40).padding(.vertical, 28)
                .accessibilityHidden(true)
                GeometryReader { proxy in
                    ForEach(trace.nodes) { node in
                        FabricNodeButton(node: node, selected: model.selectedTraceID == node.id) { model.selectedTraceID = node.id }
                            .position(x: node.position.x * proxy.size.width, y: node.position.y * proxy.size.height)
                    }
                }
                .padding(.horizontal, 40).padding(.vertical, 28)
            }
            .frame(height: 300)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Palette.hairline))
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Work graph with \(trace.nodes.count) records")
        }
    }
}

private struct FabricNodeButton: View {
    let node: FabricTraceNode
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Text(String(node.kind.prefix(1)).uppercased())
                    .font(CambiumFont.label)
                    .frame(width: 28, height: 28)
                    .foregroundStyle(selected ? Palette.onSignal : Palette.ink)
                    .background(Circle().fill(selected ? Palette.signalFill : Palette.raised))
                    .overlay(Circle().strokeBorder(Palette.rail, lineWidth: 1.5))
                Text(node.title)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(1)
                    .padding(.horizontal, 5)
                    .background(Capsule().fill(Palette.raised.opacity(0.9)))
                    .frame(maxWidth: 110)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(node.kind) \(node.title), \(node.detail)")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// Linear equivalent: every record with the relationships it takes part in.
private struct FabricList: View {
    @Environment(AppModel.self) private var model
    let fabric: FabricDisplay

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Records and relationships")
            ForEach(fabric.trace.nodes) { node in
                let selected = model.selectedTraceID == node.id
                let outgoing = fabric.trace.edges.filter { $0.from == node.id }
                let incoming = fabric.trace.edges.filter { $0.to == node.id }
                Button { model.selectedTraceID = node.id } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            StatusChip(text: node.kind, tone: .muted)
                            Text(node.title).font(CambiumFont.heading).foregroundStyle(Palette.ink)
                            Spacer()
                            Text(node.detail).font(.caption).foregroundStyle(Palette.inkMuted)
                        }
                        ForEach(outgoing) { edge in
                            Text("\(edge.kind) → \(fabric.trace.node(edge.to)?.title ?? edge.to)")
                                .font(.caption).foregroundStyle(Palette.inkMuted)
                        }
                        ForEach(incoming) { edge in
                            Text("\(fabric.trace.node(edge.from)?.title ?? edge.from) → \(edge.kind)")
                                .font(.caption).foregroundStyle(Palette.inkMuted)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                    .cambiumPanel(padding: 10, highlighted: selected)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(node.kind) \(node.title), \(node.detail), \(outgoing.count) outgoing and \(incoming.count) incoming relationships")
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
    }
}

private struct NodeDetail: View {
    @Environment(AppModel.self) private var model
    let node: FabricTraceNode
    let trace: FabricTrace

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Selected record")
            FactRow(label: "Kind", value: node.kind)
            FactRow(label: "Title", value: node.title)
            FactRow(label: "Identifier", value: node.id, mono: true)
            FactRow(label: "Producer state", value: node.detail)
            if node.kind == "receipt" {
                Text("A receipt shows that the producer recorded a run. It is not semantic acceptance.")
                    .font(.callout).foregroundStyle(Palette.hold)
            }
            if node.kind == "work" {
                Button("Open work") { model.selectWork(node.id) }
            }
        }
        .cambiumPanel()
    }
}

private struct GapList: View {
    let gaps: [FabricGapDisplay]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Producer gaps", detail: "\(gaps.count)")
            ForEach(gaps) { gap in
                VStack(alignment: .leading, spacing: 2) {
                    Text(gap.kind).font(CambiumFont.label).foregroundStyle(Palette.rail)
                    Text(gap.detail).font(.callout).foregroundStyle(Palette.ink).fixedSize(horizontal: false, vertical: true)
                    if let subject = gap.subjectId { Text(subject).font(CambiumFont.monoSmall).foregroundStyle(Palette.inkMuted) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .cambiumPanel(padding: 10)
            }
        }
    }
}

/// The five-step product tour. It explains the flow and is not a record of work.
private struct TourWalkthroughView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Walkthrough", detail: "Tour, not a work graph")
            ForEach(model.tourSteps) { step in
                HStack(spacing: 12) {
                    Text("\(step.order)")
                        .font(CambiumFont.label)
                        .frame(width: 26, height: 26)
                        .background(Circle().fill(Palette.surface))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(step.title).font(CambiumFont.heading).foregroundStyle(Palette.ink)
                        Text(step.detail).font(.callout).foregroundStyle(Palette.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    StatusChip(text: "walkthrough", tone: .muted)
                }
                .cambiumPanel(padding: 10)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Walkthrough step \(step.order): \(step.title). \(step.detail)")
            }
        }
    }
}
