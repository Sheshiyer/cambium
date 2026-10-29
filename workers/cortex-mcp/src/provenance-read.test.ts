import test from "node:test";
import assert from "node:assert/strict";
import {
  digestCanonicalJson,
  readInfiniteGameNode,
  type ProvenanceReaderBinding,
} from "./provenance-read.ts";

const NOW = Date.parse("2026-09-30T03:30:00.000Z");

async function sourceRecord(overrides: Record<string, unknown> = {}) {
  const body = overrides.body ?? {
    status: "active",
    summary: "Cambium mission evidence",
  };
  return {
    schema: "cambium.provenance_source.v1",
    tenant: "cambium",
    node_kind: "mission",
    node_id: "current",
    source_authority: "mission",
    source_reference: "repo:MISSION.md",
    source_version: "git:abc123",
    graph_version: "42",
    observed_at: "2026-09-30T03:00:00.000Z",
    stale_after: "2026-09-30T04:00:00.000Z",
    content_digest: await digestCanonicalJson(body),
    omissions: [{ field: "private_notes", reason: "not_authorized" }],
    body,
    ...overrides,
  };
}

function bindingFor(payload: unknown, status = 200, observe?: (init?: RequestInit) => void): ProvenanceReaderBinding {
  return {
    async fetch(input, init) {
      assert.equal(String(input), "https://cambium-provenance.internal/read");
      observe?.(init);
      return Response.json(payload, { status });
    },
  };
}

const input = {
  tenant: "cambium",
  node_kind: "mission" as const,
  node_id: "current",
  graph_version: "42",
  max_bytes: 4096,
};

test("provenance read returns a bounded digest-verified envelope", async () => {
  const record = await sourceRecord();
  let requestBody: any;
  const result = await readInfiniteGameNode(bindingFor(record, 200, (init) => {
    requestBody = JSON.parse(String(init?.body));
  }), input, NOW);

  assert.deepEqual(requestBody, input);
  assert.equal(result.schema, "cambium.mcp.read_envelope.v1");
  assert.equal(result.tenant, "cambium");
  assert.equal(result.source_authority, "mission");
  assert.equal(result.source_reference, "repo:MISSION.md");
  assert.equal(result.content_digest, record.content_digest);
  assert.deepEqual(result.freshness, {
    observed_at: "2026-09-30T03:00:00.000Z",
    stale_after: "2026-09-30T04:00:00.000Z",
    status: "fresh",
  });
  assert.equal(result.writer_authority, false);
  assert.equal(result.canonical_completion, false);
  assert.deepEqual(result.body, record.body);
});

test("provenance read rejects tenant and node identity substitution", async () => {
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({ tenant: "thoughtseed" })), input, NOW),
    (error: any) => error?.code === "cross_tenant"
  );
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({ node_id: "other" })), input, NOW),
    (error: any) => error?.code === "identity_mismatch"
  );
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({ node_kind: "vision" })), input, NOW),
    (error: any) => error?.code === "identity_mismatch"
  );
});

test("provenance read enforces node-to-authority mapping and canonical references", async () => {
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({ source_authority: "d1" })), input, NOW),
    (error: any) => error?.code === "authority_mismatch"
  );
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({ source_reference: "/private/MISSION.md" })), input, NOW),
    (error: any) => error?.code === "bad_source_reference"
  );
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({ source_reference: "repo:../MISSION.md" })), input, NOW),
    (error: any) => error?.code === "bad_source_reference"
  );
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({
      node_kind: "d1_task",
      node_id: "task-1",
      source_authority: "d1",
      source_reference: "repo:MISSION.md",
    })), {
      tenant: "cambium",
      node_kind: "d1_task",
      node_id: "task-1",
      graph_version: "42",
      max_bytes: 4096,
    }, NOW),
    (error: any) => error?.code === "bad_source_reference"
  );
});

test("provenance read verifies content digest and requested graph version", async () => {
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({ content_digest: `sha256:${"0".repeat(64)}` })), input, NOW),
    (error: any) => error?.code === "digest_mismatch"
  );
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({ graph_version: "41" })), input, NOW),
    (error: any) => error?.code === "graph_version_mismatch"
  );
});

test("provenance read rejects stale, future, and inverted freshness windows", async () => {
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({ stale_after: "2026-09-30T03:29:59.999Z" })), input, NOW),
    (error: any) => error?.code === "stale_source"
  );
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({ observed_at: "2026-09-30T03:31:00.000Z" })), input, NOW),
    (error: any) => error?.code === "future_source"
  );
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({
      observed_at: "2026-09-30T03:20:00.000Z",
      stale_after: "2026-09-30T03:19:59.999Z",
    })), input, NOW),
    (error: any) => error?.code === "bad_freshness"
  );
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({
      observed_at: "2026-02-31T03:00:00.000Z",
      stale_after: "2026-09-30T04:00:00.000Z",
    })), input, NOW),
    (error: any) => error?.code === "bad_freshness"
  );
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({
      observed_at: "2026-09-28T03:30:00.000Z",
      stale_after: "2026-10-01T03:30:00.000Z",
    })), input, NOW),
    (error: any) => error?.code === "stale_observation"
  );
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({
      observed_at: "2026-09-30T03:00:00.000Z",
      stale_after: "2026-10-02T03:00:00.001Z",
    })), input, NOW),
    (error: any) => error?.code === "freshness_window_too_long"
  );
});

