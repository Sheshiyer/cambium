import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  copyScope,
  createCortexTextHttpStore,
  isCortexTextScope,
  type CortexTextScope,
  type CortexTextStore,
} from './cortex-text.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAX_SCOPE_FILE_BYTES = 16 * 1024;
const FLAGS = new Set(['--scope-file', '--query']);

interface CliArgs {
  scopeFile: string;
  query: string;
}

function parseArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!FLAGS.has(flag)) throw new Error('unknown flag');
    if (values.has(flag)) throw new Error('duplicate flag');
    if (value === undefined) throw new Error('missing value');
    values.set(flag, value);
  }
  const scopeFile = values.get('--scope-file');
  const query = values.get('--query');
  if (scopeFile === undefined || query === undefined || query.trim() === '') throw new Error('usage');
  return { scopeFile, query };
}

function loadScopeFile(file: string): { endpoint: string; scope: CortexTextScope } {
  if (!isAbsolute(file)) throw new Error('scope file must be absolute');
  const canonical = realpathSync(file);
  const rel = relative(realpathSync(REPO_ROOT), canonical);
  const inside = rel === '' || (!isAbsolute(rel) && rel.split(sep)[0] !== '..');
  if (inside) throw new Error('scope file must be outside the repository');
  const stat = lstatSync(file);
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) throw new Error('scope file must be a private regular file');
  if (stat.size > MAX_SCOPE_FILE_BYTES) throw new Error('scope file too large');
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('invalid scope file');
  const { endpoint, scope, ...extra } = parsed as Record<string, unknown>;
  if (Object.keys(extra).length > 0 || typeof endpoint !== 'string' || !isCortexTextScope(scope)) {
    throw new Error('invalid scope file');
  }
  return { endpoint, scope };
}

function openStore(file: string): { store: CortexTextStore; scope: CortexTextScope } | undefined {
  try {
    const token = process.env.CORTEX_TEXT_TOKEN ?? '';
    const config = loadScopeFile(file);
    const store = createCortexTextHttpStore({ endpoint: config.endpoint, token, scope: config.scope });
    return { store, scope: config.scope };
  } catch {
    return undefined;
  }
}

function fail(message: string, code: number): number {
  process.stderr.write(`cortex-text: ${message}\n`);
  return code;
}

async function main(argv: string[]): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch {
    return fail('usage: cortex-text --scope-file ABS --query TEXT', 2);
  }
  const opened = openStore(args.scopeFile);
  if (!opened) return fail('configuration rejected', 2);
  const result = await opened.store.recall({ ...copyScope(opened.scope), query: args.query });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.availability === 'available' || result.availability === 'empty' ? 0 : 1;
}

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
