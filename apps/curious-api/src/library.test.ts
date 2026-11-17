import assert from "node:assert/strict";
import test from "node:test";
import type { Deps } from "./deps.ts";
import { enqueue } from "./library-cache.ts";
import { TOMBSTONE_MS } from "./library.ts";
import { route, type WorkerEnv } from "./router.ts";
import { memoryDb } from "./testing/memory-db.ts";
import { installIssuerCredential } from "./tokens.ts";

const NOW = new Date("2026-11-17T00:00:00.000Z");
const ISSUER = "issuer-token-under-test";

function ephemeralKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

let sequence = 0;
function deps(db: Awaited<ReturnType<typeof memoryDb>>, now = NOW): Deps {
  return {
    now: () => now,
    fetch: globalThis.fetch.bind(globalThis),
    db,
    randomBytes(size) {
      sequence += 1;
      return Uint8Array.from({ length: size }, (_, index) => (sequence * 31 + index * 7) % 256);
    },
  };
}

async function tokenFor(db: Awaited<ReturnType<typeof memoryDb>>, agent: string, scopes: string[]) {
  await installIssuerCredential(db, ISSUER, NOW.toISOString());
  const response = await route(new Request("http://127.0.0.1/v1/tokens/issue", {
    method: "POST",
    headers: { authorization: `Bearer ${ISSUER}`, "x-curious-agent": "aletheios", "content-type": "application/json" },
    body: JSON.stringify({ agent, scopes }),
  }), {}, deps(db));
  assert.equal(response.status, 201);
  return (await response.json() as { token: string }).token;
}

test("personal fields are encrypted and library:* cannot read them", async () => {
  const db = await memoryDb();
  const key = ephemeralKey();
  const writer = await tokenFor(db, "aletheios", ["library:personal:write", "library:personal:read", "library:write"]);
  const broad = await tokenFor(db, "reader", ["library:*"]);
  const env: WorkerEnv = { CURIOUS_FIELD_KEY: key };
  const saved = await route(new Request("http://127.0.0.1/v1/library/nodes", {
    method: "POST",
    headers: { authorization: `Bearer ${writer}`, "x-curious-agent": "aletheios", "content-type": "application/json" },
    body: JSON.stringify({ id: "note-1", tenantId: "thoughtseed", title: "Shared title", personal: { note: "kept private" } }),
  }), env, deps(db));
  assert.equal(saved.status, 201);
  const stored = await db.get<{ body: string; personal_ciphertext: string | null }>("SELECT body, personal_ciphertext FROM nodes WHERE id = ?1", ["note-1"]);
  assert.equal(stored?.body.includes("kept private"), false);
  assert.ok(stored?.personal_ciphertext);
  assert.equal(stored?.personal_ciphertext.includes("kept private"), false);

  const hidden = await route(new Request("http://127.0.0.1/v1/library/nodes/note-1", {
    headers: { authorization: `Bearer ${broad}`, "x-curious-agent": "reader" },
  }), env, deps(db));
  assert.equal(hidden.status, 200);
  const hiddenBody = await hidden.json() as { personal?: unknown; title: string };
  assert.equal(hiddenBody.title, "Shared title");
  assert.equal("personal" in hiddenBody, false);

  const shown = await route(new Request("http://127.0.0.1/v1/library/nodes/note-1", {
    headers: { authorization: `Bearer ${writer}`, "x-curious-agent": "aletheios" },
  }), env, deps(db));
  assert.equal((await shown.json() as { personal: { note: string } }).personal.note, "kept private");
});

test("a personal-only token cannot tombstone a shared node", async () => {
  const db = await memoryDb();
  const writer = await tokenFor(db, "scribe", ["library:write"]);
  const personalOnly = await tokenFor(db, "aletheios", ["library:personal:write", "library:personal:read"]);
  const writerHeaders = { authorization: `Bearer ${writer}`, "x-curious-agent": "scribe", "content-type": "application/json" };
  const personalHeaders = { authorization: `Bearer ${personalOnly}`, "x-curious-agent": "aletheios", "content-type": "application/json" };
  assert.equal((await route(new Request("http://127.0.0.1/v1/library/nodes", {
    method: "POST",
    headers: writerHeaders,
    body: JSON.stringify({ id: "shared-keep", tenantId: "thoughtseed", title: "Shared" }),
  }), {}, deps(db))).status, 201);
  const denied = await route(new Request("http://127.0.0.1/v1/library/nodes/shared-keep", { method: "DELETE", headers: personalHeaders }), {}, deps(db));
  assert.equal(denied.status, 403);
  assert.equal((await denied.json() as { error: string }).error, "library_write_required");
  const row = await db.get<{ deleted_at: string | null }>("SELECT deleted_at FROM nodes WHERE id = ?1", ["shared-keep"]);
  assert.equal(row?.deleted_at, null);
  assert.equal((await route(new Request("http://127.0.0.1/v1/library/nodes/shared-keep", { method: "DELETE", headers: writerHeaders }), {}, deps(db))).status, 200);
});

