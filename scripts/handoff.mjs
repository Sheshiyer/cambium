#!/usr/bin/env node
/**
 * handoff — founder CLI for the secure member-handoff system.
 *
 * Adds team members to the allowlist, mints
 * single-use invite LINKS, lists/revokes members. Members redeem the link in
 * Plexus to get a per-member bridge token (scoped to only their memberId, expires
 * monthly, rotatable). Endpoints live on any deployed Cambium worker.
 *
 * Admin auth = BRIDGE_TOKEN (the cofounder bridge token). Read from env or
 * ~/.claude/.env. Never printed.
 *
 * Usage:
 *   handoff add <memberId> <email>     add a member to the allowlist (status: invited)
 *   handoff invite <memberId>          mint a single-use invite link (7-day expiry)
 *   handoff list                       list members + status + token expiry
 *   handoff revoke <memberId>          revoke a member's access
 *
 * Flags: --base <url> (default $CAMBIUM_PUBLIC_BASE_URL or http://127.0.0.1:8787)
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_BASE = process.env.CAMBIUM_PUBLIC_BASE_URL || 'http://127.0.0.1:8787';
const BASE = (() => { const i = process.argv.indexOf('--base'); return i > -1 ? process.argv[i + 1] : DEFAULT_BASE; })();

function adminToken() {
  if (process.env.BRIDGE_TOKEN) return process.env.BRIDGE_TOKEN;
  try {
    const txt = readFileSync(join(homedir(), '.claude', '.env'), 'utf8');
    const line = txt.split('\n').find((l) => l.startsWith('BRIDGE_TOKEN='));
    return line?.slice('BRIDGE_TOKEN='.length).replace(/^["']|["']$/g, '').trim();
  } catch { return undefined; }
}

async function api(method, path, body) {
  const tok = adminToken();
  if (!tok) { console.error('No BRIDGE_TOKEN (env or ~/.claude/.env). It is the cofounder admin token.'); process.exit(2); }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${tok}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) { console.error(`error ${res.status}: ${j.error ?? JSON.stringify(j)}`); process.exit(1); }
  return j;
}

const [cmd, a1, a2] = process.argv.slice(2).filter((x) => x !== '--base' && x !== BASE);

if (cmd === 'add') {
  if (!a1 || !a2) { console.error('usage: handoff add <memberId> <email>'); process.exit(2); }
  const r = await api('POST', '/v1/handoff/members', { memberId: a1, email: a2 });
  console.log(`added ${r.member.memberId} <${r.member.email}> — status ${r.member.status}`);
  console.log(`next: handoff invite ${r.member.memberId}`);
} else if (cmd === 'invite') {
  if (!a1) { console.error('usage: handoff invite <memberId>'); process.exit(2); }
  const r = await api('POST', '/v1/handoff/invite', { memberId: a1 });
  console.log(`invite for ${r.memberId} <${r.email}> — expires ${r.expiresAt}`);
  console.log(`\nshare this link (single-use):\n  ${r.link}\n`);
} else if (cmd === 'list') {
  const r = await api('GET', '/v1/handoff/members');
  if (!r.members.length) {
    console.log('(no members yet — handoff add <memberId> <email>)');
  } else {
    for (const m of r.members) console.log(`${m.memberId}\t${m.status}\t${m.email}\t${m.tokenExpiresAt ? 'token→' + m.tokenExpiresAt : '(no token)'}`);
  }
} else if (cmd === 'revoke') {
  if (!a1) { console.error('usage: handoff revoke <memberId>'); process.exit(2); }
  const r = await api('POST', '/v1/handoff/revoke', { memberId: a1 });
  console.log(`revoked ${r.memberId}`);
} else {
  console.log(readFileSync(new URL(import.meta.url)).toString().split('\n').slice(1, 27).join('\n').replace(/^ \*\/?/gm, '').trim());
  process.exit(cmd ? 0 : 1);
}
