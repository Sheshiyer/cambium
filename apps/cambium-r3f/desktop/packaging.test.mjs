import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
const mainSource = readFileSync(path.join(appRoot, 'desktop/main.cjs'), 'utf8');
const preloadSource = readFileSync(path.join(appRoot, 'desktop/preload.cjs'), 'utf8');

test('desktop package owns a pinned shell and macOS artifact policy', () => {
  assert.equal(packageJson.main, 'desktop/main.cjs');
  assert.equal(packageJson.devDependencies.electron, '43.2.0');
  assert.equal(packageJson.devDependencies['electron-builder'], '26.15.3');
  assert.equal(packageJson.build.appId, 'space.thoughtseed.cambium');
  assert.equal(packageJson.build.productName, 'Cambium');
  assert.deepEqual(packageJson.build.mac.target, ['dmg', 'zip']);
  assert.ok(packageJson.build.files.includes('dist/**/*'));
});

test('main process keeps the local app on a secure custom protocol', () => {
  assert.match(mainSource, /registerSchemesAsPrivileged/);
  assert.match(mainSource, /protocol\.handle/);
  assert.match(mainSource, /contextIsolation: true/);
  assert.match(mainSource, /nodeIntegration: false/);
  assert.match(mainSource, /sandbox: true/);
  assert.match(mainSource, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/);
  assert.match(mainSource, /will-attach-webview/);
  assert.match(mainSource, /setPermissionRequestHandler/);
});

test('preload exposes a narrow non-privileged desktop marker', () => {
  assert.match(preloadSource, /contextBridge\.exposeInMainWorld/);
  assert.doesNotMatch(preloadSource, /ipcRenderer\.(send|invoke|on)/);
  assert.doesNotMatch(preloadSource, /shell|fs|child_process/);
});

test('built renderer uses relative local paths and includes required assets', () => {
  const distRoot = path.join(appRoot, 'dist');
  assert.ok(existsSync(path.join(distRoot, 'index.html')), 'build the renderer before desktop packaging tests');
  const index = readFileSync(path.join(distRoot, 'index.html'), 'utf8');
  assert.match(index, /\.\/assets\//);
  assert.doesNotMatch(index, /(?:src|href)="\/(?:assets|src|favicon)/);
  assert.ok(existsSync(path.join(distRoot, 'tapestry.json')));
  assert.ok(existsSync(path.join(distRoot, 'favicon.svg')));
  const islandRoot = path.join(distRoot, 'assets/meshy/islands');
  for (const island of ['genesis', 'taste', 'build', 'ops', 'cortex']) {
    assert.ok(statSync(path.join(islandRoot, island, 'model.glb')).size > 0, `${island} GLB is packaged`);
  }
});

test('packaged payload contains no secret-bearing environment files or known token names', () => {
  const forbiddenNames = /(?:MESHY_API_KEY|CLOUDFLARE_API_TOKEN|AWS_SECRET_ACCESS_KEY|PRIVATE_KEY)/;
  const roots = [path.join(appRoot, 'dist'), path.join(appRoot, 'desktop/main.cjs'), path.join(appRoot, 'desktop/preload.cjs')];
  const files = [];
  const visit = (directory) => {
    if (statSync(directory).isFile()) {
      files.push(directory);
      return;
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else files.push(entryPath);
    }
  };
  for (const root of roots) visit(root);
  for (const file of files) {
    assert.ok(!/\.env(?:\.|$)/.test(path.basename(file)), `${file} is not a bundled environment file`);
    assert.doesNotMatch(readFileSync(file, 'utf8'), forbiddenNames, `${file} contains no provider secret name`);
  }
});
