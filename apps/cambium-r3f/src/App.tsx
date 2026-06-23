import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { CambiumScene } from './scene/CambiumScene';
import { SceneHud } from './scene/SceneHud';
import { buildCambiumScene } from './scene/scene-data';
import { defaultScreenId, screenOrder } from './scene/route-registry';
import type { CameraMode, ScreenId } from './scene/types';
import { visualTokens } from './scene/visual-tokens';

function routeFromHash(): ScreenId {
  const hash = window.location.hash.replace(/^#\/?/, '') as ScreenId;
  return screenOrder.includes(hash) ? hash : defaultScreenId;
}

export function App() {
  const [activeScreenId, setActiveScreenId] = useState<ScreenId>(routeFromHash);
  const [cameraMode, setCameraMode] = useState<CameraMode>('overview');
  const scene = useMemo(() => buildCambiumScene(activeScreenId, cameraMode), [activeScreenId, cameraMode]);
  const isReferenceOverview = scene.activeScreen.id === scene.overviewArtDirection.routeId;

  useEffect(() => {
    const onHashChange = () => setActiveScreenId(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    setCameraMode(scene.activeScreen.defaultCamera);
  }, [scene.activeScreen.id, scene.activeScreen.defaultCamera]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const currentIndex = screenOrder.indexOf(activeScreenId);
      if (event.key === 'ArrowRight') {
        setScreen(screenOrder[(currentIndex + 1) % screenOrder.length]);
      }
      if (event.key === 'ArrowLeft') {
        setScreen(screenOrder[(currentIndex - 1 + screenOrder.length) % screenOrder.length]);
      }
      if (event.key === '1') setCameraMode('overview');
      if (event.key === '2') setCameraMode('node');
      if (event.key === '3') setCameraMode('flat');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeScreenId]);

  const setScreen = (screenId: ScreenId) => {
    window.location.hash = screenId === defaultScreenId ? '' : screenId;
    setActiveScreenId(screenId);
  };

  return (
    <main className={`app-shell${isReferenceOverview ? ' app-shell--overview' : ''}`}>
      <SceneHud
        scene={scene}
        onScreenChange={setScreen}
        cameraMode={cameraMode}
        onCameraModeChange={setCameraMode}
      />
      <section className="scene-stage" aria-label="Cambium tactical map visual engine">
        <Canvas
          orthographic
          camera={{ position: [8.8, 7.4, 9.2], zoom: 61, near: 0.1, far: 1000 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          dpr={[1, 1.65]}
        >
          <color attach="background" args={[visualTokens.colors.ink]} />
          <Suspense fallback={null}>
            <CambiumScene scene={scene} cameraMode={cameraMode} />
          </Suspense>
        </Canvas>
      </section>
    </main>
  );
}
