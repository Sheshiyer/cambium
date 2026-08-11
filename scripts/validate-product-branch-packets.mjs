#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

function parseArgs(argv) {
  const options = {
    schema: join(REPO_ROOT, 'docs/plans/product-branches/schema.json')
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--schema') {
      options.schema = resolveRequiredArg(argv, (index += 1), arg);
    } else if (arg === '--packet-dir') {
      options.packetDir = resolveRequiredArg(argv, (index += 1), arg);
    } else if (arg === '--index') {
      options.index = resolveRequiredArg(argv, (index += 1), arg);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  return options;
}

function resolveRequiredArg(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a path`);
  }
  return resolve(value);
}

function usage() {
  return [
    'Usage: node scripts/validate-product-branch-packets.mjs [--schema path] [--packet-dir path] [--index path]',
    '',
    'Validates Cambium branch packet Markdown files against schema.json.'
  ].join('\n');
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readText(file) {
  return readFileSync(file, 'utf8');
}

function normalizeHeader(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function splitMarkdownRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isSeparatorRow(line) {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function parseIndexTable(source, requiredColumns) {
  const tableLines = source.split(/\r?\n/).filter((line) => line.trim().startsWith('|'));
  if (tableLines.length < 3) {
    throw new Error('index must contain a Markdown table with branch packet rows');
  }

  const headerLineIndex = tableLines.findIndex((line, index) => tableLines[index + 1] && isSeparatorRow(tableLines[index + 1]));
  if (headerLineIndex === -1) {
    throw new Error('index table must include a Markdown separator row');
  }

  const headers = splitMarkdownRow(tableLines[headerLineIndex]).map(normalizeHeader);
  const missing = requiredColumns.filter((column) => !headers.includes(column));
  if (missing.length) {
    throw new Error(`index table missing columns: ${missing.join(', ')}`);
  }

  return tableLines.slice(headerLineIndex + 2).filter((line) => !isSeparatorRow(line)).map((line) => {
    const cells = splitMarkdownRow(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
  });
}

function parseFrontmatter(source, file) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    throw new Error(`${file}: missing frontmatter`);
  }

  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) {
      throw new Error(`${file}: unsupported frontmatter line: ${line}`);
    }
    const [, key, rawValue] = field;
    metadata[key] = stripQuotes(rawValue.trim());
  }
  return metadata;
}

function stripQuotes(value) {
  const quoted = value.match(/^(['"])(.*)\1$/);
  return quoted ? quoted[2] : value;
}

function hasSection(source, section) {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^##\\s+${escaped}\\s*$`, 'm').test(source);
}

