import { spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const devUrl = 'http://127.0.0.1:5173/';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const electron = path.join(appRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');

const vite = spawn(npm, ['run', 'dev'], { cwd: appRoot, stdio: 'inherit', env: process.env });
let electronProcess;
let stopping = false;

async function waitForVite() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(devUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await delay(250);
  }
  throw new Error(`Vite did not become ready at ${devUrl}`);
}

function stop() {
  if (stopping) return;
  stopping = true;
  if (electronProcess && !electronProcess.killed) electronProcess.kill('SIGTERM');
  if (!vite.killed) vite.kill('SIGTERM');
}

try {
  await waitForVite();
  electronProcess = spawn(electron, ['.'], {
    cwd: appRoot,
    stdio: 'inherit',
    env: { ...process.env, CAMBIUM_DESKTOP_DEV_SERVER: devUrl },
  });
  electronProcess.on('exit', (code, signal) => {
    stop();
    process.exit(code ?? (signal ? 1 : 0));
  });
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch (error) {
  stop();
  throw error;
}
