// cambium-quests · miniapp page assembler (T-009 pure refactor).
// Concatenates the page/* chunks in served order. The byte-identical era ended at P2-W1:
// frozen-spec visual changes land here now; keep assembly order explicit and stable.
import { STYLE_TOKENS } from './styles/tokens.ts';
import { STYLE_TOOLS } from './styles/tools.ts';
import { STYLE_MISSION } from './styles/mission.ts';
import { STYLE_COMPONENTS } from './styles/components.ts';
import { STYLE_INSPECT } from './styles/inspect.ts';
import { STYLE_STORY } from './styles/story.ts';
import { STYLE_GATE } from './styles/gate.ts';
import { STYLE_SHEET } from './styles/sheet.ts';
import { STYLE_STATES } from './styles/states.ts';
import { SCAFFOLD } from './scaffold.ts';
import { CLIENT_CORE } from './client/core.ts';
import { GLYPHS } from './glyphs.ts';
import { COMPONENT_MISSION_CONTROL } from './components/mission-control.ts';
import { COMPONENT_GALLERY } from './components/gallery.ts';
import { CLIENT_BOOT } from './client/boot.ts';
import { CLIENT_SCENE_ENGINE } from './client/scene-engine.ts';
import { SCENE_TOOLS } from './scenes/tools.ts';
import { CLIENT_GESTURES } from './client/gestures.ts';
import { CLIENT_SHEET } from './client/sheet.ts';
import { CLIENT_SIGNED_ACTION } from './client/signed-action.ts';
import { SCENE_MISSION } from './scenes/mission.ts';
import { SCENE_INSPECT } from './scenes/inspect.ts';
import { SCENE_STORY } from './scenes/story.ts';
import { CLIENT_FRESHNESS } from './client/freshness.ts';
import { CLIENT_DATA } from './client/data.ts';
import { OPERATING_FABRIC_PAGE } from './operating-fabric/index.ts';

// LEGACY_PAGE freezes the current concatenation verbatim — no chunk moves,
// reorders, or rewrites. PAGE injects the inert operating fabric fragment at
// the single legacy </body> index; removing the fragment restores LEGACY_PAGE
// byte-for-byte. PAGE stays the handler's only document export.
export const LEGACY_PAGE =
  STYLE_TOKENS +
  STYLE_TOOLS +
  STYLE_MISSION +
  STYLE_COMPONENTS +
  STYLE_INSPECT +
  STYLE_STORY +
  STYLE_GATE +
  STYLE_SHEET +
  STYLE_STATES +
  SCAFFOLD +
  CLIENT_CORE +
  GLYPHS +
  COMPONENT_MISSION_CONTROL +
  COMPONENT_GALLERY +
  CLIENT_BOOT +
  CLIENT_SCENE_ENGINE +
  SCENE_TOOLS +
  CLIENT_GESTURES +
  CLIENT_SHEET +
  CLIENT_SIGNED_ACTION +
  SCENE_MISSION +
  SCENE_INSPECT +
  SCENE_STORY +
  CLIENT_FRESHNESS +
  CLIENT_DATA;

const bodyClose = '</body>';
const bodyCloseIndex = LEGACY_PAGE.indexOf(bodyClose);
if (bodyCloseIndex < 0 || bodyCloseIndex !== LEGACY_PAGE.lastIndexOf(bodyClose)) {
  throw new Error('legacy page must contain exactly one closing body tag');
}

export const PAGE =
  LEGACY_PAGE.slice(0, bodyCloseIndex) +
  OPERATING_FABRIC_PAGE +
  LEGACY_PAGE.slice(bodyCloseIndex);
