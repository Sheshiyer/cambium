#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const repoRoot = path.resolve(root, '../..');
const promptPath = path.join(root, 'asset-prompts/meshy-island-prompts.json');
const ledgerPath = path.join(repoRoot, 'docs/plans/assets/cambium-r3f-game-engine-realignment/meshy-task-ledger.json');
const publicAssetRoot = path.join(root, 'public/assets/meshy/islands');
const manifestPath = path.join(publicAssetRoot, 'manifest.json');
const apiBase = 'https://api.meshy.ai/openapi/v2/text-to-3d';

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function loadEnv() {
  const envPath = process.env.MESHY_ENV_FILE || path.join(homedir(), '.claude', '.env');
  if (!existsSync(envPath)) return {};
  const env = {};
  const lines = (await readFile(envPath, 'utf8')).split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}

async function getApiKey() {
  const env = await loadEnv();
  const key = process.env.MESHY_API_KEY || env.MESHY_API_KEY;
  if (!key) throw new Error('MESHY_API_KEY was not found in process env or $HOME/.claude/.env');
  return key;
}

async function meshyFetch(url, options = {}) {
  const apiKey = await getApiKey();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = body?.message || body?.error || text || response.statusText;
    throw new Error(`Meshy API ${response.status}: ${message}`);
  }
  return body;
}

function islandById(spec, id) {
  const island = spec.islands.find((item) => item.id === id);
  if (!island) throw new Error(`Unknown island "${id}". Valid ids: ${spec.islands.map((item) => item.id).join(', ')}`);
  return island;
}

async function appendLedger(entry) {
  const ledger = existsSync(ledgerPath) ? await readJson(ledgerPath) : { provider: 'meshy', entries: [] };
  ledger.entries.push({ ...entry, ts: new Date().toISOString() });
  await writeJson(ledgerPath, ledger);
}

function requireExecute(args, description) {
  if (!args.execute) {
    throw new Error(`${description} would call the paid Meshy API. Re-run with --execute after confirming credit spend.`);
  }
}

async function plan() {
  const spec = await readJson(promptPath);
  console.log('Meshy island asset plan');
  console.log(`Prompt spec: ${path.relative(repoRoot, promptPath)}`);
  console.log(`Estimated credits: ${spec.estimatedCredits.fullAssetPerIsland} per fully refined island, ${spec.estimatedCredits.fullSetOfFive} for all five.`);
  for (const island of spec.islands) {
    console.log(`- ${island.id}: preview ${island.targetPolycount} target polys, prompt ${island.prompt.length}/600 chars, texture ${island.texturePrompt.length}/600 chars`);
  }
  console.log('\nCredit-safe commands:');
  console.log('  npm --prefix apps/cambium-r3f run meshy:assets -- preview --island genesis --execute');
  console.log('  npm --prefix apps/cambium-r3f run meshy:assets -- status --task-id <preview-task-id>');
  console.log('  npm --prefix apps/cambium-r3f run meshy:assets -- refine --island genesis --preview-task-id <preview-task-id> --execute');
  console.log('  npm --prefix apps/cambium-r3f run meshy:assets -- download --island genesis --task-id <refine-task-id> --execute');
}

async function preview(args) {
  requireExecute(args, 'Preview generation');
  const spec = await readJson(promptPath);
  const island = islandById(spec, args.island);
  const body = {
    mode: 'preview',
    prompt: island.prompt,
    model_type: 'standard',
    ai_model: 'latest',
    should_remesh: true,
    topology: 'quad',
    target_polycount: island.targetPolycount,
    target_formats: ['glb'],
    moderation: true,
    origin_at: 'bottom',
  };
  const result = await meshyFetch(apiBase, { method: 'POST', body: JSON.stringify(body) });
  await appendLedger({ command: 'preview', island: island.id, taskId: result.result, request: { ...body, prompt: island.prompt } });
  console.log(JSON.stringify({ island: island.id, previewTaskId: result.result }, null, 2));
}

