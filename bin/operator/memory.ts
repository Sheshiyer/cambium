// Cambium operator · the cortex memory writer + recall builder (M2 / B4 + B5, issues #18, #19).
// B4: after each wake, embed the SITUATION and persist a MemoryRecord (so the operator remembers).
// B5: buildRecall turns cortex.search hits into the Recall the wake attaches to its Decision.
// Both ride the injected CortexStore (node:sqlite local · Vectorize in production). The async work
// lives here + in orchestrate.ts; the pure wake just consumes the precomputed recall.

import type { WorldState, GameEvent, Decision, Recall, RecallHit } from './types.ts';
import type { CortexStore, MemoryRecord, ScoredRecord } from './cortex-memory.ts';
import type { Embedder } from './embed.ts';

/** A compact text of the SITUATION (not the outcome) — so similar situations embed near each other. */
export function situationText(event: GameEvent, world: WorldState): string {
  const detail = event.note ?? event.artifact?.text ?? '';
  return `${event.kind}: ${detail} | positioning: ${world.brand.label}`;
}

/** Turn cortex.search hits into a Recall (above a relevance threshold). Undefined if nothing lands. */
export function buildRecall(hits: ScoredRecord[], threshold = 0.5): Recall | undefined {
  const relevant = hits.filter((h) => h.score >= threshold);
  if (!relevant.length) return undefined;
  const toHit = (h: ScoredRecord): RecallHit => ({
    id: h.record.id,
    score: Number(h.score.toFixed(4)),
    eventKind: String(h.record.payload.eventKind ?? ''),
    action: String(h.record.payload.action ?? ''),
  });
  const list = relevant.map(toHit);
  const nearest = list[0];
  return {
    count: list.length,
    hits: list,
    nearest,
    note: `recall: ${list.length} similar past situation${list.length > 1 ? 's' : ''} → last "${nearest.action}"`,
  };
}

/**
 * Remember one wake: embed the situation and upsert a MemoryRecord (B4). Called AFTER the pure wake
 * (and after recall), so a search never matches the event it is currently writing. `ts` is injected
 * (a logical clock) so the writer stays deterministic in tests. The id carries the world version, so
 * distinct wakes of the same event accumulate distinct records ("seen 3× before").
 */
export async function rememberWake(
  store: CortexStore, embedder: Embedder, world: WorldState, event: GameEvent, decision: Decision, ts: number,
): Promise<MemoryRecord> {
  const text = situationText(event, world);
  const [vector] = await embedder.embed([text]);
  const record: MemoryRecord = {
    id: `${world.tenant}:v${world.version}:${event.id}`,
    kind: 'decision',
    tenant: world.tenant,
    vector,
    payload: {
      eventId: event.id,
      eventKind: event.kind,
      action: decision.action.split(' · recall:')[0],   // store the clean outcome (drop the recall annotation → no nesting)
      routing: decision.routing.class,
      setpointMoved: decision.setpointMoved,
      intent: decision.npc?.founder?.intentBit ?? null,
      version: world.version,
      text,
    },
    ts,
  };
  await store.upsert(record);
  return record;
}
