import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IVERIF_EXPLEE_ORIGIN,
  IVerifExpleeError,
  createIVerifExpleeObserver,
} from './iverif-explee.ts';

const OBSERVED_AT = '2026-07-16T07:00:00.000Z';

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

const projectAnalytics = {
  project_id: 16_763,
  period: 'all',
  total_emails_sent: 6_439,
  total_replies: 31,
  overall_reply_rate_pct: 0.5,
  total_hot_leads: 6,
  total_spend_usd: 193.17,
  campaigns: [{ name: 'pii-upstream-campaign-name', target_url: 'pii-target-url' }],
};

const campaignAnalytics = {
  campaign_id: 45_711,
  name: 'pii-upstream-name',
  status: 'outreach',
  status_reason: null,
  period: 'all',
  emails_sent: 2_921,
  total_replies: 17,
  reply_rate_pct: 0.6,
  hot_leads: 6,
  spend_usd: 87.63,
  cost_per_lead_usd: 14.61,
  daily_budget_usd: 9,
  leads_pool_used: 2_779,
  leads_pool_total: 2_887,
  manual_status_counts: { 'pii-arbitrary-key': 8 },
};

const autopilot = {
  project_id: 16_763,
  autopilot_enabled: true,
  auto_reply_enabled: true,
  auto_reply_delay_minutes: 1_440,
  reply_cc_emails: ['pii-cc@example.invalid'],
};

test('IVerif snapshot uses only fixed GET endpoints and redacts arbitrary fields', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes('/projects/16763/analytics')) return jsonResponse(projectAnalytics);
    if (url.includes('/campaigns/45711/analytics')) return jsonResponse(campaignAnalytics);
    if (url.endsWith('/projects/16763/autopilot')) return jsonResponse(autopilot);
    throw new Error(`unexpected URL ${url}`);
  };
  const observer = createIVerifExpleeObserver({
    apiKey: 'test-key',
    fetchImpl,
    now: () => OBSERVED_AT,
  });

  const snapshot = await observer.getSnapshot();

  assert.equal(snapshot.campaign.campaign, 'Public Agencies');
  assert.equal(snapshot.campaign.emailsSent, 2_921);
  assert.equal(snapshot.project.emailsSent, 6_439);
  assert.equal(snapshot.autopilot.autoReplyEnabled, true);
  assert.equal(snapshot.source.observedAt, OBSERVED_AT);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.url.startsWith(IVERIF_EXPLEE_ORIGIN)));
  assert.ok(calls.every((call) => call.init?.method === 'GET'));
  assert.ok(calls.every((call) => call.init?.redirect === 'error'));
  assert.ok(calls.every((call) => (call.init?.headers as Record<string, string>)['x-api-key'] === 'test-key'));
  assert.doesNotMatch(JSON.stringify(snapshot), /pii-/);
});

test('IVerif inbox follows bounded need_reply pagination and emits redacted contacts', async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const pages = [
    {
      contacts: [{
        person_id: 'person-1',
        email: 'pii-email@example.invalid',
        name: 'pii-name',
        latest_subject: 'pii-subject',
        latest_intent: 'hot_lead',
        sent_count: 2,
        reply_count: 1,
        latest_sent_at: '2026-07-15T00:00:00Z',
        latest_reply_at: '2026-07-15T01:00:00Z',
        phone: 'pii-phone',
        linkedin_url: 'pii-linkedin',
        address: 'pii-address',
      }],
      total: 2,
      has_more: true,
      next_offset: 1,
    },
    {
      contacts: [{
        person_id: 'person-2',
        email: 'pii-second@example.invalid',
        name: 'pii-second-name',
        latest_subject: 'pii-second-subject',
        latest_intent: 'not_interested',
        sent_count: 1,
        reply_count: 1,
        latest_sent_at: '2026-07-15T02:00:00Z',
        latest_reply_at: '2026-07-15T03:00:00Z',
      }],
      total: 2,
      has_more: false,
      next_offset: null,
    },
  ];
  const observer = createIVerifExpleeObserver({
    apiKey: 'test-key',
    now: () => OBSERVED_AT,
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), method: init?.method });
      return jsonResponse(pages[calls.length - 1]);
    },
  });

  const inbox = await observer.getNeedReplyInbox();

  assert.equal(inbox.tab, 'need_reply');
  assert.equal(inbox.total, 2);
  assert.equal(inbox.pageCount, 2);
  assert.equal(inbox.truncated, false);
  assert.deepEqual(inbox.contacts.map((contact) => contact.personId), ['person-1', 'person-2']);
  assert.ok(calls.every((call) => call.method === 'GET'));
  assert.match(calls[0].url, /tab=need_reply&limit=50&offset=0$/);
  assert.match(calls[1].url, /tab=need_reply&limit=50&offset=1$/);
  assert.doesNotMatch(JSON.stringify(inbox), /pii-/);
});

