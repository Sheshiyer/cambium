#!/usr/bin/env node
/**
 * Read-only Explee inventory for IVerif project 16763.
 * Methods used: GET only. Never POST/PATCH.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://api.explee.com';
const PREFIX = '/public/api/v1/autogtm';
const PROJECT_ID = 16763;
const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const ALLOWED_METHODS = new Set(['GET']);

function loadApiKey() {
  const envPath = `${process.env.HOME}/.claude/.env`;
  const text = readFileSync(envPath, 'utf8');
  const line = text.split(/\r?\n/).find((l) => /^EXPLEE_API_KEY=/.test(l));
  if (!line) throw new Error('EXPLEE_API_KEY missing in ~/.claude/.env');
  const value = line.slice('EXPLEE_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
  if (!value) throw new Error('EXPLEE_API_KEY empty');
  return value;
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function redactDeep(value, path = []) {
  if (Array.isArray(value)) return value.map((v, i) => redactDeep(v, path.concat(i)));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const key = k.toLowerCase();
    const piiKey = /^(email|emails|full_name|first_name|last_name|name|phone|address|linkedin|subject|body|message|content|raw|token|secret|authorization|reply_cc_emails)$/i;
    const metricAllow = /^(emails_sent|total_emails_sent|name)$/i; // campaign name + send counts are operational, not mailbox PII
    if (key === 'name' && path.includes('campaign')) {
      out[k] = v; // keep campaign names
      continue;
    }
    if (piiKey.test(key) && !metricAllow.test(key)) {
      if (typeof v === 'string' && v.length) out[k] = `redacted:sha256:${sha256(v).slice(0, 16)}`;
      else if (v == null) out[k] = v;
      else out[k] = 'redacted';
      continue;
    }
    out[k] = redactDeep(v, path.concat(k));
  }
  return out;
}

async function getJson(apiKey, path, query = {}) {
  if (![...ALLOWED_METHODS].includes('GET')) throw new Error('method policy');
  const url = new URL(ORIGIN + path);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      accept: 'application/json',
    },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch {
    body = { parse_error: true, bytes: text.length };
  }
  return {
    ok: res.ok,
    status: res.status,
    url: url.pathname + url.search,
    method: 'GET',
    body: redactDeep(body),
    rawBody: body,
  };
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function campaignMetrics(c, analytics) {
  const a = analytics || {};
  const emailsSent = num(a.emails_sent ?? a.emailsSent ?? c.emails_sent);
  const replies = num(a.replies ?? c.replies);
  const spend = num(a.spend_usd ?? a.spendUsd ?? c.spend_usd ?? c.spend);
  const hot = num(a.hot_leads ?? a.hotLeads);
  const replyRate = emailsSent > 0 ? (replies / emailsSent) * 100 : num(a.reply_rate_percent ?? a.replyRatePercent);
  const costPerReply = replies > 0 ? spend / replies : null;
  const costPerHot = hot > 0 ? spend / hot : null;
  return { emailsSent, replies, spend, hot, replyRate, costPerReply, costPerHot };
}

function classifyMoneyGuzzler(m) {
  if (m.spend >= 50 && m.replyRate < 1.5) return 'money_guzzler';
  if (m.spend >= 20 && m.replies === 0) return 'money_guzzler';
  if (m.spend >= 20 && m.costPerReply != null && m.costPerReply > 20) return 'money_guzzler';
  if (m.spend > 0 && m.replyRate >= 3 && m.replies >= 3) return 'relative_winner';
  if (m.spend > 0 && m.replies > 0) return 'mixed';
  if (m.spend === 0 && m.emailsSent === 0) return 'idle';
  return 'inconclusive';
}

const apiKey = loadApiKey();
const observedAt = new Date().toISOString();
const networkLog = [];

async function trackedGet(path, query) {
  const result = await getJson(apiKey, path, query);
  networkLog.push({ method: 'GET', url: result.url, status: result.status, ok: result.ok });
  if (!result.ok) {
    console.error('GET failed', result.status, result.url);
  }
  return result;
}

const projects = await trackedGet(`${PREFIX}/projects`);
const campaigns = await trackedGet(`${PREFIX}/campaigns`, { project_id: PROJECT_ID });
const projectAnalytics = await trackedGet(`${PREFIX}/projects/${PROJECT_ID}/analytics`, { period: 'all' });
const autopilot = await trackedGet(`${PREFIX}/projects/${PROJECT_ID}/autopilot`);

const campaignList = Array.isArray(campaigns.rawBody)
  ? campaigns.rawBody
  : Array.isArray(campaigns.rawBody?.campaigns)
    ? campaigns.rawBody.campaigns
    : Array.isArray(campaigns.rawBody?.items)
      ? campaigns.rawBody.items
      : [];

const detailed = [];
for (const c of campaignList) {
  const id = c.campaign_id ?? c.id ?? c.campaignId;
  if (!id) continue;
  const analytics = await trackedGet(`${PREFIX}/campaigns/${id}/analytics`, { period: 'all' });
  const detail = await trackedGet(`${PREFIX}/campaigns/${id}`);
  const metrics = campaignMetrics(c, analytics.rawBody);
  const label = classifyMoneyGuzzler(metrics);
  // Inbox counts only (need_reply + replied), redacted contacts
  const needReply = await trackedGet(`${PREFIX}/campaigns/${id}/inbox`, { tab: 'need_reply', limit: 50, offset: 0 });
  const replied = await trackedGet(`${PREFIX}/campaigns/${id}/inbox`, { tab: 'replied', limit: 50, offset: 0 });
  const contactsNeed = Array.isArray(needReply.rawBody?.contacts) ? needReply.rawBody.contacts
    : Array.isArray(needReply.rawBody?.items) ? needReply.rawBody.items
    : Array.isArray(needReply.rawBody) ? needReply.rawBody : [];
  const contactsReplied = Array.isArray(replied.rawBody?.contacts) ? replied.rawBody.contacts
    : Array.isArray(replied.rawBody?.items) ? replied.rawBody.items
    : Array.isArray(replied.rawBody) ? replied.rawBody : [];

  detailed.push({
    campaignId: id,
    name: c.name ?? c.campaign ?? detail.rawBody?.name ?? detail.rawBody?.campaign ?? String(id),
    status: c.status ?? detail.rawBody?.status ?? null,
    statusReason: c.status_reason ?? detail.rawBody?.status_reason ?? null,
    metrics,
    label,
    analytics: analytics.body,
    detail: detail.body,
    inbox: {
      needReplyTotal: needReply.rawBody?.total ?? contactsNeed.length,
      repliedTotal: replied.rawBody?.total ?? contactsReplied.length,
      needReplySample: contactsNeed.slice(0, 50).map((x) => ({
        personId: x.person_id ?? x.personId ?? x.id ?? null,
        latestIntent: x.latest_intent ?? x.latestIntent ?? null,
        sentCount: x.sent_count ?? x.sentCount ?? null,
        replyCount: x.reply_count ?? x.replyCount ?? null,
        latestSentAt: x.latest_sent_at ?? x.latestSentAt ?? null,
        latestReplyAt: x.latest_reply_at ?? x.latestReplyAt ?? null,
      })),
      repliedSample: contactsReplied.slice(0, 50).map((x) => ({
        personId: x.person_id ?? x.personId ?? x.id ?? null,
        latestIntent: x.latest_intent ?? x.latestIntent ?? null,
        sentCount: x.sent_count ?? x.sentCount ?? null,
        replyCount: x.reply_count ?? x.replyCount ?? null,
        latestSentAt: x.latest_sent_at ?? x.latestSentAt ?? null,
        latestReplyAt: x.latest_reply_at ?? x.latestReplyAt ?? null,
      })),
    },
  });
}

detailed.sort((a, b) => b.metrics.spend - a.metrics.spend);

const inventory = {
  schema: 'cambium.iverif.explee-campaign-inventory.v1',
  observedAt,
  projectId: PROJECT_ID,
  provider: 'explee-public-api',
  posture: {
    methods: ['GET'],
    mutation_enabled: false,
    do_not_post: true,
    spend_freeze: true,
  },
  network: {
    calls: networkLog.length,
    methods: [...new Set(networkLog.map((x) => x.method))],
    nonGet: networkLog.filter((x) => x.method !== 'GET'),
    failures: networkLog.filter((x) => !x.ok),
  },
  projects: projects.body,
  projectAnalytics: projectAnalytics.body,
  autopilot: autopilot.body,
  campaignCount: detailed.length,
  campaigns: detailed,
};

mkdirSync(join(OUT_DIR, 'raw-redacted'), { recursive: true });
writeFileSync(join(OUT_DIR, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
writeFileSync(join(OUT_DIR, 'network-log.json'), JSON.stringify(networkLog, null, 2) + '\n');

// CRM export: opaque contacts across campaigns
const contacts = [];
for (const c of detailed) {
  for (const bucket of ['needReplySample', 'repliedSample']) {
    for (const row of c.inbox[bucket]) {
      if (!row.personId) continue;
      contacts.push({
        contactId: `explee:${PROJECT_ID}:${c.campaignId}:${row.personId}`,
        personId: row.personId,
        source: 'explee-public-api',
        projectId: PROJECT_ID,
        campaignId: c.campaignId,
        campaignName: c.name,
        channelHints: ['email'], // Explee inbox; non-Explee reuse is export only
        latestIntent: row.latestIntent,
        sentCount: row.sentCount,
        replyCount: row.replyCount,
        latestSentAt: row.latestSentAt,
        latestReplyAt: row.latestReplyAt,
        nextAction: row.latestIntent === 'hot_lead' ? 'human_review_qualify' : row.latestIntent === 'unsubscribe' ? 'suppress' : 'classify',
        pii: 'redacted_at_boundary',
      });
    }
  }
}
const crm = {
  schema: 'cambium.iverif.crm-export.v1',
  observedAt,
  purpose: 'non-explee-channel reuse via other organs; not an Explee write back',
  projectId: PROJECT_ID,
  contactCount: contacts.length,
  contacts,
};
writeFileSync(join(OUT_DIR, 'crm', 'contacts.json'), JSON.stringify(crm, null, 2) + '\n');

console.log(JSON.stringify({
  observedAt,
  campaignCount: detailed.length,
  networkCalls: networkLog.length,
  nonGet: inventory.network.nonGet.length,
  failures: inventory.network.failures.length,
  spendTotal: detailed.reduce((s, c) => s + c.metrics.spend, 0),
  guzzlers: detailed.filter((c) => c.label === 'money_guzzler').map((c) => ({ id: c.campaignId, name: c.name, spend: c.metrics.spend, replies: c.metrics.replies })),
}, null, 2));
