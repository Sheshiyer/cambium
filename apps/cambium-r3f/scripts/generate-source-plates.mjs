#!/usr/bin/env node
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const repoRoot = path.resolve(root, '../..');
const manifestPath = path.join(
  repoRoot,
  'docs/plans/assets/cambium-r3f-game-engine-realignment/image-source-pass/source-plate-prompts.json',
);
const codexImageCli =
  process.env.CODEX_IMAGE_CLI ||
  path.join(homedir(), '.agents/skills/codex-gpt-image/scripts/codex_gpt_image.py');

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

function resolveFromManifestDir(file, value) {
  return path.resolve(path.dirname(file), value);
}

function resolveFromRepo(value) {
  return path.resolve(repoRoot, value);
}

function selectedPlates(plates, args) {
  if (!args.only) return plates;
  const wanted = new Set(String(args.only).split(',').map((item) => item.trim()).filter(Boolean));
  const selected = plates.filter((plate) => wanted.has(plate.id));
  const missing = [...wanted].filter((id) => !plates.some((plate) => plate.id === id));
  if (missing.length) throw new Error(`Unknown plate id(s): ${missing.join(', ')}`);
  return selected;
}

function composePrompt(manifest, plate) {
  return `${plate.prompt} Shared reconstruction rules: ${manifest.globalRules.join(' ')}`;
}

function generationArgs({ manifest, plate, outputPath, styleReference }) {
  const args = [
    codexImageCli,
    'generate',
    '--model',
    manifest.model,
    '--size',
    manifest.size,
    '--prompt',
    composePrompt(manifest, plate),
    '--out',
    outputPath,
  ];
  if (styleReference && existsSync(styleReference)) {
    args.splice(2, 0, '--image', styleReference);
  }
  return args;
}

async function plan(args) {
  const manifest = await readJson(manifestPath);
  const outputDirectory = resolveFromRepo(manifest.outputDirectory);
  const styleReference = resolveFromManifestDir(manifestPath, manifest.styleReference);
  const plates = selectedPlates(manifest.plates, args);
  console.log('Cambium source-plate generation plan');
  console.log(`Manifest: ${path.relative(repoRoot, manifestPath)}`);
  console.log(`Output directory: ${path.relative(repoRoot, outputDirectory)}`);
  console.log(`Style reference: ${path.relative(repoRoot, styleReference)} (${existsSync(styleReference) ? 'present' : 'missing'})`);
  console.log(`Model: ${manifest.model}`);
  console.log(`Size: ${manifest.size}`);
  console.log(`Plate count: ${plates.length}`);
  for (const plate of plates) {
    const outputPath = path.join(outputDirectory, plate.output);
    console.log(`- ${plate.id} [${plate.kind}]: ${path.relative(repoRoot, outputPath)}${existsSync(outputPath) ? ' (exists)' : ''}`);
  }
}

async function generate(args) {
  const manifest = await readJson(manifestPath);
  const outputDirectory = resolveFromRepo(manifest.outputDirectory);
  const styleReference = resolveFromManifestDir(manifestPath, manifest.styleReference);
  const plates = selectedPlates(manifest.plates, args);
  await mkdir(outputDirectory, { recursive: true });
  if (!args.execute) {
    await plan(args);
    throw new Error('Generation is dry-run by default. Re-run with --execute to create source plates.');
  }
  for (const plate of plates) {
    const outputPath = path.join(outputDirectory, plate.output);
    if (existsSync(outputPath) && !args.force) {
      console.log(`skip ${plate.id}: ${path.relative(repoRoot, outputPath)} exists`);
      continue;
    }
    const cliArgs = generationArgs({ manifest, plate, outputPath, styleReference });
    console.log(`generate ${plate.id}: ${path.relative(repoRoot, outputPath)}`);
    const result = spawnSync('python3', cliArgs, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });
    if (result.status !== 0) {
      throw new Error(`Source plate generation failed for ${plate.id}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] ?? 'plan';
  if (command === 'plan') return plan(args);
  if (command === 'generate') return generate(args);
  throw new Error(`Unknown command "${command}". Use plan or generate.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
