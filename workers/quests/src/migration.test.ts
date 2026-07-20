import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../migrations/0003_bridge_execution_proof.sql', import.meta.url);
const businessArtifactsMigrationUrl = new URL('../migrations/0004_business_artifacts.sql', import.meta.url);
const schemaUrl = new URL('../schema/bridge.sql', import.meta.url);

function triggerDefinitions(sql: string): Record<string, string> {
  const definitions: Record<string, string> = {};
  const pattern = /CREATE TRIGGER IF NOT EXISTS ([A-Za-z0-9_]+)[\s\S]*?\nEND;/g;
  for (const match of sql.matchAll(pattern)) {
    definitions[match[1]] = match[0].replace(/\s+/g, ' ').trim();
  }
  return definitions;
}

function normalizeDefinition(definition: string): string {
  return definition.replace(/\s+/g, ' ').trim();
}

function businessTaskDefinitions(sql: string): {
  table: string;
  indexes: Record<string, string>;
} {
  const table = sql.match(/CREATE TABLE IF NOT EXISTS bridge_business_tasks[\s\S]*?\);/);
  assert.ok(table, 'missing bridge_business_tasks table definition');

  const indexes: Record<string, string> = {};
  const indexPattern = /CREATE INDEX IF NOT EXISTS (idx_bridge_business_tasks_[A-Za-z0-9_]+)[\s\S]*?;/g;
  for (const match of sql.matchAll(indexPattern)) {
    indexes[match[1]] = normalizeDefinition(match[0]);
  }

  return {
    table: normalizeDefinition(table[0]),
    indexes,
  };
}

test('native execution schema uses D1-compatible identity guard triggers', async () => {
  const [migration, schema] = await Promise.all([
    readFile(migrationUrl, 'utf8'),
    readFile(schemaUrl, 'utf8'),
  ]);

  for (const sql of [migration, schema]) {
    assert.doesNotMatch(sql, /SELECT\s+CASE\s+WHEN\s+EXISTS/i);
    for (const trigger of [
      'bridge_execution_identity_guard_insert',
      'bridge_execution_claim_history_insert',
      'bridge_execution_identity_guard_takeover',
      'bridge_execution_claim_history_takeover',
      'bridge_execution_ack_timestamp',
    ]) {
      assert.match(sql, new RegExp(`CREATE TRIGGER IF NOT EXISTS ${trigger}\\b`));
    }
    assert.match(sql, /BEFORE INSERT ON bridge_executions\s+WHEN EXISTS[\s\S]*SELECT RAISE\(ABORT, 'execution identity conflict'\)/);
    assert.match(sql, /BEFORE UPDATE OF attempt ON bridge_executions\s+WHEN NEW\.attempt <> OLD\.attempt\s+AND EXISTS[\s\S]*SELECT RAISE\(ABORT, 'execution identity conflict'\)/);
  }

  assert.deepEqual(triggerDefinitions(migration), triggerDefinitions(schema));
});

test('business task migration remains identical to the canonical schema', async () => {
  const [migration, schema] = await Promise.all([
    readFile(businessArtifactsMigrationUrl, 'utf8'),
    readFile(schemaUrl, 'utf8'),
  ]);

  const migrationDefinitions = businessTaskDefinitions(migration);
  const schemaDefinitions = businessTaskDefinitions(schema);

  for (const definitions of [migrationDefinitions, schemaDefinitions]) {
    assert.deepEqual(Object.keys(definitions.indexes).sort(), [
      'idx_bridge_business_tasks_execution',
      'idx_bridge_business_tasks_member_status',
    ]);
    assert.match(definitions.table, /gsd_task_id TEXT NOT NULL UNIQUE/);
    assert.match(definitions.table, /idempotency_key TEXT NOT NULL UNIQUE/);
    assert.match(definitions.table, /directive_id TEXT NOT NULL UNIQUE/);
    assert.match(definitions.table, /artifact_id TEXT UNIQUE/);
    assert.match(definitions.table, /artifact_r2_key TEXT UNIQUE/);
    assert.match(definitions.table, /status TEXT NOT NULL CHECK \(status IN \(/);
    assert.match(definitions.table, /synthetic INTEGER NOT NULL DEFAULT 1 CHECK \(synthetic = 1\)/);
    assert.match(definitions.table, /external_action TEXT NOT NULL DEFAULT 'none' CHECK \(external_action = 'none'\)/);
    assert.match(definitions.table, /status NOT IN \('artifact_stored', 'awaiting_human_approval'\)/);
  }

  assert.deepEqual(migrationDefinitions, schemaDefinitions);
});
