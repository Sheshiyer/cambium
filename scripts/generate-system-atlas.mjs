import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { SYSTEM_ATLAS } from '../shared/cambium-system-atlas.ts';
import { SYSTEM_ATLAS_PORTRAITS } from '../shared/cambium-system-atlas-portraits.ts';
import { SYSTEM_ATLAS_CSS, SYSTEM_ATLAS_BROWSER } from '../workers/quests/src/page/components/system-atlas.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = 'docs/explainers/system-atlas-2026-10-07';
const hash = value => 'sha256:' + createHash('sha256').update(value).digest('hex');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : null;
if (!mode) throw new Error('Use --write or --check');

const sourcePaths = [...new Set([
  'shared/cambium-system-atlas.ts', 'workers/quests/src/page/components/system-atlas.ts',
  'docs/assets/visual-flow/system-atlas/PORTRAITS.v1.json',
  'docs/architecture/contracts/system-atlas-v1.md',
  ...SYSTEM_ATLAS.organs.map(row => row.source), ...SYSTEM_ATLAS.systems.map(row => row.source),
  ...SYSTEM_ATLAS.organLinks.map(row => row.source), ...SYSTEM_ATLAS.systemLinks.map(row => row.source),
  ...SYSTEM_ATLAS.desks.map(row=>row.source), SYSTEM_ATLAS.retirementSource.path,
])].sort();
const sourceBodies = new Map(await Promise.all(
  sourcePaths.map(async path => [path, await readFile(resolve(root,path),'utf8')])
));
const bindings = sourcePaths.map(path=>({path,sha256:hash(sourceBodies.get(path))}));
const bindRelationship = (row,category) => {
  if(!sourceBodies.get(row.source)?.includes(row.selector))throw new Error(`Atlas selector drift: ${category}:${row.from||row.id} → ${row.to||''}`);
  return {category,from:row.from||row.id,to:row.to||null,source:row.source,selector:row.selector,
    sourceSha256:bindings.find(binding=>binding.path===row.source).sha256,basis:row.basis||'contract'};
};
const relationshipBindings = [
  ...SYSTEM_ATLAS.organLinks.map(row=>bindRelationship(row,'organ')),
  ...SYSTEM_ATLAS.systemLinks.map(row=>bindRelationship(row,'system')),
  ...SYSTEM_ATLAS.desks.map(row=>bindRelationship(row,'desk')),
];
if(!sourceBodies.get(SYSTEM_ATLAS.retirementSource.path)?.includes(SYSTEM_ATLAS.retirementSource.selector))throw new Error('Retirement source selector drift');
const projection = { ...SYSTEM_ATLAS, sourceBindings: bindings, relationshipBindings, modelDigest: hash(JSON.stringify(SYSTEM_ATLAS)) };

function organPoster() {
  const nodes=SYSTEM_ATLAS.organs;
  const positions=Object.fromEntries(nodes.map(row=>[row.id,{x:row.x*10,y:row.y*6.1+60}]));
  const lines=SYSTEM_ATLAS.organLinks.map(link=>{
    const a=positions[link.from],b=positions[link.to];
    return '<path d="M'+a.x+' '+a.y+' C'+a.x+' '+((a.y+b.y)/2)+' '+b.x+' '+((a.y+b.y)/2)+' '+b.x+' '+b.y+'" stroke="'+'#D6FFF6'+'" stroke-opacity=".32" stroke-dasharray="'+(link.kind==='knowledge'?'2 6':link.kind==='evidence'?'8 5':'0')+'"><title>'+esc(link.from+' → '+link.label+' → '+link.to)+'</title></path>';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" role="img" aria-labelledby="atlas-title atlas-desc"><title id="atlas-title">Cambium and Temperance: eleven organ contracts</title><desc id="atlas-desc">Five finite organs above, six continuing stewardship organs below. Cortex is cross-cutting. Connections are source relationships, never live health.</desc><rect width="1000" height="700" fill="#00272B"/><g fill="none" stroke="#D6FFF6" stroke-opacity=".035">'+[80,125,170,215,260,305,350,395].map(r=>'<ellipse cx="490" cy="350" rx="'+r*1.3+'" ry="'+r+'"/>').join('')+'</g><g font-family="system-ui,sans-serif" fill="#D6FFF6"><text x="32" y="40" font-size="27">One living system.</text><text x="968" y="38" text-anchor="end" font-size="12">SOURCE CONTRACTS / 2026-10-07</text><text x="32" y="98" fill="#E0FF4F" font-size="12">CAMBIUM / FINITE COMPOSITION</text><text x="32" y="441" fill="#D6FFF6" font-size="12">TEMPERANCE / CONTINUING STEWARDSHIP</text></g><g fill="none">'+lines+'</g><g font-family="system-ui,sans-serif" text-anchor="middle" fill="#D6FFF6">'+nodes.map(row=>{
    const p=positions[row.id];return '<image href="'+SYSTEM_ATLAS_PORTRAITS[row.id]+'" x="'+(p.x-42)+'" y="'+(p.y-42)+'" width="84" height="84"/><text x="'+p.x+'" y="'+(p.y+60)+'" font-size="17">'+row.name+'</text><text x="'+p.x+'" y="'+(p.y+80)+'" font-size="11" opacity=".7">'+row.verb+'</text>';
  }).join('')+'</g><path d="M32 415 H968" stroke="#D6FFF6" stroke-opacity=".16" stroke-dasharray="2 7"/><text x="32" y="674" fill="#D6FFF6" opacity=".65" font-family="monospace" font-size="11">Knowledge · execution · evidence · projection / proposals return to a fresh gate.</text></svg>\n';
}

