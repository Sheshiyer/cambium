// Synthesized sound design, frame-locked to the picture via timeline CUES.
// 48 kHz stereo, 800 samples per video frame. No samples, no stock audio:
// sines, filtered noise, a small Schroeder reverb and a soft limiter.
// Output: out/audio.wav (reel) or out/long/audio.wav (--cut long),
// loudness-normalised to -14 LUFS, TP <= -1.5 dBFS.
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { ACTS, BEAT, FPS, type Cue } from '../src/timeline.ts';
import { cutSpec } from '../src/cuts/spec.ts';
import { L_BAR, L_BEAT, bar } from '../src/cuts/long/timeline.ts';
import { mulberry32 } from '../src/lib/rng.ts';

const APP = resolve(import.meta.dir, '..');
const argv = process.argv.slice(2);
const cut = cutSpec(argv.includes('--cut') ? argv[argv.indexOf('--cut') + 1] : undefined);
const CUES = cut.cues;
const OUT = cut.id === 'reel' ? join(APP, 'out') : join(APP, 'out', cut.id);
mkdirSync(OUT, { recursive: true });

const SR = 48000;
const N = (cut.total / FPS) * SR; // 720000 for the reel
const L = new Float32Array(N);
const R = new Float32Array(N);
const sendL = new Float32Array(N); // reverb send
const sendR = new Float32Array(N);
const duck = new Float32Array(N).fill(1); // sidechain gain for the bed
const gate = new Float32Array(N).fill(1); // master gate (reducedMotion dropout)
const rnd = mulberry32(2026);
const TAU = Math.PI * 2;
const sec = (f: number) => f / FPS;
const idx = (t: number) => Math.max(0, Math.min(N, Math.round(t * SR)));
const noteHz = (semisFromA4: number) => 440 * Math.pow(2, semisFromA4 / 12);

function put(i: number, v: number, pan = 0, send = 0) {
  if (i < 0 || i >= N) return;
  const gl = Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = Math.sin(((pan + 1) * Math.PI) / 4);
  L[i] += v * gl;
  R[i] += v * gr;
  if (send) {
    sendL[i] += v * gl * send;
    sendR[i] += v * gr * send;
  }
}

/** RBJ biquad with settable coefficients (for sweeps). */
class Biquad {
  b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0;
  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  set(type: 'lp' | 'hp' | 'bp', f: number, q: number) {
    const w = (TAU * Math.min(f, SR * 0.45)) / SR;
    const cs = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    let b0 = 0, b1 = 0, b2 = 0;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
    if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
    if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = (-2 * cs) / a0; this.a2 = (1 - al) / a0;
    return this;
  }
  run(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const env = (t: number, a: number, d: number) => (t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d));

// ---------------------------------------------------------------- voices

function bell(t0: number, hz: number, amp: number, pan = 0, decay = 0.9, send = 0.5) {
  const parts = [[1, 1], [2.76, 0.32], [5.4, 0.12], [8.93, 0.05]];
  const n = idx(decay * 6);
  const s0 = idx(t0);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    let v = 0;
    for (const [m, a] of parts) v += Math.sin(TAU * hz * m * t) * a * Math.exp(-t / (decay / m ** 0.5));
    put(s0 + k, v * amp * Math.min(1, t / 0.002), pan, send);
  }
}

function kick(t0: number, amp: number, pitch = 1, len = 0.42, send = 0.08) {
  const s0 = idx(t0);
  const n = idx(len * 2.5);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const f = (45 + 140 * Math.exp(-t / 0.035)) * pitch;
    ph += (TAU * f) / SR;
    const body = Math.sin(ph) * Math.exp(-t / len);
    const click = (rnd() * 2 - 1) * Math.exp(-t / 0.004) * 0.35;
    put(s0 + k, (body + click) * amp, 0, send);
  }
  // sidechain the bed under every kick
  for (let k = 0; k < idx(0.35); k++) {
    const i = s0 + k;
    if (i < N) duck[i] = Math.min(duck[i], 1 - 0.65 * Math.exp(-(k / SR) / 0.12));
  }
}

