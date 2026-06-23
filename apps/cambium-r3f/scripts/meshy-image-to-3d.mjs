#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const repoRoot = path.resolve(root, '../..');
const defaultSourceImage = path.join(
  repoRoot,
  'docs/plans/assets/cambium-r3f-game-engine-realignment/image-to-3d/ops-source.png',
);
const defaultSourcePrompt = path.join(
  repoRoot,
  'docs/plans/assets/cambium-r3f-game-engine-realignment/image-to-3d/ops-source-prompt.md',
);
const sourcePlateManifestPath = path.join(
  repoRoot,
  'docs/plans/assets/cambium-r3f-game-engine-realignment/image-source-pass/source-plate-prompts.json',
);
const ledgerPath = path.join(
  repoRoot,
  'docs/plans/assets/cambium-r3f-game-engine-realignment/image-to-3d/meshy-image-task-ledger.json',
);
const publicAssetRoot = path.join(root, 'public/assets/meshy/image-to-3d');
const manifestPath = path.join(publicAssetRoot, 'manifest.json');
const apiBase = 'https://api.meshy.ai/openapi/v1/image-to-3d';

const islandDefaults = {
  ops: {
    title: 'Ops loop island image-to-3D trial',
    kind: 'island',
    texturePrompt:
      'Cambium operations island material: dark basalt substrate, chartreuse signal veins, ivory node caps, peach calibration seams, matte PBR finish, no labels or scenery.',
    sourceImage: defaultSourceImage,
  },
};

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
  const envPath = '/Users/sheshnarayaniyer/.claude/.env';
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
  if (!key) throw new Error('MESHY_API_KEY was not found in process env or /Users/sheshnarayaniyer/.claude/.env');
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

function requireExecute(args, description) {
  if (!args.execute) {
    throw new Error(`${description} would call or persist Meshy assets. Re-run with --execute after confirming the trial.`);
  }
}

function getIsland(args) {
  const id = args.asset ?? args.island ?? 'ops';
  const defaults = islandDefaults[id];
  if (!defaults) throw new Error(`Unknown image-to-3D trial island "${id}". Valid ids: ${Object.keys(islandDefaults).join(', ')}`);
  return { id, ...defaults };
}

async function getAsset(args) {
  const id = args.asset ?? args.island ?? 'ops';
  if (existsSync(sourcePlateManifestPath)) {
    const manifest = await readJson(sourcePlateManifestPath);
    const plate = manifest.plates.find((item) => item.id === id);
    if (plate) {
      return {
        id: plate.id,
        title: plate.title,
        kind: plate.kind,
        texturePrompt: `${plate.title} material from the provided Cambium source plate. Preserve visible basalt strata, chartreuse channels, ivory caps, peach seams, matte PBR finish, and no labels or scenery.`,
        sourceImage: path.resolve(repoRoot, manifest.outputDirectory, plate.output),
      };
    }
  }
  return getIsland(args);
}

function getImagePath(args, asset) {
  return path.resolve(args.image ?? asset.sourceImage ?? defaultSourceImage);
}

async function appendLedger(entry) {
  const ledger = existsSync(ledgerPath)
    ? await readJson(ledgerPath)
    : { provider: 'meshy', pipeline: 'image-to-3d', entries: [] };
  ledger.entries.push({ ...entry, ts: new Date().toISOString() });
  await writeJson(ledgerPath, ledger);
}

