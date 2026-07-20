import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../migrations/0003_bridge_execution_proof.sql', import.meta.url);
const businessArtifactsMigrationUrl = new URL('../migrations/0004_business_artifacts.sql', import.meta.url);
const marketingRendererMigrationUrl = new URL('../migrations/0005_marketing_create_renderer.sql', import.meta.url);
const leadRuntimeMigrationUrl = new URL('../migrations/0006_lead_runtime_spine.sql', import.meta.url);
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

function marketingRendererDefinitions(sql: string): {
  runs: string;
  approvals: string;
  indexes: Record<string, string>;
} {
  const runs = sql.match(/CREATE TABLE IF NOT EXISTS marketing_render_runs[\s\S]*?\n\);/);
  const approvals = sql.match(/CREATE TABLE IF NOT EXISTS marketing_render_approvals[\s\S]*?\n\);/);
  assert.ok(runs, 'missing marketing_render_runs table definition');
  assert.ok(approvals, 'missing marketing_render_approvals table definition');
  const indexes: Record<string, string> = {};
  const pattern = /CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (idx_marketing_render_[A-Za-z0-9_]+)[\s\S]*?;/g;
  for (const match of sql.matchAll(pattern)) indexes[match[1]] = normalizeDefinition(match[0]);
  return {
    runs: normalizeDefinition(runs[0]),
    approvals: normalizeDefinition(approvals[0]),
    indexes,
  };
}

function leadRuntimeDefinitions(sql: string): string {
  const marker = 'CREATE TABLE IF NOT EXISTS lead_records';
  const offset = sql.indexOf(marker);
  assert.notEqual(offset, -1, 'missing lead_records table definition');
  return normalizeDefinition(sql.slice(offset));
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

  const migrationTriggers = triggerDefinitions(migration);
  const schemaTriggers = triggerDefinitions(schema);
  assert.deepEqual(
    migrationTriggers,
    Object.fromEntries(Object.keys(migrationTriggers).map((name) => [name, schemaTriggers[name]])),
  );
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

test('marketing renderer migration remains identical to the canonical schema', async () => {
  const [migration, schema] = await Promise.all([
    readFile(marketingRendererMigrationUrl, 'utf8'),
    readFile(schemaUrl, 'utf8'),
  ]);
  const migrationDefinitions = marketingRendererDefinitions(migration);
  const schemaDefinitions = marketingRendererDefinitions(schema);
  for (const definitions of [migrationDefinitions, schemaDefinitions]) {
    assert.match(definitions.runs, /tenant_id TEXT NOT NULL DEFAULT 'thoughtseed' CHECK \(tenant_id = 'thoughtseed'\)/);
    assert.match(definitions.runs, /adapter_id TEXT NOT NULL DEFAULT 'founder-article-nvidia@1\.0\.0' CHECK \(adapter_id = 'founder-article-nvidia@1\.0\.0'\)/);
    assert.match(definitions.runs, /attempt INTEGER NOT NULL DEFAULT 1 CHECK \(attempt = 1\)/);
    assert.match(definitions.runs, /status TEXT NOT NULL CHECK \(status IN \('prepared', 'claimed', 'invoking', 'succeeded', 'failed', 'indeterminate'\)\)/);
    assert.match(definitions.runs, /UNIQUE \(tenant_id, idempotency_key\)/);
    assert.match(definitions.runs, /CHECK \(status NOT IN \('invoking', 'succeeded', 'failed', 'indeterminate'\) OR invoked_at IS NOT NULL\)/);
    assert.match(definitions.runs, /CHECK \(status <> 'succeeded' OR \(artifact_json IS NOT NULL AND receipt_json IS NOT NULL AND artifact_digest IS NOT NULL\)\)/);
    assert.match(definitions.approvals, /decision TEXT NOT NULL CHECK \(decision IN \('approved', 'rejected'\)\)/);
    assert.match(definitions.approvals, /UNIQUE \(request_id, action_digest, approver_id\)/);
    assert.deepEqual(Object.keys(definitions.indexes).sort(), [
      'idx_marketing_render_approvals_request',
      'idx_marketing_render_runs_status',
    ]);
  }
  assert.deepEqual(migrationDefinitions, schemaDefinitions);
});

test('lead runtime migration remains identical to the canonical schema', async () => {
  const [migration, schema] = await Promise.all([
    readFile(leadRuntimeMigrationUrl, 'utf8'),
    readFile(schemaUrl, 'utf8'),
  ]);
  const migrationDefinition = leadRuntimeDefinitions(migration);
  const schemaDefinition = leadRuntimeDefinitions(schema);

  for (const definition of [migrationDefinition, schemaDefinition]) {
    for (const table of [
      'lead_records',
      'lead_source_aliases',
      'lead_observation_receipts',
      'lead_loop_tasks',
      'lead_spend_reservations',
      'lead_provider_usage',
      'lead_cortex_foldbacks',
    ]) {
      assert.match(definition, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
    }
    assert.match(definition, /UNIQUE \(tenant_id, provider_id, source_id\)/);
    assert.match(definition, /status IN \('pending', 'running', 'completed', 'failed', 'stopped'\)/);
    assert.match(definition, /completed lead task receipt is invalid/);
    assert.match(definition, /provider usage exceeds or lacks reservation/);
    assert.match(definition, /lead cortex foldback must derive from completed task receipt/);
    assert.match(definition, /lead cortex foldbacks are immutable/);
  }

  assert.equal(migrationDefinition, schemaDefinition);
});