async function status(args) {
  if (!args['task-id']) throw new Error('status requires --task-id <id>');
  const task = await meshyFetch(`${apiBase}/${args['task-id']}`, { method: 'GET' });
  console.log(JSON.stringify({
    id: task.id,
    type: task.type,
    status: task.status,
    progress: task.progress,
    consumedCredits: task.consumed_credits,
    availableFormats: Object.keys(task.model_urls ?? {}),
    hasThumbnail: Boolean(task.thumbnail_url),
    error: task.task_error?.message || null,
  }, null, 2));
}

async function refine(args) {
  requireExecute(args, 'Refine generation');
  if (!args['preview-task-id']) throw new Error('refine requires --preview-task-id <id>');
  const spec = await readJson(promptPath);
  const island = islandById(spec, args.island);
  const body = {
    mode: 'refine',
    preview_task_id: args['preview-task-id'],
    enable_pbr: true,
    texture_prompt: island.texturePrompt,
    ai_model: 'latest',
    moderation: true,
    remove_lighting: true,
    target_formats: ['glb'],
    origin_at: 'bottom',
  };
  const result = await meshyFetch(apiBase, { method: 'POST', body: JSON.stringify(body) });
  await appendLedger({ command: 'refine', island: island.id, previewTaskId: args['preview-task-id'], taskId: result.result, request: body });
  console.log(JSON.stringify({ island: island.id, refineTaskId: result.result }, null, 2));
}

async function download(args) {
  requireExecute(args, 'Asset download');
  if (!args['task-id']) throw new Error('download requires --task-id <id>');
  const spec = await readJson(promptPath);
  const island = islandById(spec, args.island);
  const task = await meshyFetch(`${apiBase}/${args['task-id']}`, { method: 'GET' });
  if (task.status !== 'SUCCEEDED') {
    throw new Error(`Task ${args['task-id']} is ${task.status}; wait for SUCCEEDED before downloading.`);
  }
  if (!task.model_urls?.glb) throw new Error(`Task ${args['task-id']} does not expose a GLB URL.`);
  const islandDir = path.join(publicAssetRoot, island.id);
  await mkdir(islandDir, { recursive: true });
  const glbResponse = await fetch(task.model_urls.glb);
  if (!glbResponse.ok) throw new Error(`GLB download failed: ${glbResponse.status}`);
  await writeFile(path.join(islandDir, 'model.glb'), Buffer.from(await glbResponse.arrayBuffer()));
  if (task.thumbnail_url) {
    const thumbnailResponse = await fetch(task.thumbnail_url);
    if (thumbnailResponse.ok) {
      await writeFile(path.join(islandDir, 'thumbnail.png'), Buffer.from(await thumbnailResponse.arrayBuffer()));
    }
  }
  const manifest = existsSync(manifestPath) ? await readJson(manifestPath) : { provider: 'meshy', status: 'partial', generatedAt: null, assets: {} };
  manifest.generatedAt = new Date().toISOString();
  manifest.assets[island.id] = {
    taskId: task.id,
    stage: task.type === 'text-to-3d-refine' ? 'refined' : 'preview',
    taskType: task.type ?? null,
    title: island.title,
    model: `/assets/meshy/islands/${island.id}/model.glb`,
    thumbnail: task.thumbnail_url ? `/assets/meshy/islands/${island.id}/thumbnail.png` : null,
    taskCredits: task.consumed_credits ?? null,
  };
  const expectedAssetIds = spec.islands.map((item) => item.id);
  manifest.status = expectedAssetIds.every((id) => manifest.assets[id]?.stage === 'refined') ? 'complete' : 'partial';
  await writeJson(manifestPath, manifest);
  await appendLedger({ command: 'download', island: island.id, taskId: task.id, model: manifest.assets[island.id].model });
  console.log(JSON.stringify({ island: island.id, model: manifest.assets[island.id].model, manifest: path.relative(repoRoot, manifestPath) }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] ?? 'plan';
  if (command === 'plan') return plan();
  if (command === 'preview') return preview(args);
  if (command === 'status') return status(args);
  if (command === 'refine') return refine(args);
  if (command === 'download') return download(args);
  throw new Error(`Unknown command "${command}". Use plan, preview, status, refine, or download.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
