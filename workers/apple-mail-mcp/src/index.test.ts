import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";

const env = {
  MCP_BEARER: "test-bearer",
  ORIGIN_SECRET: "test-origin",
  ORIGIN_URL: "https://mail-mcp-origin.thoughtseed.space",
};

test("unauthenticated POST is 401", async () => {
  const res = await worker.fetch(new Request("https://mail-mcp.thoughtseed.space/mcp", { method: "POST", body: "{}" }), env);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, "bearer_required");
});

test("unknown path is 404 even with bearer", async () => {
  const res = await worker.fetch(
    new Request("https://mail-mcp.thoughtseed.space/", {
      headers: { authorization: "Bearer test-bearer" },
    }),
    env,
  );
  assert.equal(res.status, 404);
});

test("send-email is rejected without contacting origin", async () => {
  const previous = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = (async () => {
    fetched = true;
    return new Response("no");
  }) as typeof fetch;
  try {
    const res = await worker.fetch(
      new Request("https://mail-mcp.thoughtseed.space/mcp", {
        method: "POST",
        headers: { authorization: "Bearer test-bearer", "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "send-email", arguments: { to: ["a@b.c"], subject: "x", body: "y" } },
        }),
      }),
      env,
    );
    assert.equal(res.status, 200);
    const rpc = await res.json();
    assert.equal(rpc.error.code, -32603);
    assert.match(rpc.error.message, /send-email/);
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = previous;
  }
});
