// Boot: fonts -> assets -> acts -> shot table. Render mode pushes frames to the
// local sink; dev mode gives a scrubber + realtime play for the Browser pane.
import { Engine } from './engine.ts';
import { loadFonts } from './lib/text.ts';
import { GENESIS_GLB, loadImages } from './assets.ts';
import { loadIsland } from './layers/islands.ts';
import { buildCut } from './cuts/compose.ts';

const params = new URLSearchParams(location.search);
const renderMode = params.has('render');
const scale = Number(params.get('scale') ?? (renderMode ? 1 : 0.5));
const cutId = params.get('cut') ?? 'reel';

async function post(path: string, body: BodyInit) {
  await fetch(path, { method: 'POST', body });
}

function log(msg: string) {
  if (renderMode) void post('/log', msg);
  else console.log(msg);
}

async function boot() {
  const t0 = performance.now();
  const mark = (what: string) => log(`boot ${what}: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  await loadFonts();
  const canvas = document.getElementById('reel') as HTMLCanvasElement;
  const engine = new Engine(canvas, scale);
  const ctx = engine.ctx;
  ctx.tex = await loadImages();
  const island = await loadIsland(GENESIS_GLB);
  // opaque island sorted into the transparent pass so renderOrder can layer it
  island.traverse((o: any) => {
    if (o.isMesh) {
      o.material.transparent = true;
      o.renderOrder = 4;
    }
  });
  ctx.assets.island = island;
  mark('assets');

  const comp = await buildCut(cutId, ctx);
  const { acts, shots, spec } = comp;
  mark('compose');
  // point sprites are sized in UI px; scale them with the output resolution
  for (const a of acts) {
    for (const sc of [a.scene, a.ui]) {
      sc.traverse((o: any) => {
        const u = o.material?.uniforms;
        if (u?.uPixel) u.uPixel.value = scale;
      });
    }
  }

  engine.shots = shots;
  engine.transitions = comp.transitions;
  engine.impacts = spec.impacts;
  if (spec.grain !== undefined) engine.grain = spec.grain;
  for (const o of comp.overlays) o.init?.(ctx);
  engine.overlays = comp.overlays;

  // warm-up: compile every program and upload every texture before frame 0
  for (const s of shots) {
    s.act.update(s.start, s.variant);
    engine.renderer.compile(s.act.scene, s.act.camera);
    engine.renderer.compile(s.act.ui, ctx.uiCam);
  }
  engine.render(0);
  mark('warm-up');

  (window as any).__reel = { engine, spec, ready: true };

  if (renderMode) {
    const st = engine.selfTest();
    log(`gpu: ${st.renderer} · readback mismatches: ${st.bad}`);
    if (st.bad > 0) throw new Error(`readPixels self-test failed (${st.bad} pixels perturbed) — disable shields for 127.0.0.1 or set REEL_BROWSER to plain Chromium`);
    const list: number[] = await (await fetch('/frames')).json();
    for (const f of list) {
      engine.render(f);
      const px = engine.read();
      await fetch(`/frame?f=${f}`, { method: "POST", body: px as unknown as BodyInit });
    }
    await post('/done', 'ok');
    return;
  }

  // ---------------------------------------------------------------- dev mode
  document.body.classList.add('dev');
  const scrub = document.getElementById('scrub') as HTMLInputElement;
  const status = document.getElementById('status')!;
  const play = document.getElementById('play') as HTMLButtonElement;
  let f = Number(params.get('f') ?? 0);
  let playing = false;
  let last = 0;
  scrub.max = String(spec.total - 1);
  const show = () => {
    engine.render(f);
    scrub.value = String(f);
    status.textContent = `f ${f} · ${(f / 60).toFixed(2)}s`;
  };
  scrub.oninput = () => {
    f = Number(scrub.value);
    show();
  };
  play.onclick = () => {
    playing = !playing;
    play.textContent = playing ? 'pause' : 'play';
    last = performance.now();
  };
  const tick = (now: number) => {
    if (playing) {
      const adv = Math.floor((now - last) / (1000 / 60));
      if (adv > 0) {
        f = (f + adv) % spec.total;
        last += adv * (1000 / 60);
        show();
      }
    }
    requestAnimationFrame(tick);
  };
  show();
  requestAnimationFrame(tick);
}

boot().catch((e) => {
  const msg = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  console.error(msg);
  if (renderMode) void post('/error', msg);
});
