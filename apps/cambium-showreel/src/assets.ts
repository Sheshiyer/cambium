// Asset manifest: everything is read in place from docs/assets/visual-flow
// (served under /assets/), matted specimens from out/mattes, GLBs from the
// R3F app's public folder (served under /meshy/).
import { LinearFilter, SRGBColorSpace, Texture, TextureLoader } from 'three';

export const IMAGES = {
  // matted specimen renders (tools/prep-assets.ts)
  'm:genesis': '/mattes/genesis.png',
  'm:taste': '/mattes/taste.png',
  'm:build': '/mattes/build.png',
  'm:ops': '/mattes/ops.png',
  'm:cortex': '/mattes/cortex.png',
  'm:rail-arc': '/mattes/rail-arc.png',
  'm:signal-packet': '/mattes/signal-packet.png',
  'm:emitter-node': '/mattes/emitter-node.png',
  'm:process-beacon': '/mattes/process-beacon.png',
  'm:control-dial': '/mattes/control-dial.png',
  'm:visualization-lens': '/mattes/visualization-lens.png',
  // Temperance organ concepts (organ-console)
  'o:vestibule': '/assets/organ-console/organs/vestibule/concept-v1.png',
  'o:adytum': '/assets/organ-console/organs/adytum/concept-v1.png',
  'o:nutrix': '/assets/organ-console/organs/nutrix/concept-v1.png',
  'o:auspex': '/assets/organ-console/organs/auspex/concept-v1.png',
  'o:circulator': '/assets/organ-console/organs/circulator/concept-v1.png',
  'o:praeceptor': '/assets/organ-console/organs/praeceptor/concept-v1.png',
  // product surfaces
  's:mission': '/assets/0060--telegram-mini-app--02-mission-control-state-stack-mobile.png',
  's:commands': '/assets/0064--telegram-mini-app--commands-mobile.png',
  's:work': '/assets/organ-console/views/work/wide-v1.png',
  's:receipts': '/assets/organ-console/views/receipts/wide-v1.png',
  's:canopy': '/assets/organ-console/views/canopy/wide-v1.png',
  's:auspex-wide': '/assets/organ-console/organs/auspex/wide-v1.png',
  's:design-system': '/assets/0063--telegram-mini-app--cambium-design-system-source.png',
  's:atlas': '/assets/0062--telegram-mini-app--cambium-atlas-source.png',
  // blueprint feature geometries (paper line art)
  'f:identity-seam': '/assets/organ-console/features/identity-seam/geometry-v1.png',
  'f:receipt-strata': '/assets/organ-console/features/receipt-strata/geometry-v1.png',
  'f:typed-handoff': '/assets/organ-console/features/typed-handoff/geometry-v1.png',
  'f:evidence-socket': '/assets/organ-console/features/evidence-socket/geometry-v1.png',
} as const;

export type ImageKey = keyof typeof IMAGES;

export const GENESIS_GLB = '/meshy/image-to-3d/genesis/optimized/model.glb';

export async function loadImages(): Promise<Record<ImageKey, Texture>> {
  const loader = new TextureLoader();
  const entries = await Promise.all(
    (Object.entries(IMAGES) as [ImageKey, string][]).map(async ([k, url]) => {
      const t = await loader.loadAsync(url);
      t.colorSpace = SRGBColorSpace;
      t.minFilter = LinearFilter;
      t.generateMipmaps = false;
      t.anisotropy = 4;
      return [k, t] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<ImageKey, Texture>;
}
