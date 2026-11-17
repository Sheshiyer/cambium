import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { signAccessJwt } from "./access.ts";
import type { Deps } from "./deps.ts";
import { chainHashes } from "./muse.ts";
import { DEFAULT_EXPORT_ROOT, exportFiles, importHistoricalFiles, parseLedger } from "./provenance.ts";
import { route, type WorkerEnv } from "./router.ts";
import { memoryDb } from "./testing/memory-db.ts";
import { installIssuerCredential } from "./tokens.ts";

const NOW = new Date("2026-11-17T00:00:00.000Z");
const ISSUER = "issuer-token-under-test";
const HMAC = "ephemeral-access-hmac-under-test";
const MAGE = "mage@example.invalid";

let sequence = 400;
function deps(db: Awaited<ReturnType<typeof memoryDb>>): Deps {
  return {
    now: () => NOW,
    fetch: globalThis.fetch.bind(globalThis),
    db,
    randomBytes(size) {
      sequence += 1;
      return Uint8Array.from({ length: size }, (_, index) => (sequence * 19 + index) % 256);
    },
  };
}

async function agentToken(db: Awaited<ReturnType<typeof memoryDb>>, agent: string, scopes: string[]) {
  await installIssuerCredential(db, ISSUER, NOW.toISOString());
  const response = await route(new Request("http://127.0.0.1/v1/tokens/issue", {
    method: "POST",
    headers: { authorization: `Bearer ${ISSUER}`, "x-curious-agent": "aletheios", "content-type": "application/json" },
    body: JSON.stringify({ agent, scopes }),
  }), {}, deps(db));
  assert.equal(response.status, 201);
  return (await response.json() as { token: string }).token;
}

test("Thalia is read-only and muse approvals are not a writable route", async () => {
  const db = await memoryDb();
  const token = await agentToken(db, "thalia", ["muse:read", "muse:write"]);
  const headers = { authorization: `Bearer ${token}`, "x-curious-agent": "thalia", "content-type": "application/json" };
  const denied = await route(new Request("http://127.0.0.1/v1/muse/signals", {
    method: "POST",
    headers,
    body: JSON.stringify({ id: "sig-thalia", title: "No", body: "No" }),
  }), {}, deps(db));
  assert.equal(denied.status, 403);
  const missing = await route(new Request("http://127.0.0.1/v1/muse/approvals", {
    method: "POST",
    headers,
    body: JSON.stringify({ decision: "approve" }),
  }), {}, deps(db));
  assert.equal(missing.status, 405);
  assert.equal(await db.get("SELECT id FROM approvals"), null);
  assert.equal(await db.get("SELECT id FROM signals"), null);
});

test("a worked draft, gate, and receipt keep their hashes, and historical approvals stay events", async () => {
  const db = await memoryDb();
  const token = await agentToken(db, "composer", ["muse:write", "muse:read"]);
  const headers = { authorization: `Bearer ${token}`, "x-curious-agent": "composer", "content-type": "application/json" };
  const post = async (pathName: string, body: unknown) => route(new Request(`http://127.0.0.1${pathName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }), {}, deps(db));
  assert.equal((await post("/v1/muse/signals", { id: "sig-fixture", title: "Fixture signal", body: "A fixture signal" })).status, 201);
  assert.equal((await post("/v1/muse/problems", { id: "prob-fixture", signalId: "sig-fixture", statement: "Fixture problem" })).status, 201);
  const draftBody = "Fixture draft body";
  assert.equal((await post("/v1/muse/drafts", { id: "draft-fixture", problemId: "prob-fixture", body: draftBody })).status, 201);
  assert.equal((await post("/v1/muse/gates", { id: "gate-fixture", draftId: "draft-fixture", checks: ["reviewed"] })).status, 201);

  const env: WorkerEnv = { MAGE_ACCESS_IDENTITY: MAGE, CURIOUS_ACCESS_HMAC_KEY: HMAC };
  const approved = await route(new Request("http://127.0.0.1/v1/approve", {
    method: "POST",
    headers: { "cf-access-jwt-assertion": await signAccessJwt({ email: MAGE }, HMAC), "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve", gateId: "gate-fixture", note: "fixture" }),
  }), env, deps(db));
  assert.equal(approved.status, 201);
  const approvalId = (await approved.json() as { approvalId: string }).approvalId;

  const receipt = await post("/v1/muse/receipts", { id: "receipt-fixture", draftId: "draft-fixture", gateId: "gate-fixture", approvalId });
  assert.equal(receipt.status, 201);
  const receiptBody = await receipt.json() as { draftHash: string; gateHash: string; approvalHash: string; receiptHash: string };
  const approval = await db.get<{ id: string; decision: string; actor: string }>("SELECT id, decision, actor FROM approvals WHERE id = ?1", [approvalId]);
  const expected = await chainHashes(draftBody, { id: "gate-fixture", draftId: "draft-fixture", checks: ["reviewed"] }, approval);
  assert.deepEqual(receiptBody, { id: "receipt-fixture", ok: true, ...expected });

  const ledger = await readFile(new URL("../fixtures/pr-team/ledger.md", import.meta.url), "utf8");
  const agentApproval = await readFile(new URL("../fixtures/pr-team/approvals/agent-note.json", import.meta.url), "utf8");
  const workspaceApproval = await readFile(new URL("../fixtures/workspace/approvals/agent-note.json", import.meta.url), "utf8");
  const imported = await importHistoricalFiles(db, [
    { path: "pr-team/ledger.md", text: ledger },
    { path: "pr-team/approvals/agent-note.json", text: agentApproval },
    { path: "/workspace/approvals/agent-note.json", text: workspaceApproval },
  ], NOW.toISOString());
  assert.equal(imported.events, 2);
  assert.deepEqual(imported.derivedRows, parseLedger(ledger));
  const approvalCount = await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM approvals");
  assert.equal(approvalCount?.count, 1);
  const historical = await db.all<{ body: string }>("SELECT body FROM events WHERE kind = 'historical_approval'");
  assert.equal(historical.length, 2);
  assert.equal(historical.every((row) => JSON.parse(row.body).authority === "none"), true);
  const storedLedger = await db.get<{ body: string }>("SELECT body FROM ledger_items");
  assert.equal(storedLedger?.body, ledger);

  const root = await mkdtemp(path.join(tmpdir(), "curious-export-"));
  const existing = "pr-team/approvals/agent-note.json";
  await mkdir(path.join(root, "pr-team/approvals"), { recursive: true });
  await writeFile(path.join(root, existing), "different bytes");
  const exported = await exportFiles(root, [
    { relativePath: existing, contents: agentApproval },
    { relativePath: "pr-team/signals/sig-fixture.json", contents: "{\"id\":\"sig-fixture\"}\n" },
  ]);
  assert.equal(exported.conflicts.length, 1);
  assert.equal(exported.conflicts[0].path, existing);
  assert.equal(await readFile(path.join(root, existing), "utf8"), "different bytes");
  assert.deepEqual(exported.written, ["pr-team/signals/sig-fixture.json"]);
  const same = await exportFiles(root, [{ relativePath: "pr-team/signals/sig-fixture.json", contents: "{\"id\":\"sig-fixture\"}\n" }]);
  assert.deepEqual(same.unchanged, ["pr-team/signals/sig-fixture.json"]);
  assert.deepEqual(same.written, []);
  assert.equal(DEFAULT_EXPORT_ROOT, "/workspace/pr-team");
  assert.deepEqual(await exportFiles(undefined, []), { written: [], unchanged: [], conflicts: [] });
});
