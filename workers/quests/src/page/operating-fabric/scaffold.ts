// cambium-quests · operating fabric shell scaffold (Task 6 additive bundle).
// Hidden + inert by default: the shell declares the five operating-fabric
// scenes (canopy, mission, flow, workforce, forge) as an empty navigation
// skeleton. It carries no data surface, no actions, and no authorization —
// contextual actions remain governed by the server-side RBAC envelope.
import { OPERATING_FABRIC_SCENE_IDS } from '../../mini-app-surface-contract.ts';
import { FABRIC_WORKBENCH_HEADER } from './workbench.ts';

export const OPERATING_FABRIC_SCENES = `<div id="operating-fabric" data-component="OperatingFabricShell" hidden inert aria-hidden="true">
  ${FABRIC_WORKBENCH_HEADER}
  <nav class="of-nav" data-component="OperatingFabricNav" role="tablist" aria-label="Operating Fabric scenes">
    <button type="button" class="of-tab" role="tab" tabindex="0" data-of-tab="canopy" data-of-scene-target="canopy" aria-controls="of-canopy" aria-label="Canopy · overview" aria-selected="true"><span class="of-tab-label">Canopy</span><small>overview</small></button>
    <button type="button" class="of-tab" role="tab" tabindex="-1" data-of-tab="mission" data-of-scene-target="mission" aria-controls="of-mission" aria-label="Mission · next move" aria-selected="false"><span class="of-tab-label">Mission</span><small>next move</small></button>
    <button type="button" class="of-tab" role="tab" tabindex="-1" data-of-tab="flow" data-of-scene-target="flow" aria-controls="of-flow" aria-label="Flow · signals" aria-selected="false"><span class="of-tab-label">Flow</span><small>signals</small></button>
    <button type="button" class="of-tab" role="tab" tabindex="-1" data-of-tab="workforce" data-of-scene-target="workforce" aria-controls="of-workforce" aria-label="Workforce · agents" aria-selected="false"><span class="of-tab-label">Work</span><small>agents</small></button>
    <button type="button" class="of-tab" role="tab" tabindex="-1" data-of-tab="forge" data-of-scene-target="forge" aria-controls="of-forge" aria-label="Forge · build" aria-selected="false"><span class="of-tab-label">Forge</span><small>build</small></button>
    <a class="of-tab of-workbench-link" href="/admin/portfolio" data-of-portfolio-workbench hidden inert aria-label="Open Portfolio Workbench"><span class="of-tab-label">Plan</span><small>portfolio</small></a>
  </nav>
  <div class="of-track" data-component="OperatingFabricTrack">
    <section id="of-canopy" class="of-scene" data-of-scene="canopy" role="tabpanel" aria-hidden="false" aria-labelledby="ofSceneCanopyTitle"><h2 id="ofSceneCanopyTitle" class="sr">Canopy</h2></section>
    <section id="of-mission" class="of-scene" data-of-scene="mission" role="tabpanel" aria-hidden="true" aria-labelledby="ofSceneMissionTitle" hidden inert><h2 id="ofSceneMissionTitle" class="sr">Mission</h2></section>
    <section id="of-flow" class="of-scene" data-of-scene="flow" role="tabpanel" aria-hidden="true" aria-labelledby="ofSceneFlowTitle" hidden inert><h2 id="ofSceneFlowTitle" class="sr">Flow</h2></section>
    <section id="of-workforce" class="of-scene" data-of-scene="workforce" role="tabpanel" aria-hidden="true" aria-labelledby="ofSceneWorkforceTitle" hidden inert><h2 id="ofSceneWorkforceTitle" class="sr">Workforce</h2></section>
    <section id="of-forge" class="of-scene" data-of-scene="forge" role="tabpanel" aria-hidden="true" aria-labelledby="ofSceneForgeTitle" hidden inert><h2 id="ofSceneForgeTitle" class="sr">Forge</h2></section>
  </div>
</div>
`;

export { OPERATING_FABRIC_SCENE_IDS };

import { OPERATING_FABRIC_STYLES } from './styles.ts';

// The shell ships as honest DOM: real markup in the document body, hidden and
// inert until the boot client activates it. No comment tricks, no mount swap.
export const OPERATING_FABRIC_MARKUP = OPERATING_FABRIC_STYLES + OPERATING_FABRIC_SCENES;
