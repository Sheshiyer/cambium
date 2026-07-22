import { IVERIF_GROUNDING } from './iverif-grounding.ts';

export const IVERIF_EXPLEE_ORIGIN = 'https://api.explee.com';
const API_PREFIX = '/public/api/v1/autogtm';
const DEFAULT_TIMEOUT_MS = 5_000;
const MIN_TIMEOUT_MS = 250;
const MAX_TIMEOUT_MS = 10_000;
const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024;
const INBOX_PAGE_SIZE = 50;
const DEFAULT_MAX_INBOX_PAGES = 3;
const MAX_INBOX_PAGES = 4;
const MAX_THREAD_MESSAGES = 100;
const SAFE_OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PERIODS = new Set(['today', '7d', '30d', 'all']);
const MESSAGE_TYPES = new Set(['sent', 'reply']);
const CAMPAIGN_STATUSES = new Set([
  'discovery', 'starting', 'searching', 'review', 'outreach', 'listening',
  'budget_paused', 'card_paused', 'stopped', 'launch_failed', 'archived', 'error',
]);
const CAMPAIGN_STATUS_REASONS = new Set([
  'user_pause', 'budget_pause', 'lead_pool_exhausted', 'sending_completed', 'billing_pause',
]);
const REPLY_INTENTS = new Set(['hot_lead', 'not_interested', 'out_of_office', 'unsubscribe']);
const REPLY_BLOCK_REASONS = new Set(['unsubscribe', 'no_reply']);
const DELIVERY_STATUSES = new Set(['queued', 'sent', 'delivered', 'bounced', 'failed']);

export type IVerifExpleeErrorCode =
  | 'not_configured'
  | 'bad_person_id'
  | 'upstream_auth_failed'
  | 'upstream_not_found'
  | 'upstream_rate_limited'
  | 'upstream_timeout'
  | 'upstream_unavailable'
  | 'upstream_invalid_response';

export class IVerifExpleeError extends Error {
  readonly code: IVerifExpleeErrorCode;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;

  constructor(code: IVerifExpleeErrorCode, options: { retryable?: boolean; retryAfterSeconds?: number } = {}) {
    super(code);
    this.name = 'IVerifExpleeError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export interface IVerifProjectAnalytics {
  projectId: number;
  period: string;
  emailsSent: number;
  replies: number;
  replyRatePercent: number;
  hotLeads: number;
  spendUsd: number;
}

export interface IVerifCampaignAnalytics {
  campaignId: number;
  campaign: string;
  status: string;
  statusReason: string | null;
  period: string;
  emailsSent: number;
  replies: number;
  replyRatePercent: number;
  hotLeads: number;
  spendUsd: number;
  costPerLeadUsd: number;
  dailyBudgetUsd: number;
  poolUsed: number;
  poolTotal: number;
}

export interface IVerifAutopilotState {
  projectId: number;
  autopilotEnabled: boolean;
  autoReplyEnabled: boolean;
  autoReplyDelayMinutes: number;
}

export interface IVerifInboxContact {
  personId: string;
  latestIntent: string | null;
  sentCount: number;
  replyCount: number;
  latestSentAt: string | null;
  latestReplyAt: string | null;
}

export interface IVerifThreadMessage {
  messageId: string | null;
  type: 'sent' | 'reply';
  intent: string | null;
  status: string | null;
  timestamp: string | null;
}

export interface IVerifExpleeSource {
  provider: 'explee-public-api';
  observedAt: string;
}

export interface IVerifSnapshotObservation {
  source: IVerifExpleeSource;
  project: IVerifProjectAnalytics;
  campaign: IVerifCampaignAnalytics;
  autopilot: IVerifAutopilotState;
}

export interface IVerifInboxObservation {
  source: IVerifExpleeSource;
  tab: 'need_reply';
  contacts: IVerifInboxContact[];
  total: number;
  omittedContacts: number;
  pageCount: number;
  truncated: boolean;
}

export interface IVerifThreadObservation {
  source: IVerifExpleeSource;
  personId: string;
  canReply: boolean;
  replyBlockedReason: string | null;
  latestIntent: string | null;
  messageCount: number;
  truncated: boolean;
  messages: IVerifThreadMessage[];
}

export interface IVerifExpleeObserver {
  getProjectAnalytics(): Promise<{ source: IVerifExpleeSource; analytics: IVerifProjectAnalytics }>;
  getCampaignAnalytics(): Promise<{ source: IVerifExpleeSource; analytics: IVerifCampaignAnalytics }>;
  getAutopilot(): Promise<{ source: IVerifExpleeSource; autopilot: IVerifAutopilotState }>;
  getSnapshot(): Promise<IVerifSnapshotObservation>;
  getNeedReplyInbox(): Promise<IVerifInboxObservation>;
  getThread(personId: string): Promise<IVerifThreadObservation>;
}

export interface CreateIVerifExpleeObserverArgs {
  apiKey: string;
  fetchImpl?: typeof fetch;
  now?: () => string;
  timeoutMs?: number;
  maxInboxPages?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function requiredNumber(value: unknown): number {
  const number = finiteNumber(value);
  if (number === null) throw new IVerifExpleeError('upstream_invalid_response');
  return number;
}

function requiredInteger(value: unknown): number {
  const number = finiteNumber(value);
  if (number === null || !Number.isSafeInteger(number)) throw new IVerifExpleeError('upstream_invalid_response');
  return number;
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new IVerifExpleeError('upstream_invalid_response');
  return value;
}

function allowlistedLabel(value: unknown, allowed: ReadonlySet<string>): string | null {
  return typeof value === 'string' && allowed.has(value) ? value : null;
}

function requiredAllowlistedLabel(value: unknown, allowed: ReadonlySet<string>): string {
  const label = allowlistedLabel(value, allowed);
  if (!label) throw new IVerifExpleeError('upstream_invalid_response');
  return label;
}

function safeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function requiredPeriod(value: unknown): string {
  if (typeof value !== 'string' || !PERIODS.has(value)) {
    throw new IVerifExpleeError('upstream_invalid_response');
  }
  return value;
}

async function projectedMessageId(value: unknown): Promise<string | null> {
  if (typeof value !== 'string' || !value || value.length > 500) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

function retryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return Math.min(3_600, Math.ceil(seconds));
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new IVerifExpleeError('upstream_invalid_response');
  }
  if (!response.body) throw new IVerifExpleeError('upstream_invalid_response');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_PROVIDER_RESPONSE_BYTES) {
      await reader.cancel();
      throw new IVerifExpleeError('upstream_invalid_response');
    }
    chunks.push(value);
  }

  const joined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(joined));
  } catch {
    throw new IVerifExpleeError('upstream_invalid_response');
  }
}

