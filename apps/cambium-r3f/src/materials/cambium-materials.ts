import { visualTokens } from '../scene/visual-tokens';

export const materialPresets = {
  substrate: {
    color: visualTokens.colors.substrate,
    roughness: 0.94,
    metalness: 0.03,
    opacity: 0.88,
  },
  contour: {
    color: visualTokens.colors.mist,
    opacity: 0.2,
  },
  islandShell: {
    color: visualTokens.colors.substrate,
    roughness: 0.82,
    metalness: 0.12,
  },
  islandSignal: {
    color: visualTokens.colors.signal,
    emissive: visualTokens.colors.signal,
    emissiveIntensity: 0.28,
  },
  memory: {
    color: visualTokens.colors.depth,
    emissive: visualTokens.colors.mist,
    emissiveIntensity: 0.12,
  },
  railPrimary: {
    color: visualTokens.colors.signal,
    opacity: 0.78,
  },
  railSecondary: {
    color: visualTokens.colors.mist,
    opacity: 0.48,
  },
  railMemory: {
    color: visualTokens.colors.depth,
    opacity: 0.72,
  },
} as const;

export const fogPreset = {
  color: visualTokens.colors.ink,
  near: 8,
  far: 24,
} as const;
