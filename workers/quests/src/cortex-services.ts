// Existing Quests owner: private service entrypoint, no public reader route.
import { WorkerEntrypoint } from 'cloudflare:workers';
import quests from './index.ts';
import { d1GoalGraphStore } from './goal-graph-store.ts';
import { handleCortexProvenanceRead } from './cortex-provenance-reader.ts';

type Env = Parameters<typeof quests.fetch>[1];

export * from './index.ts';
export default quests;

export class CortexProvenanceReader extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    if (!this.env.BRIDGE_DB) return Response.json({ error: 'authority_unavailable' }, { status: 503 });
    const tenants = new Set((this.env.CONTEXT_ALLOWED_TENANTS ?? '').split(',').map(x => x.trim()).filter(Boolean));
    return handleCortexProvenanceRead(request, d1GoalGraphStore(this.env.BRIDGE_DB), tenants);
  }
}
