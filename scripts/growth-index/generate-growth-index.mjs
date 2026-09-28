#!/usr/bin/env node
// Read-only generator: parses the thoughtseed-labs growth vault (department
// cell frontmatter, desk _inbox.md bullets, the X/LinkedIn case-study
// calendar, and the lane1/lane6 HITL gate tables) into one
// growth-index.v1.json. Never writes to the vault path it reads from.

import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

const DEFAULT_VAULT_ROOT = process.env.GROWTH_VAULT_ROOT || '';
const CALENDAR_FILENAME = '2026-08-24-x-linkedin-case-study-calendar.md';

function parseArgs(argv) {
  const options = {
    vaultRoot: DEFAULT_VAULT_ROOT,
    lane1: null,
    lane6: null,
    out: join(SCRIPT_DIR, 'growth-index.v1.json')
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--vault-root') {
      options.vaultRoot = resolve(requireValue(argv, ++i, arg));
    } else if (arg === '--lane1') {
      options.lane1 = resolve(requireValue(argv, ++i, arg));
    } else if (arg === '--lane6') {
      options.lane6 = resolve(requireValue(argv, ++i, arg));
    } else if (arg === '--out') {
      options.out = resolve(requireValue(argv, ++i, arg));
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
    'Usage: node scripts/growth-index/generate-growth-index.mjs [options]',
    '',
    'Read-only: parses the growth vault into scripts/growth-index/growth-index.v1.json.',
    '',
    'Options:',
    '  --vault-root <path>   Growth vault folder (or set GROWTH_VAULT_ROOT)',
    '  --lane1 <path>        lane1-growth-vault.md research note (optional)',
    '  --lane6 <path>        lane6-hitl.md research note (optional)',
    '  --out <path>          Output JSON path (default: scripts/growth-index/growth-index.v1.json)'
  ].join('\n');
}

// ---------- shared markdown table helpers ----------

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

function parseTable(lines) {
  const headerIndex = lines.findIndex((line, index) => lines[index + 1] && isSeparatorRow(lines[index + 1]));
  if (headerIndex === -1) return null;
  const headers = splitMarkdownRow(lines[headerIndex]);
  const rows = lines.slice(headerIndex + 2).filter((line) => !isSeparatorRow(line));
  return {
    headers,
    rows: rows.map((line) => {
      const cells = splitMarkdownRow(line);
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
    })
  };
}

function splitIntoLevel2Sections(source) {
  const lines = source.split(/\r?\n/);
  const sections = [];
  let current = null;
  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.*)$/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { heading: headingMatch[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

// ---------- frontmatter ----------

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: {}, body: source };
  }
  const frontmatter = {};
  let key = null;
  for (const line of match[1].split(/\r?\n/)) {
    const listItem = line.match(/^\s*-\s*(.+)$/);
    if (listItem && key) {
      frontmatter[key] = Array.isArray(frontmatter[key]) ? frontmatter[key] : [];
      frontmatter[key].push(stripQuotes(listItem[1].trim()));
      continue;
    }
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) continue;
    key = field[1];
    const rawValue = field[2].trim();
    if (rawValue === '') {
      frontmatter[key] = null;
    } else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      frontmatter[key] = rawValue
        .slice(1, -1)
        .split(',')
        .map((part) => stripQuotes(part.trim()))
        .filter((part) => part.length > 0);
    } else {
      frontmatter[key] = stripQuotes(rawValue);
    }
  }
  const body = source.slice(match[0].length);
  return { frontmatter, body };
}

function stripQuotes(value) {
  const quoted = value.match(/^(['"])(.*)\1$/);
  return quoted ? quoted[2] : value;
}

// ---------- department cells + inbox ----------

function listDirs(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => statSync(join(path, name)).isDirectory())
    .sort();
}

function findCellReadmes(deskPath) {
  const results = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full, depth + 1);
      } else if (name === 'README.md' && dir !== deskPath) {
        results.push(full);
      }
    }
  };
  walk(deskPath, 0);
  return results.sort();
}

function parseInboxItems(body) {
  const lines = body.split(/\r?\n/);
  const items = [];
  let current = null;

  const flush = () => {
    if (current) items.push(current);
    current = null;
  };

  for (const line of lines) {
    const startMatch = line.match(/^-\s+(\d{4}-\d{2}-\d{2})\s*\|\s*(.*)$/);
    if (startMatch) {
      flush();
      const [, date, rest] = startMatch;
      current = { date, raw: line.trim() };
      for (const segment of rest.split('|')) {
        const trimmed = segment.trim();
        const kv = trimmed.match(/^([a-zA-Z_]+):\s*(.*)$/);
        if (!kv) continue;
        applyField(current, kv[1], kv[2]);
      }
      continue;
    }
    if (!current) continue;
    const continuationMatch = line.match(/^\s{2,}([a-zA-Z_]+):\s*(.*)$/);
    if (continuationMatch) {
      current.raw += `\n${line.trim()}`;
      applyField(current, continuationMatch[1], continuationMatch[2]);
    }
  }
  flush();
  return items;
}

function applyField(item, rawKey, rawValue) {
  const value = rawValue.trim();
  const key = rawKey.toLowerCase();
  if (key === 'score') {
    const num = Number.parseInt(value, 10);
    item.score = Number.isNaN(num) ? null : num;
  } else if (key === 'draft_path') {
    item.draftPath = value || null;
  } else if (key === 'cell' || key === 'src' || key === 'status' || key === 'quote' || key === 'note' || key === 'query' || key === 'intent') {
    item[key] = value || null;
  } else {
    item[key] = value || null;
  }
}

