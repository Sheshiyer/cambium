#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  readFile, readdir, realpath, stat,
} from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalDigest } from './lib/lead-contracts.mjs';

function fail(message) {
  throw new Error(`marketing source audit: ${message}`);
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

async function closureDigest(sourceRoot, directory) {
  const hash = createHash('sha256');
  for (const file of await walkFiles(directory)) {
    const sourceRelative = relative(sourceRoot, file).split(sep).join('/');
    hash.update(sourceRelative);
    hash.update('\0');
    hash.update(await readFile(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function parseVersionLedger(markdown) {
  const versions = new Map();
  for (const line of markdown.split('\n')) {
    const match = /^\|\s*([a-z0-9-]+)\s*\|\s*(\d+\.\d+\.\d+)\s*\|/.exec(line);
    if (match) versions.set(match[1], match[2]);
  }
  return versions;
}

export async function auditMarketingSource(catalog, sourceRoot) {
  if (!catalog?.source || !Array.isArray(catalog.capabilities)) fail('compiled catalog is incomplete');
  const root = await realpath(resolve(sourceRoot));
  const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  if (head !== catalog.source.commit) fail(`HEAD ${head} does not match pinned commit ${catalog.source.commit}`);
  if (!/^[a-f0-9]{40}$/.test(head)) fail('source commit is not immutable');

  const licensePath = join(root, catalog.source.license.path);
  if ((await stat(licensePath)).isFile() !== true) fail('license path is not a file');
  const licenseDigest = digest(await readFile(licensePath));
  if (licenseDigest !== catalog.source.license.sha256) fail('license digest mismatch');

  const skillsRoot = join(root, 'skills');
  const directories = [];
  for (const entry of await readdir(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      if ((await stat(join(skillsRoot, entry.name, 'SKILL.md'))).isFile()) directories.push(entry.name);
    } catch {
      // Directories without the canonical skill entrypoint are not catalog skills.
    }
  }
  directories.sort();
  if (directories.length !== catalog.source.skill_count) {
    fail(`skill count ${directories.length} does not match ${catalog.source.skill_count}`);
  }
  if (catalog.capabilities.length !== directories.length) fail('compiled capability count differs from source');

  const versions = parseVersionLedger(await readFile(join(root, 'VERSIONS.md'), 'utf8'));
  const byDirectory = new Map(catalog.capabilities.map((item) => [item.upstream_directory, item]));
  if (byDirectory.size !== catalog.capabilities.length) fail('duplicate upstream directory');

  const closureDigests = {};
  const capabilityPins = [];
  let semanticFixtureCount = 0;
  let semanticEvalCaseCount = 0;
  for (const directory of directories) {
    const item = byDirectory.get(directory);
    if (!item) fail(`missing capability for skills/${directory}`);
    if (directory.includes('..') || directory.includes('/') || directory.includes('\\')) {
      fail(`unsafe upstream directory ${directory}`);
    }
    const capabilityRoot = await realpath(join(skillsRoot, directory));
    if (!capabilityRoot.startsWith(`${await realpath(skillsRoot)}${sep}`)) {
      fail(`capability path escapes skills root: ${directory}`);
    }
    const sourceVersion = versions.get(directory);
    if (!sourceVersion) fail(`VERSIONS.md lacks ${directory}`);
    if (item.upstream_version !== sourceVersion) {
      fail(`version mismatch for ${directory}: ${item.upstream_version} != ${sourceVersion}`);
    }
    const actualDigest = await closureDigest(root, capabilityRoot);
    if (actualDigest !== item.source_closure_digest) fail(`closure digest mismatch for ${directory}`);
    closureDigests[directory] = actualDigest;
    if (item.curation_state === 'eligible') {
      const expectedFixtureId = `upstream-eval:${directory}@${sourceVersion}`;
      if (item.semantic_fixture_ids?.length !== 1
          || item.semantic_fixture_ids[0] !== expectedFixtureId) {
        fail(`semantic fixture reference mismatch for ${directory}`);
      }
      const evalPath = join(capabilityRoot, 'evals', 'evals.json');
      const evalSuite = JSON.parse(await readFile(evalPath, 'utf8'));
      if (evalSuite.skill_name !== directory
          || !Array.isArray(evalSuite.evals)
          || evalSuite.evals.length === 0) {
        fail(`semantic evaluation suite is empty or mismatched for ${directory}`);
      }
      semanticFixtureCount += 1;
      semanticEvalCaseCount += evalSuite.evals.length;
    }
    capabilityPins.push({
      id: item.id,
      upstream_directory: item.upstream_directory,
      upstream_version: item.upstream_version,
      source_closure_digest: item.source_closure_digest,
    });
  }
  const capabilitySetDigest = canonicalDigest(
    capabilityPins.sort((left, right) => left.id.localeCompare(right.id)),
  );
  if (capabilitySetDigest !== catalog.source.capability_set_digest) {
    fail('capability set digest does not match the compiled source pin');
  }

  const loopText = await readFile(
    join(skillsRoot, 'marketing-loops', 'references', 'loop-catalog.md'),
    'utf8',
  );
  const loopCount = [...loopText.matchAll(/^### The /gmu)].length;
  if (loopCount !== catalog.source.loop_definition_count) {
    fail(`loop count ${loopCount} does not match ${catalog.source.loop_definition_count}`);
  }

  return {
    valid: true,
    repository: catalog.source.repository,
    commit: head,
    license_sha256: licenseDigest,
    skill_count: directories.length,
    loop_definition_count: loopCount,
    capability_set_digest: capabilitySetDigest,
    semantic_fixture_count: semanticFixtureCount,
    semantic_eval_case_count: semanticEvalCaseCount,
    closure_digests: Object.fromEntries(
      Object.entries(closureDigests).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--source-root' || value === '--catalog') {
      options[value.slice(2)] = argv[index + 1];
      index += 1;
    } else {
      fail(`unknown argument ${value}`);
    }
  }
  return options;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const defaults = {
    catalog: join(here, '..', 'composition', 'marketing-capabilities.v1.json'),
  };
  const options = { ...defaults, ...parseArgs(process.argv.slice(2)) };
  if (!options['source-root']) fail('--source-root is required');
  const catalog = JSON.parse(await readFile(resolve(options.catalog), 'utf8'));
  const result = await auditMarketingSource(catalog, options['source-root']);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
