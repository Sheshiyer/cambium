import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { CameraMode, CambiumSceneModel } from '../scene/types';

interface TacticalCameraRigProps {
  scene: CambiumSceneModel;
  mode: CameraMode;
}

const overviewPose = {
  position: new THREE.Vector3(8.8, 7.4, 9.2),
  target: new THREE.Vector3(0, 0, -0.35),
  zoom: 61,
};

const flatPose = {
  position: new THREE.Vector3(0.1, 10.2, 0.1),
  target: new THREE.Vector3(0, 0, -0.25),
  zoom: 76,
};

export function TacticalCameraRig({ scene, mode }: TacticalCameraRigProps) {
  const { camera } = useThree();
  const activeNode = scene.nodes.find((node) => node.id === scene.activeScreen.focusNode);
  const drift = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  const targetPose = useMemo(() => {
    if (mode === 'flat') return flatPose;
    if (mode === 'node' && activeNode) {
      return {
        position: new THREE.Vector3(
          activeNode.cameraTarget.x + 3.8,
          activeNode.cameraTarget.y + 4.6,
          activeNode.cameraTarget.z + 4.7,
        ),
        target: new THREE.Vector3(activeNode.cameraTarget.x, 0.45, activeNode.cameraTarget.z),
        zoom: activeNode.cameraTarget.zoom,
      };
    }
    return overviewPose;
  }, [activeNode, mode]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    const driftScale = mode === 'flat' ? 0.06 : mode === 'node' ? 0.18 : 0.32;
    drift.set(
      Math.sin(time * 0.16) * driftScale,
      Math.sin(time * 0.11 + 1.2) * driftScale * 0.32,
      Math.cos(time * 0.13) * driftScale,
    );
    lookTarget.copy(targetPose.target).addScaledVector(drift, 0.18);
    camera.position.lerp(targetPose.position.clone().add(drift), Math.min(1, delta * 2.5));
    camera.zoom = THREE.MathUtils.lerp(camera.zoom, targetPose.zoom + Math.sin(time * 0.12) * 0.8, Math.min(1, delta * 2.6));
    camera.lookAt(lookTarget);
    camera.updateProjectionMatrix();
  });

  return null;
}
