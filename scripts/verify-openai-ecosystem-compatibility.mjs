#!/usr/bin/env node

// Verifier for the Cambium ↔ OpenAI ecosystem compatibility packet.
//
// Modes:
//   --check-source     Validate the source-only compatibility packet: portable
//                      Agent Plugins 1.0 plugin.json shape, forbidden legacy
//                      fields, fixed skills/<name>/SKILL.md discovery path,
//                      compatibility manifest shape, privacy, repository-
//                      relative paths, existing sources, idempotent digest
//                      recomputation, official OpenAI docs URLs,
//                      and ISC bindings. Passes on the reviewed source alone.
//   --check            Full compatibility check. Runs --check-source first,
//                      then requires every live-gate evidence receipt named
//                      in the manifest to exist as a real file. Fails closed
//                      (nonzero) until all live gates are separately
//                      evidenced by an owner-approved process.
//   --print-digest     Also print the canonical packet digest for
//                      idempotency probing.
//   --manifest <path>  Override the manifest path (used by tests to feed
//                      adversarial inputs). Defaults to the repository
//                      packet's manifest.
//   --evidence-root <dir>
//                      Override the directory the verifier scans for
//                      live-gate evidence receipts. Bounded, test-only
//                      surface: must resolve to an existing directory
//                      outside the source packet's live-gates/ folder.
//                      When absent, the verifier scans the packet's own
//                      openai/<packet>/live-gates/ directory, which
//                      remains empty in the reviewed source. This flag
//                      never mutates the package.
//
// The verifier writes nothing outside the repository, opens no network
// connection, reads no credentials, and never claims that a live gate has
// been satisfied.

import { readFileSync, existsSync, statSync, lstatSync, realpathSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, isAbsolute, sep, relative, join, basename } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const defaultPacketRoot = 'openai/cambium-infinite-game'
const defaultManifestPath = resolve(repoRoot, defaultPacketRoot, 'compatibility.manifest.json')
const portableSkillPath = 'skills/cambium-infinite-game/SKILL.md'
const portablePluginSchemaUrl =
  'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
const portableMcpSchemaUrl =
  'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json'
const marketplaceRelPath = '.agents/plugins/marketplace.json'
const marketplaceName = 'thoughtseed-cambium'
const pluginName = 'cambium-infinite-game'
const marketplaceLocalSourcePath = './openai/cambium-infinite-game'
const payloadDigestAlgorithm = 'sha256-sorted-path-digest-v1'
const expectedMcpEndpointUrl = 'https://cortex.thoughtseed.space/mcp'
const payloadDigestCovers = [
  'openai/cambium-infinite-game/plugin.json',
  'openai/cambium-infinite-game/mcp.json',
  'openai/cambium-infinite-game/import/v1/instructions/cambium-infinite-game.md',
  'openai/cambium-infinite-game/skills/cambium-infinite-game/SKILL.md',
  'openai/cambium-infinite-game/skills/cambium-infinite-game/scripts/dot-runtime.mjs',
  'openai/cambium-infinite-game/skills/cambium-infinite-game/references/dot-operating-contract.md',
  'openai/cambium-infinite-game/skills/cambium-infinite-game/references/mcp-read-contract.md',
  'openai/cambium-infinite-game/skills/cambium-infinite-game/references/mcp-action-contract.md',
  'openai/cambium-infinite-game/skills/cambium-infinite-game/references/connected-profile-contract.md',
  'openai/cambium-infinite-game/deployment-admission.policy.json',
  'openai/cambium-infinite-game/live-gates/README.md',
  '.agents/plugins/marketplace.json',
]
const runtimeSourcePaths = [
  'scripts/probe-openai-mcp-readiness.mjs',
  'scripts/check-openai-mcp-deployment-admission.mjs',
  'workers/cortex-mcp/src/index.ts',
  'workers/cortex-mcp/src/mcp-http.ts',
  'workers/cortex-mcp/src/openai-auth.ts',
  'workers/cortex-mcp/src/connected-profile.ts',
  'workers/cortex-mcp/src/provenance-read.ts',
  'workers/cortex-mcp/src/gate-action.ts',
  'workers/cortex-mcp/package.json',
  'workers/cortex-mcp/package-lock.json',
  'workers/quests/src/index.ts',
  'workers/quests/src/handler.ts',
  'workers/quests/src/mcp-gate-action.ts',
]
const INFRASTRUCTURE_RECEIPT_FILENAMES = [
  'dot-entitlement.receipt.json',
  'workspace-admin-enablement.receipt.json',
  'plugin-connection.receipt.json',
  'service-credentials.receipt.json',
  'deployed-version.receipt.json',
  'mcp-endpoint.receipt.json',
  'readback.receipt.json',
  'rollback.receipt.json',
  'marketplace-import.receipt.json',
]
const REQUIRED_RECEIPT_FILENAMES = [
  ...INFRASTRUCTURE_RECEIPT_FILENAMES,
  'end-to-end-canary.receipt.json',
]
// The marketplace entry object must not carry any of these fields; they would
// break the closed, admin-controlled, local-only distribution channel.
const FORBIDDEN_MARKETPLACE_ENTRY_FIELDS = new Set([
  'pluginId',
  'url',
  'ref',
  'branch',
])
// Same for the nested source object.
const FORBIDDEN_MARKETPLACE_SOURCE_FIELDS = new Set([
  'pluginId',
  'url',
  'ref',
  'branch',
])

// Fields that must never appear at the root of the portable plugin.json.
// Everything on this list is either legacy (ChatGPT plugin manifest v0), a
// custom Cambium extension that belongs in compatibility.manifest.json, or a
// component reference that would defeat portable discovery.
const FORBIDDEN_PLUGIN_ROOT_FIELDS = new Set([
  'schema_version',
  'name_for_model',
  'name_for_human',
  'description_for_model',
  'description_for_human',
  'audience',
  'auth',
  'mcp',
  'tools',
  'isc_bindings',
  'notes',
  'skills',
  'mcpServers',
  'apps',
  'hooks',
  'interface',
])

const REQUIRED_INTERFACE_FIELDS = [
  'displayName',
  'shortDescription',
  'longDescription',
  'developerName',
  'category',
  'capabilities',
  'defaultPrompt',
]

const ALLOWED_DOCS_HOSTS = new Set(['learn.chatgpt.com', 'developers.openai.com'])

const REQUIRED_DOCS_PATHS = new Set([
  '/docs/dots',
  '/docs/dots/channels',
  '/docs/dots/tasks-and-memory',
  '/docs/dots/computers-and-apps',
  '/docs/dots/controls',
  '/docs/skills-and-plugins',
  '/docs/import',
  '/docs/extend/mcp',
  '/docs/plugins',
  '/docs/build-plugins',
  '/docs/enterprise/plugin-management',
])
const REQUIRED_DEVELOPER_DOCS_PATHS = new Set([
  '/plugins/build/auth',
])

function fail(message) {
  process.stderr.write(`verify-openai-ecosystem-compatibility: ${message}\n`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = {
    mode: null,
    printDigest: false,
    manifest: defaultManifestPath,
    evidenceRoot: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--check-source') args.mode = 'check-source'
    else if (a === '--check') args.mode = 'check'
    else if (a === '--print-digest') args.printDigest = true
    else if (a === '--manifest') {
      const next = argv[++i]
      if (!next) fail('--manifest requires a path argument')
      args.manifest = resolve(next)
    } else if (a === '--evidence-root') {
      const next = argv[++i]
      if (!next) fail('--evidence-root requires a directory argument')
      args.evidenceRoot = resolve(next)
    } else if (a === '--help' || a === '-h') {
      process.stdout.write(usage())
      process.exit(0)
    } else {
      fail(`unknown argument: ${a}`)
    }
  }
  if (!args.mode) fail('one of --check-source or --check is required')
  return args
}

function usage() {
  return `Usage: verify-openai-ecosystem-compatibility.mjs [--check-source | --check] [--print-digest] [--manifest <path>] [--evidence-root <dir>]\n`
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    fail(`cannot read JSON at ${path}: ${err.message}`)
  }
}

