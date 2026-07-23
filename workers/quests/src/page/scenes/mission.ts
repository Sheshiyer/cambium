// cambium-quests · miniapp page chunk — Mission scene: quest rendering + count-up numerals
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const SCENE_MISSION = `/* ── quest scene + count-up ── */
function countUp(node, to, suffix){
  if (RM){ node.textContent = to + suffix; return; }
  const dur = 900, t0 = performance.now();
  (function tick(t){ const p = Math.min(1, (t-t0)/dur), e = 1-Math.pow(1-p,3);
    node.textContent = Math.round(to*e) + suffix;
    if (p < 1) requestAnimationFrame(tick); })(t0);
}
function resetQuestSummary(text, frontier){
  const prog = $('progress');
  const here = $('here');
  prog.textContent = text;
  here.textContent = frontier;
  prog.onclick = null;
  here.onclick = null;
  delete prog.dataset.interactionKind;
  delete prog.dataset.source;
  delete here.dataset.interactionKind;
  delete here.dataset.source;
}
function renderQuests(L){
  const stem = $('stem');
  stem.classList.remove('mission-control');
  stem.innerHTML = L.rows.map((r, i) =>
    '<div class="q ' + r.status + '" style="--i:' + i + '" data-i="' + i + '" data-ecosystem-target="quine" data-interaction-kind="sheet" data-source="' + esc(questSource(r)) + '">' +
      '<div class="node">' + MARKS[r.status] + '</div>' +
      '<div><span class="arc">' + esc(r.arc) + '</span><span class="t">' + esc(r.title) + '</span>' +
      '<div class="ev">' + esc(r.evidence) + '</div></div>' +
    '</div>').join('');
  stem.querySelectorAll('.q').forEach(el => el.onclick = () => openSheet(L.rows[+el.dataset.i]));
  const pct = Math.round(100 * L.completed / L.total);
  requestAnimationFrame(() => { stem.style.setProperty('--grow', pct + '%'); $('fill').style.width = pct + '%'; });
  const prog = $('progress'); prog.innerHTML = '<span id="cu">0</span>/' + L.total + ' quests';
  prog.dataset.interactionKind = 'sheet';
  prog.dataset.source = questSource({});
  prog.onclick = () => openProgressSheet(L);
  countUp($('cu'), L.completed, '');
  const here = $('here');
  here.dataset.interactionKind = 'sheet';
  here.dataset.source = questSource({});
  here.onclick = () => openFrontierSheet(L);
  if (L.current) here.textContent = 'here → ' + L.current.arc + ' · ' + L.current.title;
  else here.textContent = 'frontier clear';
}

`;
