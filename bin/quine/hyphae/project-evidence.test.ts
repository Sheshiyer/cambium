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

test('gatherProjectSignals reads cambium repo build activity from git', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const tmp = fs.mkdtempSync('/tmp/cambium-git-');
  execFileSync('git', ['init', tmp], { stdio: 'ignore' });
  fs.writeFileSync(path.join(tmp, 'README.md'), 'fixture\n');
  execFileSync('git', ['-C', tmp, 'add', 'README.md'], { stdio: 'ignore' });
  execFileSync('git', ['-C', tmp, '-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'commit', '-m', 'init'], { stdio: 'ignore' });
  const { gatherProjectSignals } = await import('./project-evidence.ts');
  const signals = gatherProjectSignals({ root: tmp } as any, 'cambium');
  assert.equal(signals.repo?.exists, true);
  assert.equal(signals.repo?.commitsOnMain, 1);
});

test('gatherProjectSignals reads array-shaped skill forge lessons and gate approvals', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-skills-');
  fs.mkdirSync(path.join(tmp, '.operator'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.operator', 'foo.skills.json'), JSON.stringify([
    { status: 'candidate', telemetry: { scenarios: [] } },
    { status: 'validated', telemetry: { scenarios: [{ ok: true, note: 'founder approve via gate' }] } },
    { status: 'production', telemetry: { scenarios: [{ ok: true, note: 'routine verified' }] } },
  ]));
  const { gatherProjectSignals } = await import('./project-evidence.ts');
  const signals = gatherProjectSignals({ root: tmp } as any, 'foo');
  assert.equal(signals.skills?.lessonsMinted, 2);
  assert.equal(signals.skills?.archived, false);
  assert.equal(signals.gate?.approvals, 1);
});

test('gatherProjectSignals reads cambium spec, review, and gate proof files', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-proof-');
  fs.mkdirSync(path.join(tmp, 'cortex', 'cambium', 'contracts'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'docs', 'plans', 'assets', 'cambium-r3f-implementation'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'docs', 'plans', 'assets', 'cambium-r3f-game-engine-realignment'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'cortex', 'cambium', 'contracts', 'acceptance_checks.json'), '{}\n');
  fs.writeFileSync(path.join(tmp, 'docs', 'plans', 'assets', 'cambium-r3f-implementation', 'phase1-verification.md'), '# ok\n');
  fs.writeFileSync(path.join(tmp, 'docs', 'plans', 'assets', 'cambium-r3f-game-engine-realignment', 'art-pass-02-verification.md'), 'After explicit approval, generated assets were reviewed.\n');
  const { gatherProjectSignals } = await import('./project-evidence.ts');
  const signals = gatherProjectSignals({ root: tmp } as any, 'cambium');
  assert.equal(signals.vault?.specFound, true);
  assert.equal(signals.reviews?.count, 2);
  assert.equal(signals.gate?.approvals, 1);
});

test('gatherProjectSignals reads project proofs from ctx.vaultRoot first', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-vaultroot-');
  const vaultRoot = path.join(tmp, 'thoughtseed-labs');
  const projectDir = path.join(vaultRoot, '60-client-ecosystem', 'cambium');
  fs.mkdirSync(path.join(projectDir, 'deploys'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'brief.md'), '# Cambium self-launch brief\n');
  fs.writeFileSync(path.join(projectDir, 'agreement.md'), '# Founder mandate\n');
  fs.writeFileSync(path.join(projectDir, 'commitment.json'), '{"status":"committed"}\n');
  fs.writeFileSync(path.join(projectDir, 'handoff.md'), '# Handoff\n');
  fs.writeFileSync(path.join(projectDir, 'archive.md'), '# Archive\n');
  fs.writeFileSync(path.join(projectDir, 'deploys', '2026-06-21-cambium-self-launch.json'), '{"ok":true}\n');
  fs.mkdirSync(path.join(tmp, '.operator'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.operator', 'cambium.world.json'), '{}\n');

  const { gatherProjectSignals, assembleProjectEvidence } = await import('./project-evidence.ts');
  const signals = gatherProjectSignals({ root: tmp, vaultRoot }, 'cambium');
  const evidence = assembleProjectEvidence(signals);

  assert.equal(evidence.briefStatus, 'accepted');
  assert.equal(evidence.contractExists, true);
  assert.equal(evidence.depositReceived, true, 'commitment.json satisfies the self-launch commitment gate');
  assert.equal(evidence.deployEvents, 1);
  assert.equal(evidence.clientSignOff, true);
  assert.equal(evidence.projectArchived, true);
});

test('gatherProjectSignals counts only JSON deploy proof files', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-deploys-');
  const vaultRoot = path.join(tmp, 'vault');
  const deployDir = path.join(vaultRoot, '60-client-ecosystem', 'acme', 'deploys');
  fs.mkdirSync(deployDir, { recursive: true });
  fs.writeFileSync(path.join(deployDir, '2026-06-21-one.json'), '{}\n');
  fs.writeFileSync(path.join(deployDir, 'notes.md'), 'not counted\n');

  const { gatherProjectSignals } = await import('./project-evidence.ts');
  const signals = gatherProjectSignals({ root: tmp, vaultRoot }, 'acme');

  assert.equal(signals.deploys?.count, 1);
});