function sha256File(path) {
  return 'sha256:' + createHash('sha256').update(readFileSync(path)).digest('hex')
}

function isRepoRelative(p) {
  if (typeof p !== 'string' || p.length === 0) return false
  if (isAbsolute(p)) return false
  const parts = p.split(/[\\/]+/)
  if (parts.includes('..')) return false
  return true
}

export function isPathPhysicallyContained(root, candidate) {
  try {
    const rootAbs = resolve(root)
    const candidateAbs = resolve(candidate)
    const lexical = relative(rootAbs, candidateAbs)
    if (lexical.startsWith(`..${sep}`) || lexical === '..' || isAbsolute(lexical)) return false
    let cursor = rootAbs
    if (lstatSync(cursor).isSymbolicLink()) return false
    if (lexical !== '') {
      for (const part of lexical.split(sep)) {
        cursor = join(cursor, part)
        if (lstatSync(cursor).isSymbolicLink()) return false
      }
    }
    const rootReal = realpathSync(rootAbs)
    const candidateReal = realpathSync(candidateAbs)
    const physical = relative(rootReal, candidateReal)
    return physical === '' || (!physical.startsWith(`..${sep}`) && physical !== '..' && !isAbsolute(physical))
  } catch {
    return false
  }
}

function walkFiles(root) {
  const files = []
  const stack = [root]
  while (stack.length) {
    const cur = stack.pop()
    for (const entry of readdirSync(cur)) {
      const full = join(cur, entry)
      const st = lstatSync(full)
      if (st.isSymbolicLink()) fail(`symbolic links are forbidden in the compatibility packet: ${relative(repoRoot, full)}`)
      if (st.isDirectory()) stack.push(full)
      else if (st.isFile()) files.push(full)
    }
  }
  return files
}

function isStrictSemver(v) {
  return typeof v === 'string' &&
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(v)
}

function validateSourceManifest(manifestPath) {
  const manifest = readJson(manifestPath)
  if (manifest.schema !== 'cambium.openai-compatibility.v1') {
    fail(`manifest schema must be cambium.openai-compatibility.v1 (got ${manifest.schema})`)
  }
  if (manifest.import_version !== 'v1') {
    fail(`manifest import_version must be v1 (got ${manifest.import_version})`)
  }
  if (manifest.packet_root !== defaultPacketRoot) {
    fail(`manifest packet_root must be ${defaultPacketRoot} (got ${manifest.packet_root})`)
  }
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    fail('manifest.sources must be a non-empty array')
  }
  const sourcePaths = new Set()
  for (const src of manifest.sources) {
    if (!isRepoRelative(src.path)) {
      fail(`invalid path in manifest: ${src.path} (must be repository-relative, no absolute, no ..)`)
    }
    if (
      !src.path.startsWith(defaultPacketRoot + '/') &&
      src.path !== marketplaceRelPath
    ) {
      fail(`invalid path in manifest: ${src.path} (must be inside packet root ${defaultPacketRoot}; escape not allowed)`)
    }
    if (sourcePaths.has(src.path)) {
      fail(`manifest.sources must not contain duplicate path: ${src.path}`)
    }
    sourcePaths.add(src.path)
    if (typeof src.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(src.digest)) {
      fail(`invalid digest for ${src.path}: ${src.digest}`)
    }
    const abs = resolve(repoRoot, src.path)
    if (!isPathPhysicallyContained(repoRoot, abs)) {
      fail(`manifest source must be physically contained in the repository with no symlink components: ${src.path}`)
    }
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      fail(`manifest source missing on disk: ${src.path}`)
    }
    const actual = sha256File(abs)
    if (actual !== src.digest) {
      fail(`manifest digest mismatch for ${src.path}: expected ${src.digest}, got ${actual}`)
    }
  }
  if (!Array.isArray(manifest.runtime_sources) || manifest.runtime_sources.length !== runtimeSourcePaths.length) {
    fail(`manifest.runtime_sources must list exactly ${runtimeSourcePaths.length} reviewed Cortex and Quests Gate runtime files`)
  }
  const runtimePaths = new Set()
  for (const src of manifest.runtime_sources) {
    if (!runtimeSourcePaths.includes(src.path)) {
      fail(`invalid runtime source path: ${src.path}`)
    }
    if (runtimePaths.has(src.path)) {
      fail(`manifest.runtime_sources must not contain duplicate path: ${src.path}`)
    }
    runtimePaths.add(src.path)
    if (typeof src.role !== 'string' || src.role.length === 0) {
      fail(`runtime source role missing for ${src.path}`)
    }
    if (typeof src.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(src.digest)) {
      fail(`invalid runtime source digest for ${src.path}: ${src.digest}`)
    }
    const abs = resolve(repoRoot, src.path)
    if (!isPathPhysicallyContained(repoRoot, abs) || !existsSync(abs) || !statSync(abs).isFile()) {
      fail(`runtime source missing or not physically contained: ${src.path}`)
    }
    const actual = sha256File(abs)
    if (actual !== src.digest) {
      fail(`runtime source digest mismatch for ${src.path}: expected ${src.digest}, got ${actual}`)
    }
  }
  for (const expected of runtimeSourcePaths) {
    if (!runtimePaths.has(expected)) fail(`manifest.runtime_sources must include ${expected}`)
  }
  if (!Array.isArray(manifest.official_openai_docs) || manifest.official_openai_docs.length < 2) {
    fail('manifest.official_openai_docs must list at least two references')
  }
  const seenDocsPaths = new Set()
  for (const ref of manifest.official_openai_docs) {
    if (typeof ref.url !== 'string') fail('docs URL missing')
    let url
    try { url = new URL(ref.url) } catch { fail(`docs URL invalid: ${ref.url}`) }
    if (url.protocol !== 'https:') fail(`docs URL must be https: ${ref.url}`)
    if (!ALLOWED_DOCS_HOSTS.has(url.hostname)) {
      fail(`docs URL host must be an official OpenAI docs host: ${ref.url}`)
    }
    if (typeof ref.covers !== 'string' || ref.covers.length === 0) {
      fail(`docs URL missing 'covers': ${ref.url}`)
    }
    seenDocsPaths.add(`${url.hostname}${url.pathname.replace(/\/$/, '')}`)
  }
  for (const req of REQUIRED_DOCS_PATHS) {
    if (!seenDocsPaths.has(`learn.chatgpt.com${req}`)) {
      fail(`manifest.official_openai_docs must reference https://learn.chatgpt.com${req}`)
    }
  }
  for (const req of REQUIRED_DEVELOPER_DOCS_PATHS) {
    if (!seenDocsPaths.has(`developers.openai.com${req}`)) {
      fail(`manifest.official_openai_docs must reference https://developers.openai.com${req}`)
    }
  }
  if (!Array.isArray(manifest.isc_bindings) || manifest.isc_bindings.length === 0) {
    fail('manifest.isc_bindings must be a non-empty array')
  }
  const iscPattern = /^ISC-(24(7[4-9]|[89]\d)|250[0-5])$/
  for (const isc of manifest.isc_bindings) {
    if (!iscPattern.test(isc)) fail(`isc_binding out of range (ISC-2474..2505): ${isc}`)
  }
  if (!Array.isArray(manifest.live_gate_receipts_required)) {
    fail('manifest.live_gate_receipts_required must be an array')
  }
  const requiredReceiptPaths = REQUIRED_RECEIPT_FILENAMES.map(
    (filename) => `${defaultPacketRoot}/live-gates/${filename}`,
  )
  if (manifest.live_gate_receipts_required.length !== requiredReceiptPaths.length) {
    fail(`manifest.live_gate_receipts_required must list exactly ${requiredReceiptPaths.length} canonical receipts`)
  }
  const receiptPathSet = new Set(manifest.live_gate_receipts_required)
  if (receiptPathSet.size !== manifest.live_gate_receipts_required.length) {
    fail('manifest.live_gate_receipts_required must not contain duplicate paths')
  }
  for (const rp of manifest.live_gate_receipts_required) {
    if (!isRepoRelative(rp) || !rp.startsWith(defaultPacketRoot + '/live-gates/')) {
      fail(`invalid live-gate receipt path: ${rp}`)
    }
  }
  for (const expected of requiredReceiptPaths) {
    if (!receiptPathSet.has(expected)) {
      fail(`manifest.live_gate_receipts_required must include ${expected}`)
    }
  }
  validateDistributionAndMarketplace(manifest)
  validateConnectedProfileCapability(manifest)
  validatePayloadDigest(manifest)
  validatePluginVersionConsistency(manifest)
  validateDeploymentAdmissionPolicy()
  return manifest
}