function noiseBurst(t0: number, dur: number, amp: number, type: 'hp' | 'bp' | 'lp', f0: number, f1: number, q: number, shape: (u: number) => number, pan0 = 0, pan1 = 0, send = 0.2) {
  const s0 = idx(t0);
  const n = idx(dur);
  const flt = new Biquad();
  for (let k = 0; k < n; k++) {
    const u = k / n;
    if (k % 32 === 0) flt.set(type, f0 * Math.pow(f1 / f0, u), q);
    const v = flt.run(rnd() * 2 - 1) * shape(u) * amp;
    put(s0 + k, v, pan0 + (pan1 - pan0) * u, send);
  }
}

function tone(t0: number, dur: number, hz0: number, hz1: number, amp: number, a: number, d: number, pan = 0, send = 0.3, wave: 'sin' | 'tri' = 'sin') {
  const s0 = idx(t0);
  const n = idx(dur);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const hz = hz0 * Math.pow(hz1 / hz0, k / n);
    ph += (TAU * hz) / SR;
    const w = wave === 'sin' ? Math.sin(ph) : (2 / Math.PI) * Math.asin(Math.sin(ph));
    const tail = Math.min(1, (n - k) / (SR * 0.01));
    put(s0 + k, w * amp * env(t, a, d) * tail, pan, send);
  }
}

// ---------------------------------------------------------------- bed

// sub drone on A1 with a slow filter LFO; rises through the piece.
// Mixed after the cues so the kick sidechain (duck) is already known.
function drone() {
  const lp = new Biquad();
  let p1 = 0, p2 = 0, p3 = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    if (i % 64 === 0) lp.set('lp', 180 + 220 * (0.5 + 0.5 * Math.sin(TAU * 0.11 * t)) + 300 * Math.min(1, t / 10), 0.8);
    p1 += (TAU * 55) / SR;
    p2 += (TAU * 110.3) / SR;
    p3 += (TAU * 164.8) / SR; // E3: the fifth
    const saw = ((p2 / TAU) % 1) * 2 - 1;
    let v = Math.sin(p1) * 0.55 + lp.run(saw) * 0.22 + Math.sin(p3) * 0.05 * Math.min(1, Math.max(0, (t - 5) / 3));
    const fadeIn = Math.min(1, t / 1.6);
    const resolveLift = t > 12.5 ? 1 - Math.min(1, (t - 12.5) / 0.4) * 0.6 : 1;
    v *= 0.16 * fadeIn * resolveLift;
    L[i] += v * duck[i];
    R[i] += v * duck[i];
  }
}

// heartbeat kick on every beat from the roll-call through motion names
function beds() {
  for (let f = ACTS.rollcall[0]; f < ACTS.vocabulary[1] - 30; f += BEAT) {
    const onCue = CUES.some((c) => c.f === f && (c.kind === 'impact' || c.kind === 'boom'));
    if (!onCue) kick(sec(f), f < ACTS.constellation[0] ? 0.28 : 0.22, 1.05, 0.3);
  }
  // packet bed: 16th-note ticks across the constellation
  for (let f = ACTS.constellation[0]; f < ACTS.constellation[1]; f += BEAT / 4) {
    const off = Math.round((f - ACTS.constellation[0]) / (BEAT / 4)) % 4;
    const v = (off === 2 ? 0.16 : 0.08) * (0.6 + rnd() * 0.4);
    noiseBurst(sec(f), 0.03, v, 'hp', 7000, 9000, 0.7, (u) => Math.exp(-u * 6), off % 2 ? 0.35 : -0.35, off % 2 ? 0.35 : -0.35, 0.05);
  }
}

// ---------------------------------------------------------------- cues

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19]; // A major pentatonic, semitones

