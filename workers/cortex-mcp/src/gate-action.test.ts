import test from "node:test";
import assert from "node:assert/strict";
import {
  GateActionError,
  compileActionIntent,
  executeApprovedAction,
  readActionApprovalStatus,
  requestActionApproval,
  type GateActionBinding,
  type GateActionIdentity,
} from "./gate-action.ts";

const NOW = Date.parse("2026-09-30T04:00:00.000Z");
const EXPIRY = "2026-09-30T04:10:00.000Z";
const APPROVAL = `sha256:${"a".repeat(64)}`;
const RECEIPT = `sha256:${"b".repeat(64)}`;

const identity: GateActionIdentity = {
  actor: "founder-subject-1",
  plugin_identity: "chatgpt-cambium-private",
  mcp_identity: "https://cortex.example.com/mcp",
  issuer: "https://identity.example.com",
};

const input = {
  tenant: "cambium",
  action_kind: "goal-graph.apply-approved-change",
  arguments: {
    change_digest: `sha256:${"c".repeat(64)}`,
    expected_head_digest: `sha256:${"d".repeat(64)}`,
  },
  graph_version: 42,
  nonce: "gate-nonce-0001",
  expiry: EXPIRY,
  idempotency_key: "openai-goal-change-0001",
};

async function receiptFor(status: "committed" | "duplicate" = "committed") {
  const compiled = await compileActionIntent(input, identity, NOW);
  return {
    schema: "cambium.gate.action_response.v1",
    status,
    receipt: {
      schema: "cambium.gate.action_receipt.v1",
      tenant: compiled.tenant,
      actor: compiled.actor,
      plugin_identity: compiled.plugin_identity,
      mcp_identity: compiled.mcp_identity,
      issuer: compiled.issuer,
      action_kind: compiled.action_kind,
      argument_digest: compiled.argument_digest,
      action_digest: compiled.action_digest,
      graph_version: compiled.graph_version,
      nonce: compiled.nonce,
      expiry: compiled.expiry,
      idempotency_key: compiled.idempotency_key,
      approval_digest: APPROVAL,
      mutation_count: 1,
      terminal_outcome: "accepted",
      receipt_digest: RECEIPT,
      authoritative_readback: {
        schema: "cambium.gate.authoritative_readback.v1",
        tenant: compiled.tenant,
        actor: compiled.actor,
        action_digest: compiled.action_digest,
        graph_version: compiled.graph_version,
        terminal_outcome: "accepted",
        receipt_digest: RECEIPT,
      },
    },
  };
}

function bindingFor(payload: unknown, status = 200, observe?: (body: any) => void): GateActionBinding {
  return {
    async fetch(target, init) {
      assert.equal(String(target), "https://cambium-gate.internal/mcp/actions/execute");
      observe?.(JSON.parse(String(init?.body)));
      return Response.json(payload, { status });
    },
  };
}

function reviewBindingFor(path: string, payload: unknown, observe?: (body: any) => void): GateActionBinding {
  return {
    async fetch(target, init) {
      assert.equal(String(target), `https://cambium-gate.internal${path}`);
      observe?.(JSON.parse(String(init?.body)));
      return Response.json(payload);
    },
  };
}

