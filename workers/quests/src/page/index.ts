// cambium-quests · miniapp page assembler (T-009 pure refactor).
// Concatenates the page/* chunks in served order. The result is byte-identical to the
// former monolithic page.ts PAGE string; proof tooling pins sha256(PAGE), so keep order stable.
import { STYLE_TOKENS } from './styles/tokens.ts';
import { STYLE_TOOLS } from './styles/tools.ts';
import { STYLE_MISSION } from './styles/mission.ts';
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

export const PAGE =
  STYLE_TOKENS +
  STYLE_TOOLS +
  STYLE_MISSION +
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