function cue(c: Cue) {
  const t = sec(c.f);
  const v = c.v ?? 0.5;
  const p = c.p ?? 0;
  const d = sec(c.d ?? 30);
  switch (c.kind) {
    case 'ping':
      bell(t, p ? noteHz(12 + 7) : noteHz(12), 0.45 * v, 0, 1.1, 0.7);
      tone(t, 0.25, 2200, 1800, 0.05 * v, 0.001, 0.05, 0, 0.2);
      break;
    case 'riser':
      noiseBurst(t, d, 0.32 * v, "bp", 300, 5200, 1.4, (u) => Math.pow(u, 2.2) * (1 - Math.pow(u, 24)), -0.2, 0.2, 0.25);
      tone(t, d, 110, 440, 0.06 * v, d * 0.9, 1, 0, 0.2);
      break;
    case 'tick':
      tone(t, 0.09, noteHz(12 + PENTA[p % PENTA.length]), noteHz(12 + PENTA[p % PENTA.length]) * 0.98, 0.16 * v, 0.001, 0.025, (p % 2 ? 0.4 : -0.4), 0.35);
      break;
    case 'impact':
      kick(t, 0.85 * v, 1 + p * 0.03, 0.42, 0.15);
      noiseBurst(t, 0.22, 0.25 * v, 'hp', 2400, 1200, 0.8, (u) => Math.exp(-u * 7), 0, 0, 0.35);
      bell(t, noteHz(-12 + PENTA[(p * 2) % PENTA.length]), 0.07 * v, 0, 0.5, 0.4);
      break;
    case 'boom':
      kick(t, 0.95 * v, 0.8, 0.9, 0.3);
      tone(t, 1.6, 62, 38, 0.32 * v, 0.004, 0.55, 0, 0.3);
      noiseBurst(t, 0.6, 0.12 * v, 'lp', 900, 200, 0.7, (u) => Math.exp(-u * 4), -0.3, 0.3, 0.5);
      break;
    case 'whoosh':
      noiseBurst(t - d * 0.6, d * 1.2, 0.3 * v, 'bp', 400, 3600, 1.1, (u) => Math.sin(Math.PI * u) ** 2, -0.7, 0.7, 0.3);
      break;
    case 'chime':
      [0, 4, 7, 12].forEach((s, k) => bell(t + k * 0.065, noteHz(12 + s + (p ? 12 : 0)), 0.11 * v, -0.3 + k * 0.2, 0.9, 0.7));
      break;
    case 'warn':
      // soft, never harsh: two triangle tones, no repetition (warningAttention plays once)
      tone(t, 0.18, noteHz(7), noteHz(7), 0.12 * v, 0.006, 0.08, 0.2, 0.4, 'tri');
      tone(t + 0.16, 0.24, noteHz(3), noteHz(3), 0.12 * v, 0.006, 0.1, 0.2, 0.4, 'tri');
      break;
    case 'resolve':
      [4, 7, 12].forEach((s, k) => bell(t + k * 0.07, noteHz(s + 12), 0.1 * v, 0.1, 0.8, 0.6));
      break;
    case 'blip':
      tone(t, 0.12, noteHz(12 + PENTA[p % PENTA.length]), noteHz(12 + PENTA[p % PENTA.length]), 0.13 * v, 0.002, 0.04, -0.4 + (p % 5) * 0.2, 0.35);
      break;
    case 'dropout': {
      const a = idx(t);
      const b = idx(t + d);
      const ramp = idx(0.003);
      for (let i = a - ramp; i < b + ramp; i++) {
        if (i < 0 || i >= N) continue;
        const g = i < a ? (a - i) / ramp : i > b ? (i - b) / ramp : 0;
        gate[i] = Math.min(gate[i], g);
      }
      break;
    }
    case 'flip':
      noiseBurst(t, 0.05, 0.28 * v, 'hp', 3000, 5000, 0.9, (u) => Math.exp(-u * 9), -0.3 + p * 0.3, -0.3 + p * 0.3, 0.2);
      tone(t, 0.02, 1500, 900, 0.06 * v, 0.0005, 0.006, 0, 0);
      break;
    case 'swell':
      noiseBurst(t, d, 0.3 * v, 'hp', 1500, 6000, 0.7, (u) => Math.pow(u, 3.5), 0.5, -0.5, 0.4);
      tone(t, d, 220, 880, 0.04 * v, d * 0.95, 1, 0, 0.3);
      break;
    case 'final': {
      kick(t, 1.0 * v, 0.85, 0.8, 0.35);
      noiseBurst(t, 0.5, 0.2 * v, 'hp', 3000, 1500, 0.8, (u) => Math.exp(-u * 6), 0, 0, 0.5);
      // open A chord: A2 E3 A3 C#4 E4 + shimmer A5 E6
      const chord = [-24, -17, -12, -8, -5];
      const len = sec(cut.total) - t;
      chord.forEach((s, k) => tone(t + k * 0.012, len, noteHz(s), noteHz(s), 0.075 * v, 0.06, 1.6, -0.4 + k * 0.2, 0.55, k < 2 ? 'sin' : 'tri'));
      bell(t + 0.08, noteHz(12), 0.07 * v, -0.3, 1.4, 0.9);
      bell(t + 0.15, noteHz(19), 0.05 * v, 0.3, 1.4, 0.9);
      break;
    }
  }
}


