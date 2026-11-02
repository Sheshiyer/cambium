import SwiftUI

/// Procedural terrain: layered contour lines over a petrol/ivory ground.
/// Drawn in code; the source terrain image is not bundled.
struct TerrainBackground: View {
    var seed = "cambium"
    var phase: Double = 0

    var body: some View {
        Canvas { context, size in
            let rect = CGRect(origin: .zero, size: size)
            context.fill(Path(rect), with: .linearGradient(
                Gradient(colors: [Palette.terrainHigh, Palette.terrainLow]),
                startPoint: .zero, endPoint: CGPoint(x: size.width, y: size.height)))

            let base = StableHash.unit(seed) * .pi * 2
            let lines = 14
            for index in 0..<lines {
                let t = Double(index) / Double(lines - 1)
                var path = Path()
                let steps = max(Int(size.width / 8), 24)
                for step in 0...steps {
                    let x = Double(step) / Double(steps)
                    let wave = sin(x * 5.1 + base + t * 2.3 + phase) * 0.035
                        + sin(x * 11.7 + base * 1.7 + t * 4.1) * 0.015
                    let y = (t * 1.1 - 0.05 + wave) * size.height
                    let point = CGPoint(x: x * size.width, y: y)
                    if step == 0 { path.move(to: point) } else { path.addLine(to: point) }
                }
                let major = index % 4 == 0
                context.stroke(path, with: .color(Palette.contour.opacity(major ? 0.45 : 0.2)),
                               lineWidth: major ? 1.1 : 0.6)
            }
        }
        .accessibilityHidden(true)
    }
}

/// Copper rail between two unit-space points, curved so rails read as paths.
func copperRail(from start: CGPoint, to end: CGPoint, in size: CGSize) -> Path {
    let a = CGPoint(x: start.x * size.width, y: start.y * size.height)
    let b = CGPoint(x: end.x * size.width, y: end.y * size.height)
    var path = Path()
    path.move(to: a)
    let mid = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - abs(b.x - a.x) * 0.12)
    path.addQuadCurve(to: b, control: mid)
    return path
}
