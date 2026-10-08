import { SYSTEM_ATLAS_PORTRAITS } from '../../../../../shared/cambium-system-atlas-portraits.ts';

// Static source identity only. Runtime state is always supplied by the projection.
export const FABRIC_WORKBENCH_HEADER = `<header class="of-root-status" data-component="CuriousWorkbenchHeader">
  <div class="of-brand"><img src="${SYSTEM_ATLAS_PORTRAITS.genesis}" alt="" aria-hidden="true" data-source="cambium.system-atlas.v1/genesis"><div><strong>Curious</strong><span>Living ledger · operating fabric</span></div></div>
  <button type="button" class="of-control of-atlas-entry" data-of-system-atlas="1">System atlas <span aria-hidden="true">↗</span></button>
</header>`;

export const FABRIC_SCENE_INTROS: Readonly<Record<string, string>> = Object.fromEntries([
  ['canopy', 'Canopy', 'The growing work', 'Saplings and programs', 'genesis'],
  ['mission', 'Mission', 'Next safe move', 'Work → mission → task', 'will'],
  ['flow', 'Flow', 'Follow the evidence', 'Task → run → receipt', 'cortex'],
  ['workforce', 'Workforce', 'The hands at work', 'Agents and skill coverage', 'hands'],
  ['forge', 'Forge', 'Shape the next capability', 'Loadouts and eligible clusters', 'taste'],
].map(([id, label, title, caption, organ], index) => [id,
  `<header class="of-scene-intro"><div><span class="of-scene-kicker">0${index + 1} · ${label}</span><h2 id="ofScene${label}Title">${title}</h2><p>${caption}</p></div><img class="of-scene-symbol" src="${SYSTEM_ATLAS_PORTRAITS[organ]}" alt="" aria-hidden="true" data-source="cambium.system-atlas.v1/${organ}"></header>`
]));

