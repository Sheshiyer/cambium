import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  path.join(appRoot, 'release', 'mac-arm64', 'Cambium.app', 'Contents', 'MacOS', 'Cambium'),
  path.join(appRoot, 'release', 'mac-x64', 'Cambium.app', 'Contents', 'MacOS', 'Cambium'),
  path.join(appRoot, 'release', 'mac', 'Cambium.app', 'Contents', 'MacOS', 'Cambium'),
];
const executable = candidates.find(existsSync);

if (!executable) {
  throw new Error(`no packaged Cambium executable found; build with npm run desktop:dist:mac:dir first\n${candidates.join('\n')}`);
}

const child = spawn(executable, ['--disable-gpu'], {
  cwd: appRoot,
  env: { ...process.env, CAMBIUM_DESKTOP_SMOKE: '1', ELECTRON_DISABLE_GPU: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => {
  output += chunk;
  process.stdout.write(chunk);
});
child.stderr.on('data', (chunk) => process.stderr.write(chunk));

const timeout = setTimeout(() => {
  child.kill('SIGTERM');
}, 20_000);

const exitCode = await new Promise((resolve) => child.once('exit', (code) => resolve(code ?? 1)));
clearTimeout(timeout);

if (exitCode !== 0 || !output.includes('CAMBIUM_DESKTOP_READY cambium://app/index.html')) {
  throw new Error(`packaged desktop smoke failed with exit ${exitCode}`);
}

process.stdout.write('packaged desktop smoke passed\n');
