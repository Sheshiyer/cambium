import { base64Url } from "./http.ts";

export interface AccessClaims {
  email: string;
  aud?: string;
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string, usages: ("sign" | "verify")[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

export async function signAccessJwt(claims: AccessClaims, secret: string): Promise<string> {
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const key = await hmacKey(secret, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`)));
  return `${header}.${payload}.${base64Url(signature)}`;
}

export async function verifyAccessJwt(token: string, secret: string, expectedAud?: string): Promise<AccessClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3 || !secret) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  const headerBytes = decodeBase64Url(headerPart);
  const payloadBytes = decodeBase64Url(payloadPart);
  const signature = decodeBase64Url(signaturePart);
  if (!headerBytes || !payloadBytes || !signature) return null;
  let header: { alg?: string };
  let payload: { email?: unknown; aud?: unknown };
  try {
    header = JSON.parse(new TextDecoder().decode(headerBytes));
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }
  if (header.alg !== "HS256" || typeof payload.email !== "string" || payload.email.length === 0) return null;
  if (expectedAud && payload.aud !== expectedAud) return null;
  const key = await hmacKey(secret, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(`${headerPart}.${payloadPart}`));
  if (!valid) return null;
  return { email: payload.email, aud: typeof payload.aud === "string" ? payload.aud : undefined };
}
