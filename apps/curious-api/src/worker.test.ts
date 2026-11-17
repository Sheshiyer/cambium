import assert from "node:assert/strict";
import test from "node:test";
import esbuild from "esbuild";
import { Miniflare } from "miniflare";
import { route } from "./router.ts";

test("health answers and the quests route fails closed without the service binding", async () => {
  const health = await route(new Request("http://127.0.0.1/healthz"), { SERVICE_NAME: "curious-api-dev" });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, worker: "curious-api-dev" });

  const denied = await route(new Request("http://127.0.0.1/v1/quests/health"), { SERVICE_NAME: "curious-api-dev" });
  assert.equal(denied.status, 503);
  const body = await denied.json() as { error: string; failure: string };
  assert.equal(body.error, "fail_closed");
  assert.equal(body.failure, "missing_binding");
});

test("quests route returns the stubbed binding body", async () => {
  const response = await route(new Request("http://127.0.0.1/v1/quests/health"), {
    SERVICE_NAME: "curious-api-dev",
    CAMBIUM_QUESTS: {
      async fetch() {
        return new Response("{\"ok\":true,\"worker\":\"cambium-quests\"}", { status: 200, headers: { "content-type": "application/json" } });
      },
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, worker: "cambium-quests" });
});

test("bundled worker boots under Miniflare and fails closed without the binding", async () => {
  const bundled = await esbuild.build({
    entryPoints: [new URL("./index.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
    target: "es2022",
  });
  const mf = new Miniflare({
    modules: true,
    script: bundled.outputFiles[0].text,
    compatibilityDate: "2026-11-17",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["CURIOUS_DB"],
    d1Persist: false,
    bindings: { SERVICE_NAME: "curious-api-dev" },
  });
  try {
    const health = await mf.dispatchFetch("http://127.0.0.1/healthz");
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, worker: "curious-api-dev" });
    const quests = await mf.dispatchFetch("http://127.0.0.1/v1/quests/health");
    assert.equal(quests.status, 503);
    const body = await quests.json() as { failure: string };
    assert.equal(body.failure, "missing_binding");
  } finally {
    await mf.dispose();
  }
});
