// Easing + time helpers. All animation is a pure function of the frame number.

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Normalised progress of frame f through [a, b). */
export const range = (f: number, a: number, b: number) => clamp01((f - a) / (b - a));

/** CSS-style cubic-bezier(x1, y1, x2, y2) solved for y(x). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      const d = dx(t);
      if (Math.abs(e) < 1e-6) break;
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    // bisection fallback keeps the solve monotonic
    let lo = 0;
    let hi = 1;
    if (Math.abs(sx(t) - x) > 1e-4) {
      t = x;
      for (let i = 0; i < 30; i++) {
        if (sx(t) < x) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return sy(t);
  };
}

/** Cambium `--ease`: cubic-bezier(.16,1,.3,1) (workers/quests tokens.ts:23) */
export const ease = cubicBezier(0.16, 1, 0.3, 1);
/** Cambium `--pop`: cubic-bezier(.34,1.56,.64,1) */
export const pop = cubicBezier(0.34, 1.56, 0.64, 1);
export const inOut = cubicBezier(0.65, 0, 0.35, 1);
export const easeIn = cubicBezier(0.55, 0, 0.9, 0.35);
export const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const expoIn = (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));

/** Eased progress helper: e(f, a, b, curve). */
export const e = (f: number, a: number, b: number, curve: (t: number) => number = ease) => curve(range(f, a, b));

/** Analytic damped spring from 0 -> 1 (no integration, frame-exact). */
export function spring(t: number, freq = 2.2, damping = 0.42) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  const z = damping;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

/** Triangle-free pulse: 0 -> 1 -> 0 over [a, b]. */
export const bump = (f: number, a: number, b: number) => {
  const t = range(f, a, b);
  return Math.sin(t * Math.PI);
};
