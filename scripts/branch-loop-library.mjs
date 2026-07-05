#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadBranchStories } from '../bin/quine/hyphae/branch-stories.ts';
import { deriveBranchLoopLibrary } from '../bin/operator/quests/branch-loop-library.ts';

const root = resolve(process.cwd());
const tenantIndex = process.argv.indexOf('--tenant');
const tenant = tenantIndex >= 0 ? process.argv[tenantIndex + 1] || 'cambium' : 'cambium';
const write = process.argv.includes('--write');

const stories = loadBranchStories({ root }, tenant);
const library = deriveBranchLoopLibrary(stories);

const payload = {
  schema: 'cambium.branch_loop_library.v1',
  tenant,
  generatedAt: new Date().toISOString(),
  ...library,
};

console.log(`branch loops: total=${library.total} green=${library.green} yellow=${library.yellow} red=${library.red}`);
for (const row of library.rows) {
  console.log(`${row.boundaryColor} ${row.loopId} -> ${row.runMode} -> ${row.stateFile}`);
}

if (write) {
  const outDir = join(root, '.operator', 'branch-loops');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.json'), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`wrote ${join('.operator', 'branch-loops', 'index.json')}`);
}
