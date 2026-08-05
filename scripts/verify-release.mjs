#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const gates = [
  ['retired runtime guard', 'npm', ['run', 'retired-runtime:check']],
  ['drift audit', 'npm', ['run', 'drift:audit']],
  ['core tests', 'npm', ['test']],
  ['generated docs', 'npm', ['run', 'render-docs:check']],
  ['product branch packets', 'npm', ['run', 'validate:product-branches']],
  // Named explicitly (rather than left implicit inside "core tests") so
  // omission of the operating-fabric proof chain or its zero-gap shadow
  // report fails release verification with its own visible label.
  [
    'mission-fabric integration + live-proof readiness',
    'node',
    ['--test', 'workers/quests/src/mission-fabric-integration.test.ts', 'workers/quests/src/live-proof-readiness.test.ts'],
  ],
  ['standalone audit', 'npm', ['run', 'standalone:audit']],
  ['standalone smoke', 'npm', ['run', 'standalone:smoke']],
  ['Telegram mobile contract', 'npm', ['run', 'proof:tg-mobile-contract']],
  ['R3F tests', 'npm', ['run', 'r3f:test']],
  ['R3F build', 'npm', ['run', 'r3f:build']],
  ['Electron packaging contract', 'npm', ['run', 'desktop:test']],
];

for (const [label, command, args] of gates) {
  process.stdout.write(`\n== ${label} ==\n`);
  const result = spawnSync(command, args, { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(`\nRelease verification failed at: ${label}\n`);
    process.exit(result.status || 1);
  }
}

process.stdout.write('\nDeterministic release verification passed. Live Telegram readiness is separate evidence.\n');
