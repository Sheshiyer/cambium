import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { Miniflare } from "miniflare";
import { applyMigrations } from "./migrations.ts";

const migrationsDir = new URL("../migrations/", import.meta.url);
const harness = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/exec") {
        await env.CURIOUS_DB.prepare(await request.text()).run();
        return Response.json({ ok: true });
      }
      if (url.pathname === "/all") {
        const payload = await request.json();
        const result = await env.CURIOUS_DB.prepare(payload.sql).bind(...(payload.params || [])).all();
        return Response.json({ ok: true, results: result.results || [] });
      }
      if (url.pathname === "/run") {
        const payload = await request.json();
        await env.CURIOUS_DB.prepare(payload.sql).bind(...(payload.params || [])).run();
        return Response.json({ ok: true });
      }
      return Response.json({ ok: false, message: "not_found" }, { status: 404 });
    } catch (error) {
      return Response.json({ ok: false, message: String(error && error.message || error) }, { status: 500 });
    }
  }
}
`;

async function readMigrations() {
  const names = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  return Promise.all(names.map(async (name) => ({ name, sql: await readFile(new URL(name, migrationsDir), "utf8") })));
}

test("migrations apply under Miniflare and create the graph tables", async () => {
  const mf = new Miniflare({
    modules: true,
    script: harness,
    compatibilityDate: "2026-11-17",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["CURIOUS_DB"],
    d1Persist: false,
  });
  const exec = async (sql: string) => {
    const response = await mf.dispatchFetch("http://127.0.0.1/exec", { method: "POST", body: sql });
    const body = await response.json() as { ok: boolean; message?: string };
    if (!body.ok) throw new Error(body.message || "migration failed");
  };
  const all = async <T>(sql: string, params: unknown[] = []) => {
    const response = await mf.dispatchFetch("http://127.0.0.1/all", {
      method: "POST",
      body: JSON.stringify({ sql, params }),
    });
    const body = await response.json() as { ok: boolean; results?: T[]; message?: string };
    if (!body.ok) throw new Error(body.message || "query failed");
    return body.results ?? [];
  };
  const run = async (sql: string, params: unknown[] = []) => {
    const response = await mf.dispatchFetch("http://127.0.0.1/run", {
      method: "POST",
      body: JSON.stringify({ sql, params }),
    });
    const body = await response.json() as { ok: boolean; message?: string };
    if (!body.ok) throw new Error(body.message || "run failed");
  };
  try {
    const files = await readMigrations();
    const applied = await applyMigrations(exec, files);
    assert.deepEqual(applied, files.map((file) => file.name));
    const tables = await all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
    );
    for (const name of ["audit", "edges", "events", "nodes", "tokens"]) {
      assert.ok(tables.some((row) => row.name === name), name);
    }

    await run(
      "INSERT INTO nodes (id, tenant_id, kind, body, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      ["node-1", "thoughtseed", "note", "{}", "2026-11-17T00:00:00.000Z", "2026-11-17T00:00:00.000Z"],
    );
    await run(
      "INSERT INTO edges (id, tenant_id, from_id, to_id, kind, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      ["edge-1", "thoughtseed", "node-1", "node-1", "self", "2026-11-17T00:00:00.000Z"],
    );
    await run(
      "INSERT INTO events (tenant_id, kind, subject_id, body, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
      ["thoughtseed", "created", "node-1", "{}", "2026-11-17T00:00:00.000Z"],
    );
    await run(
      "INSERT INTO tokens (id, token_hash, agent, scopes, issued_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      ["tok-1", "hash", "aletheios", "[\"tokens:issue\"]", "2026-11-17T00:00:00.000Z", "2026-11-17T12:00:00.000Z"],
    );
    await run(
      "INSERT INTO audit (at, action, actor, subject, detail) VALUES (?1, ?2, ?3, ?4, ?5)",
      ["2026-11-17T00:00:00.000Z", "issue", "aletheios", "tok-1", "{}"],
    );
    const nodes = await all<{ kind: string }>("SELECT kind FROM nodes WHERE id = ?1", ["node-1"]);
    assert.equal(nodes[0]?.kind, "note");
    await assert.rejects(run("UPDATE audit SET detail = ?1 WHERE action = ?2", ["changed", "issue"]), /append-only/);
    await assert.rejects(run("DELETE FROM audit WHERE action = ?1", ["issue"]), /append-only/);
    await assert.rejects(run("DELETE FROM events WHERE subject_id = ?1", ["node-1"]), /append-only/);
  } finally {
    await mf.dispose();
  }
});