function imageDataUri(imagePath) {
  if (!existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`);
  const ext = path.extname(imagePath).toLowerCase();
  const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const bytes = statSync(imagePath).size;
  if (bytes <= 0) throw new Error(`Image is empty: ${imagePath}`);
  return {
    bytes,
    contentType,
    uri: `data:${contentType};base64,${readFileSync(imagePath).toString('base64')}`,
  };
}

function sanitizedRequest(body) {
  return {
    ...body,
    image_url: '<base64 data URI omitted>',
    ...(body.texture_image_url ? { texture_image_url: '<base64 data URI omitted>' } : {}),
  };
}

function runtimeTargetPolycount(args, asset) {
  const fallback = asset.kind === 'prop' ? 12000 : 35000;
  const targetPolycount = Number(args['target-polycount'] ?? fallback);
  if (!Number.isFinite(targetPolycount) || targetPolycount < 100) {
    throw new Error(`Invalid --target-polycount value: ${args['target-polycount']}`);
  }
  return targetPolycount;
}

async function imageTrialRequest(args) {
  const asset = await getAsset(args);
  const imagePath = getImagePath(args, asset);
  const image = imageDataUri(imagePath);
  const profile = args.profile ?? 'master';
  const shouldTexture = args['should-texture'] === 'false' ? false : true;
  const useTextureImage = args['texture-mode'] === 'image';
  const body = {
    image_url: image.uri,
    model_type: args['model-type'] ?? 'standard',
    ai_model: args['ai-model'] ?? 'latest',
    should_texture: shouldTexture,
    enable_pbr: args.pbr === 'false' ? false : true,
    image_enhancement: args['image-enhancement'] === 'false' ? false : true,
    remove_lighting: args['remove-lighting'] === 'false' ? false : true,
    moderation: true,
    target_formats: ['glb'],
    origin_at: 'bottom',
    alpha_thumbnail: true,
    multi_view_thumbnails: true,
  };

  if (shouldTexture) {
    if (useTextureImage) {
      body.texture_image_url = image.uri;
    } else {
      body.texture_prompt = asset.texturePrompt;
    }
  }

  if (profile === 'master') {
    body.should_remesh = false;
    body.hd_texture = args['hd-texture'] === 'false' ? false : true;
  } else if (profile === 'runtime') {
    body.should_remesh = true;
    body.topology = args.topology ?? 'quad';
    body.target_polycount = runtimeTargetPolycount(args, asset);
    body.hd_texture = args['hd-texture'] === 'true';
  } else {
    throw new Error(`Unknown --profile "${profile}". Use master or runtime.`);
  }

  return {
    island: asset,
    profile,
    imagePath,
    imageBytes: image.bytes,
    body,
  };
}

async function plan(args) {
  const { island, profile, imagePath, imageBytes, body } = await imageTrialRequest(args);
  console.log('Meshy image-to-3D single-asset trial');
  console.log(`Asset: ${island.id} (${island.title})`);
  console.log(`Kind: ${island.kind}`);
  console.log(`Profile: ${profile}${profile === 'master' ? ' (high-quality source master, no polycount target)' : ' (optimized runtime derivative)'}`);
  console.log(`Source prompt: ${existsSync(sourcePlateManifestPath) ? path.relative(repoRoot, sourcePlateManifestPath) : path.relative(repoRoot, defaultSourcePrompt)}`);
  console.log(`Source image: ${path.relative(repoRoot, imagePath)} (${Math.round(imageBytes / 1024)} KB)`);
  console.log(`Estimated Meshy credits: ${body.should_texture ? 30 : 20} for one Meshy-6/latest Image to 3D task.`);
  console.log(`Output root: apps/cambium-r3f/public/assets/meshy/image-to-3d/${island.id}/`);
  if (profile === 'master') {
    console.log('Master policy: do not constrain polycount during generation; optimize only after visual approval.');
  }
  console.log('\nRequest preview without image data:');
  console.log(JSON.stringify(sanitizedRequest(body), null, 2));
  console.log('\nCredit-gated commands:');
  console.log(`  npm run r3f:meshy:image -- submit --asset ${island.id} --profile ${profile} --execute`);
  console.log('  npm run r3f:meshy:image -- status --task-id <task-id>');
  console.log(`  npm run r3f:meshy:image -- download --asset ${island.id} --task-id <task-id> --execute`);
}

async function submit(args) {
  requireExecute(args, 'Image-to-3D submission');
  const { island, profile, imagePath, imageBytes, body } = await imageTrialRequest(args);
  const result = await meshyFetch(apiBase, { method: 'POST', body: JSON.stringify(body) });
  await appendLedger({
    command: 'submit',
    island: island.id,
    profile,
    taskId: result.result,
    sourceImage: path.relative(repoRoot, imagePath),
    imageBytes,
    request: sanitizedRequest(body),
    estimatedCredits: body.should_texture ? 30 : 20,
  });
  console.log(JSON.stringify({ island: island.id, imageTo3dTaskId: result.result }, null, 2));
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

async function downloadAsset(url, file) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed for ${file}: ${response.status}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
}

function assetSize(file) {
  return existsSync(file) ? statSync(file).size : null;
}

async function download(args) {
  requireExecute(args, 'Image-to-3D download');
  if (!args['task-id']) throw new Error('download requires --task-id <id>');
  const island = await getAsset(args);
  const sourceImage = getImagePath(args, island);
  const task = await meshyFetch(`${apiBase}/${args['task-id']}`, { method: 'GET' });
  if (task.status !== 'SUCCEEDED') {
    throw new Error(`Task ${args['task-id']} is ${task.status}; wait for SUCCEEDED before downloading.`);
  }
  if (!task.model_urls?.glb) throw new Error(`Task ${args['task-id']} does not expose a GLB URL.`);

  const islandDir = path.join(publicAssetRoot, island.id);
  await mkdir(islandDir, { recursive: true });
  const modelFile = path.join(islandDir, 'model.glb');
  const thumbnailFile = path.join(islandDir, 'thumbnail.png');
  const alphaThumbnailFile = path.join(islandDir, 'thumbnail-alpha.png');
  if (args['skip-existing-model'] && existsSync(modelFile)) {
    console.log(`skip existing model: ${path.relative(repoRoot, modelFile)}`);
  } else {
    await downloadAsset(task.model_urls.glb, modelFile);
  }
  if (task.thumbnail_url) {
    await downloadAsset(task.thumbnail_url, thumbnailFile);
  }
  if (task.alpha_thumbnail_url) {
    await downloadAsset(task.alpha_thumbnail_url, alphaThumbnailFile);
  }
  const thumbnailViews = {};
  for (const [view, url] of Object.entries(task.thumbnail_urls ?? {})) {
    const viewFile = path.join(islandDir, `thumbnail-${view}.png`);
    await downloadAsset(url, viewFile);
    thumbnailViews[view] = `/assets/meshy/image-to-3d/${island.id}/thumbnail-${view}.png`;
  }

  const manifest = existsSync(manifestPath)
    ? await readJson(manifestPath)
    : { provider: 'meshy', pipeline: 'image-to-3d', status: 'partial', generatedAt: null, assets: {} };
  manifest.generatedAt = new Date().toISOString();
  manifest.status = 'trial';
  manifest.assets[island.id] = {
    taskId: task.id,
    taskType: task.type ?? 'image-to-3d',
    profile: args.profile ?? null,
    title: island.title,
    sourceImage: path.relative(repoRoot, sourceImage),
    model: `/assets/meshy/image-to-3d/${island.id}/model.glb`,
    thumbnail: task.thumbnail_url ? `/assets/meshy/image-to-3d/${island.id}/thumbnail.png` : null,
    alphaThumbnail: task.alpha_thumbnail_url ? `/assets/meshy/image-to-3d/${island.id}/thumbnail-alpha.png` : null,
    thumbnailViews,
    modelBytes: assetSize(modelFile),
    thumbnailBytes: assetSize(thumbnailFile),
    taskCredits: task.consumed_credits ?? null,
  };
  await writeJson(manifestPath, manifest);
  await appendLedger({
    command: 'download',
    island: island.id,
    taskId: task.id,
    model: manifest.assets[island.id].model,
    thumbnail: manifest.assets[island.id].thumbnail,
    alphaThumbnail: manifest.assets[island.id].alphaThumbnail,
    thumbnailViews: manifest.assets[island.id].thumbnailViews,
    modelBytes: manifest.assets[island.id].modelBytes,
    taskCredits: task.consumed_credits ?? null,
  });
  console.log(JSON.stringify({
    island: island.id,
    model: manifest.assets[island.id].model,
    thumbnail: manifest.assets[island.id].thumbnail,
    manifest: path.relative(repoRoot, manifestPath),
  }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] ?? 'plan';
  if (command === 'plan') return plan(args);
  if (command === 'submit') return submit(args);
  if (command === 'status') return status(args);
  if (command === 'download') return download(args);
  throw new Error(`Unknown command "${command}". Use plan, submit, status, or download.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
