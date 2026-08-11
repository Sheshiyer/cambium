#!/usr/bin/env node
/**
 * Local / Hermes-side proactive loop tick.
 *
 * Default: compile plan to stdout (no network).
 * With CAMBIUM_BRIDGE_URL + BRIDGE_TOKEN|HERMES_ASSIGNMENT_TOKEN: POST tick to worker.
 *
 * Hermes should then:
 *  1. GET pending-deliveries
 *  2. send messageText to each Thoughtseed topic thread
 *  3. POST topic-assignment for each
 *  4. claim-deliveries
 *
 * Never writes D1. Never calls Telegram directly.
 */
import { compileProactiveLoopPlan } from '../shared/proactive-loop-routine.ts';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const post = args.includes('--post');

const plan = compileProactiveLoopPlan({
  tenantId: 'cambium',
  actor: 'cli-proactive-loop-tick',
  observedAt: new Date().toISOString(),
});

if (!post) {
  if (asJson) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(`plan ${plan.planId}`);
    console.log(`digest ${plan.planDigest}`);
    console.log(`ladder pass=${plan.miniApp.passedCount} held=${plan.miniApp.heldCount} fail=${plan.miniApp.failedCount}`);
    console.log(`next: ${plan.miniApp.nextFounderAction ?? '(none)'}`);
    console.log(`deliveries: ${plan.deliveries.length}`);
    for (const d of plan.deliveries) {
      console.log(`  · ${d.topicKey}#${d.threadId} [${d.priority}] ${d.title}`);
      console.log(`    ${d.summary}`);
    }
    console.log('');
    console.log(plan.hermesPullHint);
  }
  process.exit(0);
}

const base = process.env.CAMBIUM_BRIDGE_URL || process.env.CAMBIUM_PUBLIC_BASE_URL;
const token = process.env.BRIDGE_TOKEN || process.env.HERMES_ASSIGNMENT_TOKEN;
if (!base || !token) {
  console.error('Need CAMBIUM_BRIDGE_URL and BRIDGE_TOKEN (or HERMES_ASSIGNMENT_TOKEN) for --post');
  process.exit(2);
}

const res = await fetch(`${base.replace(/\/$/, '')}/v1/bridge/proactive-loop-tick`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ tenantId: 'cambium', actor: 'cli-proactive-loop-tick' }),
});
const text = await res.text();
console.log(res.status, text.slice(0, 4000));
process.exit(res.ok ? 0 : 1);
