// cambium-quests · miniapp page chunk — URL params, tenant, refresh route, start scene, app state
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const CLIENT_BOOT = `const PARAMS = new URLSearchParams(location.search);
const TENANT = (PARAMS.get('tenant')
  || (TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) || 'cambium').replace(/[^a-z0-9-]/gi,'') || 'cambium';
const REFRESH_ROUTE = '/api/quests/' + TENANT;
const SCENE_PARAM = String(PARAMS.get('scene') || '').toLowerCase();
const START_SCENE = ({ mission:0, quests:0, quest:0, q:0, gate:1, tools:2, commands:2, story:3, inspect:4, map:4, components:4, component:4, board:4 }[SCENE_PARAM] ?? 0);
$('ten').textContent = TENANT;
let LEDGER = null;
let ECOSYSTEM_ENV = null;
let FRESHNESS_STATE = { derivedAt:'missing', source:'missing', age:null, stale:true, detail:'no freshness' };
let MISSION_BRANCH_FOCUS = '';
let INSPECT_PANE = 'proof';

`;