test("provenance read rejects secret-bearing and machine-local bodies", async () => {
  const secretBody = { api_key: "not-a-real-secret" };
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({
      body: secretBody,
      content_digest: await digestCanonicalJson(secretBody),
    })), input, NOW),
    (error: any) => error?.code === "sensitive_content"
  );
  const pathBody = { evidence: "/Users/example/private.txt" };
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({
      body: pathBody,
      content_digest: await digestCanonicalJson(pathBody),
    })), input, NOW),
    (error: any) => error?.code === "sensitive_content"
  );
  for (const sensitive of [
    "credential is sk-provenance-must-never-escape",
    "prefix_sk-provenance-must-never-escape",
    "github_pat_1234567890abcdefghijklmnopqrstuvwxyz",
    "prefix_github_pat_1234567890abcdefghijklmnopqrstuvwxyz",
    "gho_1234567890abcdefghijklmnopqrstuv",
    "prefix_gho_1234567890abcdefghijklmnopqrstuv",
    "Authorization: Basic dXNlcjpwYXNzd29yZA==",
    "prefix_Basic dXNlcjpwYXNzd29yZA==",
    "path:/Volumes/madara/private.txt",
    "path:/Applications/Cambium/private.txt",
    "path:/usr/local/private.txt",
    "path:/custom/root/private.txt",
    "path://server/share/private.txt",
    "see,/Volumes/madara/private.txt",
    "[/Users/example/private.txt]",
    "evidence;/home/example/private.txt",
    "evidence{/Users/example/private.txt",
    "evidence]/Volumes/madara/private.txt",
    "evidence|/home/example/private.txt",
    "evidence#/private/example/private.txt",
    "evidence{C:\\Users\\example\\private.txt",
    "evidence{//server/share/private.txt",
    "file:///private/var/db/private.txt",
    "//server/share/private.txt",
    "\\\\server\\share\\private.txt",
    "evidence C:\\Users\\example\\private.txt",
  ]) {
    const body = { summary: sensitive };
    await assert.rejects(
      readInfiniteGameNode(bindingFor(await sourceRecord({
        body,
        content_digest: await digestCanonicalJson(body),
      })), input, NOW),
      (error: any) => error?.code === "sensitive_content"
    );
  }
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({ source_version: "sk-provenance-must-never-escape" })), input, NOW),
    (error: any) => error?.code === "sensitive_content"
  );
});

test("provenance read enforces body and response size bounds", async () => {
  const body = { summary: "x".repeat(5000) };
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({
      body,
      content_digest: await digestCanonicalJson(body),
    })), input, NOW),
    (error: any) => error?.code === "body_too_large"
  );

  const oversizedHeaders = new Headers({ "content-length": "200000" });
  const oversizedBinding: ProvenanceReaderBinding = {
    fetch: async () => new Response("{}", { status: 200, headers: oversizedHeaders }),
  };
  await assert.rejects(
    readInfiniteGameNode(oversizedBinding, input, NOW),
    (error: any) => error?.code === "response_too_large"
  );

  let cancelled = false;
  let chunks = 0;
  const chunkedBinding: ProvenanceReaderBinding = {
    fetch: async () => new Response(new ReadableStream({
      pull(controller) {
        chunks++;
        controller.enqueue(new Uint8Array(2048));
      },
      cancel() {
        cancelled = true;
      },
    }), { status: 200 }),
  };
  await assert.rejects(
    readInfiniteGameNode(chunkedBinding, input, NOW),
    (error: any) => error?.code === "response_too_large"
  );
  assert.equal(cancelled, true);
  assert.ok(chunks <= 66, `stream must be cancelled near the 128 KiB ceiling, got ${chunks} chunks`);
});

test("provenance read times out stalled readers", async () => {
  const stalledBinding: ProvenanceReaderBinding = {
    fetch: async () => new Promise<Response>(() => {}),
  };
  await assert.rejects(
    readInfiniteGameNode(stalledBinding, input, NOW, 5),
    (error: any) => error?.code === "reader_timeout"
  );

  const hostileStreamBinding: ProvenanceReaderBinding = {
    fetch: async () => new Response(new ReadableStream({
      pull: () => new Promise<void>(() => {}),
      cancel: () => new Promise<void>(() => {}),
    }), { status: 200 }),
  };
  const outcome = await Promise.race([
    readInfiniteGameNode(hostileStreamBinding, input, NOW, 5)
      .then(() => "resolved", (error: any) => error?.code),
    new Promise<string>((resolve) => setTimeout(() => resolve("outer_timeout"), 60)),
  ]);
  assert.equal(outcome, "reader_timeout");
});

test("provenance read rejects malformed shapes and omission injection", async () => {
  await assert.rejects(
    readInfiniteGameNode(bindingFor({ ...(await sourceRecord()), unexpected: true }), input, NOW),
    (error: any) => error?.code === "malformed_source"
  );
  await assert.rejects(
    readInfiniteGameNode(bindingFor(await sourceRecord({
      omissions: [{ field: "prompt_body", reason: "copied raw prompt" }],
    })), input, NOW),
    (error: any) => error?.code === "sensitive_content"
  );
});

test("provenance read hides upstream failures and malformed JSON", async () => {
  await assert.rejects(
    readInfiniteGameNode(bindingFor({ private: "upstream details" }, 503), input, NOW),
    (error: any) => error?.code === "reader_unavailable"
  );
  const malformed: ProvenanceReaderBinding = {
    fetch: async () => new Response("not-json", { status: 200 }),
  };
  await assert.rejects(
    readInfiniteGameNode(malformed, input, NOW),
    (error: any) => error?.code === "malformed_source"
  );
});
