import assert from "node:assert/strict";
import test from "node:test";
import { callQuests, QuestsClientError, type QuestsService } from "./quests-client.ts";

function stub(status: number, body = "{\"ok\":true,\"worker\":\"cambium-quests\"}"): { binding: QuestsService; calls: Request[] } {
  const calls: Request[] = [];
  return {
    calls,
    binding: {
      async fetch(input, init) {
        const request = new Request(input, init);
        calls.push(request);
        return new Response(body, { status, headers: { "content-type": "application/json" } });
      },
    },
  };
}

test("quests service binding passes against a stub", async () => {
  const mock = stub(200);
  const response = await callQuests(mock.binding, "/healthz");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "{\"ok\":true,\"worker\":\"cambium-quests\"}");
  assert.equal(mock.calls.length, 1);
  assert.equal(new URL(mock.calls[0].url).pathname, "/healthz");
  assert.equal(mock.calls[0].headers.get("CF-Access-Client-Id"), null);
  assert.equal(mock.calls[0].headers.get("CF-Access-Client-Secret"), null);
  assert.equal(mock.calls[0].headers.get("authorization"), null);
});

test("quests client fails closed when the service binding is missing", async () => {
  await assert.rejects(callQuests(undefined, "/healthz"), (error: unknown) => {
    assert.ok(error instanceof QuestsClientError);
    assert.equal(error.failure, "missing_binding");
    return true;
  });
});

test("quests client fails closed when the binding denies the call", async () => {
  for (const status of [401, 403, 302]) {
    const mock = stub(status);
    await assert.rejects(callQuests(mock.binding, "/healthz"), (error: unknown) => {
      assert.ok(error instanceof QuestsClientError);
      assert.equal(error.failure, "denied");
      return true;
    });
  }
});

test("quests client fails closed when the stub throws", async () => {
  const binding: QuestsService = {
    async fetch() {
      throw new Error("binding down");
    },
  };
  await assert.rejects(callQuests(binding, "/healthz"), (error: unknown) => {
    return error instanceof QuestsClientError && error.failure === "denied";
  });
});

test("quests client refuses a path that leaves the binding", async () => {
  const mock = stub(200);
  await assert.rejects(callQuests(mock.binding, "https://other.example.invalid/healthz"), (error: unknown) => {
    return error instanceof QuestsClientError && error.failure === "denied";
  });
  assert.equal(mock.calls.length, 0);
});
