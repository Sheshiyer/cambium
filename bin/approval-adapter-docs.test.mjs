import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const approval = fs.readFileSync(new URL('../docs/adapters/approval.md', import.meta.url), 'utf8');
const cli = fs.readFileSync(new URL('../docs/adapters/cli-approval.md', import.meta.url), 'utf8');
const web = fs.readFileSync(new URL('../docs/adapters/web-approval.md', import.meta.url), 'utf8');
const telegram = fs.readFileSync(new URL('../docs/adapters/telegram.md', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../docs/adapters/README.md', import.meta.url), 'utf8');
const privateLeak = /(thoughtseed|curious\.thoughtseed\.space|\/Users\/|\/Volumes\/|cs_live_|@[a-z0-9.-]+\.(com|io))/i;

test('approval lane docs define a provider-neutral approval port', () => {
  assert.match(approval, /neutral human gate/);
  assert.match(approval, /cambium\.approval\.v1/);
  assert.match(approval, /approve`, `reroll`, `reject`, or `hold`/);
  assert.match(approval, /demo-org/);
  assert.match(approval, /example\.com/);
});

test('approval adapters cover cli web and telegram without making telegram default', () => {
  assert.match(cli, /default local adapter/);
  assert.match(cli, /no provider credentials are needed/);
  assert.match(web, /browser surface/);
  assert.match(web, /Telegram WebApp approval is one implementation/);
  assert.match(telegram, /not Cambium's default product identity/);
  assert.match(index, /Approval lane/);
  assert.match(index, /CLI approval/);
  assert.match(index, /Web approval/);
});

test('approval adapter docs stay free of private host data', () => {
  for (const text of [approval, cli, web, telegram, index]) {
    assert.doesNotMatch(text, privateLeak);
  }
});