function groundingIsFixed(): boolean {
  return IVERIF_GROUNDING.binding.productId === 'iverif'
    && IVERIF_GROUNDING.binding.expleeProjectId === 16_763
    && IVERIF_GROUNDING.binding.expleeCampaignId === 45_711
    && IVERIF_GROUNDING.policy.providerMode === 'observe-only'
    && IVERIF_GROUNDING.policy.providerMutationEnabled === false
    && IVERIF_GROUNDING.policy.allowedProviderMethods.length === 1
    && IVERIF_GROUNDING.policy.allowedProviderMethods[0] === 'GET';
}

export function isIVerifPersonId(value: string): boolean {
  return SAFE_OPAQUE_ID.test(value);
}

function assertAnalyticsSemantics({
  emailsSent,
  replies,
  replyRatePercent,
  hotLeads,
  poolUsed,
  poolTotal,
}: {
  emailsSent: number;
  replies: number;
  replyRatePercent: number;
  hotLeads: number;
  poolUsed?: number;
  poolTotal?: number;
}): void {
  if (replyRatePercent > 100 || replies > emailsSent || hotLeads > replies
    || (poolUsed !== undefined && poolTotal !== undefined && poolUsed > poolTotal)) {
    throw new IVerifExpleeError('upstream_invalid_response');
  }
}

function mapProjectAnalytics(value: unknown): IVerifProjectAnalytics {
  if (!isRecord(value) || value.project_id !== IVERIF_GROUNDING.binding.expleeProjectId) {
    throw new IVerifExpleeError('upstream_invalid_response');
  }
  const analytics = {
    projectId: IVERIF_GROUNDING.binding.expleeProjectId,
    period: requiredPeriod(value.period),
    emailsSent: requiredInteger(value.total_emails_sent),
    replies: requiredInteger(value.total_replies),
    replyRatePercent: requiredNumber(value.overall_reply_rate_pct),
    hotLeads: requiredInteger(value.total_hot_leads),
    spendUsd: requiredNumber(value.total_spend_usd),
  };
  assertAnalyticsSemantics(analytics);
  return analytics;
}

