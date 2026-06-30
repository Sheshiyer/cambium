#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
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
    'Validates Cambium product-branch packet Markdown files against schema.json.'
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
    throw new Error('index must contain a Markdown table with product packet rows');
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
  if (metadata.product_id !== row.product_id) {
    throw new Error(`${packetFile}: product_id "${metadata.product_id}" does not match index row "${row.product_id}"`);
  }
  if (metadata.promotion_state !== row.promotion_state) {
    throw new Error(`${packetFile}: promotion_state "${metadata.promotion_state}" does not match index row "${row.promotion_state}"`);
  }
}

function normalizeControlValue(value) {
  return value.trim().replace(/^`|`$/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
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
}

function validateRequiredProducts(schema, rows) {
  for (const product of schema.required_products || []) {
    const row = rows.find((candidate) => candidate.product_id === product.product_id);
    if (!row) {
      throw new Error(`index missing required product_id: ${product.product_id}`);
    }
    if (row.packet !== product.packet) {
      throw new Error(`index product ${product.product_id} points at ${row.packet}, expected ${product.packet}`);
    }
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
  validateRequiredProducts(schema, rows);

  for (const row of rows) {
    if (!row.product_id || !row.packet) {
      throw new Error('index rows must include product_id and packet values');
    }
    if (isAbsolute(row.packet) || row.packet.includes('..')) {
      throw new Error(`index product ${row.product_id} has unsafe packet path: ${row.packet}`);
    }
    validatePacket({
      packetFile: join(packetDir, row.packet),
      schema,
      row
    });
  }

  console.log(`validated ${rows.length} product branch packet(s) against ${schema.schema_id}`);
}

try {
  main();
} catch (error) {
  console.error(`product branch packet validation failed: ${error.message}`);
  process.exitCode = 1;
}