function buildDepartments(vaultRoot) {
  const departmentPath = join(vaultRoot, 'department');
  const departments = [];
  for (const deskId of listDirs(departmentPath)) {
    const deskPath = join(departmentPath, deskId);
    const deskReadmePath = join(deskPath, 'README.md');
    let role = null;
    if (existsSync(deskReadmePath)) {
      const { frontmatter } = parseFrontmatter(readFileSync(deskReadmePath, 'utf8'));
      role = frontmatter.role ?? null;
    }

    const cells = findCellReadmes(deskPath).map((cellPath) => {
      const { frontmatter } = parseFrontmatter(readFileSync(cellPath, 'utf8'));
      return {
        path: relative(vaultRoot, cellPath),
        frontmatter
      };
    });

    const inboxPath = join(deskPath, '_inbox.md');
    let inbox = [];
    if (existsSync(inboxPath)) {
      const { body } = parseFrontmatter(readFileSync(inboxPath, 'utf8'));
      inbox = parseInboxItems(body);
    }

    departments.push({
      id: deskId,
      role,
      path: relative(vaultRoot, deskPath),
      cells,
      inbox
    });
  }
  return departments;
}

// ---------- calendar ----------

function parseCalendar(vaultRoot) {
  const calendarPath = join(vaultRoot, CALENDAR_FILENAME);
  if (!existsSync(calendarPath)) {
    return { path: null, frontmatter: {}, rows: [] };
  }
  const source = readFileSync(calendarPath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(source);

  const rows = [];
  let week = null;
  const lines = body.split(/\r?\n/);
  let tableBuffer = [];

  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    const table = parseTable(tableBuffer);
    tableBuffer = [];
    if (!table) return;
    const headers = table.headers.map(normalizeHeader);
    if (!headers.includes('date') || !headers.includes('channel')) return;
    for (const row of table.rows) {
      const rawDate = row.date ?? row['date'] ?? '';
      const [datePart, dayPart] = rawDate.split(/\s+/);
      rows.push({
        week,
        date: datePart ?? rawDate,
        day: dayPart ?? null,
        channel: row.channel ?? '',
        windowIst: row['window ist'] ?? row.window_ist ?? '',
        format: row.format ?? '',
        job: row.job ?? '',
        status: row.status ?? '',
        composioJobId: row['composio_job_id'] ?? '',
        permalink: row.permalink ?? ''
      });
    }
  };

  for (const line of lines) {
    const weekHeading = line.match(/^##\s+Week\s+(\d+)/i);
    if (weekHeading) {
      flushTable();
      week = Number.parseInt(weekHeading[1], 10);
      continue;
    }
    if (line.trim().startsWith('|')) {
      tableBuffer.push(line);
    } else if (tableBuffer.length) {
      flushTable();
    }
  }
  flushTable();

  return { path: relative(vaultRoot, calendarPath), frontmatter, rows };
}

// ---------- HITL gate tables (lane1 / lane6 research notes) ----------

function parseGatesFromLane(filePath, sourceName, headingPattern) {
  if (!filePath || !existsSync(filePath)) return [];
  const source = readFileSync(filePath, 'utf8');
  const sections = splitIntoLevel2Sections(source);
  const gates = [];
  for (const section of sections) {
    if (!headingPattern.test(section.heading)) continue;
    const tableLines = section.lines.filter((line) => line.trim().startsWith('|'));
    const table = parseTable(tableLines);
    if (!table) continue;
    const [idHeader, ...restHeaders] = table.headers;
    for (const row of table.rows) {
      const id = row[idHeader]?.trim() || null;
      const fields = {};
      for (const header of restHeaders) {
        fields[header] = row[header] ?? '';
      }
      gates.push({
        source: sourceName,
        category: section.heading,
        id,
        fields
      });
    }
  }
  return gates;
}

function buildGates(lane1Path, lane6Path) {
  const lane1Gates = parseGatesFromLane(lane1Path, 'lane1', /HITL gates/i);
  const lane6Gates = parseGatesFromLane(lane6Path, 'lane6', /^[A-C]\./);
  return [...lane1Gates, ...lane6Gates];
}

// ---------- main ----------

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  if (!options.vaultRoot) {
    console.error('error: pass --vault-root <path> or set GROWTH_VAULT_ROOT');
    process.exit(2);
  }
  if (!existsSync(options.vaultRoot)) {
    throw new Error(`vault root not found: ${options.vaultRoot}`);
  }

  const departments = buildDepartments(options.vaultRoot);
  const calendar = parseCalendar(options.vaultRoot);
  const gates = buildGates(options.lane1, options.lane6);

  const index = {
    schema: 'thoughtseed.growth-index.v1',
    generatedAt: new Date().toISOString(),
    sourceRoot: options.vaultRoot,
    laneSources: {
      lane1: options.lane1,
      lane6: options.lane6
    },
    departments,
    calendar,
    gates
  };

  mkdirSync(dirname(options.out), { recursive: true });
  writeFileSync(options.out, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`wrote ${options.out}`);
  console.log(`departments: ${departments.length}, calendar rows: ${calendar.rows.length}, gates: ${gates.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  parseFrontmatter,
  parseInboxItems,
  parseCalendar,
  parseGatesFromLane,
  buildDepartments,
  buildGates,
  parseTable,
  splitIntoLevel2Sections
};