function validateConnectedProfileCapability(manifest) {
  const reads = manifest.capabilities?.read
  if (!Array.isArray(reads)) fail('manifest.capabilities.read must be an array')
  const profiles = reads.filter((entry) => entry?.name === 'get_connected_profile')
  if (profiles.length !== 1) fail('manifest must declare exactly one get_connected_profile capability')
  const profile = profiles[0]
  if (profile.classification !== 'read' || profile.writer_authority !== false || profile.openai_profile !== true) {
    fail('get_connected_profile must be read-only, non-writing, and marked openai_profile=true')
  }
  if (profile.resource !== 'cambium://connected-profile'
      || profile.approval_requirement !== 'none'
      || profile.terminal_receipt !== 'none:profile-recognition-grants-no-authority') {
    fail('get_connected_profile authority contract drifted')
  }
  const input = profile.input_schema
  if (!input || input.type !== 'object' || input.additionalProperties !== false
      || Object.keys(input.properties || {}).length !== 0) {
    fail('get_connected_profile input schema must be an empty closed object')
  }
  const output = profile.output_schema
  const outputKeys = Object.keys(output?.properties || {}).sort()
  if (!output || output.type !== 'object' || output.additionalProperties !== false
      || JSON.stringify(output.required) !== JSON.stringify(['id'])
      || JSON.stringify(outputKeys) !== JSON.stringify(['email', 'id', 'name', 'nickname'])
      || output.properties.id?.pattern !== '^prf_[a-f0-9]{64}$') {
    fail('get_connected_profile output schema must match the standard opaque profile shape')
  }
}

function validateDistributionAndMarketplace(manifest) {
  const dist = manifest.distribution
  if (!dist || typeof dist !== 'object' || Array.isArray(dist)) {
    fail('manifest.distribution must be an object describing the closed distribution channel')
  }
  if (dist.channel !== 'closed') {
    fail(`manifest.distribution.channel must be "closed" (got ${JSON.stringify(dist.channel)})`)
  }
  if (dist.sync !== 'admin-controlled') {
    fail(`manifest.distribution.sync must be "admin-controlled" (got ${JSON.stringify(dist.sync)})`)
  }
  if (dist.status !== 'source-only-unverified') {
    fail(`manifest.distribution.status must be "source-only-unverified" (got ${JSON.stringify(dist.status)})`)
  }
  const mp = dist.marketplace
  if (!mp || typeof mp !== 'object' || Array.isArray(mp)) {
    fail('manifest.distribution.marketplace must be an object')
  }
  for (const forbidden of FORBIDDEN_MARKETPLACE_ENTRY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(mp, forbidden)) {
      fail(`manifest.distribution.marketplace must not declare "${forbidden}" (closed local distribution forbids remote references)`)
    }
  }
  if (mp.path !== marketplaceRelPath) {
    fail(`manifest.distribution.marketplace.path must be exactly ${marketplaceRelPath} (got ${JSON.stringify(mp.path)})`)
  }
  if (typeof mp.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(mp.digest)) {
    fail(`manifest.distribution.marketplace.digest must be a sha256 hex digest (got ${JSON.stringify(mp.digest)})`)
  }
  if (mp.marketplace_name !== marketplaceName) {
    fail(`manifest.distribution.marketplace.marketplace_name must be ${JSON.stringify(marketplaceName)} (got ${JSON.stringify(mp.marketplace_name)})`)
  }
  if (mp.plugin_name !== pluginName) {
    fail(`manifest.distribution.marketplace.plugin_name must be ${JSON.stringify(pluginName)} (got ${JSON.stringify(mp.plugin_name)})`)
  }
  if (mp.source_kind !== 'local') {
    fail(`manifest.distribution.marketplace.source_kind must be "local" (got ${JSON.stringify(mp.source_kind)})`)
  }
  if (mp.local_path !== marketplaceLocalSourcePath) {
    fail(`manifest.distribution.marketplace.local_path must be ${JSON.stringify(marketplaceLocalSourcePath)} (got ${JSON.stringify(mp.local_path)})`)
  }
  // Now load the marketplace file itself and verify shape + digest.
  const marketplaceAbs = resolve(repoRoot, marketplaceRelPath)
  if (!isPathPhysicallyContained(repoRoot, marketplaceAbs)) {
    fail(`marketplace file must be physically contained in the repository with no symlink components: ${marketplaceRelPath}`)
  }
  if (!existsSync(marketplaceAbs) || !statSync(marketplaceAbs).isFile()) {
    fail(`marketplace file missing at ${marketplaceRelPath}`)
  }
  const actualDigest = sha256File(marketplaceAbs)
  if (actualDigest !== mp.digest) {
    fail(`marketplace digest mismatch for ${marketplaceRelPath}: expected ${mp.digest}, got ${actualDigest}`)
  }
  let market
  try {
    market = JSON.parse(readFileSync(marketplaceAbs, 'utf8'))
  } catch (err) {
    fail(`marketplace file is not valid JSON: ${err.message}`)
  }
  if (!market || typeof market !== 'object' || Array.isArray(market)) {
    fail('marketplace file must be a JSON object')
  }
  assertExactKeys(market, ['name', 'interface', 'plugins'], 'marketplace')
  if (market.name !== marketplaceName) {
    fail(`marketplace.name must be ${JSON.stringify(marketplaceName)} (got ${JSON.stringify(market.name)})`)
  }
  if (!Array.isArray(market.plugins) || market.plugins.length !== 1) {
    fail(`marketplace.plugins must contain exactly one entry (got ${Array.isArray(market.plugins) ? market.plugins.length : 'non-array'})`)
  }
  if (!market.interface || typeof market.interface !== 'object' || Array.isArray(market.interface)) {
    fail('marketplace.interface must be an object')
  }
  assertExactKeys(market.interface, ['displayName'], 'marketplace.interface')
  if (market.interface.displayName !== 'Thoughtseed Cambium') {
    fail('marketplace.interface.displayName must be "Thoughtseed Cambium"')
  }
  const entry = market.plugins[0]
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('marketplace.plugins[0] must be an object')
  }
  assertExactKeys(entry, ['name', 'source', 'policy', 'category'], 'marketplace.plugins[0]')
  if (entry.name !== pluginName) {
    fail(`marketplace.plugins[0].name must be ${JSON.stringify(pluginName)} (got ${JSON.stringify(entry.name)})`)
  }
  for (const forbidden of FORBIDDEN_MARKETPLACE_ENTRY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(entry, forbidden)) {
      fail(`marketplace.plugins[0] must not declare "${forbidden}" (closed local distribution forbids remote references)`)
    }
  }
  const src = entry.source
  if (!src || typeof src !== 'object' || Array.isArray(src)) {
    fail('marketplace.plugins[0].source must be an object')
  }
  assertExactKeys(src, ['source', 'path'], 'marketplace.plugins[0].source')
  if (src.source !== 'local') {
    fail(`marketplace.plugins[0].source.source must be "local" (got ${JSON.stringify(src.source)})`)
  }
  if (src.path !== marketplaceLocalSourcePath) {
    fail(`marketplace.plugins[0].source.path must be exactly ${JSON.stringify(marketplaceLocalSourcePath)} (got ${JSON.stringify(src.path)})`)
  }
  // Path containment: the local source path, resolved from repoRoot, must
  // land inside the owned packet root.
  const resolvedLocal = resolve(repoRoot, src.path)
  const packetAbs = resolve(repoRoot, defaultPacketRoot)
  if (resolvedLocal !== packetAbs || !isPathPhysicallyContained(repoRoot, resolvedLocal)) {
    fail(`marketplace.plugins[0].source.path must resolve to the owned packet root ${defaultPacketRoot} (resolved to ${resolvedLocal})`)
  }
  for (const forbidden of FORBIDDEN_MARKETPLACE_SOURCE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(src, forbidden)) {
      fail(`marketplace.plugins[0].source must not declare "${forbidden}" (closed local distribution forbids remote references)`)
    }
  }
  if (!entry.policy || typeof entry.policy !== 'object' || Array.isArray(entry.policy)) {
    fail('marketplace.plugins[0].policy must be an object')
  }
  assertExactKeys(entry.policy, ['installation', 'authentication'], 'marketplace.plugins[0].policy')
  if (entry.policy.installation !== 'AVAILABLE') {
    fail('marketplace.plugins[0].policy.installation must be "AVAILABLE"')
  }
  if (entry.policy.authentication !== 'ON_INSTALL') {
    fail('marketplace.plugins[0].policy.authentication must be "ON_INSTALL"')
  }
  if (entry.category !== 'Productivity') {
    fail('marketplace.plugins[0].category must be "Productivity"')
  }
  // The marketplace file must also be listed in manifest.sources with a
  // matching digest, so drift between marketplace and manifest is caught.
  const sourceEntry = manifest.sources.find((s) => s.path === marketplaceRelPath)
  if (!sourceEntry) {
    fail(`manifest.sources must list ${marketplaceRelPath} so the marketplace file is digest-bound`)
  }
  if (sourceEntry.digest !== mp.digest) {
    fail(`manifest.sources digest for ${marketplaceRelPath} must equal manifest.distribution.marketplace.digest`)
  }
}

