// cambium-quests · miniapp page chunk — URL params, tenant, refresh route, start scene, app state
// URL initialization retains the five scenes and adds the Inspect/System pane deep link.
// Assembly order: page/index.ts.
export const CLIENT_BOOT = `const PARAMS = new URLSearchParams(location.search);
const TENANT = (PARAMS.get('tenant')
  || (TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) || 'cambium').replace(/[^a-z0-9-]/gi,'') || 'cambium';
// /founder is the Cloudflare Access founder web surface: reads and Gate posts
// stay under the protected prefix so the edge always carries the Access JWT.
const FOUNDER_PATH = String((typeof location !== 'undefined' && location && location.pathname) || '');
const FOUNDER_WEB = FOUNDER_PATH === '/founder' || FOUNDER_PATH.indexOf('/founder/') === 0;
const API_BASE = FOUNDER_WEB ? '/founder' : '';
const REFRESH_ROUTE = API_BASE + '/api/quests/' + TENANT;
const SCENE_PARAM = String(PARAMS.get('scene') || '').toLowerCase();
const START_SCENE = ({ mission:0, quests:0, quest:0, q:0, gate:1, tools:2, commands:2, story:3, inspect:4, map:4, components:4, component:4, board:4 }[SCENE_PARAM] ?? 0);
$('ten').textContent = TENANT;
let LEDGER = null;
let ECOSYSTEM_ENV = null;
let FRESHNESS_STATE = { derivedAt:'missing', source:'missing', age:null, stale:true, detail:'no freshness' };
let MISSION_BRANCH_FOCUS = '';
let INSPECT_PANE = SCENE_PARAM === 'inspect' && PARAMS.get('pane') === 'system' ? 'system' : 'proof';

`;
