import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { userInfo } from 'node:os';
import path from 'node:path';

const HOST_SCHEMA = 'temperance.cambium-ralph-boundary.v1';
const HOST_ISSUER = 'temperance-engine';
const HOST_AUDIENCE = 'cambium-ralph-iteration';
const COMMAND_KEYS = Object.freeze(['manifestVerifier', 'ralphExecutor', 'ralphVerifier']);
const DIGEST = /^sha256:[a-f0-9]{64}$/;

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new TypeError(`${label} must use the closed schema`);
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function assertProtected(pathname, installationRoot, { executable = false } = {}) {
  const root = realpathSync(installationRoot);
  if (lstatSync(pathname).isSymbolicLink()) {
    throw new TypeError('Temperance host boundary path must not be a symbolic link');
  }
  const actual = realpathSync(pathname);
  if (!inside(root, actual)) throw new TypeError('Temperance host boundary path escapes its protected installation root');
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  for (let current = actual; inside(root, current); current = path.dirname(current)) {
    const lexical = lstatSync(current);
    const metadata = statSync(current);
    if (lexical.isSymbolicLink() || (uid !== null && metadata.uid !== uid) || (metadata.mode & 0o022) !== 0) {
      throw new TypeError('Temperance host boundary path or parent is writable or not owner-protected');
    }
    if (current === root) break;
  }
  const metadata = statSync(actual);
  if (!metadata.isFile() || (executable && (metadata.mode & 0o100) === 0)) {
    throw new TypeError('Temperance host boundary command is not an owner-executable regular file');
  }
  return actual;
}

function digestFile(pathname) {
  return `sha256:${createHash('sha256').update(readFileSync(pathname)).digest('hex')}`;
}

export function resolveTemperanceHostBoundary({
  installationRoot = path.join(userInfo().homedir, '.temperance_engine'),
  manifestPath = path.join(installationRoot, 'state', 'cambium-ralph-boundary.v1.json'),
} = {}) {
  const root = realpathSync(installationRoot);
  const manifest = assertProtected(manifestPath, root);
  let value;
  try { value = JSON.parse(readFileSync(manifest, 'utf8')); } catch { throw new TypeError('Temperance host boundary manifest is missing or malformed'); }
  exactKeys(value, ['schema', 'issuer', 'audience', 'commands'], 'Temperance host boundary manifest');
  if (value.schema !== HOST_SCHEMA || value.issuer !== HOST_ISSUER || value.audience !== HOST_AUDIENCE) {
    throw new TypeError('Temperance host boundary manifest identity is invalid');
  }
  exactKeys(value.commands, COMMAND_KEYS, 'Temperance host boundary commands');
  const commands = {};
  for (const key of COMMAND_KEYS) {
    const descriptor = value.commands[key];
    exactKeys(descriptor, ['path', 'digest'], `Temperance host boundary ${key}`);
    if (typeof descriptor.path !== 'string' || path.isAbsolute(descriptor.path) || path.normalize(descriptor.path) !== descriptor.path
        || descriptor.path === '..' || descriptor.path.startsWith(`..${path.sep}`) || !DIGEST.test(descriptor.digest)) {
      throw new TypeError(`Temperance host boundary ${key} descriptor is invalid`);
    }
    const lexicalExecutable = path.join(root, descriptor.path);
    if (lstatSync(lexicalExecutable).isSymbolicLink()) throw new TypeError(`Temperance host boundary ${key} must not be a symbolic link`);
    const executable = assertProtected(lexicalExecutable, root, { executable: true });
    if (digestFile(executable) !== descriptor.digest) throw new TypeError(`Temperance host boundary ${key} digest does not match installed bytes`);
    commands[key] = executable;
  }
  return Object.freeze({ installationRoot: root, manifest, commands: Object.freeze(commands) });
}

export function createTemperanceHostCommandRunner(options) {
  const { workingDirectory = process.cwd(), ...boundaryOptions } = options ?? {};
  const boundary = resolveTemperanceHostBoundary(boundaryOptions);
  const cwd = realpathSync(workingDirectory);
  if (!statSync(cwd).isDirectory()) throw new TypeError('Temperance host working directory must be a directory');
  const environment = Object.freeze({
    HOME: userInfo().homedir,
    LANG: 'C',
    LC_ALL: 'C',
    PATH: '/usr/bin:/bin',
  });
  return (commandKey, args, input, { allowMissing = false } = {}) => {
    if (!COMMAND_KEYS.includes(commandKey) || !Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
      throw new TypeError('Temperance host command request is invalid');
    }
    const result = spawnSync(boundary.commands[commandKey], args, {
      encoding: 'utf8',
      env: environment,
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
    });
    if (allowMissing && result.status === 3) return null;
    if (result.error || result.status !== 0) throw new TypeError(`protected Temperance host command ${commandKey} failed`);
    try { return JSON.parse(result.stdout); } catch { throw new TypeError(`protected Temperance host command ${commandKey} returned invalid JSON`); }
  };
}
