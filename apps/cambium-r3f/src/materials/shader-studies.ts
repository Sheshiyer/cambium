import * as THREE from 'three';
import type { IslandBiome } from '../scene/types';
import { visualTokens } from '../scene/visual-tokens';

export const shaderStudies = {
  islandTerrain: {
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 baseColor;
      uniform vec3 ridgeColor;
      uniform vec3 signalColor;
      uniform float selected;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        float facing = clamp(dot(normalize(vNormal), normalize(vec3(0.2, 0.8, 0.5))), 0.0, 1.0);
        float strata = smoothstep(-0.05, 0.72, vPosition.y);
        float contour = step(0.965, fract((vPosition.y + length(vPosition.xz) * 0.08) * 9.0));
        vec3 color = mix(baseColor, ridgeColor, strata * 0.58 + facing * 0.22);
        color = mix(color, signalColor, contour * (0.16 + selected * 0.22));
        gl_FragColor = vec4(color, 0.94);
      }
    `,
  },
  atmosphereSheet: {
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 fogColor;
      uniform vec3 signalColor;
      uniform float density;
      varying vec2 vUv;
      void main() {
        float band = smoothstep(0.08, 0.72, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y));
        float scan = step(0.92, fract(vUv.y * 36.0));
        vec3 color = mix(fogColor, signalColor, scan * 0.08);
        gl_FragColor = vec4(color, band * density);
      }
    `,
  },
} as const;

const biomeColors: Record<IslandBiome, { base: string; ridge: string }> = {
  seed: { base: visualTokens.colors.substrate, ridge: visualTokens.colors.signal },
  resonance: { base: visualTokens.colors.substrate, ridge: visualTokens.colors.mist },
  forge: { base: '#23383a', ridge: visualTokens.colors.mist },
  loop: { base: '#1d3f3c', ridge: visualTokens.colors.signal },
  memory: { base: visualTokens.colors.depth, ridge: visualTokens.colors.mist },
};

export function createIslandShaderMaterial(biome: IslandBiome, selected: boolean) {
  const colors = biomeColors[biome];
  return new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color(colors.base) },
      ridgeColor: { value: new THREE.Color(colors.ridge) },
      signalColor: { value: new THREE.Color(visualTokens.colors.signal) },
      selected: { value: selected ? 1 : 0 },
    },
    vertexShader: shaderStudies.islandTerrain.vertexShader,
    fragmentShader: shaderStudies.islandTerrain.fragmentShader,
    transparent: true,
  });
}

export function createAtmosphereMaterial(density = 0.22) {
  return new THREE.ShaderMaterial({
    uniforms: {
      fogColor: { value: new THREE.Color(visualTokens.colors.ink) },
      signalColor: { value: new THREE.Color(visualTokens.colors.signal) },
      density: { value: density },
    },
    vertexShader: shaderStudies.atmosphereSheet.vertexShader,
    fragmentShader: shaderStudies.atmosphereSheet.fragmentShader,
    transparent: true,
    depthWrite: false,
  });
}
