export type SchedulerState = { rafPending: boolean; rafTicks: number; renderActive: boolean };
export type SchedulerOptions = {
  frame: (timestamp: number, dtSeconds: number) => boolean;
  onState?: (state: SchedulerState) => void;
  onError?: (error: unknown) => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
  now?: () => number;
  maxFps?: number;
  maxDelta?: number;
};

/** No timers: one coalesced RAF exists only while explicitly invalidated work remains. */
export function createRenderScheduler(options: SchedulerOptions) {
  const request = options.requestFrame ?? (callback => requestAnimationFrame(callback));
  const cancel = options.cancelFrame ?? (id => cancelAnimationFrame(id));
  const now = options.now ?? (() => performance.now());
  const fps = Number.isFinite(options.maxFps) ? Math.max(1, Math.min(30, options.maxFps!)) : 30;
  const maxDelta = Number.isFinite(options.maxDelta) ? Math.max(0, Math.min(.05, options.maxDelta!)) : .05;
  const interval = 1000 / fps;
  let handle: number | null = null, enabled = false, visible = true, disposed = false, dirty = false, inFrame = false;
  let generation = 0, ticks = 0, nextDeadline: number | null = null, lastUpdate: number | null = null;
  let reported = '';
  const getState = (): SchedulerState => ({ rafPending: handle !== null, rafTicks: ticks,
    renderActive: !disposed && enabled && visible && (dirty || handle !== null || inFrame) });
  const report = () => {
    const state = getState(), key = `${state.rafPending}:${state.rafTicks}:${state.renderActive}`;
    if (key !== reported) { reported = key; options.onState?.(state); }
  };
  const clearPending = (retainDirty: boolean) => {
    generation++; if (handle !== null) cancel(handle); handle = null;
    lastUpdate = null; if (!retainDirty) dirty = false;
  };
  const queue = () => {
    if (!disposed && enabled && visible && dirty && !inFrame && handle === null) {
      if (lastUpdate === null) { const time = now(); lastUpdate = Number.isFinite(time) ? time : 0; }
      const revision = generation; handle = request(timestamp => tick(timestamp, revision));
    }
    report();
  };
  const tick = (timestamp: number, revision: number) => {
    if (revision !== generation || disposed) return;
    handle = null; ticks++;
    if (!enabled || !visible || !dirty) { report(); return; }
    const fallback = now(), time = Number.isFinite(timestamp) ? timestamp : Number.isFinite(fallback) ? fallback : lastUpdate ?? 0;
    if (nextDeadline !== null && time < nextDeadline - 1e-6) { queue(); return; }
    const dt = Math.max(0, Math.min(maxDelta, (time - (lastUpdate ?? time)) / 1000));
    // Keep the absolute quota across rounded RAF timestamps and one-shot/visibility transitions.
    // A late callback consumes one slot; a long stall discards accumulated debt instead of bursting.
    nextDeadline = nextDeadline === null || time - nextDeadline >= interval * 3 ? time + interval : nextDeadline + interval;
    lastUpdate = time; dirty = false; inFrame = true;
    try { dirty = options.frame(time, dt) || dirty; }
    catch (error) { dirty = false; enabled = false; clearPending(false); options.onError?.(error); }
    finally { inFrame = false; }
    if (!dirty) lastUpdate = null;
    queue();
  };
  return {
    invalidate() { if (disposed) return; dirty = true; queue(); },
    setEnabled(value: boolean) { if (disposed || value === enabled) return; enabled = value; if (!value) clearPending(true); queue(); },
    setVisible(value: boolean) { if (disposed || value === visible) return; visible = value; if (!value) clearPending(true); queue(); },
    cancel() { if (disposed) return; clearPending(false); report(); },
    dispose() { if (disposed) return; disposed = true; enabled = false; clearPending(false); report(); },
    getState,
  };
}

/** Epsilon ends normal settling; time and frame ceilings also end a nonconverging tail. */
export function createCameraTail(maxSeconds = .8, epsilonSquared = 1e-4) {
  const seconds = Number.isFinite(maxSeconds) ? Math.max(0, Math.min(2, maxSeconds)) : .8;
  const epsilon = Number.isFinite(epsilonSquared) ? Math.max(0, epsilonSquared) : 1e-4;
  let remaining = 0, frames = 0;
  return {
    reset() { remaining = seconds; frames = Math.ceil(seconds * 30); },
    advance(errorSquared: number, dt: number, reduced: boolean) {
      if (reduced || !Number.isFinite(errorSquared) || errorSquared <= epsilon) { remaining = frames = 0; return false; }
      remaining -= Number.isFinite(dt) ? Math.max(0, dt) : 0; frames--;
      return remaining > 0 && frames > 0;
    },
  };
}
