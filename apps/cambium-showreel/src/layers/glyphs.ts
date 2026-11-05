// Line-art organ glyphs (design-system board §2): genesis star, taste
// capsule, build triangle, ops slab, cortex wheel. Unit-sized polylines.
import type { V3 } from '../lib/shapes.ts';
import type { OrganId } from '../timeline.ts';

const star = (n: number, r0: number, r1: number): V3[] => {
  const out: V3[] = [];
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? r0 : r1;
    out.push([Math.sin(a) * r, Math.cos(a) * r, 0]);
  }
  return out;
};

const stadium = (w: number, h: number, n = 24): V3[] => {
  const r = h / 2;
  const cx = w / 2 - r;
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    out.push([cx + Math.cos(a) * r, Math.sin(a) * r, 0]);
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (i / n) * Math.PI;
    out.push([-cx + Math.cos(a) * r, Math.sin(a) * r, 0]);
  }
  out.push(out[0]);
  return out;
};

const tri = (r: number): V3[] => {
  const out: V3[] = [];
  for (let i = 0; i <= 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    out.push([Math.sin(a) * r, Math.cos(a) * r - r * 0.12, 0]);
  }
  return out;
};

const roundRect = (w: number, h: number, r: number, skew = 0, n = 6): V3[] => {
  // clockwise from the top-right corner; skew shears x by y for the slab look
  const corners: [number, number, number][] = [
    [w / 2 - r, h / 2 - r, Math.PI / 2],
    [w / 2 - r, -h / 2 + r, 0],
    [-w / 2 + r, -h / 2 + r, -Math.PI / 2],
    [-w / 2 + r, h / 2 - r, Math.PI],
  ];
  const out: V3[] = [];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const ang = a0 - (i / n) * (Math.PI / 2);
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      out.push([x + y * skew, y, 0]);
    }
  }
  out.push(out[0]);
  return out;
};

const circle = (r: number, n = 64): V3[] => {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([Math.sin(a) * r, Math.cos(a) * r, 0]);
  }
  return out;
};

export function glyph(id: OrganId): V3[][] {
  switch (id) {
    case 'genesis':
      return [star(6, 1, 0.5), circle(0.16, 24)];
    case 'taste':
      return [stadium(1.9, 0.86), stadium(1.1, 0.3)];
    case 'build':
      return [tri(1.05), tri(0.5)];
    case 'ops': {
      const s: V3[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        s.push([-0.62 + t * 1.24, Math.sin((t - 0.5) * Math.PI) * 0.28 - 0.05, 0]);
      }
      return [roundRect(1.5, 1.2, 0.22, 0.18), s];
    }
    case 'cortex': {
      const out: V3[][] = [circle(1), circle(0.26, 32)];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        out.push([
          [Math.sin(a) * 0.3, Math.cos(a) * 0.3, 0],
          [Math.sin(a) * 0.94, Math.cos(a) * 0.94, 0],
        ]);
      }
      return out;
    }
  }
}
