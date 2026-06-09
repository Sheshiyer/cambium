// Cambium operator · the async orchestration around the pure wake. The LLM (NPCs) + NIM (embeddings)
// calls live HERE; `wake` stays pure/sync and just consumes the precomputed readings. INFINITE-GAME.md §9.

import type { WorldState, GameEvent, Decision, IcpReading, FounderReading } from './types.ts';
import { route } from './router.ts';
import { wake } from './operator.ts';
import { realFounder } from './npc.ts';
import { makeEmbedder, type Embedder } from './embed.ts';
import { resolveIcp, ensureSetpoint } from './resonance.ts';

export interface OrchestrateOpts {
  record: (line: string) => void;
  embedder?: Embedder;
  icpOpts?: Parameters<typeof resolveIcp>[1]['icpOpts'];
  founderOpts?: Parameters<typeof realFounder>[2];
  alpha?: number;
}

/**
 * Process one event end-to-end: route → (for meso) resolve the real ICP gradient + the real Founder
 * intent → the pure wake. Also guarantees the setpoint x* is a real embedding (dims match the embedder).
 */
export async function wakeAsync(
  world: WorldState, event: GameEvent, opts: OrchestrateOpts,
): Promise<{ world: WorldState; decision: Decision; icp?: IcpReading; founder?: FounderReading }> {
  const e = opts.embedder ?? makeEmbedder();
  const w0 = await ensureSetpoint(world, e);
  let icp: IcpReading | undefined;
  let founder: FounderReading | undefined;

  if (route(event).lane === 'meso') {
    icp = await resolveIcp(w0, { embedder: e, icpOpts: opts.icpOpts });
    founder = await realFounder(event, { vision: w0.vision, mission: w0.mission }, opts.founderOpts);
  }

  const { world: next, decision } = wake(w0, event, {
    record: opts.record,
    alpha: opts.alpha,
    icp: icp ? () => icp! : undefined,
    founder: founder ? () => founder! : undefined,
  });
  return { world: next, decision, icp, founder };
}
