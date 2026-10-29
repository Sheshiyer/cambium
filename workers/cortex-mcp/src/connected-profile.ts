const encoder = new TextEncoder();

export interface ConnectedProfileConfig {
  key: string;
}

export interface ConnectedProfile {
  id: string;
}

export class ConnectedProfileError extends Error {
  readonly code: "verified_profile_identity_required";

  constructor(code: "verified_profile_identity_required") {
    super(code);
    this.name = "ConnectedProfileError";
    this.code = code;
  }
}

export function resolveConnectedProfileConfig(value: string | undefined): ConnectedProfileConfig | null {
  if (typeof value !== "string") return null;
  const byteLength = encoder.encode(value).byteLength;
  if (byteLength < 32 || byteLength > 512 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  return { key: value };
}

function verifiedIdentity(issuerValue: string, subjectValue: string) {
  if (typeof issuerValue !== "string" || typeof subjectValue !== "string") {
    throw new ConnectedProfileError("verified_profile_identity_required");
  }
  if (subjectValue.length < 1
      || subjectValue.length > 256
      || subjectValue !== subjectValue.trim()
      || /[\u0000-\u001f\u007f]/.test(subjectValue)) {
    throw new ConnectedProfileError("verified_profile_identity_required");
  }
  let issuer: URL;
  try {
    issuer = new URL(issuerValue);
  } catch {
    throw new ConnectedProfileError("verified_profile_identity_required");
  }
  if (issuer.protocol !== "https:"
      || issuer.username
      || issuer.password
      || issuer.search
      || issuer.hash) {
    throw new ConnectedProfileError("verified_profile_identity_required");
  }
  return `${issuerValue}\u0000${subjectValue}`;
}

export async function deriveConnectedProfile(
  keyValue: string,
  issuer: string,
  subject: string,
): Promise<ConnectedProfile> {
  const config = resolveConnectedProfileConfig(keyValue);
  if (!config) throw new ConnectedProfileError("verified_profile_identity_required");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(config.key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(verifiedIdentity(issuer, subject)),
  ));
  const digest = [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return Object.freeze({ id: `prf_${digest}` });
}
