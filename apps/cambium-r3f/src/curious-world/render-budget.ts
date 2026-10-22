export type RenderBudget = { width: number; height: number; pixelRatio: number; backbufferPixels: number };
/** CSS dimensions stay separate from the bounded physical framebuffer; oversized displays may use sub-1 DPR. */
export function calculateRenderBudget(width: number, height: number, devicePixelRatio: number, mobile: boolean): RenderBudget {
  const dimension = (value: number) => Number.isFinite(value) ? Math.max(1, Math.min(1_000_000, Math.floor(value))) : 1;
  const w = dimension(width), h = dimension(height), pixels = mobile ? 1_000_000 : 2_000_000;
  const requested = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? Math.max(.5, devicePixelRatio) : 1;
  const ratio = Math.max(1 / Math.min(w, h), Math.min(requested, mobile ? 1.2 : 1.5, Math.sqrt(pixels / (w * h))));
  return { width: w, height: h, pixelRatio: ratio,
    backbufferPixels: Math.floor(w * ratio) * Math.floor(h * ratio) };
}