// ---------------------------------------------------------------- long score
// 80 BPM, one chord per two bars following the chapters. Pad = detuned saws
// through a slow lowpass; bass = sine root; heartbeat kick in half-time;
// 8th-note packet ticks and a bell arpeggio through the governed flow.
const CHORDS: Record<string, number[]> = {
  Asus: [-24, -17, -12, -10, -5],
  A: [-24, -17, -12, -8, -5],
  Fsm: [-27, -20, -15, -12, -8],
  D: [-31, -24, -19, -15, -12],
  E: [-29, -22, -17, -13, -10],
  Esus: [-29, -22, -17, -15, -10],
};
// two-bar blocks: ignite, ignite, title, halves, 5 organs, strip, 4 flow, 2 motion, 2 surfaces, 2 resolve
const PROG = ['Asus', 'Asus', 'A', 'Fsm', 'A', 'Fsm', 'D', 'E', 'A', 'Esus', 'D', 'A', 'E', 'Fsm', 'A', 'E', 'Fsm', 'D', 'A', 'A'];
const PAD_LEVEL = [0.05, 0.3, 0.75, 0.6, 0.6, 0.6, 0.65, 0.7, 0.7, 0.6, 0.75, 0.75, 0.8, 0.7, 0.5, 0.5, 0.7, 0.8, 0.3, 0.18];
const BLOCK = 2 * L_BAR;
const inBars = (f: number, a: number, b: number) => f >= bar(a) && f < bar(b);

function longBeds() {
  // half-time heartbeat through organs, flow and surfaces
  for (let f = bar(9); f < bar(37); f += 2 * L_BEAT) {
    if (inBars(f, 29, 33)) continue;
    const onCue = CUES.some((c) => Math.abs(c.f - f) < 3 && (c.kind === 'impact' || c.kind === 'boom'));
    if (!onCue) kick(sec(f), 0.24, 1.0, 0.34);
  }
  // quarter ticks under the organs, 8ths through the flow
  for (let f = bar(9); f < bar(29); f += inBars(f, 21, 29) ? L_BEAT / 2 : L_BEAT) {
    const flow = inBars(f, 21, 29);
    const k = Math.round((f - bar(9)) / (L_BEAT / 2));
    const v = (flow ? (k % 2 ? 0.07 : 0.12) : 0.06) * (0.7 + rnd() * 0.3);
    noiseBurst(sec(f), 0.035, v, 'hp', 7000, 9500, 0.7, (u) => Math.exp(-u * 6), k % 2 ? 0.35 : -0.35, k % 2 ? 0.35 : -0.35, 0.06);
  }
}

