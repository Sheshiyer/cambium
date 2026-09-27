/** Read-only Apple Mail MCP tools permitted through the Labs gateway. */
export const ALLOWED_TOOLS = [
  "health-check",
  "doctor",
  "list-accounts",
  "list-mailboxes",
  "search-messages",
  "list-messages",
  "get-message",
  "get-message-headers",
  "get-unread-count",
  "get-mail-stats",
  "get-sync-status",
  "get-thread",
  "list-attachments",
  "save-attachment",
] as const;

export type AllowedTool = (typeof ALLOWED_TOOLS)[number];

const ALLOWED_SET = new Set<string>(ALLOWED_TOOLS);

export function isAllowedTool(name: unknown): name is AllowedTool {
  return typeof name === "string" && ALLOWED_SET.has(name);
}
