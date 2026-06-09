// Cambium operator · the async orchestration around the pure wake. The LLM (NPCs) + NIM (embeddings)
// + the cortex (memory: recall + remember) calls live HERE; `wake` stays pure/sync and just consumes
// the precomputed readings. INFINITE-GAME.md §9 · cortex memory: M2 B4 (remember) + B5 (recall).

import type { WorldState, GameEvent, Decision, IcpReading, FounderReading, Recall } from './types.ts';
import type { CortexStore, MemoryRecord } from './cortex-memory.ts';
import { route } from './router.ts';
import { wake } from './operator.ts';
import { realFounder } from './npc.ts';
import { makeEmbedder, type Embedder } from './embed.ts';
import { resolveIcp, ensureSetpoint } from './resonance.ts';
import { situationText, buildRecall, rememberWake } from './memory.ts';

export interface OrchestrateOpts {
  record: (line: string) => void;
  embedder?: Embedder;
  store?: CortexStore;                              // the cortex memory (node:sqlite local · Vectorize prod)
  icpOpts?: Parameters<typeof resolveIcp>[1]['icpOpts'];
  founderOpts?: Parameters<typeof realFounder>[2];
  alpha?: number;
  recallK?: number;                                 // how many past situations to recall (default 5)
  now?: () => number;                               // injected clock for the memory ts (default Date.now)
  rememberMemory?: boolean;                         // set false to recall without writing (dry)
}

/**
 * Process one event end-to-end:
 *   B5 recall (meso/macro): embed the situation → cortex.search the nearest PAST situations → inject
 *   meso resolve: the real ICP gradient + the Founder intent
 *   the pure wake (consumes recall/icp/founder; references recall in the ledger)
 *   B4 remember: persist THIS wake as a MemoryRecord (after recall, so it never matches itself)
 * Also guarantees the setpoint x* is a real embedding (dims match the embedder).
 */
export async function wakeAsync(
  world: WorldState, event: GameEvent, opts: OrchestrateOpts,
): Promise<{ world: WorldState; decision: Decision; icp?: IcpReading; founder?: FounderReading; recall?: Recall; memory?: MemoryRecord }> {
  const e = opts.embedder ?? makeEmbedder();
  const w0 = await ensureSetpoint(world, e);
  const lane = route(event).lane;

  // B5 · RECALL — for meso/macro, search the cortex for similar PAST situations (before this one is written)
  let recall: Recall | undefined;
  if (opts.store?.ready() && (lane === 'meso' || lane === 'macro')) {
    const [qv] = await e.embed([situationText(event, w0)]);
    recall = buildRecall(opts.store.search(qv, opts.recallK ?? 5, { tenant: w0.tenant }));
  }

  // meso · resolve the real ICP gradient + the Founder intent
  let icp: IcpReading | undefined;
  let founder: FounderReading | undefined;
  if (lane === 'meso') {
    icp = await resolveIcp(w0, { embedder: e, icpOpts: opts.icpOpts });
    founder = await realFounder(event, { vision: w0.vision, mission: w0.mission }, opts.founderOpts);
  }

  const { world: next, decision } = wake(w0, event, {
    record: opts.record,
    alpha: opts.alpha,
    icp: icp ? () => icp! : undefined,
    founder: founder ? () => founder! : undefined,
    recall: recall ? () => recall! : undefined,
  });

  // B4 · REMEMBER — persist this wake (after recall, so a search never matches the event writing it)
  let memory: MemoryRecord | undefined;
  if (opts.store?.ready() && opts.rememberMemory !== false) {
    memory = await rememberWake(opts.store, e, next, event, decision, opts.now?.() ?? Date.now());
  }

  return { world: next, decision, icp, founder, recall, memory };
}
