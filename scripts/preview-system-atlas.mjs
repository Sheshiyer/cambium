import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { injectInitialQuestHydration } from '../workers/quests/src/page/client/data.ts';
import { buildMissionFabricProjection } from '../workers/quests/src/mission-fabric.ts';
import { PAGE } from '../workers/quests/src/page/index.ts';
import { NO_FAKE_PROGRESS_VISUAL_FIXTURE } from '../workers/quests/src/visual-fixtures.ts';

// Explicit public document allowlist. Never serves the private planning symlink,
// arbitrary filesystem paths, account requests, or a proxy to production.
const root = fileURLToPath(new URL('../', import.meta.url));
const files = new Map([
  ['/guide', ['docs/explainers/system-atlas-2026-10-07/index.html', 'text/html']],
  ['/docs/explainers/system-atlas-2026-10-07/index.html', ['docs/explainers/system-atlas-2026-10-07/index.html', 'text/html']],
  ['/docs/explainers/system-atlas-2026-10-07/system-atlas.svg', ['docs/explainers/system-atlas-2026-10-07/system-atlas.svg', 'image/svg+xml']],
  ['/docs/architecture/system-atlas.md', ['docs/architecture/system-atlas.md', 'text/plain']],
  ['/docs/architecture/system-atlas.v1.json', ['docs/architecture/system-atlas.v1.json', 'application/json']],
  ['/docs/architecture/contracts/system-atlas-v1.md', ['docs/architecture/contracts/system-atlas-v1.md', 'text/plain']],
  ['/docs/architecture/contracts/curious-workbench-v1.md', ['docs/architecture/contracts/curious-workbench-v1.md', 'text/plain']],
  ['/docs/explainers/curious-workbench-2026-10-07.md', ['docs/explainers/curious-workbench-2026-10-07.md', 'text/plain']],
  ['/docs/explainers/system-field-guide-2026-09-27/README.md', ['docs/explainers/system-field-guide-2026-09-27/README.md', 'text/plain']],
  ['/docs/assets/visual-flow/system-atlas/PORTRAITS.v1.json', ['docs/assets/visual-flow/system-atlas/PORTRAITS.v1.json', 'application/json']],
]);
const port = Number(process.env.CAMBIUM_ATLAS_PREVIEW_PORT || 18746);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port');
const fixtureDir = resolve(root, 'workers/quests/src/page/scenes/fixtures');
const fixture = async name => JSON.parse(await readFile(resolve(fixtureDir, name+'.fixture.json'), 'utf8'));
const legacyFixtures = await Promise.all(['mission','gate','inspect','story','tools'].map(fixture));
const [mission, gate, inspect, story, tools] = legacyFixtures.map(value => value.states.normal.envelope);
const legacyEnvelope = {
  ...NO_FAKE_PROGRESS_VISUAL_FIXTURE, ...mission,
  schema:1,
  tenant:'cambium', source:'LOCAL_SYNTHETIC_WORKBENCH',
  liveProof:inspect.liveProof, beats:story.beats, commands:tools.commands,
  openItems:gate.openItems, actionRequests:gate.actionRequests,
};
const sources = await Promise.all(['canopy','flow','operating-mission'].map(fixture));
const source = { ...sources[0].states.normal.source, sourceKind:'synthetic-curious-workbench', tenantId:'fx-tenant' };
const arrays = ['saplings','programs','missions','tasks','runtimeRuns','receipts','agents','skillClusters','gaps','fences','evidence'];
const identity = {saplings:'saplingId',programs:'programId',missions:'missionId',tasks:'taskId',runtimeRuns:'runId',receipts:'receiptId',agents:'agentId',skillClusters:'clusterId',gaps:'gapId',fences:'taskId',evidence:'evidenceRef'};
for(const key of arrays) {
  const unique = new Map();
  for(const f of sources) for(const value of f.states.normal.source[key]||[]) {
    if(!unique.has(value[identity[key]])) unique.set(value[identity[key]],value);
  }
  source[key] = [...unique.values()];
}
const projection = buildMissionFabricProjection(source,{tenantId:'fx-tenant',clock:{now:()=>source.asOf}});
const modes = new Set(['legacy','fabric','browser','auth','service','offline','empty']);
function fixturePage(mode) {
  const fabric = mode==='fabric';
  const bridge = fabric ? `<script>window.Telegram={WebApp:{initData:'atlas-synthetic-fixture',ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};</script>` : '';
  const banner = '<aside class="local-fixture-label" style="position:fixed;bottom:0;left:0;right:0;z-index:1000;min-height:28px;padding:6px 12px;background:#00272B;color:#FFC7A1;border-top:1px dashed #FFC7A1;font:10px/1.5 monospace;pointer-events:none" role="status">LOCAL FIXTURE · synthetic data · no live authority</aside>';
  const hydrated = ['auth','service','offline','empty'].includes(mode);
  let page = hydrated ? injectInitialQuestHydration(PAGE) : PAGE;
  if(hydrated) page = page.replace('</head>', '<script>globalThis.__CAMBIUM_INITIAL_QUEST_ENVELOPE__='+JSON.stringify(legacyEnvelope).replace(/</g,'\\u003c')+';</script></head>');
  return page.replace(/<script\b[^>]*\bsrc="https:\/\/telegram\.org\/[^" ]+"[^>]*><\/script>/g, bridge)
    .replace('</head>','<style>:root{--local-fixture-footer:32px}.local-fixture-label{height:var(--local-fixture-footer);box-sizing:border-box}#curious-world{bottom:var(--local-fixture-footer)!important}.app,#operating-fabric.of-on{height:calc(100dvh - 32px)!important}@media(max-width:600px){:root{--local-fixture-footer:48px}}@media(min-width:960px){.app,#operating-fabric.of-on{height:calc(100dvh - 64px)!important}}</style></head>')
    .replace('</body>', banner+'</body>');
}
function requestMode(req) {
  try { const path=new URL(req.headers.referer||'http://127.0.0.1').pathname;return path.split('/')[2]||'legacy'; }
  catch { return 'legacy'; }
}
function respond(res, body, type, head=false) {
  const bytes=Buffer.from(typeof body==='string'?body:JSON.stringify(body));
  res.writeHead(200, { 'Content-Type': type+'; charset=utf-8', 'Content-Length': bytes.length,
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'none'" });
  res.end(head?undefined:bytes);
}
const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
  }
  const path = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  if(path.startsWith('/miniapp/') && modes.has(path.split('/')[2])) {
    respond(res,fixturePage(path.split('/')[2]),'text/html',req.method==='HEAD');return;
  }
  if(path==='/api/quests/cambium') {
    const mode=requestMode(req);
    if(mode==='offline') { res.destroy(); return; }
    if(mode==='auth'||mode==='service') {
      res.writeHead(mode==='auth'?401:503,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(JSON.stringify({error:'synthetic '+mode+' fixture'}));return;
    }
    respond(res,mode==='empty'?{schema:1,tenant:'cambium'}:legacyEnvelope,'application/json',req.method==='HEAD');return;
  }
  if(path==='/v1/mission-fabric/cambium') {
    const mode=requestMode(req);
    if(mode!=='browser' && req.headers['x-telegram-init-data']!=='atlas-synthetic-fixture') {
      res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"synthetic fixture bridge required"}');return;
    }
    respond(res,{projection, delivery:{operatingFabricEnabled:true,servedAt:source.asOf,freshness:'fixture',localSynthetic:true}},'application/json',req.method==='HEAD');return;
  }
  if (path === '/' || path === '/guide') {
    res.writeHead(302, { Location: '/docs/explainers/system-atlas-2026-10-07/index.html' }); res.end(); return;
  }
  const item = files.get(path);
  if (!item) { res.writeHead(404); res.end('Document not in preview allowlist'); return; }
  try {
    const body = await readFile(resolve(root, item[0]));
    res.writeHead(200, { 'Content-Type': item[1] + '; charset=utf-8', 'Content-Length': body.length,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(500); res.end('Generated document unavailable');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Local source atlas: http://127.0.0.1:${port}/guide`));
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
