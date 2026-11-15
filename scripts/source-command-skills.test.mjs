import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { install } from '../.agents/skills/sapling-lifecycle/scripts/install.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const skills = [
  {
    path: '.agents/skills/source-command-feature-development/SKILL.md',
    command: '/cambium-feature',
    files: [
      'apps/cambium-r3f/src/scene',
      'apps/cambium-r3f/src/world',
      'apps/cambium-r3f/src/engine',
      'apps/cambium-r3f/src/generated',
    ],
  },
  {
    path: '.agents/skills/source-command-add-or-upgrade-r3f-feature/SKILL.md',
    command: '/cambium-r3f-feature',
    files: [
      'apps/cambium-r3f/src/scene',
      'apps/cambium-r3f/src/world',
      'docs/plans/assets/cambium-r3f-game-engine-realignment',
      'tasks/lessons.md',
    ],
  },
  {
    path: '.agents/skills/source-command-add-or-update-project-evidence-quests/SKILL.md',
    command: '/cambium-evidence-quests',
    files: [
      'bin/quine/hyphae/project-evidence.ts',
      'bin/quine/hyphae/project-evidence.test.ts',
      'bin/quine/hyphae/quests.ts',
      'bin/quine/hyphae/quests.test.ts',
      'bin/operator/quests/quests.ts',
      'bin/operator/quests/quests.test.ts',
    ],
  },
];

test('cambium family skills name the installed commands and only real paths', async () => {
  for (const skill of skills) {
    const body = await readFile(path.join(root, skill.path), 'utf8');
    const name = path.basename(path.dirname(skill.path));
    assert.match(body, new RegExp(`^name: "${name}"`, 'm'));
    assert.match(body, new RegExp(skill.command.replace('/', '\\/')));
    assert.match(body, /grants no publication, scheduling, spend, admission, migration, provider change, or deployment/);
    assert.doesNotMatch(body, /tasks\/todo\.md/);
    assert.doesNotMatch(body, /\/\*\*\/api\/\*\*/);
    assert.doesNotMatch(body, /game-engine-realignment\/verification/);
    for (const file of skill.files) {
      assert.equal(existsSync(path.join(root, file)), true, `${skill.path} names missing path ${file}`);
      assert.match(body, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  }
});

test('dry-run install of the cambium family finds the source skills', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'cambium-family-'));
  try {
    const result = install({ mode: 'dry-run', home, sourceRoot: root, families: ['cambium'] });
    assert.equal(result.ok, true, result.conflicts.join('\n'));
    assert.deepEqual(result.conflicts, []);
    assert.equal(result.artifacts.length, 8 * 4 + 1 + 3 * 4);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
