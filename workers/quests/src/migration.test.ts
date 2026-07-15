import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../migrations/0003_bridge_execution_proof.sql', import.meta.url);
const schemaUrl = new URL('../schema/bridge.sql', import.meta.url);

function triggerDefinitions(sql: string): Record<string, string> {
  const definitions: Record<string, string> = {};
  const pattern = /CREATE TRIGGER IF NOT EXISTS ([A-Za-z0-9_]+)[\s\S]*?\nEND;/g;
  for (const match of sql.matchAll(pattern)) {
    definitions[match[1]] = match[0].replace(/\s+/g, ' ').trim();
  }
  return definitions;
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
