import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleProjectEvidence, type ProjectSignals } from './project-evidence.ts';

test('assembleProjectEvidence reflects empty signals as all-false / zero', () => {
  const out = assembleProjectEvidence({});
  assert.equal(out.briefStatus, 'draft');
  assert.equal(out.contractExists, false);
  assert.equal(out.depositReceived, false);
  assert.equal(out.repoExists, false);
  assert.equal(out.tenantProvisioned, false);
  assert.equal(out.specsFrozen, false);
  assert.equal(out.buildCommits, 0);
  assert.equal(out.reviewEvents, 0);
  assert.equal(out.gateApprovals, 0);
  assert.equal(out.deployEvents, 0);
  assert.equal(out.clientSignOff, false);
  assert.equal(out.lessonsMinted, 0);
  assert.equal(out.projectArchived, false);
});

test('assembleProjectEvidence reflects fully-populated signals', () => {
  const signals: ProjectSignals = {
    vault: { briefStatus: 'accepted', contractFound: true, depositRecorded: true, specFound: true, signOffRecorded: true },
    repo: { exists: true, commitsOnMain: 42 },
    tenant: { worldExists: true },
    reviews: { count: 3 },
    gate: { approvals: 1 },
    deploys: { count: 2 },
    skills: { lessonsMinted: 4, archived: true },
  };
  const out = assembleProjectEvidence(signals);
  assert.equal(out.briefStatus, 'accepted');
  assert.equal(out.contractExists, true);
  assert.equal(out.depositReceived, true);
  assert.equal(out.repoExists, true);
  assert.equal(out.buildCommits, 42);
  assert.equal(out.tenantProvisioned, true);
  assert.equal(out.specsFrozen, true);
  assert.equal(out.reviewEvents, 3);
  assert.equal(out.gateApprovals, 1);
  assert.equal(out.deployEvents, 2);
  assert.equal(out.clientSignOff, true);
  assert.equal(out.lessonsMinted, 4);
  assert.equal(out.projectArchived, true);
});

test('assembleProjectEvidence preserves the partial-signal honesty (vault unreachable ⇒ contract false)', () => {
  const out = assembleProjectEvidence({ repo: { exists: true, commitsOnMain: 5 } });
  assert.equal(out.contractExists, false);
  assert.equal(out.repoExists, true);
  assert.equal(out.buildCommits, 5);
});

test('gatherProjectSignals reviews are tenant-scoped (no global deviations bleed)', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-rev-');
  // Global deviations.jsonl with 5 entries — should NOT count toward this tenant.
  fs.writeFileSync(path.join(tmp, 'deviations.jsonl'), '{"a":1}\n{"a":2}\n{"a":3}\n{"a":4}\n{"a":5}\n');
  // No cortex/foo/deviations.jsonl — tenant-scoped file absent.
  const { gatherProjectSignals } = await import('./project-evidence.ts');
  const signals = gatherProjectSignals({ root: tmp } as any, 'foo');
  assert.equal(signals.reviews?.count, 0, 'no tenant-scoped reviews ⇒ 0, NOT a leak from global deviations.jsonl');
});

test('gatherProjectSignals counts tenant-scoped reviews when present', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-rev-');
  fs.mkdirSync(path.join(tmp, 'cortex', 'foo'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'cortex', 'foo', 'deviations.jsonl'), '{"r":1}\n{"r":2}\n{"r":3}\n');
  const { gatherProjectSignals } = await import('./project-evidence.ts');
  const signals = gatherProjectSignals({ root: tmp } as any, 'foo');
  assert.equal(signals.reviews?.count, 3);
});

test('gatherProjectSignals reads real git repo evidence when ctx root is a worktree', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const tmp = fs.mkdtempSync('/tmp/cambium-repo-');
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: tmp, stdio: 'ignore' });
  fs.writeFileSync(path.join(tmp, 'README.md'), 'fixture\n');
  execFileSync('git', ['-c', 'user.name=Cambium Test', '-c', 'user.email=cambium@example.test', 'add', 'README.md'], { cwd: tmp, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=Cambium Test', '-c', 'user.email=cambium@example.test', 'commit', '-m', 'fixture'], { cwd: tmp, stdio: 'ignore' });

  const { gatherProjectSignals } = await import('./project-evidence.ts');
  const signals = gatherProjectSignals({ root: tmp } as any, 'foo');
  assert.equal(signals.repo?.exists, true);
  assert.equal(signals.repo?.commitsOnMain, 1);
});