test('IVerif inbox stops at the configured page bound without retrying', async () => {
  let calls = 0;
  const observer = createIVerifExpleeObserver({
    apiKey: 'test-key',
    maxInboxPages: 2,
    now: () => OBSERVED_AT,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({
        contacts: [{
          person_id: `person-${calls}`,
          latest_intent: 'hot_lead',
          sent_count: 1,
          reply_count: 1,
          latest_sent_at: null,
          latest_reply_at: null,
        }],
        total: 9,
        has_more: true,
        next_offset: calls,
      });
    },
  });

  const inbox = await observer.getNeedReplyInbox();

  assert.equal(calls, 2);
  assert.equal(inbox.pageCount, 2);
  assert.equal(inbox.truncated, true);
});

test('IVerif inbox omits nullable person ids and applies published count defaults', async () => {
  const observer = createIVerifExpleeObserver({
    apiKey: 'test-key',
    now: () => OBSERVED_AT,
    fetchImpl: async () => jsonResponse({
      contacts: [
        { person_id: null, latest_intent: null },
        { person_id: 'person-defaults', latest_intent: null },
      ],
      total: 2,
      has_more: false,
      next_offset: null,
    }),
  });

  const inbox = await observer.getNeedReplyInbox();

  assert.equal(inbox.omittedContacts, 1);
  assert.equal(inbox.contacts.length, 1);
  assert.equal(inbox.contacts[0].personId, 'person-defaults');
  assert.equal(inbox.contacts[0].sentCount, 0);
  assert.equal(inbox.contacts[0].replyCount, 0);
});

