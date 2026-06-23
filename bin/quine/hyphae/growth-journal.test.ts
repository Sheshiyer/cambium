import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendGrowthJournalEntry, buildGrowthJournalEntry } from './growth-journal.ts';
import type { QuineCtx } from '../types.ts';

function tmpCtx(): QuineCtx {
  const parent = mkdtempSync(join(tmpdir(), 'cambium-growth-journal-'));
  const root = join(parent, 'cambium');
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, 'composition'), { recursive: true });
  writeFileSync(join(root, 'registry.json'), JSON.stringify({
    organs: {
      genesis: { role: 'genesis', tier: 'free', repo: 'brandmint' },
      will: { role: 'will', tier: 'paid', repo: 'paperclip' },
    },
  }));
  writeFileSync(join(root, 'composition', 'pipeline.json'), JSON.stringify({
    stages: [
      { id: 'genesis', organ: 'genesis', title: 'Mint the brand' },
      { id: 'ops', organ: 'will', title: 'Operate + GTM' },
    ],
    crosscutting: [{ id: 'cortex' }],
  }));
  return { root, vaultRoot: join(root, 'vault') };
}

const founderCompleted = [
  'the-calling',
  'first-mint',
  'taste-resonance',
  'the-loop',
  'viability',
  'memory',
  'many-gardens',
  'living-org',
  'the-gate',
];

test('growth journal derives the current frontier from quest inputs', async () => {
  const ctx = tmpCtx();
  mkdirSync(join(ctx.root, '.operator'), { recursive: true });
  writeFileSync(join(ctx.root, '.operator', 'founder.json'), JSON.stringify({ completedArcs: founderCompleted }));
  writeFileSync(join(ctx.root, '.operator', 'acme.project.json'), JSON.stringify({
    briefStatus: 'draft',
    contractExists: false,
    depositReceived: false,
  }));

  const entry = await buildGrowthJournalEntry(ctx, 'acme', {
    nowIso: '2026-06-20T00:00:00.000Z',
    paperclip: { reachable: false, agents: 0, issuesDone: 0, issuesOpen: 0 },
  });

  assert.equal(entry.schema, 'cambium.growth-journal.v1');
  assert.equal(entry.quest.completed, 9);
  assert.equal(entry.quest.current?.id, 'the-brief');
  assert.match(entry.quest.current?.evidence ?? '', /brief pending/);
  assert.ok(entry.gaps.some((gap) => gap.id === 'quest-the-brief' && gap.status === 'active-frontier'));
});

test('growth journal records retired surfaces and appends JSONL entries', async () => {
  const ctx = tmpCtx();
  const entry = await buildGrowthJournalEntry(ctx, 'cambium', {
    nowIso: '2026-06-20T01:02:03.000Z',
    paperclip: { reachable: false, agents: 0, issuesDone: 0, issuesOpen: 0 },
  });
  const path = appendGrowthJournalEntry(ctx, entry);
  const lines = readFileSync(path, 'utf8').trim().split('\n');
  const saved = JSON.parse(lines[0]);

  assert.equal(lines.length, 1);
  assert.deepEqual(saved.surfaces.retired.map((surface: any) => surface.id), ['teamforge', 'multica']);
  assert.ok(saved.driftGuards.canonicalFiles.some((file: string) => file.endsWith('INFRA_STATUS.md')));
  assert.equal(saved.id, 'gj-20260620-010203000Z');
});

test('growth journal marks Plexus confirmed from bridge smoke evidence', async () => {
  const ctx = tmpCtx();
  mkdirSync(join(ctx.root, '..', 'plexus-ts', 'docs', 'evidence'), { recursive: true });
  writeFileSync(join(ctx.root, '..', 'plexus-ts', 'docs', 'evidence', '2026-06-21-thoughtseed-bridge-smoke.md'), '# passed\n');

  const entry = await buildGrowthJournalEntry(ctx, 'cambium', {
    nowIso: '2026-06-20T02:00:00.000Z',
    paperclip: { reachable: false, agents: 0, issuesDone: 0, issuesOpen: 0 },
  });

  assert.equal(entry.surfaces.pending.find((surface) => surface.id === 'plexus')?.status, 'confirmed');
  assert.equal(entry.gaps.some((gap) => gap.id === 'plexus-readback'), false);
});

test('growth journal closes Cloudflare gap from proof packet', async () => {
  const ctx = tmpCtx();
  mkdirSync(join(ctx.vaultRoot, '60-client-ecosystem', 'cambium', 'cloudflare'), { recursive: true });
  writeFileSync(join(ctx.vaultRoot, '60-client-ecosystem', 'cambium', 'cloudflare', '2026-06-21-cloudflare-shell-proof.json'), '{"status":"verified"}\n');

  const entry = await buildGrowthJournalEntry(ctx, 'cambium', {
    nowIso: '2026-06-20T03:00:00.000Z',
    paperclip: { reachable: false, agents: 0, issuesDone: 0, issuesOpen: 0 },
  });

  assert.equal(entry.surfaces.pending.find((surface) => surface.id === 'cloudflare-cli-probe')?.status, 'proof-file-present');
  assert.equal(entry.gaps.some((gap) => gap.id === 'cloudflare-cli-probe'), false);
});
