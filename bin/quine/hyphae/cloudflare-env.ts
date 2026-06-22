import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CloudflareEnv {
  accountId: string;
  apiToken: string;
  source: 'env' | 'env-alias' | 'claude-env' | 'claude-env-alias' | 'default-account' | 'missing';
}

const DEFAULT_ACCOUNT_ID = '9d9d23b27f32e70ae3afb6a1aa2c0f10';

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    out[key.trim()] = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

export function resolveCloudflareEnv(env: NodeJS.ProcessEnv = process.env, envPath = join(homedir(), '.claude', '.env')): CloudflareEnv {
  if (env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
    return { apiToken: env.CLOUDFLARE_API_TOKEN, accountId: env.CLOUDFLARE_ACCOUNT_ID, source: 'env' };
  }
  if (env.CF_API_TOKEN && env.CF_ACCOUNT_ID) {
    return { apiToken: env.CF_API_TOKEN, accountId: env.CF_ACCOUNT_ID, source: 'env-alias' };
  }

  const file = parseEnvFile(envPath);
  if (file.CLOUDFLARE_API_TOKEN && file.CLOUDFLARE_ACCOUNT_ID) {
    return { apiToken: file.CLOUDFLARE_API_TOKEN, accountId: file.CLOUDFLARE_ACCOUNT_ID, source: 'claude-env' };
  }
  if (file.CF_API_TOKEN && file.CF_ACCOUNT_ID) {
    return { apiToken: file.CF_API_TOKEN, accountId: file.CF_ACCOUNT_ID, source: 'claude-env-alias' };
  }
  if ((env.CLOUDFLARE_API_TOKEN || file.CLOUDFLARE_API_TOKEN) && DEFAULT_ACCOUNT_ID) {
    return { apiToken: env.CLOUDFLARE_API_TOKEN ?? file.CLOUDFLARE_API_TOKEN ?? '', accountId: DEFAULT_ACCOUNT_ID, source: 'default-account' };
  }
  return { apiToken: '', accountId: env.CLOUDFLARE_ACCOUNT_ID ?? file.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID, source: 'missing' };
}

export function ensureCloudflareEnv(env: NodeJS.ProcessEnv = process.env): CloudflareEnv {
  const resolved = resolveCloudflareEnv(env);
  if (resolved.apiToken && !env.CLOUDFLARE_API_TOKEN) env.CLOUDFLARE_API_TOKEN = resolved.apiToken;
  if (resolved.accountId && !env.CLOUDFLARE_ACCOUNT_ID) env.CLOUDFLARE_ACCOUNT_ID = resolved.accountId;
  return resolved;
}

export function cloudflareEnvReady(env: NodeJS.ProcessEnv = process.env): boolean {
  const resolved = resolveCloudflareEnv(env);
  return Boolean(resolved.apiToken && resolved.accountId);
}