test("compile derives actor and argument digest into a non-writing exact tuple", async () => {
  const compiled = await compileActionIntent(input, identity, NOW);
  assert.equal(compiled.schema, "cambium.mcp.action_intent.v1");
  assert.equal(compiled.actor, identity.actor);
  assert.match(compiled.argument_digest, /^sha256:[a-f0-9]{64}$/);
  assert.match(compiled.action_digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(compiled.status, "compiled_not_authorized");
  assert.equal(compiled.writer_authority, false);
  assert.equal(compiled.canonical_completion, false);
  assert.equal((compiled as any).arguments, undefined, "raw action arguments are not retained in the intent");

  const reordered = await compileActionIntent({
    ...input,
    arguments: {
      expected_head_digest: input.arguments.expected_head_digest,
      change_digest: input.arguments.change_digest,
    },
  }, identity, NOW);
  assert.equal(reordered.argument_digest, compiled.argument_digest);
  assert.equal(reordered.action_digest, compiled.action_digest);
});

test("compile rejects undeclared, caller-identity, sensitive, stale, and malformed input", async () => {
  const cases: Array<[string, unknown, string]> = [
    ["unknown", { ...input, surprise: true }, "bad_input"],
    ["caller actor", { ...input, actor: identity.actor }, "bad_input"],
    ["caller argument digest", { ...input, argument_digest: `sha256:${"0".repeat(64)}` }, "bad_input"],
    ["secret field", { ...input, arguments: { api_key: "not-a-secret" } }, "sensitive_content"],
    ["machine path", { ...input, arguments: { evidence: "/Users/example/private.txt" } }, "sensitive_content"],
    ["expired", { ...input, expiry: "2026-09-30T03:59:59.999Z" }, "approval_expired"],
    ["overlong window", { ...input, expiry: "2026-09-30T04:30:00.000Z" }, "approval_window_too_long"],
    ["bad version", { ...input, graph_version: "42" }, "bad_graph_version"],
  ];
  for (const [label, candidate, code] of cases) {
    await assert.rejects(
      compileActionIntent(candidate as any, identity, NOW),
      (error: any) => error instanceof GateActionError && error.code === code,
      label,
    );
  }
});

test("request and status bind the compiled tuple without granting writer authority", async () => {
  const compiled = await compileActionIntent(input, identity, NOW);
  const requestDigest = `sha256:${"e".repeat(64)}`;
  let requestedBody: any;
  const requested = await requestActionApproval(reviewBindingFor("/mcp/actions/request-approval", {
    schema: "cambium.gate.action_review_response.v1",
    status: "awaiting_founder_approval",
    duplicate: false,
    tenant: compiled.tenant,
    action_digest: compiled.action_digest,
    request_digest: requestDigest,
    approval_digest: null,
    expiry: compiled.expiry,
  }, (body) => { requestedBody = body; }), input, identity, NOW);
  assert.equal(requestedBody.intent.action_digest, compiled.action_digest);
  assert.deepEqual(requestedBody.arguments, input.arguments);
  assert.equal(requested.status, "awaiting_founder_approval");
  assert.equal(requested.request_digest, requestDigest);
  assert.equal(requested.writer_authority, false);
  assert.equal(requested.canonical_completion, false);

  let statusBody: any;
  const status = await readActionApprovalStatus(reviewBindingFor("/mcp/actions/approval-status", {
    schema: "cambium.gate.action_review_status.v1",
    status: "approved",
    tenant: compiled.tenant,
    action_digest: compiled.action_digest,
    request_digest: requestDigest,
    approval_digest: APPROVAL,
    receipt_digest: null,
    expiry: compiled.expiry,
    writer_authority: false,
    canonical_completion: false,
  }, (body) => { statusBody = body; }), input, identity, NOW);
  assert.equal(statusBody.intent.action_digest, compiled.action_digest);
  assert.equal(statusBody.arguments, undefined);
  assert.equal(status.status, "approved");
  assert.equal(status.approval_digest, APPROVAL);
});

test("review transport rejects tuple drift and malformed responses", async () => {
  const compiled = await compileActionIntent(input, identity, NOW);
  await assert.rejects(
    requestActionApproval(reviewBindingFor("/mcp/actions/request-approval", {
      schema: "cambium.gate.action_review_response.v1",
      status: "awaiting_founder_approval",
      duplicate: false,
      tenant: compiled.tenant,
      action_digest: `sha256:${"f".repeat(64)}`,
      request_digest: `sha256:${"e".repeat(64)}`,
      approval_digest: null,
      expiry: compiled.expiry,
    }), input, identity, NOW),
    (error: any) => error?.code === "readback_mismatch",
  );
  await assert.rejects(
    readActionApprovalStatus(reviewBindingFor("/mcp/actions/approval-status", { status: "approved" }), input, identity, NOW),
    (error: any) => error?.code === "malformed_receipt",
  );
});

test("status can report an expired stored review after the action window closes", async () => {
  const compiled = await compileActionIntent(input, identity, NOW);
  const requestDigest = `sha256:${"e".repeat(64)}`;
  const status = await readActionApprovalStatus(reviewBindingFor("/mcp/actions/approval-status", {
    schema: "cambium.gate.action_review_status.v1",
    status: "expired",
    tenant: compiled.tenant,
    action_digest: compiled.action_digest,
    request_digest: requestDigest,
    approval_digest: null,
    receipt_digest: null,
    expiry: compiled.expiry,
    writer_authority: false,
    canonical_completion: false,
  }), input, identity, Date.parse("2026-09-30T04:11:00.000Z"));
  assert.equal(status.status, "expired");
  assert.equal(status.canonical_completion, false);
});

test("execute sends only the exact server-derived tuple and accepts matching authoritative readback", async () => {
  const payload = await receiptFor();
  let dispatched: any;
  const result = await executeApprovedAction(
    bindingFor(payload, 200, (body) => { dispatched = body; }),
    { ...input, approval_digest: APPROVAL },
    identity,
    NOW,
  );
  assert.equal(dispatched.schema, "cambium.mcp.gate_action_request.v1");
  assert.equal(dispatched.intent.actor, identity.actor);
  assert.equal(dispatched.intent.plugin_identity, identity.plugin_identity);
  assert.equal(dispatched.intent.mcp_identity, identity.mcp_identity);
  assert.equal(dispatched.intent.arguments, undefined);
  assert.equal(dispatched.approval_digest, APPROVAL);
  assert.equal(result.schema, "cambium.mcp.action_receipt.v1");
  assert.equal(result.status, "committed");
  assert.equal(result.mutation_count, 1);
  assert.equal(result.authoritative_readback.receipt_digest, RECEIPT);
  assert.equal(result.writer_authority, false);
  assert.equal(result.canonical_completion, true);
});

test("identical replay returns the original receipt while conflict and drift fail closed", async () => {
  const duplicate = await executeApprovedAction(
    bindingFor(await receiptFor("duplicate")),
    { ...input, approval_digest: APPROVAL },
    identity,
    NOW,
  );
  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.receipt_digest, RECEIPT);
  assert.equal(duplicate.mutation_count, 1);

  await assert.rejects(
    executeApprovedAction(bindingFor({ error: "idempotency_conflict" }, 409), { ...input, approval_digest: APPROVAL }, identity, NOW),
    (error: any) => error?.code === "idempotency_conflict",
  );

  for (const mutate of [
    (p: any) => { p.receipt.tenant = "other-tenant"; return p; },
    (p: any) => { p.receipt.actor = "other-founder"; return p; },
    (p: any) => { p.receipt.action_digest = `sha256:${"e".repeat(64)}`; return p; },
    (p: any) => { p.receipt.mutation_count = 2; return p; },
    (p: any) => { p.receipt.authoritative_readback.terminal_outcome = "failed"; return p; },
    (p: any) => { p.receipt.authoritative_readback.receipt_digest = `sha256:${"f".repeat(64)}`; return p; },
  ]) {
    await assert.rejects(
      executeApprovedAction(bindingFor(mutate(await receiptFor())), { ...input, approval_digest: APPROVAL }, identity, NOW),
      (error: any) => error?.code === "readback_mismatch",
    );
  }
});

