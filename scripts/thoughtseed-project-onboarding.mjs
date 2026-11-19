#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { readEvidence } from './project-onboarding/sources.mjs'
import { buildPacket, renderMap, renderQuestions, renderRails, renderRoadmap } from './project-onboarding/packet.mjs'
import { renderSapling } from './project-onboarding/sapling.mjs'

const cambiumRoot = fileURLToPath(new URL('..', import.meta.url))
const help = `Usage: npm run project:onboard -- [TARGET | --root CHECKOUT] [options]

TARGET is a WorkObject ID, client/project name, or GitHub OWNER/REPO or URL.
  --workspace DIR      Parent of named Thoughtseed client/project checkouts
  --vault DIR          Thoughtseed Labs checkout (or THOUGHTSEED_VAULT_ROOT)
  --root DIR           Explicit checkout, used before similarly named clones
  --repo OWNER/REPO    Include another repository candidate (repeatable)
  --branch REPO=REF    Verify the named GitHub branch and root tree (repeatable)
  --primary OWNER/REPO Propose one current reviewed planning repository
  --github             Read live GitHub metadata and exact board evidence
  --board OWNER/NUMBER Verify an exact existing project; titles are hints
  --source FILE        Pin an additional local document hash (repeatable)
  --review FILE        Apply a source-linked contract, goals and discovery review
  --progress FILE      Resume onboarding answers and evaluate child receipts
  --track sapling      Add market discovery, product goal, flow and Spec Kit drafts
  --out LABEL          Write private reports under .local/project-onboarding/LABEL
  --help              Show this help

Outputs are proposals. The command does not write to GitHub, register hooks,
change routing, create chats, dispatch tasks or schedule jobs.
`

async function readInput(path) {
  if (!path) return null
  try {
    const file = await lstat(path)
    if (!file.isFile() || file.size > 1_000_000) throw new Error()
    return JSON.parse(await readFile(path, 'utf8'))
  } catch { throw new Error(`Cannot read JSON input: ${basename(path)}`) }
}

async function writePacket(label, packet) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label ?? '') || label.length > 72) throw new Error('--out must be a simple lowercase label.')
  let dir = cambiumRoot
  for (const part of ['.local', 'project-onboarding', label]) {
    dir = join(dir, part)
    await mkdir(dir, { mode: 0o700 }).catch((error) => { if (error.code !== 'EEXIST') throw error })
    if (!(await lstat(dir)).isDirectory()) throw new Error('Report path must use real directories under .local.')
  }
  const priorPath = join(dir, 'packet.json')
  const priorExists = await lstat(priorPath).then(() => true, (error) => { if (error.code === 'ENOENT') return false; throw error })
  const priorTrack = priorExists ? (await readInput(priorPath)).track : null
  if (priorTrack && priorTrack !== packet.track) throw new Error('Choose a separate output label for each track.')
  const artifacts = {
    'ecosystem-map.md': renderMap(packet), 'discovery.md': renderQuestions(packet),
    'roadmap.md': renderRoadmap(packet), 'pillars.md': renderRails(packet),
    ...(packet.track === 'sapling' ? renderSapling(packet) : {}),
    'packet.json': JSON.stringify(packet, null, 2) + '\n',
  }
  for (const [name, content] of Object.entries(artifacts)) {
    const temp = join(dir, `.${randomUUID()}.tmp`)
    try {
      await writeFile(temp, content, { mode: 0o600, flag: 'wx' })
      await rename(temp, join(dir, name))
    } finally { await rm(temp, { force: true }) }
  }
  return `.local/project-onboarding/${label}`
}

async function main() {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: {
    workspace: { type: 'string' }, vault: { type: 'string' }, root: { type: 'string' }, repo: { type: 'string', multiple: true, default: [] },
    primary: { type: 'string' }, github: { type: 'boolean' }, board: { type: 'string' }, source: { type: 'string', multiple: true, default: [] }, branch: { type: 'string', multiple: true, default: [] },
    review: { type: 'string' }, progress: { type: 'string' }, track: { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } })
  if (values.help) return console.log(help.trimEnd())
  if (positionals.length > 1 || (!positionals.length && !values.root)) throw new Error('Provide one quoted target or --root CHECKOUT.')
  if (values.repo.length > 20 || values.source.length > 25 || values.branch.length > 20) throw new Error('Scope additional repositories, refs and sources to the selected project.')
  if (values.branch.length && !values.github) throw new Error('--branch requires --github.')
  if (values.track && values.track !== 'sapling') throw new Error('--track accepts sapling; omit it for the normal WorkObject path.')
  const [evidence, review, progress] = await Promise.all([
    readEvidence({ ...values, target: positionals[0], repositories: values.repo, branches: values.branch, sources: values.source }, cambiumRoot),
    readInput(values.review), readInput(values.progress),
  ])
  const packet = buildPacket(evidence, review, progress, values.track)
  if (!values.out) return console.log(JSON.stringify(packet, null, 2))
  const report = await writePacket(values.out, packet)
  console.log(JSON.stringify({ report, workId: evidence.identity.workId, inputDigest: packet.inputDigest, track: packet.track, roadmap: packet.roadmap,
    contract: packet.contract.state, questions: packet.questions.length, tailoredQuestions: packet.questions.filter((q) => q.sources.length).length,
    goals: packet.goals.length, saplingFlows: packet.sapling?.flows.length ?? 0, nextQuestions: packet.nextQuestions, notices: packet.notices }, null, 2))
}

main().catch((error) => { console.error(`Project onboarding: ${error.message}`); process.exitCode = 1 })
