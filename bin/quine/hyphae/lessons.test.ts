import { test } from 'node:test';
import assert from 'node:assert/strict';

test('lessons mint writes a proposed lesson into the skill registry', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-lessons-');
  const { lessons } = await import('./lessons.ts');

  const out = await lessons.write!(
    [
      'mint',
      '--tenant', 'cambium',
      '--title', 'Archive agent plane before shutdown',
      '--kind', 'repeatable',
      '--summary', 'the archive-and-receipt ceremony repeats before runtime retirement',
      '--proposed', 'turn the ceremony into a reusable runbook',
      '--evidence', 'tg://message/123',
    ],
    { root: tmp, vaultRoot: tmp },
  );

  assert.match(String(out), /lesson minted: lesson-archive-agent-plane-before-shutdown/);
  const registry = JSON.parse(fs.readFileSync(path.join(tmp, '.operator', 'cambium.skills.json'), 'utf8'));
  assert.equal(registry.length, 1);
  assert.equal(registry[0].skill_id, 'lesson-archive-agent-plane-before-shutdown');
  assert.equal(registry[0].status, 'candidate');
  assert.equal(registry[0].source.signature, 'lesson|repeatable|archive-agent-plane-before-shutdown');
  assert.deepEqual(registry[0].trigger_signals.slice(0, 2), ['lesson|repeatable|archive-agent-plane-before-shutdown', 'tg://message/123']);
});

test('lessons mint dedupes by lesson id without resetting telemetry', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmp = fs.mkdtempSync('/tmp/cambium-lessons-dedupe-');
  const { lessons } = await import('./lessons.ts');

  const args = [
    'mint',
    '--tenant', 'cambium',
    '--title', 'Gate self heal before execution',
    '--kind', 'self-heal',
    '--summary', 'self-heal proposals must not run unattended',
    '--proposed', 'route proposed remediation through founder gate',
    '--evidence', 'digest://2026-06-18#1',
  ];
  await lessons.write!(args, { root: tmp, vaultRoot: tmp });
  const registryPath = path.join(tmp, '.operator', 'cambium.skills.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  registry[0].telemetry.uses = 3;
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  await lessons.write!(args, { root: tmp, vaultRoot: tmp });
  const reread = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

  assert.equal(reread.length, 1);
  assert.equal(reread[0].telemetry.uses, 3);
  assert.equal(reread[0].category, 'delivery');
});

test('lessons read renders a tenant lesson panel', async () => {
  const fs = await import('node:fs');
  const tmp = fs.mkdtempSync('/tmp/cambium-lessons-read-');
  const { lessons } = await import('./lessons.ts');

  await lessons.write!(
    [
      'mint',
      '--tenant', 'mathis',
      '--title', 'Promote repeated export',
      '--summary', 'manual exports repeated twice',
      '--proposed', 'make an export routine',
    ],
    { root: tmp, vaultRoot: tmp },
  );

  const out = await lessons.read(['--tenant', 'mathis'], { root: tmp, vaultRoot: tmp });

  assert.match(String(out), /Lessons/);
  assert.match(String(out), /lesson-promote-repeated-export/);
});

test('minted lessons feed project evidence for arc XVII', async () => {
  const fs = await import('node:fs');
  const tmp = fs.mkdtempSync('/tmp/cambium-lessons-evidence-');
  const { lessons } = await import('./lessons.ts');
  const { refreshProjectEvidence } = await import('./project-evidence.ts');

  await lessons.write!(
    [
      'mint',
      '--tenant', 'cambium',
      '--title', 'Promote repeated QA checklist',
      '--summary', 'QA checklist was recreated from memory twice',
      '--proposed', 'turn the checklist into a reusable routine',
    ],
    { root: tmp, vaultRoot: tmp },
  );
  const evidence = refreshProjectEvidence({ root: tmp, vaultRoot: tmp }, 'cambium');

  assert.equal(evidence.lessonsMinted, 1);
});
