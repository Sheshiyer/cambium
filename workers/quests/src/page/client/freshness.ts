// cambium-quests · miniapp page chunk — freshness chip + freshness sheet
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const CLIENT_FRESHNESS = `/* ── freshness ── */
function markFreshnessChip(source){
  const f = $('fresh');
  f.dataset.interactionKind = 'sheet';
  f.dataset.source = source || 'missing';
}
function freshness(env){
  const f = $('fresh');
  const iso = env && env.derivedAt;
  const mins = minutesSince(iso);
  const stale = mins === null || mins > 360;
  const source = (env && env.source) || 'missing';
  FRESHNESS_STATE = {
    derivedAt: iso || 'missing',
    source,
    age: mins,
    stale,
    detail: mins === null ? 'no freshness' : stale ? 'stale ' + Math.round(mins / 60) + 'h' : mins < 2 ? 'fresh now' : mins < 60 ? 'fresh ' + mins + 'm' : 'fresh ' + Math.round(mins / 60) + 'h',
  };
  f.textContent = FRESHNESS_STATE.detail;
  markFreshnessChip(source);
  f.classList.toggle('stale', stale);
}
function envelopeTime(env){
  const value = env && env.derivedAt;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}
function shouldPaintEnvelope(nextEnv){
  const currentTime = envelopeTime(ECOSYSTEM_ENV);
  const nextTime = envelopeTime(nextEnv);
  return currentTime === null || nextTime === null || nextTime >= currentTime;
}
function markStaleRefreshIgnored(nextEnv){
  const current = ECOSYSTEM_ENV || {};
  const f = $('fresh');
  FRESHNESS_STATE = {
    derivedAt: current.derivedAt || 'missing',
    source: (nextEnv && nextEnv.source) || (current && current.source) || REFRESH_ROUTE,
    age: minutesSince(current.derivedAt),
    stale: true,
    detail: 'stale · refresh skipped',
  };
  f.textContent = FRESHNESS_STATE.detail;
  markFreshnessChip(FRESHNESS_STATE.source);
  f.classList.add('stale');
}
function openFreshnessSheet(){
  const s = FRESHNESS_STATE;
  $('sheetBody').innerHTML = '<div class="arc">freshness · ' + (s.stale ? 'stale' : 'fresh') + '</div><h2>Freshness</h2>' +
    '<div class="nar">' + (s.stale ? 'stale data is not live proof' : 'fresh envelope data can support the current read-only view') + '</div>' +
    '<div class="kv"><b>derivedAt</b><span>' + esc(s.derivedAt) + '</span><b>source</b><span>' + esc(s.source) + '</span><b>stale threshold</b><span>360 minutes</span><b>refresh command</b><span>quine write quests push --tenant cambium</span><b>pull refresh</b><span>re-fetches ' + esc(REFRESH_ROUTE) + ' and does not write operator state</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
$('fresh').onclick = openFreshnessSheet;

`;
