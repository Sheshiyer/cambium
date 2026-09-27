import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizeRequest, bearerMatches } from "./auth.ts";

test("bearerMatches accepts the expected token", async () => {
  assert.equal(await bearerMatches("secret-token", "secret-token"), true);
  assert.equal(await bearerMatches("secret-token", "other"), false);
  assert.equal(await bearerMatches("", "secret-token"), false);
});

test("authorizeRequest requires Bearer", async () => {
  const denied = await authorizeRequest(new Request("https://mail-mcp.thoughtseed.space/mcp"), "abc");
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.error, "bearer_required");
});

test("authorizeRequest rejects a wrong token", async () => {
  const denied = await authorizeRequest(
    new Request("https://mail-mcp.thoughtseed.space/mcp", {
      headers: { authorization: "Bearer no" },
    }),
    "yes",
  );
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.error, "unauthorized");
});

test("authorizeRequest accepts a matching token", async () => {
  const ok = await authorizeRequest(
    new Request("https://mail-mcp.thoughtseed.space/mcp", {
      headers: { authorization: "Bearer yes" },
    }),
    "yes",
  );
  assert.equal(ok.ok, true);
});

test("authorizeRequest fails closed without a configured secret", async () => {
  const denied = await authorizeRequest(
    new Request("https://mail-mcp.thoughtseed.space/mcp", {
      headers: { authorization: "Bearer yes" },
    }),
    undefined,
  );
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.error, "gateway_unconfigured");
});