const context=vm.createContext({});
vm.runInContext(SYSTEM_ATLAS_BROWSER,context,{timeout:1000});
const initial=vm.runInContext('CambiumSystemAtlas.render("organs","genesis","atlas-root")',context,{timeout:1000});
const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cambium · The connected system</title>
<meta name="description" content="A visual source atlas: eleven organs, six growth desks, distinct owners and governed proof loops.">
<style>
:root{--bg:#00272B;--bg2:#012F34;--ink:#E0FF4F;--soft:#D6FFF6;--warn:#FFC7A1;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--soft);font:15px/1.5 system-ui,sans-serif}a{color:var(--ink)}.atlas-document{max-width:1440px;margin:auto;padding:24px 32px 48px}.atlas-document-nav{display:flex;justify-content:space-between;gap:20px;font:11px var(--mono);letter-spacing:.06em;margin-bottom:24px}.atlas-document-nav a{text-decoration:none}.atlas-document-hero{margin:0 0 20px;display:flex;gap:24px;justify-content:space-between;align-items:end}.atlas-document-hero h1{font-size:clamp(30px,4vw,48px);line-height:1.05;font-weight:500;letter-spacing:-.045em;margin:8px 0}.atlas-document-hero p{max-width:470px;font-size:14px;opacity:.72}.atlas-document-note{max-width:270px;font:11px/1.7 var(--mono);opacity:.7}.atlas-document-bottom{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px;margin-top:48px}.atlas-document-bottom h2{font-size:18px;font-weight:500}.atlas-document-bottom p{font-size:13px;line-height:1.7;opacity:.76}.atlas-document-bottom code{font:11px var(--mono)}.atlas-document-ref{font:10px/1.7 var(--mono);opacity:.65;overflow-wrap:anywhere;margin-top:40px}noscript img{width:100%}@media(max-width:700px){.atlas-document{padding:24px 14px 40px}.atlas-document-nav{font-size:9px;margin-bottom:28px}.atlas-document-hero{display:block}.atlas-document-hero h1{font-size:40px}.atlas-document-note{max-width:none}.atlas-document-bottom{grid-template-columns:1fr;gap:12px;margin-top:28px}}
${SYSTEM_ATLAS_CSS}
</style></head><body><main class="atlas-document">
<nav class="atlas-document-nav" aria-label="Document navigation"><span>CAMBIUM / VISUAL FIELD GUIDE</span><a href="../../architecture/system-atlas.md">Architecture source ↗</a></nav>
<header class="atlas-document-hero"><div><div class="atlas-kicker">Eleven organs. Distinct owners. One proof loop.</div><h1>The connected system.</h1><p>Select an organ. Follow its contract and the proof loop.</p></div><p class="atlas-document-note">Local source edition / 07 October 2026<br>Source contracts · runtime proof held.</p></header>
<div id="atlas-root">${initial}</div><noscript><img src="system-atlas.svg" alt="The eleven organ source contracts"><p>Enable JavaScript to inspect contracts. The static map remains readable.</p></noscript>
<section class="atlas-document-bottom" aria-label="Reading the system"><div><div class="atlas-kicker">01 / Finite work</div><h2>Compose. Verify. Stop.</h2><p>Genesis forms a source system. Taste grades it. Hands makes the admitted artifact. Will interprets the outcome. Cortex carries scoped evidence across that work.</p></div><div><div class="atlas-kicker">02 / Continuing stewardship</div><h2>Notice. Learn. Propose.</h2><p>The six Temperance organs orient, probe and learn from bounded work. A useful recommendation returns to a fresh gate; it never grants its own authority.</p></div><div><div class="atlas-kicker">03 / Distinct proof</div><h2>Permission ≠ delivery ≠ outcome.</h2><p>Access and Plexus establish read scope. Telegram signatures bind founder actions. Receipts distinguish an admitted action, a transport attempt and a verified result.</p></div></section>
<p class="atlas-document-ref">Model ${projection.modelDigest}<br>Curated public contracts; private growth prose stays in its owning vault.<br><a href="../system-field-guide-2026-09-27/README.md">Historical full field guide</a> · <a href="../../assets/visual-flow/system-atlas/PORTRAITS.v1.json">Portrait lineage</a></p>
</main><script>${SYSTEM_ATLAS_BROWSER}\nCambiumSystemAtlas.mount(document.getElementById('atlas-root'));</script></body></html>\n`;

function systemDiagram() {
  const nodes=SYSTEM_ATLAS.systems.map(row=>'  '+row.id+'["'+row.name+'"]');
  const links=SYSTEM_ATLAS.systemLinks.map(row=>'  '+row.from+(row.basis==='conceptual'?' -.->':' -->')+'|'+(row.basis==='conceptual'?'conceptual / held: ':'')+row.label+'| '+row.to);
  return ['flowchart LR',...nodes,...links].join('\n');
}

const table=SYSTEM_ATLAS.organs.map(row=>`| ${row.name} | ${row.family} | ${row.inputs.join(' + ')} | ${row.outputs.join(' + ')} |`).join('\n');
const markdown=`# The connected system — source atlas\n\n[Open the interactive visual guide](../explainers/system-atlas-2026-10-07/index.html).\n\n![Eleven organs and their source relationships](../explainers/system-atlas-2026-10-07/system-atlas.svg)\n\nThe same public-safe model and renderer serve the Mini App atlas and the visual\nfield guide. This edition is source evidence; local interaction proof and live\noperational acceptance remain separate. It adds no command, identity or schedule.\n\n| Organ | Family | Receives | Produces |\n| --- | --- | --- | --- |\n${table}\n\nCortex is cross-cutting. Finite composition runs Genesis → Taste → Hands → Will.\nThe six growth desks sit inside Will and use existing execution owners.\n\n\`\`\`mermaid\n${systemDiagram()}\n\`\`\`\n\nPermission, transport and semantic receipts occupy separate strata. An admin\nemail, successful transport, source image or local render cannot replace them.\nCurrent Access policy, Plexus membership, organ callback/containment/usefulness,\nlearning and soak acceptance require named owner receipts.\n\nPrivate growth prose stays in the vault; the atlas uses the reviewed public\ngrowth topology. Effectful enrollment input and incomplete cell machine verbs\nremain held. Superset, Constellation and the retired app planes are historical.\nSnow Gloves local recovery is a separate product proof, not Cambium deployment.\n\nSource contract: [system-atlas-v1](contracts/system-atlas-v1.md).\nMachine projection: [system-atlas.v1.json](system-atlas.v1.json).\nPortrait provenance: [PORTRAITS.v1.json](../assets/visual-flow/system-atlas/PORTRAITS.v1.json).\n\nVerify without writing:\n\n\`\`\`sh\nnode scripts/build-system-atlas-portraits.mjs --check\nnode scripts/generate-system-atlas.mjs --check\n\`\`\`\n\nGenerated by \`scripts/generate-system-atlas.mjs\`; model digest ${projection.modelDigest}.\n`;

const outputs=new Map([
  ['docs/architecture/system-atlas.v1.json',JSON.stringify(projection,null,2)+'\n'],
  ['docs/architecture/system-atlas.md',markdown],
  [directory+'/index.html',html],
  [directory+'/system-atlas.svg',organPoster()],
]);
for(const [path,content] of outputs){
  const absolute=resolve(root,path);
  if(mode==='check'){if(await readFile(absolute,'utf8')!==content)throw new Error(`Generated atlas drift: ${path}`);}
  else {await mkdir(resolve(absolute,'..'),{recursive:true});await writeFile(absolute,content);}
}
console.log(JSON.stringify({mode,outputs:outputs.size,organs:SYSTEM_ATLAS.organs.length,desks:SYSTEM_ATLAS.desks.length,htmlBytes:Buffer.byteLength(html),modelDigest:projection.modelDigest}));