test('IVerif thread retains opaque state while dropping message and lead PII', async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const observer = createIVerifExpleeObserver({
    apiKey: 'test-key',
    now: () => OBSERVED_AT,
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), method: init?.method });
      return jsonResponse({
        can_reply: true,
        reply_blocked_reason: null,
        latest_intent: 'hot_lead',
        lead: {
          name: 'pii-lead-name',
          email: 'pii-lead@example.invalid',
          phone: 'pii-lead-phone',
          linkedin_url: 'pii-lead-linkedin',
          company_name: 'pii-company',
          company_domain: 'pii-domain',
        },
        messages: [{
          type: 'reply',
          from_email: 'pii-from@example.invalid',
          to_email: 'pii-to@example.invalid',
          subject: 'pii-thread-subject',
          body_text: 'pii-thread-body',
          message_id: '<message-1@pii-message-domain.invalid>',
          in_reply_to: 'pii-in-reply-to',
          references: 'pii-references',
          intent: 'hot_lead',
          status: null,
          ts: '2026-07-15T04:00:00Z',
        }],
        extra: 'pii-arbitrary',
      });
    },
  });

  const thread = await observer.getThread('person-1');

  assert.equal(thread.personId, 'person-1');
  assert.equal(thread.canReply, true);
  assert.equal(thread.messageCount, 1);
  assert.equal(thread.truncated, false);
  assert.equal(thread.messages.length, 1);
  assert.match(thread.messages[0].messageId ?? '', /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual({ ...thread.messages[0], messageId: 'projected' }, {
    messageId: 'projected',
    type: 'reply',
    intent: 'hot_lead',
    status: null,
    timestamp: '2026-07-15T04:00:00.000Z',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.match(calls[0].url, /\/campaigns\/45711\/inbox\/person-1$/);
  assert.doesNotMatch(JSON.stringify(thread), /pii-/);
});

test('IVerif thread projection bounds message history and reports truncation', async () => {
  const messages = Array.from({ length: 101 }, (_, index) => ({
    type: index % 2 === 0 ? 'sent' : 'reply',
    message_id: `message-${index}`,
    intent: index % 2 === 0 ? null : 'hot_lead',
    status: index % 2 === 0 ? 'sent' : null,
    ts: '2026-07-15T04:00:00Z',
  }));
  const observer = createIVerifExpleeObserver({
    apiKey: 'test-key',
    fetchImpl: async () => jsonResponse({
      can_reply: true,
      reply_blocked_reason: null,
      latest_intent: 'hot_lead',
      messages,
    }),
  });

  const thread = await observer.getThread('person-1');

  assert.equal(thread.messageCount, 101);
  assert.equal(thread.truncated, true);
  assert.equal(thread.messages.length, 100);
  assert.match(thread.messages[0].messageId ?? '', /^sha256:[a-f0-9]{64}$/);
  assert.match(thread.messages[99].messageId ?? '', /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(thread.messages[0].messageId, thread.messages[99].messageId);
});

test('IVerif observer rejects provider responses above the body-size limit', async () => {
  const observer = createIVerifExpleeObserver({
    apiKey: 'test-key',
    fetchImpl: async () => jsonResponse(projectAnalytics, {
      headers: { 'content-length': String(300_000) },
    }),
  });

  await assert.rejects(
    () => observer.getProjectAnalytics(),
    (error: unknown) => error instanceof IVerifExpleeError && error.code === 'upstream_invalid_response',
  );
});

test('IVerif observer keeps its timeout active while reading the response body', async () => {
  const observer = createIVerifExpleeObserver({
    apiKey: 'test-key',
    timeoutMs: 250,
    fetchImpl: async (_input, init) => new Response(new ReadableStream({
      start(controller) {
        init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
      },
    })),
  });

  await assert.rejects(
    () => observer.getProjectAnalytics(),
    (error: unknown) => {
      assert.ok(error instanceof IVerifExpleeError);
      assert.equal(error.code, 'upstream_timeout');
      assert.equal(error.retryable, true);
      return true;
    },
  );
});

test('IVerif rejects malformed person identifiers before provider access', async () => {
  let called = false;
  const observer = createIVerifExpleeObserver({
    apiKey: 'test-key',
    fetchImpl: async () => {
      called = true;
      throw new Error('must not be called');
    },
  });

  await assert.rejects(
    () => observer.getThread('../person@example.invalid'),
    (error: unknown) => error instanceof IVerifExpleeError && error.code === 'bad_person_id',
  );
  assert.equal(called, false);
});

test('IVerif rate limiting returns bounded retry metadata without body leakage or retry', async () => {
  let calls = 0;
  const observer = createIVerifExpleeObserver({
    apiKey: 'test-key',
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ detail: 'pii-upstream-error-body' }, {
        status: 429,
        headers: { 'retry-after': '99999' },
      });
    },
  });

  await assert.rejects(
    () => observer.getCampaignAnalytics(),
    (error: unknown) => {
      assert.ok(error instanceof IVerifExpleeError);
      assert.equal(error.code, 'upstream_rate_limited');
      assert.equal(error.retryable, true);
      assert.equal(error.retryAfterSeconds, 3_600);
      assert.doesNotMatch(error.message, /pii-/);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('IVerif observer refuses missing provider configuration', () => {
  assert.throws(
    () => createIVerifExpleeObserver({ apiKey: '   ' }),
    (error: unknown) => error instanceof IVerifExpleeError && error.code === 'not_configured',
  );
});

test('IVerif observer rejects provider responses for any other project or campaign', async () => {
  const observer = createIVerifExpleeObserver({
    apiKey: 'test-key',
    fetchImpl: async (input) => String(input).includes('/projects/')
      ? jsonResponse({ ...projectAnalytics, project_id: 99_999 })
      : jsonResponse({ ...campaignAnalytics, campaign_id: 99_999 }),
  });

  for (const read of [
    () => observer.getProjectAnalytics(),
    () => observer.getCampaignAnalytics(),
  ]) {
    await assert.rejects(
      read,
      (error: unknown) => error instanceof IVerifExpleeError && error.code === 'upstream_invalid_response',
    );
  }
});

test('IVerif observer rejects logically impossible project analytics', async () => {
  const impossibleAnalytics = [
    { ...projectAnalytics, overall_reply_rate_pct: 100.01 },
    { ...projectAnalytics, total_replies: projectAnalytics.total_emails_sent + 1 },
    { ...projectAnalytics, total_hot_leads: projectAnalytics.total_replies + 1 },
  ];

  for (const analytics of impossibleAnalytics) {
    const observer = createIVerifExpleeObserver({
      apiKey: 'test-key',
      fetchImpl: async () => jsonResponse(analytics),
    });
    await assert.rejects(
      () => observer.getProjectAnalytics(),
      (error: unknown) => error instanceof IVerifExpleeError && error.code === 'upstream_invalid_response',
    );
  }
});

test('IVerif observer rejects logically impossible campaign analytics', async () => {
  const impossibleAnalytics = [
    { ...campaignAnalytics, reply_rate_pct: 100.01 },
    { ...campaignAnalytics, total_replies: campaignAnalytics.emails_sent + 1 },
    { ...campaignAnalytics, hot_leads: campaignAnalytics.total_replies + 1 },
    { ...campaignAnalytics, leads_pool_used: campaignAnalytics.leads_pool_total + 1 },
  ];

  for (const analytics of impossibleAnalytics) {
    const observer = createIVerifExpleeObserver({
      apiKey: 'test-key',
      fetchImpl: async () => jsonResponse(analytics),
    });
    await assert.rejects(
      () => observer.getCampaignAnalytics(),
      (error: unknown) => error instanceof IVerifExpleeError && error.code === 'upstream_invalid_response',
    );
  }
});

test('IVerif observer allowlists provider labels instead of relaying arbitrary strings', async () => {
  const observer = createIVerifExpleeObserver({
    apiKey: 'test-key',
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('/analytics')) {
        return jsonResponse({ ...campaignAnalytics, status: 'sk_explee_provider_secret' });
      }
      if (url.includes('/inbox?')) {
        return jsonResponse({
          contacts: [{
            person_id: 'person-1',
            latest_intent: 'john_doe_private_note',
            sent_count: 1,
            reply_count: 1,
            latest_sent_at: null,
            latest_reply_at: null,
          }],
          total: 1,
          has_more: false,
          next_offset: null,
        });
      }
      return jsonResponse({
        can_reply: true,
        reply_blocked_reason: 'private_reason',
        latest_intent: 'sk_explee_provider_secret',
        messages: [{
          type: 'reply',
          message_id: 'message-1',
          intent: 'john_doe_private_note',
          status: 'private_status',
          ts: '2026-07-15T04:00:00Z',
        }],
      });
    },
  });

  await assert.rejects(
    () => observer.getCampaignAnalytics(),
    (error: unknown) => error instanceof IVerifExpleeError && error.code === 'upstream_invalid_response',
  );
  const inbox = await observer.getNeedReplyInbox();
  assert.equal(inbox.contacts[0].latestIntent, null);
  const thread = await observer.getThread('person-1');
  assert.equal(thread.latestIntent, null);
  assert.equal(thread.replyBlockedReason, null);
  assert.equal(thread.messages[0].intent, null);
  assert.equal(thread.messages[0].status, null);
  assert.doesNotMatch(JSON.stringify({ inbox, thread }), /sk_explee|john_doe|private_/);
});