function mapCampaignAnalytics(value: unknown): IVerifCampaignAnalytics {
  if (!isRecord(value) || value.campaign_id !== IVERIF_GROUNDING.binding.expleeCampaignId) {
    throw new IVerifExpleeError('upstream_invalid_response');
  }
  const analytics = {
    campaignId: IVERIF_GROUNDING.binding.expleeCampaignId,
    campaign: IVERIF_GROUNDING.audience.campaign,
    status: requiredAllowlistedLabel(value.status, CAMPAIGN_STATUSES),
    statusReason: allowlistedLabel(value.status_reason, CAMPAIGN_STATUS_REASONS),
    period: requiredPeriod(value.period),
    emailsSent: requiredInteger(value.emails_sent),
    replies: requiredInteger(value.total_replies),
    replyRatePercent: requiredNumber(value.reply_rate_pct),
    hotLeads: requiredInteger(value.hot_leads),
    spendUsd: requiredNumber(value.spend_usd),
    costPerLeadUsd: requiredNumber(value.cost_per_lead_usd),
    dailyBudgetUsd: requiredNumber(value.daily_budget_usd),
    poolUsed: requiredInteger(value.leads_pool_used),
    poolTotal: requiredInteger(value.leads_pool_total),
  };
  assertAnalyticsSemantics(analytics);
  return analytics;
}

function mapAutopilot(value: unknown): IVerifAutopilotState {
  if (!isRecord(value) || value.project_id !== IVERIF_GROUNDING.binding.expleeProjectId) {
    throw new IVerifExpleeError('upstream_invalid_response');
  }
  const delay = requiredInteger(value.auto_reply_delay_minutes);
  if (delay > 1_440) throw new IVerifExpleeError('upstream_invalid_response');
  return {
    projectId: IVERIF_GROUNDING.binding.expleeProjectId,
    autopilotEnabled: requiredBoolean(value.autopilot_enabled),
    autoReplyEnabled: requiredBoolean(value.auto_reply_enabled),
    autoReplyDelayMinutes: delay,
  };
}

function mapInboxContact(value: unknown): IVerifInboxContact | null {
  if (!isRecord(value)) throw new IVerifExpleeError('upstream_invalid_response');
  if (typeof value.person_id !== 'string' || !isIVerifPersonId(value.person_id)) return null;
  return {
    personId: value.person_id,
    latestIntent: allowlistedLabel(value.latest_intent, REPLY_INTENTS),
    sentCount: value.sent_count === undefined ? 0 : requiredInteger(value.sent_count),
    replyCount: value.reply_count === undefined ? 0 : requiredInteger(value.reply_count),
    latestSentAt: safeTimestamp(value.latest_sent_at),
    latestReplyAt: safeTimestamp(value.latest_reply_at),
  };
}

async function mapThreadMessage(value: unknown): Promise<IVerifThreadMessage> {
  if (!isRecord(value) || typeof value.type !== 'string' || !MESSAGE_TYPES.has(value.type)) {
    throw new IVerifExpleeError('upstream_invalid_response');
  }
  return {
    messageId: await projectedMessageId(value.message_id),
    type: value.type as 'sent' | 'reply',
    intent: allowlistedLabel(value.intent, REPLY_INTENTS),
    status: allowlistedLabel(value.status, DELIVERY_STATUSES),
    timestamp: safeTimestamp(value.ts),
  };
}

