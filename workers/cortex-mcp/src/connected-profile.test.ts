import test from "node:test";
import assert from "node:assert/strict";
import {
  ConnectedProfileError,
  deriveConnectedProfile,
  resolveConnectedProfileConfig,
} from "./connected-profile.ts";

const PROFILE_KEY = "connected-profile-test-key-material-00000001";
const ISSUER = "https://identity.example.com";

test("connected profile identity is stable for one verified principal", async () => {
  const first = await deriveConnectedProfile(PROFILE_KEY, ISSUER, "subject-1");
  const repeated = await deriveConnectedProfile(PROFILE_KEY, ISSUER, "subject-1");

  assert.deepEqual(first, repeated);
  assert.match(first.id, /^prf_[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(first), ["id"]);
  assert.notEqual(
    first.id,
    (await deriveConnectedProfile(`${PROFILE_KEY}-rotated`, ISSUER, "subject-1")).id,
    "profile-key rotation is detectable because the derived ID changes",
  );
});

test("connected profile identity separates subjects and issuers", async () => {
  const baseline = await deriveConnectedProfile(PROFILE_KEY, ISSUER, "subject-1");
  const otherSubject = await deriveConnectedProfile(PROFILE_KEY, ISSUER, "subject-2");
  const otherIssuer = await deriveConnectedProfile(
    PROFILE_KEY,
    "https://other-identity.example.com",
    "subject-1",
  );

  assert.notEqual(baseline.id, otherSubject.id);
  assert.notEqual(baseline.id, otherIssuer.id);
  assert.notEqual(
    (await deriveConnectedProfile(PROFILE_KEY, "https://identity.example.com", "subject-1")).id,
    (await deriveConnectedProfile(PROFILE_KEY, "https://identity.example.com/", "subject-1")).id,
    "OAuth issuer identifiers retain exact trailing-slash semantics",
  );
});

test("connected profile configuration fails closed without strong key material", () => {
  assert.equal(resolveConnectedProfileConfig(undefined), null);
  assert.equal(resolveConnectedProfileConfig("short"), null);
  assert.equal(resolveConnectedProfileConfig(`valid-profile-key-material-${"x".repeat(20)}\n`), null);
  assert.equal(resolveConnectedProfileConfig("x".repeat(513)), null);
  assert.deepEqual(resolveConnectedProfileConfig(PROFILE_KEY), { key: PROFILE_KEY });
});

test("connected profile rejects missing or malformed verified identity", async () => {
  for (const [issuer, subject] of [
    ["", "subject-1"],
    [ISSUER, ""],
    [ISSUER, "subject\n1"],
    ["not-an-https-issuer", "subject-1"],
    [ISSUER, "x".repeat(257)],
  ]) {
    await assert.rejects(
      () => deriveConnectedProfile(PROFILE_KEY, issuer, subject),
      (error: unknown) => error instanceof ConnectedProfileError
        && error.code === "verified_profile_identity_required",
    );
  }
});

test("connected profile result discloses no source identity or secret material", async () => {
  const subject = "founder@example.com/session/token/tenant-cambium";
  const result = await deriveConnectedProfile(PROFILE_KEY, ISSUER, subject);
  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes(subject), false);
  assert.equal(serialized.includes(PROFILE_KEY), false);
  assert.equal(serialized.includes("example.com"), false);
  assert.equal(serialized.includes("tenant"), false);
  assert.equal(serialized.includes("token"), false);
  assert.equal(serialized.includes("session"), false);
});