function computePayloadDigest(entries) {
  const sorted = entries
    .slice()
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const h = createHash('sha256')
  for (const e of sorted) {
    h.update(e.path)
    h.update('\0')
    h.update(e.digest)
    h.update('\0')
  }
  return 'sha256:' + h.digest('hex')
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length || actual.some((key, i) => key !== wanted[i])) {
    fail(`${label} must contain exactly keys ${wanted.join(', ')} (got ${actual.join(', ')})`)
  }
}

function validatePayloadDigest(manifest) {
  const pd = manifest.payload_digest
  if (!pd || typeof pd !== 'object' || Array.isArray(pd)) {
    fail('manifest.payload_digest must be an object')
  }
  if (pd.algorithm !== payloadDigestAlgorithm) {
    fail(`manifest.payload_digest.algorithm must be ${JSON.stringify(payloadDigestAlgorithm)} (got ${JSON.stringify(pd.algorithm)})`)
  }
  if (typeof pd.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(pd.digest)) {
    fail(`manifest.payload_digest.digest must be a sha256 hex digest (got ${JSON.stringify(pd.digest)})`)
  }
  if (!Array.isArray(pd.covers) || pd.covers.length !== payloadDigestCovers.length) {
    fail(`manifest.payload_digest.covers must list exactly ${payloadDigestCovers.length} paths`)
  }
  // Order-insensitive equality on the cover set (algorithm sorts internally),
  // but every canonical path must be present exactly once.
  const coverSet = new Set(pd.covers)
  if (coverSet.size !== pd.covers.length) {
    fail('manifest.payload_digest.covers must not contain duplicates')
  }
  for (const required of payloadDigestCovers) {
    if (!coverSet.has(required)) {
      fail(`manifest.payload_digest.covers must include ${required}`)
    }
  }
  // The digest is non-self-referential: it is computed from the covered
  // artifacts' path+digest pairs, so recording it in this manifest does not
  // change its value. Recompute from disk and compare.
  const entries = []
  for (const rp of payloadDigestCovers) {
    const abs = resolve(repoRoot, rp)
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      fail(`payload_digest cover missing on disk: ${rp}`)
    }
    entries.push({ path: rp, digest: sha256File(abs) })
  }
  const recomputed = computePayloadDigest(entries)
  if (recomputed !== pd.digest) {
    fail(`manifest.payload_digest.digest mismatch: recorded ${pd.digest}, recomputed ${recomputed} (drift detected)`)
  }
}

function validatePluginVersionConsistency(manifest) {
  const pluginAbs = resolve(repoRoot, defaultPacketRoot, 'plugin.json')
  if (!existsSync(pluginAbs)) fail('plugin.json missing for identity/version consistency check')
  const plugin = readJson(pluginAbs)
  const pm = manifest.plugin_manifest
  if (!pm || typeof pm !== 'object') fail('manifest.plugin_manifest must be an object')
  if (pm.name !== plugin.name) {
    fail(`plugin_manifest.name (${JSON.stringify(pm.name)}) must match plugin.json name (${JSON.stringify(plugin.name)})`)
  }
  if (pm.name !== pluginName) {
    fail(`plugin identity must be ${JSON.stringify(pluginName)} across plugin.json and manifest (got ${JSON.stringify(pm.name)})`)
  }
  if (pm.version !== plugin.version) {
    fail(`plugin_manifest.version (${JSON.stringify(pm.version)}) must match plugin.json version (${JSON.stringify(plugin.version)})`)
  }
  if (!isStrictSemver(plugin.version)) {
    fail(`plugin.json version must be strict semver (got ${JSON.stringify(plugin.version)})`)
  }
  const dist = manifest.distribution
  if (dist && dist.marketplace && dist.marketplace.plugin_name !== plugin.name) {
    fail(`distribution.marketplace.plugin_name must match plugin.json name`)
  }
}

function validatePortableSkill() {
  const skillAbs = resolve(repoRoot, defaultPacketRoot, portableSkillPath)
  if (!existsSync(skillAbs) || !statSync(skillAbs).isFile()) {
    fail(`portable skill missing at fixed path ${defaultPacketRoot}/${portableSkillPath}`)
  }
  const body = readFileSync(skillAbs, 'utf8')
  if (!/^---/m.test(body) || !/^name:\s*cambium-infinite-game/m.test(body) || !/^description:/m.test(body)) {
    fail('portable skill must be a SKILL.md with YAML frontmatter including name and description')
  }
  // The old, non-portable authoritative copy must not linger under import/v1/skills.
  const legacySkillDir = resolve(repoRoot, defaultPacketRoot, 'import', 'v1', 'skills')
  if (existsSync(legacySkillDir)) {
    fail(`legacy skill location must not exist: ${defaultPacketRoot}/import/v1/skills (portable discovery is ${portableSkillPath})`)
  }
}

