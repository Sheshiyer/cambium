// Current Field Atlas source proof. Legacy Telegram screenshots remain historical.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE } from './page.ts';

// Historical 2026-11-03 native JPEG proof. The maintained current-3D proof is scripts/field-atlas-viewport-contract.mjs.
export const FIELD_ATLAS_PROOF_DIRECTORY = 'docs/plans/assets/field-atlas-native-proof-20261103';
export const FIELD_ATLAS_CAPTURE_STEPS = [
  { id:'world-desktop', minWidth:1024, minHeight:600, path:'world-desktop.jpg', actions:['Open /founder; wait for the world canvas'], checks:['worldCanvasOne','worldTitle','retiredShellAbsent','telegramSdkAbsent','consoleClean'] },
  { id:'chart-desktop', minWidth:1024, minHeight:600, path:'chart-desktop.jpg', actions:['Enter world','Open district chart and local passport'], checks:['eightDistricts','keyboardFocusVisible','retiredShellAbsent','consoleClean'] },
  { id:'gate-desktop', minWidth:1024, minHeight:600, path:'gate-desktop.jpg', actions:['Open Founder Gate from the chart','Open Propose a graph update'], checks:['gateFolioVisible','intakeLabelPresent','prepareProposalControl','canonicalGraphReadControl','noAutomaticPost','consoleClean'] },
  { id:'gate-mobile-320', width:320, minHeight:600, path:'gate-mobile-320.jpg', actions:['Open /founder at exact CSS width320','Enter world; chart; Founder Gate; open intake'], checks:['exactCssWidth','noHorizontalOverflow','gateFolioVisible','intakeFits','focusVisible','consoleClean'] },
  { id:'graph-mobile-320', width:320, minHeight:600, path:'graph-mobile-320.jpg', actions:['Read committed graph using the explicitly synthetic local read fixture','Select LumenBar and expand a branch','Select Temperance Engine and expand a branch'], checks:['exactCssWidth','noHorizontalOverflow','twoProductChoices','fixtureCountsMatch','nestedBranchExpands','prerequisitesLabeled','exactDataInitiallyClosed','decisionsNotPublication','consoleClean'] },
  { id:'legacy-query-mobile-320', width:320, minHeight:600, path:'legacy-query-mobile-320.jpg', actions:['Open /founder?world=0&scene=gate in a fresh tab'], checks:['exactCssWidth','worldCanvasOne','retiredShellAbsent','telegramSdkAbsent','noHorizontalOverflow','consoleClean'] },
];
export const FIELD_ATLAS_SOURCE_SHA256 = createHash('sha256').update(PAGE).digest('hex');
export const FIELD_ATLAS_PLAN_SHA256 = createHash('sha256').update(JSON.stringify(FIELD_ATLAS_CAPTURE_STEPS)).digest('hex');

export function fieldAtlasCapturePlan() {
  return { schema:'cambium.field-atlas-capture-plan.v1', scope:'local-synthetic', productionAcceptance:false,
    pageSourceSha256:FIELD_ATLAS_SOURCE_SHA256, planSha256:FIELD_ATLAS_PLAN_SHA256,
    baseUrl:'http://127.0.0.1:5193/founder', steps:FIELD_ATLAS_CAPTURE_STEPS,
    invariants:'Actual browser observations and JPEGs only. Local fixtures are not live D1, platform authentication, founder acceptance or execution proof.' };
}

/** Inspect native JPEG SOF dimensions without transcoding the capture. */
export function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw Error('JPEG signature');
  let offset=2;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) throw Error('JPEG marker');
    while (bytes[offset] === 0xff) offset++;
    const marker=bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset+2 > bytes.length) throw Error('JPEG length');
    const length=bytes.readUInt16BE(offset);
    if (length < 2 || offset+length > bytes.length) throw Error('JPEG segment');
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      if (length < 8) throw Error('JPEG frame');
      const height=bytes.readUInt16BE(offset+3),width=bytes.readUInt16BE(offset+5);
      if (!width || !height) throw Error('JPEG dimensions');
      return {width,height};
    }
    offset+=length;
  }
  throw Error('JPEG frame missing');
}

export function validateFieldAtlasViewportProof(manifest, directory) {
  const failures=[];
  if (!manifest || manifest.schema !== 'cambium.field-atlas-viewport-proof.v1' || manifest.scope !== 'local-synthetic'
    || manifest.productionAcceptance !== false || manifest.physicalDevice !== false || manifest.adapter !== 'codex-iab'
    || manifest.status !== 'passed') failures.push('Field Atlas proof must be an actual bounded local IAB capture');
  if (manifest?.pageSourceSha256 !== FIELD_ATLAS_SOURCE_SHA256) failures.push('Field Atlas PAGE digest is stale');
  if (manifest?.planSha256 !== FIELD_ATLAS_PLAN_SHA256) failures.push('Field Atlas capture plan digest is stale');
  if (!Number.isFinite(Date.parse(manifest?.capturedAt || ''))) failures.push('Field Atlas capture time is missing');
  const rows=Array.isArray(manifest?.proofs)?manifest.proofs:[];
  if (JSON.stringify(rows.map(r=>r.id)) !== JSON.stringify(FIELD_ATLAS_CAPTURE_STEPS.map(s=>s.id))) failures.push('Field Atlas exact capture coverage/order is incomplete');
  const expected=FIELD_ATLAS_CAPTURE_STEPS.map(s=>s.path).sort();
  if (directory) {
    try { if (JSON.stringify(readdirSync(directory).filter(n=>/\.(?:jpe?g|png)$/.test(n)).sort()) !== JSON.stringify(expected)) failures.push('Field Atlas JPEG set differs from the capture plan'); }
    catch { failures.push('Field Atlas screenshot directory is missing'); }
  }
  for (const [index,step] of FIELD_ATLAS_CAPTURE_STEPS.entries()) {
    const row=rows[index]; if (!row) continue;
    if (row.path !== step.path || (step.width && row.viewport?.width !== step.width) || row.viewport?.width < (step.minWidth || step.width) || row.viewport?.height < step.minHeight) failures.push(step.id+': capture path/viewport mismatch');
    if (row.input !== 'native-browser-ui' || step.checks.some(check=>row.checks?.[check] !== true)) failures.push(step.id+': native UI observations are incomplete');
    if (!/^[a-f0-9]{64}$/.test(row.sha256 || '')) failures.push(step.id+': screenshot digest missing');
    if (directory) {
      try {
        const bytes=readFileSync(join(directory,step.path));
        if (bytes.length<1000) throw Error('JPEG');
        const dimensions=jpegDimensions(bytes);
        if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) failures.push(step.id+': screenshot digest mismatch');
        if (dimensions.width !== row.imageWidth || dimensions.height !== row.imageHeight) failures.push(step.id+': screenshot dimensions mismatch');
        if (!(row.imageWidth >= row.viewport?.width && row.imageHeight >= row.viewport?.height)) failures.push(step.id+': screenshot is smaller than the observed CSS viewport');
      } catch { failures.push(step.id+': actual JPEG is missing or invalid'); }
    }
  }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--plan')) console.log(JSON.stringify(fieldAtlasCapturePlan(),null,2));
  else {
    const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
    const directory=join(root,FIELD_ATLAS_PROOF_DIRECTORY);
    let manifest; try { manifest=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8')); } catch {}
    const failures=validateFieldAtlasViewportProof(manifest,directory);
    if (failures.length) { failures.forEach(f=>console.error(f));process.exitCode=1; }
    else console.log('Field Atlas local IAB source/viewport proof passed; production acceptance is separate.');
  }
}