function longScore() {
  const lp = new Biquad();
  const pad = new Float32Array(N);
  const padR = new Float32Array(N);
  PROG.forEach((name, b) => {
    const notes = CHORDS[name];
    const s0 = idx(sec(b * BLOCK));
    const len = idx(sec(BLOCK)) + idx(1.6);
    const att = idx(0.9);
    notes.forEach((semi, n) => {
      const hz = noteHz(semi);
      const pan = -0.5 + (n / (notes.length - 1)) * 1.0;
      const gl = Math.cos(((pan + 1) * Math.PI) / 4);
      const gr = Math.sin(((pan + 1) * Math.PI) / 4);
      let p1 = rnd(), p2 = rnd();
      for (let k = 0; k < len; k++) {
        const i = s0 + k;
        if (i >= N) break;
        p1 += (hz * 1.004) / SR;
        p2 += (hz * 0.996) / SR;
        const saw = ((p1 % 1) * 2 - 1 + (p2 % 1) * 2 - 1) * 0.5;
        const body = idx(sec(BLOCK));
        const e = Math.min(1, k / att) * (k < body ? 1 : Math.exp(-(k - body) / (SR * 0.5)));
        const v = saw * e * PAD_LEVEL[b] * 0.05;
        pad[i] += v * gl;
        padR[i] += v * gr;
      }
    });
  });
  // slow lowpass sweep keeps the pad soft and moving
  const lpR = new Biquad();
  for (let i = 0; i < N; i++) {
    if (i % 64 === 0) {
      const t = i / SR;
      const fc = 480 + 320 * (0.5 + 0.5 * Math.sin(TAU * 0.05 * t)) + 260 * Math.min(1, t / 30);
      lp.set('lp', fc, 0.7);
      lpR.set('lp', fc, 0.7);
    }
    const g = duck[i] * 0.6 + 0.4;
    const yl = lp.run(pad[i]);
    const yr = lpR.run(padR[i]);
    L[i] += yl * g;
    R[i] += yr * g;
    sendL[i] += yl * 0.3;
    sendR[i] += yr * 0.3;
  }
  // sub drone + chord-root bass with a soft pluck on each bar
  let ph = 0;
  let pb = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const f = t * FPS;
    const b = Math.min(PROG.length - 1, Math.floor(f / BLOCK));
    const root = CHORDS[PROG[b]][0] - 12;
    ph += (TAU * 55) / SR;
    pb += (TAU * noteHz(root)) / SR;
    const barT = (f % L_BAR) / FPS;
    const pluck = inBars(f, 9, 37) && !inBars(f, 29, 33) ? 0.35 + 0.65 * Math.exp(-barT / 0.9) : f < bar(5) ? 0 : 0.3;
    // the bed grows out of near-silence across the ignition
    const grow = f < bar(5) ? 0.25 + 0.75 * Math.pow(f / bar(5), 2) : 1;
    const fade = Math.min(1, t / 4) * grow * (f > bar(38) ? Math.max(0.25, 1 - (f - bar(38)) / (L_BAR * 2)) : 1);
    const v = (Math.sin(ph) * 0.09 + Math.sin(pb) * 0.13 * pluck) * fade * duck[i];
    L[i] += v;
    R[i] += v;
  }
  // bell arpeggio in 8ths through the flow and the surfaces (packets made audible)
  for (let f = bar(21); f < bar(37); f += L_BEAT / 2) {
    if (inBars(f, 29, 33)) continue;
    const b = Math.floor(f / BLOCK);
    const notes = CHORDS[PROG[b]];
    const k = Math.round((f - bar(21)) / (L_BEAT / 2));
    const seq = [2, 3, 4, 3, 2, 4, 3, 1];
    const semi = notes[seq[k % seq.length]] + 24;
    bell(sec(f), noteHz(semi), 0.028 * (k % 4 === 0 ? 1.3 : 1), k % 2 ? 0.45 : -0.45, 0.35, 0.55);
  }
}

if (cut.id === 'reel') {
  beds();
  for (const c of CUES) cue(c);
  drone();
} else {
  longBeds();
  for (const c of CUES) cue(c);
  longScore();
}

// ---------------------------------------------------------------- reverb
function schroeder(inp: Float32Array, seed: number) {
  const out = new Float32Array(N);
  const combs = [1557, 1617, 1491, 1422].map((n) => Math.round(((n + seed) * SR) / 44100));
  const fb = 0.83;
  for (const len of combs) {
    const buf = new Float32Array(len);
    let p = 0;
    let lpS = 0;
    for (let i = 0; i < N; i++) {
      const y = buf[p];
      lpS = y * 0.7 + lpS * 0.3; // damping
      buf[p] = inp[i] + lpS * fb;
      p = (p + 1) % len;
      out[i] += y * 0.25;
    }
  }
  for (const len of [225, 556].map((n) => Math.round(((n + seed) * SR) / 44100))) {
    const buf = new Float32Array(len);
    let p = 0;
    for (let i = 0; i < N; i++) {
      const b = buf[p];
      const y = -out[i] * 0.5 + b;
      buf[p] = out[i] + b * 0.5;
      out[i] = y;
      p = (p + 1) % len;
    }
  }
  return out;
}
const revL = schroeder(sendL, 0);
const revR = schroeder(sendR, 23);
for (let i = 0; i < N; i++) {
  L[i] = (L[i] + revL[i] * 0.42) * gate[i];
  R[i] = (R[i] + revR[i] * 0.42) * gate[i];
}
// remove DC, short fade at the head and tail so the reel loops clean
{
  let ml = 0, mr = 0;
  for (let i = 0; i < N; i++) { ml += L[i]; mr += R[i]; }
  ml /= N; mr /= N;
  const fi = idx(0.005);
  const fo = idx(0.12);
  for (let i = 0; i < N; i++) {
    const g = Math.min(1, i / fi, (N - 1 - i) / fo);
    L[i] = (L[i] - ml) * g;
    R[i] = (R[i] - mr) * g;
  }
}

