// Quine hypha · teamforge — the operator control plane emitter (live story lane).
// TeamForge (forge.thoughtseed.space) emits project lifecycle: open projects, sync
// conflicts, and the sync journal (operations as they happen). This hypha reads the
// agent-feed export and turns recent activity into source:"teamforge" narrative beats
// so the org's project plane joins the story alongside MultiCA agent activity.
//
// Auth: bearer token from env (TEAMFORGE_FEED_TOKEN, falling back to
// TF_WEBHOOK_HMAC_SECRET) — the route's app secret. forge.thoughtseed.space is ALSO
// behind Cloudflare Access, so a bearer-only call 302s; pass Access with a service
// token via CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET (added as CF-Access-* headers
// when present), OR point TEAMFORGE_FEED_URL at a reachable instance (e.g. a local
// `wrangler dev` at http://127.0.0.1:8787/v1/agent-feed/export, the paperclip pattern).
// Secrets never printed. Fail-soft: if unset/unreachable, the caller drops the forge
// lane and the story keeps its other sources.

import type { StoryBeat } from '../../operator/narrative/narrative.ts';

const DEFAULT_FEED_URL = 'https://forge.thoughtseed.space/v1/agent-feed/export';

interface ForgeProject { id: string; slug: string | null; name: string; status: string; client_name: string | null; updated_at: string }
interface ForgeConflict { id: string; project_id: string; conflict_type: string; detected_at: string; resolved_at: string | null }
interface ForgeJournal { id: string; project_id: string; operation: string; status: string; created_at: string }
interface ForgeFeed {
  generated_at: string;
  open_projects: ForgeProject[];
  unresolved_conflicts: ForgeConflict[];
  recent_journal: ForgeJournal[];
}

function feedConfig(): { url: string; token: string } | null {
  const token = process.env.TEAMFORGE_FEED_TOKEN || process.env.TF_WEBHOOK_HMAC_SECRET || '';
  if (!token) return null;
  return { url: process.env.TEAMFORGE_FEED_URL || DEFAULT_FEED_URL, token };
}

async function fetchFeed(): Promise<ForgeFeed> {
  const cfg = feedConfig();
  if (!cfg) throw new Error('no TEAMFORGE_FEED_TOKEN / TF_WEBHOOK_HMAC_SECRET');
  const headers: Record<string, string> = { authorization: `Bearer ${cfg.token}` };
  // Pass Cloudflare Access (service token) so the request isn't 302'd at the edge.
  const cfId = process.env.CF_ACCESS_CLIENT_ID, cfSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (cfId && cfSecret) { headers['CF-Access-Client-Id'] = cfId; headers['CF-Access-Client-Secret'] = cfSecret; }
  const res = await fetch(cfg.url, { headers, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`teamforge agent-feed → ${res.status}`);
  const body: any = await res.json();
  const data = body?.data ?? body;
  return {
    generated_at: data?.generated_at ?? '',
    open_projects: Array.isArray(data?.open_projects) ? data.open_projects : [],
    unresolved_conflicts: Array.isArray(data?.unresolved_conflicts) ? data.unresolved_conflicts : [],
    recent_journal: Array.isArray(data?.recent_journal) ? data.recent_journal : [],
  };
}

/**
 * Recent TeamForge activity as narrative beats (source: "teamforge") — REAL records
 * only. Sync-journal operations are the live pulse; unresolved conflicts are the
 * attention beats (set apart as noesis). Project names resolve from open_projects.
 */
export async function teamforgeActivityBeats(limit = 6): Promise<StoryBeat[]> {
  const feed = await fetchFeed();
  const nameOf = new Map(feed.open_projects.map((p) => [p.id, p.name || p.slug || p.id]));
  const beats: Array<StoryBeat & { _t: number }> = [];

  for (const j of feed.recent_journal) {
    const proj = nameOf.get(j.project_id) ?? j.project_id;
    const verb = j.status === 'ok' || j.status === 'success' ? 'synced' : j.status === 'error' ? 'failed' : j.status;
    beats.push({
      n: null,
      text: `TeamForge ${verb} ${j.operation} for ${proj}.`,
      lane: 'forge',
      noesis: false,
      source: 'teamforge',
      raw: `${j.project_id} ${j.operation} ${j.status}`,
      _t: Date.parse(j.created_at) || 0,
    });
  }

  for (const c of feed.unresolved_conflicts) {
    const proj = nameOf.get(c.project_id) ?? c.project_id;
    beats.push({
      n: null,
      text: `Sync conflict on ${proj}: ${c.conflict_type} — needs resolution.`,
      lane: 'forge',
      noesis: true,
      source: 'teamforge',
      raw: `${c.project_id} ${c.conflict_type} unresolved`,
      _t: Date.parse(c.detected_at) || 0,
    });
  }

  return beats
    .sort((a, b) => a._t - b._t)
    .slice(-limit)
    .map(({ _t, ...beat }) => beat);
}