export const FABRIC_WORKBENCH_CSS = `
/* One scroll owner, shared organ terrain and explicit rails. */
#operating-fabric.of-on{display:flex;flex-direction:column;height:100dvh;min-height:0;max-width:1120px;margin:0 auto;overflow:hidden;color:var(--soft);background:rgba(0,39,43,.82)}
#operating-fabric .of-root-status{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 24px 16px;flex:none;border-bottom:1px solid var(--line)}
#operating-fabric .of-brand{display:flex;align-items:center;gap:12px;min-width:0}
#operating-fabric .of-brand img{width:52px;height:52px;object-fit:cover;border-radius:50%;border:1px solid var(--line2)}
#operating-fabric .of-brand strong{display:block;font:600 27px/1.1 Georgia,'Times New Roman',serif;letter-spacing:-.04em;color:var(--mc-paper)}
#operating-fabric .of-brand span{display:block;font:11px/1.5 var(--mono);color:var(--soft);opacity:.76;margin-top:4px}
#operating-fabric .of-atlas-entry{gap:12px;border-radius:8px;font:12px/1.2 var(--mono);color:var(--soft)}
#operating-fabric .of-atlas-entry span{color:var(--ink);font-size:18px}
#operating-fabric .of-nav{flex:none;display:flex;gap:0;padding:0 24px;border-bottom:1px solid var(--line2);overflow-x:auto}
#operating-fabric .of-nav>.of-tab{position:relative;border:0;border-radius:0;min-width:44px;min-height:60px;padding:12px 16px;background:transparent;color:var(--soft);text-align:center;opacity:.72}
#operating-fabric .of-nav>.of-tab[aria-selected="true"]{background:rgba(224,255,79,.045);color:var(--ink);opacity:1}
#operating-fabric .of-nav>.of-tab[aria-selected="true"]::after{content:'';position:absolute;bottom:0;left:12px;right:12px;height:2px;background:var(--ink)}
#operating-fabric .of-tab-label{font:650 13px/1.3 system-ui,sans-serif}
#operating-fabric .of-nav small{font:10px/1.3 var(--mono);opacity:.7;margin-top:4px}
#operating-fabric .of-track{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-color:var(--line2) transparent;padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))}
#operating-fabric .of-scene{padding:24px;overflow:visible;min-width:0}
#operating-fabric .of-scene[hidden]{display:none}
#operating-fabric .of-scene-intro{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0 24px;margin-bottom:24px;border-bottom:1px solid var(--line)}
#operating-fabric .of-scene-kicker{font:11px/1.4 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink)}
#operating-fabric .of-scene-intro h2{font:600 clamp(25px,3.2vw,38px)/1.13 Georgia,'Times New Roman',serif;color:var(--mc-paper);letter-spacing:-.04em;margin:8px 0}
#operating-fabric .of-scene-intro p{font:13px/1.5 var(--mono);color:var(--soft);opacity:.72;margin:0}
#operating-fabric .of-scene-symbol{display:block;object-fit:cover;flex:none;width:72px;height:72px;border:1px solid var(--line2);border-radius:50%}
#operating-fabric .of-card{gap:16px;padding:20px;background:var(--bg2);border-color:var(--line2);border-radius:12px}
#operating-fabric .of-card-title{font:650 17px/1.35 system-ui,sans-serif}
#operating-fabric .of-card-note{font:12px/1.5 var(--mono);opacity:.72}
#operating-fabric .of-fact{gap:16px;font:12px/1.5 var(--mono)}
#operating-fabric .of-fact dt{opacity:.78;flex:1}
#operating-fabric .of-fact dd{flex:1;min-width:0;overflow-wrap:anywhere}
#operating-fabric .of-badge{font-size:11px;line-height:1.3;flex-wrap:wrap;max-width:100%}
#operating-fabric .of-state{min-height:148px;background:rgba(1,47,52,.7);text-align:left;place-items:start;padding:24px;border-radius:12px;opacity:1}
#operating-fabric .of-state-title{font:650 15px/1.35 system-ui,sans-serif;letter-spacing:0;text-transform:none}
#operating-fabric .of-state-detail{font:13px/1.6 system-ui,sans-serif;opacity:.78;max-width:56ch}
#operating-fabric .of-control{border-radius:8px;color:var(--soft);gap:8px}
#operating-fabric button:focus-visible,#operating-fabric a:focus-visible{outline:2px solid var(--ink);outline-offset:4px}
#operating-fabric .of-chip-row{gap:8px;margin-bottom:20px}
#operating-fabric .of-chip{min-height:32px;gap:6px;font-size:11px}
#operating-fabric .of-flow-item{padding:16px;border-radius:8px;background:var(--bg2)}
#operating-fabric .of-flow-graph{width:100%;border-spacing:0 12px}
#operating-fabric .of-flow-graph th{font:11px/1.5 var(--mono);text-align:left;color:var(--soft);opacity:.8;padding-bottom:12px}
#operating-fabric .of-flow-graph td{vertical-align:top;padding:12px;background:var(--bg2);border:1px solid var(--line)}
#operating-fabric .of-section,#operating-fabric .of-canopy-section{margin-top:24px}
#operating-fabric .of-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px}
@media(min-width:960px){
 #operating-fabric.of-on{margin:16px auto;height:calc(100dvh - 32px);border:1px solid var(--line2);border-radius:16px}
 #operating-fabric .of-scene{padding:32px}
}
@media(max-width:640px){
 #operating-fabric .of-root-status{padding:16px;gap:8px}
 #operating-fabric .of-brand img{width:40px;height:40px}
 #operating-fabric .of-brand strong{font-size:24px}
 #operating-fabric .of-brand span{font-size:10px}
 #operating-fabric .of-atlas-entry{font-size:11px;padding:8px}
 #operating-fabric .of-nav{padding:0 8px}
 #operating-fabric .of-nav>.of-tab{padding:12px 4px;min-height:52px}
 #operating-fabric .of-tab-label{font-size:11px;line-height:1.4}
 #operating-fabric .of-nav small{display:none}
 #operating-fabric .of-scene{padding:16px}
 #operating-fabric .of-scene-intro{margin-bottom:16px;padding:8px 0 16px}
 #operating-fabric .of-scene-intro h2{font-size:28px}
 #operating-fabric .of-scene-intro p{font-size:11px}
 #operating-fabric .of-scene-symbol{width:52px;height:52px;font-size:28px}
 #operating-fabric .of-card{padding:16px}
 #operating-fabric .of-flow-graph{display:block;border-spacing:0}
 #operating-fabric .of-flow-graph thead{display:none}
 #operating-fabric .of-flow-graph tbody{display:grid;gap:24px}
 #operating-fabric .of-flow-graph tr{display:grid;min-width:0;border:1px solid var(--line2);border-radius:12px;overflow:hidden}
 #operating-fabric .of-flow-graph td{display:block;min-width:0;border:0;border-top:1px solid var(--line);padding:16px}
 #operating-fabric .of-flow-graph td:first-child{border-top:0}
 #operating-fabric .of-flow-graph tr[data-of-flow-row] td::before{display:block;margin-bottom:12px;color:var(--ink);font:11px/1.4 var(--mono);letter-spacing:.08em}
 #operating-fabric .of-flow-graph tr[data-of-flow-row] td[data-of-flow-cell="task"]::before{content:'01 / TASK'}
 #operating-fabric .of-flow-graph tr[data-of-flow-row] td[data-of-flow-cell="run"]::before{content:'02 / RUN'}
 #operating-fabric .of-flow-graph tr[data-of-flow-row] td[data-of-flow-cell="receipt"]::before{content:'03 / RECEIPT'}
 #operating-fabric .of-flow-graph .of-fact dt{flex:0 0 74px}
 #operating-fabric .of-flow-graph .of-fact dd{flex:1;min-width:0}
 #operating-fabric .of-flow-graph .of-flow-path{display:block;width:16px;margin-top:12px;transform:rotate(90deg);color:var(--ink);text-align:center}
}
@media(max-width:350px){
 #operating-fabric .of-brand span{max-width:132px}
 #operating-fabric .of-atlas-entry{max-width:100px;flex-wrap:wrap;gap:4px}
 #operating-fabric .of-root-status{padding:12px}
 #operating-fabric .of-scene{padding:12px}
}
`;