// ---------------------------------------------------------------- loudness
function writeWav(path: string, l: Float32Array, r: Float32Array) {
  const bytes = 3;
  const data = new Uint8Array(N * 2 * bytes);
  let o = 0;
  for (let i = 0; i < N; i++) {
    for (const s of [l[i], r[i]]) {
      const v = Math.max(-8388608, Math.min(8388607, Math.round(s * 8388607)));
      data[o++] = v & 255;
      data[o++] = (v >> 8) & 255;
      data[o++] = (v >> 16) & 255;
    }
  }
  const h = new DataView(new ArrayBuffer(44));
  const w = (o2: number, s: string) => [...s].forEach((c, k) => h.setUint8(o2 + k, c.charCodeAt(0)));
  w(0, 'RIFF'); h.setUint32(4, 36 + data.length, true); w(8, 'WAVE');
  w(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 2, true);
  h.setUint32(24, SR, true); h.setUint32(28, SR * 2 * bytes, true); h.setUint16(32, 2 * bytes, true); h.setUint16(34, 8 * bytes, true);
  w(36, 'data'); h.setUint32(40, data.length, true);
  return Bun.write(path, new Blob([h.buffer, data]));
}

async function measure(path: string) {
  const p = Bun.spawn(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { stderr: 'pipe' });
  const txt = await new Response(p.stderr).text();
  await p.exited;
  const I = Number(txt.match(/I:\s+(-?[\d.]+) LUFS/g)?.pop()?.match(/-?[\d.]+/)?.[0]);
  const TP = Number(txt.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.pop()?.match(/-?[\d.]+/)?.[0]);
  return { I, TP };
}

mkdirSync(OUT, { recursive: true });
const tmp = join(OUT, 'audio-raw.wav');
// pre-normalise peak so the measurement is sane
let pk = 0;
for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
for (let i = 0; i < N; i++) { L[i] /= pk * 2; R[i] /= pk * 2; }
await writeWav(tmp, L, R);
const m0 = await measure(tmp);
const TARGET = -14;
// sample ceiling; leaves headroom for inter-sample peaks (the long score's bells need more)
const CEIL = Math.pow(10, (cut.id === 'reel' ? -2.6 : -3.6) / 20);
let gain = Math.pow(10, (TARGET - m0.I) / 20);
// two passes: the limiter shaves a little loudness, so re-aim once
for (let pass = 0; pass < 2; pass++) {
  const ol = new Float32Array(N);
  const or = new Float32Array(N);
  // soft-knee limiter with 1 ms attack / 80 ms release on the stereo max
  let g = 1;
  const att = Math.exp(-1 / (0.001 * SR));
  const rel = Math.exp(-1 / (0.08 * SR));
  const look = idx(0.0015);
  for (let i = 0; i < N; i++) {
    const j = Math.min(N - 1, i + look);
    const peak = Math.max(Math.abs(L[j]), Math.abs(R[j])) * gain;
    const want = peak > CEIL ? CEIL / peak : 1;
    g = want < g ? att * g + (1 - att) * want : rel * g + (1 - rel) * want;
    ol[i] = Math.max(-CEIL, Math.min(CEIL, L[i] * gain * g));
    or[i] = Math.max(-CEIL, Math.min(CEIL, R[i] * gain * g));
  }
  const outPath = join(OUT, 'audio.wav');
  await writeWav(outPath, ol, or);
  const m = await measure(outPath);
  console.log(`pass ${pass + 1}: integrated ${m.I.toFixed(1)} LUFS · true peak ${m.TP.toFixed(1)} dBFS`);
  if (Math.abs(m.I - TARGET) < 0.6) break;
  gain *= Math.pow(10, (TARGET - m.I) / 20);
}
console.log(`audio: ${join(OUT, 'audio.wav').slice(APP.length + 1)} (${(N / SR).toFixed(3)} s, ${SR} Hz stereo, 24-bit)`);
