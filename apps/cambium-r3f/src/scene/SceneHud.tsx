import { Coolshape } from 'coolshapes-react';
import type { CameraMode, CambiumSceneModel, EngineControl, ScenePanel, ScreenId, VisualizationLayer } from './types';

interface SceneHudProps {
  scene: CambiumSceneModel;
  cameraMode: CameraMode;
  onScreenChange: (screenId: ScreenId) => void;
  onCameraModeChange: (mode: CameraMode) => void;
}

const cameraModes: CameraMode[] = ['overview', 'node', 'flat'];

function instrumentLabel(item: ScenePanel | EngineControl | VisualizationLayer) {
  return 'title' in item ? item.title : item.label;
}

function instrumentTone(item: ScenePanel | EngineControl | VisualizationLayer) {
  return 'tone' in item ? item.tone : item.kind;
}

export function SceneHud({ scene, cameraMode, onScreenChange, onCameraModeChange }: SceneHudProps) {
  const focusedNode = scene.nodes.find((node) => node.id === scene.activeScreen.focusNode) ?? scene.nodes.find((node) => node.state === 'active') ?? scene.nodes[0];

  return (
    <>
      <header className="operator-strip" aria-label="Cambium tactical state">
        <div className="operator-brand">
          <span>CAMBIUM</span>
          <strong>{scene.activeScreen.eyebrow}</strong>
        </div>
        <div className="telemetry-line" aria-label="Process telemetry">
          <span>{scene.telemetry.progressLabel}</span>
          <span>{scene.telemetry.freshness}</span>
          <span>{scene.activeScreen.taskId}</span>
        </div>
      </header>

      <nav className="route-dock" aria-label="Cambium islands">
        {scene.screens.map((screen) => (
          <button
            key={screen.id}
            type="button"
            aria-current={screen.id === scene.activeScreen.id ? 'page' : undefined}
            onClick={() => onScreenChange(screen.id)}
            title={screen.title}
          >
            <span>{screen.title}</span>
          </button>
        ))}
      </nav>

      <aside className="diegetic-readout" aria-label="Current tactical target">
        <div className="shape-specimen" aria-hidden="true">
          <Coolshape
            type={focusedNode.coolshape.shapeType}
            index={focusedNode.coolshape.index}
            size={58}
            noise={false}
          />
        </div>
        <div>
          <span className="hud-kicker">{scene.activeScreen.mode.toUpperCase()} · {cameraMode.toUpperCase()}</span>
          <h1>{scene.activeScreen.title}</h1>
          <p>{scene.activeScreen.description}</p>
        </div>
      </aside>

      <section className="camera-dial" aria-label="Camera mode">
        {cameraModes.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={cameraMode === mode}
            onClick={() => onCameraModeChange(mode)}
          >
            {mode}
          </button>
        ))}
      </section>

      <section className="scene-instruments" aria-label="Scene instruments">
        {(scene.activeScreen.mode === 'settings' ? scene.engineControls : scene.activeScreen.mode === 'visualizations' ? scene.visualizationLayers : scene.activeScreen.panels).map((item) => (
          <div key={instrumentLabel(item)} className="instrument-line" data-tone={instrumentTone(item)}>
            <span>{instrumentLabel(item)}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </section>
    </>
  );
}