test("Gate unavailability, oversized responses, and deadlines fail without reflecting secrets", async () => {
  await assert.rejects(
    executeApprovedAction(bindingFor({ error: "unavailable" }, 503), { ...input, approval_digest: APPROVAL }, identity, NOW),
    (error: any) => error?.code === "gate_unavailable",
  );

  const oversized: GateActionBinding = {
    fetch: async () => new Response("{}", { headers: { "content-length": "200000" } }),
  };
  await assert.rejects(
    executeApprovedAction(oversized, { ...input, approval_digest: APPROVAL }, identity, NOW),
    (error: any) => error?.code === "response_too_large",
  );

  const stalled: GateActionBinding = {
    fetch: async () => new Promise<Response>(() => undefined),
  };
  await assert.rejects(
    executeApprovedAction(stalled, { ...input, approval_digest: APPROVAL }, identity, NOW, 5),
    (error: any) => error?.code === "gate_timeout",
  );

  const secret = "sk-action-must-not-escape";
  const payload = await receiptFor();
  (payload.receipt as any).debug = secret;
  await assert.rejects(
    executeApprovedAction(bindingFor(payload), { ...input, approval_digest: APPROVAL }, identity, NOW),
    (error: any) => error?.code === "malformed_receipt",
  );
});

test("expired execute still reaches Gate and accepts the stored duplicate receipt", async () => {
  const expiredInput = { ...input, expiry: "2026-09-30T03:59:59.999Z" };
  const compiled = await compileActionIntent(expiredInput, identity, NOW, { allowExpired: true });
  const payload = {
    schema: "cambium.gate.action_response.v1",
    status: "duplicate",
    receipt: {
      schema: "cambium.gate.action_receipt.v1",
      tenant: compiled.tenant,
      actor: compiled.actor,
      plugin_identity: compiled.plugin_identity,
      mcp_identity: compiled.mcp_identity,
      issuer: compiled.issuer,
      action_kind: compiled.action_kind,
      argument_digest: compiled.argument_digest,
      action_digest: compiled.action_digest,
      graph_version: compiled.graph_version,
      nonce: compiled.nonce,
      expiry: compiled.expiry,
      idempotency_key: compiled.idempotency_key,
      approval_digest: APPROVAL,
      mutation_count: 1,
      terminal_outcome: "accepted",
      receipt_digest: RECEIPT,
      authoritative_readback: {
        schema: "cambium.gate.authoritative_readback.v1",
        tenant: compiled.tenant,
        actor: compiled.actor,
        action_digest: compiled.action_digest,
        graph_version: compiled.graph_version,
        terminal_outcome: "accepted",
        receipt_digest: RECEIPT,
      },
    },
  };
  let fetched = false;
  const result = await executeApprovedAction(
    bindingFor(payload, 200, () => { fetched = true; }),
    { ...expiredInput, approval_digest: APPROVAL },
    identity,
    NOW,
  );
  assert.equal(fetched, true);
  assert.equal(result.status, "duplicate");
  assert.equal(result.expiry, expiredInput.expiry);
  assert.equal(result.receipt_digest, RECEIPT);
});
