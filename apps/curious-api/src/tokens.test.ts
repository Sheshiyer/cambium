import assert from "node:assert/strict";
import test from "node:test";
import { signAccessJwt } from "./access.ts";
import type { Deps } from "./deps.ts";
import { route, type WorkerEnv } from "./router.ts";
import { DEFAULT_TTL_SECONDS, MAX_TTL_SECONDS, SCOPE_CATALOG } from "./scopes.ts";
import { memoryDb } from "./testing/memory-db.ts";
import { installIssuerCredential } from "./tokens.ts";

const NOW = new Date("2026-11-17T00:00:00.000Z");
const ISSUER = "issuer-token-under-test";
const HMAC = "ephemeral-access-hmac-under-test";
const MAGE = "mage@example.invalid";

function deps(db: Awaited<ReturnType<typeof memoryDb>>, now = NOW): Deps {
  let n = 0;
  return {
    now: () => now,
    fetch: globalThis.fetch.bind(globalThis),
    db,
    randomBytes(size) {
      n += 1;
      return Uint8Array.from({ length: size }, (_, index) => (n * 17 + index) % 256);
    },
  };
}

async function issued(db: Awaited<ReturnType<typeof memoryDb>>, body: unknown, now = NOW) {
  await installIssuerCredential(db, ISSUER, now.toISOString());
  return route(new Request("http://127.0.0.1/v1/tokens/issue", {
    method: "POST",
    headers: { authorization: `Bearer ${ISSUER}`, "x-curious-agent": "aletheios", "content-type": "application/json" },
    body: JSON.stringify(body),
  }), {}, deps(db, now));
}

test("the catalog has no approve scope and Aletheios cannot mint tokens:issue", async () => {
  assert.equal(SCOPE_CATALOG.some((scope) => scope.toLowerCase().includes("approv")), false);
  const db = await memoryDb();
  const minted = await issued(db, { agent: "scribe", scopes: ["tokens:issue"] });
  assert.equal(minted.status, 403);
  const approving = await issued(db, { agent: "scribe", scopes: ["approve"] });
  assert.equal(approving.status, 403);
  const rows = await db.all<{ action: string }>("SELECT action FROM audit ORDER BY id");
  assert.ok(rows.some((row) => row.action === "deny"));
  assert.equal(await db.get("SELECT id FROM tokens WHERE agent = ?1", ["scribe"]), null);
});

test("token ttl defaults to 12 hours and rejects a term past 7 days", async () => {
  const db = await memoryDb();
  const standard = await issued(db, { agent: "scribe", scopes: ["library:read"] });
  assert.equal(standard.status, 201);
  const standardBody = await standard.json() as { expiresAt: string };
  assert.equal(standardBody.expiresAt, new Date(NOW.getTime() + DEFAULT_TTL_SECONDS * 1000).toISOString());

  const capped = await issued(await memoryDb(), { agent: "scribe", scopes: ["library:read"], ttlSeconds: MAX_TTL_SECONDS });
  assert.equal(capped.status, 201);
  const cappedBody = await capped.json() as { expiresAt: string };
  assert.equal(cappedBody.expiresAt, new Date(NOW.getTime() + MAX_TTL_SECONDS * 1000).toISOString());

  const over = await issued(await memoryDb(), { agent: "scribe", scopes: ["library:read"], ttlSeconds: MAX_TTL_SECONDS + 1 });
  assert.equal(over.status, 400);
  assert.equal((await over.json() as { error: string }).error, "ttl_out_of_range");
});

test("no bearer token can approve, and Mage's Access identity can", async () => {
  const db = await memoryDb();
  const created = await issued(db, { agent: "scribe", scopes: ["library:read"] });
  const createdBody = await created.json() as { token: string };
  const env: WorkerEnv = { MAGE_ACCESS_IDENTITY: MAGE, CURIOUS_ACCESS_HMAC_KEY: HMAC };
  const jwt = await signAccessJwt({ email: MAGE }, HMAC);
  const bearer = await route(new Request("http://127.0.0.1/v1/approve", {
    method: "POST",
    headers: {
      authorization: `Bearer ${createdBody.token}`,
      "x-curious-agent": "scribe",
      "cf-access-jwt-assertion": jwt,
      "content-type": "application/json",
    },
    body: JSON.stringify({ decision: "approve", note: "no" }),
  }), env, deps(db));
  assert.equal(bearer.status, 403);
  assert.equal(await db.get("SELECT id FROM approvals"), null);

  const allowed = await route(new Request("http://127.0.0.1/v1/approve", {
    method: "POST",
    headers: { "cf-access-jwt-assertion": jwt, "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve", note: "fixture" }),
  }), env, deps(db));
  assert.equal(allowed.status, 201);
  const stored = await db.get<{ actor: string; decision: string }>("SELECT actor, decision FROM approvals");
  assert.equal(stored?.actor, MAGE);
  assert.equal(stored?.decision, "approve");
});

test("a revoked token is denied and audit records issue, use, deny, and revoke", async () => {
  const db = await memoryDb();
  const created = await issued(db, { agent: "scribe", scopes: ["library:read"] });
  const createdBody = await created.json() as { token: string; tokenId: string };
  const headers = { authorization: `Bearer ${createdBody.token}`, "x-curious-agent": "scribe" };
  const used = await route(new Request("http://127.0.0.1/v1/session", { headers }), {}, deps(db));
  assert.equal(used.status, 200);
  const revoked = await route(new Request("http://127.0.0.1/v1/tokens/revoke", {
    method: "POST",
    headers: { authorization: `Bearer ${ISSUER}`, "x-curious-agent": "aletheios", "content-type": "application/json" },
    body: JSON.stringify({ tokenId: createdBody.tokenId, reason: "fixture" }),
  }), {}, deps(db));
  assert.equal(revoked.status, 200);
  const again = await route(new Request("http://127.0.0.1/v1/session", { headers }), {}, deps(db));
  assert.equal(again.status, 403);
  const actions = (await db.all<{ action: string }>("SELECT action FROM audit ORDER BY id")).map((row) => row.action);
  for (const action of ["issue", "use", "revoke", "deny"]) assert.ok(actions.includes(action), action);
});
