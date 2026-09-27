/**
 * Prong B owned-email Will adapter — typed contract + Hermes dispatch stub compiler.
 * Schema: cambium.owned-email-will-adapter.v1
 *
 * Infra (approved): wave@thoughtseed.space · CF Email Routing (Labs wrangler) ·
 * Zoho via Composio on Hermes EC2 · AWS safvr admin-only (never send identity).
 *
 * This module never performs live send. It only validates and materializes
 * file-shaped stubs Hermes can consume later under .state/<sapling>/will/.
 */

export const OWNED_EMAIL_WILL_ADAPTER_SCHEMA = 'cambium.owned-email-will-adapter.v1' as const;

export const OWNED_EMAIL_FROM = 'wave@thoughtseed.space' as const;
export const OWNED_EMAIL_SEND_ADAPTER = 'zoho-via-composio-on-hermes-ec2' as const;

export type FirstResponseSurface = 'telegram' | 'mini-app' | 'fifo';

export type OwnedEmailDispatchStatus =
  | 'do_not_post'
  | 'queued_for_hermes'
  | 'approved_pending_send'
  | 'held'
  | 'sent'
  | 'failed';

export interface OwnedEmailDraftInput {
  saplingId: string;
  to: string;
  subject: string;
  bodyText: string;
  language?: string;
  brandPacketRef?: string;
  /** Hands must mark drafts do_not_post until Will approve. */
  doNotPost?: boolean;
}

export interface FirstResponseGateInput {
  surface: FirstResponseSurface;
  approved: boolean;
  actionRequestId?: string;
  approvedAt?: string;
  actor?: string;
}

export interface CompileOwnedEmailDispatchInput {
  draft: OwnedEmailDraftInput;
  gate?: FirstResponseGateInput;
  /**
   * When true, stub is written as queued_for_hermes after a valid approve.
   * Never implies live Zoho send — liveSend on the stub stays false.
   */
  queueForHermes?: boolean;
  telegramFoldbackTopic?: string;
}

export interface OwnedEmailHermesDispatchStub {
  schema: typeof OWNED_EMAIL_WILL_ADAPTER_SCHEMA;
  prong: 'B';
  adapter: typeof OWNED_EMAIL_SEND_ADAPTER;
  from: typeof OWNED_EMAIL_FROM;
  cloudflareEmailRoutingZone: 'thoughtseed.space';
  awsSafvrIsSendIdentity: false;
  liveSend: false;
  status: OwnedEmailDispatchStatus;
  saplingId: string;
  draft: {
    to: string;
    subject: string;
    bodyText: string;
    language: string;
    brandPacketRef: string | null;
    doNotPost: boolean;
  };
  gate: {
    surface: FirstResponseSurface | null;
    approved: boolean;
    actionRequestId: string | null;
    approvedAt: string | null;
    actor: string | null;
  };
  hermes: {
    composioProvider: 'zoho';
    consumePath: string;
    telegramFoldbackTopic: string;
    instruction: string;
  };
  receipt: null;
  compiledAt: string;
}

export type CompileOwnedEmailResult =
  | { ok: true; stub: OwnedEmailHermesDispatchStub }
  | { ok: false; errors: string[] };

const SAPLING_ID = /^sapling:[a-z0-9-]+$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function saplingSlug(saplingId: string): string {
  return saplingId.replace(/^sapling:/i, '').toLowerCase();
}

/** Portable Hermes consume path for a sapling (under Cambium repo root). */
export function hermesOwnedEmailDispatchPath(saplingId: string): string {
  const slug = saplingSlug(saplingId);
  return `.state/sapling-${slug}/will/owned-email.hermes-dispatch.json`;
}

/**
 * Compile a Hermes-consumable owned-email dispatch stub.
 * Fail-closed: invalid from/to, missing approve when queueing, or safvr-as-actor → errors.
 * liveSend is always false.
 */
