export const SCOPE_CATALOG = [
  "tokens:issue",
  "library:read",
  "library:write",
  "library:*",
  "library:personal:read",
  "library:personal:write",
  "library:personal:*",
  "field:read",
  "field:write",
  "muse:read",
  "muse:write",
] as const;

export const DEFAULT_TTL_SECONDS = 12 * 60 * 60;
export const MAX_TTL_SECONDS = 7 * 24 * 60 * 60;
export const ALETHEIOS_AGENT = "aletheios";

export function isGrantableScope(scope: string): boolean {
  if (!(SCOPE_CATALOG as readonly string[]).includes(scope)) return false;
  if (scope === "tokens:issue" || scope.endsWith(":issue")) return false;
  if (scope.toLowerCase().includes("approv")) return false;
  return true;
}

export function scopeAllows(granted: string[], required: string): boolean {
  if (granted.includes(required)) return true;
  if (required.startsWith("library:personal:")) return granted.includes("library:personal:*");
  if (required.startsWith("library:") && !required.startsWith("library:personal:")) return granted.includes("library:*");
  return false;
}
