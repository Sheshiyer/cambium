import { useEffect, useMemo, useRef, useState } from 'react';
import { Coolshape } from 'coolshapes-react';
import { MINI_APP_MAP_SUBSECTIONS, type MiniAppMapSubsection } from '../../../../shared/mini-app-surface-contract.ts';
import { SceneSheet } from './SceneSheet.tsx';
import { KNOWLEDGE_SECTIONS } from './knowledge-model.ts';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AppSettings,
} from './settings-model.ts';
import {
  HUD_MODES,
  WORKFORCE_SHEET_ROWS,
  islandSheetRows,
  subsectionSheetRows,
  type HudMode,
  type SheetRowModel,
} from './scene-data.ts';
import type { CameraMode, CambiumSceneModel, EngineControl, ScenePanel, ScreenId, VisualizationLayer } from './types';

interface SceneHudProps {
  scene: CambiumSceneModel;
  cameraMode: CameraMode;
  onScreenChange: (screenId: ScreenId) => void;
  onCameraModeChange: (mode: CameraMode) => void;
}

interface OpenSheet {
  title: string;
  kicker: string;
  rows: readonly SheetRowModel[];
}

const cameraModes: CameraMode[] = ['overview', 'node', 'flat'];

function readHudModeFromHash(): HudMode {
  if (typeof window === 'undefined') return 'map';
  const query = window.location.hash.split('?')[1] ?? '';
  const mode = new URLSearchParams(query).get('mode');
  return (HUD_MODES as readonly string[]).includes(mode ?? '') ? (mode as HudMode) : 'map';
}

function writeHudModeToHash(mode: HudMode) {
  if (typeof window === 'undefined') return;
  const route = window.location.hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  const next = mode === 'map' ? route : `${route}?mode=${mode}`;
  window.history.replaceState(null, '', next ? `#/${next}` : `${window.location.pathname}${window.location.search}`);
}

function instrumentLabel(item: ScenePanel | EngineControl | VisualizationLayer | SheetRowModel) {
  return 'title' in item ? item.title : item.label;
}

function instrumentTone(item: ScenePanel | EngineControl | VisualizationLayer | SheetRowModel) {
  return 'kind' in item ? item.kind : item.tone;
}

