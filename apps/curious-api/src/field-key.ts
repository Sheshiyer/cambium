import { base64Url } from "./http.ts";

function decodeKey(encoded: string): Uint8Array | null {
  try {
    const padded = encoded.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (encoded.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}

async function aesKey(encoded: string): Promise<CryptoKey | null> {
  const raw = decodeKey(encoded);
  if (!raw) return null;
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptPersonal(encodedKey: string, value: unknown): Promise<string | null> {
  const key = await aesKey(encodedKey);
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  ));
  return `${base64Url(iv)}.${base64Url(cipher)}`;
}

export async function decryptPersonal(encodedKey: string, packed: string): Promise<unknown | null> {
  const key = await aesKey(encodedKey);
  const [ivPart, cipherPart] = packed.split(".");
  if (!key || !ivPart || !cipherPart) return null;
  const iv = decodePacked(ivPart);
  const cipher = decodePacked(cipherPart);
  if (!iv || !cipher) return null;
  try {
    const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return JSON.parse(new TextDecoder().decode(clear));
  } catch {
    return null;
  }
}

function decodePacked(value: string): Uint8Array | null {
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
