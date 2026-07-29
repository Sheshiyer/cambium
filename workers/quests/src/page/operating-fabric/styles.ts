// cambium-quests · operating fabric shell styles (Task 6 additive bundle).
// Scoped to #operating-fabric: hidden shell stays out of layout, scene tabs
// ride the shared tokens, and reduced motion collapses shell transitions.
// Task 7 additive: shared visual grammar component styles (badges, cards,
// chips, gaps, edges, states) reuse the same tokens and motion contracts.
export const OPERATING_FABRIC_STYLES = `<style>
#operating-fabric{display:none}
#operating-fabric.of-on{display:block}
#operating-fabric{position:relative;min-height:100dvh;color:var(--ink);padding-top:env(safe-area-inset-top,0);padding-bottom:env(safe-area-inset-bottom,0);box-sizing:border-box}
.of-nav{display:flex;gap:.5rem;overflow-x:auto;padding:.75rem max(1rem,env(safe-area-inset-right,0)) .75rem max(1rem,env(safe-area-inset-left,0))}
.of-tab{flex:1;min-width:44px;min-height:44px;box-sizing:border-box;border:1px solid rgba(214,255,246,.16);background:transparent;color:inherit;border-radius:.75rem;padding:.6rem .75rem;font:inherit;text-align:left;cursor:pointer}
.of-tab-label{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.of-tab[aria-selected="true"]{background:var(--ink);color:var(--bg)}
.of-tab small{display:block;opacity:.72}
.of-scene{padding:1rem;max-width:100%;overflow-x:hidden}
.of-scene[hidden]{display:none}
.of-control{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;box-sizing:border-box;padding:.5rem .75rem;border:1px solid rgba(214,255,246,.16);background:transparent;color:inherit;border-radius:.75rem;font:inherit;cursor:pointer}
.of-flow{max-width:100%;overflow-x:auto}
.of-flow-graph{border-collapse:collapse}
.of-flow-list{display:flex;flex-direction:column;gap:.5rem;list-style:none;margin:0;padding:0}
.of-flow-item{display:flex;flex-wrap:wrap;gap:.375rem;padding:.5rem .625rem;border:1px solid var(--line);border-radius:var(--mc-radius-compact)}
/* Task 7 · operating fabric visual grammar */
.of-badge{display:inline-flex;align-items:center;gap:.375rem;padding:.375rem .625rem;border:1px solid var(--line2);border-radius:999px;font:11px/1 var(--mono);color:var(--soft)}
.of-badge-label{font-weight:650}
.of-badge-meta{opacity:.66}
.of-badge-freshness.is-fresh{border-color:rgba(224,255,79,.32);color:var(--ink)}
.of-badge-freshness.is-stale{border-color:var(--warn);color:var(--warn)}
.of-badge-freshness.is-unknown{border-style:dashed;opacity:.72}
.of-card{display:grid;gap:.75rem;padding:1rem;border:1px solid var(--line);border-radius:var(--mc-radius);background:var(--glass);min-width:0}
.of-card-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
.of-card-title{margin:0;font-size:13px;font-weight:750;color:var(--soft)}
.of-card-body{display:grid;gap:.625rem}
.of-card-facts{display:grid;gap:.375rem;margin:0}
.of-fact{display:flex;justify-content:space-between;gap:.75rem;font:12px/1.4 var(--mono)}
.of-fact dt{color:var(--soft);opacity:.62}
.of-fact dd{margin:0;color:var(--soft);text-align:right}
.of-card-badges{display:flex;flex-wrap:wrap;gap:.375rem}
.of-card-note{margin:0;font:10.5px/1.35 var(--mono);color:var(--soft);opacity:.55}
.of-card-gap{margin:0;padding:.5rem .625rem;border:1px dashed var(--warn);border-radius:var(--mc-radius-compact);color:var(--warn);font:11px/1.35 var(--mono)}
.of-chip-row{display:flex;flex-wrap:wrap;gap:.375rem}
.of-chip{display:inline-flex;align-items:center;padding:.375rem .625rem;border:1px solid var(--line2);border-radius:999px;font:11px/1 var(--mono);color:var(--soft)}
.of-chip-more{border-style:dashed;opacity:.72}
.of-gap{display:grid;gap:.375rem;padding:.75rem;border:1px dashed var(--warn);border-radius:var(--mc-radius-compact);color:var(--warn);font:11px/1.4 var(--mono)}
.of-gap-kind{font-weight:650}
.of-gap-subject{opacity:.72}
.of-gap-detail{margin:0;color:var(--soft)}
.of-edge{display:inline-flex;align-items:center;gap:.375rem;padding:.375rem .625rem;border:1px solid var(--line);border-radius:var(--mc-radius-compact);font:11px/1 var(--mono);color:var(--soft)}
.of-edge-kind{color:var(--ink)}
.of-state{display:grid;place-items:center;gap:.375rem;min-height:120px;padding:1rem;border:1px solid var(--line);border-radius:var(--mc-radius);text-align:center;font:12px/1.4 var(--mono)}
.of-state-title{font-weight:750;text-transform:uppercase;letter-spacing:.04em}
.of-state-detail{margin:0;opacity:.66}
.of-state-loading{color:var(--soft)}
.of-state-empty{color:var(--soft);opacity:.72}
.of-state-stale{border-color:var(--warn);color:var(--warn)}
.of-state-unauthorized{border-color:var(--warn);color:var(--warn);border-style:dashed}
.of-state-error{border-color:var(--warn);color:var(--warn);background:var(--mc-warning-fill)}
.of-portfolio-canopy{display:grid;gap:.75rem}
.of-portfolio-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.375rem}
.of-portfolio-count{display:grid;gap:.2rem;min-width:0;padding:.55rem;border:1px solid var(--line2);border-radius:var(--mc-radius-compact);color:var(--soft);font:10px/1.25 var(--mono)}
.of-portfolio-count strong{font-size:15px;color:var(--ink)}
.of-portfolio-filters{display:flex;gap:.375rem;overflow-x:auto;padding:.125rem 0}
.of-portfolio-filter{padding:.5rem .75rem;border-color:var(--line2);border-radius:999px;color:var(--soft);font:11px/1 var(--mono)}
.of-portfolio-filter[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.of-portfolio-zone{display:grid;gap:.625rem;padding:.75rem;border:1px solid var(--line);border-radius:var(--mc-radius)}
.of-portfolio-zone[hidden]{display:none}
.of-portfolio-zone-head{display:flex;align-items:baseline;justify-content:space-between;gap:.75rem}
.of-portfolio-zone-head h3{margin:0;color:var(--ink);font-size:14px}
.of-portfolio-zone-head span{color:var(--soft);font:10.5px/1.25 var(--mono);text-align:right}
.of-portfolio-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:.625rem}
.of-portfolio-card{padding:.75rem}
.of-portfolio-card[aria-current="true"]{border-color:var(--ink)}
.of-portfolio-lifecycle{display:grid;gap:.375rem;padding:.625rem;border-left:2px solid var(--line2);color:var(--soft);font:10.5px/1.45 var(--mono)}
.of-portfolio-lifecycle p{margin:0}
.of-portfolio-overlay{color:var(--warn)}
.of-portfolio-more{border:1px solid var(--line);border-radius:var(--mc-radius-compact);padding:.25rem .625rem;color:var(--soft);font:11px/1.4 var(--mono)}
.of-portfolio-more>summary{display:flex;align-items:center;width:100%;border:0;color:var(--ink)}
.of-portfolio-more>.of-portfolio-grid{padding:.5rem 0}
.of-portfolio-aliases{display:flex;flex-wrap:wrap;gap:.375rem}
.of-portfolio-context{display:grid;gap:.375rem;margin-top:.75rem;padding:.75rem;border:1px dashed var(--line2);border-radius:var(--mc-radius-compact);color:var(--soft);font:11px/1.4 var(--mono)}
.of-portfolio-context p{margin:0}
.of-organ-plan{display:grid;gap:.625rem;margin-top:.75rem;padding:.75rem;border:1px solid var(--line);border-radius:var(--mc-radius);min-width:0}
.of-organ-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;min-width:0}
.of-organ-head h3{margin:.125rem 0 0;font-size:14px;color:var(--ink)}
.of-eyebrow{color:var(--soft);font:9.5px/1.2 var(--mono);letter-spacing:.08em;text-transform:uppercase}
.of-organ-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:.5rem;min-width:0}
.of-organ-card{padding:.625rem}
.of-organ-card[aria-current="true"]{border-color:var(--ink)}
.of-organ-context{display:grid;gap:.375rem;margin-top:.75rem;padding:.75rem;border:1px dashed var(--line2);border-radius:var(--mc-radius-compact);color:var(--soft);font:11px/1.4 var(--mono);overflow-wrap:anywhere}
.of-organ-context p{margin:0}
.of-tab:focus-visible,.of-control:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
@media (max-width:640px){
  .of-nav{position:sticky;top:0;z-index:2;gap:.25rem;background:var(--bg)}
  .of-tab{padding:.5rem .125rem;text-align:center}
  .of-tab-label{font:10.5px/1 var(--mono)}
  .of-tab small{display:none}
  .of-scene{padding:.625rem}
  .of-portfolio-summary{grid-template-columns:repeat(3,minmax(0,1fr))}
  .of-portfolio-zone{padding:.625rem}
  .of-portfolio-grid{grid-template-columns:1fr}
  .of-portfolio-card{padding:.625rem}
  .of-portfolio-lifecycle{font-size:10px}
  .of-organ-head{align-items:stretch;flex-direction:column}
  .of-organ-grid{grid-template-columns:1fr}
}
@media (prefers-reduced-motion: reduce){
  #operating-fabric, #operating-fabric *{transition:none !important;animation:none !important}
}
</style>
`;
