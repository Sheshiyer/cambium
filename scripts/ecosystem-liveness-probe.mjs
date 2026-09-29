#!/usr/bin/env node
// Read-only liveness probe for the ecosystem graph.
//
// This script NEVER modifies docs/architecture/contracts/ecosystem-graph.v1.json.
// It only reads that file to know which repo directories and ports to look at,
// then writes its own findings to a separate output file
// (default: docs/architecture/contracts/ecosystem-liveness.v1.json).
//
// Checks performed (both read-only / non-mutating):
//   1. `git log -1 --date=short --format=%cd` for each node's localDir, if the
//      directory exists under --ecosystem-root and contains a .git checkout.
//   2. A plain TCP connect probe (no data sent) against localhost on a fixed
//      allow-list of ports: 8766, 31337, 20128. No other ports are ever probed.
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { connect } from 'node:net';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_GRAPH = join(REPO_ROOT, 'docs/architecture/contracts/ecosystem-graph.v1.json');
const DEFAULT_OUTPUT = join(REPO_ROOT, 'docs/architecture/contracts/ecosystem-liveness.v1.json');
const ALLOWED_PORTS = [8766, 31337, 20128];
const PORT_CHECK_TIMEOUT_MS = 500;

function parseArgs(argv) {
  const options = {
    graph: DEFAULT_GRAPH,
    output: DEFAULT_OUTPUT,
    ecosystemRoot: null,
    json: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--graph') {
      options.graph = resolve(requireValue(argv, ++index, arg));
    } else if (arg === '--output') {
      options.output = resolve(requireValue(argv, ++index, arg));
    } else if (arg === '--ecosystem-root') {
      options.ecosystemRoot = resolve(requireValue(argv, ++index, arg));
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function usage() {
  return [
    'Usage: node scripts/ecosystem-liveness-probe.mjs [--graph path] [--output path] [--ecosystem-root path] [--json]',
    '',
    'Read-only liveness probe. Reads node localDir/host/port fields from ecosystem-graph.v1.json,',
    'runs `git log -1` for each localDir found under --ecosystem-root (default: parent of --graph\'s',
    'repo, i.e. this is expected to be pointed at the folder that contains the sibling repo checkouts),',
    'and TCP-probes localhost on the fixed allow-list of ports 8766/31337/20128 only.',
    'Writes results to --output (default: docs/architecture/contracts/ecosystem-liveness.v1.json).',
    'Never writes to ecosystem-graph.v1.json.'
  ].join('\n');
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function probeGitLastCommit(dirPath) {
  if (!existsSync(dirPath)) {
    return { checked: false, reason: 'directory-not-found' };
  }
  let isDir = false;
  try {
    isDir = statSync(dirPath).isDirectory();
  } catch {
    return { checked: false, reason: 'stat-failed' };
  }
  if (!isDir) {
    return { checked: false, reason: 'not-a-directory' };
  }
  if (!existsSync(join(dirPath, '.git'))) {
    return { checked: false, reason: 'no-git-checkout' };
  }
  const result = spawnSync('git', ['log', '-1', '--date=short', '--format=%cd'], {
    cwd: dirPath,
    encoding: 'utf8',
    timeout: 5000
  });
  if (result.status !== 0) {
    return { checked: true, reason: 'git-log-failed', stderr: (result.stderr || '').trim() };
  }
  const lastCommitDate = result.stdout.trim();
  if (!lastCommitDate) {
    return { checked: true, reason: 'no-commits' };
  }
  return { checked: true, lastCommitDate };
}

function probeTcpPort(host, port, timeoutMs) {
  return new Promise((resolvePromise) => {
    const socket = connect({ host, port, timeout: timeoutMs });
    const finish = (open, reason) => {
      socket.destroy();
      resolvePromise({ open, reason });
    };
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, 'timeout'));
    socket.once('error', (error) => finish(false, error.code || 'error'));
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const graph = readJson(options.graph);
  if (graph.schema !== 'thoughtseed.ecosystem-graph.v1') {
    throw new Error(`unexpected graph schema: ${graph.schema}`);
  }

  const ecosystemRoot = options.ecosystemRoot ?? resolve(dirname(options.graph), '../../../..');
  const generatedAt = new Date().toISOString();

  const repoLiveness = [];
  for (const node of graph.nodes ?? []) {
    if (!node.localDir) {
      continue;
    }
    const dirPath = join(ecosystemRoot, node.localDir);
    const probe = probeGitLastCommit(dirPath);
    repoLiveness.push({
      nodeId: node.id,
      localDir: node.localDir,
      probedPath: dirPath,
      ...probe
    });
  }

  const portLiveness = [];
  for (const port of ALLOWED_PORTS) {
    const result = await probeTcpPort('127.0.0.1', port, PORT_CHECK_TIMEOUT_MS);
    const matchingNode = (graph.nodes ?? []).find((node) => node.port === port);
    portLiveness.push({
      port,
      host: '127.0.0.1',
      nodeId: matchingNode?.id ?? null,
      open: result.open,
      reason: result.reason ?? null
    });
  }

  const liveness = {
    schema: 'thoughtseed.ecosystem-liveness.v1',
    authority: 'proposal-only',
    note: 'Read-only probe output. Never merge this file into ecosystem-graph.v1.json; graph nodes/edges stay static and doc-derived.',
    generatedAt,
    graphSource: options.graph,
    ecosystemRoot,
    allowedPorts: ALLOWED_PORTS,
    repos: repoLiveness,
    ports: portLiveness
  };

  writeFileSync(options.output, JSON.stringify(liveness, null, 2) + '\n');

  if (options.json) {
    console.log(JSON.stringify(liveness, null, 2));
  } else {
    console.log(`Wrote liveness snapshot to ${options.output}`);
    console.log(`  repos checked: ${repoLiveness.length} (git-checked: ${repoLiveness.filter((r) => r.checked && r.lastCommitDate).length})`);
    console.log(`  ports checked: ${portLiveness.map((p) => `${p.port}=${p.open ? 'open' : 'closed'}`).join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
