#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_SCHEMA = join(REPO_ROOT, 'docs/architecture/contracts/ecosystem-graph.v1.schema.json');
const DEFAULT_GRAPH = join(REPO_ROOT, 'docs/architecture/contracts/ecosystem-graph.v1.json');

function parseArgs(argv) {
  const options = { schema: DEFAULT_SCHEMA, graph: DEFAULT_GRAPH };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--schema') {
      options.schema = resolve(requireValue(argv, ++index, arg));
    } else if (arg === '--graph') {
      options.graph = resolve(requireValue(argv, ++index, arg));
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
    throw new Error(`${flag} requires a path`);
  }
  return value;
}

function usage() {
  return [
    'Usage: node scripts/validate-ecosystem-graph.mjs [--schema path] [--graph path]',
    '',
    'Validates docs/architecture/contracts/ecosystem-graph.v1.json against its JSON Schema',
    'and runs a few semantic checks (unique node ids, edge endpoints resolve to declared nodes,',
    'authority is proposal-only, every edge carries an evidence grade).',
    'This is a minimal hand-rolled validator (no ajv dependency in this repo); it supports the',
    'subset of JSON Schema draft 2020-12 keywords used by ecosystem-graph.v1.schema.json:',
    'type, const, enum, pattern, minLength/maxLength, minimum/maximum, required,',
    'additionalProperties, items, minItems, uniqueItems, $ref, $defs.'
  ].join('\n');
}

function readJson(file) {
  if (!existsSync(file)) {
    throw new Error(`file not found: ${file}`);
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

function resolveRef(schema, root) {
  if (!schema || typeof schema !== 'object' || !schema.$ref) {
    return schema;
  }
  const ref = schema.$ref;
  if (!ref.startsWith('#/')) {
    throw new Error(`unsupported $ref target: ${ref}`);
  }
  const path = ref.slice(2).split('/');
  let node = root;
  for (const segment of path) {
    node = node?.[segment];
  }
  if (!node) {
    throw new Error(`unresolved $ref: ${ref}`);
  }
  return node;
}

function typeMatches(value, type) {
  switch (type) {
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return true;
  }
}

function validateNode(value, schemaIn, root, path, errors) {
  const schema = resolveRef(schemaIn, root);

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
    return;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`);
    return;
  }

  if (schema.type && !typeMatches(value, schema.type)) {
    errors.push(`${path}: expected type ${schema.type}, got ${JSON.stringify(value)}`);
    return;
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: string shorter than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path}: string longer than maxLength ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: "${value}" does not match pattern ${schema.pattern}`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: ${value} below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: ${value} above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: array has ${value.length} items, expected at least ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: array has ${value.length} items, expected at most ${schema.maxItems}`);
    }
    if (schema.uniqueItems) {
      const seen = new Set();
      value.forEach((item) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) {
          errors.push(`${path}: duplicate item ${key}`);
        }
        seen.add(key);
      });
    }
    if (schema.items) {
      value.forEach((item, index) => validateNode(item, schema.items, root, `${path}[${index}]`, errors));
    }
  }

  if (schema.type === 'object' || (typeof value === 'object' && value !== null && !Array.isArray(value) && schema.properties)) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return;
    }
    for (const key of schema.required ?? []) {
      if (!(key in value)) {
        errors.push(`${path}: missing required property "${key}"`);
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
          errors.push(`${path}: unexpected property "${key}"`);
        }
      }
    }
    for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
      if (key in value) {
        validateNode(value[key], propSchema, root, `${path}.${key}`, errors);
      }
    }
  }
}

function validateAgainstSchema(graph, schema) {
  const errors = [];
  validateNode(graph, schema, schema, '$', errors);
  return errors;
}

function runSemanticChecks(graph) {
  const errors = [];

  if (graph.authority !== 'proposal-only') {
    errors.push('semantic: graph.authority must be "proposal-only"');
  }

  const ids = new Set();
  for (const node of graph.nodes ?? []) {
    if (ids.has(node.id)) {
      errors.push(`semantic: duplicate node id "${node.id}"`);
    }
    ids.add(node.id);
  }

  for (const [index, edge] of (graph.edges ?? []).entries()) {
    if (!ids.has(edge.from)) {
      errors.push(`semantic: edges[${index}].from "${edge.from}" does not match any node id`);
    }
    if (!ids.has(edge.to)) {
      errors.push(`semantic: edges[${index}].to "${edge.to}" does not match any node id`);
    }
    if (edge.evidence !== 'doc-inferred' && edge.evidence !== 'code-verified') {
      errors.push(`semantic: edges[${index}] has invalid evidence "${edge.evidence}"`);
    }
  }

  return errors;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const schema = readJson(options.schema);
  const graph = readJson(options.graph);

  const errors = [
    ...validateAgainstSchema(graph, schema),
    ...runSemanticChecks(graph)
  ];

  if (errors.length > 0) {
    console.error(`ecosystem-graph validation failed with ${errors.length} error(s):`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`ecosystem-graph OK: ${graph.nodes.length} nodes, ${graph.edges.length} edges (authority: ${graph.authority}).`);
}

main();
