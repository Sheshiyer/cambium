import { test } from "node:test";
import assert from "node:assert/strict";
import { filterInboundJson, filterInboundSse, filterOutboundBody } from "./filter.ts";

test("allows health-check tools/call", () => {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "health-check", arguments: {} },
  });
  const decision = filterOutboundBody(body);
  assert.equal(decision.action, "proxy");
});

test("rejects send-email tools/call", () => {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "send-email", arguments: { to: ["x@y.z"] } },
  });
  const decision = filterOutboundBody(body);
  assert.equal(decision.action, "reject");
  if (decision.action === "reject") {
    assert.equal(decision.id, 7);
    assert.match(decision.message, /send-email/);
  }
});

test("rejects delete-message in a batch", () => {
  const body = JSON.stringify([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "delete-message", arguments: { id: "1" } },
    },
  ]);
  const decision = filterOutboundBody(body);
  assert.equal(decision.action, "reject");
});

test("passes initialize through", () => {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "0" } },
  });
  assert.equal(filterOutboundBody(body).action, "proxy");
});

test("filters SSE tools/list data lines", () => {
  const sse = [
    "event: message",
    "id: abc",
    'data: {"jsonrpc":"2.0","id":3,"result":{"tools":[{"name":"health-check"},{"name":"send-email"},{"name":"list-accounts"}]}}',
    "",
  ].join("\n");
  const filtered = filterInboundSse(sse);
  assert.equal(filtered.includes("send-email"), false);
  assert.equal(filtered.includes("health-check"), true);
  assert.equal(filtered.includes("list-accounts"), true);
});

test("filters tools/list results to the allowlist", () => {
  const inbound = JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    result: {
      tools: [
        { name: "health-check", description: "ok" },
        { name: "send-email", description: "no" },
        { name: "list-accounts", description: "ok" },
      ],
    },
  });
  const filtered = JSON.parse(filterInboundJson(inbound));
  const names = filtered.result.tools.map((t: { name: string }) => t.name);
  assert.deepEqual(names, ["health-check", "list-accounts"]);
});
