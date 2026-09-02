// Reads-only live harness for the Phase G Mission Fabric read client.
//
// Usage:
//   BASE_URL=http://127.0.0.1:8787 TENANT=cambium \
//     node workers/quests/src/mission-fabric-live-read.mjs
//
// Optional Access service-token headers (deployed endpoint behind CF Access):
//   CF_ACCESS_CLIENT_ID=... CF_ACCESS_CLIENT_SECRET=... BASE_URL=https://<your-deployed-host> ...
//
// GET only. Never writes. Prints the client's gap/summary verdict as JSON so
// the outcome is auditable. Exits 0 on ok projection, 2 on a gap (still a valid,
// non-crashing result), 1 only on an unexpected harness error.
import { readMissionFabric } from './mission-fabric-read-client.ts';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const tenantId = process.env.TENANT ?? 'cambium';

const headers = {};
if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
  headers['cf-access-client-id'] = process.env.CF_ACCESS_CLIENT_ID;
  headers['cf-access-client-secret'] = process.env.CF_ACCESS_CLIENT_SECRET;
}

const result = await readMissionFabric({
  baseUrl,
  tenantId,
  liveReads: true,
  auth: { headers },
  timeoutMs: 15_000,
});

if (result.ok) {
  const p = result.projection;
  const byKind = {};
  for (const n of p.nodes) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    tenantId,
    graphVersion: result.graphVersion,
    graphDigest: result.graphDigest,
    counts: { nodes: p.nodes.length, edges: p.edges.length, gaps: p.gaps.length, byKind },
  }, null, 2));
  process.exit(0);
} else {
  console.log(JSON.stringify({ ok: false, baseUrl, tenantId, reason: result.reason, detail: result.detail, status: result.status }, null, 2));
  process.exit(2);
}
