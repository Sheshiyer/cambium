import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderScheduler, createCameraTail } from './render-scheduler.ts';

function fakeFrames() {
  let clock = 0, id = 0;
  const pending = new Map<number, FrameRequestCallback>();
  return {
    pending, now: () => clock,
    requestFrame(callback: FrameRequestCallback) { pending.set(++id, callback); return id; },
    cancelFrame(handle: number) { pending.delete(handle); },
    setClock(time: number) { clock = time; },
    at(time: number) {
      assert.ok(pending.size <= 1, 'duplicate pending RAF'); clock = time;
      const next = pending.entries().next().value; assert.ok(next, `no work pending at ${time}`);
      pending.delete(next[0]); next[1](time);
    },
  };
}
function assertRateBudget(timestamps: readonly number[]) {
  for (let first = 0; first < timestamps.length; first++) for (let last = first; last < timestamps.length; last++) {
    const elapsed = timestamps[last] - timestamps[first];
    assert.ok(last - first + 1 <= Math.ceil(elapsed * 30 / 1000 - 1e-9) + 1,
      `draw quota exceeded: ${last - first + 1} frames / ${elapsed}ms`);
  }
}

test('idle and disabled scheduler have no RAF; repeated invalidations coalesce and end with a final idle notification', () => {
  const fake = fakeFrames(), states: Array<{ rafPending: boolean; renderActive: boolean }> = []; let calls = 0;
  const scheduler = createRenderScheduler({ ...fake, frame: () => { calls++; return false; }, onState: state => states.push(state) });
  assert.equal(fake.pending.size, 0); scheduler.invalidate(); scheduler.invalidate(); assert.equal(fake.pending.size, 0);
  scheduler.setEnabled(true); for (let i = 0; i < 30; i++) scheduler.invalidate();
  assert.equal(fake.pending.size, 1); fake.at(16); assert.equal(calls, 1); assert.equal(fake.pending.size, 0);
  assert.deepEqual(scheduler.getState(), { rafPending: false, rafTicks: 1, renderActive: false });
  assert.equal(states.at(-1)!.renderActive, false); assert.equal(states.at(-1)!.rafPending, false);
});

test('invalidation from inside an executing frame is retained without creating duplicate callbacks', () => {
  const fake = fakeFrames(); let calls = 0;
  const scheduler = createRenderScheduler({ ...fake, frame: () => {
    calls++; if (calls === 1) { scheduler.invalidate(); scheduler.invalidate(); } return false;
  } });
  scheduler.setEnabled(true); scheduler.invalidate(); fake.at(16); assert.equal(fake.pending.size, 1);
  fake.at(32); assert.equal(calls, 1); fake.at(50); assert.equal(calls, 2); assert.equal(fake.pending.size, 0);
});

test('actual frame work respects the 30fps timestamp budget and clamps elapsed time after stalls', () => {
  const fake = fakeFrames(), timestamps: number[] = [], deltas: number[] = [];
  const scheduler = createRenderScheduler({ ...fake, frame: (time, dt) => { timestamps.push(time); deltas.push(dt); return true; } });
  scheduler.setEnabled(true); scheduler.invalidate();
  for (let i = 0; i <= 60; i++) fake.at(i * 1000 / 60);
  assertRateBudget(timestamps);
  assert.ok(timestamps.length <= 31); assert.ok(scheduler.getState().rafTicks > timestamps.length);
  fake.at(6000); assert.equal(deltas.at(-1), .05); assert.ok(deltas.every(dt => dt >= 0 && dt <= .05));
  scheduler.cancel(); assert.equal(fake.pending.size, 0);
});
test('bursts of one-shot pointer work retain cadence across idle and stop/enable transitions', () => {
  for (const toggle of [false, true]) {
    const fake = fakeFrames(), timestamps: number[] = [];
    const scheduler = createRenderScheduler({ ...fake, frame: time => { timestamps.push(time); return false; } });
    scheduler.setEnabled(true);
    for (let i = 0; i <= 60; i++) {
      if (toggle) { scheduler.cancel(); scheduler.setEnabled(false); scheduler.setEnabled(true); }
      scheduler.invalidate(); fake.at(i * 1000 / 60);
    }
    assertRateBudget(timestamps);
    assert.ok(timestamps.length <= 31);
    scheduler.dispose(); assert.equal(fake.pending.size, 0);
  }
});
test('paused static resize/design/focus invalidations share one paced authority and never create an idle loop', () => {
  const fake = fakeFrames(), draws: number[] = [];
  const scheduler = createRenderScheduler({ ...fake, frame: time => { draws.push(time); return false; } });
  scheduler.setEnabled(true);
  for (let i = 0; i <= 60; i++) {
    scheduler.invalidate(); // resize
    scheduler.invalidate(); // cosmetic character change
    scheduler.invalidate(); // focus redraw
    fake.at(i * 1000 / 60);
  }
  assert.ok(draws.length <= 31);
  assertRateBudget(draws);
  assert.equal(fake.pending.size, 0); assert.equal(scheduler.getState().renderActive, false);
});
test('rounded 60Hz timestamps retain nominal 30fps, while long stalls produce no catch-up burst', () => {
  for (const burst of [false, true]) {
    const fake = fakeFrames(), draws: number[] = [];
    const scheduler = createRenderScheduler({ ...fake, frame: time => { draws.push(time); return !burst; } });
    scheduler.setEnabled(true); scheduler.invalidate();
    for (let i = 0; i <= 60; i++) {
      if (burst) { scheduler.cancel(); scheduler.setEnabled(false); scheduler.setEnabled(true); scheduler.invalidate(); }
      fake.at(Math.round(i * 1000 / 60 * 10) / 10);
    }
    assert.ok(draws.length >= 29 && draws.length <= 31, `${draws.length} rounded-timestamp frames`); assertRateBudget(draws);
    if (burst) scheduler.invalidate(); fake.at(6000); const count = draws.length;
    scheduler.invalidate(); fake.at(6016.7); assert.equal(draws.length, count);
    fake.at(6033.3); assert.equal(draws.length, count); fake.at(6050); assert.equal(draws.length, count + 1);
    scheduler.dispose(); assert.equal(fake.pending.size, 0);
  }
});

