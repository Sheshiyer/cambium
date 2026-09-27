import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OWNED_EMAIL_FROM,
  OWNED_EMAIL_SEND_ADAPTER,
  OWNED_EMAIL_WILL_ADAPTER_SCHEMA,
  compileOwnedEmailWillDispatch,
  hermesOwnedEmailDispatchPath,
  isOwnedEmailStubSendSafe,
} from './owned-email-will-adapter.ts';

const NOW = '2026-09-11T18:00:00.000Z';

const baseDraft = {
  saplingId: 'sapling:iverif',
  to: 'prospect@example.fr',
  subject: 'Validation dossiers CEE avant dépôt',
  bodyText: 'Bonjour,\n\nDemo FR 20 minutes?\n\nCordialement',
  language: 'fr-FR',
  brandPacketRef: 'meristem/brands/iverif',
  doNotPost: true,
};

test('schema constants and hermes path are stable', () => {
  assert.equal(OWNED_EMAIL_WILL_ADAPTER_SCHEMA, 'cambium.owned-email-will-adapter.v1');
  assert.equal(OWNED_EMAIL_FROM, 'wave@thoughtseed.space');
  assert.equal(OWNED_EMAIL_SEND_ADAPTER, 'zoho-via-composio-on-hermes-ec2');
  assert.equal(
    hermesOwnedEmailDispatchPath('sapling:iverif'),
    '.state/sapling-iverif/will/owned-email.hermes-dispatch.json',
  );
});

test('draft without gate compiles to do_not_post stub; liveSend false', () => {
  const result = compileOwnedEmailWillDispatch({ draft: baseDraft }, NOW);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.stub.status, 'do_not_post');
  assert.equal(result.stub.liveSend, false);
  assert.equal(result.stub.awsSafvrIsSendIdentity, false);
  assert.equal(result.stub.from, OWNED_EMAIL_FROM);
  assert.equal(result.stub.draft.doNotPost, true);
  assert.equal(result.stub.hermes.composioProvider, 'zoho');
  assert.equal(result.stub.hermes.telegramFoldbackTopic, 'clients');
  assert.equal(isOwnedEmailStubSendSafe(result.stub), true);
});

test('approved gate + queueForHermes → queued_for_hermes still liveSend false', () => {
  const result = compileOwnedEmailWillDispatch(
    {
      draft: baseDraft,
      gate: {
        surface: 'telegram',
        approved: true,
        approvedAt: NOW,
        actionRequestId: 'ar_test_1',
        actor: 'founder',
      },
      queueForHermes: true,
    },
    NOW,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.stub.status, 'queued_for_hermes');
  assert.equal(result.stub.draft.doNotPost, false);
  assert.equal(result.stub.liveSend, false);
  assert.equal(result.stub.gate.surface, 'telegram');
  assert.equal(isOwnedEmailStubSendSafe(result.stub), true);
});

test('queueForHermes without approve fails closed', () => {
  const result = compileOwnedEmailWillDispatch({
    draft: baseDraft,
    queueForHermes: true,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => /queueForHermes requires gate.approved/.test(e)));
});

test('safvr as gate.actor is rejected', () => {
  const result = compileOwnedEmailWillDispatch({
    draft: baseDraft,
    gate: {
      surface: 'fifo',
      approved: true,
      approvedAt: NOW,
      actor: 'aws:safvr',
    },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => /safvr/.test(e)));
});

test('invalid saplingId and to fail closed', () => {
  const result = compileOwnedEmailWillDispatch({
    draft: { ...baseDraft, saplingId: 'iverif', to: 'not-an-email' },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => /saplingId/.test(e)));
  assert.ok(result.errors.some((e) => /draft\.to/.test(e)));
});
