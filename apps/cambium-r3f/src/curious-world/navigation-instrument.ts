export type ChartPoint = { x: number; z: number };
export type ChartDistrict = ChartPoint & { id: string; name: string };
export type ChartPath = { a: ChartPoint; b: ChartPoint };
export type ChartSnapshot = ChartPoint & { heading: number; district: string | null };

const SVG_NS = 'http://www.w3.org/2000/svg';
export const INSTRUMENT_INTERVAL_MS = 125;

/** Renderer events own chart updates. No HUD timer survives a sleeping world. */
export function createInstrumentObserver<T>(render: (snapshot: T) => void): {
  update(snapshot: T, now: number, force?: boolean): void; dispose(): void;
} {
  let disposed = false, last = -Infinity;
  return {
    update(snapshot, now, force = false) {
      if (disposed || !Number.isFinite(now)) return;
      if (!force && now - last < INSTRUMENT_INTERVAL_MS && now >= last) return;
      last = now; render(snapshot);
    },
    dispose() { disposed = true; },
  };
}

/** Physical map coordinates only; this chart does not draw operational relationships. */
export function projectChartPoint(point: ChartPoint, extent = 42): { x: number; y: number } {
  const bound = Number.isFinite(extent) && extent > 0 ? extent : 42;
  const scaled = (value: number): number => 120 + Math.max(-1, Math.min(1, (Number.isFinite(value) ? value : 0) / bound)) * 96;
  return { x: scaled(point.x), y: scaled(point.z) };
}

export function chartHeading(heading: number): number {
  if (!Number.isFinite(heading)) return 0;
  const degrees = -heading * 180 / Math.PI;
  return ((degrees % 360) + 360) % 360;
}

export function createNavigationChart(districts: readonly ChartDistrict[], paths: readonly ChartPath[]): {
  svg: SVGSVGElement; render: (snapshot: ChartSnapshot, visited: ReadonlySet<string>) => void;
} {
  function shape<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string>): SVGElementTagNameMap[K] {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }
  const svg = shape('svg', { viewBox: '0 0 240 240', 'aria-hidden': 'true', focusable: 'false', class: 'cw-chart' });
  svg.append(shape('circle', { cx: '120', cy: '120', r: '114', class: 'cw-chart-rim' }));
  for (const radius of [36, 74, 98]) svg.append(shape('circle', { cx: '120', cy: '120', r: String(radius), class: 'cw-chart-contour' }));
  for (let index = 0; index < 40; index++) {
    const angle = index * Math.PI / 20;
    const inside = index % 5 === 0 ? 104 : 108;
    svg.append(shape('line', { x1: String(120 + Math.sin(angle) * inside), y1: String(120 - Math.cos(angle) * inside),
      x2: String(120 + Math.sin(angle) * 112), y2: String(120 - Math.cos(angle) * 112), class: 'cw-chart-tick' }));
  }
  for (const path of paths) {
    const a = projectChartPoint(path.a), b = projectChartPoint(path.b);
    svg.append(shape('line', { x1: String(a.x), y1: String(a.y), x2: String(b.x), y2: String(b.y), class: 'cw-chart-route' }));
  }
  svg.append(shape('circle', { cx: '120', cy: '120', r: '15', class: 'cw-chart-common' }));
  const nodes = districts.map((district, index) => {
    const point = projectChartPoint(district);
    const group = shape('g', { transform: `translate(${point.x} ${point.y})`, class: 'cw-chart-district', 'data-district': district.id });
    const label = shape('text', { x: '0', y: '4', 'text-anchor': 'middle', class: 'cw-chart-number' });
    label.textContent = String(index + 1).padStart(2, '0');
    group.append(shape('circle', { r: '14', class: 'cw-chart-island' }), label);
    svg.append(group);
    return { id: district.id, group };
  });
  const north = shape('text', { x: '120', y: '18', 'text-anchor': 'middle', class: 'cw-chart-north' });
  north.textContent = 'N'; svg.append(north);
  const marker = shape('g', { class: 'cw-chart-player' });
  marker.append(shape('circle', { r: '7', class: 'cw-chart-player-ring' }), shape('path', { d: 'M0 -11L5 5L0 2L-5 5Z' }));
  svg.append(marker);
  return {
    svg,
    render(snapshot, visited) {
      const point = projectChartPoint(snapshot);
      marker.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${chartHeading(snapshot.heading).toFixed(1)})`);
      for (const node of nodes) {
        node.group.dataset.current = String(snapshot.district === node.id);
        node.group.dataset.visited = String(visited.has(node.id));
      }
    },
  };
}