test('hidden work cancels promptly, ignores stale callbacks, and resumes without hidden-time catchup', () => {
  const fake = fakeFrames(), deltas: number[] = [];
  const scheduler = createRenderScheduler({ ...fake, frame: (_, dt) => { deltas.push(dt); return false; } });
  scheduler.setEnabled(true); scheduler.invalidate(); const stale = [...fake.pending.values()][0];
  scheduler.setVisible(false); assert.equal(fake.pending.size, 0); assert.equal(scheduler.getState().renderActive, false);
  scheduler.invalidate(); stale(5000); assert.equal(deltas.length, 0); assert.equal(scheduler.getState().rafTicks, 0);
  fake.setClock(5000); scheduler.setVisible(true); assert.equal(fake.pending.size, 1); fake.at(5016);
  assert.ok(deltas[0] <= .0161); assert.equal(fake.pending.size, 0);
});

test('modal/stop cancellation and disposal prevent callbacks and subsequent wake attempts', () => {
  const fake = fakeFrames(); let calls = 0;
  const scheduler = createRenderScheduler({ ...fake, frame: () => { calls++; return true; } });
  scheduler.setEnabled(true); scheduler.invalidate(); scheduler.setEnabled(false);
  assert.equal(fake.pending.size, 0); scheduler.invalidate(); assert.equal(fake.pending.size, 0);
  scheduler.setEnabled(true); fake.at(16); assert.equal(calls, 1);
  scheduler.cancel(); scheduler.cancel(); assert.equal(fake.pending.size, 0);
  scheduler.invalidate(); const stale = [...fake.pending.values()][0]; scheduler.dispose(); scheduler.dispose();
  stale(50); scheduler.invalidate(); scheduler.setEnabled(true); scheduler.setVisible(true);
  assert.equal(calls, 1); assert.equal(fake.pending.size, 0); assert.equal(scheduler.getState().renderActive, false);
});

test('frame errors stop the loop, report once, and leave no pending resources', () => {
  const fake = fakeFrames(); let errors = 0;
  const scheduler = createRenderScheduler({ ...fake, frame: () => { throw new Error('synthetic frame failure'); }, onError: () => errors++ });
  scheduler.setEnabled(true); scheduler.invalidate(); fake.at(16);
  assert.equal(errors, 1); assert.equal(fake.pending.size, 0); assert.equal(scheduler.getState().renderActive, false);
});

test('camera tail finishes even for a nonconverging error or zero-delta clock, and stops immediately for reduced motion', () => {
  const tail = createCameraTail(); assert.equal(tail.advance(1, .033, false), false);
  tail.reset(); let count = 0; while (tail.advance(1, 0, false) && count < 100) count++;
  assert.ok(count > 0 && count < 30);
  tail.reset(); assert.equal(tail.advance(1e-5, .033, false), false);
  tail.reset(); assert.equal(tail.advance(1, .033, true), false);
  tail.reset(); assert.equal(tail.advance(NaN, .033, false), false);
});
