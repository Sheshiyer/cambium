export type AuthOk = { ok: true };
export type AuthDenied = { ok: false; status: 401; error: string };
export type AuthResult = AuthOk | AuthDenied;

function bytesEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

async function digest(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

export async function bearerMatches(got: string, expected: string): Promise<boolean> {
  if (!got || !expected) return false;
  const [a, b] = await Promise.all([digest(got), digest(expected)]);
  return bytesEqual(a, b);
}

function readBearer(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)/i.exec(header.trim());
  return match ? match[1] : null;
}

/** Fail closed: missing secret or missing/invalid Bearer is 401. */
export async function authorizeRequest(
  request: Request,
  mcpBearer: string | undefined,
): Promise<AuthResult> {
  if (!mcpBearer) {
    return { ok: false, status: 401, error: "gateway_unconfigured" };
  }
  const token = readBearer(request.headers.get("authorization"));
  if (!token) {
    return { ok: false, status: 401, error: "bearer_required" };
  }
  if (!(await bearerMatches(token, mcpBearer))) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}
