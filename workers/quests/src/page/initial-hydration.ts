import { WORLD_HYDRATION_MARKER } from './world-host.ts';

const INITIAL_WORLD_HYDRATION = `function takeInitialQuestEnvelope(){
  const env = globalThis.__CAMBIUM_INITIAL_QUEST_ENVELOPE__;
  globalThis.__CAMBIUM_INITIAL_QUEST_ENVELOPE__ = undefined;
  if (!env || typeof env !== 'object' || Array.isArray(env)) return null;
  if (env.schema !== 1 || env.tenant !== TENANT) return null;
  if (typeof env.derivedAt !== 'string' || !Number.isFinite(Date.parse(env.derivedAt))) return null;
  if (!env.ledger || typeof env.ledger !== 'object' || Array.isArray(env.ledger) || !Array.isArray(env.ledger.rows)) return null;
  return env;
}
const INITIAL_QUEST_ENVELOPE = takeInitialQuestEnvelope();
if (INITIAL_QUEST_ENVELOPE) paint(INITIAL_QUEST_ENVELOPE);`;

export function injectInitialQuestHydration(page: string): string {
  const index = page.indexOf(WORLD_HYDRATION_MARKER);
  if (index < 0 || index !== page.lastIndexOf(WORLD_HYDRATION_MARKER)) throw new Error('world page must contain exactly one hydration marker');
  return page.replace(WORLD_HYDRATION_MARKER, INITIAL_WORLD_HYDRATION);
}
