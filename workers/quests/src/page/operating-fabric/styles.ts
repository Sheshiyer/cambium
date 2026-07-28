// cambium-quests · operating fabric shell styles (Task 6 additive bundle).
// Scoped to #operating-fabric: hidden shell stays out of layout, scene tabs
// ride the shared tokens, and reduced motion collapses shell transitions.
export const OPERATING_FABRIC_STYLES = `<style>
#operating-fabric{display:none}
#operating-fabric.of-on{display:block}
#operating-fabric{position:relative;min-height:100dvh;color:var(--ink)}
.of-nav{display:flex;gap:.5rem;overflow-x:auto;padding:.75rem 1rem}
.of-tab{flex:1;min-width:0;border:1px solid rgba(214,255,246,.16);background:transparent;color:inherit;border-radius:.75rem;padding:.6rem .75rem;font:inherit;text-align:left;cursor:pointer}
.of-tab[aria-selected="true"]{background:var(--ink);color:var(--bg)}
.of-tab small{display:block;opacity:.72}
.of-scene{padding:1rem}
.of-scene[hidden]{display:none}
@media (prefers-reduced-motion: reduce){
  #operating-fabric, #operating-fabric *{transition:none !important;animation:none !important}
}
</style>
`;