function validateDeploymentAdmissionPolicy() {
  const checkerPath = resolve(repoRoot, 'scripts/check-openai-mcp-deployment-admission.mjs')
  const result = spawnSync(process.execPath, [checkerPath, '--check-policy'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    fail(`deployment admission policy failed closed: ${(result.stderr || result.stdout || '').trim()}`)
  }
  if (result.stdout.trim() !== 'openai-mcp-deployment-admission: POLICY_READY') {
    fail('deployment admission checker returned an unexpected source-policy verdict')
  }
}

function validatePluginJson() {
  const pluginPath = resolve(repoRoot, defaultPacketRoot, 'plugin.json')
  if (!existsSync(pluginPath)) fail('plugin.json missing at packet root')
  const plugin = readJson(pluginPath)

  if (plugin.$schema !== portablePluginSchemaUrl) {
    fail(`plugin.json $schema must be ${portablePluginSchemaUrl}`)
  }
  if (plugin.name !== 'cambium-infinite-game') {
    fail('plugin.json name must be "cambium-infinite-game" (must match packet directory)')
  }
  if (!isStrictSemver(plugin.version)) {
    fail(`plugin.json version must be strict semver (got ${plugin.version})`)
  }
  if (typeof plugin.description !== 'string' || plugin.description.length === 0) {
    fail('plugin.json description is required')
  }
  if (!plugin.author || typeof plugin.author.name !== 'string' || plugin.author.name.length === 0) {
    fail('plugin.json author.name is required')
  }

  for (const forbidden of FORBIDDEN_PLUGIN_ROOT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(plugin, forbidden)) {
      fail(`plugin.json must not declare forbidden top-level field "${forbidden}" (Agent Plugins 1.0 portable manifest)`)
    }
  }

  const ext = plugin.extensions
  if (!ext || typeof ext !== 'object') fail('plugin.json extensions object is required')
  const openai = ext['com.openai']
  if (!openai || typeof openai !== 'object') {
    fail('plugin.json extensions["com.openai"] is required')
  }
  const iface = openai.interface
  if (!iface || typeof iface !== 'object') {
    fail('plugin.json extensions["com.openai"].interface is required')
  }
  for (const field of REQUIRED_INTERFACE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(iface, field)) {
      fail(`plugin.json extensions["com.openai"].interface.${field} is required`)
    }
  }
  if (typeof iface.shortDescription !== 'string' || iface.shortDescription.length === 0) {
    fail('interface.shortDescription must be a non-empty string')
  }
  if (iface.shortDescription.length > 30) {
    fail(`interface.shortDescription must be <= 30 characters (got ${iface.shortDescription.length})`)
  }
  if (!Array.isArray(iface.capabilities) || iface.capabilities.length === 0) {
    fail('interface.capabilities must be a non-empty array')
  }
  if (!Array.isArray(iface.defaultPrompt) || iface.defaultPrompt.length === 0 || iface.defaultPrompt.length > 3) {
    fail('interface.defaultPrompt must be an array of 1-3 strings')
  }

  // The portable descriptor declares only connection intent. Live readiness
  // remains separately fail-closed behind the receipt gates below.
  const rootMcp = resolve(repoRoot, defaultPacketRoot, 'mcp.json')
  if (!existsSync(rootMcp) || !statSync(rootMcp).isFile()) {
    fail('mcp.json must exist at the packet root')
  }
  let mcp
  try { mcp = JSON.parse(readFileSync(rootMcp, 'utf8')) } catch (error) {
    fail(`mcp.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!mcp || typeof mcp !== 'object' || Array.isArray(mcp)) fail('mcp.json root must be an object')
  const rootKeys = Object.keys(mcp).sort()
  if (JSON.stringify(rootKeys) !== JSON.stringify(['$schema', 'mcpServers'])) {
    fail('mcp.json root keys must be exactly $schema and mcpServers')
  }
  if (mcp.$schema !== portableMcpSchemaUrl) {
    fail(`mcp.json $schema must be ${portableMcpSchemaUrl}`)
  }
  if (!mcp.mcpServers || typeof mcp.mcpServers !== 'object' || Array.isArray(mcp.mcpServers)) {
    fail('mcp.json mcpServers must be an object')
  }
  const serverNames = Object.keys(mcp.mcpServers)
  if (serverNames.length !== 1 || serverNames[0] !== 'cambium') {
    fail('mcp.json mcpServers must contain exactly one server named cambium')
  }
  const server = mcp.mcpServers.cambium
  if (!server || typeof server !== 'object' || Array.isArray(server)) {
    fail('mcp.json cambium server must be an object')
  }
  const serverKeys = Object.keys(server).sort()
  if (JSON.stringify(serverKeys) !== JSON.stringify(['type', 'url'])) {
    fail('mcp.json cambium server keys must be exactly type and url')
  }
  if (server.type !== 'streamable-http') {
    fail('mcp.json cambium server type must be streamable-http')
  }
  if (server.url !== expectedMcpEndpointUrl) {
    fail(`mcp.json cambium server url must be exactly ${expectedMcpEndpointUrl}`)
  }
  let endpoint
  try { endpoint = new URL(server.url) } catch { fail('mcp.json cambium server url must be valid') }
  if (
    endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
    endpoint.search || endpoint.hash
  ) {
    fail('mcp.json cambium server url must use HTTPS with no credentials, query, or fragment')
  }
}

function privacyScan() {
  const packetAbs = resolve(repoRoot, defaultPacketRoot)
  if (!existsSync(packetAbs)) fail(`packet root missing: ${defaultPacketRoot}`)
  const forbidden = [
    '.dev.vars',
    'CLOUDFLARE_API_TOKEN',
    'OPENAI_API_KEY',
    'sk-',
    'Bearer ',
    'BEGIN PRIVATE KEY',
    'BEGIN RSA PRIVATE KEY',
    'CREATE TABLE',
    'INSERT INTO',
    'UPDATE SET',
    'DELETE FROM',
    'wrangler deploy',
  ]
  const home = process.env.HOME || ''
  for (const file of walkFiles(packetAbs)) {
    const rel = relative(repoRoot, file)
    const body = readFileSync(file, 'utf8')
    for (const needle of forbidden) {
      if (body.includes(needle)) fail(`forbidden substring "${needle}" in ${rel}`)
    }
    if (home && body.includes(home)) fail(`developer HOME path leaked into ${rel}`)
    if (/\s\/Volumes\/[A-Za-z0-9_-]+\//.test(body)) fail(`absolute /Volumes path leaked into ${rel}`)
  }
}

function computePacketDigest() {
  const packetAbs = resolve(repoRoot, defaultPacketRoot)
  const files = walkFiles(packetAbs).sort()
  const h = createHash('sha256')
  for (const f of files) {
    const rel = relative(repoRoot, f).split(sep).join('/')
    h.update(rel)
    h.update('\0')
    h.update(readFileSync(f))
    h.update('\0')
  }
  return 'sha256:' + h.digest('hex')
}

// ---------------------------------------------------------------------------
// Live-gate receipt schema
//
// Each receipt is a versioned, closed JSON document. The validator returns an
// array of human-readable errors; the receipt is only accepted if the array
// is empty. Unknown fields anywhere in the receipt are rejected; every gate
// declares its own immutable `subject` shape.
// ---------------------------------------------------------------------------

const SHA256_RE = /^sha256:[a-f0-9]{64}$/

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']'
  return '{' + Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',') + '}'
}

function prerequisiteReceiptSetDigest(parsedReceipts) {
  const hash = createHash('sha256')
  for (const filename of [...INFRASTRUCTURE_RECEIPT_FILENAMES].sort()) {
    hash.update(filename)
    hash.update('\0')
    hash.update(canonicalJson(parsedReceipts.get(filename)))
    hash.update('\0')
  }
  return 'sha256:' + hash.digest('hex')
}

// Strict RFC3339 with seconds and either 'Z' or numeric offset. Fractional
// seconds are allowed. No date-only, no timezone omission.
const RFC3339_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/

function isRfc3339(value) {
  if (typeof value !== 'string') return false
  const m = RFC3339_RE.exec(value)
  if (!m) return false
  const [_, y, mo, d, h, mi, s, zone] = m
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  const hour = Number(h)
  const minute = Number(mi)
  const second = Number(s)
  if (month < 1 || month > 12) return false
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day < 1 || day > daysInMonth) return false
  if (hour > 23 || minute > 59 || second > 59) return false
  if (zone !== 'Z') {
    const [, , offsetHour, offsetMinute] = /^([+-])(\d{2}):(\d{2})$/.exec(zone) || []
    if (offsetHour === undefined || Number(offsetHour) > 23 || Number(offsetMinute) > 59) return false
  }
  return !Number.isNaN(Date.parse(value))
}

const RECEIPT_GATES = {
  'dot-entitlement.receipt.json': {
    gate: 'dot-entitlement',
    schema: 'cambium.openai-live-gate.dot-entitlement.v1',
    subject: {
      entitlementRefDigest: 'sha256',
      workspaceRefDigest: 'sha256',
      tenantRefDigest: 'sha256',
      regionRefDigest: 'sha256',
    },
  },
  'workspace-admin-enablement.receipt.json': {
    gate: 'workspace-admin-enablement',
    schema: 'cambium.openai-live-gate.workspace-admin-enablement.v1',
    subject: {
      workspaceRefDigest: 'sha256',
      tenantRefDigest: 'sha256',
      adminPrincipalRefDigest: 'sha256',
      audienceRefDigest: 'sha256',
    },
  },
  'plugin-connection.receipt.json': {
    gate: 'plugin-connection',
    schema: 'cambium.openai-live-gate.plugin-connection.v1',
    subject: {
      workspaceRefDigest: 'sha256',
      tenantRefDigest: 'sha256',
      pluginRefDigest: 'sha256',
      pluginVersion: 'semver',
      connectionRefDigest: 'sha256',
    },
  },
  'service-credentials.receipt.json': {
    gate: 'service-credentials',
    schema: 'cambium.openai-live-gate.service-credentials.v1',
    subject: {
      workspaceRefDigest: 'sha256',
      tenantRefDigest: 'sha256',
      credentialRefDigest: 'sha256',
      ownerPrincipalRefDigest: 'sha256',
      scope: 'scope-array',
    },
  },
  'deployed-version.receipt.json': {
    gate: 'deployed-version',
    schema: 'cambium.openai-live-gate.deployed-version.v1',
    subject: {
      workspaceRefDigest: 'sha256',
      tenantRefDigest: 'sha256',
      deployedVersion: 'semver',
      bindingsDigest: 'sha256',
    },
  },
  'mcp-endpoint.receipt.json': {
    gate: 'mcp-endpoint',
    schema: 'cambium.openai-live-gate.mcp-endpoint.v1',
    subject: {
      workspaceRefDigest: 'sha256',
      tenantRefDigest: 'sha256',
      endpointUrl: 'exact-mcp-url',
      transport: 'https-transport',
      auth: 'oauth2-auth',
      toolCatalogDigest: 'sha256',
    },
  },
  'readback.receipt.json': {
    gate: 'readback',
    schema: 'cambium.openai-live-gate.readback.v1',
    subject: {
      workspaceRefDigest: 'sha256',
      tenantRefDigest: 'sha256',
      readbackDigest: 'sha256',
    },
  },
  'rollback.receipt.json': {
    gate: 'rollback',
    schema: 'cambium.openai-live-gate.rollback.v1',
    subject: {
      workspaceRefDigest: 'sha256',
      tenantRefDigest: 'sha256',
      priorManifestRefDigest: 'sha256',
      priorDeploymentRefDigest: 'sha256',
      priorBindingsDigest: 'sha256',
      priorConnectionRefDigest: 'sha256',
      priorAudienceRefDigest: 'sha256',
    },
  },
  'marketplace-import.receipt.json': {
    gate: 'marketplace-import',
    schema: 'cambium.openai-live-gate.marketplace-import.v1',
    subject: {
      workspaceRefDigest: 'sha256',
      tenantRefDigest: 'sha256',
      marketplaceName: 'kebab-name',
      pluginName: 'kebab-name',
      pluginVersion: 'semver',
      marketplaceDigest: 'sha256',
      packetDigest: 'sha256',
      initialSyncReportDigest: 'sha256',
      repeatedSyncReportDigest: 'sha256',
      repeatedSyncResult: 'no-change',
    },
  },
  'end-to-end-canary.receipt.json': {
    gate: 'end-to-end-canary',
    schema: 'cambium.openai-live-gate.end-to-end-canary.v1',
    subject: {
      workspaceRefDigest: 'sha256',
      tenantRefDigest: 'sha256',
      pluginVersion: 'semver',
      packetDigest: 'sha256',
      prerequisiteReceiptSetDigest: 'sha256',
      cleanSession: 'canary-clean-session',
      taskParity: 'canary-task-parity',
      persistence: 'canary-persistence',
      surfaces: 'canary-surfaces',
      channel: 'canary-channel',
      stop: 'canary-stop',
      rollback: 'canary-rollback',
      disconnect: 'canary-disconnect',
      negotiation: 'canary-negotiation',
      lineage: 'canary-lineage',
      authority: 'canary-authority',
    },
  },
}

const RECEIPT_TOP_KEYS = new Set([
  'schema',
  'gate',
  'status',
  'verifiedAt',
  'evidenceDigest',
  'ownerApproved',
  'subject',
])

function checkSubjectField(kind, value) {
  switch (kind) {
    case 'kebab-name':
      return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
    case 'semver':
      return isStrictSemver(value)
    case 'sha256':
      return typeof value === 'string' && SHA256_RE.test(value)
    case 'exact-mcp-url':
      return value === expectedMcpEndpointUrl
    case 'scope-array':
      return Array.isArray(value) && value.length === 1 && value[0] === 'read:infinite-game'
    case 'https-transport':
      return value === 'https'
    case 'oauth2-auth':
      return value === 'oauth2'
    case 'no-change':
      return value === 'no-change'
    case 'canary-clean-session':
      return exactObject(value, {
        sessionRefDigest: 'sha256', importPacketDigest: 'sha256', authorityBeforeDigest: 'sha256',
        authorityAfterDigest: 'sha256', toolCatalogDigest: 'sha256', redefinitionCount: 'zero',
      })
    case 'canary-task-parity':
      return exactObject(value, {
        workObjectRefDigest: 'sha256', d1TaskRefDigest: 'sha256', approvalScopeDigest: 'sha256',
        proofContractDigest: 'sha256', localRunRefDigest: 'sha256', cloudRunRefDigest: 'sha256', joinDigest: 'sha256',
      })
    case 'canary-persistence':
      return exactObject(value, {
        checkpointDigest: 'sha256', staleRejectionDigest: 'sha256', freshReadDigest: 'sha256', sensitiveFieldCount: 'zero',
      })
    case 'canary-surfaces':
      return exactObject(value, {
        verified: 'surface-array', heldProbeDigest: 'sha256', effectCount: 'zero', fallbackUsed: 'false',
      })
    case 'canary-channel':
      return exactObject(value, {
        channel: 'approved-channel', audienceRefDigest: 'sha256', destinationRefDigest: 'sha256',
        deliveryReceiptDigest: 'sha256', replayReceiptDigest: 'sha256', deliveryCount: 'one', fallbackUsed: 'false', telegramSendCount: 'zero',
      })
    case 'canary-stop':
      return exactObject(value, {
        stopReceiptDigest: 'sha256', localDenialDigest: 'sha256', cloudDenialDigest: 'sha256',
        lateResultDigest: 'sha256', lateDisposition: 'evidence-only', canonicalFoldbackCount: 'zero',
      })
    case 'canary-rollback':
      return exactObject(value, {
        captureReceiptDigest: 'sha256', restoreDigest: 'sha256', freshReadDigest: 'sha256',
        d1MutationCount: 'zero', schemaMutationCount: 'zero',
      })
    case 'canary-disconnect':
      return exactObject(value, {
        idempotencyKeyDigest: 'sha256', unknownOutcomeDigest: 'sha256', reconciliationDigest: 'sha256', reissueCount: 'zero',
      })
    case 'canary-negotiation':
      return exactObject(value, {
        unsupportedVersionDigest: 'sha256', outcome: 'upgrade-required', mutationToolCount: 'zero',
      })
    case 'canary-lineage':
      return exactObject(value, {
        visionRefDigest: 'sha256', missionRefDigest: 'sha256', isaCriterionRef: 'isc-2504',
        gsdTaskRefDigest: 'sha256', d1TaskRefDigest: 'sha256', runRefDigest: 'sha256',
        immutableReceiptDigest: 'sha256', cortexLearningRefDigest: 'sha256', nextIntentRefDigest: 'sha256', lineageDigest: 'sha256',
      })
    case 'canary-authority':
      return exactObject(value, {
        writer: 'd1-writer', completionSource: 'authoritative-readback', completionReadbackDigest: 'sha256', alternativeWriterCount: 'zero',
      })
    default:
      return false
  }
}

function exactObject(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actualKeys = Object.keys(value).sort()
  const expectedKeys = Object.keys(fields).sort()
  if (canonicalJson(actualKeys) !== canonicalJson(expectedKeys)) return false
  return Object.entries(fields).every(([field, kind]) => checkCanaryValue(kind, value[field]))
}

function checkCanaryValue(kind, value) {
  if (kind === 'sha256') return typeof value === 'string' && SHA256_RE.test(value)
  if (kind === 'zero') return value === 0
  if (kind === 'one') return value === 1
  if (kind === 'false') return value === false
  if (kind === 'approved-channel') return ['chatgpt', 'slack', 'teams'].includes(value)
  if (kind === 'surface-array') return canonicalJson(value) === canonicalJson(['app', 'channel', 'computer', 'mcp', 'plugin'])
  if (kind === 'evidence-only') return value === 'evidence-only'
  if (kind === 'upgrade-required') return value === 'upgrade-required'
  if (kind === 'isc-2504') return value === 'ISC-2504'
  if (kind === 'd1-writer') return value === 'd1-goal-graph'
  if (kind === 'authoritative-readback') return value === 'authoritative-readback'
  return false
}

// Exported for tests: pure validator. Returns { ok: boolean, errors: string[] }.
export function validateLiveGateReceipt(filename, rawBody) {
  const errors = []
  const spec = RECEIPT_GATES[filename]
  if (!spec) {
    errors.push(`unknown receipt filename: ${filename}`)
    return { ok: false, errors }
  }
  if (typeof rawBody !== 'string' || rawBody.trim().length === 0) {
    errors.push('receipt file is empty')
    return { ok: false, errors }
  }
  let doc
  try {
    doc = JSON.parse(rawBody)
  } catch (err) {
    errors.push(`receipt is not valid JSON: ${err.message}`)
    return { ok: false, errors }
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    errors.push('receipt must be a JSON object')
    return { ok: false, errors }
  }
  for (const key of Object.keys(doc)) {
    if (!RECEIPT_TOP_KEYS.has(key)) {
      errors.push(`unknown top-level field "${key}"`)
    }
  }
  if (doc.schema !== spec.schema) {
    errors.push(`schema must be "${spec.schema}" (got ${JSON.stringify(doc.schema)})`)
  }
  if (doc.gate !== spec.gate) {
    errors.push(`gate must be "${spec.gate}" and match the filename (got ${JSON.stringify(doc.gate)})`)
  }
  if (doc.status !== 'verified') {
    errors.push(`status must be "verified" (got ${JSON.stringify(doc.status)})`)
  }
  if (!isRfc3339(doc.verifiedAt)) {
    errors.push(`verifiedAt must be a strict RFC3339 timestamp (got ${JSON.stringify(doc.verifiedAt)})`)
  }
  if (typeof doc.evidenceDigest !== 'string' || !SHA256_RE.test(doc.evidenceDigest)) {
    errors.push(`evidenceDigest must match sha256:[a-f0-9]{64} (got ${JSON.stringify(doc.evidenceDigest)})`)
  }
  if (doc.ownerApproved !== true) {
    errors.push(`ownerApproved must be boolean true (got ${JSON.stringify(doc.ownerApproved)})`)
  }
  const subject = doc.subject
  if (!subject || typeof subject !== 'object' || Array.isArray(subject)) {
    errors.push('subject must be an object')
    return { ok: errors.length === 0, errors }
  }
  const allowedSubjectKeys = new Set(Object.keys(spec.subject))
  for (const key of Object.keys(subject)) {
    if (!allowedSubjectKeys.has(key)) {
      errors.push(`subject contains unknown or forbidden field "${key}"`)
    }
  }
  for (const [field, kind] of Object.entries(spec.subject)) {
    if (!Object.prototype.hasOwnProperty.call(subject, field)) {
      errors.push(`subject.${field} is required`)
      continue
    }
    if (!checkSubjectField(kind, subject[field])) {
      errors.push(`subject.${field} must be a ${kind}`)
    }
  }
  return { ok: errors.length === 0, errors }
}

function validateLiveGateBindings(filename, rawBody, manifest) {
  const errors = []
  const doc = JSON.parse(rawBody)
  const subject = doc.subject
  if (filename === 'plugin-connection.receipt.json') {
    if (subject.pluginVersion !== manifest.plugin_manifest.version) {
      errors.push(`subject.pluginVersion must match packet version ${manifest.plugin_manifest.version}`)
    }
  }
  if (filename === 'deployed-version.receipt.json') {
    if (subject.deployedVersion !== manifest.plugin_manifest.version) {
      errors.push(`subject.deployedVersion must match packet version ${manifest.plugin_manifest.version}`)
    }
    const packetDigest = computePacketDigest()
    if (subject.bindingsDigest !== packetDigest) {
      errors.push(`subject.bindingsDigest must bind the complete reviewed packet ${packetDigest}`)
    }
  }
  if (filename === 'marketplace-import.receipt.json') {
    const marketplace = manifest.distribution.marketplace
    const expected = {
      marketplaceName: marketplace.marketplace_name,
      pluginName: marketplace.plugin_name,
      pluginVersion: manifest.plugin_manifest.version,
      marketplaceDigest: marketplace.digest,
      packetDigest: computePacketDigest(),
    }
    for (const [field, value] of Object.entries(expected)) {
      if (subject[field] !== value) {
        errors.push(`subject.${field} must bind the reviewed packet value ${JSON.stringify(value)}`)
      }
    }
  }
  if (filename === 'end-to-end-canary.receipt.json') {
    const expected = {
      pluginVersion: manifest.plugin_manifest.version,
      packetDigest: computePacketDigest(),
    }
    for (const [field, value] of Object.entries(expected)) {
      if (subject[field] !== value) {
        errors.push(`subject.${field} must bind the reviewed packet value ${JSON.stringify(value)}`)
      }
    }
    if (subject.cleanSession?.importPacketDigest !== subject.packetDigest) {
      errors.push('subject.cleanSession.importPacketDigest must equal subject.packetDigest')
    }
    if (subject.cleanSession?.authorityBeforeDigest !== subject.cleanSession?.authorityAfterDigest) {
      errors.push('subject.cleanSession authority digests must match exactly with zero redefinition')
    }
    if (subject.taskParity?.d1TaskRefDigest !== subject.lineage?.d1TaskRefDigest) {
      errors.push('subject.taskParity.d1TaskRefDigest must equal subject.lineage.d1TaskRefDigest')
    }
    if (subject.taskParity?.localRunRefDigest === subject.taskParity?.cloudRunRefDigest) {
      errors.push('subject.taskParity local and cloud run references must be distinct')
    }
    if (subject.channel?.deliveryReceiptDigest !== subject.channel?.replayReceiptDigest) {
      errors.push('subject.channel replay must return the original delivery receipt digest')
    }
  }
  return errors
}

function validateCanaryReceiptJoin(parsedReceipts) {
  const errors = []
  const canary = parsedReceipts.get('end-to-end-canary.receipt.json')
  if (!canary) return errors
  const subject = canary.subject
  const expectedSetDigest = prerequisiteReceiptSetDigest(parsedReceipts)
  if (subject.prerequisiteReceiptSetDigest !== expectedSetDigest) {
    errors.push(`subject.prerequisiteReceiptSetDigest must bind the exact nine canonical prerequisite receipts ${expectedSetDigest}`)
  }
  const latestPrerequisite = Math.max(
    ...INFRASTRUCTURE_RECEIPT_FILENAMES.map((name) => Date.parse(parsedReceipts.get(name).verifiedAt)),
  )
  if (Date.parse(canary.verifiedAt) < latestPrerequisite) {
    errors.push('end-to-end canary verifiedAt must be at or after every prerequisite receipt')
  }
  const endpoint = parsedReceipts.get('mcp-endpoint.receipt.json')
  if (subject.cleanSession.toolCatalogDigest !== endpoint.subject.toolCatalogDigest) {
    errors.push('subject.cleanSession.toolCatalogDigest must match the reviewed MCP tool catalog')
  }
  if (subject.authority.completionReadbackDigest !== parsedReceipts.get('readback.receipt.json').subject.readbackDigest) {
    errors.push('subject.authority.completionReadbackDigest must match the authoritative readback receipt')
  }
  if (subject.rollback.captureReceiptDigest !== parsedReceipts.get('rollback.receipt.json').evidenceDigest) {
    errors.push('subject.rollback.captureReceiptDigest must match the rollback capture receipt evidenceDigest')
  }
  if (subject.packetDigest !== parsedReceipts.get('marketplace-import.receipt.json').subject.packetDigest) {
    errors.push('subject.packetDigest must match the imported complete packet digest')
  }
  if (subject.pluginVersion !== parsedReceipts.get('plugin-connection.receipt.json').subject.pluginVersion) {
    errors.push('subject.pluginVersion must match the connected plugin version')
  }
  if (subject.pluginVersion !== parsedReceipts.get('deployed-version.receipt.json').subject.deployedVersion) {
    errors.push('subject.pluginVersion must match the deployed version')
  }
  const distinctProofDigests = [
    ...REQUIRED_RECEIPT_FILENAMES.map((name) => parsedReceipts.get(name).evidenceDigest),
    subject.cleanSession.sessionRefDigest,
    subject.taskParity.workObjectRefDigest,
    subject.taskParity.approvalScopeDigest,
    subject.taskParity.proofContractDigest,
    subject.taskParity.localRunRefDigest,
    subject.taskParity.cloudRunRefDigest,
    subject.taskParity.joinDigest,
    subject.persistence.checkpointDigest,
    subject.persistence.staleRejectionDigest,
    subject.persistence.freshReadDigest,
    subject.surfaces.heldProbeDigest,
    subject.channel.audienceRefDigest,
    subject.channel.destinationRefDigest,
    subject.channel.deliveryReceiptDigest,
    subject.stop.stopReceiptDigest,
    subject.stop.localDenialDigest,
    subject.stop.cloudDenialDigest,
    subject.stop.lateResultDigest,
    subject.rollback.restoreDigest,
    subject.rollback.freshReadDigest,
    subject.disconnect.idempotencyKeyDigest,
    subject.disconnect.unknownOutcomeDigest,
    subject.disconnect.reconciliationDigest,
    subject.negotiation.unsupportedVersionDigest,
    subject.lineage.visionRefDigest,
    subject.lineage.missionRefDigest,
    subject.lineage.gsdTaskRefDigest,
    subject.lineage.runRefDigest,
    subject.lineage.immutableReceiptDigest,
    subject.lineage.cortexLearningRefDigest,
    subject.lineage.nextIntentRefDigest,
    subject.lineage.lineageDigest,
  ]
  if (new Set(distinctProofDigests).size !== distinctProofDigests.length) {
    errors.push('live-gate evidence and canary proof digests must be pairwise distinct except for explicit joins')
  }
  return errors
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const isDefaultPacket = args.manifest === defaultManifestPath
  validateSourceManifest(args.manifest)
  if (isDefaultPacket) {
    validatePluginJson()
    validatePortableSkill()
    privacyScan()
  }
  if (args.mode === 'check-source') {
    process.stdout.write('source-only compatibility packet: OK\n')
    if (args.printDigest && isDefaultPacket) {
      process.stdout.write(`packet-digest: ${computePacketDigest()}\n`)
    }
    process.exit(0)
  }
  // Full check: enforce live-gate evidence.
  const manifest = readJson(args.manifest)
  const packetLiveGatesAbs = resolve(repoRoot, defaultPacketRoot, 'live-gates')
  let evidenceDir = packetLiveGatesAbs
  if (args.evidenceRoot) {
    if (!existsSync(args.evidenceRoot) || !statSync(args.evidenceRoot).isDirectory()) {
      fail(`--evidence-root must resolve to an existing directory (got ${args.evidenceRoot})`)
    }
    if (resolve(args.evidenceRoot) === packetLiveGatesAbs) {
      fail('--evidence-root must not point at the packet\'s own live-gates directory')
    }
    evidenceDir = args.evidenceRoot
  }
  const missing = []
  const invalid = []
  const parsedReceipts = new Map()
  for (const rp of manifest.live_gate_receipts_required) {
    const filename = basename(rp)
    const abs = args.evidenceRoot ? join(evidenceDir, filename) : resolve(repoRoot, rp)
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      missing.push(rp)
      continue
    }
    let body
    try {
      body = readFileSync(abs, 'utf8')
    } catch (err) {
      invalid.push({ rp, errors: [`cannot read receipt: ${err.message}`] })
      continue
    }
    const { ok, errors } = validateLiveGateReceipt(filename, body)
    if (!ok) {
      invalid.push({ rp, errors })
      continue
    }
    const bindingErrors = validateLiveGateBindings(filename, body, manifest)
    if (bindingErrors.length > 0) {
      invalid.push({ rp, errors: bindingErrors })
      continue
    }
    parsedReceipts.set(filename, JSON.parse(body))
  }
  const workspaceReceipts = REQUIRED_RECEIPT_FILENAMES
  if (workspaceReceipts.every((name) => parsedReceipts.has(name))) {
    const workspaceRefs = workspaceReceipts.map((name) => parsedReceipts.get(name).subject.workspaceRefDigest)
    if (new Set(workspaceRefs).size !== 1) {
      invalid.push({
        rp: `${defaultPacketRoot}/live-gates/marketplace-import.receipt.json`,
        errors: ['subject.workspaceRefDigest must match every live-gate receipt in the approved workspace'],
      })
    }
    const tenantRefs = workspaceReceipts.map((name) => parsedReceipts.get(name).subject.tenantRefDigest)
    if (new Set(tenantRefs).size !== 1) {
      invalid.push({
        rp: `${defaultPacketRoot}/live-gates/marketplace-import.receipt.json`,
        errors: ['subject.tenantRefDigest must match every live-gate receipt and cannot mix tenant evidence'],
      })
    }
  }
  if (REQUIRED_RECEIPT_FILENAMES.every((name) => parsedReceipts.has(name))) {
    const joinErrors = validateCanaryReceiptJoin(parsedReceipts)
    if (joinErrors.length > 0) {
      invalid.push({
        rp: `${defaultPacketRoot}/live-gates/end-to-end-canary.receipt.json`,
        errors: joinErrors,
      })
    }
  }
  if (missing.length > 0 || invalid.length > 0) {
    process.stdout.write('full compatibility check: HELD — fail-closed\n')
    if (missing.length > 0) {
      process.stdout.write('live-gate evidence missing (each gate is a separate owner-approved receipt):\n')
      for (const rp of missing) process.stdout.write(`  - ${rp}\n`)
    }
    if (invalid.length > 0) {
      process.stdout.write('live-gate evidence receipts failed schema validation:\n')
      for (const item of invalid) {
        process.stdout.write(`  - ${item.rp}\n`)
        for (const err of item.errors) process.stdout.write(`      · ${err}\n`)
      }
    }
    const infrastructureReady = INFRASTRUCTURE_RECEIPT_FILENAMES.every((name) => parsedReceipts.has(name))
    if (infrastructureReady && !parsedReceipts.has('end-to-end-canary.receipt.json')) {
      process.stdout.write('infrastructure compatibility gates: OK; behavioral acceptance: HELD.\n')
    }
    process.stdout.write('gates cover: dot entitlement, workspace admin enablement, plugin connection, service credentials, deployed-version verification, MCP endpoint, authoritative readback, rollback capture, admin-controlled marketplace import, and the joined end-to-end behavioral canary.\n')
    process.exit(2)
  }
  process.stdout.write('full compatibility check: OK (all infrastructure gates and joined behavioral canary are present, schema-valid, and cross-bound)\n')
  if (args.printDigest) process.stdout.write(`packet-digest: ${computePacketDigest()}\n`)
  process.exit(0)
}

// Only run as CLI, not when imported (e.g. by tests exercising the pure
// validator via `import { validateLiveGateReceipt } from '...'`).
if (
  process.argv[1] &&
  realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))
) {
  main()
}