function extractSection(source, section) {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionPattern = new RegExp(`^##\\s+${escaped}\\s*$`, 'm');
  const sectionMatch = sectionPattern.exec(source);
  if (!sectionMatch) return '';

  const bodyStart = sectionMatch.index + sectionMatch[0].length;
  const remaining = source.slice(bodyStart);
  const nextSection = remaining.search(/^##\s+/m);
  return nextSection === -1 ? remaining : remaining.slice(0, nextSection);
}

function parseSectionTable(source, section) {
  const sectionBody = extractSection(source, section);
  const tableLines = sectionBody.split(/\r?\n/).filter((line) => line.trim().startsWith('|'));
  if (tableLines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headerLineIndex = tableLines.findIndex((line, index) => tableLines[index + 1] && isSeparatorRow(tableLines[index + 1]));
  if (headerLineIndex === -1) {
    return { headers: [], rows: [] };
  }

  const headers = splitMarkdownRow(tableLines[headerLineIndex]).map(normalizeHeader);
  const rows = tableLines.slice(headerLineIndex + 2).filter((line) => !isSeparatorRow(line)).map((line) => {
    const cells = splitMarkdownRow(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
  }).filter((row) => Object.values(row).some((value) => value.trim()));

  return { headers, rows };
}

function validateMetadata({ metadata, schema, row, packetFile }) {
  const missing = schema.required_metadata_fields.filter((field) => !metadata[field]);
  if (missing.length) {
    throw new Error(`${packetFile}: missing metadata fields: ${missing.join(', ')}`);
  }
  if (metadata.schema !== schema.schema_id) {
    throw new Error(`${packetFile}: schema metadata is "${metadata.schema}", expected "${schema.schema_id}"`);
  }
  if (!schema.promotion_states.includes(metadata.promotion_state)) {
    throw new Error(`${packetFile}: unknown promotion_state "${metadata.promotion_state}"`);
  }
  if (schema.branch_kinds?.length && !schema.branch_kinds.includes(metadata.branch_kind)) {
    throw new Error(`${packetFile}: unknown branch_kind "${metadata.branch_kind}"`);
  }
  if (metadata.product_id !== row.product_id) {
    throw new Error(`${packetFile}: product_id "${metadata.product_id}" does not match index row "${row.product_id}"`);
  }
  if (metadata.canonical_work_id !== row.canonical_work_id) {
    throw new Error(`${packetFile}: canonical_work_id "${metadata.canonical_work_id}" does not match index row "${row.canonical_work_id}"`);
  }
  if (metadata.identity_scope !== row.identity_scope) {
    throw new Error(`${packetFile}: identity_scope "${metadata.identity_scope}" does not match index row "${row.identity_scope}"`);
  }
  if (metadata.branch_kind !== row.branch_kind) {
    throw new Error(`${packetFile}: branch_kind "${metadata.branch_kind}" does not match index row "${row.branch_kind}"`);
  }
  if (metadata.name !== row.name) {
    throw new Error(`${packetFile}: name "${metadata.name}" does not match index row "${row.name}"`);
  }
  if (metadata.role !== row.role) {
    throw new Error(`${packetFile}: role "${metadata.role}" does not match index row "${row.role}"`);
  }
  if (metadata.promotion_state !== row.promotion_state) {
    throw new Error(`${packetFile}: promotion_state "${metadata.promotion_state}" does not match index row "${row.promotion_state}"`);
  }
  if (metadata.current_gate !== row.current_gate) {
    throw new Error(`${packetFile}: current_gate "${metadata.current_gate}" does not match index row "${row.current_gate}"`);
  }

  if (!schema.identity_scopes?.includes(metadata.identity_scope)) {
    throw new Error(`${packetFile}: unknown identity_scope "${metadata.identity_scope}"`);
  }

  if (metadata.identity_scope === 'template') {
    if (metadata.canonical_work_id !== schema.non_canonical_work_id_value) {
      throw new Error(`${packetFile}: template packet canonical_work_id must be "${schema.non_canonical_work_id_value}"`);
    }
    return;
  }

  if (!/^(?:sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.canonical_work_id)) {
    throw new Error(`${packetFile}: canonical_work_id "${metadata.canonical_work_id}" is not canonical`);
  }
  const expectedPrefix = metadata.branch_kind === 'product'
    ? 'sapling:'
    : metadata.branch_kind === 'client'
      ? 'branch:'
      : 'program:';
  if (!metadata.canonical_work_id.startsWith(expectedPrefix)) {
    throw new Error(`${packetFile}: canonical_work_id "${metadata.canonical_work_id}" conflicts with branch_kind "${metadata.branch_kind}"`);
  }
  if (metadata.canonical_work_id.slice(expectedPrefix.length) !== metadata.product_id) {
    throw new Error(`${packetFile}: canonical_work_id "${metadata.canonical_work_id}" must end with product_id "${metadata.product_id}"`);
  }
}

function normalizeControlValue(value) {
  return value.trim().replace(/^`|`$/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const LOOP_REQUIRED_COLUMNS = [
  'loop_id',
  'title',
  'cadence',
  'objective',
  'metric',
  'boundary_color',
  'one_change_rule',
  'state_file',
  'stop_rule',
  'model_route',
  'proof_required'
];

const LOOP_BOUNDARY_COLORS = new Set(['green', 'yellow', 'red']);
const LOOP_ONE_CHANGE_BATCHING_PHRASES = ['multiple', 'several', 'batch', 'all gates'];
const LOOP_ONE_CHANGE_GUARDRAIL_PREFIXES = [
  'and keep',
  'and never',
  'and write only',
  'and document the finding in',
  'and record the finding in'
];
const LOOP_ONE_CHANGE_RECORDING_GUARDRAIL_PREFIXES = [
  'and write only',
  'and document the finding in',
  'and record the finding in'
];
const LOOP_ONE_CHANGE_SECOND_ACTION_WORDS = [
  'request',
  'file',
  'submit',
  'approve',
  'decide',
  'escalate',
  'select',
  'choose',
  'record',
  'write',
  'draft',
  'create',
  'return',
  'run',
  'one'
];

function countExactPhrase(value, phrase) {
  return (value.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

function countWholeWord(value, word) {
  return (value.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
}

function stripFinalTerminalPeriod(value) {
  return value.endsWith('.') ? value.slice(0, -1).trimEnd() : value;
}

function isExplicitEnumerationClause(selectedClause) {
  if (!/^of\s+/i.test(selectedClause) || !selectedClause.includes(',')) {
    return false;
  }

  return /^of\s+[^,]+(?:,\s*[^,]+)*\s*,?\s*or\s+[^,]+$/i.test(selectedClause);
}

function matchesSecondActionPattern(value) {
  const secondActionAlternation = LOOP_ONE_CHANGE_SECOND_ACTION_WORDS.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(?:\\band\\s+(?:${secondActionAlternation})\\b|[&+]\\s*(?:${secondActionAlternation})\\b|\\/\\s*(?:${secondActionAlternation})\\b)`, 'i').test(value);
}

function validateGuardrailClause(guardrailClause, rowLabel) {
  if (!guardrailClause) {
    return;
  }

  const guardrailPrefix = LOOP_ONE_CHANGE_GUARDRAIL_PREFIXES.find((prefix) => guardrailClause.startsWith(prefix));
  if (!guardrailPrefix) {
    throw new Error(`${rowLabel} one_change_rule must not suggest batching`);
  }

  const guardrailBody = guardrailClause.slice(guardrailPrefix.length).trimStart();

  if (/[;:]/.test(guardrailBody) || /\.\s+\S/.test(guardrailBody)) {
    throw new Error(`${rowLabel} one_change_rule must not suggest batching`);
  }

  if (/\b(?:then|also|plus)\b/i.test(guardrailBody)) {
    throw new Error(`${rowLabel} one_change_rule must not suggest batching`);
  }

  if (/\band\b/i.test(guardrailBody)) {
    throw new Error(`${rowLabel} one_change_rule must not suggest batching`);
  }

  if (LOOP_ONE_CHANGE_RECORDING_GUARDRAIL_PREFIXES.includes(guardrailPrefix) && !guardrailClause.includes('.operator/branch-loops/')) {
    throw new Error(`${rowLabel} one_change_rule must not suggest batching`);
  }
}

function validateOneChangeRule(oneChangeRule, rowLabel) {
  const exactOneIndex = oneChangeRule.indexOf('exactly one');
  const remainder = stripFinalTerminalPeriod(oneChangeRule.slice(exactOneIndex + 'exactly one'.length).trimStart());

  if (!remainder) {
    throw new Error(`${rowLabel} one_change_rule must not suggest batching`);
  }

  if (/[;:]/.test(remainder) || /\.\s+\S/.test(remainder)) {
    throw new Error(`${rowLabel} one_change_rule must not suggest batching`);
  }

  if (/\b(?:then|also|plus)\b/i.test(remainder)) {
    throw new Error(`${rowLabel} one_change_rule must not suggest batching`);
  }

  if (LOOP_ONE_CHANGE_BATCHING_PHRASES.some((phrase) => new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(remainder))) {
    throw new Error(`${rowLabel} one_change_rule must not suggest batching`);
  }

  const guardrailPattern = new RegExp(
    `\\s(${LOOP_ONE_CHANGE_GUARDRAIL_PREFIXES.map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'i'
  );
  const guardrailMatch = remainder.match(guardrailPattern);

  const selectedClause = guardrailMatch ? remainder.slice(0, guardrailMatch.index).trim() : remainder.trim();
  const guardrailClause = guardrailMatch ? remainder.slice(guardrailMatch.index + 1).trimStart() : '';

  if (!selectedClause) {
    throw new Error(`${rowLabel} one_change_rule must not suggest batching`);
  }

  if (matchesSecondActionPattern(selectedClause)) {
    throw new Error(`${rowLabel} one_change_rule must not suggest batching`);
  }

  if (selectedClause.includes(',') && !isExplicitEnumerationClause(selectedClause)) {
    throw new Error(`${rowLabel} one_change_rule must not suggest batching`);
  }

  if (guardrailClause) {
    validateGuardrailClause(guardrailClause, rowLabel);
  }
}

function validateLoopControlRows({ source, packetFile }) {
  const { rows } = parseSectionTable(source, 'Loop Control Inputs');
  rows.forEach((row, index) => {
    const rowLabel = `${packetFile}: Loop Control Inputs row ${index + 1}`;
    const missingFields = LOOP_REQUIRED_COLUMNS.filter((field) => String(row[field] || '').trim() === '');
    if (missingFields.length) {
      throw new Error(`${rowLabel} missing required loop field(s): ${missingFields.join(', ')}`);
    }

    const boundaryColor = String(row.boundary_color || '').trim();
    if (!LOOP_BOUNDARY_COLORS.has(boundaryColor)) {
      throw new Error(`${rowLabel} has invalid boundary_color "${boundaryColor}"`);
    }
    const stateFile = String(row.state_file || '').trim();
    if (!stateFile.startsWith('.operator/branch-loops/') || stateFile.includes('..') || stateFile.includes('\\')) {
      throw new Error(`${rowLabel} has unsafe state_file "${stateFile}"`);
    }
    const oneChangeRule = String(row.one_change_rule || '').trim().toLowerCase();
    if (!oneChangeRule.includes('exactly one')) {
      throw new Error(`${rowLabel} one_change_rule must include "exactly one"`);
    }
    if (countExactPhrase(oneChangeRule, 'exactly one') > 1) {
      throw new Error(`${rowLabel} one_change_rule must include "exactly one" only once`);
    }
    validateOneChangeRule(oneChangeRule, rowLabel);
    const stopRule = String(row.stop_rule || '').trim();
    if (!/stop/i.test(stopRule)) {
      throw new Error(`${rowLabel} stop_rule must describe when to stop`);
    }
  });
}

function validateControlTables({ source, packetFile, schema }) {
  for (const table of schema.required_control_tables || []) {
    const { headers, rows } = parseSectionTable(source, table.section);
    const missingColumns = (table.required_columns || []).filter((column) => !headers.includes(column));
    if (missingColumns.length) {
      throw new Error(`${packetFile}: ${table.section} table missing columns: ${missingColumns.join(', ')}`);
    }

    const minRows = table.min_rows || 1;
    if (rows.length < minRows) {
      throw new Error(`${packetFile}: ${table.section} table must include at least ${minRows} data row(s)`);
    }

    if (table.required_control_values?.length) {
      const presentControls = new Set(rows.map((row) => normalizeControlValue(row.control || '')));
      const missingControls = table.required_control_values.filter((control) => !presentControls.has(normalizeControlValue(control)));
      if (missingControls.length) {
        throw new Error(`${packetFile}: ${table.section} table missing controls: ${missingControls.join(', ')}`);
      }
    }
  }
}

function stripInlineCode(value) {
  const trimmed = String(value || '').trim();
  const code = trimmed.match(/^`([^`]*)`$/);
  return code ? code[1].trim() : trimmed;
}

function validateProviderDataPolicy({ source, packetFile, metadata, schema }) {
  const policySchema = schema.provider_data_policy;
  if (!policySchema || !hasSection(source, policySchema.section)) {
    return { ...policySchema?.zero_authority_defaults };
  }

  const { headers, rows } = parseSectionTable(source, policySchema.section);
  const missingColumns = policySchema.required_columns.filter((column) => !headers.includes(column));
  if (missingColumns.length) {
    throw new Error(`${packetFile}: ${policySchema.section} table missing columns: ${missingColumns.join(', ')}`);
  }

  const values = {};
  const allowedFields = new Set(policySchema.allowed_fields);
  const callerOverrides = new Set(policySchema.caller_override_fields);
  for (const [index, row] of rows.entries()) {
    const field = normalizeHeader(row.field || '');
    if (!field) {
      throw new Error(`${packetFile}: ${policySchema.section} row ${index + 1} is missing field`);
    }
    if (callerOverrides.has(field)) {
      throw new Error(`${packetFile}: ${policySchema.section} contains caller-owned override field "${field}"`);
    }
    if (!allowedFields.has(field)) {
      throw new Error(`${packetFile}: ${policySchema.section} contains unknown field "${field}"`);
    }
    if (Object.hasOwn(values, field)) {
      throw new Error(`${packetFile}: ${policySchema.section} duplicates field "${field}"`);
    }
    values[field] = stripInlineCode(row.value);
  }

  const policy = { ...policySchema.zero_authority_defaults, ...values };
  if (values.subgraph_version && !policySchema.known_subgraph_versions.includes(values.subgraph_version)) {
    throw new Error(`${packetFile}: unknown subgraph_version "${values.subgraph_version}"`);
  }

  if (values.stage_capabilities) {
    const references = values.stage_capabilities.split(/\s*[,;]\s*/).filter(Boolean);
    for (const reference of references) {
      const match = reference.match(/^([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)@(\d+)\.(\d+)\.(\d+)$/);
      if (!match || !policySchema.known_stages.includes(match[1])) {
        throw new Error(`${packetFile}: invalid stage_capabilities reference "${reference}"`);
      }
    }
  }

  if (policy.provider_binding !== 'none' && !/^[a-z][a-z0-9-]*@\d+\.\d+\.\d+$/.test(policy.provider_binding)) {
    throw new Error(`${packetFile}: provider_binding must be none or a versioned catalog reference`);
  }
  if (policy.provider_binding === 'none' && policy.adapter_version !== 'none') {
    throw new Error(`${packetFile}: adapter_version requires an active provider_binding`);
  }
  if (policy.provider_binding !== 'none' && !/^\d+\.\d+\.\d+$/.test(policy.adapter_version)) {
    throw new Error(`${packetFile}: active provider_binding requires a semantic adapter_version`);
  }
  if (!['true', 'false'].includes(policy.mutation_enabled)) {
    throw new Error(`${packetFile}: mutation_enabled must be true or false`);
  }
  if (metadata.promotion_state === 'proof-only' && policy.mutation_enabled === 'true') {
    throw new Error(`${packetFile}: proof-only packet cannot enable provider mutation`);
  }
  if (policy.mutation_enabled === 'true' && policy.provider_binding === 'none') {
    throw new Error(`${packetFile}: provider mutation requires an active provider_binding`);
  }
  if (values.data_classification && !policySchema.data_classifications.includes(values.data_classification)) {
    throw new Error(`${packetFile}: invalid data_classification "${values.data_classification}"`);
  }

  return policy;
}

function validatePacket({ packetFile, schema, row }) {
  if (!existsSync(packetFile)) {
    throw new Error(`missing packet file for ${row.product_id}: ${packetFile}`);
  }

  const source = readText(packetFile);
  const metadata = parseFrontmatter(source, packetFile);
  validateMetadata({ metadata, schema, row, packetFile });

  const missingSections = schema.required_sections.filter((section) => !hasSection(source, section));
  if (missingSections.length) {
    throw new Error(`${packetFile}: missing sections: ${missingSections.join(', ')}`);
  }

  if (!source.includes(schema.promotion_ladder_phrase)) {
    throw new Error(`${packetFile}: missing promotion ladder phrase "${schema.promotion_ladder_phrase}"`);
  }

  const hasProofStatus = schema.proof_statuses.some((status) => new RegExp(`\\b${status}\\b`, 'i').test(source));
  if (!hasProofStatus) {
    throw new Error(`${packetFile}: Evidence Ledger must use at least one proof status label`);
  }

  validateControlTables({ source, packetFile, schema });
  validateLoopControlRows({ source, packetFile });
  validateProviderDataPolicy({ source, packetFile, metadata, schema });
}

function validateUniqueIndexRows(rows) {
  const productIds = new Set();
  const canonicalWorkIds = new Set();
  const packetPaths = new Set();
  for (const row of rows) {
    if (productIds.has(row.product_id)) {
      throw new Error(`index contains duplicate product_id "${row.product_id}"`);
    }
    productIds.add(row.product_id);

    if (row.identity_scope === 'canonical-work-object') {
      if (canonicalWorkIds.has(row.canonical_work_id)) {
        throw new Error(`index contains duplicate canonical_work_id "${row.canonical_work_id}"`);
      }
      canonicalWorkIds.add(row.canonical_work_id);
    }

    if (packetPaths.has(row.packet)) {
      throw new Error(`index contains duplicate packet path "${row.packet}"`);
    }
    packetPaths.add(row.packet);
  }
}

function validateRequiredBranches(schema, rows) {
  const requiredBranches = schema.required_branches || schema.required_products || [];
  for (const branch of requiredBranches) {
    const row = rows.find((candidate) => candidate.product_id === branch.product_id);
    if (!row) {
      throw new Error(`index missing required product_id: ${branch.product_id}`);
    }
    if (branch.branch_kind && row.branch_kind !== branch.branch_kind) {
      throw new Error(`index branch ${branch.product_id} has branch_kind ${row.branch_kind}, expected ${branch.branch_kind}`);
    }
    if (branch.canonical_work_id && row.canonical_work_id !== branch.canonical_work_id) {
      throw new Error(`index branch ${branch.product_id} has canonical_work_id ${row.canonical_work_id}, expected ${branch.canonical_work_id}`);
    }
    if (branch.identity_scope && row.identity_scope !== branch.identity_scope) {
      throw new Error(`index branch ${branch.product_id} has identity_scope ${row.identity_scope}, expected ${branch.identity_scope}`);
    }
    if (row.packet !== branch.packet) {
      throw new Error(`index branch ${branch.product_id} points at ${row.packet}, expected ${branch.packet}`);
    }
  }
}

function validateNoOrphanPackets({ packetDir, rows, schema }) {
  const supportFiles = new Set(schema.non_packet_markdown_files || []);
  const indexedPacketFiles = new Set(rows.map((row) => row.packet));
  const packetFiles = readdirSync(packetDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !supportFiles.has(entry.name))
    .map((entry) => entry.name)
    .sort();
  const orphanPacketFiles = packetFiles.filter((packetFile) => !indexedPacketFiles.has(packetFile));
  if (orphanPacketFiles.length) {
    throw new Error(`packet directory contains unindexed packet file(s): ${orphanPacketFiles.join(', ')}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const schemaFile = options.schema;
  const schema = readJson(schemaFile);
  const schemaDir = dirname(schemaFile);
  const packetDir = options.packetDir || resolve(schemaDir);
  const indexFile = options.index || join(packetDir, 'index.md');

  if (!existsSync(indexFile)) {
    throw new Error(`missing packet index: ${indexFile}`);
  }

  const rows = parseIndexTable(readText(indexFile), schema.required_index_columns);
  validateUniqueIndexRows(rows);
  validateRequiredBranches(schema, rows);
  validateNoOrphanPackets({ packetDir, rows, schema });

  for (const row of rows) {
    if (!row.product_id || !row.canonical_work_id || !row.identity_scope || !row.branch_kind || !row.packet) {
      throw new Error('index rows must include product_id, canonical_work_id, identity_scope, branch_kind, and packet values');
    }
    if (isAbsolute(row.packet) || row.packet.includes('..')) {
      throw new Error(`index branch ${row.product_id} has unsafe packet path: ${row.packet}`);
    }
    validatePacket({
      packetFile: join(packetDir, row.packet),
      schema,
      row
    });
  }

  console.log(`validated ${rows.length} branch packet(s) against ${schema.schema_id}`);
}

try {
  main();
} catch (error) {
  console.error(`branch packet validation failed: ${error.message}`);
  process.exitCode = 1;
}