test('refreshProjectEvidence creates the operator directory before atomic write', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-project-');
  const { refreshProjectEvidence } = await import('./project-evidence.ts');
  const evidence = refreshProjectEvidence({ root: tmp } as any, 'foo');
  const written = JSON.parse(fs.readFileSync(path.join(tmp, '.operator', 'foo.project.json'), 'utf8'));
  assert.equal(evidence.source, 'project-evidence@v1');
  assert.equal(written.source, 'project-evidence@v1');
});

test('gatherProjectSignals reads Cloudflare Worker deployment count when credentials are present', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-cf-');
  fs.mkdirSync(path.join(tmp, 'workers', 'quests'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'workers', 'quests', 'wrangler.jsonc'), '{ "name": "cambium-quests" }\n');

  const bin = path.join(tmp, 'bin');
  const calls = path.join(tmp, 'curl-args.txt');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'curl'), `#!/bin/sh\nprintf '%s\\n' "$*" > ${calls}\nprintf '%s\\n' '{"result":[{"id":"d1"},{"id":"d2"},{"id":"d3"}]}'\n`);
  fs.chmodSync(path.join(bin, 'curl'), 0o755);

  const prevPath = process.env.PATH;
  const prevToken = process.env.CLOUDFLARE_API_TOKEN;
  const prevAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  try {
    process.env.PATH = `${bin}:${prevPath ?? ''}`;
    process.env.CLOUDFLARE_API_TOKEN = 'test-token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
    const { gatherProjectSignals } = await import('./project-evidence.ts');
    const signals = gatherProjectSignals({ root: tmp } as any, 'foo');
    assert.equal(signals.deploys?.count, 3);
    assert.match(fs.readFileSync(calls, 'utf8'), /workers\/scripts\/cambium-quests\/deployments/);
  } finally {
    if (prevPath === undefined) delete process.env.PATH; else process.env.PATH = prevPath;
    if (prevToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN; else process.env.CLOUDFLARE_API_TOKEN = prevToken;
    if (prevAccount === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = prevAccount;
  }
});

test('gatherProjectSignals counts queued founder gate approvals from the Worker', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-gate-');

  const bin = path.join(tmp, 'bin');
  const calls = path.join(tmp, 'curl-args.txt');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'curl'), `#!/bin/sh\nprintf '%s\\n' "$*" > ${calls}\nprintf '%s\\n' '{"tenant":"foo","actions":[{"kind":"approve","status":"queued"},{"kind":"approve","status":"queued"},{"kind":"reroll","status":"queued"},{"kind":"approve","status":"consumed"}]}'\n`);
  fs.chmodSync(path.join(bin, 'curl'), 0o755);

  const prevPath = process.env.PATH;
  const prevToken = process.env.QUESTS_PUSH_TOKEN;
  const prevUrl = process.env.QUESTS_PUSH_URL;
  try {
    process.env.PATH = `${bin}:${prevPath ?? ''}`;
    process.env.QUESTS_PUSH_TOKEN = 'push-token';
    process.env.QUESTS_PUSH_URL = 'https://quests.example.test/';
    const { gatherProjectSignals } = await import('./project-evidence.ts');
    const signals = gatherProjectSignals({ root: tmp } as any, 'foo');
    assert.equal(signals.gate?.approvals, 2);
    assert.match(fs.readFileSync(calls, 'utf8'), /https:\/\/quests\.example\.test\/internal\/gate\/foo/);
  } finally {
    if (prevPath === undefined) delete process.env.PATH; else process.env.PATH = prevPath;
    if (prevToken === undefined) delete process.env.QUESTS_PUSH_TOKEN; else process.env.QUESTS_PUSH_TOKEN = prevToken;
    if (prevUrl === undefined) delete process.env.QUESTS_PUSH_URL; else process.env.QUESTS_PUSH_URL = prevUrl;
  }
});

test('gatherProjectSignals treats an archive receipt as projectArchived evidence', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-archive-evidence-');
  fs.mkdirSync(path.join(tmp, '.operator'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.operator', 'foo.skills.json'), JSON.stringify([{ skill_id: 'lesson-one' }]));
  fs.writeFileSync(path.join(tmp, '.operator', 'foo.skills.archive.json'), JSON.stringify({
    tenant: 'foo',
    archives: [{ routineId: 'paperclip', archived: true, archivedAt: '2026-06-18T00:00:00Z' }],
  }));

  const { refreshProjectEvidence } = await import('./project-evidence.ts');
  const evidence = refreshProjectEvidence({ root: tmp } as any, 'foo');
  assert.equal(evidence.lessonsMinted, 1);
  assert.equal(evidence.projectArchived, true);
});
