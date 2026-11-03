import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE } from '../workers/quests/src/page.ts';
import { withServer, captureViewportProof } from '../workers/quests/src/visual-viewport-proof.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const FIELD_ATLAS_ROOT = realpathSync(fileURLToPath(new URL('..',import.meta.url)));
const sourcePaths = ['scripts/capture-field-atlas.mjs','workers/quests/src/visual-viewport-proof.mjs'];
export const fieldAtlasSourceBindings = () => sourcePaths.map(path => ({path,sha256:hash(readFileSync(new URL(`../${path}`,import.meta.url)))}));
export function fieldAtlasSourceIdentity() {
  const git = args => execFileSync('git',args,{cwd:FIELD_ATLAS_ROOT,encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).trim();
  return {sourceBaseCommit:git(['rev-parse','HEAD']),workingTreeModified:git(['status','--porcelain']).length>0};
}
export function prepareFieldAtlasDirectory(root = FIELD_ATLAS_ROOT) {
  const base = join(realpathSync(root),'.artifacts');
  try {
    const entry = lstatSync(base);
    if (entry.isSymbolicLink() || !entry.isDirectory()) throw new Error('Field atlas artifact root must be an owned directory');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  mkdirSync(base,{recursive:true});
  if (realpathSync(base) !== base) throw new Error('Field atlas artifact root must be an owned directory');
  return mkdtempSync(join(base,'field-atlas-current-'));
}
export const FIELD_ATLAS_PAGE_DIGEST = hash(PAGE);
export const FIELD_ATLAS_CAPTURE_STEPS = [
  ['entry', 390, 844], ['world', 320, 844], ['world', 390, 844], ['world', 430, 932],
  ['world', 1280, 900], ['chart', 390, 844], ['departments', 390, 844], ['departments', 1280, 900],
].map(([state, width, height]) => ({
  path: `field-atlas-${state}-${width}.png`, state, viewport: { width, height },
  webgl: true, desktopPageBrowser: width >= 1000, exactViewport: width < 1000,
  waitFor: "document.querySelector('#curious-world canvas') && document.getElementById('curious-world-fallback').hidden",
  ...(state === 'world' ? { tapTargetSelector: '.cw-begin' } : {}),
  ...(['chart', 'departments'].includes(state) ? {
    keyboardTargetSelector: '.cw-begin', keyboardKey: 'Enter',
    pointerTargetSelector: state === 'chart' ? '.cw-map-button' : '.cw-top-actions button:first-child',
  } : {}),
  waitAfterExpression: state === 'entry' ? "document.querySelector('.cw-intro')?.hidden === false"
    : state === 'world' ? "document.querySelector('#curious-world')?.dataset.walking === 'true'"
      : `document.querySelector('dialog.cw-dialog')?.open && document.querySelector('.cw-dialog-title')?.textContent === ${JSON.stringify(state === 'chart' ? 'The field chart' : 'Product departments')}`,
  assertExpression: `(() => {
    const root=document.querySelector('#curious-world'), canvas=root?.querySelector('canvas');
    const dialog=root?.querySelector('dialog.cw-dialog'), intro=root?.querySelector('.cw-intro');
    const bounds=(dialog?.open ? dialog : root)?.getBoundingClientRect();
    const checks={canvas:!!canvas && canvas.width>0 && canvas.height>0,
      rendererAvailable:document.getElementById('curious-world-fallback')?.hidden === true,
      sourceEvidence:root?.dataset.evidence === 'source',
      viewport:innerWidth===${width} && innerHeight===${height},
      contained:!!bounds && bounds.left>=-1 && bounds.right<=innerWidth+1,
      state:${state === 'entry' ? "intro?.hidden === false" : state === 'world' ? "root?.dataset.walking === 'true' && intro?.hidden === true" : `dialog?.open === true && dialog.querySelector('.cw-dialog-title')?.textContent === ${JSON.stringify(state === 'chart' ? 'The field chart' : 'Product departments')}`},
      ${state === 'departments' ? "ownerHold:dialog?.textContent.includes('Department source reader unavailable') === true," : ''}
    };
    return {ok:Object.values(checks).every(v=>v===true),checks};
  })()`,
}));
export const FIELD_ATLAS_STEP_DIGEST = hash(JSON.stringify(FIELD_ATLAS_CAPTURE_STEPS));

export function validateFieldAtlasCapture(manifest, readPng) {
  const errors = [];
  if (typeof readPng !== 'function') return ['PNG artifact reader is required'];
  if (manifest?.schema !== 'cambium.field-atlas-capture-proposal.v1'
      || manifest.pageSourceSha256 !== FIELD_ATLAS_PAGE_DIGEST || manifest.captureStepSha256 !== FIELD_ATLAS_STEP_DIGEST) errors.push('Capture source or instruction binding is stale');
  if (JSON.stringify(manifest?.sourceBindings) !== JSON.stringify(fieldAtlasSourceBindings())) errors.push('Capture helper source binding is stale');
  if (manifest?.canonicalAcceptance !== false || manifest.liveAcceptance !== false || manifest.physicalDevice !== false
      || manifest.mockGatePostCount !== 0 || manifest.evidenceScope !== 'local-source-fixture') errors.push('Capture authority/scope is invalid');
  const proofs = manifest?.proofs ?? [];
  if (!Array.isArray(proofs)) return [...errors, 'Capture rows must be an array'];
  if (JSON.stringify(proofs.map(row => row?.path)) !== JSON.stringify(FIELD_ATLAS_CAPTURE_STEPS.map(row => row.path))) errors.push('Capture coverage/order is incomplete');
  for (const [index, proof] of proofs.entries()) {
    const step = FIELD_ATLAS_CAPTURE_STEPS[index];
    if (!step || proof?.path !== step.path) { errors.push('Capture path is outside the supported steps'); continue; }
    const checkKeys = ['canvas','rendererAvailable','sourceEvidence','viewport','contained','state',...(step.state === 'departments' ? ['ownerHold'] : [])].sort();
    if (!step || proof.state !== step.state || proof.stepSha256 !== hash(JSON.stringify(step))
        || JSON.stringify(proof.viewport) !== JSON.stringify(step.viewport)
        || proof.capture?.ok !== true || !proof.capture.checks
        || JSON.stringify(Object.keys(proof.capture.checks).sort()) !== JSON.stringify(checkKeys)
        || Object.values(proof.capture.checks).some(value => value !== true)) errors.push(`Browser observation is unconfirmed for ${proof.path}`);
    if (!/^[a-f0-9]{64}$/.test(proof.sha256) || hash(readPng(proof.path)) !== proof.sha256) errors.push(`PNG binding is invalid for ${proof.path}`);
  }
  return errors;
}

/** Diagnostic-only current-source captures. The retired 47-frame canonical
 * contract and its assets stay untouched pending a precise owner decision. */
export async function captureFieldAtlas() {
  const directory = prepareFieldAtlasDirectory();
  const sourceIdentity = fieldAtlasSourceIdentity();
  const startedBindings = fieldAtlasSourceBindings();
  const proofs = [];
  let mockGatePostCount = 0;
  await withServer(async (origin, metrics) => {
    for (const step of FIELD_ATLAS_CAPTURE_STEPS) {
      const file = join(directory, step.path);
      const observed = await captureViewportProof(`${origin}/?tenant=cambium`, file, step);
      const bytes = readFileSync(file);
      proofs.push({ path:step.path,state:step.state,viewport:step.viewport,
        stepSha256:hash(JSON.stringify(step)),capture:observed.assertion,
        browser:observed.browser,browserMode:observed.browserMode,
        width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bytes:bytes.length,sha256:hash(bytes) });
      console.log(`captured ${step.path}`);
    }
    mockGatePostCount = metrics.gatePostCount();
  });
  const manifest = { schema:'cambium.field-atlas-capture-proposal.v1',observedAt:new Date().toISOString(),
    ...sourceIdentity,
    sourceBindings:startedBindings,
    pageSourceSha256:FIELD_ATLAS_PAGE_DIGEST,captureStepSha256:FIELD_ATLAS_STEP_DIGEST,
    evidenceScope:'local-source-fixture',renderer:'local software WebGL',
    canonicalAcceptance:false,liveAcceptance:false,physicalDevice:false,mockGatePostCount,proofs };
  const errors = validateFieldAtlasCapture(manifest, path => readFileSync(join(directory,path)));
  if (JSON.stringify(sourceIdentity) !== JSON.stringify(fieldAtlasSourceIdentity())) errors.push('Capture source revision changed while reading');
  if (JSON.stringify(startedBindings) !== JSON.stringify(fieldAtlasSourceBindings())) errors.push('Capture source changed while reading');
  if (errors.length) throw new Error(errors.join('\n'));
  writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return {directory,manifest};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  captureFieldAtlas().then(({directory,manifest})=>console.log(JSON.stringify({directory,proofs:manifest.proofs.length,pageSourceSha256:manifest.pageSourceSha256,canonicalAcceptance:false})))
    .catch(error=>{console.error(error.message);process.exitCode=1;});
}