export function SceneHud({ scene, cameraMode, onScreenChange, onCameraModeChange }: SceneHudProps) {
  const focusedNode = scene.nodes.find((node) => node.id === scene.activeScreen.focusNode) ?? scene.nodes.find((node) => node.state === 'active') ?? scene.nodes[0];
  const isReferenceOverview = scene.activeScreen.id === scene.overviewArtDirection.routeId;
  const [hudMode, setHudMode] = useState<HudMode>(readHudModeFromHash);
  const [sheet, setSheet] = useState<OpenSheet | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings(window.localStorage));
  const [knowledgeIndex, setKnowledgeIndex] = useState(0);
  const cameraBeforeSheet = useRef<CameraMode | null>(null);

  const applySettings = (next: AppSettings) => {
    setSettings(next);
    saveSettings(next, window.localStorage);
    document.documentElement.dataset.reducedMotion = next.reducedMotion;
  };

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = settings.reducedMotion;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openKnowledgeSheet = (index: number) => {
    const section = KNOWLEDGE_SECTIONS[index];
    if (!section) return;
    setKnowledgeIndex(index);
    openSheet({ title: section.title.toUpperCase(), kicker: section.kicker, rows: section.rows });
  };

  const settingsRows = (): readonly SheetRowModel[] => [
    { id: 'reduced-motion', label: 'REDUCED MOTION', value: settings.reducedMotion, tone: 'signal' },
    { id: 'default-camera', label: 'DEFAULT CAMERA', value: settings.defaultCamera, tone: 'mist' },
    { id: 'tenant', label: 'TENANT', value: settings.tenant, tone: 'depth' },
    { id: 'worker-url', label: 'WORKER URL', value: settings.workerBaseUrl || 'not configured', tone: settings.workerBaseUrl ? 'signal' : 'depth' },
    { id: 'settings-note', label: 'NOTE', value: 'motion + camera apply live; tenant + worker wire in C4', tone: 'mist' },
  ];

  const subsectionGroups = useMemo(() => {
    const groups = new Map<string, MiniAppMapSubsection[]>();
    for (const subsection of MINI_APP_MAP_SUBSECTIONS) {
      const bucket = groups.get(subsection.target) ?? [];
      bucket.push(subsection);
      groups.set(subsection.target, bucket);
    }
    return [...groups.entries()];
  }, []);

  const openSheet = (next: OpenSheet) => {
    if (!sheet) cameraBeforeSheet.current = cameraMode;
    setSheet(next);
    onCameraModeChange('flat');
  };

  const closeSheet = () => {
    setSheet(null);
    if (cameraBeforeSheet.current) onCameraModeChange(cameraBeforeSheet.current);
    cameraBeforeSheet.current = null;
  };

  const changeHudMode = (mode: HudMode) => {
    setHudMode(mode);
    writeHudModeToHash(mode);
    if (mode === 'workforce') {
      openSheet({ title: 'WORKFORCE', kicker: 'PRINCIPALS · PLACEHOLDER', rows: WORKFORCE_SHEET_ROWS });
    } else {
      closeSheet();
    }
  };

  useEffect(() => {
    if (!sheet) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sheet]);

  const instrumentItems: readonly (ScenePanel | EngineControl | VisualizationLayer | SheetRowModel)[] =
    scene.activeScreen.mode === 'settings'
      ? scene.engineControls
      : scene.activeScreen.mode === 'visualizations'
        ? scene.visualizationLayers
        : scene.activeScreen.mode === 'island'
          ? islandSheetRows(scene.activeScreen.id)
          : scene.activeScreen.panels;

  return (
    <>
      <header className={`operator-strip${isReferenceOverview ? ' operator-strip--overview' : ''}`} aria-label="Cambium tactical state">
        <div className="operator-brand">
          <span>CAMBIUM</span>
          <strong>{scene.activeScreen.eyebrow}</strong>
        </div>
        <div className="mode-pill" role="group" aria-label="HUD mode">
          {HUD_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={hudMode === mode}
              onClick={() => changeHudMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="mode-pill" role="group" aria-label="App tools">
          <button
            type="button"
            aria-pressed={sheet?.title === 'SETTINGS'}
            onClick={() => (sheet?.title === 'SETTINGS' ? closeSheet() : openSheet({ title: 'SETTINGS', kicker: 'APP · LIVE', rows: settingsRows() }))}
          >
            settings
          </button>
          <button
            type="button"
            aria-pressed={sheet?.title === KNOWLEDGE_SECTIONS[knowledgeIndex]?.title.toUpperCase()}
            onClick={() => openKnowledgeSheet(sheet ? (knowledgeIndex + 1) % KNOWLEDGE_SECTIONS.length : 0)}
            title="Cycle knowledge sections"
          >
            guide
          </button>
        </div>
        <div className="telemetry-line" aria-label="Process telemetry">
          <span>{scene.telemetry.progressLabel}</span>
          <span>{scene.telemetry.freshness}</span>
          <span>{scene.activeScreen.taskId}</span>
        </div>
      </header>

      <nav className={`route-dock${isReferenceOverview ? ' route-dock--overview' : ''}`} aria-label="Cambium islands">
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

      {isReferenceOverview ? null : (
        <aside className={`diegetic-readout${sheet ? ' hud-layer--dimmed' : ''}`} aria-label="Current tactical target">
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
      )}

      {isReferenceOverview ? null : (
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
      )}

      {isReferenceOverview ? null : (
        <section className={`scene-instruments${sheet ? ' hud-layer--dimmed' : ''}`} aria-label="Scene instruments">
          {instrumentItems.map((item) => (
            <div key={instrumentLabel(item)} className="instrument-line" data-tone={instrumentTone(item)}>
              <span>{instrumentLabel(item)}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </section>
      )}

      {hudMode === 'sheets' ? (
        <section className={`sheet-browser${sheet ? ' hud-layer--dimmed' : ''}`} aria-label="Map subsection sheets">
          {subsectionGroups.map(([target, subsections]) => (
            <div key={target} className="sheet-browser__group">
              <span className="hud-kicker">{target.toUpperCase()}</span>
              {subsections.map((subsection) => (
                <button
                  key={subsection.id}
                  type="button"
                  className="sheet-browser__item"
                  onClick={() =>
                    openSheet({
                      title: subsection.id.toUpperCase(),
                      kicker: `MAP · ${subsection.target.toUpperCase()}`,
                      rows: subsectionSheetRows(subsection),
                    })
                  }
                >
                  <span>{subsection.id}</span>
                  <strong>{subsection.interactions.primary}</strong>
                </button>
              ))}
            </div>
          ))}
        </section>
      ) : null}

      {sheet ? (
        <SceneSheet title={sheet.title} kicker={sheet.kicker} rows={sheet.rows} onClose={closeSheet}>
          {sheet.title === 'SETTINGS' ? (
            <section className="camera-dial" aria-label="Live settings">
              {(['system', 'on', 'off'] as const).map((option) => (
                <button
                  key={`motion-${option}`}
                  type="button"
                  aria-pressed={settings.reducedMotion === option}
                  onClick={() => applySettings({ ...settings, reducedMotion: option })}
                >
                  motion:{option}
                </button>
              ))}
              {(['overview', 'node', 'flat'] as const).map((option) => (
                <button
                  key={`camera-${option}`}
                  type="button"
                  aria-pressed={settings.defaultCamera === option}
                  onClick={() => {
                    applySettings({ ...settings, defaultCamera: option });
                    onCameraModeChange(option);
                  }}
                >
                  cam:{option}
                </button>
              ))}
            </section>
          ) : null}
        </SceneSheet>
      ) : null}
    </>
  );
}