test("shared and personal nodes stay tombstoned for 30 days and are then wiped", async () => {
  const db = await memoryDb();
  const key = ephemeralKey();
  const token = await tokenFor(db, "aletheios", ["library:*", "library:personal:*"]);
  const env: WorkerEnv = { CURIOUS_FIELD_KEY: key };
  const headers = { authorization: `Bearer ${token}`, "x-curious-agent": "aletheios", "content-type": "application/json" };
  for (const item of [
    { id: "shared-1", tenantId: "thoughtseed", title: "Shared" },
    { id: "personal-1", tenantId: "thoughtseed", title: "Personal", personal: { note: "private" } },
  ]) {
    assert.equal((await route(new Request("http://127.0.0.1/v1/library/nodes", { method: "POST", headers, body: JSON.stringify(item) }), env, deps(db))).status, 201);
    assert.equal((await route(new Request(`http://127.0.0.1/v1/library/nodes/${item.id}`, { method: "DELETE", headers }), env, deps(db))).status, 200);
  }
  await db.run("UPDATE tokens SET expires_at = ?1", ["2027-01-01T00:00:00.000Z"]);
  const early = new Date(NOW.getTime() + TOMBSTONE_MS - 1);
  const earlyWipe = await route(new Request("http://127.0.0.1/v1/library/maintenance/wipe", { method: "POST", headers }), env, deps(db, early));
  assert.deepEqual((await earlyWipe.json() as { wiped: string[] }).wiped, []);
  assert.equal((await db.all("SELECT id FROM nodes ORDER BY id")).length, 2);
  const due = new Date(NOW.getTime() + TOMBSTONE_MS);
  const wiped = await route(new Request("http://127.0.0.1/v1/library/maintenance/wipe", { method: "POST", headers }), env, deps(db, due));
  assert.deepEqual((await wiped.json() as { wiped: string[] }).wiped.sort(), ["personal-1", "shared-1"]);
  assert.equal((await db.all("SELECT id FROM nodes")).length, 0);
});

test("credentials, cookies, and birth data are rejected and not stored", async () => {
  const db = await memoryDb();
  const token = await tokenFor(db, "aletheios", ["library:*", "library:personal:*"]);
  const headers = { authorization: `Bearer ${token}`, "x-curious-agent": "aletheios", "content-type": "application/json" };
  for (const extra of [{ password: "nope" }, { cookie: "a=b" }, { birth: "1990-01-01" }, { profile: { dob: "1990-01-01" } }]) {
    const response = await route(new Request("http://127.0.0.1/v1/library/nodes", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "bad", tenantId: "thoughtseed", title: "No", ...extra }),
    }), { CURIOUS_FIELD_KEY: ephemeralKey() }, deps(db));
    assert.equal(response.status, 400);
  }
  assert.equal(await db.get("SELECT id FROM nodes WHERE id = ?1", ["bad"]), null);
  const queued = enqueue([], { id: "bad", op: "put", personal: { cookie: "a=b" }, enqueuedAt: NOW.toISOString() });
  assert.deepEqual(queued, { error: "sensitive_rejected" });
});

test("MCP library_get uses the same scope split", async () => {
  const db = await memoryDb();
  const key = ephemeralKey();
  const token = await tokenFor(db, "aletheios", ["library:personal:*", "library:write"]);
  const env: WorkerEnv = { CURIOUS_FIELD_KEY: key };
  const headers = { authorization: `Bearer ${token}`, "x-curious-agent": "aletheios", "content-type": "application/json" };
  await route(new Request("http://127.0.0.1/v1/library/nodes", {
    method: "POST",
    headers,
    body: JSON.stringify({ id: "note-2", tenantId: "thoughtseed", title: "Via MCP", personal: { note: "secret-note" } }),
  }), env, deps(db));
  const listed = await route(new Request("http://127.0.0.1/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  }), env, deps(db));
  assert.equal(listed.status, 200);
  const called = await route(new Request("http://127.0.0.1/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "library_get", arguments: { id: "note-2" } } }),
  }), env, deps(db));
  const payload = await called.json() as { result: { structuredContent: { personal: { note: string } } } };
  assert.equal(payload.result.structuredContent.personal.note, "secret-note");
});