export function createIVerifExpleeObserver({
  apiKey,
  fetchImpl = fetch,
  now = () => new Date().toISOString(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxInboxPages = DEFAULT_MAX_INBOX_PAGES,
}: CreateIVerifExpleeObserverArgs): IVerifExpleeObserver {
  const key = apiKey.trim();
  if (!key || !groundingIsFixed()) throw new IVerifExpleeError('not_configured');
  const boundedTimeoutMs = Number.isFinite(timeoutMs)
    ? Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.floor(timeoutMs)))
    : DEFAULT_TIMEOUT_MS;
  const boundedMaxInboxPages = Number.isFinite(maxInboxPages)
    ? Math.min(MAX_INBOX_PAGES, Math.max(1, Math.floor(maxInboxPages)))
    : DEFAULT_MAX_INBOX_PAGES;

  async function getJson(path: string): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), boundedTimeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${IVERIF_EXPLEE_ORIGIN}${path}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-api-key': key,
        },
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timeout);
      if (controller.signal.aborted) {
        throw new IVerifExpleeError('upstream_timeout', { retryable: true });
      }
      throw new IVerifExpleeError('upstream_unavailable', { retryable: true });
    }

    try {
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new IVerifExpleeError('upstream_auth_failed');
        }
        if (response.status === 404) throw new IVerifExpleeError('upstream_not_found');
        if (response.status === 429) {
          throw new IVerifExpleeError('upstream_rate_limited', {
            retryable: true,
            retryAfterSeconds: retryAfterSeconds(response),
          });
        }
        throw new IVerifExpleeError('upstream_unavailable', {
          retryable: response.status >= 500,
        });
      }

      try {
        return await readBoundedJson(response);
      } catch (error) {
        if (error instanceof IVerifExpleeError) throw error;
        if (controller.signal.aborted) {
          throw new IVerifExpleeError('upstream_timeout', { retryable: true });
        }
        throw new IVerifExpleeError('upstream_unavailable', { retryable: true });
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getProjectAnalytics() {
    const value = await getJson(`${API_PREFIX}/projects/${IVERIF_GROUNDING.binding.expleeProjectId}/analytics?period=all`);
    return {
      source: { provider: 'explee-public-api' as const, observedAt: now() },
      analytics: mapProjectAnalytics(value),
    };
  }

  async function getCampaignAnalytics() {
    const value = await getJson(`${API_PREFIX}/campaigns/${IVERIF_GROUNDING.binding.expleeCampaignId}/analytics?period=all`);
    return {
      source: { provider: 'explee-public-api' as const, observedAt: now() },
      analytics: mapCampaignAnalytics(value),
    };
  }

  async function getAutopilot() {
    const value = await getJson(`${API_PREFIX}/projects/${IVERIF_GROUNDING.binding.expleeProjectId}/autopilot`);
    return {
      source: { provider: 'explee-public-api' as const, observedAt: now() },
      autopilot: mapAutopilot(value),
    };
  }

  return {
    getProjectAnalytics,
    getCampaignAnalytics,
    getAutopilot,
    async getSnapshot() {
      const [project, campaign, autopilot] = await Promise.all([
        getProjectAnalytics(),
        getCampaignAnalytics(),
        getAutopilot(),
      ]);
      return {
        source: { provider: 'explee-public-api', observedAt: now() },
        project: project.analytics,
        campaign: campaign.analytics,
        autopilot: autopilot.autopilot,
      };
    },
    async getNeedReplyInbox() {
      const contacts: IVerifInboxContact[] = [];
      const seen = new Set<string>();
      let offset = 0;
      let total = 0;
      let omittedContacts = 0;
      let pageCount = 0;
      let hasMore = false;

      for (let page = 0; page < boundedMaxInboxPages; page += 1) {
        const value = await getJson(
          `${API_PREFIX}/campaigns/${IVERIF_GROUNDING.binding.expleeCampaignId}/inbox?tab=need_reply&limit=${INBOX_PAGE_SIZE}&offset=${offset}`,
        );
        if (!isRecord(value) || !Array.isArray(value.contacts)) {
          throw new IVerifExpleeError('upstream_invalid_response');
        }
        total = requiredInteger(value.total);
        hasMore = requiredBoolean(value.has_more);
        pageCount += 1;
        for (const rawContact of value.contacts) {
          const contact = mapInboxContact(rawContact);
          if (!contact) {
            omittedContacts += 1;
            continue;
          }
          if (seen.has(contact.personId)) continue;
          seen.add(contact.personId);
          contacts.push(contact);
        }
        if (!hasMore) break;
        const nextOffset = requiredInteger(value.next_offset);
        if (nextOffset <= offset || value.contacts.length === 0) {
          throw new IVerifExpleeError('upstream_invalid_response');
        }
        offset = nextOffset;
      }

      return {
        source: { provider: 'explee-public-api', observedAt: now() },
        tab: 'need_reply',
        contacts,
        total,
        omittedContacts,
        pageCount,
        truncated: hasMore,
      };
    },
    async getThread(personId: string) {
      if (!isIVerifPersonId(personId)) throw new IVerifExpleeError('bad_person_id');
      const value = await getJson(
        `${API_PREFIX}/campaigns/${IVERIF_GROUNDING.binding.expleeCampaignId}/inbox/${encodeURIComponent(personId)}`,
      );
      if (!isRecord(value) || !Array.isArray(value.messages)) {
        throw new IVerifExpleeError('upstream_invalid_response');
      }
      const projectedMessages = await Promise.all(value.messages.slice(-MAX_THREAD_MESSAGES).map(mapThreadMessage));
      return {
        source: { provider: 'explee-public-api', observedAt: now() },
        personId,
        canReply: requiredBoolean(value.can_reply),
        replyBlockedReason: allowlistedLabel(value.reply_blocked_reason, REPLY_BLOCK_REASONS),
        latestIntent: allowlistedLabel(value.latest_intent, REPLY_INTENTS),
        messageCount: value.messages.length,
        truncated: value.messages.length > MAX_THREAD_MESSAGES,
        messages: projectedMessages,
      };
    },
  };
}
