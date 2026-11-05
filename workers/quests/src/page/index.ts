// Field Atlas is the only serving surface. Retired document fixtures stay isolated.
import { CURIOUS_WORLD_PAGE } from './components/curious-world.ts';
import { WORLD_HOST_CLIENT, WORLD_HOST_HEAD } from './world-host.ts';

export const PAGE = WORLD_HOST_HEAD + WORLD_HOST_CLIENT + CURIOUS_WORLD_PAGE + '</body></html>';
