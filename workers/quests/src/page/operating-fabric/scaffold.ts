// cambium-quests · operating fabric shell scaffold (Task 6 additive bundle).
// Hidden + inert by default: the shell declares the five operating-fabric
// scenes (canopy, mission, flow, workforce, forge) as an empty navigation
// skeleton. It carries no data surface, no actions, and no authorization —
// contextual actions remain governed by the server-side RBAC envelope.
import { OPERATING_FABRIC_SCENE_IDS } from '../../mini-app-surface-contract.ts';

export const OPERATING_FABRIC_SCENES = `<div id="operating-fabric" data-component="OperatingFabricShell" hidden inert aria-hidden="true">
  <nav class="of-nav" data-component="OperatingFabricNav" aria-label="Operating Fabric scenes">
    <button type="button" class="of-tab" data-of-tab="canopy" data-of-scene-target="canopy" aria-label="Canopy · overview" aria-selected="true"><span class="of-tab-label">Canopy</span><small>overview</small></button>
    <button type="button" class="of-tab" data-of-tab="mission" data-of-scene-target="mission" aria-label="Mission · next move" aria-selected="false"><span class="of-tab-label">Mission</span><small>next move</small></button>
    <button type="button" class="of-tab" data-of-tab="flow" data-of-scene-target="flow" aria-label="Flow · signals" aria-selected="false"><span class="of-tab-label">Flow</span><small>signals</small></button>
    <button type="button" class="of-tab" data-of-tab="workforce" data-of-scene-target="workforce" aria-label="Workforce · agents" aria-selected="false"><span class="of-tab-label">Work</span><small>agents</small></button>
    <button type="button" class="of-tab" data-of-tab="forge" data-of-scene-target="forge" aria-label="Forge · build" aria-selected="false"><span class="of-tab-label">Forge</span><small>build</small></button>
    <a class="of-tab of-workbench-link" href="/admin/portfolio" data-of-portfolio-workbench hidden inert aria-label="Open Portfolio Workbench"><span class="of-tab-label">Plan</span><small>portfolio</small></a>
  </nav>
  <div class="of-track" data-component="OperatingFabricTrack">
    <section class="of-scene" data-of-scene="canopy" aria-labelledby="ofSceneCanopyTitle"><h2 id="ofSceneCanopyTitle" class="sr">Canopy</h2></section>
    <section class="of-scene" data-of-scene="mission" aria-labelledby="ofSceneMissionTitle" hidden><h2 id="ofSceneMissionTitle" class="sr">Mission</h2></section>
    <section class="of-scene" data-of-scene="flow" aria-labelledby="ofSceneFlowTitle" hidden><h2 id="ofSceneFlowTitle" class="sr">Flow</h2></section>
    <section class="of-scene" data-of-scene="workforce" aria-labelledby="ofSceneWorkforceTitle" hidden><h2 id="ofSceneWorkforceTitle" class="sr">Workforce</h2></section>
    <section class="of-scene" data-of-scene="forge" aria-labelledby="ofSceneForgeTitle" hidden><h2 id="ofSceneForgeTitle" class="sr">Forge</h2></section>
  </div>
</div>
`;

export { OPERATING_FABRIC_SCENE_IDS };

import { OPERATING_FABRIC_STYLES } from './styles.ts';

// The shell ships as honest DOM: real markup in the document body, hidden and
// inert until the boot client activates it. No comment tricks, no mount swap.
export const OPERATING_FABRIC_MARKUP = OPERATING_FABRIC_STYLES + OPERATING_FABRIC_SCENES;