export function compileOwnedEmailWillDispatch(
  input: CompileOwnedEmailDispatchInput,
  nowIso: string = new Date().toISOString(),
): CompileOwnedEmailResult {
  const errors: string[] = [];
  const draft = input.draft;
  const gate = input.gate;

  if (!draft || typeof draft !== 'object') {
    return { ok: false, errors: ['draft is required'] };
  }

  if (!nonEmpty(draft.saplingId) || !SAPLING_ID.test(draft.saplingId)) {
    errors.push('draft.saplingId must match sapling:<slug>');
  }
  if (!nonEmpty(draft.to) || !EMAIL.test(draft.to.trim())) {
    errors.push('draft.to must be a valid email');
  }
  if (!nonEmpty(draft.subject)) {
    errors.push('draft.subject is required');
  }
  if (!nonEmpty(draft.bodyText)) {
    errors.push('draft.bodyText is required');
  }
  if (draft.doNotPost === false && gate?.approved !== true) {
    errors.push('draft.doNotPost may only be false after gate.approved');
  }

  if (gate) {
    const surfaces: FirstResponseSurface[] = ['telegram', 'mini-app', 'fifo'];
    if (!surfaces.includes(gate.surface)) {
      errors.push('gate.surface must be telegram|mini-app|fifo');
    }
    if (gate.approved === true && !nonEmpty(gate.approvedAt)) {
      errors.push('gate.approvedAt required when approved');
    }
    if (gate.actor && /safvr/i.test(gate.actor)) {
      errors.push('gate.actor must not be AWS profile safvr (admin CLI only, not send identity)');
    }
  }

  if (input.queueForHermes === true && gate?.approved !== true) {
    errors.push('queueForHermes requires gate.approved === true');
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  const doNotPost = gate?.approved === true ? false : true;
  let status: OwnedEmailDispatchStatus = 'do_not_post';
  if (gate?.approved === true && input.queueForHermes === true) {
    status = 'queued_for_hermes';
  } else if (gate?.approved === true) {
    status = 'approved_pending_send';
  } else if (gate && gate.approved === false) {
    status = 'held';
  }

  const consumePath = hermesOwnedEmailDispatchPath(draft.saplingId);
  const stub: OwnedEmailHermesDispatchStub = {
    schema: OWNED_EMAIL_WILL_ADAPTER_SCHEMA,
    prong: 'B',
    adapter: OWNED_EMAIL_SEND_ADAPTER,
    from: OWNED_EMAIL_FROM,
    cloudflareEmailRoutingZone: 'thoughtseed.space',
    awsSafvrIsSendIdentity: false,
    liveSend: false,
    status,
    saplingId: draft.saplingId,
    draft: {
      to: draft.to.trim(),
      subject: draft.subject.trim(),
      bodyText: draft.bodyText,
      language: nonEmpty(draft.language) ? draft.language : 'fr-FR',
      brandPacketRef: nonEmpty(draft.brandPacketRef) ? draft.brandPacketRef : null,
      doNotPost,
    },
    gate: {
      surface: gate?.surface ?? null,
      approved: gate?.approved === true,
      actionRequestId: nonEmpty(gate?.actionRequestId) ? gate!.actionRequestId! : null,
      approvedAt: nonEmpty(gate?.approvedAt) ? gate!.approvedAt! : null,
      actor: nonEmpty(gate?.actor) ? gate!.actor! : null,
    },
    hermes: {
      composioProvider: 'zoho',
      consumePath,
      telegramFoldbackTopic: nonEmpty(input.telegramFoldbackTopic)
        ? input.telegramFoldbackTopic!
        : 'clients',
      instruction:
        'Hermes may consume this stub via Composio Zoho as wave@ only after liveSend is explicitly flipped by a later approved arm. This stub never sends.',
    },
    receipt: null,
    compiledAt: nowIso,
  };

  return { ok: true, stub };
}

/** True when stub is safe to leave on disk without implying outbound mail. */
export function isOwnedEmailStubSendSafe(stub: OwnedEmailHermesDispatchStub): boolean {
  return (
    stub.liveSend === false &&
    stub.awsSafvrIsSendIdentity === false &&
    stub.from === OWNED_EMAIL_FROM &&
    (stub.status === 'do_not_post' ||
      stub.status === 'held' ||
      stub.status === 'queued_for_hermes' ||
      stub.status === 'approved_pending_send')
  );
}
