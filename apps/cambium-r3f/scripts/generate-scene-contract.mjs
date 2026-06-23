import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const outFile = resolve(here, '../src/generated/source-contract.ts');

const readJson = async (relativePath) => JSON.parse(await readFile(resolve(repoRoot, relativePath), 'utf8'));

async function readJsonWithGeneratedFallback(relativePath, generatedKey) {
  try {
    return await readJson(relativePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    const generated = await import(pathToFileURL(outFile).href);
    return generated.sourceContract[generatedKey];
  }
}

const [pipeline, acceptanceChecks, interactionPlan, referenceFreeze, visualContract, questsModule, questsHypha] = await Promise.all([
  readJson('composition/pipeline.json'),
  readJsonWithGeneratedFallback('cortex/cambium/contracts/acceptance_checks.json', 'acceptanceChecks'),
  readJsonWithGeneratedFallback('cortex/cambium/contracts/interaction_plan.json', 'interactionPlan'),
  readJson('docs/plans/assets/cambium-r3f-implementation/reference-freeze.json'),
  import(pathToFileURL(resolve(repoRoot, 'shared/cambium-visual-contract.ts')).href),
  import(pathToFileURL(resolve(repoRoot, 'bin/operator/quests/quests.ts')).href),
  import(pathToFileURL(resolve(repoRoot, 'bin/quine/hyphae/quests.ts')).href),
]);

const questLine = questsModule.QUEST_LINE.map((quest) => ({
  id: quest.id,
  arc: quest.arc,
  title: quest.title,
  narration: quest.narration,
  reveals: quest.reveals,
}));

function buildVisualStageMetadata(visualStages) {
  const metadataSources = [
    ...pipeline.stages.map((stage) => ({
      id: stage.id,
      source: 'pipeline.stage',
      organ: stage.organ,
      r3fTitle: stage.title,
    })),
    ...pipeline.crosscutting.map((stage) => ({
      id: stage.id,
      source: 'pipeline.crosscutting',
      organ: stage.organ,
      r3fTitle: stage.title,
    })),
  ];
  const sourceById = new Map();
  const duplicateSources = new Set();
  for (const source of metadataSources) {
    if (sourceById.has(source.id)) duplicateSources.add(source.id);
    sourceById.set(source.id, source);
  }

  const visualIds = new Set(visualStages.map((stage) => stage.id));
  const extraSources = metadataSources.filter((source) => !visualIds.has(source.id)).map((source) => source.id);
  const questArcs = new Set(questLine.map((quest) => String(quest.arc)));
  const arcOwners = new Map();
  const duplicateArcs = [];
  const unknownArcs = [];
  const missingSources = [];

  for (const stage of visualStages) {
    if (!sourceById.has(stage.id)) missingSources.push(stage.id);
    for (const arc of stage.arcs.map(String)) {
      if (!questArcs.has(arc)) unknownArcs.push(`${stage.id}:${arc}`);
      if (arcOwners.has(arc)) duplicateArcs.push(`${arc}:${arcOwners.get(arc)}+${stage.id}`);
      arcOwners.set(arc, stage.id);
    }
  }

  const missingArcs = [...questArcs].filter((arc) => !arcOwners.has(arc));
  const issues = [
    duplicateSources.size ? `duplicate R3F metadata sources: ${[...duplicateSources].join(', ')}` : '',
    missingSources.length ? `shared visual stages missing R3F metadata: ${missingSources.join(', ')}` : '',
    extraSources.length ? `R3F metadata sources missing shared visual stage: ${extraSources.join(', ')}` : '',
    duplicateArcs.length ? `quest arcs claimed by multiple visual stages: ${duplicateArcs.join(', ')}` : '',
    unknownArcs.length ? `visual stages reference unknown quest arcs: ${unknownArcs.join(', ')}` : '',
    missingArcs.length ? `quest arcs missing visual stage ownership: ${missingArcs.join(', ')}` : '',
  ].filter(Boolean);

  if (issues.length) {
    throw new Error(`Cambium visual stage metadata drift:\n- ${issues.join('\n- ')}`);
  }

  return visualStages.map((stage) => {
    const source = sourceById.get(stage.id);
    return {
      id: stage.id,
      visualTitle: stage.title,
      visualDetail: stage.detail,
      arcs: stage.arcs,
      source: source.source,
      organ: source.organ,
      r3fTitle: source.r3fTitle,
    };
  });
}

async function readPreviousQuestSummary() {
  try {
    const generated = await import(`${pathToFileURL(outFile).href}?t=${Date.now()}`);
    return generated.sourceContract.questSummary;
  } catch {
    return undefined;
  }
}

function summaryFromLedger(ledger) {
  const current = ledger.current;
  return {
    activeArc: current?.arc ?? 'complete',
    activeQuestId: current?.id ?? 'complete',
    completed: ledger.completed,
    total: ledger.total,
    label: current
      ? `ARC ${current.arc} · ${current.title} · ${ledger.completed}/${ledger.total}`
      : `ALL QUESTS · ${ledger.completed}/${ledger.total}`,
    questLine,
  };
}

const previousQuestSummary = await readPreviousQuestSummary();
let questSummary = previousQuestSummary
  ? { ...previousQuestSummary, total: questLine.length, questLine }
  : {
      activeArc: 'I',
      activeQuestId: questLine[0]?.id ?? 'unknown',
      completed: 0,
      total: questLine.length,
      label: `ARC I · ${questLine[0]?.title ?? 'The Calling'} · 0/${questLine.length}`,
      questLine,
    };

if (existsSync(resolve(repoRoot, '.operator'))) {
  const ctx = { root: repoRoot, vaultRoot: resolve(repoRoot, '../thoughtseed-labs') };
  const tenant = process.env.CAMBIUM_SCENE_TENANT || process.env.TENANT || 'cambium';
  questSummary = summaryFromLedger(questsModule.questLedger(questsHypha.gatherQuestInputs(ctx, tenant)));
}

const sourceContract = {
  pipeline,
  acceptanceChecks,
  interactionPlan,
  referenceFreeze,
  visual: {
    stages: visualContract.CAMBIUM_VISUAL_STAGES,
    rails: visualContract.CAMBIUM_VISUAL_RAILS,
    stageMetadata: buildVisualStageMetadata(visualContract.CAMBIUM_VISUAL_STAGES),
    wakeSteps: visualContract.CAMBIUM_WAKE_STEPS,
    senses: visualContract.CAMBIUM_SENSES,
    lanes: visualContract.CAMBIUM_LANES,
  },
  questSummary,
};

await mkdir(dirname(outFile), { recursive: true });
await writeFile(
  outFile,
  `// Generated by scripts/generate-scene-contract.mjs. Do not edit by hand.\n` +
    `export const sourceContract = ${JSON.stringify(sourceContract, null, 2)} as const;\n`,
);

console.log(`synced Cambium R3F source contract -> ${outFile.replace(`${repoRoot}/`, '')}`);
