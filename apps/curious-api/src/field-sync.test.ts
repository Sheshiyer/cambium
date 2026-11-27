import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Deps } from "./deps.ts";
import { readPlanBytes } from "./field-sync.ts";
import { route } from "./router.ts";
import { memoryDb } from "./testing/memory-db.ts";
import { installIssuerCredential } from "./tokens.ts";

const NOW = new Date("2026-11-17T00:00:00.000Z");
const ISSUER = "issuer-token-under-test";
const fixtureUrl = new URL("../fixtures/field-report-library-sync.v1.json", import.meta.url);

let sequence = 100;
function deps(db: Awaited<ReturnType<typeof memoryDb>>): Deps {
  return {
    now: () => NOW,
    fetch: globalThis.fetch.bind(globalThis),
    db,
    randomBytes(size) {
      sequence += 1;
      return Uint8Array.from({ length: size }, (_, index) => (sequence * 13 + index) % 256);
    },
  };
}

async function fieldToken(db: Awaited<ReturnType<typeof memoryDb>>, scopes: string[]) {
  await installIssuerCredential(db, ISSUER, NOW.toISOString());
  const response = await route(new Request("http://127.0.0.1/v1/tokens/issue", {
    method: "POST",
    headers: { authorization: `Bearer ${ISSUER}`, "x-curious-agent": "aletheios", "content-type": "application/json" },
    body: JSON.stringify({ agent: "archivist", scopes }),
  }), {}, deps(db));
  assert.equal(response.status, 201);
  return (await response.json() as { token: string }).token;
}

test("library sync is a dry run by default and stores plan body and previous byte for byte", async () => {
  const db = await memoryDb();
  const raw = await readFile(fixtureUrl, "utf8");
  const fixture = JSON.parse(raw) as { plan: { body: string; previous: string } };
  const token = await fieldToken(db, ["field:read", "field:write"]);
  const headers = { authorization: `Bearer ${token}`, "x-curious-agent": "archivist", "content-type": "application/json" };
  const dry = await route(new Request("http://127.0.0.1/api/library/sync", { method: "POST", headers, body: raw }), {}, deps(db));
  assert.equal(dry.status, 200);
  const dryBody = await dry.json() as { dryRun: boolean; applied: boolean; diff: { records: { add: string[] }; plan: string } };
  assert.equal(dryBody.dryRun, true);
  assert.equal(dryBody.applied, false);
  assert.deepEqual(dryBody.diff.records.add.sort(), ["draft:fixture-draft", "idea:fixture-idea"]);
  assert.equal(dryBody.diff.plan, "add");
  assert.equal(await db.get("SELECT id FROM field_expedition"), null);
  assert.equal(await db.get("SELECT source_key FROM field_records"), null);

  const applied = await route(new Request("http://127.0.0.1/api/library/sync", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...JSON.parse(raw), apply: true }),
  }), {}, deps(db));
  assert.equal(applied.status, 200);
  assert.equal((await applied.json() as { applied: boolean }).applied, true);
  const stored = await readPlanBytes(db, "owner");
  assert.equal(stored?.body, fixture.plan.body);
  assert.equal(stored?.previous, fixture.plan.previous);
  assert.equal(stored?.body, "{\"revision\":2,\"missions\":{}}\n");
  assert.equal(stored?.previous, "{\"revision\":1,\"missions\":{}}\n");
  const definition = await db.get<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name = 'field_expedition'");
  assert.match(definition?.sql ?? "", /\bbody\b/);
  assert.match(definition?.sql ?? "", /\bprevious\b/);
  assert.doesNotMatch(definition?.sql ?? "", /\bbodies\b/);

  const again = await route(new Request("http://127.0.0.1/api/library/sync", { method: "POST", headers, body: raw }), {}, deps(db));
  assert.equal((await again.json() as { diff: { plan: string } }).diff.plan, "same");
});

test("extension sync uses schema, cursor, operations, receipts, and changes", async () => {
  const db = await memoryDb();
  const token = await fieldToken(db, ["field:read", "field:write"]);
  const headers = { authorization: `Bearer ${token}`, "x-curious-agent": "archivist", "content-type": "application/json" };
  const key = JSON.stringify(["items", "fixture-item"]);
  const response = await route(new Request("http://127.0.0.1/api/library/sync", {
    method: "POST",
    headers,
    body: JSON.stringify({
      schema: "field-report-library-sync.v1",
      cursor: 0,
      operations: [{ id: "op-1", key, patch: { title: "Fixture item" }, base: { title: 0 } }],
    }),
  }), {}, deps(db));
  assert.equal(response.status, 200);
  const body = await response.json() as {
    schema: string;
    cursor: number;
    hasMore: boolean;
    receipts: { id: string; conflicts: Record<string, unknown>; record: { key: string; data: { title: string }; fields: { title: number }; revision: number } }[];
    changes: { record: { key: string } }[];
  };
  assert.equal(body.schema, "field-report-library-sync.v1");
  assert.equal(typeof body.cursor, "number");
  assert.equal(body.hasMore, false);
  assert.equal(body.receipts[0].id, "op-1");
  assert.deepEqual(body.receipts[0].conflicts, {});
  assert.equal(body.receipts[0].record.key, key);
  assert.equal(body.receipts[0].record.data.title, "Fixture item");
  assert.equal(body.receipts[0].record.fields.title, 1);
  assert.equal(body.receipts[0].record.revision, 1);
  assert.equal(body.changes[0].record.key, key);
  const denied = await route(new Request("http://127.0.0.1/api/library/sync", {
    method: "POST",
    headers,
    body: JSON.stringify({
      schema: "field-report-library-sync.v1",
      cursor: 0,
      operations: [{ id: "op-2", key, patch: { password: "nope" }, base: { password: 0 } }],
    }),
  }), {}, deps(db));
  assert.equal(denied.status, 400);
  assert.equal((await denied.json() as { error: string }).error, "forbidden_field");
});
