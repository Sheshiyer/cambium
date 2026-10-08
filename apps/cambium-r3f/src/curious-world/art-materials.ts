import * as THREE from 'three';
import { seedValue, type Surface } from './art-geometry.ts';

export function createArtMaterials(trackMaterial: (m: THREE.Material) => void, trackTexture: (t: THREE.Texture) => void) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#e6e6e6'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3500; i++) { const v = Math.floor(218 + seedValue(9, i) * 24);
      ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(seedValue(1, i) * 256, seedValue(2, i) * 256, 1 + seedValue(3, i) * 3, 1); }
    for (let i = 0; i < 15; i++) { ctx.beginPath(); let x = seedValue(5, i) * 256, y = seedValue(6, i) * 256; ctx.moveTo(x, y);
      for (let j = 0; j < 2; j++) { x += (seedValue(i + 8, j) - .3) * 8; y += (seedValue(i + 11, j) - .2) * 8; ctx.lineTo(x, y); }
      ctx.strokeStyle = '#cdcdcd'; ctx.lineWidth = .4; ctx.stroke(); }
  }
  const grain = new THREE.CanvasTexture(canvas); grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(2, 2); trackTexture(grain);
  const tonalTexture = (seed: number, kind: 'mineral' | 'metal' | 'leaf') => {
    const field = document.createElement('canvas'); field.width = field.height = 256;
    const paint = field.getContext('2d');
    if (paint) {
      paint.fillStyle = '#FBFCF8'; paint.fillRect(0, 0, 256, 256); paint.filter = 'blur(9px)';
      for (let i = 0; i < 70; i++) {
        const alpha = kind === 'mineral' ? .015 + seedValue(seed + 1, i) * .055
          : .05 + seedValue(seed + 1, i) * .22;
        paint.fillStyle = kind === 'metal' ? `rgba(75,103,90,${alpha})`
          : kind === 'leaf' ? `rgba(67,111,72,${alpha})` : `rgba(72,84,78,${alpha})`;
        paint.beginPath(); paint.ellipse(seedValue(seed + 2, i) * 256, seedValue(seed + 3, i) * 256,
          8 + seedValue(seed + 4, i) * 34, 7 + seedValue(seed + 5, i) * 22, seedValue(seed + 6, i) * Math.PI, 0, Math.PI * 2); paint.fill();
      }
      paint.filter = 'none';
    }
    const texture = new THREE.CanvasTexture(field); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(kind === 'mineral' ? .8 : .65, kind === 'mineral' ? .8 : .65);
    trackTexture(texture); return texture;
  };
  // Distinct broad mineral inclusions, oxide mottling and foliage tones are static original artwork.
  const mineralTone = tonalTexture(23, 'mineral'), metalTone = tonalTexture(47, 'metal'), leafTone = tonalTexture(89, 'leaf');
  const specs: Record<Surface, { color: string; metal?: number; rough: number; bump?: number; emissive?: string }> = {
    basalt: { color: '#1D3034', rough: .96, bump: .025 }, stone: { color: '#63746A', rough: .9, bump: .035 },
    moss: { color: '#527B49', rough: .96, bump: .02 }, copper: { color: '#CB945F', metal: .82, rough: .3, bump: .008 },
    patina: { color: '#3E8577', metal: .5, rough: .6, bump: .018 }, limestone: { color: '#CFC6A8', rough: .86, bump: .025 },
    mint: { color: '#82C8B8', rough: .3, metal: .25, emissive: '#32675B' }, acid: { color: '#D1EB54', rough: .27, metal: .18, emissive: '#6A8022' },
    bark: { color: '#42523C', rough: 1, bump: .04 }, water: { color: '#092F36', rough: .37, metal: .2, bump: 0 },
  };
  const materials = new Map<Surface, THREE.MeshStandardMaterial>();
  for (const [name, spec] of Object.entries(specs) as Array<[Surface, typeof specs[Surface]]>) {
    const m = new THREE.MeshStandardMaterial({ color: spec.color, roughness: spec.rough, metalness: spec.metal ?? 0,
      map: name === 'moss' || name === 'bark' ? leafTone : name === 'copper' || name === 'patina' ? metalTone
        : name === 'basalt' || name === 'stone' || name === 'limestone' ? mineralTone : null,
      bumpMap: grain, bumpScale: spec.bump ?? 0, roughnessMap: grain, flatShading: true,
      emissive: spec.emissive ?? '#000000', emissiveIntensity: .22 });
    if (name === 'water') { m.bumpMap = null; m.roughnessMap = null; }
    trackMaterial(m); materials.set(name, m);
  }
  return materials;
}
