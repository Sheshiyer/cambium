// cambium-quests · miniapp page chunk — pointer drag (axis-locked, momentum, rubber-band) + pull-to-refresh
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const CLIENT_GESTURES = `window.addEventListener('resize', () => place(-scene * W(), false));

// pointer drag: one handler set, decides axis on first move.
let drag = null;
track.addEventListener('pointerdown', e => {
  if (sheetState.open) return;
  if (isInteractiveSceneTarget(e.target)) return;
  drag = { sx:e.clientX, sy:e.clientY, base:-scene*W(), axis:null, lx:e.clientX, lt:e.timeStamp, v:0,
           scn: track.children[scene], ptr:false };
});
track.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (!drag.axis){
    if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
    if (Math.abs(dx) > Math.abs(dy)){ drag.axis = 'x'; try{ track.setPointerCapture(e.pointerId); }catch(_){} }
    else { drag.axis = 'y';
      // pull-to-refresh only at the very top, pulling down
      if (dy > 0 && drag.scn && drag.scn.scrollTop <= 0){ drag.ptr = true; try{ track.setPointerCapture(e.pointerId); }catch(_){} }
    }
  }
  if (drag.axis === 'x'){
    e.preventDefault();
    let x = drag.base + dx, min = -(SCN-1)*W(), max = 0;
    if (x > max) x = max + (x-max)*0.35;
    if (x < min) x = min + (x-min)*0.35;
    place(x, false); liveInd(x);
    drag.v = (e.clientX - drag.lx) / Math.max(1, e.timeStamp - drag.lt);
    drag.lx = e.clientX; drag.lt = e.timeStamp;
  } else if (drag.ptr){
    e.preventDefault();
    const pull = Math.min(90, dy * 0.5);
    const p = $('ptr');
    p.classList.add('show');
    p.style.transition = 'none';
    p.style.transform = 'translate(-50%,' + (pull - 30) + 'px) scale(' + (0.4 + pull/130) + ')';
    p.style.opacity = Math.min(1, dy/110);
    drag.pull = dy;
  }
});
function endDrag(e){
  if (!drag) return;
  const d = drag; drag = null;
  if (d.axis === 'x'){
    const dx = (e ? e.clientX : d.lx) - d.sx;
    let t = scene;
    if (d.v < -0.45 || dx < -W()*0.28) t = scene + 1;
    else if (d.v > 0.45 || dx > W()*0.28) t = scene - 1;
    if (t !== scene && t >= 0 && t < SCN) buzz('light');
    go(t, true);
  } else if (d.ptr){
    const p = $('ptr');
    p.style.transition = 'transform .4s var(--ease),opacity .3s var(--ease)';
    if (d.pull > 70){ p.classList.add('spin'); buzz('medium');
      p.style.transform = 'translate(-50%,8px) scale(1)';
      refresh().finally(() => { p.classList.remove('spin','show'); p.style.opacity=0;
        p.style.transform='translate(-50%,-30px) scale(.4)'; });
    } else { p.classList.remove('show'); p.style.opacity=0; p.style.transform='translate(-50%,-30px) scale(.4)'; }
  }
}
track.addEventListener('pointerup', endDrag);
track.addEventListener('pointercancel', endDrag);

`;
